import { copyFile, mkdir, mkdtemp, rm, writeFile, readFile, lstat, open, readdir } from 'node:fs/promises'
import { existsSync, realpathSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { run, runOk } from './proc.ts'
import { RunStore } from './run-store.ts'

/** Largest patch accepted for one candidate. Bigger changes are refused, never truncated. */
export const MAX_PATCH_CHARS = 32 * 1024 * 1024

/** Repository selectors inherited from a terminal must not redirect lifecycle
 * operations. Only deliberate per-command settings may reintroduce Git vars. */
function gitEnvironment(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))), ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' }
}

export function git(cwd: string, args: readonly string[], env?: NodeJS.ProcessEnv, input?: string, limits?: { timeoutMs?: number; signal?: AbortSignal }): Promise<string> {
  return runOk(['git', ...args], {
    cwd,
    maxOutput: MAX_PATCH_CHARS,
    env: gitEnvironment(env),
    ...(input === undefined ? {} : { input }),
    ...limits,
  })
}

export async function gitTry(cwd: string, args: readonly string[]): Promise<string | undefined> {
  const r = await run(['git', ...args], { cwd, env: gitEnvironment() })
  return r.code === 0 ? r.stdout : undefined
}

export async function repoRoot(dir: string): Promise<string> {
  return path.resolve((await git(dir, ['rev-parse', '--show-toplevel'])).trim())
}

export async function headCommit(repo: string): Promise<string | undefined> {
  return (await gitTry(repo, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}']))?.trim() || undefined
}

const AUTHOR_ENV = {
  GIT_AUTHOR_NAME: 'agent-compare',
  GIT_AUTHOR_EMAIL: 'agent-compare@localhost',
  GIT_COMMITTER_NAME: 'agent-compare',
  GIT_COMMITTER_EMAIL: 'agent-compare@localhost',
}

export async function commitTree(repo: string, tree: string, parents: readonly (string | undefined)[], message: string): Promise<string> {
  const args = ['commit-tree', tree]
  for (const p of parents) if (p !== undefined) args.push('-p', p)
  return (await git(repo, args, AUTHOR_ENV, message)).trim()
}

/**
 * Record the working tree of `repo` (HEAD + staged + unstaged + untracked,
 * minus ignored files) as a tree object, without touching the user's index or
 * files. A copy of the real index seeds a private index so unchanged files keep
 * their stat cache and are not re-hashed.
 */
export async function snapshotTree(repo: string, scratchDir: string, extraExcludes: readonly string[] = []): Promise<string> {
  await mkdir(scratchDir, { recursive: true })
  const allocation = await mkdtemp(path.join(scratchDir, 'index-'))
  const tmpIndex = path.join(allocation, 'index')
  const env = { GIT_INDEX_FILE: tmpIndex }
  try {
    const realIndex = path.resolve(repo, (await git(repo, ['rev-parse', '--git-path', 'index'])).trim())
    if (existsSync(realIndex)) await copyFile(realIndex, tmpIndex)
    else if (await headCommit(repo)) await git(repo, ['read-tree', 'HEAD'], env)
    const pathspec = ['--', '.', ...extraExcludes]
    await git(repo, ['add', '-A', ...pathspec], env)
    return (await git(repo, ['write-tree'], env)).trim()
  } finally {
    await rm(allocation, { recursive: true, force: true })
  }
}

export async function treeOf(repo: string, rev: string): Promise<string> {
  return (await git(repo, ['rev-parse', `${rev}^{tree}`])).trim()
}

export async function pinRef(repo: string, ref: string, commit: string): Promise<void> {
  await git(repo, ['update-ref', ref, commit])
}

export async function dropRefs(repo: string, prefix: string): Promise<void> {
  const out = await gitTry(repo, ['for-each-ref', '--format=%(refname)', prefix])
  for (const ref of (out ?? '').split('\n').filter(Boolean)) await gitTry(repo, ['update-ref', '-d', ref])
}

/** Proof that a copy was created by one run: stored in the copy's git admin dir, outside its files. */
export interface OwnerMark {
  readonly runId: string
  readonly label: string
  readonly token: string
}

const OWNER_FILE = 'agent-compare-owner.json'

export interface OwnedCopy { readonly repo: string; readonly owner: OwnerMark }

/** Small metadata files must be ordinary files, with a stable opened identity. */
async function metadata(file: string): Promise<string> {
  const before = await lstat(file)
  if (!before.isFile() || before.isSymbolicLink() || before.size > 16 * 1024) throw new Error('invalid worktree metadata file')
  const handle = await open(file, 'r')
  try {
    const opened = await handle.stat()
    if (!opened.isFile() || opened.size > 16 * 1024 || before.dev !== opened.dev || before.ino !== opened.ino) throw new Error('worktree metadata changed while opening')
    const bytes = Buffer.alloc(16 * 1024 + 1)
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0)
    const after = await lstat(file), final = await handle.stat()
    if (bytesRead > 16 * 1024 || after.isSymbolicLink() || after.dev !== opened.dev || after.ino !== opened.ino || final.size !== opened.size || final.mtimeMs !== opened.mtimeMs || bytesRead !== opened.size) throw new Error('worktree metadata changed while reading')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, bytesRead))
  } finally { await handle.close() }
}

const owns = (mark: OwnerMark | undefined, owner: OwnerMark): boolean => mark?.runId === owner.runId && mark.label === owner.label && mark.token === owner.token

/** Discover administration from the trusted repository, never by invoking Git
 * in a candidate whose .git pointer can be edited by project commands. */
export async function ownedWorktreeAdmin(repo: string, dir: string, owner: OwnerMark): Promise<string> {
  if (samePath(repo, dir)) throw new Error('owned copy is the main checkout')
  const directory = await lstat(dir)
  if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('owned copy directory is linked or missing')
  const common = path.resolve(repo, (await git(repo, ['rev-parse', '--git-common-dir'])).trim())
  const pool = path.join(common, 'worktrees'), poolStat = await lstat(pool)
  if (!poolStat.isDirectory() || poolStat.isSymbolicLink()) throw new Error('worktree administration directory is linked or missing')
  const matches: string[] = []
  for (const entry of await readdir(pool, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue
    const admin = path.join(pool, entry.name)
    let mark: OwnerMark | undefined
    try { mark = JSON.parse(await metadata(path.join(admin, OWNER_FILE))) as OwnerMark } catch { continue }
    if (owns(mark, owner)) matches.push(admin)
  }
  if (matches.length !== 1) throw new Error('worktree owner mark missing, different or ambiguous')
  const admin = matches[0]!
  if (!samePath(path.resolve(admin, (await metadata(path.join(admin, 'commondir'))).trim()), common)) throw new Error('worktree common directory does not match')
  if (!samePath((await metadata(path.join(admin, 'gitdir'))).trim(), path.join(dir, '.git'))) throw new Error('worktree administration backlink does not match')
  const pointer = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(await metadata(path.join(dir, '.git')))?.[1]
  if (!pointer || !samePath(path.resolve(dir, pointer), admin)) throw new Error('candidate Git pointer does not match its owned worktree')
  return admin
}

/** Explicit arguments keep a pointer changed after attestation from selecting
 * the original or a sibling index. Each later operation attests again. */
export async function ownedGit(dir: string, copy: OwnedCopy, args: readonly string[], env?: NodeJS.ProcessEnv, input?: string): Promise<string> {
  const admin = await ownedWorktreeAdmin(copy.repo, dir, copy.owner)
  return git(dir, ['--git-dir', admin, '--work-tree', dir, '-c', 'core.fsmonitor=false', ...args], env, input)
}

export async function ownedCopyTree(dir: string, copy: OwnedCopy): Promise<string> {
  await ownedGit(dir, copy, ['add', '-A', '--', '.', ...ALWAYS_EXCLUDED])
  return (await ownedGit(dir, copy, ['write-tree'])).trim()
}

/**
 * Create a detached worktree for `commit` and mark it as owned. The mark lives
 * in `<repo>/.git/worktrees/<name>/`, so it is neither project content nor
 * writable by an agent confined to the copy.
 */
export async function addOwnedWorktree(repo: string, dir: string, commit: string, owner: OwnerMark): Promise<void> {
  return withWorktreeAdministration(repo, () => addOwnedWorktreeUnlocked(repo, dir, commit, owner))
}

async function addOwnedWorktreeUnlocked(repo: string, dir: string, commit: string, owner: OwnerMark): Promise<void> {
  if (existsSync(dir)) throw new Error(`refusing to create a copy over an existing path: ${dir}`)
  await mkdir(path.dirname(dir), { recursive: true })
  await git(repo, ['worktree', 'add', '--detach', dir, commit])
  await writeFile(path.join(await worktreeAdminDir(dir), OWNER_FILE), JSON.stringify(owner))
}

async function worktreeAdminDir(dir: string): Promise<string> {
  return path.resolve(dir, (await git(dir, ['rev-parse', '--git-dir'])).trim())
}

/** Absolute paths of every worktree registered in `repo`. */
export async function registeredWorktrees(repo: string): Promise<string[]> {
  const out = (await gitTry(repo, ['worktree', 'list', '--porcelain', '-z'])) ?? ''
  return out.split('\0').filter((l) => l.startsWith('worktree ')).map((l) => path.resolve(l.slice('worktree '.length)))
}

/**
 * One spelling per directory: the real path, so 8.3 short names
 * (`C:\Users\RUNNER~1`), junctions and symlinks compare equal to what git reports.
 */
function canonicalPath(p: string): string {
  let real = path.resolve(p)
  try { real = realpathSync.native(real) } catch { /* gone or unreadable: compare as given */ }
  return process.platform === 'win32' ? real.toLowerCase() : real
}

const samePath = (a: string, b: string): boolean => canonicalPath(a) === canonicalPath(b)

/**
 * Delete a copy only when all of this holds: it is a registered worktree of
 * `repo`, it is not the main checkout, and its owner mark matches. Anything
 * else is left in place and reported.
 */
export async function removeOwnedWorktree(repo: string, dir: string, owner: OwnerMark): Promise<{ removed: boolean; reason?: string }> {
  return withWorktreeAdministration(repo, () => removeOwnedWorktreeUnlocked(repo, dir, owner))
}

async function removeOwnedWorktreeUnlocked(repo: string, dir: string, owner: OwnerMark): Promise<{ removed: boolean; reason?: string }> {
  if (!existsSync(dir)) {
    await gitTry(repo, ['worktree', 'prune'])
    return { removed: true }
  }
  if (samePath(dir, repo)) return { removed: false, reason: 'is the main checkout' }
  const registered = await registeredWorktrees(repo)
  if (!registered.some((w) => samePath(w, dir))) return { removed: false, reason: 'not a registered worktree of the repository' }
  try {
    await ownedWorktreeAdmin(repo, dir, owner)
  } catch (error) {
    return { removed: false, reason: (error as Error).message }
  }
  await gitTry(repo, ['worktree', 'remove', '--force', '--force', dir])
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  await gitTry(repo, ['worktree', 'prune'])
  return { removed: !existsSync(dir) }
}

/** Git scans sibling worktree metadata during add/prune. A sibling must not be
 * visible half-initialized. Lock the trusted common directory, including when
 * separate plugin homes or linked checkouts reach the same repository. */
async function withWorktreeAdministration<T>(repo: string, operation: () => Promise<T>): Promise<T> {
  const common = path.resolve(repo, (await git(repo, ['rev-parse', '--git-common-dir'])).trim())
  const locks = new RunStore(path.join(canonicalPath(common), 'agent-compare-administration'))
  return locks.withLock('worktrees', operation, { waitMs: 60_000, busyMessage: '这个仓库的工作区管理操作仍在进行，请稍后重试' })
}

/** Adoption, undo and journal recovery share the repository's trusted common
 * directory, including callers using different plugin homes. */
export async function withRepositoryWrite<T>(repo: string, operation: () => Promise<T>, opts: { busyMessage?: string } = {}): Promise<T> {
  const common = path.resolve(repo, (await git(repo, ['rev-parse', '--git-common-dir'])).trim())
  const locks = new RunStore(path.join(canonicalPath(common), 'agent-compare-administration'))
  return locks.withLock('adoption', operation, opts)
}

/**
 * The tree the checkout would have after adoption: `baseTree` (the checkout
 * now) with the candidate's version of every touched path. Built in a private
 * index; nothing in the repository changes.
 */
export async function overlayTree(repo: string, scratchDir: string, baseTree: string, source: string, nameStatus: ReadonlyArray<{ status: string; path: string }>): Promise<string> {
  await mkdir(scratchDir, { recursive: true })
  const scratch = path.resolve(scratchDir)
  const allocation = await mkdtemp(path.join(scratch, 'overlay-'))
  const env = { GIT_INDEX_FILE: path.join(allocation, 'index') }
  try {
    await git(repo, ['read-tree', baseTree], env)
    const lines: string[] = []
    const writes = nameStatus.filter((n) => n.status !== 'D').map((n) => n.path)
    if (writes.length > 0) {
      const listed = await git(repo, ['ls-tree', '-z', '--full-tree', source, '--', ...writes.map((p) => `:(literal)${p}`)])
      for (const rec of listed.split('\0').filter(Boolean)) {
        const [meta, p] = [rec.slice(0, rec.indexOf('\t')), rec.slice(rec.indexOf('\t') + 1)]
        const [mode, , sha] = meta.split(' ')
        lines.push(`${mode} ${sha}\t${p}`)
      }
    }
    for (const n of nameStatus) if (n.status === 'D') lines.push(`0 ${'0'.repeat(40)}\t${n.path}`)
    if (lines.length > 0) await git(repo, ['update-index', '-z', '--index-info'], env, lines.join('\0') + '\0')
    return (await git(repo, ['write-tree'], env)).trim()
  } finally {
    if (path.dirname(allocation) !== scratch) throw new Error('Private index escaped its scratch directory')
    await rm(allocation, { recursive: true, force: true })
  }
}

/** Fingerprint of what is staged (the index entries), to prove adoption left it alone. */
export async function stagedFingerprint(repo: string): Promise<string> {
  return createHash('sha256').update(await git(repo, ['ls-files', '-s', '-z'])).digest('hex')
}

/** path → blob sha for the entries of `tree` whose path satisfies `keep`. */
export async function treeBlobs(repo: string, tree: string, keep: (p: string) => boolean): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const rec of (await git(repo, ['ls-tree', '-r', '-z', '--full-tree', tree])).split('\0').filter(Boolean)) {
    const tab = rec.indexOf('\t')
    const p = rec.slice(tab + 1)
    if (keep(p)) out[p] = rec.slice(0, tab).split(' ')[2]!
  }
  return out
}

export async function readBlob(repo: string, rev: string, file: string): Promise<string | undefined> {
  return gitTry(repo, ['show', `${rev}:${file}`])
}

export interface CapturedChange {
  readonly commit: string
  readonly tree: string
  readonly patch: string
  readonly sha256: string
  readonly stats: { files: number; insertions: number; deletions: number; binary: number }
  readonly touched: string[]
  readonly nameStatus: Array<{ status: string; path: string }>
}

/**
 * Pathspecs for paths never treated as project content, even when the project
 * does not ignore them. The `glob` form matters: a plain `:(exclude)node_modules`
 * makes `git add` fail with "paths are ignored" when the project does ignore it.
 */
export const ALWAYS_EXCLUDED = [':(exclude,glob)**/node_modules/**', ':(exclude,glob)**/.vite/**', ':(exclude,glob).agents/worktrees/**']

/**
 * `shared-root` isolation only: copies live inside the repository, in DSH's
 * worktree pool, because a `ctx.subagents` child inherits its parent's sandbox
 * root (the repository) and could not write anywhere else. `own-root` copies
 * live under the plugin home instead.
 */
export const WORKTREE_POOL = path.join('.agents', 'worktrees')

/** Create the pool on first use with a `*` .gitignore (DSH's convention); an existing pool is left as is. */
export async function ensureWorktreePool(repo: string): Promise<string> {
  const pool = path.join(repo, WORKTREE_POOL)
  if (!existsSync(pool)) {
    await mkdir(pool, { recursive: true })
    await writeFile(path.join(pool, '.gitignore'), '*\n')
  }
  return pool
}

/**
 * Freeze what a candidate changed relative to the baseline snapshot: stage
 * everything (in the candidate's own worktree index), write a commit whose
 * parent is the snapshot, and render a full-index binary patch.
 */
export async function captureChange(worktree: string, base: string, message: string, copy: OwnedCopy): Promise<CapturedChange> {
  const tree = await ownedCopyTree(worktree, copy)
  const commit = (await ownedGit(worktree, copy, ['commit-tree', tree, '-p', base], AUTHOR_ENV, message)).trim()
  const diff = ['diff', '--no-ext-diff', '--no-textconv']
  const patch = await ownedGit(worktree, copy, [...diff, '--binary', '--full-index', '--no-color', base, commit])
  const numstat = await ownedGit(worktree, copy, [...diff, '--numstat', '-z', '--no-renames', base, commit])
  const nameStatusRaw = await ownedGit(worktree, copy, [...diff, '--name-status', '-z', '--no-renames', base, commit])
  const stats = { files: 0, insertions: 0, deletions: 0, binary: 0 }
  for (const rec of numstat.split('\0').filter(Boolean)) {
    const [ins, del] = rec.split('\t')
    stats.files++
    if (ins === '-') stats.binary++
    else {
      stats.insertions += Number(ins)
      stats.deletions += Number(del)
    }
  }
  const parts = nameStatusRaw.split('\0')
  const nameStatus: Array<{ status: string; path: string }> = []
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const status = parts[i]
    const p = parts[i + 1]
    if (status && p) nameStatus.push({ status, path: p })
  }
  const sha256 = createHash('sha256').update(patch).digest('hex')
  return { commit, tree, patch, sha256, stats, touched: nameStatus.map((n) => n.path), nameStatus }
}

export async function changedPaths(repo: string, fromTree: string, toTree: string, paths?: readonly string[]): Promise<string[]> {
  const args = ['diff', '--name-only', '-z', '--no-renames', fromTree, toTree]
  if (paths !== undefined) {
    if (paths.length === 0) return []
    args.push('--', ...paths.map((p) => `:(literal)${p}`))
  }
  return (await git(repo, args)).split('\0').filter(Boolean)
}

export async function writePatch(file: string, patch: string): Promise<string> {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, patch, 'utf8')
  return createHash('sha256').update(patch).digest('hex')
}

export async function readPatchSha(file: string): Promise<string> {
  return createHash('sha256').update(await readFile(file, 'utf8')).digest('hex')
}

import { copyFile, mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { run, runOk } from './proc.ts'

/** Largest patch accepted for one candidate. Bigger changes are refused, never truncated. */
export const MAX_PATCH_CHARS = 32 * 1024 * 1024

export function git(cwd: string, args: readonly string[], env?: NodeJS.ProcessEnv, input?: string): Promise<string> {
  return runOk(['git', ...args], {
    cwd,
    maxOutput: MAX_PATCH_CHARS,
    env: { ...process.env, ...env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    ...(input === undefined ? {} : { input }),
  })
}

export async function gitTry(cwd: string, args: readonly string[]): Promise<string | undefined> {
  const r = await run(['git', ...args], { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' } })
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
  const tmpIndex = path.join(scratchDir, `index-${process.pid}-${Date.now()}`)
  const realIndex = path.resolve(repo, (await git(repo, ['rev-parse', '--git-path', 'index'])).trim())
  const env = { GIT_INDEX_FILE: tmpIndex }
  try {
    if (existsSync(realIndex)) await copyFile(realIndex, tmpIndex)
    else if (await headCommit(repo)) await git(repo, ['read-tree', 'HEAD'], env)
    const pathspec = ['--', '.', ...extraExcludes]
    await git(repo, ['add', '-A', ...pathspec], env)
    return (await git(repo, ['write-tree'], env)).trim()
  } finally {
    await rm(tmpIndex, { force: true })
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

/**
 * Create a detached worktree for `commit` and mark it as owned. The mark lives
 * in `<repo>/.git/worktrees/<name>/`, so it is neither project content nor
 * writable by an agent confined to the copy.
 */
export async function addOwnedWorktree(repo: string, dir: string, commit: string, owner: OwnerMark): Promise<void> {
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

const samePath = (a: string, b: string): boolean =>
  process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b)

/**
 * Delete a copy only when all of this holds: it is a registered worktree of
 * `repo`, it is not the main checkout, and its owner mark matches. Anything
 * else is left in place and reported.
 */
export async function removeOwnedWorktree(repo: string, dir: string, owner: OwnerMark): Promise<{ removed: boolean; reason?: string }> {
  if (!existsSync(dir)) {
    await gitTry(repo, ['worktree', 'prune'])
    return { removed: true }
  }
  if (samePath(dir, repo)) return { removed: false, reason: 'is the main checkout' }
  const registered = await registeredWorktrees(repo)
  if (!registered.some((w) => samePath(w, dir))) return { removed: false, reason: 'not a registered worktree of the repository' }
  let mark: OwnerMark | undefined
  try {
    mark = JSON.parse(await readFile(path.join(await worktreeAdminDir(dir), OWNER_FILE), 'utf8')) as OwnerMark
  } catch {
    mark = undefined
  }
  if (mark?.runId !== owner.runId || mark.label !== owner.label || mark.token !== owner.token) return { removed: false, reason: 'owner mark missing or different' }
  await gitTry(repo, ['worktree', 'remove', '--force', '--force', dir])
  if (existsSync(dir)) await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  await gitTry(repo, ['worktree', 'prune'])
  return { removed: !existsSync(dir) }
}

/**
 * The tree the checkout would have after adoption: `baseTree` (the checkout
 * now) with the candidate's version of every touched path. Built in a private
 * index; nothing in the repository changes.
 */
export async function overlayTree(repo: string, scratchDir: string, baseTree: string, source: string, nameStatus: ReadonlyArray<{ status: string; path: string }>): Promise<string> {
  await mkdir(scratchDir, { recursive: true })
  const env = { GIT_INDEX_FILE: path.join(scratchDir, `overlay-${process.pid}-${Date.now()}`) }
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
    await rm(env.GIT_INDEX_FILE, { force: true })
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
export async function captureChange(worktree: string, base: string, message: string): Promise<CapturedChange> {
  await git(worktree, ['add', '-A', '--', '.', ...ALWAYS_EXCLUDED])
  const tree = (await git(worktree, ['write-tree'])).trim()
  const commit = await commitTree(worktree, tree, [base], message)
  const patch = await git(worktree, ['diff', '--binary', '--full-index', '--no-color', '--no-ext-diff', base, commit])
  const numstat = await git(worktree, ['diff', '--numstat', '-z', '--no-renames', base, commit])
  const nameStatusRaw = await git(worktree, ['diff', '--name-status', '-z', '--no-renames', base, commit])
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

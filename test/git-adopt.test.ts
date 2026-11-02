import { describe, expect, it, beforeEach } from 'vitest'
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { addDetachedWorktree, ALWAYS_EXCLUDED, captureChange, commitTree, ensureWorktreePool, git, headCommit, snapshotTree, treeOf } from '../src/core/git.ts'
import { adoptAsBranch, adoptIntoWorktree, preflight, revertWorktreeAdoption } from '../src/core/adopt.ts'
import type { Baseline } from '../src/core/types.ts'

async function tmp(prefix: string): Promise<string> {
  // A space in the path exercises quoting on every platform.
  return mkdtemp(path.join(os.tmpdir(), `${prefix} `))
}

async function initRepo(): Promise<string> {
  const repo = await tmp('ac-repo')
  await git(repo, ['init', '-q', '-b', 'main'])
  await git(repo, ['config', 'user.email', 't@example.com'])
  await git(repo, ['config', 'user.name', 't'])
  await git(repo, ['config', 'core.autocrlf', 'false'])
  await writeFile(path.join(repo, '.gitignore'), 'node_modules/\ndist/\n')
  await writeFile(path.join(repo, 'a.txt'), 'one\n')
  await writeFile(path.join(repo, 'keep.txt'), 'keep\n')
  await mkdir(path.join(repo, 'src'))
  await writeFile(path.join(repo, 'src', 'old.ts'), 'export const old = 1\n')
  await git(repo, ['add', '-A'])
  await git(repo, ['commit', '-q', '-m', 'init'])
  return repo
}

const sha = async (f: string): Promise<string> => createHash('sha256').update(await readFile(f)).digest('hex')

async function baselineOf(repo: string, scratch: string): Promise<Baseline> {
  const head = await headCommit(repo)
  const tree = await snapshotTree(repo, scratch, ALWAYS_EXCLUDED)
  const snap = await commitTree(repo, tree, [head], 'base')
  return { repoRoot: repo, headCommit: head, snapshotCommit: snap, snapshotTree: tree, dirty: tree !== (await treeOf(repo, head!)) }
}

/** A candidate that edits a.txt, adds a binary file and a nested file, and deletes src/old.ts. */
async function makeCandidate(base: Baseline, scratch: string) {
  const wt = path.join(scratch, 'wt A')
  await addDetachedWorktree(base.repoRoot, wt, base.snapshotCommit)
  await writeFile(path.join(wt, 'a.txt'), 'one\ntwo\n')
  await writeFile(path.join(wt, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 0]))
  await mkdir(path.join(wt, 'src', 'new dir'), { recursive: true })
  await writeFile(path.join(wt, 'src', 'new dir', 'Card.tsx'), 'export const Card = () => null\n')
  await rm(path.join(wt, 'src', 'old.ts'))
  await mkdir(path.join(wt, 'node_modules', 'x'), { recursive: true })
  await writeFile(path.join(wt, 'node_modules', 'x', 'index.js'), 'junk')
  const change = await captureChange(wt, base.snapshotCommit, 'cand')
  return { wt, change }
}

describe('baseline snapshot', () => {
  let repo: string
  let scratch: string
  beforeEach(async () => {
    repo = await initRepo()
    scratch = await tmp('ac-scratch')
  })

  it('includes unstaged, staged and untracked changes without touching the user index or files', async () => {
    await writeFile(path.join(repo, 'a.txt'), 'one\nedited\n')
    await writeFile(path.join(repo, 'staged.txt'), 'staged\n')
    await git(repo, ['add', 'staged.txt'])
    await writeFile(path.join(repo, 'untracked.txt'), 'u\n')
    await mkdir(path.join(repo, 'node_modules'))
    await writeFile(path.join(repo, 'node_modules', 'big.js'), 'ignored')
    const indexFile = path.join(repo, '.git', 'index')
    const before = await sha(indexFile)
    const statusBefore = await git(repo, ['status', '--porcelain'])

    const base = await baselineOf(repo, scratch)

    expect(await sha(indexFile)).toBe(before)
    expect(await git(repo, ['status', '--porcelain'])).toBe(statusBefore)
    expect(base.dirty).toBe(true)
    const files = (await git(repo, ['ls-tree', '-r', '--name-only', base.snapshotTree])).split('\n')
    expect(files).toEqual(expect.arrayContaining(['a.txt', 'staged.txt', 'untracked.txt']))
    expect(files.some((f) => f.startsWith('node_modules'))).toBe(false)
    expect(await git(repo, ['show', `${base.snapshotCommit}:a.txt`])).toBe('one\nedited\n')
  })

  it('reports a clean checkout as not dirty', async () => {
    const base = await baselineOf(repo, scratch)
    expect(base.dirty).toBe(false)
  })
})

describe('candidate capture', () => {
  it('records edits, a binary file, a nested new file and a deletion, never node_modules', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const { change } = await makeCandidate(base, scratch)
    const byPath = Object.fromEntries(change.nameStatus.map((n) => [n.path, n.status]))
    expect(byPath).toEqual({ 'a.txt': 'M', 'logo.png': 'A', 'src/new dir/Card.tsx': 'A', 'src/old.ts': 'D' })
    expect(change.stats.binary).toBe(1)
    expect(change.patch).toContain('GIT binary patch')
    expect(change.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('adoption', () => {
  let repo: string
  let scratch: string
  let base: Baseline
  let cand: Awaited<ReturnType<typeof makeCandidate>>
  beforeEach(async () => {
    repo = await initRepo()
    scratch = await tmp('ac-scratch')
    base = await baselineOf(repo, scratch)
    cand = await makeCandidate(base, scratch)
  })
  const input = () => ({ baseline: base, candidateCommit: cand.change.commit, nameStatus: cand.change.nameStatus, scratchDir: scratch, refPrefix: 'refs/agent-compare/test' })

  it('writes exactly the checked content into a clean checkout, leaving index and HEAD alone', async () => {
    const head = await headCommit(repo)
    const indexBefore = await sha(path.join(repo, '.git', 'index'))
    const res = await adoptIntoWorktree(input())
    expect(res.verifiedPaths).toBe(4)
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\n')
    expect([...(await readFile(path.join(repo, 'logo.png')))]).toEqual([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 0])
    expect(existsSync(path.join(repo, 'src', 'new dir', 'Card.tsx'))).toBe(true)
    expect(existsSync(path.join(repo, 'src', 'old.ts'))).toBe(false)
    expect(await headCommit(repo)).toBe(head)
    expect(await sha(path.join(repo, '.git', 'index'))).toBe(indexBefore)
  })

  it('refuses when the user edited a touched file after the baseline, and writes nothing', async () => {
    await writeFile(path.join(repo, 'a.txt'), 'one\nmine\n')
    const p = await preflight(input())
    expect(p.ok).toBe(false)
    await expect(adoptIntoWorktree(input())).rejects.toThrow(/changed since the baseline: a.txt/)
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\nmine\n')
    expect(existsSync(path.join(repo, 'logo.png'))).toBe(false)
    expect(existsSync(path.join(repo, 'src', 'old.ts'))).toBe(true)
  })

  it('adopts when only untouched files changed after the baseline, and keeps those changes', async () => {
    await writeFile(path.join(repo, 'keep.txt'), 'keep\nlater\n')
    const res = await adoptIntoWorktree(input())
    expect(res.targetChanged).toBe(true)
    expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nlater\n')
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\n')
  })

  it('refuses when an untracked file already sits where the candidate adds one', async () => {
    await writeFile(path.join(repo, 'logo.png'), 'not a png')
    await expect(adoptIntoWorktree(input())).rejects.toThrow(/logo.png/)
    expect(await readFile(path.join(repo, 'logo.png'), 'utf8')).toBe('not a png')
  })

  it('reverts to the pre-adoption content, but not over later user edits', async () => {
    const res = await adoptIntoWorktree(input())
    await revertWorktreeAdoption({ ...input(), preAdoptCommit: res.preAdoptCommit })
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\n')
    expect(existsSync(path.join(repo, 'logo.png'))).toBe(false)
    expect(existsSync(path.join(repo, 'src', 'old.ts'))).toBe(true)
    expect((await git(repo, ['status', '--porcelain'])).trim()).toBe('')

    const again = await adoptIntoWorktree(input())
    await writeFile(path.join(repo, 'a.txt'), 'edited after adopt\n')
    await expect(revertWorktreeAdoption({ ...input(), preAdoptCommit: again.preAdoptCommit })).rejects.toThrow(/edited after adoption/)
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('edited after adopt\n')
  })

  it('branch mode creates a branch without switching or touching the checkout', async () => {
    const head = await headCommit(repo)
    const { branch, commit } = await adoptAsBranch({ ...input(), branch: 'agent-compare/test-A' })
    expect(branch).toBe('agent-compare/test-A')
    expect(await headCommit(repo)).toBe(head)
    expect((await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()).toBe('main')
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\n')
    expect((await git(repo, ['rev-parse', `${commit}^`])).trim()).toBe(head)
    await expect(adoptAsBranch({ ...input(), branch: 'agent-compare/test-A' })).rejects.toThrow(/already exists/)
  })
})

describe('copies inside the repository (.agents/worktrees)', () => {
  it('keeps nested candidate copies out of the baseline snapshot and out of git status, and still captures their changes', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const pool = await ensureWorktreePool(repo)
    const wt = path.join(pool, 'ac-0a1b2c3d-A')
    await addDetachedWorktree(repo, wt, base.snapshotCommit)
    await writeFile(path.join(wt, 'a.txt'), 'one\nfrom candidate\n')
    await mkdir(path.join(wt, 'node_modules', 'x'), { recursive: true })
    await writeFile(path.join(wt, 'node_modules', 'x', 'i.js'), 'junk')

    expect((await git(repo, ['status', '--porcelain'])).trim()).toBe('')
    const after = await snapshotTree(repo, scratch, ALWAYS_EXCLUDED)
    expect(after).toBe(base.snapshotTree)

    const change = await captureChange(wt, base.snapshotCommit, 'cand')
    expect(change.nameStatus).toEqual([{ status: 'M', path: 'a.txt' }])
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\n')
  })

  it('leaves an existing pool (and its ignore rules) untouched', async () => {
    const repo = await initRepo()
    await mkdir(path.join(repo, '.agents', 'worktrees'), { recursive: true })
    await ensureWorktreePool(repo)
    expect(existsSync(path.join(repo, '.agents', 'worktrees', '.gitignore'))).toBe(false)
  })
})

describe('line endings', () => {
  it('lets the repository eol settings decide the bytes written on adoption', async () => {
    const repo = await initRepo()
    await git(repo, ['config', 'core.autocrlf', 'true'])
    await writeFile(path.join(repo, '.gitattributes'), '*.txt text eol=crlf\n')
    await rm(path.join(repo, 'a.txt'))
    await git(repo, ['checkout', '--', 'a.txt'])
    await git(repo, ['add', '-A'])
    await git(repo, ['commit', '-q', '-m', 'attrs'])
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const wt = path.join(scratch, 'wt')
    await addDetachedWorktree(repo, wt, base.snapshotCommit)
    await writeFile(path.join(wt, 'a.txt'), 'one\r\ntwo\r\n')
    const change = await captureChange(wt, base.snapshotCommit, 'c')
    await adoptIntoWorktree({ baseline: base, candidateCommit: change.commit, nameStatus: change.nameStatus, scratchDir: scratch, refPrefix: 'refs/agent-compare/eol' })
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\r\ntwo\r\n')
  })
})

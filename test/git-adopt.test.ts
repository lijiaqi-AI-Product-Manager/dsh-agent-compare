import { describe, expect, it, beforeEach } from 'vitest'
import { readFile, writeFile, mkdir, rm, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { addOwnedWorktree, ALWAYS_EXCLUDED, captureChange, commitTree, ensureWorktreePool, git, headCommit, overlayTree, registeredWorktrees, removeOwnedWorktree, snapshotTree, treeOf } from '../src/core/git.ts'
import { adoptAsBranch, CandidateWriteError, checkWritten, pinPreAdopt, preflight, undoAdoption, writeCandidate, type AdoptInput } from '../src/core/adopt.ts'
import type { Baseline } from '../src/core/types.ts'
import { tmp } from './fixture.ts'

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
const owner = (label: string) => ({ runId: '0a1b2c3d', label, token: `tok-${label}` })

async function baselineOf(repo: string, scratch: string): Promise<Baseline> {
  const head = await headCommit(repo)
  const tree = await snapshotTree(repo, scratch, ALWAYS_EXCLUDED)
  const snap = await commitTree(repo, tree, [head], 'base')
  return { repoRoot: repo, headCommit: head, snapshotCommit: snap, snapshotTree: tree, dirty: tree !== (await treeOf(repo, head!)) }
}

/** A candidate that edits a.txt, adds a binary file and a nested file, and deletes src/old.ts. */
async function makeCandidate(base: Baseline, scratch: string) {
  const wt = path.join(scratch, 'wt A')
  await addOwnedWorktree(base.repoRoot, wt, base.snapshotCommit, owner('A'))
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

/** The worktree-adoption core without the orchestrator: preflight, pin, write, verify. */
async function adoptDirect(input: AdoptInput) {
  const pf = await preflight(input)
  if (!pf.ok) throw new Error(`overlap: ${pf.overlapping.join(', ')}`)
  const pre = await pinPreAdopt(input.baseline.repoRoot, pf.target)
  await writeCandidate(input.baseline.repoRoot, input.candidateCommit, input.nameStatus, { expected: pf.target, scratchDir: input.scratchDir })
  const chk = await checkWritten(input.baseline.repoRoot, input.scratchDir, { expectedTree: pf.expectedTree, candidateCommit: input.candidateCommit, touched: input.nameStatus.map((n) => n.path), before: pf.target })
  return { pre, pf, chk }
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

describe('adoption primitives', () => {
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
  const input = (): AdoptInput => ({ baseline: base, candidateCommit: cand.change.commit, nameStatus: cand.change.nameStatus, scratchDir: scratch })

  it('writes exactly the checked content into a clean checkout, leaving index and HEAD alone', async () => {
    const head = await headCommit(repo)
    const indexBefore = await sha(path.join(repo, '.git', 'index'))
    const { pf, chk } = await adoptDirect(input())
    expect(pf.ok && pf.expectedTree).toBe(cand.change.tree)
    expect(chk).toEqual({ mismatched: [], concurrent: [], headChanged: false, stagedChanged: false })
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\ntwo\n')
    expect([...(await readFile(path.join(repo, 'logo.png')))]).toEqual([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 0])
    expect(existsSync(path.join(repo, 'src', 'new dir', 'Card.tsx'))).toBe(true)
    expect(existsSync(path.join(repo, 'src', 'old.ts'))).toBe(false)
    expect(await headCommit(repo)).toBe(head)
    expect(await sha(path.join(repo, '.git', 'index'))).toBe(indexBefore)
  })

  it('refuses when the user edited a touched file after the baseline', async () => {
    await writeFile(path.join(repo, 'a.txt'), 'one\nmine\n')
    const p = await preflight(input())
    expect(p.ok === false && p.overlapping).toEqual(['a.txt'])
  })

  it('refuses when an untracked file already sits where the candidate adds one', async () => {
    await writeFile(path.join(repo, 'logo.png'), 'not a png')
    const p = await preflight(input())
    expect(p.ok === false && p.overlapping).toEqual(['logo.png'])
  })

  it('computes the combined tree when only untouched files changed, and the write lands on it exactly', async () => {
    await writeFile(path.join(repo, 'keep.txt'), 'keep\nlater\n')
    const { pf, chk } = await adoptDirect(input())
    expect(pf.ok && pf.targetChanged).toBe(true)
    expect(pf.ok && pf.expectedTree).not.toBe(cand.change.tree)
    expect(chk.concurrent).toEqual([])
    expect(await readFile(path.join(repo, 'keep.txt'), 'utf8')).toBe('keep\nlater\n')
    expect(await snapshotTree(repo, scratch, ALWAYS_EXCLUDED)).toBe(pf.ok ? pf.expectedTree : '')
  })

  it('overlayTree equals the candidate tree on a clean target', async () => {
    const t = await overlayTree(repo, scratch, base.snapshotTree, cand.change.commit, cand.change.nameStatus)
    expect(t).toBe(cand.change.tree)
  })

  it('reports files changed by someone else during the write', async () => {
    const pf = await preflight(input())
    if (!pf.ok) throw new Error('unexpected overlap')
    await writeCandidate(repo, cand.change.commit, cand.change.nameStatus, { expected: pf.target, scratchDir: scratch })
    await writeFile(path.join(repo, 'keep.txt'), 'edited meanwhile\n')
    const chk = await checkWritten(repo, scratch, { expectedTree: pf.expectedTree, candidateCommit: cand.change.commit, touched: cand.change.nameStatus.map((n) => n.path), before: pf.target })
    expect(chk.mismatched).toEqual([])
    expect(chk.concurrent).toEqual(['keep.txt'])
  })

  it.each(['HEAD', 'index'] as const)('refuses a write when %s changes after preflight', async (location) => {
    const pf = await preflight(input())
    if (!pf.ok) throw new Error('unexpected overlap')
    let staged: string | undefined
    let head: string | undefined
    const operation = writeCandidate(repo, cand.change.commit, cand.change.nameStatus, {
      expected: pf.target,
      scratchDir: scratch,
      beforeWrite: async () => {
        if (location === 'HEAD') await git(repo, ['commit', '--allow-empty', '-q', '-m', 'other work'])
        else {
          await writeFile(path.join(repo, 'keep.txt'), 'staged separately\n')
          await git(repo, ['add', 'keep.txt'])
          await writeFile(path.join(repo, 'keep.txt'), 'keep\n')
        }
        staged = await git(repo, ['ls-files', '-s', '-z'])
        head = await headCommit(repo)
      },
    })
    await expect(operation).rejects.toMatchObject({ attemptedPaths: [], changedLocations: [location] })
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\n')
    expect(await git(repo, ['ls-files', '-s', '-z'])).toBe(staged)
    expect(await headCommit(repo)).toBe(head)
  })

  it.each(['a.txt', 'src/old.ts'])('preserves a later edit before replacing or deleting %s', async (editedPath) => {
    const pf = await preflight(input())
    if (!pf.ok) throw new Error('unexpected overlap')
    let failure: CandidateWriteError | undefined
    try {
      await writeCandidate(repo, cand.change.commit, cand.change.nameStatus, {
        expected: pf.target,
        scratchDir: scratch,
        beforeWrite: async (paths) => {
          if (paths.at(-1) === editedPath) await writeFile(path.join(repo, editedPath), 'new user edit\n')
        },
      })
    } catch (error) {
      if (!(error instanceof CandidateWriteError)) throw error
      failure = error
    }
    expect(failure?.changedLocations).toContain(editedPath)
    expect(failure?.attemptedPaths).not.toContain(editedPath)
    const undo = await undoAdoption(repo, scratch, { preAdoptCommit: await pinPreAdopt(repo, pf.target), candidateCommit: cand.change.commit, touched: failure!.attemptedPaths })
    expect(undo.conflicts).toEqual([])
    expect(await readFile(path.join(repo, editedPath), 'utf8')).toBe('new user edit\n')
  })

  it('preserves an ignored, untracked file that appears at an addition path', async () => {
    await writeFile(path.join(repo, '.git', 'info', 'exclude'), 'logo.png\n')
    const pf = await preflight(input())
    if (!pf.ok) throw new Error('unexpected overlap')
    const mine = Buffer.from([0, 1, 4, 9])
    let failure: CandidateWriteError | undefined
    try {
      await writeCandidate(repo, cand.change.commit, cand.change.nameStatus, {
        expected: pf.target,
        scratchDir: scratch,
        beforeWrite: async (paths) => {
          if (paths.at(-1) === 'logo.png') await writeFile(path.join(repo, 'logo.png'), mine)
        },
      })
    } catch (error) {
      if (!(error instanceof CandidateWriteError)) throw error
      failure = error
    }
    expect(failure?.changedLocations).toEqual(['logo.png'])
    expect(failure?.attemptedPaths).not.toContain('logo.png')
    expect(await readFile(path.join(repo, 'logo.png'))).toEqual(mine)
  })

  it('undo restores what we wrote and leaves later edits alone, listing them', async () => {
    const { pre } = await adoptDirect(input())
    await writeFile(path.join(repo, 'a.txt'), 'edited after adopt\n')
    const touched = cand.change.nameStatus.map((n) => n.path)
    const undo = await undoAdoption(repo, scratch, { preAdoptCommit: pre, candidateCommit: cand.change.commit, touched })
    expect(undo.conflicts).toEqual(['a.txt'])
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('edited after adopt\n')
    expect(existsSync(path.join(repo, 'logo.png'))).toBe(false)
    expect(existsSync(path.join(repo, 'src', 'old.ts'))).toBe(true)
  })

  it('undo of a half-written adoption restores the written paths and accepts the untouched ones', async () => {
    const pf = await preflight(input())
    if (!pf.ok) throw new Error('unexpected overlap')
    const pre = await pinPreAdopt(repo, pf.target)
    // Only the first path was written before the "crash".
    await writeCandidate(repo, cand.change.commit, cand.change.nameStatus.slice(0, 1), { expected: pf.target, scratchDir: scratch })
    const undo = await undoAdoption(repo, scratch, { preAdoptCommit: pre, candidateCommit: cand.change.commit, touched: cand.change.nameStatus.map((n) => n.path) })
    expect(undo.conflicts).toEqual([])
    expect((await git(repo, ['status', '--porcelain'])).trim()).toBe('')
  })

  it('branch mode creates a branch without switching or touching the checkout', async () => {
    const head = await headCommit(repo)
    const { branch, commit } = await adoptAsBranch({ ...input(), branch: 'agent-compare/test-A' })
    expect(branch).toBe('agent-compare/test-A')
    expect(await headCommit(repo)).toBe(head)
    expect((await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()).toBe('main')
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\n')
    expect((await git(repo, ['rev-parse', `${commit}^`])).trim()).toBe(head)
    await expect(adoptAsBranch({ ...input(), branch: 'agent-compare/test-A' })).rejects.toThrow(/已存在/)
  })
})

describe('owned copies', () => {
  it('removes a copy only with a matching owner mark, never an unregistered directory or the main checkout', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const wt = path.join(scratch, 'copy A')
    await addOwnedWorktree(repo, wt, base.snapshotCommit, owner('A'))
    expect((await registeredWorktrees(repo)).length).toBe(2)

    expect(await removeOwnedWorktree(repo, wt, { ...owner('A'), token: 'wrong' })).toMatchObject({ removed: false })
    expect(existsSync(wt)).toBe(true)
    expect(await removeOwnedWorktree(repo, repo, owner('A'))).toMatchObject({ removed: false })
    const stray = path.join(scratch, 'stray')
    await mkdir(stray)
    await writeFile(path.join(stray, 'x'), 'mine')
    expect(await removeOwnedWorktree(repo, stray, owner('A'))).toMatchObject({ removed: false, reason: expect.stringMatching(/not a registered worktree/) })
    expect(existsSync(path.join(stray, 'x'))).toBe(true)

    expect(await removeOwnedWorktree(repo, wt, owner('A'))).toEqual({ removed: true })
    expect(existsSync(wt)).toBe(false)
  })

  it('recognises its copy through another spelling of the same path (junction, symlink, 8.3 name)', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const real = path.join(scratch, 'real')
    await mkdir(real)
    const wt = path.join(real, 'copy A')
    await addOwnedWorktree(repo, wt, base.snapshotCommit, owner('A'))
    const alias = path.join(scratch, 'alias')
    await symlink(real, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(await removeOwnedWorktree(repo, path.join(alias, 'copy A'), owner('A'))).toEqual({ removed: true })
    expect(existsSync(wt)).toBe(false)
  })

  it('refuses to create a copy over an existing path', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    await expect(addOwnedWorktree(repo, scratch, base.snapshotCommit, owner('A'))).rejects.toThrow(/existing path/)
  })
})

describe('copies inside the repository (shared-root .agents/worktrees)', () => {
  it('keeps nested candidate copies out of the baseline snapshot and out of git status, and still captures their changes', async () => {
    const repo = await initRepo()
    const scratch = await tmp('ac-scratch')
    const base = await baselineOf(repo, scratch)
    const pool = await ensureWorktreePool(repo)
    const wt = path.join(pool, 'ac-0a1b2c3d-A')
    await addOwnedWorktree(repo, wt, base.snapshotCommit, owner('A'))
    await writeFile(path.join(wt, 'a.txt'), 'one\nfrom candidate\n')
    await mkdir(path.join(wt, 'node_modules', 'x'), { recursive: true })
    await writeFile(path.join(wt, 'node_modules', 'x', 'i.js'), 'junk')

    expect((await git(repo, ['status', '--porcelain'])).trim()).toBe('')
    expect(await snapshotTree(repo, scratch, ALWAYS_EXCLUDED)).toBe(base.snapshotTree)

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
    await addOwnedWorktree(repo, wt, base.snapshotCommit, owner('A'))
    await writeFile(path.join(wt, 'a.txt'), 'one\r\ntwo\r\n')
    const change = await captureChange(wt, base.snapshotCommit, 'c')
    const { chk } = await adoptDirect({ baseline: base, candidateCommit: change.commit, nameStatus: change.nameStatus, scratchDir: scratch })
    expect(chk.mismatched).toEqual([])
    expect(await readFile(path.join(repo, 'a.txt'), 'utf8')).toBe('one\r\ntwo\r\n')
  })
})

import { existsSync } from 'node:fs'
import { lstat, rm } from 'node:fs/promises'
import path from 'node:path'
import { changedPaths, commitTree, git, gitTry, headCommit, overlayTree, snapshotTree, stagedFingerprint, treeOf, ALWAYS_EXCLUDED } from './git.ts'
import type { Baseline } from './types.ts'

export interface NameStatus {
  readonly status: string
  readonly path: string
}

export interface AdoptInput {
  readonly baseline: Baseline
  readonly candidateCommit: string
  readonly nameStatus: readonly NameStatus[]
  readonly scratchDir: string
}

/** The checkout as it is right now: files, HEAD, and what is staged. */
export interface TargetState {
  readonly tree: string
  readonly head: string | undefined
  readonly staged: string
}

export async function targetState(repo: string, scratchDir: string): Promise<TargetState> {
  return {
    tree: await snapshotTree(repo, scratchDir, ALWAYS_EXCLUDED),
    head: await headCommit(repo),
    staged: await stagedFingerprint(repo),
  }
}

/** Locations that changed since a target was checked, including Git state. */
export async function targetChanges(repo: string, scratchDir: string, expected: TargetState): Promise<string[]> {
  const now = await targetState(repo, scratchDir)
  return [
    ...(now.tree === expected.tree ? [] : await changedPaths(repo, expected.tree, now.tree)),
    ...(now.head === expected.head ? [] : ['HEAD']),
    ...(now.staged === expected.staged ? [] : ['index']),
  ]
}

export type Preflight =
  | { readonly ok: true; readonly targetChanged: boolean; readonly target: TargetState; readonly expectedTree: string }
  | { readonly ok: false; readonly reason: 'overlap'; readonly overlapping: string[]; readonly target: TargetState }

/**
 * Decide whether the candidate can land without touching anything the user
 * changed after the baseline, and compute the exact tree the checkout will
 * have afterwards: the checkout now, with the candidate's touched paths.
 */
export async function preflight(input: AdoptInput): Promise<Preflight> {
  const repo = input.baseline.repoRoot
  const target = await targetState(repo, input.scratchDir)
  const touched = input.nameStatus.map((n) => n.path)
  if (target.tree !== input.baseline.snapshotTree) {
    const overlapping = await changedPaths(repo, input.baseline.snapshotTree, target.tree, touched)
    if (overlapping.length > 0) return { ok: false, reason: 'overlap', overlapping, target }
  }
  const expectedTree = target.tree === input.baseline.snapshotTree
    ? await treeOf(repo, input.candidateCommit)
    : await overlayTree(repo, input.scratchDir, target.tree, input.candidateCommit, input.nameStatus)
  return { ok: true, targetChanged: target.tree !== input.baseline.snapshotTree, target, expectedTree }
}

/** Pin the checkout's current files as a commit, the restore point for every later undo. */
export async function pinPreAdopt(repo: string, target: TargetState): Promise<string> {
  return commitTree(repo, target.tree, [target.head], 'agent-compare: pre-adopt snapshot')
}

/**
 * Write the candidate's version of every touched path into the working tree,
 * checking the expected checkout again before every write or deletion.
 * Index and HEAD stay as they are; nothing is committed. `git restore
 * --worktree` is used instead of `git apply` so the repository's own eol and
 * filter settings decide the bytes on disk.
 */
export async function writeCandidate(repo: string, candidateCommit: string, nameStatus: readonly NameStatus[], guard: {
  readonly expected: TargetState
  readonly scratchDir: string
  /** Persist the next write's intent before checking its preconditions. */
  readonly beforeWrite?: (paths: readonly string[]) => Promise<void>
}): Promise<string[]> {
  const attempted: string[] = []
  let expected = guard.expected
  const operations = [...nameStatus.filter((n) => n.status !== 'D'), ...nameStatus.filter((n) => n.status === 'D')]
  try {
    for (const operation of operations) {
      const nextTree = await overlayTree(repo, guard.scratchDir, expected.tree, candidateCommit, [operation])
      await guard.beforeWrite?.([...attempted, operation.path])
      const changed = await targetChanges(repo, guard.scratchDir, expected)
      if (changed.length > 0) throw new CandidateWriteError('采用期间项目发生了变化', attempted, changed)
      // Ignored, untracked files are absent from snapshots but still belong to the user.
      if (await gitTry(repo, ['cat-file', '-e', `${expected.tree}:${operation.path}`]) === undefined) {
        const present = await lstat(path.join(repo, operation.path)).then(() => true, (error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return false
          throw error
        })
        if (present) throw new CandidateWriteError('待写入的位置出现了新文件', attempted, [operation.path])
      }
      attempted.push(operation.path)
      if (operation.status === 'D') await rm(path.join(repo, operation.path), { force: true })
      else await git(repo, ['restore', `--source=${candidateCommit}`, '--worktree', '--', literal(operation.path)])
      expected = { ...expected, tree: nextTree }
    }
    return attempted
  } catch (error) {
    if (error instanceof CandidateWriteError) throw error
    throw new CandidateWriteError((error as Error).message, attempted)
  }
}

/** Only these paths may have been written; later paths must never be rolled back. */
export class CandidateWriteError extends Error {
  readonly attemptedPaths: string[]
  constructor(message: string, attemptedPaths: readonly string[], readonly changedLocations?: readonly string[]) {
    super(message)
    this.name = 'CandidateWriteError'
    this.attemptedPaths = [...attemptedPaths]
  }
}

export interface WriteCheck {
  /** Touched paths whose content is not the candidate's. */
  readonly mismatched: string[]
  /** Other paths that differ from the expected tree (changed by someone during the write). */
  readonly concurrent: string[]
  readonly headChanged: boolean
  readonly stagedChanged: boolean
}

/** Compare the checkout after the write with the rehearsed tree. */
export async function checkWritten(repo: string, scratchDir: string, input: { expectedTree: string; candidateCommit: string; touched: readonly string[]; before: TargetState }): Promise<WriteCheck> {
  const now = await targetState(repo, scratchDir)
  const candidateTree = await treeOf(repo, input.candidateCommit)
  const mismatched = await changedPaths(repo, candidateTree, now.tree, input.touched)
  const touched = new Set(input.touched)
  const concurrent = now.tree === input.expectedTree ? [] : (await changedPaths(repo, input.expectedTree, now.tree)).filter((p) => !touched.has(p))
  return { mismatched, concurrent, headChanged: now.head !== input.before.head, stagedChanged: now.staged !== input.before.staged }
}

/** Put touched paths back to how they were in `snapshot` (removing ones it did not contain). */
export async function restorePaths(repo: string, snapshot: string, paths: readonly string[]): Promise<void> {
  const present: string[] = []
  for (const p of paths) {
    const inSnapshot = await gitTry(repo, ['cat-file', '-e', `${snapshot}:${p}`])
    if (inSnapshot !== undefined) present.push(p)
    else if (existsSync(path.join(repo, p))) await rm(path.join(repo, p), { force: true })
  }
  for (const chunk of chunks(present, 100)) {
    await git(repo, ['restore', `--source=${snapshot}`, '--worktree', '--', ...chunk.map(literal)])
  }
}

/**
 * Undo an adoption, path by path. A path is restored only when its content
 * is still either the candidate's (we wrote it) or already the pre-adopt
 * content; anything else was edited by someone since and is left untouched
 * and reported. Works for a finished adoption and for an interrupted one.
 */
export async function undoAdoption(repo: string, scratchDir: string, input: { preAdoptCommit: string; candidateCommit: string; touched: readonly string[] }): Promise<{ restored: string[]; conflicts: string[] }> {
  const now = await snapshotTree(repo, scratchDir, ALWAYS_EXCLUDED)
  const candidateTree = await treeOf(repo, input.candidateCommit)
  const preTree = await treeOf(repo, input.preAdoptCommit)
  const notCandidate = new Set(await changedPaths(repo, candidateTree, now, input.touched))
  const notPre = new Set(await changedPaths(repo, preTree, now, input.touched))
  const conflicts = input.touched.filter((p) => notCandidate.has(p) && notPre.has(p))
  const restore = input.touched.filter((p) => notPre.has(p) && !notCandidate.has(p))
  await restorePaths(repo, input.preAdoptCommit, restore)
  const after = await snapshotTree(repo, scratchDir, ALWAYS_EXCLUDED)
  const stillWrong = await changedPaths(repo, preTree, after, restore)
  return { restored: restore.filter((p) => !stillWrong.includes(p)), conflicts: [...conflicts, ...stillWrong] }
}

/**
 * Create a branch holding the candidate on top of the baseline HEAD without
 * switching the checkout. When the baseline was dirty, the user's uncommitted
 * changes are part of that commit, and the message says so.
 */
export async function adoptAsBranch(input: AdoptInput & { readonly branch: string; readonly note?: string }): Promise<{ branch: string; commit: string }> {
  const repo = input.baseline.repoRoot
  await git(repo, ['check-ref-format', '--branch', input.branch])
  if (await gitTry(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${input.branch}`])) {
    throw new AdoptError('exists', `分支 ${input.branch} 已存在`)
  }
  const tree = await treeOf(repo, input.candidateCommit)
  const dirty = input.baseline.dirty ? '\n\nIncludes the uncommitted changes that were present when the comparison started.' : ''
  const commit = await commitTree(repo, tree, [input.baseline.headCommit], `agent-compare: candidate${input.note ? ` (${input.note})` : ''}${dirty}`)
  await git(repo, ['branch', input.branch, commit])
  return { branch: input.branch, commit }
}

export class AdoptError extends Error {
  constructor(readonly code: 'overlap' | 'verify' | 'exists' | 'integrity' | 'state' | 'ineligible', message: string) {
    super(message)
    this.name = 'AdoptError'
  }
}

function literal(p: string): string {
  return `:(literal)${p}`
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

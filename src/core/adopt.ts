import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { changedPaths, commitTree, git, gitTry, pinRef, snapshotTree, treeOf, ALWAYS_EXCLUDED } from './git.ts'
import type { Baseline } from './types.ts'

export interface AdoptInput {
  readonly baseline: Baseline
  readonly candidateCommit: string
  readonly nameStatus: ReadonlyArray<{ status: string; path: string }>
  readonly scratchDir: string
  readonly refPrefix: string
}

export type Preflight =
  | { readonly ok: true; readonly targetChanged: boolean; readonly currentTree: string }
  | { readonly ok: false; readonly reason: 'overlap'; readonly overlapping: string[]; readonly currentTree: string }

/**
 * Decide whether the candidate can land in the target checkout without
 * touching anything the user changed after the baseline was taken. The
 * candidate is only ever compared on the paths it touched.
 */
export async function preflight(input: AdoptInput): Promise<Preflight> {
  const repo = input.baseline.repoRoot
  const currentTree = await snapshotTree(repo, input.scratchDir, ALWAYS_EXCLUDED)
  if (currentTree === input.baseline.snapshotTree) return { ok: true, targetChanged: false, currentTree }
  const touched = input.nameStatus.map((n) => n.path)
  const overlapping = await changedPaths(repo, input.baseline.snapshotTree, currentTree, touched)
  if (overlapping.length > 0) return { ok: false, reason: 'overlap', overlapping, currentTree }
  return { ok: true, targetChanged: true, currentTree }
}

export interface WorktreeAdoptResult {
  readonly preAdoptCommit: string
  readonly verifiedPaths: number
  readonly targetChanged: boolean
}

/**
 * Write the candidate's version of every touched path into the user's working
 * tree. Index and HEAD stay as they are; nothing is committed. `git restore
 * --worktree` is used instead of `git apply` so the repository's own eol and
 * filter settings decide the bytes on disk.
 *
 * On any failure the touched paths are restored from a snapshot taken just
 * before the first write, so a partial adoption never remains.
 */
export async function adoptIntoWorktree(input: AdoptInput): Promise<WorktreeAdoptResult> {
  const repo = input.baseline.repoRoot
  const check = await preflight(input)
  if (!check.ok) throw new AdoptError('overlap', `files changed since the baseline: ${check.overlapping.slice(0, 10).join(', ')}`)
  const preAdoptCommit = await commitTree(repo, check.currentTree, [input.baseline.headCommit], 'agent-compare: pre-adopt snapshot')
  await pinRef(repo, `${input.refPrefix}/pre-adopt`, preAdoptCommit)

  const writes = input.nameStatus.filter((n) => n.status !== 'D').map((n) => n.path)
  const deletes = input.nameStatus.filter((n) => n.status === 'D').map((n) => n.path)
  try {
    for (const chunk of chunks(writes, 100)) {
      await git(repo, ['restore', `--source=${input.candidateCommit}`, '--worktree', '--', ...chunk.map(literal)])
    }
    for (const p of deletes) await rm(path.join(repo, p), { force: true })
    const after = await snapshotTree(repo, input.scratchDir, ALWAYS_EXCLUDED)
    const candidateTree = await treeOf(repo, input.candidateCommit)
    const mismatched = await changedPaths(repo, candidateTree, after, input.nameStatus.map((n) => n.path))
    if (mismatched.length > 0) throw new AdoptError('verify', `adopted content differs from the checked candidate: ${mismatched.slice(0, 10).join(', ')}`)
    return { preAdoptCommit, verifiedPaths: input.nameStatus.length, targetChanged: check.targetChanged }
  } catch (error) {
    await restorePaths(repo, preAdoptCommit, input.nameStatus.map((n) => n.path))
    throw error
  }
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

/** Revert a worktree adoption, but only on paths the user has not edited since. */
export async function revertWorktreeAdoption(input: AdoptInput & { readonly preAdoptCommit: string }): Promise<void> {
  const repo = input.baseline.repoRoot
  const current = await snapshotTree(repo, input.scratchDir, ALWAYS_EXCLUDED)
  const candidateTree = await treeOf(repo, input.candidateCommit)
  const paths = input.nameStatus.map((n) => n.path)
  const editedSince = await changedPaths(repo, candidateTree, current, paths)
  if (editedSince.length > 0) throw new AdoptError('overlap', `edited after adoption, not reverting: ${editedSince.slice(0, 10).join(', ')}`)
  await restorePaths(repo, input.preAdoptCommit, paths)
}

/**
 * Create a branch holding the candidate on top of the baseline HEAD without
 * switching the checkout. When the baseline was dirty, the user's uncommitted
 * changes are part of that commit, and the message says so.
 */
export async function adoptAsBranch(input: AdoptInput & { readonly branch: string }): Promise<{ branch: string; commit: string }> {
  const repo = input.baseline.repoRoot
  await git(repo, ['check-ref-format', '--branch', input.branch])
  if (await gitTry(repo, ['rev-parse', '--verify', '--quiet', `refs/heads/${input.branch}`])) {
    throw new AdoptError('exists', `branch ${input.branch} already exists`)
  }
  const tree = await treeOf(repo, input.candidateCommit)
  const note = input.baseline.dirty ? '\n\nIncludes the uncommitted changes that were present when the comparison started.' : ''
  const commit = await commitTree(repo, tree, [input.baseline.headCommit], `agent-compare: adopt candidate${note}`)
  await git(repo, ['branch', input.branch, commit])
  return { branch: input.branch, commit }
}

export class AdoptError extends Error {
  constructor(readonly code: 'overlap' | 'verify' | 'exists' | 'integrity' | 'state', message: string) {
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

import { describe, expect, it } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { commitTree, git, snapshotTree } from '../src/core/git.ts'
import { finishFileTransfer, newFileTransferRef, prepareFileTransfer, publishTransferEntry } from '../src/core/file-transfer.ts'
import { fixtureRecord } from './record-fixture.ts'
import { fixtureRepo, tmp } from './fixture.ts'

async function legacyAdoption() {
  const repo = await fixtureRepo(), store = new RunStore(await tmp('ac-legacy-adoption'))
  const head = (await git(repo, ['rev-parse', 'HEAD'])).trim()
  const index = await git(repo, ['ls-files', '-s', '-z'])
  const base = await snapshotTree(repo, store.artifacts('0a1b2c3d'))
  await writeFile(path.join(repo, 'index.html'), '<h1>chosen result</h1>\n')
  const tree = await snapshotTree(repo, store.artifacts('0a1b2c3d'))
  const candidate = await commitTree(repo, tree, [head], 'candidate')
  const record = { ...fixtureRecord(), baseline: { repoRoot: repo, headCommit: head, snapshotCommit: head, snapshotTree: base, dirty: false } }
  record.state = 'adopted'; record.choice = { pick: 'A', at: Date.now() }
  record.candidates[0]!.candidateCommit = candidate
  record.adoption = { label: 'A', mode: 'worktree', state: 'adopted', startedAt: Date.now(), preAdoptCommit: head, expectedTree: tree, writtenPaths: ['index.html'] }
  await store.save(record)
  const comparer = new Comparer({ store, version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('Recovery must not generate another result') } } })
  return { repo, store, record, comparer, head, index, base }
}

describe('protected recovery of existing adoption records', () => {
  it('uses a persisted inverse transfer when undoing an older adopted result', async () => {
    const f = await legacyAdoption()
    try {
      const result = await f.comparer.revert(f.record.runId)
      expect(result.adoption).toMatchObject({ state: 'reverted', transferDirection: 'undo', transferReturn: 'adopted' })
      expect(result.adoption!.fileTransfer).toBeDefined()
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      expect((await f.store.load(f.record.runId))?.adoption?.fileTransfer).toEqual(result.adoption!.fileTransfer)
      expect((await git(f.repo, ['rev-parse', 'HEAD'])).trim()).toBe(f.head)
      expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.index)
    } finally { await f.comparer.dispose() }
  })

  it('persists a protected inverse before recovering an older interrupted adoption', async () => {
    const f = await legacyAdoption()
    f.record.state = 'recovery'; f.record.adoption!.state = 'needs-recovery'
    await f.store.save(f.record)
    try {
      const result = await f.comparer.recoverAdoption(f.record.runId, 'restore')
      expect(result.state).toBe('revealed')
      expect(result.adoption).toMatchObject({ state: 'rolled-back', transferDirection: 'undo', transferReturn: 'recovery' })
      expect(result.adoption!.fileTransfer).toBeDefined()
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
    } finally { await f.comparer.dispose() }
  })

  it.each(['adopted', 'recovery'] as const)('returns an interrupted legacy inverse to its actual %s starting state', async transferReturn => {
    const f = await legacyAdoption(), ref = newFileTransferRef()
    const inverse = await prepareFileTransfer(f.repo, f.base, [{ path: 'index.html', status: 'M' }], ref)
    await publishTransferEntry(inverse, 0); await finishFileTransfer(inverse)
    f.record.state = 'adopting'
    Object.assign(f.record.adoption!, { state: 'reverting', fileTransfer: ref, transferDirection: 'undo', transferReturn })
    await f.store.save(f.record)
    try {
      expect(await f.comparer.recover()).toContain(f.record.runId)
      expect((await f.store.load(f.record.runId))!.state).toBe('recovery')
      const result = await f.comparer.recoverAdoption(f.record.runId, 'restore')
      expect(result.state).toBe(transferReturn)
      expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>chosen result</h1>\n')
      if (transferReturn === 'recovery') {
        expect(result.adoption!.fileTransfer).toBeUndefined()
        expect(result.adoption!.retainedTransfers).toEqual([ref])
        const retried = await f.comparer.recoverAdoption(f.record.runId, 'restore')
        expect(retried.state).toBe('revealed')
        expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      } else {
        const retried = await f.comparer.revert(f.record.runId)
        expect(retried.adoption!.state).toBe('reverted')
        expect(retried.adoption!.retainedTransfers).toEqual([ref])
        expect(await readFile(path.join(f.repo, 'index.html'), 'utf8')).toBe('<h1>shop</h1>\n')
      }
      expect((await git(f.repo, ['rev-parse', 'HEAD'])).trim()).toBe(f.head)
      expect(await git(f.repo, ['ls-files', '-s', '-z'])).toBe(f.index)
    } finally { await f.comparer.dispose() }
  })
})

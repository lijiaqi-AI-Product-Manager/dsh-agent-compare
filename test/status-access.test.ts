import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { Comparer } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { brief } from '../src/host/index.ts'
import { readComparisonStatus } from '../src/host/status.ts'
import { fixtureRecord } from './record-fixture.ts'
import { tmp } from './fixture.ts'

async function fixture() {
  const store = new RunStore(await tmp('ac-status-access')), record = fixtureRecord()
  record.state = 'running'; record.candidates.forEach(c => { c.stage = 'generating' })
  await store.save(record)
  const run = vi.fn(async () => { throw new Error('status must not generate') })
  const comparer = new Comparer({ store, runner: { isolation: 'own-root', run }, version: 'test' })
  return { store, record, comparer, run }
}
describe('status authority', () => {
  it('rejects delegated and absent callers before an orphan can be reconciled', async () => {
    const { store, record, comparer, run } = await fixture()
    try {
      const bytes = await readFile(store.file(record.runId), 'utf8')
      const delegated = { session: { id: 'candidate-session', header: { origin: 'subagent' } } }
      expect(await readComparisonStatus(comparer, delegated, record.runId)).toHaveProperty('error')
      expect(await readComparisonStatus(comparer, undefined, record.runId)).toHaveProperty('error')
      expect(await readFile(store.file(record.runId), 'utf8')).toBe(bytes)
      expect(run).not.toHaveBeenCalled()
    } finally { await comparer.dispose() }
  })
  it('reconciles the main conversation latest orphan and reports available control', async () => {
    const { record, comparer, run } = await fixture()
    try {
      const result = await readComparisonStatus(comparer, { session: { id: record.sessionId!, header: {} } })
      expect(result).toMatchObject({ record: { runId: record.runId, state: 'interrupted' }, control: { allowed: true } })
      expect(run).not.toHaveBeenCalled()
    } finally { await comparer.dispose() }
  })
  it('does not reconcile after a caller has already stopped', async () => {
    const { store, record, comparer } = await fixture(), signal = new AbortController()
    signal.abort(new Error('stopped before status'))
    try {
      const bytes = await readFile(store.file(record.runId), 'utf8')
      await expect(readComparisonStatus(comparer, { session: { id: record.sessionId!, header: {} } }, record.runId, signal.signal)).rejects.toThrow('stopped before status')
      expect(await readFile(store.file(record.runId), 'utf8')).toBe(bytes)
    } finally { await comparer.dispose() }
  })
  it('produces lossless JSON in brief() without undefined values across running, judging, revealed and adopted records', async () => {
    const assertLosslessJson = (value: unknown, path = 'root'): void => {
      expect(value, path).not.toBeUndefined()
      if (Array.isArray(value)) {
        value.forEach((item, index) => assertLosslessJson(item, `${path}[${index}]`))
      } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          assertLosslessJson(child, `${path}.${key}`)
        }
      }
      expect(value).toEqual(JSON.parse(JSON.stringify(value)))
    }

    const { record, comparer } = await fixture()
    try {
      const runningStatus = await readComparisonStatus(comparer, { session: { id: record.sessionId!, header: {} } }, record.runId)
      if ('error' in runningStatus) throw new Error(runningStatus.error)
      const runningPayload = { ...brief(runningStatus.record), control: runningStatus.control }
      assertLosslessJson(runningPayload)
      expect(runningPayload.candidates[0]).not.toHaveProperty('previewUrl')
      expect(runningPayload.candidates[0].error).toBeTypeOf('string')
      expect(runningPayload).not.toHaveProperty('choice')
      expect(runningPayload).not.toHaveProperty('adoption')

      const judging = fixtureRecord('11223344')
      delete judging.candidates[0]!.checks
      delete judging.candidates[0]!.verdict
      const judgingBrief = brief(judging)
      assertLosslessJson(judgingBrief)
      expect((judgingBrief.candidates as any[])[0]).not.toHaveProperty('error')
      expect((judgingBrief.candidates as any[])[0]).not.toHaveProperty('checks')
      expect((judgingBrief.candidates as any[])[0]).not.toHaveProperty('eligible')
      expect((judgingBrief.candidates as any[])[0]).not.toHaveProperty('blockers')

      const adoptedWithoutMessage = fixtureRecord('55667788')
      adoptedWithoutMessage.state = 'adopted'
      adoptedWithoutMessage.checksFavoured = 'A'
      adoptedWithoutMessage.choice = { pick: 'A', at: 2 }
      adoptedWithoutMessage.adoption = { label: 'A', mode: 'folder', state: 'adopted', startedAt: 2, endedAt: 3 }
      const adoptedBrief = brief(adoptedWithoutMessage)
      assertLosslessJson(adoptedBrief)
      expect(adoptedBrief).toMatchObject({
        choice: 'A',
        checksFavoured: 'A',
        adoption: { state: 'adopted', mode: 'folder' },
      })
      expect(adoptedBrief.adoption).not.toHaveProperty('message')

      const adoptedWithErrorAndMessage = fixtureRecord('99aabbcc')
      adoptedWithErrorAndMessage.state = 'revealed'
      adoptedWithErrorAndMessage.choice = { pick: 'B', at: 2 }
      adoptedWithErrorAndMessage.adoption = { label: 'B', mode: 'worktree', state: 'adopted', startedAt: 2, endedAt: 3, message: 'Adopted cleanly' }
      adoptedWithErrorAndMessage.candidates[0]!.error = { stage: 'verifying', message: 'Build failed\ndetails' }
      adoptedWithErrorAndMessage.candidates[1]!.preview = { url: 'http://127.0.0.1:4317/', port: 4317, pid: 1234, kind: 'build', cwd: '/tmp' }
      const fullBrief = brief(adoptedWithErrorAndMessage)
      assertLosslessJson(fullBrief)
      expect(fullBrief).toMatchObject({
        choice: 'B',
        adoption: { state: 'adopted', mode: 'worktree', message: 'Adopted cleanly' },
      })
    } finally {
      await comparer.dispose()
    }
  })
})

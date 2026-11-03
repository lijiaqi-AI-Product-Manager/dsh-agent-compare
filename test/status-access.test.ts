import { describe, expect, it, vi } from 'vitest'
import { readFile } from 'node:fs/promises'
import { Comparer } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
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
})

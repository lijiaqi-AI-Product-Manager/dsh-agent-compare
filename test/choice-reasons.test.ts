import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { Comparer } from '../src/core/orchestrator.ts'
import { RunStore } from '../src/core/run-store.ts'
import { fixtureRecord } from './record-fixture.ts'
import { tmp } from './fixture.ts'

async function fixture() {
  const store = new RunStore(await tmp('ac-choice-reasons')), record = fixtureRecord()
  await store.save(record)
  const comparer = new Comparer({ store, runner: { isolation: 'own-root', async run() { throw new Error('No generation is needed') } }, version: 'test' })
  return { store, record, comparer }
}

describe('choice reason ownership', () => {
  it('does not attach a delayed explanation to a different pick', async () => {
    const { store, record, comparer } = await fixture()
    try {
      await comparer.choose(record.runId, 'A')
      await comparer.choose(record.runId, 'B')
      const before = await readFile(store.file(record.runId), 'utf8')
      await expect(comparer.explainChoice(record.runId, ['layout'], 'A was easier to navigate', 'A')).rejects.toThrow(/选择.*变化/)
      expect(await readFile(store.file(record.runId), 'utf8')).toBe(before)
      expect((await store.load(record.runId))?.choice).toMatchObject({ pick: 'B' })
      expect((await store.load(record.runId))?.choice?.reasons).toBeUndefined()
    } finally { await comparer.dispose() }
  })

  it('saves reasons for the matching pick and clears them on repick', async () => {
    const { record, comparer } = await fixture()
    try {
      await comparer.choose(record.runId, 'A')
      const saved = await comparer.explainChoice(record.runId, ['layout', 'simple'], ' clear\n navigation ', 'A')
      expect(saved.choice).toMatchObject({ pick: 'A', reasons: ['layout', 'simple'], note: 'clear navigation' })
      const changed = await comparer.choose(record.runId, 'B')
      expect(changed.choice?.reasons).toBeUndefined()
      expect(changed.choice?.note).toBeUndefined()
    } finally { await comparer.dispose() }
  })
})

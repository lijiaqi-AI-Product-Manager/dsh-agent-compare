import { describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { RunStore } from '../src/core/run-store.ts'
import { RUN_SCHEMA, type RunRecord } from '../src/core/types.ts'
import { historyPage, HistoryQueryError } from '../src/host/history.ts'
import { tmp } from './fixture.ts'

const record = (index: number): RunRecord => ({
  schema: RUN_SCHEMA, producer: { name: 'dsh-agent-compare', version: 'test' }, runId: index.toString(16).padStart(8, '0'), rev: 0,
  createdAt: index, updatedAt: index, sessionId: index % 2 ? 's1' : 's2', task: `搜索筛选 ${index}`, state: 'judging',
  baseline: { repoRoot: '/projects/demo-shop', headCommit: 'a'.repeat(40), snapshotCommit: 'b'.repeat(40), snapshotTree: 'c'.repeat(40), dirty: false },
  acceptance: { checks: { commands: [] }, scripts: {}, bound: {}, runtime: { node: 'test', packageManager: 'npm', platform: process.platform }, source: 'defaults', sha256: 'f'.repeat(64) },
  candidates: ['A', 'B'].map(label => ({ label: label as 'A' | 'B', stage: 'cancelled', strategy: { id: label, title: label, instruction: '' }, route: {}, timings: {} })),
  mode: 'same-model', isolation: 'own-root', budget: { generationMs: 300000 },
})

describe('retained history navigation', () => {
  it('keeps every stored comparison reachable across pages without changing record bytes', async () => {
    const store = new RunStore(await tmp('ac-history'))
    for (let index = 1; index <= 65; index++) await store.save(record(index))
    const before = await readFile(store.file('00000001'), 'utf8')
    const pages = await Promise.all([0, 30, 60].map(offset => historyPage(store, { sessionId: 'new-session', scope: 'all', offset })))
    expect(pages.map(page => page.runs.length)).toEqual([30, 30, 5])
    expect(pages.map(page => page.history.hasNext)).toEqual([true, true, false])
    expect(pages.every(page => page.history.total === 65)).toBe(true)
    const ids = pages.flatMap(page => page.runs.map(item => item.runId))
    expect(new Set(ids).size).toBe(65)
    expect(ids[0]).toBe('00000041')
    expect(ids.at(-1)).toBe('00000001')
    expect((await historyPage(store, { scope: 'all', offset: 999 })).history.offset).toBe(60)
    expect(await readFile(store.file('00000001'), 'utf8')).toBe(before)
  })

  it('keeps default inline reads in their own conversation and exposes all scope explicitly', async () => {
    const store = new RunStore(await tmp('ac-history-scope'))
    await store.save(record(1)); await store.save(record(2))
    expect((await historyPage(store, { sessionId: 's1' })).runs.map(item => item.runId)).toEqual(['00000001'])
    expect((await historyPage(store, { sessionId: 'new-session' })).runs).toEqual([])
    expect((await historyPage(store, { sessionId: 'new-session', scope: 'all' })).history.total).toBe(2)
  })

  it('searches tasks, repository names and identifiers, including normalized full-width text', async () => {
    const store = new RunStore(await tmp('ac-history-search'))
    await store.save(record(10))
    for (const search of ['搜索', 'DEMO-SHOP', 'ＤＥＭＯ-ＳＨＯＰ', '0000000a']) expect((await historyPage(store, { scope: 'all', search })).history.total).toBe(1)
    expect((await historyPage(store, { scope: 'all', search: 'missing' })).history).toMatchObject({ total: 0, offset: 0, hasNext: false })
  })

  it('pages legacy summaries in global history without assigning them to an unrelated session', async () => {
    const store = new RunStore(await tmp('ac-history-legacy'))
    await store.save(record(1))
    const raw = JSON.stringify({ schema: 'agent-compare.run/v1', runId: 'ffffffff', createdAt: 2, task: '旧版搜索记录', state: 'revealed' })
    await mkdir(store.runsDir, { recursive: true })
    await writeFile(store.file('ffffffff'), raw)
    const all = await historyPage(store, { scope: 'all' })
    expect(all.history.total).toBe(2)
    expect(all.legacy.map(item => item.runId)).toEqual(['ffffffff'])
    expect((await historyPage(store, { sessionId: 's1' })).legacy).toEqual([])
    expect(await readFile(store.file('ffffffff'), 'utf8')).toBe(raw)
  })

  it('rejects malformed scope, session, search and page arguments before storage access', async () => {
    const store = new RunStore(await tmp('ac-history-invalid'))
    for (const query of [{ scope: 'other' }, { scope: 'session' }, { sessionId: [] }, { search: 'x'.repeat(201) }, { search: {} }, { offset: -1 }, { offset: 0.5 }, { offset: Infinity }]) {
      await expect(historyPage(store, query)).rejects.toBeInstanceOf(HistoryQueryError)
    }
  })
})

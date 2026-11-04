import { afterEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { RunStore, RecordUnavailableError, StaleRecordError } from '../src/core/run-store.ts'
import { fixtureRecord } from './record-fixture.ts'

vi.mock('node:fs/promises', { spy: true })
const homes: string[] = []
async function storeWith(count = 1) {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-history-cache-')); homes.push(home)
  const store = new RunStore(home)
  await fs.mkdir(store.runsDir)
  await Promise.all(Array.from({ length: count }, async (_, index) => {
    const record = fixtureRecord(index.toString(16).padStart(8, '0')); record.rev = 1; record.createdAt = index
    await fs.writeFile(store.file(record.runId), JSON.stringify(record))
  }))
  return store
}
afterEach(async () => {
  vi.restoreAllMocks()
  for (const home of homes.splice(0)) {
    expect(path.dirname(home)).toBe(path.resolve(os.tmpdir()))
    expect(path.basename(home)).toMatch(/^ac-history-cache-/)
    await fs.rm(home, { recursive: true, force: true })
  }
})

describe('bounded retained-history reads', () => {
  it('reuses 500 validated records without opening their bodies again', async () => {
    const store = await storeWith(500), opened = vi.spyOn(fs, 'open')
    const cold = performance.now(), first = await store.listAll(), coldMs = performance.now() - cold
    expect(first.current).toHaveLength(500)
    expect(opened).toHaveBeenCalledTimes(500)
    opened.mockClear()
    const warm = performance.now(), second = await store.listAll(), warmMs = performance.now() - warm
    expect(second).toEqual(first)
    expect(opened).not.toHaveBeenCalled()
    second.current[0]!.task = 'caller-local mutation'
    expect((await store.list())[0]!.task).toBe('Add search')
    console.log(JSON.stringify({ records: 500, coldMs: Math.round(coldMs), warmMs: Math.round(warmMs), warmBodyReads: 0 }))
  }, 60000)
  it('detects a same-sized external edit even when mtime is restored', async () => {
    const store = await storeWith(), file = store.file('00000000')
    await fs.utimes(file, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'))
    await store.list()
    const before = await fs.stat(file), raw = await fs.readFile(file, 'utf8')
    await new Promise(resolve => setTimeout(resolve, 10))
    await fs.writeFile(file, raw.replace('Add search', 'Add result'))
    await fs.utimes(file, before.atime, before.mtime)
    expect((await fs.stat(file)).size).toBe(before.size)
    expect((await fs.stat(file)).mtimeMs).toBe(before.mtimeMs)
    expect((await store.list())[0]!.task).toBe('Add result')
  })
  it('remains bounded without reopening the complete history when capacity is exceeded', async () => {
    const store = await storeWith(2049), opened = vi.spyOn(fs, 'open')
    expect(await store.list()).toHaveLength(2049)
    opened.mockClear()
    expect(await store.list()).toHaveLength(2049)
    expect(opened).toHaveBeenCalledTimes(1)
  }, 60000)
  it('detects replacement, deletion and new records', async () => {
    const store = await storeWith(), file = store.file('00000000')
    await store.list()
    const replacement = fixtureRecord('00000000'); replacement.rev = 1; replacement.task = 'replacement'
    await fs.writeFile(file + '.new', JSON.stringify(replacement))
    await fs.rename(file + '.new', file)
    expect((await store.list())[0]!.task).toBe('replacement')
    await fs.unlink(file)
    expect(await store.list()).toEqual([])
    const added = fixtureRecord('11111111'); added.rev = 1
    await fs.writeFile(store.file(added.runId), JSON.stringify(added))
    expect((await store.list())[0]!.runId).toBe('11111111')
  })
  it('never serves cached history to authoritative loads or stale writes', async () => {
    const store = await storeWith(), [stale] = await store.list()
    const peer = new RunStore(store.home), current = (await peer.load('00000000'))!
    current.task = 'saved by another process'; await peer.save(current)
    await expect(store.save(stale!)).rejects.toBeInstanceOf(StaleRecordError)
    expect((await store.load(current.runId))!.task).toBe('saved by another process')
    await store.list()
    await fs.writeFile(store.file(current.runId), '{broken')
    await expect(store.load(current.runId)).rejects.toBeInstanceOf(RecordUnavailableError)
    expect((await store.listAll()).legacy[0]!.unavailable).toBe(true)
    expect(await fs.readFile(store.file(current.runId), 'utf8')).toBe('{broken')
  })
})

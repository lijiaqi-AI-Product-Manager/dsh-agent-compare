import { describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import { RunStore, RecordUnavailableError, StaleRecordError } from '../src/core/run-store.ts'
import { Comparer } from '../src/core/orchestrator.ts'
import { assertRunRecord, MAX_RECORD_BYTES, RecordValidationError } from '../src/core/record-validation.ts'
import { fixtureRecord } from './record-fixture.ts'
import { tmp } from './fixture.ts'

vi.mock('node:fs/promises', { spy: true })

describe('serialized record validation', () => {
  it('validates process evidence while keeping older records readable', () => {
    const record = fixtureRecord()
    record.rev = 1
    assertRunRecord(record, record.runId)
    record.candidates[0]!.install!.runtime = { hostNode: process.version, platform: 'win32-x64', packageManager: 'npm', windowsProcessCompat: { mode: 'off', observedHooks: [] } }
    assertRunRecord(record, record.runId)
    for (const windowsProcessCompat of [{ mode: 'disabled', observedHooks: [] }, { mode: 'auto', observedHooks: ['unknown-hook'] }]) {
      const changed = structuredClone(record)
      ;(changed.candidates[0]!.install!.runtime as any).windowsProcessCompat = windowsProcessCompat
      expect(() => assertRunRecord(changed, record.runId)).toThrow(RecordValidationError)
    }
  })
  it('round-trips independently named local previews and rejects a forged suffix or mismatched port', async () => {
    const record = fixtureRecord(), store = new RunStore(await tmp('ac-named-preview-record'))
    record.candidates[0]!.preview = { url: `http://ac-${'a'.repeat(32)}.localhost:4321/base/`, port: 4321, pid: 999999, kind: 'build', cwd: record.candidates[0]!.dir! }
    await store.save(record)
    expect((await store.load(record.runId))?.candidates[0]?.preview).toEqual(record.candidates[0]!.preview)
    for (const url of [`http://ac-${'a'.repeat(32)}.localhost.example.test:4321/`, `http://ac-${'a'.repeat(32)}.localhost:4322/`]) {
      const changed = structuredClone(record); changed.candidates[0]!.preview!.url = url
      expect(() => assertRunRecord(changed, record.runId)).toThrow(RecordValidationError)
    }
  })

  it('accepts complete recorded facts, including browser artifacts and adoption journals', () => {
    const record = fixtureRecord()
    record.rev = 1
    record.choice = { pick: 'A', at: 2 }
    record.adoption = { label: 'A', mode: 'worktree', state: 'reverting', startedAt: 3, preAdoptCommit: '4'.repeat(40), expectedTree: '5'.repeat(40), stagedBefore: '6'.repeat(64), writtenPaths: ['src/App.tsx'], fileTransfer: { id: '7'.repeat(32), token: '8'.repeat(32) }, transferDirection: 'undo', transferReturn: 'adopted', retainedTransfers: [{ id: '9'.repeat(32), token: 'a'.repeat(32) }] }
    const candidate = record.candidates[0]!
    candidate.preview = { url: 'http://127.0.0.1:1234/base/', port: 1234, pid: 999999, kind: 'build', cwd: candidate.dir! }
    candidate.checks!.push({ name: 'browser', outcome: 'passed', durationMs: 2, tail: '', ...{ screenshot: candidate.patchFile!.replace('.patch', '.png') } })
    expect(() => assertRunRecord(JSON.parse(JSON.stringify(record)), record.runId)).not.toThrow()
  })

  it('refuses malformed nested fields and unsafe identities before they reach actions', () => {
    const mutations: Array<(raw: any) => void> = [
      raw => { raw.runId = 'deadbeef' }, raw => { raw.rev = -1 }, raw => { raw.rev = NaN }, raw => { raw.state = 'done' },
      raw => { raw.candidates = {} }, raw => { raw.candidates.pop() }, raw => { raw.candidates[1].label = 'A' },
      raw => { raw.baseline.snapshotTree = '--option' }, raw => { raw.acceptance.checks.commands[0].argv = [] },
      raw => { raw.acceptance.checks.commands[0].argv = ['node', '\0'] }, raw => { raw.acceptance.bound = { '../outside': 'a'.repeat(40) } },
      raw => { raw.candidates[0].touchedFiles = ['../outside'] }, raw => { raw.candidates[0].dir = 'relative/path' },
      raw => { raw.candidates[0].usage = { kind: 'reported', totalTokens: -1 } }, raw => { raw.candidates[0].checks[0].durationMs = Infinity },
      raw => { raw.candidates[0].preview = { url: 'http://example.test/', port: 80, pid: 1, cwd: raw.baseline.repoRoot, kind: 'build' } },
      raw => { raw.acceptance.checks.browser = { path: '//example.test' } }, raw => { raw.candidates[0].timings.invalid = { startedAt: 1 } },
      raw => { raw.unexpected = 'not part of this format' },
    ]
    for (const change of mutations) {
      const raw = structuredClone(fixtureRecord()); raw.rev = 1; change(raw)
      expect(() => assertRunRecord(raw, '0a1b2c3d')).toThrow(RecordValidationError)
    }
    for (const raw of [null, [], 42, 'text']) expect(() => assertRunRecord(raw, '0a1b2c3d')).toThrow(RecordValidationError)
    expect(() => assertRunRecord(Object.create({ ...fixtureRecord(), rev: 1 }), '0a1b2c3d')).toThrow(RecordValidationError)
  })
})

describe('damaged record retention', () => {
  it('validates serialized bytes before publishing a record with custom serialization', async () => {
    const store = new RunStore(await tmp('ac-record-serialization')), record = fixtureRecord()
    Object.defineProperty(record.candidates[0], 'toJSON', { value: () => ({ label: 'A' }) })
    await expect(store.save(record)).rejects.toBeInstanceOf(RecordValidationError)
    await expect(fs.stat(store.file(record.runId))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(record.rev).toBe(0)
  })

  it('retains malformed bytes, reports them read-only and recovers unrelated valid work', async () => {
    const store = new RunStore(await tmp('ac-damaged-history')), good = fixtureRecord('11111111')
    good.state = 'running'
    good.candidates.forEach(candidate => { candidate.stage = 'queued' })
    await store.save(good)
    const bad = '{"schema":"agent-compare.run/v2","runId":"0a1b2c3d","candidates":{}}'
    await fs.writeFile(store.file('0a1b2c3d'), bad)
    const runner = { isolation: 'own-root' as const, run: vi.fn(async () => { throw Error('must never generate') }) }
    const comparer = new Comparer({ store, runner, version: 'test' })
    try {
      expect(await comparer.recover()).toEqual(['11111111'])
      expect((await store.load('11111111'))?.state).toBe('interrupted')
      await expect(store.load('0a1b2c3d')).rejects.toBeInstanceOf(RecordUnavailableError)
      const all = await store.listAll()
      expect(all.current.map(record => record.runId)).toEqual(['11111111'])
      expect(all.legacy[0]).toMatchObject({ runId: '0a1b2c3d', legacy: true, unavailable: true, state: 'unavailable' })
      expect(await fs.readFile(store.file('0a1b2c3d'), 'utf8')).toBe(bad)
      expect(runner.run).not.toHaveBeenCalled()
    } finally { await comparer.dispose() }
  })

  it('refuses a stale update over damaged, incompatible or removed history without replacing it', async () => {
    const store = new RunStore(await tmp('ac-damaged-update')), record = fixtureRecord()
    await store.save(record)
    for (const bad of ['{incomplete private-content', 'null', JSON.stringify({ schema: 'future-format', runId: record.runId })]) {
      await fs.writeFile(store.file(record.runId), bad)
      await expect(store.save(record)).rejects.toBeInstanceOf(RecordUnavailableError)
      expect(await fs.readFile(store.file(record.runId), 'utf8')).toBe(bad)
      expect(record.rev).toBe(1)
      const all = await store.listAll()
      expect(all.legacy[0]?.reason).not.toContain('private-content')
    }
    await fs.rm(store.file(record.runId))
    await expect(store.save(record)).rejects.toBeInstanceOf(StaleRecordError)
    await expect(fs.stat(store.file(record.runId))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('distinguishes read failures from missing files and keeps directory failures visible', async () => {
    const store = new RunStore(await tmp('ac-history-read-error')), record = fixtureRecord()
    await store.save(record)
    const before = await fs.readFile(store.file(record.runId), 'utf8')
    const opening = vi.mocked(fs.open).mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }))
    try {
      await expect(store.load(record.runId)).rejects.toBeInstanceOf(RecordUnavailableError)
      await expect(store.save(record)).rejects.toBeInstanceOf(RecordUnavailableError)
      expect((await store.listAll()).legacy[0]?.reason).toContain('EACCES')
    } finally { opening.mockReset() }
    expect(await fs.readFile(store.file(record.runId), 'utf8')).toBe(before)
    const listing = vi.mocked(fs.readdir).mockRejectedValue(Object.assign(new Error('denied'), { code: 'EACCES' }))
    try { await expect(store.listAll()).rejects.toThrow('EACCES') } finally { listing.mockReset() }
  })

  it('refuses oversized reads and writes while retaining the existing file', async () => {
    const store = new RunStore(await tmp('ac-large-record')), record = fixtureRecord()
    await store.save(record)
    const before = await fs.readFile(store.file(record.runId), 'utf8')
    const large = { ...record, acceptance: { ...record.acceptance, scripts: Object.fromEntries(Array.from({ length: 260 }, (_, index) => [String(index), 'x'.repeat(65536)])) } }
    await expect(store.save(large)).rejects.toBeInstanceOf(RecordValidationError)
    expect(await fs.readFile(store.file(record.runId), 'utf8')).toBe(before)
    const handle = await fs.open(store.file('ffffffff'), 'w')
    try { await handle.truncate(MAX_RECORD_BYTES + 1) } finally { await handle.close() }
    await expect(store.load('ffffffff')).rejects.toBeInstanceOf(RecordUnavailableError)
    expect((await store.listAll()).legacy[0]?.reason).toContain('16 MiB')
    expect((await fs.stat(store.file('ffffffff'))).size).toBe(MAX_RECORD_BYTES + 1)
  })

  it('retries a record replaced atomically between inspection and opening', async () => {
    const store = new RunStore(await tmp('ac-record-read-race')), record = fixtureRecord()
    await store.save(record)
    const replacement = { ...record, rev: 2, task: 'newer retained record' }
    const native = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const pending = `${store.file(record.runId)}.replacement`
    await fs.writeFile(pending, JSON.stringify(replacement))
    const opening = vi.mocked(fs.open).mockImplementationOnce(async (...args: any[]) => {
      await native.rename(pending, store.file(record.runId))
      return (native.open as any)(...args)
    })
    try {
      expect((await store.load(record.runId))?.task).toBe('newer retained record')
      expect((await store.listAll()).legacy).toEqual([])
      await expect(store.save(record)).rejects.toBeInstanceOf(StaleRecordError)
    } finally { opening.mockReset() }
  })

  it('guards identifiers before deriving record, artifact, copy or lock paths', async () => {
    const store = new RunStore(await tmp('ac-record-paths'))
    for (const id of ['../escape', '..\\escape', 'FFFFFFFF', '', '123456789']) {
      expect(() => store.file(id)).toThrow(RecordValidationError)
      expect(() => store.artifacts(id)).toThrow(RecordValidationError)
      expect(() => store.copies(id)).toThrow(RecordValidationError)
      expect(await store.load(id)).toBeUndefined()
    }
    const action = vi.fn(async () => {})
    await expect(store.withLock('../escape', action)).rejects.toThrow('invalid lock identifier')
    expect(action).not.toHaveBeenCalled()
    await expect(fs.stat(store.locksDir)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

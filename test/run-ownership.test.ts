import { describe, expect, it, vi } from 'vitest'
import { fork } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Comparer, type AgentRunner } from '../src/core/orchestrator.ts'
import { RunStore, BusyError } from '../src/core/run-store.ts'
import { RUN_COORDINATION } from '../src/core/types.ts'
import { addOwnedWorktree, git, withRepositoryWrite } from '../src/core/git.ts'
import { fixtureRepo, prepareFixtureProcess, tmp } from './fixture.ts'
import { fixtureRecord } from './record-fixture.ts'

const idleRunner: AgentRunner = { isolation: 'own-root', async run() { throw new Error('this case must not start a candidate') } }
function signal() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }
function peer(store: RunStore) { return new Comparer({ store: new RunStore(store.home), runner: idleRunner, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false }) }

describe('live run ownership', () => {
  it('retains a record with a damaged guard while recovering unrelated work', async () => {
    const store = new RunStore(await tmp('ac-bad-owner-guard')), bad = fixtureRecord(), good = fixtureRecord('11111111')
    for (const record of [bad, good]) { record.state = 'running'; record.candidates.forEach(c => { c.stage = 'generating' }); await store.save(record) }
    const guard = path.join(store.locksDir, `owner-${bad.runId}.sqlite`)
    await writeFile(guard, 'damaged guard retained')
    const bytes = await readFile(store.file(bad.runId), 'utf8'), warnings: string[] = []
    const current = new Comparer({ store, runner: idleRunner, version: 'test', onRecoveryIssue: issue => { warnings.push(issue.runId) } })
    try {
      expect(await current.recover()).toEqual([good.runId])
      expect(warnings).toEqual([bad.runId])
      expect(await current.control(bad)).toMatchObject({ allowed: false, reason: expect.stringContaining('无法确认') })
      await expect(current.choose(bad.runId, 'none')).rejects.toThrow()
      expect(await readFile(store.file(bad.runId), 'utf8')).toBe(bytes)
      expect(await readFile(guard, 'utf8')).toBe('damaged guard retained')
      expect((await store.list()).length).toBe(2)
    } finally { await current.dispose() }
  })

  it('drains ownership acquisition during shutdown and releases an unstarted run', async () => {
    const store = new RunStore(await tmp('ac-owner-admission')), repo = await fixtureRepo(), entered = signal(), finish = signal()
    const original = store.acquireLock.bind(store)
    const acquire = vi.spyOn(store, 'acquireLock').mockImplementation(async (key, opts) => {
      const lease = await original(key, opts)
      if (key.startsWith('owner-')) { entered.resolve(); await finish.promise }
      return lease
    })
    const current = new Comparer({ store, runner: idleRunner, version: 'test', prepareProjectProcess: prepareFixtureProcess })
    const starting = current.start({ repo, task: 'close during ownership acquisition' }); void starting.catch(() => {})
    try {
      await entered.promise
      const closing = current.dispose()
      let closed = false; void closing.then(() => { closed = true })
      await new Promise(resolve => setImmediate(resolve))
      expect(closed).toBe(false)
      const key = acquire.mock.calls.find(([key]) => key.startsWith('owner-'))![0]
      await expect(new RunStore(store.home).acquireLock(key)).rejects.toBeInstanceOf(BusyError)
      finish.resolve(); await expect(starting).rejects.toBeInstanceOf(BusyError); await closing
      expect(await store.list()).toEqual([])
      const reclaimed = await new RunStore(store.home).acquireLock(key); reclaimed.release()
    } finally { finish.resolve(); acquire.mockRestore(); await current.dispose() }
  }, 120000)

  it('releases ownership when an accepted action fails while shutdown drains it', async () => {
    const store = new RunStore(await tmp('ac-owner-close-error')), record = fixtureRecord()
    await store.save(record)
    const current = peer(store), other = peer(store)
    const entered = signal(), finish = signal()
    const save = vi.spyOn(current.store, 'save').mockImplementation(async r => { entered.resolve(); await finish.promise; throw new Error('storage unavailable during action') })
    const choosing = current.choose(record.runId, 'A'); void choosing.catch(() => {})
    try {
      await entered.promise
      const closing = current.dispose()
      expect(await other.control(record)).toMatchObject({ allowed: false })
      finish.resolve(); await expect(choosing).rejects.toThrow('storage unavailable'); await closing
      expect(await other.control(record)).toEqual({ allowed: true })
      expect((await other.get(record.runId))?.state).toBe('judging')
      save.mockRestore()
      expect((await other.choose(record.runId, 'B')).choice?.pick).toBe('B')
    } finally { finish.resolve(); save.mockRestore(); await current.dispose(); await other.dispose() }
  })

  it('skips an independent live process and recovers its record after a crash', async () => {
    const store = new RunStore(await tmp('ac-owner-crash')), record = fixtureRecord()
    record.state = 'running'; record.candidates.forEach(c => { c.stage = 'generating' })
    await store.save(record)
    const child = fork(fileURLToPath(new URL('./lock-worker.mjs', import.meta.url)), [store.home, `owner-${record.runId}`], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true })
    const closed = new Promise(resolve => child.once('close', resolve)), other = peer(store)
    const first = new Promise(resolve => { child.once('message', resolve); child.once('error', resolve) })
    try {
      expect(await first).toEqual({ state: 'held' })
      const bytes = await readFile(store.file(record.runId), 'utf8')
      expect(await other.recover()).toEqual([])
      expect(await readFile(store.file(record.runId), 'utf8')).toBe(bytes)
      child.kill('SIGKILL'); await closed
      expect(await other.recover()).toEqual([record.runId])
      const recovered = (await other.get(record.runId))!
      expect(recovered.state).toBe('interrupted')
      expect(recovered.candidates.map(c => c.stage)).toEqual(['interrupted', 'interrupted'])
      expect(await other.control(recovered)).toEqual({ allowed: true })
    } finally { if (child.exitCode === null) child.kill('SIGKILL'); await closed; await other.dispose() }
  }, 60000)

  it('preserves a peer generating both candidates and rejects all foreign mutations', async () => {
    const store = new RunStore(await tmp('ac-live-owner')), repo = await fixtureRepo(), entered = signal(), finish = signal()
    let calls = 0
    const runner: AgentRunner = { isolation: 'own-root', async run() { if (++calls === 2) entered.resolve(); await finish.promise; return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } } } }
    const owner = new Comparer({ store, runner, version: 'test', prepareProjectProcess: prepareFixtureProcess }), other = peer(store)
    const started = await owner.start({ repo, task: 'live peer', assignment: 'fixed' })
    try {
      await entered.promise
      const bytes = await readFile(store.file(started.runId), 'utf8'), head = await git(repo, ['rev-parse', 'HEAD'])
      expect(await other.recover()).toEqual([])
      expect(await other.control(started)).toMatchObject({ allowed: false, retryable: true })
      const actions = [
        () => other.cancel(started.runId), () => other.choose(started.runId, 'none'), () => other.adoptPreflight(started.runId),
        () => other.adopt(started.runId), () => other.revert(started.runId), () => other.recoverAdoption(started.runId, 'restore'),
        () => other.cleanup(started.runId), () => other.reopenPreview(started.runId, 'A'), () => other.salvage(started.runId, 'A'),
      ]
      for (const action of actions) await expect(action()).rejects.toBeInstanceOf(BusyError)
      expect(await readFile(store.file(started.runId), 'utf8')).toBe(bytes)
      expect(await git(repo, ['rev-parse', 'HEAD'])).toBe(head)
      expect((await other.get(started.runId))?.candidates.map(c => c.stage)).toEqual(['generating', 'generating'])
      await owner.cancel(started.runId)
      finish.resolve(); await owner.wait(started.runId); await owner.dispose()
      const settled = (await other.get(started.runId))!
      expect(await other.control(settled)).toEqual({ allowed: true })
      expect((await other.choose(started.runId, 'none')).state).toBe('revealed')
    } finally { finish.resolve(); await owner.dispose(); await other.cleanup(started.runId); await other.dispose() }
  }, 120000)

  it('leaves another host live previews running and can reopen after orderly ownership transfer', async () => {
    const store = new RunStore(await tmp('ac-preview-owner')), repo = await fixtureRepo()
    const runner: AgentRunner = { isolation: 'own-root', async run(req) { await writeFile(path.join(req.cwd, 'index.html'), `<h1>owned ${req.label}</h1>`); return { stopReason: 'completed', usage: { kind: 'unknown', reason: 'fixture' } } } }
    const owner = new Comparer({ store, runner, version: 'test', prepareProjectProcess: prepareFixtureProcess, browserChecks: false, previewTimeoutMs: 120000 }), other = peer(store)
    const started = await owner.start({ repo, task: 'keep previews', assignment: 'fixed' })
    try {
      const ready = (await owner.wait(started.runId))!
      expect(ready.candidates.map(c => c.stage), JSON.stringify(ready)).toEqual(['ready', 'ready'])
      const url = ready.candidates[0]!.preview!.url, bytes = await readFile(store.file(started.runId), 'utf8')
      expect(await other.recover()).toEqual([])
      expect(await readFile(store.file(started.runId), 'utf8')).toBe(bytes)
      expect(await (await fetch(url)).text()).toContain('owned A')
      await expect(other.cleanup(started.runId)).rejects.toBeInstanceOf(BusyError)
      await owner.dispose()
      expect(await other.recover()).toEqual([])
      const reopened = await other.reopenPreview(started.runId, 'A')
      expect(await (await fetch(reopened.candidates[0]!.preview!.url)).text()).toContain('owned A')
    } finally { await owner.dispose(); await other.cleanup(started.runId); await other.dispose() }
  }, 180000)

  it('does not infer that an unmarked older run has stopped', async () => {
    const store = new RunStore(await tmp('ac-old-owner')), record = fixtureRecord()
    delete record.coordination; record.state = 'running'; record.candidates[0]!.stage = 'generating'
    await store.save(record)
    const bytes = await readFile(store.file(record.runId), 'utf8'), other = peer(store)
    try {
      expect(await other.recover()).toEqual([])
      expect(await other.control(record)).toMatchObject({ allowed: false, reason: expect.stringContaining('旧记录') })
      await expect(other.cancel(record.runId)).rejects.toBeInstanceOf(BusyError)
      expect(await readFile(store.file(record.runId), 'utf8')).toBe(bytes)
    } finally { await other.dispose() }
  })

  it('re-reads after ownership acquisition and does not race a local mutation with recovery', async () => {
    const store = new RunStore(await tmp('ac-local-owner')), record = fixtureRecord(), entered = signal(), finish = signal()
    record.coordination = RUN_COORDINATION
    await store.save(record)
    const current = peer(store), other = peer(store), original = current.store.save.bind(current.store)
    const save = vi.spyOn(current.store, 'save').mockImplementation(async r => { if (r.state === 'revealed') { entered.resolve(); await finish.promise }; return original(r) })
    try {
      const choosing = current.choose(record.runId, 'A'); await entered.promise
      const recovering = current.recover()
      expect(await other.control(record)).toMatchObject({ allowed: false })
      finish.resolve(); expect((await choosing).state).toBe('revealed'); expect(await recovering).toEqual([])
      expect((await store.load(record.runId))?.choice?.pick).toBe('A')
      expect(await other.control(record)).toEqual({ allowed: true })
    } finally { finish.resolve(); save.mockRestore(); await current.dispose(); await other.dispose() }
  })

  it('coordinates repository writes across plugin homes and linked checkouts', async () => {
    const repo = await fixtureRepo(), checkout = path.join(await tmp('ac-linked-lock'), 'copy'), commit = (await git(repo, ['rev-parse', 'HEAD'])).trim()
    await addOwnedWorktree(repo, checkout, commit, { runId: '11111111', label: 'A', token: 'a'.repeat(24) })
    await withRepositoryWrite(repo, async () => {
      await expect(withRepositoryWrite(checkout, async () => 'must not run')).rejects.toBeInstanceOf(BusyError)
      const independent = await fixtureRepo()
      expect(await withRepositoryWrite(independent, async () => 7)).toBe(7)
    })
    expect(await withRepositoryWrite(checkout, async () => 'released')).toBe('released')
  }, 120000)
})

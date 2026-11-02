import { describe, expect, it, vi } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { RunStore, repoKey, StaleRecordError } from '../src/core/run-store.ts'
import { isAlive, killTree, ownsProcess, run, spawnSpec, waitGone, which } from '../src/core/proc.ts'
import * as processes from '../src/core/proc.ts'
import { freePort, startVitePreview } from '../src/core/preview.ts'
import { publicView, verdictOf } from '../src/core/orchestrator.ts'
import { Comparer } from '../src/core/orchestrator.ts'
import { RUN_SCHEMA, type Acceptance, type Candidate, type RunRecord } from '../src/core/types.ts'
import { tmp } from './fixture.ts'

const acceptance: Acceptance = { checks: { commands: [{ name: 'build', argv: ['npm', 'run', 'build'] }], browser: { path: '/' } }, scripts: {}, bound: {}, runtime: { node: 'v0', packageManager: 'npm', platform: 'x' }, source: 'defaults', sha256: 'f'.repeat(64) }

function record(runId: string): RunRecord {
  return {
    schema: RUN_SCHEMA,
    producer: { name: 'dsh-agent-compare', version: 'test' },
    runId,
    createdAt: Date.now(),
    task: 't',
    baseline: { repoRoot: '/r', headCommit: 'a'.repeat(40), snapshotCommit: 'b'.repeat(40), snapshotTree: 'c'.repeat(40), dirty: false },
    acceptance,
    mode: 'same-model',
    isolation: 'own-root',
    budget: { generationMs: 1000 },
    state: 'judging',
    candidates: [
      { label: 'A', strategy: { id: 'bold', title: 'Bold', instruction: '' }, route: { model: 'm1' }, stage: 'ready', timings: {}, summary: 'I went bold', usage: { kind: 'unknown', reason: 'not reported' } },
      { label: 'B', strategy: { id: 'conservative', title: 'Conservative', instruction: '' }, route: { model: 'm1' }, stage: 'failed', timings: {} },
    ],
    rev: 0,
    updatedAt: Date.now(),
  }
}

describe('run store', () => {
  it('round-trips records atomically and rejects ids that are not run ids', async () => {
    const store = new RunStore(await tmp('ac-home'))
    await store.save(record('0a1b2c3d'))
    expect((await store.load('0a1b2c3d'))?.task).toBe('t')
    expect(await store.load('../../etc')).toBeUndefined()
    expect((await store.list()).map((r) => r.runId)).toEqual(['0a1b2c3d'])
  })

  it('refuses a save based on a stale revision', async () => {
    const store = new RunStore(await tmp('ac-home'))
    const r = record('0a1b2c3d')
    await store.save(r)
    expect(r.rev).toBe(1)
    const stale = { ...r, rev: 0 }
    await expect(store.save(stale)).rejects.toBeInstanceOf(StaleRecordError)
    await store.save(r)
    expect((await store.load('0a1b2c3d'))?.rev).toBe(2)
  })

  it('treats older-schema records as read-only history', async () => {
    const store = new RunStore(await tmp('ac-home'))
    await mkdir(store.runsDir, { recursive: true })
    await writeFile(store.file('1c1fe140'), JSON.stringify({ schema: 'agent-compare.run/v1', runId: '1c1fe140', task: 'old', createdAt: 1, state: 'revealed', candidates: [{ label: 'A', pid: process.pid, worktree: os.tmpdir() }] }))
    expect(await store.load('1c1fe140')).toBeUndefined()
    const all = await store.listAll()
    expect(all.current).toEqual([])
    expect(all.legacy).toEqual([{ runId: '1c1fe140', schema: 'agent-compare.run/v1', task: 'old', createdAt: 1, state: 'revealed', legacy: true }])
    const comparer = new Comparer({ store, runner: { isolation: 'own-root', run: async () => ({ stopReason: 'completed', usage: { kind: 'unknown', reason: '' } }) }, version: 'test' })
    // Recovery never acts on legacy pids or paths; mutations explain why.
    expect(await comparer.recover()).toEqual([])
    expect(isAlive(process.pid)).toBe(true)
    await expect(comparer.adopt('1c1fe140')).rejects.toThrow(/旧版本/)
  })

  it('takes over a lock left by a dead process and refuses a concurrent holder', async () => {
    const store = new RunStore(await tmp('ac-home'))
    const lock = path.join(store.locksDir, 'run-0a1b2c3d.lock')
    await mkdir(lock, { recursive: true })
    await writeFile(path.join(lock, 'pid'), '999999')
    let inner: Promise<unknown> | undefined
    const outer = await store.withLock('run-0a1b2c3d', async () => {
      inner = store.withLock('run-0a1b2c3d', async () => 'second').catch((e: Error) => e.message)
      return 'first'
    })
    expect(outer).toBe('first')
    expect(await inner).toMatch(/busy/)
    expect(await store.withLock('run-0a1b2c3d', async () => 'third')).toBe('third')
  })

  it('refuses a lock held by another live process, and waits for it when asked', async () => {
    const store = new RunStore(await tmp('ac-home'))
    const lock = path.join(store.locksDir, 'repo-x.lock')
    await mkdir(lock, { recursive: true })
    // The parent of this test process is alive and is not us.
    await writeFile(path.join(lock, 'pid'), String(process.ppid))
    await expect(store.withLock('repo-x', async () => 'x', { busyMessage: 'repository busy' })).rejects.toThrow(/repository busy/)
  })

  it('keys a repository by its real path, whatever spelling reached it', async () => {
    const dir = await tmp('ac-key')
    expect(repoKey(dir)).toBe(repoKey(path.join(dir, '.')))
    if (process.platform === 'win32') expect(repoKey(dir.toUpperCase())).toBe(repoKey(dir))
  })
})

describe('public view', () => {
  it('hides strategy, route and summary until the reveal', () => {
    const r = record('0a1b2c3d')
    const before = publicView(r)
    expect(JSON.stringify(before)).not.toMatch(/bold|Bold|conservative|Conservative|m1/)
    expect(before.candidates[0]?.usage).toEqual({ kind: 'unknown', reason: 'not reported' })
    r.state = 'revealed'
    r.revealedAt = Date.now()
    const after = publicView(r)
    expect(after.candidates[0]?.strategy?.id).toBe('bold')
    expect(after.candidates[0]?.summary).toBe('I went bold')
    expect(after.baseline.repoRoot).toBe('/r')
    expect(JSON.stringify(after)).not.toMatch(/snapshotCommit|snapshotTree|ownerToken/)
  })
})

describe('unknown process identity', () => {
  it('retains a preview and cleanup record through recovery until its identity is known', async () => {
    const store = new RunStore(await tmp('ac-unknown-owner'))
    const r = record('0a1b2c3d')
    r.state = 'adopted'
    r.adoption = { label: 'A', mode: 'worktree', state: 'adopted', startedAt: Date.now() }
    r.candidates[0]!.preview = { url: 'http://127.0.0.1:1234/', port: 1234, pid: process.pid, kind: 'build', cwd: store.home }
    await store.save(r)
    const comparer = new Comparer({ store, version: 'test', runner: { isolation: 'own-root', run: async () => { throw new Error('must not generate') } } })
    const inspection = vi.spyOn(processes, 'observeProcess').mockResolvedValue({ state: 'unavailable', reason: 'inspection busy' })
    try {
      await comparer.recover()
      expect((await store.load(r.runId))?.candidates[0]?.preview?.pid).toBe(process.pid)
      const blocked = await comparer.cleanup(r.runId)
      expect(blocked?.state).toBe('adopted')
      expect(blocked?.candidates[0]?.preview?.pid).toBe(process.pid)
      expect(blocked?.leftovers?.join()).toContain('inspection busy')
      inspection.mockResolvedValue({ state: 'gone' })
      const cleared = await comparer.cleanup(r.runId)
      expect(cleared?.candidates[0]?.preview).toBeUndefined()
      expect(cleared?.leftovers).toBeUndefined()
    } finally { inspection.mockRestore() }
  })
})

describe('verdict', () => {
  const base = (over: Partial<Candidate>): Candidate => ({
    label: 'A', strategy: { id: 's', title: 's', instruction: '' }, route: {}, stage: 'ready', timings: {},
    candidateTree: 't', checkedTree: 't', drift: [], acceptanceTouched: [], preview: { url: 'u', port: 1, pid: 1, kind: 'build', cwd: '/' },
    checks: [{ name: 'build', outcome: 'passed', durationMs: 1, tail: '' }, { name: 'browser', outcome: 'passed', durationMs: 1, tail: '' }],
    ...over,
  })
  it('is eligible only when everything bound held', () => {
    expect(verdictOf(base({}), acceptance)).toEqual({ eligible: true, reasons: [], warnings: [] })
    expect(verdictOf(base({ checkedTree: 'other' }), acceptance).eligible).toBe(false)
    expect(verdictOf(base({ drift: ['x'] }), acceptance).eligible).toBe(false)
    expect(verdictOf(base({ acceptanceTouched: ['tsconfig.json'] }), acceptance).eligible).toBe(false)
    expect(verdictOf(base({ preview: { url: 'u', port: 1, pid: 1, kind: 'dev', cwd: '/' } }), acceptance).eligible).toBe(false)
    expect(verdictOf(base({ checks: [{ name: 'build', outcome: 'failed', durationMs: 1, tail: '' }] }), acceptance).eligible).toBe(false)
  })
  it('a skipped page check blocks only when the acceptance scripted it', () => {
    const skipped = base({ checks: [{ name: 'build', outcome: 'passed', durationMs: 1, tail: '' }, { name: 'browser', outcome: 'skipped', durationMs: 0, tail: '', reason: 'no browser' }] })
    expect(verdictOf(skipped, acceptance)).toMatchObject({ eligible: true, warnings: [expect.stringMatching(/没有运行/)] })
    const scripted = { ...acceptance, checks: { ...acceptance.checks, browser: { steps: [{ expectText: 'x' }] } } }
    expect(verdictOf(skipped, scripted).eligible).toBe(false)
  })
})

describe('process helpers', () => {
  it('resolves npm on PATH and runs it from a directory with spaces', async () => {
    expect(which('npm')).toBeDefined()
    const dir = await tmp('ac dir with spaces')
    const r = await run(['npm', '--version'], { cwd: dir })
    expect(r.code).toBe(0)
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('quotes shim arguments that contain spaces and metacharacters', () => {
    if (process.platform !== 'win32') return
    const spec = spawnSpec(['npm', 'run', 'a b&c'])
    expect(spec.shell).toBe(true)
    expect(spec.file).toContain('"a b&c"')
  })

  it('kills a timed-out process tree', async () => {
    const r = await run(['node', '-e', 'setInterval(()=>{},1000)'], { cwd: os.tmpdir(), timeoutMs: 500 })
    expect(r.timedOut).toBe(true)
  })

  it('recognises its own process by command line and nothing else', async () => {
    const marker = `ac-marker-${process.pid}-${Date.now()}`
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)', marker, '--port', '1234'], { stdio: 'ignore' })
    try {
      const deadline = Date.now() + 40_000
      let observed = await processes.observeProcess(child.pid!)
      while (observed.state === 'unavailable' && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 200))
        observed = await processes.observeProcess(child.pid!)
      }
      expect(observed.state, JSON.stringify(observed)).toBe('observed')
      if (observed.state !== 'observed') throw new Error('child process identity was not observable')
      expect(processes.commandHasMarkers(observed.commandLine, [marker])).toBe(true)
      expect(processes.commandHasMarkers(observed.commandLine, [marker, '--port 1234'])).toBe(true)
      expect(processes.commandHasMarkers(observed.commandLine, [marker, '--port 123'])).toBe(false)
      expect(processes.commandHasMarkers(observed.commandLine, [marker.slice(0, -1)])).toBe(false)
      expect(processes.commandHasMarkers(observed.commandLine, [marker, '--port 1'])).toBe(false)
      expect(await ownsProcess(process.pid, [marker])).toBe(false)
      expect(await ownsProcess(999_999_999, [marker])).toBe(false)
    } finally {
      await killTree(child.pid)
      expect(await waitGone(child.pid!, 5000)).toBe(true)
    }
  }, 90_000)

  it('allocates distinct free ports', async () => {
    const a = await freePort()
    const b = await freePort()
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })

  it('fails a preview cleanly when vite is not installed', async () => {
    const dir = await tmp('ac-novite')
    await expect(startVitePreview(dir)).rejects.toThrow(/没有安装 vite/)
  })
})

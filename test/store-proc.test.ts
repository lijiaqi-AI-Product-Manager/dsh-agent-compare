import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { RunStore } from '../src/core/run-store.ts'
import { run, spawnSpec, which } from '../src/core/proc.ts'
import { freePort, startVitePreview } from '../src/core/preview.ts'
import { publicView } from '../src/core/orchestrator.ts'
import { RUN_SCHEMA, type RunRecord } from '../src/core/types.ts'

function record(runId: string): RunRecord {
  return {
    schema: RUN_SCHEMA,
    producer: { name: 'dsh-agent-compare', version: 'test' },
    runId,
    createdAt: Date.now(),
    task: 't',
    baseline: { repoRoot: '/r', headCommit: 'a'.repeat(40), snapshotCommit: 'b'.repeat(40), snapshotTree: 'c'.repeat(40), dirty: false },
    checks: { commands: [] },
    checksSha256: 'x',
    mode: 'same-model',
    state: 'judging',
    candidates: [
      { label: 'A', strategy: { id: 'bold', title: 'Bold', instruction: '' }, route: {}, stage: 'ready', timings: {}, summary: 'I went bold', usage: { kind: 'unknown', reason: 'not reported' } },
      { label: 'B', strategy: { id: 'conservative', title: 'Conservative', instruction: '' }, route: {}, stage: 'failed', timings: {} },
    ],
    updatedAt: Date.now(),
  }
}

describe('run store', () => {
  it('round-trips records atomically and rejects ids that are not run ids', async () => {
    const store = new RunStore(await mkdtemp(path.join(os.tmpdir(), 'ac-home ')))
    await store.save(record('0a1b2c3d'))
    expect((await store.load('0a1b2c3d'))?.task).toBe('t')
    expect(await store.load('../../etc')).toBeUndefined()
    expect((await store.list()).map((r) => r.runId)).toEqual(['0a1b2c3d'])
  })

  it('takes over a lock left by a dead process and refuses a concurrent holder', async () => {
    const store = new RunStore(await mkdtemp(path.join(os.tmpdir(), 'ac-home ')))
    const lock = path.join(store.runsDir, '0a1b2c3d.lock')
    await mkdir(lock, { recursive: true })
    await writeFile(path.join(lock, 'pid'), '999999')
    let inner: Promise<unknown> | undefined
    const outer = await store.withLock('0a1b2c3d', async () => {
      inner = store.withLock('0a1b2c3d', async () => 'second').catch((e: Error) => e.message)
      return 'first'
    })
    expect(outer).toBe('first')
    expect(await inner).toMatch(/busy/)
    // Released afterwards.
    expect(await store.withLock('0a1b2c3d', async () => 'third')).toBe('third')
  })

  it('refuses a lock held by another live process', async () => {
    const store = new RunStore(await mkdtemp(path.join(os.tmpdir(), 'ac-home ')))
    const lock = path.join(store.runsDir, '0a1b2c3d.lock')
    await mkdir(lock, { recursive: true })
    // The parent of this test process is alive and is not us.
    await writeFile(path.join(lock, 'pid'), String(process.ppid))
    await expect(store.withLock('0a1b2c3d', async () => 'x')).rejects.toThrow(/locked by process/)
  })
})

describe('public view', () => {
  it('hides strategy, route and summary until the reveal', () => {
    const r = record('0a1b2c3d')
    const before = publicView(r)
    expect(JSON.stringify(before)).not.toMatch(/bold|Bold|conservative|Conservative/)
    expect(before.candidates[0]?.usage).toEqual({ kind: 'unknown', reason: 'not reported' })
    r.state = 'revealed'
    const after = publicView(r)
    expect(after.candidates[0]?.strategy?.id).toBe('bold')
    expect(after.candidates[0]?.summary).toBe('I went bold')
  })
})

describe('process helpers', () => {
  it('resolves npm on PATH and runs it from a directory with spaces', async () => {
    expect(which('npm')).toBeDefined()
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ac dir with spaces '))
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

  it('allocates distinct free ports', async () => {
    const a = await freePort()
    const b = await freePort()
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(0)
  })

  it('fails a preview cleanly when vite is not installed', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'ac-novite '))
    await expect(startVitePreview(dir)).rejects.toThrow(/vite is not installed/)
  })
})

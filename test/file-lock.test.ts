import { describe, expect, it } from 'vitest'
import { fork } from 'node:child_process'
import { mkdir, readFile, stat, symlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { RunStore, BusyError } from '../src/core/run-store.ts'
import { tmp } from './fixture.ts'

function worker(home: string, key: string, action?: string) {
  const child = fork(fileURLToPath(new URL('./lock-worker.mjs', import.meta.url)), [home, key, ...(action ? [action] : [])], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true })
  const messages: Array<{ state: string; message?: string }> = []
  const closed = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve) })
  const first = new Promise<{ state: string; message?: string }>((resolve, reject) => {
    child.once('error', reject)
    child.on('message', value => { const message = value as { state: string }; messages.push(message); resolve(message) })
    child.once('close', code => { if (!messages.length) reject(new Error(`lock worker exited before readiness (${code})`)) })
  })
  return { child, first, closed }
}

describe('OS-backed file leases', () => {
  it('keeps the same boundary through directory aliases and Windows path casing', async () => {
    const home = await tmp('ac-lease-real'), alias = path.join(await tmp('ac-lease-alias'), 'linked')
    await symlink(home, alias, process.platform === 'win32' ? 'junction' : 'dir')
    const lease = await new RunStore(home).acquireLock('alias')
    try {
      await expect(new RunStore(alias).acquireLock('alias')).rejects.toBeInstanceOf(BusyError)
      if (process.platform === 'win32') await expect(new RunStore(home.toUpperCase()).acquireLock('alias')).rejects.toBeInstanceOf(BusyError)
    } finally { lease.release() }
    const transferred = await new RunStore(alias).acquireLock('alias'); transferred.release()
  })

  it('excludes independent connections in one process and waits without blocking the event loop', async () => {
    const home = await tmp('ac-file-lease'), a = new RunStore(home), b = new RunStore(home)
    const lease = await a.acquireLock('same')
    try {
      await expect(b.acquireLock('same', { busyMessage: 'held elsewhere' })).rejects.toThrow('held elsewhere')
      let entered = false
      const waiting = b.withLock('same', async () => { entered = true; return 17 }, { waitMs: 1000 })
      await new Promise(resolve => setTimeout(resolve, 70))
      expect(entered).toBe(false)
      lease.release()
      expect(await waiting).toBe(17)
      const again = await a.acquireLock('same'); again.release(); again.release()
    } finally { lease.release() }
  })

  it('releases after process termination without deleting the stable guard file', async () => {
    const home = await tmp('ac-crashed-lease'), store = new RunStore(home), held = worker(home, 'owner')
    try {
      expect(await held.first).toEqual({ state: 'held' })
      const file = path.join(store.locksDir, 'owner.sqlite'), before = await stat(file, { bigint: true })
      await expect(store.acquireLock('owner')).rejects.toBeInstanceOf(BusyError)
      held.child.kill('SIGKILL'); await held.closed
      const recovered = await store.acquireLock('owner')
      try { const after = await stat(file, { bigint: true }); expect(after.ino).toBe(before.ino); expect(after.dev).toBe(before.dev) }
      finally { recovered.release() }
    } finally { if (held.child.exitCode === null) held.child.kill('SIGKILL'); await held.closed }
  }, 60000)

  it('serializes independent processes under sustained contention', async () => {
    const home = await tmp('ac-lock-contenders')
    await writeFile(path.join(home, 'counter.txt'), '0')
    const workers = Array.from({ length: 4 }, () => worker(home, 'counter', 'increment'))
    try {
      expect(await Promise.all(workers.map(w => w.first))).toEqual(Array.from({ length: 4 }, () => ({ state: 'done' })))
      expect(await Promise.all(workers.map(w => w.closed))).toEqual([0, 0, 0, 0])
      expect(await readFile(path.join(home, 'counter.txt'), 'utf8')).toBe('32')
    } finally { for (const w of workers) if (w.child.exitCode === null) w.child.kill('SIGKILL'); await Promise.all(workers.map(w => w.closed)) }
  }, 60000)

  it('refuses damaged guards, directories and old PID locks without replacing them', async () => {
    const store = new RunStore(await tmp('ac-invalid-guard'))
    await mkdir(store.locksDir, { recursive: true })
    const file = path.join(store.locksDir, 'damaged.sqlite')
    await writeFile(file, 'preserve damaged guard')
    await expect(store.acquireLock('damaged')).rejects.toThrow()
    expect(await readFile(file, 'utf8')).toBe('preserve damaged guard')
    await mkdir(path.join(store.locksDir, 'directory.sqlite'))
    await expect(store.acquireLock('directory')).rejects.toThrow('普通文件')
    const old = path.join(store.locksDir, 'old.lock'); await mkdir(old)
    await writeFile(path.join(old, 'pid'), '999999999')
    await expect(store.acquireLock('old')).rejects.toBeInstanceOf(BusyError)
    expect(await readFile(path.join(old, 'pid'), 'utf8')).toBe('999999999')
    await expect(store.acquireLock('valid', { waitMs: -1 })).rejects.toThrow('invalid lock wait')
  })
})

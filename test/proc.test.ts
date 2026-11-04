import { afterEach, describe, expect, it, vi } from 'vitest'
import * as children from 'node:child_process'
import path from 'node:path'
import { commandHasMarkers, isAlive, observeProcess, ProcessStopError, run, waitGone } from '../src/core/proc.ts'

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})
const actualSpawn = (await vi.importActual<typeof import('node:child_process')>('node:child_process')).spawn
afterEach(() => { vi.mocked(children.spawn).mockReset().mockImplementation(actualSpawn); vi.restoreAllMocks() })

describe('process termination', () => {
  it('matches complete process markers across Windows and POSIX command lines', () => {
    const windows = '"C:\\Program Files\\node.exe" "C:\\Project Space\\vite.js" --port 1234 --strictPort'
    expect(commandHasMarkers(windows, ['C:/Project Space/vite.js', '--port 1234'], true)).toBe(true)
    for (const marker of ['--port 123', 'C:/Project Space/vite', '--port 12345', '']) expect(commandHasMarkers(windows, [marker], true)).toBe(false)
    expect(commandHasMarkers('/usr/bin/node /Project/vite.js --port 1234', ['/Project/vite.js', '--port 1234'], false)).toBe(true)
    expect(commandHasMarkers('/usr/bin/node /Project/vite.js --port 1234', ['/project/vite.js'], false)).toBe(false)
    expect(commandHasMarkers('node /Project/vite.js.backup --port 1234', ['/Project/vite.js'], false)).toBe(false)
    expect(commandHasMarkers(windows, [], true)).toBe(false)
  })
  it('bounds cancellation even when the command ignores a graceful stop', async () => {
    const script = "process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000)"
    const started = Date.now()
    const result = await run(['node', '-e', script], { cwd: process.cwd(), timeoutMs: 1000 })
    expect(result.stdout).toContain('ready')
    expect(result.timedOut).toBe(true)
    expect(result.aborted).toBe(false)
    expect(Date.now() - started).toBeLessThan(8000)
  }, 12_000)

  it('aborts an owned command and confirms its exit', async () => {
    const controller = new AbortController()
    const pending = run(['node', '-e', 'console.log(process.pid);setInterval(()=>{},1000)'], { cwd: process.cwd(), signal: controller.signal })
    const timer = setTimeout(() => controller.abort(), 500)
    try {
      const result = await pending
      expect(result.aborted).toBe(true)
      expect(result.timedOut).toBe(false)
      const pid = Number(result.stdout.trim())
      expect(pid).toBeGreaterThan(0)
      expect(await waitGone(pid)).toBe(true)
    } finally { clearTimeout(timer) }
  }, 12_000)

  it.skipIf(process.platform !== 'win32')('bounds an unresponsive tree-stop helper, stops its own handles and reports the uncertain tree', async () => {
    const spawn = actualSpawn, owned: children.ChildProcess[] = []
    vi.mocked(children.spawn).mockImplementation(((file: string, args: string[], options: children.SpawnOptions) => {
      const child = file === 'taskkill'
        ? spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], options)
        : spawn(file, args, options)
      owned.push(child)
      return child
    }) as typeof children.spawn)
    const started = Date.now()
    try {
      await expect(run(['node', '-e', 'setInterval(()=>{},1000)'], { cwd: process.cwd(), timeoutMs: 300 })).rejects.toBeInstanceOf(ProcessStopError)
      expect(Date.now() - started).toBeLessThan(7000)
      expect(owned).toHaveLength(2)
      for (const child of owned) expect(await waitGone(child.pid!)).toBe(true)
    } finally { for (const child of owned) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') }
  }, 15_000)

  it.skipIf(process.platform !== 'win32')('reports unavailable inspection when both system helpers hang and leaves the observed target alive', async () => {
    const spawn = actualSpawn, helpers: children.ChildProcess[] = []
    const target = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore', windowsHide: true })
    vi.mocked(children.spawn).mockImplementation(((file: string, args: string[], options: children.SpawnOptions) => {
      if (path.basename(file).toLowerCase() === 'powershell.exe' || file === 'taskkill') {
        const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], options)
        helpers.push(child)
        return child
      }
      return spawn(file, args, options)
    }) as typeof children.spawn)
    const started = Date.now()
    try {
      expect(await observeProcess(target.pid!, 300)).toMatchObject({ state: 'unavailable' })
      expect(Date.now() - started).toBeLessThan(7000)
      expect(isAlive(target.pid!)).toBe(true)
      expect(helpers).toHaveLength(2)
      for (const child of helpers) expect(await waitGone(child.pid!)).toBe(true)
    } finally {
      target.kill('SIGKILL')
      for (const child of helpers) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await waitGone(target.pid!)
    }
  }, 15_000)
})

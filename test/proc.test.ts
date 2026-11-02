import { describe, expect, it } from 'vitest'
import { commandHasMarkers, run } from '../src/core/proc.ts'

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
})

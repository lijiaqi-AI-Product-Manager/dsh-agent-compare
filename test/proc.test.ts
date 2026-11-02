import { describe, expect, it } from 'vitest'
import { run } from '../src/core/proc.ts'

describe('process termination', () => {
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

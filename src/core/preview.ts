import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import path from 'node:path'
import type { ChildProcess } from 'node:child_process'
import { killTree, startLongRunning, Tail } from './proc.ts'

/** Ask the OS for a free loopback port. The caller still uses --strictPort, so a race fails loudly. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      srv.close(() => (addr && typeof addr === 'object' ? resolve(addr.port) : reject(new Error('no port'))))
    })
  })
}

export interface Preview {
  readonly url: string
  readonly port: number
  readonly pid: number
  readonly log: Tail
  stop(): Promise<void>
}

export class PreviewError extends Error {
  constructor(message: string, readonly log: string) {
    super(message)
    this.name = 'PreviewError'
  }
}

async function httpReady(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, { signal, redirect: 'manual' })
    await res.body?.cancel()
    return res.status < 500
  } catch {
    return false
  }
}

/**
 * Start the candidate's own Vite dev server on a dedicated loopback port and
 * return only after the URL answers HTTP. The Vite binary is run with the host
 * Node directly, so the recorded pid is the server itself, not a shim.
 */
export async function startVitePreview(dir: string, opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<Preview> {
  const viteBin = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) throw new PreviewError('vite is not installed in the candidate worktree', '')
  const timeoutMs = opts.timeoutMs ?? 60_000
  let lastError: PreviewError | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}/`
    const child = startLongRunning(['node', viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: dir,
      env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1' },
    })
    const log = new Tail(6000)
    child.stdout?.setEncoding('utf8').on('data', (d: string) => log.push(d))
    child.stderr?.setEncoding('utf8').on('data', (d: string) => log.push(d))
    const outcome = await waitReady(child, url, timeoutMs, opts.signal)
    if (outcome === 'ready' && child.pid !== undefined) {
      const pid = child.pid
      return { url, port, pid, log, stop: () => killTree(pid) }
    }
    await killTree(child.pid)
    lastError = new PreviewError(outcome === 'exited' ? 'dev server exited before it answered' : outcome === 'aborted' ? 'cancelled' : `dev server did not answer within ${timeoutMs} ms`, log.toString())
    if (outcome === 'aborted') break
    // A port taken between probe and bind shows up as an early exit; retry with a new port.
    if (outcome !== 'exited' || !/port .* (in use|already)/i.test(log.toString())) break
  }
  throw lastError ?? new PreviewError('dev server failed', '')
}

function waitReady(child: ChildProcess, url: string, timeoutMs: number, signal?: AbortSignal): Promise<'ready' | 'exited' | 'timeout' | 'aborted'> {
  return new Promise((resolve) => {
    let done = false
    const ctl = new AbortController()
    const finish = (r: 'ready' | 'exited' | 'timeout' | 'aborted'): void => {
      if (done) return
      done = true
      ctl.abort()
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      resolve(r)
    }
    const onAbort = (): void => finish('aborted')
    signal?.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    child.once('exit', () => finish('exited'))
    const poll = async (): Promise<void> => {
      while (!done) {
        if (await httpReady(url, ctl.signal)) return finish('ready')
        await new Promise((r) => setTimeout(r, 300))
      }
    }
    void poll()
  })
}

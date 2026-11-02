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
 * Serve a copy on a dedicated loopback port and return only after it answers
 * HTTP. `build` serves the output of the build the checks just ran (`vite
 * preview`), so what the user tries is the artifact that passed; `dev` runs the
 * dev server and is used only when there is no build to serve. The Vite binary
 * runs on the host Node directly, so the pid is the server itself, not a shim.
 */
export async function startVitePreview(dir: string, opts: { kind?: 'build' | 'dev'; timeoutMs?: number; signal?: AbortSignal } = {}): Promise<Preview> {
  const viteBin = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteBin)) throw new PreviewError('副本里没有安装 vite', '')
  const kind = opts.kind ?? 'build'
  const timeoutMs = opts.timeoutMs ?? 60_000
  let lastError: PreviewError | undefined
  for (let attempt = 0; attempt < 3; attempt++) {
    const port = await freePort()
    const root = `http://127.0.0.1:${port}/`
    const args = kind === 'build' ? ['preview'] : []
    const child = startLongRunning(['node', viteBin, ...args, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: dir,
      env: { ...process.env, BROWSER: 'none', FORCE_COLOR: '0', NO_COLOR: '1' },
    })
    const log = new Tail(6000)
    child.stdout?.setEncoding('utf8').on('data', (d: string) => log.push(d))
    child.stderr?.setEncoding('utf8').on('data', (d: string) => log.push(d))
    const outcome = await waitReady(child, root, timeoutMs, opts.signal)
    if (outcome === 'ready' && child.pid !== undefined) {
      const pid = child.pid
      // A configured `base` moves the app below the root; Vite prints the real entry URL.
      const printed = new RegExp(`http://127\\.0\\.0\\.1:${port}/[^\\s]*`).exec(log.toString())?.[0]
      return { url: printed ?? root, port, pid, log, stop: () => killTree(pid) }
    }
    await killTree(child.pid)
    lastError = new PreviewError(outcome === 'exited' ? '预览服务在响应前退出' : outcome === 'aborted' ? 'cancelled' : `预览服务 ${Math.round(timeoutMs / 1000)} 秒内没有响应`, log.toString())
    if (outcome === 'aborted') break
    // A port taken between probe and bind shows up as an early exit; retry with a new port.
    if (outcome !== 'exited' || !/port .* (in use|already)/i.test(log.toString())) break
  }
  throw lastError ?? new PreviewError('预览服务启动失败', '')
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

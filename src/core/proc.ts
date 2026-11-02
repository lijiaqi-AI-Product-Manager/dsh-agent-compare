import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const isWin = process.platform === 'win32'

/** Keep at most `max` trailing characters of a growing log. */
export class Tail {
  private buf = ''
  constructor(private readonly max = 4000) {}
  push(chunk: string): void {
    this.buf += chunk
    if (this.buf.length > this.max * 2) this.buf = this.buf.slice(-this.max)
  }
  toString(): string {
    return this.buf.length > this.max ? this.buf.slice(-this.max) : this.buf
  }
}

export interface RunResult {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
  readonly aborted: boolean
  /** True when output exceeded `maxOutput` and was cut; callers needing exact output must fail. */
  readonly truncated: boolean
}

export interface RunOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
  readonly input?: string
  readonly timeoutMs?: number
  readonly signal?: AbortSignal
  /** Cap on captured stdout/stderr each (bytes of text). */
  readonly maxOutput?: number
}

/**
 * Resolve an executable on PATH. On Windows this honours PATHEXT, so `npm`
 * resolves to `npm.cmd`. Returns undefined when nothing matches.
 */
export function which(command: string, envPath = process.env.PATH ?? process.env.Path ?? ''): string | undefined {
  if (path.isAbsolute(command)) return existsSync(command) ? command : undefined
  const exts = isWin ? (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : ['']
  for (const dir of envPath.split(path.delimiter)) {
    if (dir === '') continue
    for (const ext of isWin && path.extname(command) === '' ? exts : ['']) {
      const candidate = path.join(dir.replace(/^"|"$/g, ''), command + ext.toLowerCase())
      if (existsSync(candidate)) return candidate
      const upper = path.join(dir.replace(/^"|"$/g, ''), command + ext)
      if (existsSync(upper)) return upper
    }
  }
  return undefined
}

/** Quote one argument for cmd.exe. Only used for `.cmd`/`.bat` shims. */
function quoteCmdArg(arg: string): string {
  if (arg === '') return '""'
  if (!/[\s"&|<>^%!()]/.test(arg)) return arg
  return `"${arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1').replace(/%/g, '%%')}"`
}

export interface SpawnSpec {
  readonly file: string
  readonly args: readonly string[]
  readonly shell: boolean
}

/**
 * Build a spawn spec that works for real executables and Windows `.cmd` shims.
 * Node refuses to spawn `.cmd` files without a shell (CVE-2024-27980), so shims
 * go through cmd.exe with every argument quoted.
 */
export function spawnSpec(argv: readonly string[]): SpawnSpec {
  const [cmd, ...rest] = argv
  if (cmd === undefined) throw new Error('empty argv')
  const resolved = cmd === 'node' ? process.execPath : (which(cmd) ?? cmd)
  if (isWin && /\.(cmd|bat)$/i.test(resolved)) {
    return { file: [resolved, ...rest].map(quoteCmdArg).join(' '), args: [], shell: true }
  }
  return { file: resolved, args: rest, shell: false }
}

/** Run a command to completion, capturing bounded output. Never throws on non-zero exit. */
export function run(argv: readonly string[], opts: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    let spec: SpawnSpec
    try {
      spec = spawnSpec(argv)
    } catch (error) {
      reject(error)
      return
    }
    const max = opts.maxOutput ?? 1_000_000
    const child = spawn(spec.file, spec.args, {
      cwd: opts.cwd,
      env: opts.env ?? process.env,
      shell: spec.shell,
      windowsHide: true,
      detached: !isWin,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let aborted = false
    let truncated = false
    child.stdout?.setEncoding('utf8').on('data', (d: string) => {
      if (stdout.length + d.length <= max) stdout += d
      else truncated = true
    })
    child.stderr?.setEncoding('utf8').on('data', (d: string) => {
      if (stderr.length + d.length <= max) stderr += d
      else stderr = (stderr + d).slice(-max)
    })
    if (opts.input !== undefined) child.stdin?.end(opts.input)
    else child.stdin?.end()
    const timer = opts.timeoutMs === undefined ? undefined : setTimeout(() => {
      timedOut = true
      void killTree(child.pid)
    }, opts.timeoutMs)
    const onAbort = (): void => {
      aborted = true
      void killTree(child.pid)
    }
    opts.signal?.addEventListener('abort', onAbort, { once: true })
    if (opts.signal?.aborted) onAbort()
    child.on('error', (error) => {
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      reject(error)
    })
    child.on('close', (code) => {
      if (timer) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
      resolve({ code, stdout, stderr, timedOut, aborted, truncated })
    })
  })
}

/** Run and throw with a bounded message unless the exit code is 0. */
export async function runOk(argv: readonly string[], opts: RunOptions): Promise<string> {
  const r = await run(argv, opts)
  if (r.code !== 0) {
    const detail = (r.stderr || r.stdout).trim().slice(-1500)
    throw new Error(`${argv.slice(0, 3).join(' ')} exited ${r.code ?? (r.timedOut ? 'timeout' : 'signal')}: ${detail}`)
  }
  if (r.truncated) throw new Error(`${argv.slice(0, 3).join(' ')} produced more than ${opts.maxOutput ?? 1_000_000} characters of output`)
  return r.stdout
}

/**
 * Terminate a process and all of its descendants. On Windows `taskkill /T`
 * walks the tree (shims spawn grandchildren); elsewhere children were started
 * in their own process group, so the group is signalled.
 */
export async function killTree(pid: number | undefined): Promise<void> {
  if (pid === undefined) return
  if (isWin) {
    await new Promise<void>((resolve) => {
      const k = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
      k.on('close', () => resolve())
      k.on('error', () => resolve())
    })
    return
  }
  let target = -pid
  try { process.kill(target, 'SIGTERM') } catch {
    target = pid
    try { process.kill(target, 'SIGTERM') } catch { return }
  }
  // Commands can ignore TERM. Bound the grace period, then terminate
  // the original process group so cancellation cannot wait forever on its pipes.
  const until = Date.now() + 500
  while (Date.now() < until) {
    try { process.kill(target, 0) } catch { return }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  try {
    process.kill(target, 'SIGKILL')
  } catch {
    // The original process or group has already gone.
  }
}

/** True when a pid currently names a live process. */
export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The command line of a live process, or undefined when it is gone or cannot be read. */
export async function processCommandLine(pid: number): Promise<string | undefined> {
  if (!Number.isInteger(pid) || pid <= 0 || !isAlive(pid)) return undefined
  const argv = isWin
    ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`]
    : ['ps', '-o', 'args=', '-p', String(pid)]
  try {
    const r = await run(argv, { cwd: process.cwd(), timeoutMs: 15_000 })
    const line = r.stdout.trim()
    return r.code === 0 && line !== '' ? line : undefined
  } catch {
    return undefined
  }
}

/**
 * True only when `pid` is alive AND its command line names every marker (for
 * a preview: the copy's vite binary path and its port). A recycled pid that now
 * belongs to something else fails this, so it is never killed.
 */
export async function ownsProcess(pid: number, markers: readonly string[]): Promise<boolean> {
  const line = await processCommandLine(pid)
  if (line === undefined) return false
  const norm = (s: string): string => (isWin ? s.replace(/\//g, '\\').toLowerCase() : s)
  const command = norm(line)
  return markers.length > 0 && markers.every((m) => {
    const marker = norm(m)
    if (!marker) return false
    let at = command.indexOf(marker)
    while (at >= 0) {
      const end = at + marker.length
      if ((at === 0 || /[\s"']/.test(command[at - 1]!)) && (end === command.length || /[\s"']/.test(command[end]!))) return true
      at = command.indexOf(marker, at + 1)
    }
    return false
  })
}

/** Wait until `pid` has exited; false when it is still alive after `timeoutMs`. */
export async function waitGone(pid: number, timeoutMs = 5000): Promise<boolean> {
  const until = Date.now() + timeoutMs
  while (isAlive(pid)) {
    if (Date.now() > until) return false
    await new Promise((r) => setTimeout(r, 100))
  }
  return true
}

/** Start a long-running process with streaming output. The caller owns its lifetime. */
export function startLongRunning(argv: readonly string[], opts: { cwd: string; env?: NodeJS.ProcessEnv }): ChildProcess {
  const spec = spawnSpec(argv)
  return spawn(spec.file, spec.args, {
    cwd: opts.cwd,
    env: opts.env ?? process.env,
    shell: spec.shell,
    windowsHide: true,
    detached: !isWin,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

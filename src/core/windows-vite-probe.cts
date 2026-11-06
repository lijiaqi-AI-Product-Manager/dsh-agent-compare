/**
 * The Windows host cannot create piped stdio inside a confined grandchild.
 * Vite's optional `net use` path probe needs only its callback output. Keep
 * that probe confined, using inherited temporary-file handles for capture.
 * Other commands and non-Vite entry points retain their normal behaviour.
 */
import cp = require('node:child_process')
import fs = require('node:fs')
import os = require('node:os')
import path = require('node:path')
import moduleApi = require('node:module')

function isViteEntry(file: string | undefined): boolean {
  return typeof file === 'string' && /[\\/]vite[\\/]bin[\\/]vite\.js$/i.test(file)
}

function captureNetworkDrives(
  options: cp.ExecOptions,
  callback: (error: cp.ExecException | null, stdout: string | Buffer, stderr: string | Buffer) => void,
): cp.ChildProcess {
  reportCompatibility()
  const encoding = options.encoding === 'buffer' ? 'buffer' : options.encoding ?? 'utf8'
  if (encoding !== 'buffer' && !Buffer.isEncoding(encoding)) throw new TypeError('invalid network-drive probe output encoding')
  if (options.maxBuffer !== undefined && (!Number.isFinite(options.maxBuffer) || options.maxBuffer < 0)) throw new RangeError('invalid network-drive probe output limit')
  const max = Math.min(options.maxBuffer ?? 1_048_576, 4_194_304)
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-compare-net-use-'))
  const outFile = path.join(directory, 'stdout'), errFile = path.join(directory, 'stderr')
  let out: number | undefined, err: number | undefined
  const executable = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'net.exe')
  let child: cp.ChildProcess
  try {
    out = fs.openSync(outFile, 'wx'); err = fs.openSync(errFile, 'wx')
    child = cp.spawn(executable, ['use'], {
      cwd: options.cwd,
      env: options.env,
      windowsHide: true,
      stdio: ['ignore', out, err],
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    })
  } catch (error) {
    if (out !== undefined) fs.closeSync(out)
    if (err !== undefined) fs.closeSync(err)
    fs.rmSync(directory, { recursive: true, force: true })
    throw error
  }
  fs.closeSync(out); fs.closeSync(err)
  const read = (file: string): string | Buffer => {
    const fd = fs.openSync(file, 'r')
    try {
      const buffer = Buffer.alloc(Math.min(fs.fstatSync(fd).size, max))
      fs.readSync(fd, buffer)
      return encoding === 'buffer' ? buffer : buffer.toString(encoding as BufferEncoding)
    } finally { fs.closeSync(fd) }
  }
  let settled = false
  const finish = (error: cp.ExecException | null): void => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    let stdout: string | Buffer = '', stderr: string | Buffer = ''
    try {
      stdout = read(outFile); stderr = read(errFile)
      if (!error && (fs.statSync(outFile).size > max || fs.statSync(errFile).size > max)) error = Object.assign(new Error('network-drive probe output exceeded its limit'), { cmd: 'net use', code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' })
    } catch (cause) { error ??= Object.assign(cause as Error, { cmd: 'net use' }) }
    try { callback(error, stdout, stderr) }
    finally { fs.rmSync(directory, { recursive: true, force: true }) }
  }
  let failure: cp.ExecException | undefined
  const timer = setTimeout(() => { failure = Object.assign(new Error('network-drive probe timed out'), { cmd: 'net use', killed: true }); child.kill() }, Math.min(options.timeout || 5000, 30_000))
  child.once('error', (error) => { failure = Object.assign(error, { cmd: 'net use' }) })
  child.once('close', (code, signal) => finish(failure ?? (code === 0 ? null : Object.assign(new Error(`network-drive probe exited ${code ?? signal}`), { cmd: 'net use', code: code ?? undefined, ...(signal ? { signal } : {}) }))))
  return child
}

function installViteProbeCompatibility(): () => void {
  const original = cp.exec
  const wrapped = (function (command: string, options: cp.ExecOptions | ((...args: any[]) => void), callback?: (...args: any[]) => void) {
    const cb = typeof options === 'function' ? options : callback
    if (command.trim().toLowerCase() === 'net use' && cb !== undefined) {
      try { return captureNetworkDrives(typeof options === 'function' ? {} : options, cb) }
      catch (cause) {
        // Vite treats an unavailable optional probe as a normal fallback. Keep
        // that error visible through its callback, including synchronous denials.
        const failed = new cp.ChildProcess()
        const error = Object.assign(cause as Error, { cmd: 'net use' })
        failed.on('error', () => {})
        queueMicrotask(() => { try { failed.emit('error', error); cb(error, '', '') } finally { failed.emit('close', null, null) } })
        return failed
      }
    }
    return Reflect.apply(original, cp, Array.prototype.slice.call(arguments))
  }) as typeof cp.exec
  // Preserve custom symbols used by callers of other exec commands.
  for (const key of Reflect.ownKeys(original)) if (typeof key === 'symbol') Object.defineProperty(wrapped, key, Object.getOwnPropertyDescriptor(original, key)!)
  cp.exec = wrapped
  moduleApi.syncBuiltinESMExports()
  return () => { if (cp.exec === wrapped) { cp.exec = original; moduleApi.syncBuiltinESMExports() } }
}

let reported = false
function reportCompatibility(): void {
  if (reported || process.env.AGENT_COMPARE_WINDOWS_PIPE_COMPAT !== '1') return
  reported = true
  try { fs.writeSync(2, '\n[agent-compare/windows-compat] vite-net-use\n') } catch { /* Diagnostics never change the command result. */ }
}

if (process.platform === 'win32' && process.env.AGENT_COMPARE_WINDOWS_PIPE_COMPAT === '1' && isViteEntry(process.argv[1])) installViteProbeCompatibility()

export = { isViteEntry, captureNetworkDrives, installViteProbeCompatibility }

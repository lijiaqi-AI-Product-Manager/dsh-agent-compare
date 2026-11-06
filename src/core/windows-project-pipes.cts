/** Windows esbuild compatibility using anonymous pipes under the current token. */
import cp = require('node:child_process')
import fs = require('node:fs')
import os = require('node:os')
import path = require('node:path')
import streams = require('node:stream')
import moduleApi = require('node:module')

const reported = new Set<string>()
function reportCompatibility(hook: 'esbuild-service' | 'esbuild-version'): void {
  if (reported.has(hook) || process.env.AGENT_COMPARE_WINDOWS_PIPE_COMPAT !== '1') return
  reported.add(hook)
  try { fs.writeSync(2, `\n[agent-compare/windows-compat] ${hook}\n`) } catch { /* Diagnostics never change the command result. */ }
}

function isEsbuildService(file: string, args: readonly string[]): boolean {
  return /(?:^|[\\/])esbuild(?:\.exe)?$/i.test(file) && args.some(arg => /^--service=\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(arg))
}

function isEsbuildVersion(file: string, args: readonly string[]): boolean {
  return args.at(-1) === '--version' && (
    /(?:^|[\\/])esbuild(?:\.exe)?$/i.test(file) ||
    (/[\\/]esbuild[\\/]install\.js$/i.test(process.argv[1] ?? '') && args.length <= 2)
  )
}

function quoteWindowsArg(arg: string): string {
  if (arg && !/[\s"]/u.test(arg)) return arg
  return '"' + arg.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/g, '$1$1') + '"'
}

function captureSync(file: string, args: readonly string[], options: cp.ExecFileSyncOptions = {}): Buffer | string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-compare-esbuild-'))
  const opened: number[] = []
  try {
    const outPath = path.join(dir, 'stdout'), errPath = path.join(dir, 'stderr')
    const out = fs.openSync(outPath, 'wx'); opened.push(out)
    const err = fs.openSync(errPath, 'wx'); opened.push(err)
    let input: number | 'ignore' = 'ignore'
    if (options.input !== undefined) {
      const inputPath = path.join(dir, 'stdin')
      fs.writeFileSync(inputPath, options.input)
      input = fs.openSync(inputPath, 'r'); opened.push(input)
    }
    const { input: _input, ...rest } = options
    const result = cp.spawnSync(file, args, { ...rest, stdio: [input, out, err] })
    const limit = options.maxBuffer ?? 1_048_576
    const read = (name: string): Buffer => {
      const fd = fs.openSync(name, 'r')
      try { const bytes = Buffer.alloc(Math.min(fs.fstatSync(fd).size, limit)); fs.readSync(fd, bytes); return bytes }
      finally { fs.closeSync(fd) }
    }
    const stdout = read(outPath), stderr = read(errPath)
    const decode = (bytes: Buffer): Buffer | string => options.encoding && options.encoding !== 'buffer' ? bytes.toString(options.encoding) : bytes
    const oversized = fs.statSync(outPath).size > limit || fs.statSync(errPath).size > limit
    if (result.error || result.status !== 0 || oversized) {
      throw Object.assign(result.error ?? new Error(oversized ? 'esbuild output exceeded maxBuffer' : `Command failed: ${file}\n${stderr}`), {
        status: result.status, signal: result.signal, pid: result.pid,
        output: [null, decode(stdout), decode(stderr)], stdout: decode(stdout), stderr: decode(stderr),
        ...(oversized ? { code: 'ENOBUFS' } : {}),
      })
    }
    return decode(stdout)
  } finally {
    for (const fd of opened) fs.closeSync(fd)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

interface NativeProcessApi {
  createPipe(read: Buffer, write: Buffer, attributes: Buffer | null, size: number): number
  getCurrentProcess(): bigint
  openProcessToken(process: bigint, access: number, token: Buffer): number
  getTokenInformation(token: bigint, kind: number, information: Buffer | null, size: number, needed: Buffer): number
  getLengthSid(sid: bigint): number
  copySid(size: number, destination: Buffer, source: bigint): number
  convertSecurityDescriptor(sddl: string, revision: number, result: Buffer, size: null): number
  localFree(pointer: bigint): bigint | null
  closeHandle(handle: bigint): number
  getLastError(): number
  setHandleInformation(handle: bigint, mask: number, flags: number): number
  createProcessW(application: string, command: string, processAttributes: null, threadAttributes: null, inherit: number, flags: number, environment: Buffer, cwd: string, startup: Buffer, info: Buffer): number
  peekNamedPipe(handle: bigint, buffer: null, size: number, read: null, available: Buffer, left: null): number
  readFile(handle: bigint, buffer: Buffer, size: number, count: Buffer, overlapped: null): number
  writeFile: { async(handle: bigint, buffer: Buffer, size: number, count: Buffer, overlapped: null, callback: (error: Error | null, ok: number) => void): void }
  terminateProcess(handle: bigint, status: number): number
  waitForSingleObject(handle: bigint, timeout: number): number
  getExitCodeProcess(handle: bigint, code: Buffer): number
}
let loadedBindings: NativeProcessApi | undefined
/** The host's public native API; every child inherits this already-confined token. */
function nativeBindings(): NativeProcessApi {
  if (loadedBindings) return loadedBindings
  const native = require(process.env.AGENT_COMPARE_WIN32_PROCESS_MODULE ?? '@deepseek-ai/dsh-win32-process') as {
    extendWin32ProcessBindings(create: (context: { kernel32: unknown; advapi32: unknown; bind(library: unknown, name: string, result: string, args: string[]): unknown }) => object): NativeProcessApi
  }
  return loadedBindings = native.extendWin32ProcessBindings(({ kernel32, advapi32, bind }) => ({
    writeFile: bind(kernel32, 'WriteFile', 'int', ['void *', 'void *', 'uint32', 'void *', 'void *']),
    getCurrentProcess: bind(kernel32, 'GetCurrentProcess', 'void *', []),
    openProcessToken: bind(advapi32, 'OpenProcessToken', 'int', ['void *', 'uint32', 'void *']),
    getTokenInformation: bind(advapi32, 'GetTokenInformation', 'int', ['void *', 'uint32', 'void *', 'uint32', 'void *']),
    getLengthSid: bind(advapi32, 'GetLengthSid', 'uint32', ['void *']),
    copySid: bind(advapi32, 'CopySid', 'int', ['uint32', 'void *', 'void *']),
    convertSecurityDescriptor: bind(advapi32, 'ConvertStringSecurityDescriptorToSecurityDescriptorW', 'int', ['str16', 'uint32', 'void *', 'void *']),
    localFree: bind(kernel32, 'LocalFree', 'void *', ['void *']),
  }))
}

function logonSidString(bytes: Buffer): string {
  if (bytes.length < 8 || bytes[0] !== 1 || bytes.length !== 8 + bytes[1]! * 4) throw new Error('invalid process logon SID')
  let authority = 0n
  for (const byte of bytes.subarray(2, 8)) authority = (authority << 8n) | BigInt(byte)
  const parts = Array.from({ length: bytes[1]! }, (_, i) => bytes.readUInt32LE(8 + i * 4))
  const sid = `S-1-${authority}-${parts.join('-')}`
  if (!/^S-1-5-5-\d+-\d+$/.test(sid)) throw new Error('process has no supported private logon SID')
  return sid
}

/** Scope new pipe handles to this logon; do not change the process token or filesystem ACLs. */
function privatePipeSecurity(api: NativeProcessApi): { attributes: Buffer; dispose(): void } {
  const tokenSlot = Buffer.alloc(8)
  if (!api.openProcessToken(api.getCurrentProcess(), 8, tokenSlot)) throw new Error(`esbuild token query failed: ${api.getLastError()}`)
  const token = tokenSlot.readBigUInt64LE()
  let descriptor: bigint | undefined
  try {
    const needed = Buffer.alloc(4)
    api.getTokenInformation(token, 28, null, 0, needed)
    const size = needed.readUInt32LE()
    if (size < 24 || size > 65536) throw new Error('esbuild token logon information is unavailable')
    const info = Buffer.alloc(size)
    if (!api.getTokenInformation(token, 28, info, size, needed) || info.readUInt32LE() !== 1) throw new Error(`esbuild logon query failed: ${api.getLastError()}`)
    const sid = info.readBigUInt64LE(8), sidSize = api.getLengthSid(sid)
    if (sidSize < 8 || sidSize > 68) throw new Error('esbuild logon SID length is invalid')
    const bytes = Buffer.alloc(sidSize)
    // Keep the token-information buffer alive until its embedded SID is copied.
    if (!api.copySid(sidSize, bytes, sid) || info.readUInt32LE() !== 1) throw new Error(`esbuild logon SID copy failed: ${api.getLastError()}`)
    const sddl = `D:P(A;;GA;;;${logonSidString(bytes)})S:(ML;;NW;;;LW)`
    const result = Buffer.alloc(8)
    if (!api.convertSecurityDescriptor(sddl, 1, result, null)) throw new Error(`esbuild pipe security failed: ${api.getLastError()}`)
    descriptor = result.readBigUInt64LE()
    if (!descriptor) throw new Error('esbuild pipe security descriptor is missing')
    const attributes = Buffer.alloc(24)
    attributes.writeUInt32LE(24, 0); attributes.writeBigUInt64LE(descriptor, 8)
    return { attributes, dispose: () => { if (descriptor !== undefined) { api.localFree(descriptor); descriptor = undefined } } }
  } catch (error) {
    if (descriptor !== undefined) api.localFree(descriptor)
    throw error
  } finally { api.closeHandle(token) }
}

function spawnEsbuildService(file: string, args: readonly string[], options: cp.SpawnOptions = {}): cp.ChildProcess {
  const api = nativeBindings(), owned = new Set<bigint>()
  const security = privatePipeSecurity(api)
  const close = (handle: bigint): void => { if (owned.delete(handle)) api.closeHandle(handle) }
  const pair = (): { read: bigint; write: bigint } => {
    const read = Buffer.alloc(8), write = Buffer.alloc(8)
    if (!api.createPipe(read, write, security.attributes, 0)) throw new Error(`esbuild CreatePipe failed: ${api.getLastError()}`)
    const result = { read: read.readBigUInt64LE(), write: write.readBigUInt64LE() }
    owned.add(result.read); owned.add(result.write)
    return result
  }
  let handle: bigint | undefined, timer: NodeJS.Timeout | undefined
  try {
    const input = pair(), output = pair(), error = pair()
    security.dispose()
    for (const h of [input.read, output.write, error.write]) {
      if (!api.setHandleInformation(h, 1, 1)) throw new Error(`esbuild handle inheritance failed: ${api.getLastError()}`)
    }
    const start = Buffer.alloc(104), info = Buffer.alloc(24)
    start.writeUInt32LE(104, 0); start.writeUInt32LE(0x100, 60)
    start.writeBigUInt64LE(input.read, 80); start.writeBigUInt64LE(output.write, 88); start.writeBigUInt64LE(error.write, 96)
    const environment = Object.entries(options.env ?? process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
      .sort(([a], [b]) => a.toUpperCase().localeCompare(b.toUpperCase())).map(([k, v]) => `${k}=${v}`).join('\0')
    const commandLine = [file, ...args].map(quoteWindowsArg).join(' ')
    if (!api.createProcessW(file, commandLine, null, null, 1, 0x400, Buffer.from(environment + '\0\0', 'utf16le'), String(options.cwd ?? process.cwd()), start, info)) {
      throw new Error(`esbuild CreateProcessW failed: ${api.getLastError()}`)
    }
    handle = info.readBigUInt64LE(0); owned.add(handle)
    api.closeHandle(info.readBigUInt64LE(8))
    close(input.read); close(output.write); close(error.write)
    const child = new cp.ChildProcess()
    const out = new streams.PassThrough(), err = new streams.PassThrough()
    let exited = false, finished = false, signal: NodeJS.Signals | null = null
    let writePending = false, destroyInput = false
    const stdin = new streams.Writable({
      write(chunk, _encoding, done) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        let offset = 0
        writePending = true
        const next = (): void => {
          if (destroyInput) { writePending = false; close(input.write); done(new Error('esbuild stdin closed')); return }
          if (offset === bytes.length) { writePending = false; done(); return }
          const count = Buffer.alloc(4), part = bytes.subarray(offset, Math.min(offset + 65536, bytes.length))
          api.writeFile.async(input.write, part, part.length, count, null, (error: Error | null, ok: number) => {
            if (error || !ok || count.readUInt32LE() === 0) {
              writePending = false; close(input.write); done(error ?? new Error('esbuild stdin write failed')); return
            }
            offset += count.readUInt32LE(); next()
          })
        }
        next()
      },
      final(done) { close(input.write); done() },
      destroy(error, done) { destroyInput = true; if (!writePending) close(input.write); done(error) },
    })
    Object.assign(child, { pid: info.readUInt32LE(16), spawnfile: file, spawnargs: [file, ...args], stdin, stdout: out, stderr: options.stdio?.[2] === 'inherit' ? null : err,
      stdio: [stdin, out, options.stdio?.[2] === 'inherit' ? null : err] })
    if (options.stdio?.[2] === 'inherit') err.pipe(process.stderr, { end: false })
    const drain = (h: bigint, target: streams.PassThrough): boolean => {
      if (!owned.has(h)) return true
      const available = Buffer.alloc(4)
      if (!api.peekNamedPipe(h, null, 0, null, available, null)) {
        const code = api.getLastError()
        if (code !== 109 && code !== 232) throw new Error(`esbuild pipe read failed: ${code}`)
        close(h); target.end(); return true
      }
      let pending = available.readUInt32LE()
      while (pending > 0 && !target.writableNeedDrain) {
        const buffer = Buffer.alloc(Math.min(pending, 65536)), count = Buffer.alloc(4)
        if (!api.readFile(h, buffer, buffer.length, count, null)) throw new Error(`esbuild ReadFile failed: ${api.getLastError()}`)
        const size = count.readUInt32LE()
        if (!size) break
        target.write(buffer.subarray(0, size)); pending -= size
      }
      return false
    }
    const dispose = (): void => {
      if (finished) return
      finished = true
      clearInterval(timer)
      options.signal?.removeEventListener('abort', abort)
      stdin.destroy()
      for (const h of [...owned]) { if (h !== input.write || !writePending) close(h) }
      out.end(); err.end()
      child.emit('close', child.exitCode, signal)
    }
    const terminate = (requested: NodeJS.Signals = 'SIGTERM'): boolean => {
      if (exited || handle === undefined || !owned.has(handle)) return false
      const ok = !!api.terminateProcess(handle, 1)
      if (ok) { signal = requested; Object.assign(child, { killed: true }) }
      return ok
    }
    const abort = (): void => { terminate(); child.emit('error', Object.assign(new Error('The operation was aborted'), { name: 'AbortError', code: 'ABORT_ERR' })) }
    child.kill = ((requested?: NodeJS.Signals | number) => terminate(typeof requested === 'string' ? requested : 'SIGTERM')) as typeof child.kill
    child.ref = () => { timer?.ref(); return child }
    child.unref = () => { timer?.unref(); return child }
    timer = setInterval(() => {
      try {
        const outDone = drain(output.read, out), errDone = drain(error.read, err)
        const wait = exited ? 0 : api.waitForSingleObject(handle!, 0)
        if (wait === 0xffffffff) throw new Error(`esbuild process wait failed: ${api.getLastError()}`)
        if (!exited && wait === 0) {
          const exit = Buffer.alloc(4)
          if (!api.getExitCodeProcess(handle!, exit)) throw new Error(`esbuild process status failed: ${api.getLastError()}`)
          exited = true; close(handle!)
          Object.assign(child, { exitCode: signal ? null : exit.readUInt32LE(), signalCode: signal })
          child.emit('exit', child.exitCode, signal)
        }
        if (exited && outDone && errDone) dispose()
      } catch (error) { terminate(); try { child.emit('error', error) } finally { dispose() } }
    }, 2)
    options.signal?.addEventListener('abort', abort, { once: true })
    queueMicrotask(() => { child.emit('spawn'); if (options.signal?.aborted) abort() })
    return child
  } catch (error) {
    security.dispose()
    clearInterval(timer)
    if (handle !== undefined && owned.has(handle)) api.terminateProcess(handle, 1)
    for (const h of [...owned]) close(h)
    throw error
  }
}

function installEsbuildCompatibility(): () => void {
  const spawn = cp.spawn, execFileSync = cp.execFileSync
  const wrappedSpawn = (function (file: string, args: readonly string[], options?: cp.SpawnOptions) {
    if (Array.isArray(args) && isEsbuildService(file, args) && !options?.shell && !options?.detached && options?.timeout === undefined && options?.argv0 === undefined && !options?.windowsVerbatimArguments && Array.isArray(options?.stdio) && options.stdio.length === 3 && options.stdio[0] === 'pipe' && options.stdio[1] === 'pipe' && (options.stdio[2] === 'inherit' || options.stdio[2] === 'pipe')) {
      reportCompatibility('esbuild-service')
      return spawnEsbuildService(file, args, options)
    }
    return Reflect.apply(spawn, cp, Array.prototype.slice.call(arguments))
  }) as typeof cp.spawn
  const wrappedExecFileSync = (function (file: string, args: readonly string[], options?: cp.ExecFileSyncOptions) {
    if (Array.isArray(args) && (isEsbuildVersion(file, args) || isEsbuildService(file, args)) && (!options?.stdio || options.stdio === 'pipe')) {
      reportCompatibility(isEsbuildVersion(file, args) ? 'esbuild-version' : 'esbuild-service')
      return captureSync(file, args, options)
    }
    return Reflect.apply(execFileSync, cp, Array.prototype.slice.call(arguments))
  }) as typeof cp.execFileSync
  cp.spawn = wrappedSpawn; cp.execFileSync = wrappedExecFileSync
  moduleApi.syncBuiltinESMExports()
  return () => {
    if (cp.spawn === wrappedSpawn) cp.spawn = spawn
    if (cp.execFileSync === wrappedExecFileSync) cp.execFileSync = execFileSync
    moduleApi.syncBuiltinESMExports()
  }
}

if (process.platform === 'win32' && process.env.AGENT_COMPARE_WINDOWS_PIPE_COMPAT === '1') installEsbuildCompatibility()
export = { isEsbuildService, isEsbuildVersion, quoteWindowsArg, logonSidString, captureSync, spawnEsbuildService, installEsbuildCompatibility }

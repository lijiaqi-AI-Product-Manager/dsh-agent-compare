import { link, lstat, mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAlive } from './proc.ts'
import { LEGACY_SCHEMAS, RUN_SCHEMA, type RunRecord } from './types.ts'
import { assertRunRecord, isRunId, MAX_RECORD_BYTES, RecordValidationError } from './record-validation.ts'

/** Short root: Windows paths stay well under MAX_PATH even inside deep copies. */
export function defaultHome(): string {
  return process.env.AGENT_COMPARE_HOME ?? path.join(os.homedir(), '.dsh', 'agent-compare')
}

export function newRunId(): string {
  return randomBytes(4).toString('hex')
}

/** Read-only history: an older format or an entry that cannot safely be loaded. */
export interface LegacySummary {
  readonly runId: string
  readonly schema: string
  readonly task: string
  readonly createdAt: number
  readonly state: string
  readonly legacy: true
  readonly unavailable?: true
  readonly reason?: string
}

type Entry = { kind: 'missing' } | { kind: 'current'; record: RunRecord } | { kind: 'legacy' | 'unavailable'; summary: LegacySummary }

export class RecordUnavailableError extends Error {
  constructor(runId: string, reason: string) {
    super(`记录 ${runId} 无法安全载入：${reason}。原始记录未被覆盖，请查看历史记录中的说明。`)
    this.name = 'RecordUnavailableError'
  }
}

export class StaleRecordError extends Error {
  constructor(runId: string) {
    super(`run ${runId} was changed by another operation; reload and try again`)
    this.name = 'StaleRecordError'
  }
}

export class BusyError extends Error {
  constructor(what: string) {
    super(what)
    this.name = 'BusyError'
  }
}

/** Stable key for "the same repository", whatever spelling or symlink reached it. */
export function repoKey(repo: string): string {
  let real = repo
  try { real = realpathSync.native(repo) } catch { /* keep as given */ }
  if (process.platform === 'win32') real = real.toLowerCase()
  return createHash('sha256').update(path.resolve(real)).digest('hex').slice(0, 16)
}

export class RunStore {
  readonly runsDir: string
  readonly worktreesDir: string
  readonly artifactsDir: string
  readonly locksDir: string
  readonly examplesDir: string
  readonly home: string

  constructor(home: string = defaultHome()) {
    this.home = home = path.resolve(home)
    this.runsDir = path.join(home, 'runs')
    this.worktreesDir = path.join(home, 'w')
    this.artifactsDir = path.join(home, 'a')
    this.locksDir = path.join(home, 'locks')
    this.examplesDir = path.join(home, 'examples')
  }

  file(runId: string): string {
    requireRunId(runId)
    return path.join(this.runsDir, `${runId}.json`)
  }

  artifacts(runId: string): string {
    requireRunId(runId)
    return path.join(this.artifactsDir, runId)
  }

  /** Where `own-root` copies of one run live. */
  copies(runId: string): string {
    requireRunId(runId)
    return path.join(this.worktreesDir, runId)
  }

  /**
   * Atomically write `record`, refusing when the stored copy has moved on
   * since `record` was read (another process or a concurrent operation saved
   * in between). On success `record.rev` is the new revision.
   */
  async save(record: RunRecord): Promise<void> {
    if (!record || typeof record !== 'object') throw new RecordValidationError('record')
    assertRunRecord(record, record.runId, true)
    if (record.rev === Number.MAX_SAFE_INTEGER) throw new RecordValidationError('rev（已达上限）')
    await this.withLock(`save-${record.runId}`, async () => {
      const stored = await this.readEntry(record.runId)
      if (record.rev === 0) {
        if (stored.kind !== 'missing') throw new StaleRecordError(record.runId)
      } else {
        if (stored.kind === 'unavailable') throw new RecordUnavailableError(record.runId, stored.summary.reason!)
        if (stored.kind !== 'current' || stored.record.rev !== record.rev) throw new StaleRecordError(record.runId)
      }
      const next = { ...record, rev: record.rev + 1, updatedAt: Date.now() }
      const serialized = JSON.stringify(next, null, 2)
      if (Buffer.byteLength(serialized, 'utf8') > MAX_RECORD_BYTES) throw new RecordValidationError('记录超过 16 MiB')
      // Validate the bytes to be published, including custom serialization.
      assertRunRecord(JSON.parse(serialized), record.runId)
      await mkdir(this.runsDir, { recursive: true })
      const target = this.file(record.runId)
      const tmp = `${target}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
      const handle = await open(tmp, 'wx')
      try {
        try { await handle.writeFile(serialized, 'utf8'); await handle.sync() } finally { await handle.close() }
        if (record.rev === 0) {
          // A complete, NEW filename; never replace an existing record.
          try { await link(tmp, target) }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new StaleRecordError(record.runId)
            throw error
          }
        } else await renameWithRetry(tmp, target)
      } finally { await rm(tmp, { force: true }).catch(() => {}) }
      record.rev = next.rev
      record.updatedAt = next.updatedAt
    }, { waitMs: 5_000 })
  }

  private async readEntry(runId: string, retries = 2): Promise<Entry> {
    if (!isRunId(runId)) return { kind: 'missing' }
    let raw: unknown
    try {
      const file = this.file(runId), before = await lstat(file)
      if (!before.isFile() || before.isSymbolicLink()) return unavailable(runId, '记录不是普通文件')
      const handle = await open(file, 'r')
      let contents: string
      try {
        const observed = await handle.stat()
        if (observed.ino !== before.ino || observed.dev !== before.dev) return retries > 0 ? this.readEntry(runId, retries - 1) : unavailable(runId, '读取期间记录发生变化，请重试')
        if (observed.size > MAX_RECORD_BYTES) return unavailable(runId, '记录超过 16 MiB 读取上限')
        const chunks: Buffer[] = []
        let size = 0
        for (;;) {
          const chunk = Buffer.allocUnsafe(65536)
          const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
          if (!bytesRead) break
          size += bytesRead
          if (size > MAX_RECORD_BYTES) return unavailable(runId, '记录超过 16 MiB 读取上限')
          chunks.push(chunk.subarray(0, bytesRead))
        }
        const after = await handle.stat()
        if (after.size !== observed.size || after.mtimeMs !== observed.mtimeMs || after.ctimeMs !== observed.ctimeMs) return retries > 0 ? this.readEntry(runId, retries - 1) : unavailable(runId, '读取期间记录发生变化，请重试')
        try { contents = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)) }
        catch { return unavailable(runId, '记录不是有效的 UTF-8 文本') }
      } finally { await handle.close() }
      try { raw = JSON.parse(contents) } catch { return unavailable(runId, 'JSON 内容不完整或格式错误') }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') return { kind: 'missing' }
      return unavailable(runId, `记录读取失败（${code ?? '未知错误'}）`)
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unavailable(runId, '记录内容必须是对象')
    const object = raw as Record<string, unknown>
    if (object.schema === RUN_SCHEMA) {
      try { assertRunRecord(raw, runId); return { kind: 'current', record: raw } }
      catch (error) { return unavailable(runId, error instanceof RecordValidationError ? error.message : '记录结构无法校验', object) }
    }
    if (typeof object.schema === 'string' && LEGACY_SCHEMAS.includes(object.schema)) {
      if (object.runId !== runId) return unavailable(runId, '记录编号与文件名不一致', object)
      return { kind: 'legacy', summary: legacySummary(object, runId) }
    }
    return unavailable(runId, '当前版本不支持此记录格式', object)
  }

  async load(runId: string): Promise<RunRecord | undefined> {
    const entry = await this.readEntry(runId)
    if (entry.kind === 'unavailable') throw new RecordUnavailableError(runId, entry.summary.reason!)
    return entry.kind === 'current' ? entry.record : undefined
  }

  async loadLegacy(runId: string): Promise<LegacySummary | undefined> {
    const entry = await this.readEntry(runId)
    return entry.kind === 'legacy' ? entry.summary : undefined
  }

  /** Current records, newest first. */
  async list(): Promise<RunRecord[]> {
    return (await this.listAll()).current
  }

  async listAll(): Promise<{ current: RunRecord[]; legacy: LegacySummary[] }> {
    let names: string[] = []
    try { names = await readdir(this.runsDir) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { current: [], legacy: [] }
      throw new Error(`无法读取比较记录目录（${(error as NodeJS.ErrnoException).code ?? '未知错误'}）`)
    }
    const current: RunRecord[] = []
    const legacy: LegacySummary[] = []
    for (const n of names) {
      if (!/^[0-9a-f]{8}\.json$/.test(n)) continue
      const entry = await this.readEntry(n.slice(0, -5))
      if (entry.kind === 'current') current.push(entry.record)
      else if (entry.kind === 'legacy' || entry.kind === 'unavailable') legacy.push(entry.summary)
    }
    return { current: current.sort((a, b) => b.createdAt - a.createdAt), legacy: legacy.sort((a, b) => b.createdAt - a.createdAt) }
  }

  /**
   * Cross-process lock on `key` (`run-<id>`, `repo-<key>`). A lock whose owner
   * process is gone is taken over. With `waitMs` a held lock is waited for;
   * without it a held lock throws BusyError at once.
   */
  async withLock<T>(key: string, fn: () => Promise<T>, opts: { waitMs?: number; busyMessage?: string } = {}): Promise<T> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(key)) throw new Error('invalid lock identifier')
    const until = Date.now() + (opts.waitMs ?? 0)
    for (;;) {
      if (!this.held.has(key) && (await this.tryAcquire(key))) break
      if (Date.now() >= until) throw new BusyError(opts.busyMessage ?? `${key} is busy (another operation is in progress)`)
      await new Promise((r) => setTimeout(r, 40))
    }
    try {
      return await fn()
    } finally {
      this.held.delete(key)
      await rm(path.join(this.locksDir, `${key}.lock`), { recursive: true, force: true })
    }
  }

  private readonly held = new Set<string>()

  private async tryAcquire(key: string): Promise<boolean> {
    const dir = path.join(this.locksDir, `${key}.lock`)
    await mkdir(this.locksDir, { recursive: true })
    try {
      await mkdir(dir)
    } catch {
      const owner = Number((await readFile(path.join(dir, 'pid'), 'utf8').catch(() => '')).trim())
      if (!Number.isFinite(owner) || owner <= 0) {
        // No pid yet: the owner is between mkdir and writeFile, or died right there.
        const age = Date.now() - ((await stat(dir).catch(() => undefined))?.mtimeMs ?? Date.now())
        if (age < 10_000) return false
      } else if (owner === process.pid || isAlive(owner)) return false
      await rm(dir, { recursive: true, force: true })
      try { await mkdir(dir) } catch { return false }
    }
    this.held.add(key)
    await writeFile(path.join(dir, 'pid'), String(process.pid))
    return true
  }
}

function requireRunId(value: string): void { if (!isRunId(value)) throw new RecordValidationError('runId') }

function legacySummary(raw: Record<string, unknown>, runId: string): LegacySummary {
  return {
    runId,
    schema: typeof raw.schema === 'string' ? raw.schema.slice(0, 128) : 'unknown',
    task: typeof raw.task === 'string' ? raw.task.slice(0, 1000) : '无法载入的比较记录',
    createdAt: typeof raw.createdAt === 'number' && Number.isSafeInteger(raw.createdAt) && raw.createdAt >= 0 ? raw.createdAt : 0,
    state: typeof raw.state === 'string' ? raw.state.slice(0, 100) : 'unknown',
    legacy: true,
  }
}

function unavailable(runId: string, reason: string, raw: Record<string, unknown> = {}): Entry {
  return { kind: 'unavailable', summary: { ...legacySummary(raw, runId), state: 'unavailable', unavailable: true, reason } }
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  // Windows refuses to replace a file another process has open for a moment (AV, indexers).
  for (let i = 0; ; i++) {
    try {
      await rename(from, to)
      return
    } catch (error) {
      if (i >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
      await new Promise((r) => setTimeout(r, 50 * (i + 1)))
    }
  }
}

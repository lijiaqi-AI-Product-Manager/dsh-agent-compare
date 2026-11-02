import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import { realpathSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isAlive } from './proc.ts'
import { LEGACY_SCHEMAS, RUN_SCHEMA, type RunRecord } from './types.ts'

/** Short root: Windows paths stay well under MAX_PATH even inside deep copies. */
export function defaultHome(): string {
  return process.env.AGENT_COMPARE_HOME ?? path.join(os.homedir(), '.dsh', 'agent-compare')
}

export function newRunId(): string {
  return randomBytes(4).toString('hex')
}

/** A record written by an older version: shown as history, never acted on. */
export interface LegacySummary {
  readonly runId: string
  readonly schema: string
  readonly task: string
  readonly createdAt: number
  readonly state: string
  readonly legacy: true
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

  constructor(readonly home: string = defaultHome()) {
    this.runsDir = path.join(home, 'runs')
    this.worktreesDir = path.join(home, 'w')
    this.artifactsDir = path.join(home, 'a')
    this.locksDir = path.join(home, 'locks')
    this.examplesDir = path.join(home, 'examples')
  }

  file(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`)
  }

  artifacts(runId: string): string {
    return path.join(this.artifactsDir, runId)
  }

  /** Where `own-root` copies of one run live. */
  copies(runId: string): string {
    return path.join(this.worktreesDir, runId)
  }

  /**
   * Atomically write `record`, refusing when the stored copy has moved on
   * since `record` was read (another process or a concurrent operation saved
   * in between). On success `record.rev` is the new revision.
   */
  async save(record: RunRecord): Promise<void> {
    await this.withLock(`save-${record.runId}`, async () => {
      const stored = await this.readRaw(record.runId)
      const storedRev = typeof stored?.rev === 'number' ? stored.rev : 0
      if (stored !== undefined && storedRev !== record.rev) throw new StaleRecordError(record.runId)
      const next = { ...record, rev: record.rev + 1, updatedAt: Date.now() }
      await mkdir(this.runsDir, { recursive: true })
      const target = this.file(record.runId)
      const tmp = `${target}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`
      await writeFile(tmp, JSON.stringify(next, null, 2), 'utf8')
      await renameWithRetry(tmp, target)
      record.rev = next.rev
      record.updatedAt = next.updatedAt
    }, { waitMs: 5_000 })
  }

  private async readRaw(runId: string): Promise<(Record<string, unknown> & { rev?: number; schema?: string }) | undefined> {
    if (!/^[0-9a-f]{8}$/.test(runId)) return undefined
    try {
      return JSON.parse(await readFile(this.file(runId), 'utf8')) as Record<string, unknown>
    } catch {
      return undefined
    }
  }

  async load(runId: string): Promise<RunRecord | undefined> {
    const raw = await this.readRaw(runId)
    return raw?.schema === RUN_SCHEMA ? (raw as unknown as RunRecord) : undefined
  }

  async loadLegacy(runId: string): Promise<LegacySummary | undefined> {
    const raw = await this.readRaw(runId)
    return raw !== undefined && LEGACY_SCHEMAS.includes(String(raw.schema)) ? legacySummary(raw) : undefined
  }

  /** Current records, newest first. */
  async list(): Promise<RunRecord[]> {
    return (await this.listAll()).current
  }

  async listAll(): Promise<{ current: RunRecord[]; legacy: LegacySummary[] }> {
    let names: string[] = []
    try { names = await readdir(this.runsDir) } catch { return { current: [], legacy: [] } }
    const current: RunRecord[] = []
    const legacy: LegacySummary[] = []
    for (const n of names) {
      if (!/^[0-9a-f]{8}\.json$/.test(n)) continue
      const raw = await this.readRaw(n.slice(0, -5))
      if (raw?.schema === RUN_SCHEMA) current.push(raw as unknown as RunRecord)
      else if (raw !== undefined && LEGACY_SCHEMAS.includes(String(raw.schema))) legacy.push(legacySummary(raw))
    }
    return { current: current.sort((a, b) => b.createdAt - a.createdAt), legacy: legacy.sort((a, b) => b.createdAt - a.createdAt) }
  }

  /**
   * Cross-process lock on `key` (`run-<id>`, `repo-<key>`). A lock whose owner
   * process is gone is taken over. With `waitMs` a held lock is waited for;
   * without it a held lock throws BusyError at once.
   */
  async withLock<T>(key: string, fn: () => Promise<T>, opts: { waitMs?: number; busyMessage?: string } = {}): Promise<T> {
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

function legacySummary(raw: Record<string, unknown>): LegacySummary {
  return {
    runId: String(raw.runId),
    schema: String(raw.schema),
    task: String(raw.task ?? ''),
    createdAt: Number(raw.createdAt ?? 0),
    state: String(raw.state ?? 'unknown'),
    legacy: true,
  }
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

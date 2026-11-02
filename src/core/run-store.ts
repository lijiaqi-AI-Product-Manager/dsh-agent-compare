import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import { isAlive } from './proc.ts'
import { RUN_SCHEMA, type RunRecord } from './types.ts'

/** Short root: Windows paths stay well under MAX_PATH even inside deep worktrees. */
export function defaultHome(): string {
  return process.env.AGENT_COMPARE_HOME ?? path.join(os.homedir(), '.dsh', 'agent-compare')
}

export function newRunId(): string {
  return randomBytes(4).toString('hex')
}

export class RunStore {
  readonly runsDir: string
  readonly worktreesDir: string
  readonly artifactsDir: string

  constructor(readonly home: string = defaultHome()) {
    this.runsDir = path.join(home, 'runs')
    this.worktreesDir = path.join(home, 'w')
    this.artifactsDir = path.join(home, 'a')
  }

  file(runId: string): string {
    return path.join(this.runsDir, `${runId}.json`)
  }

  artifacts(runId: string): string {
    return path.join(this.artifactsDir, runId)
  }

  async save(record: RunRecord): Promise<void> {
    record.updatedAt = Date.now()
    await mkdir(this.runsDir, { recursive: true })
    const target = this.file(record.runId)
    const tmp = `${target}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`
    await writeFile(tmp, JSON.stringify(record, null, 2), 'utf8')
    await renameWithRetry(tmp, target)
  }

  async load(runId: string): Promise<RunRecord | undefined> {
    if (!/^[0-9a-f]{8}$/.test(runId)) return undefined
    try {
      const rec = JSON.parse(await readFile(this.file(runId), 'utf8')) as RunRecord
      return rec.schema === RUN_SCHEMA ? rec : undefined
    } catch {
      return undefined
    }
  }

  async list(): Promise<RunRecord[]> {
    let names: string[] = []
    try { names = await readdir(this.runsDir) } catch { return [] }
    const out: RunRecord[] = []
    for (const n of names) {
      if (!n.endsWith('.json')) continue
      const rec = await this.load(n.slice(0, -5))
      if (rec) out.push(rec)
    }
    return out.sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Cross-process lock for one run (adoption, cleanup). A lock whose owner
   * process is gone is taken over; a live owner makes this throw.
   */
  async withLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    if (this.held.has(runId)) throw new Error(`run ${runId} is busy (another operation is in progress)`)
    this.held.add(runId)
    try {
      return await this.withFileLock(runId, fn)
    } finally {
      this.held.delete(runId)
    }
  }

  private readonly held = new Set<string>()

  private async withFileLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const dir = path.join(this.runsDir, `${runId}.lock`)
    await mkdir(this.runsDir, { recursive: true })
    try {
      await mkdir(dir)
    } catch {
      const owner = Number((await readFile(path.join(dir, 'pid'), 'utf8').catch(() => '')).trim())
      if (Number.isFinite(owner) && owner > 0 && owner !== process.pid && isAlive(owner)) {
        throw new Error(`run ${runId} is locked by process ${owner}`)
      }
      await rm(dir, { recursive: true, force: true })
      await mkdir(dir)
    }
    await writeFile(path.join(dir, 'pid'), String(process.pid))
    try {
      return await fn()
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
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

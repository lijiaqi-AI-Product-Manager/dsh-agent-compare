import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { RunStore } from '../core/run-store.ts'
import type { AgentRoute } from '../core/types.ts'

export interface AbPreferences {
  readonly enabled: boolean
  readonly mode: 'same-model' | 'cross-model'
  readonly generationMinutes: number
  readonly exampleKind?: 'quick' | 'full'
  readonly windowsProcessCompat?: 'auto' | 'off'
  readonly models: readonly [AgentRoute, AgentRoute]
  /** Main-conversation context given to both candidates. Absent means the recent default. */
  readonly contextMode?: ConversationContextMode
  /** Exchanges included by `recent`. */
  readonly contextTurns?: number
}

export type ConversationContextMode = 'none' | 'recent' | 'selected'
export const CONTEXT_TURNS = [1, 3, 6, 10] as const
export const DEFAULT_CONTEXT_TURNS = 3

/** What one submission asks to include; `selected` names log entries the user ticked. */
export interface ConversationContextRequest {
  readonly mode: ConversationContextMode
  readonly turns: number
  readonly ids?: readonly number[]
}

export function contextRequestOf(preferences: AbPreferences, ids?: readonly number[]): ConversationContextRequest {
  const saved = preferences.contextMode ?? 'recent'
  // A typed command or the model's tool call has no ticked entries: a manual selection falls back to the recent exchanges.
  const mode = saved === 'selected' && ids === undefined ? 'recent' : saved
  return { mode, turns: preferences.contextTurns ?? DEFAULT_CONTEXT_TURNS, ...(mode === 'selected' && ids ? { ids } : {}) }
}

export function defaultPreferences(minutes = 30): AbPreferences {
  return { enabled: false, mode: 'same-model', generationMinutes: minutes, models: [{}, {}] }
}

export function parsePreferences(value: unknown): AbPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('比较设置格式无效')
  const p = value as Record<string, unknown>
  if (typeof p.enabled !== 'boolean' || !['same-model', 'cross-model'].includes(String(p.mode))) throw new Error('比较方式无效')
  if (typeof p.generationMinutes !== 'number' || !Number.isFinite(p.generationMinutes) || p.generationMinutes < 5 || p.generationMinutes > 120) throw new Error('每版生成上限需要在 5 到 120 分钟之间')
  if (p.exampleKind !== undefined && p.exampleKind !== 'quick' && p.exampleKind !== 'full') throw new Error('示例类型无效')
  if (p.windowsProcessCompat !== undefined && p.windowsProcessCompat !== 'auto' && p.windowsProcessCompat !== 'off') throw new Error('Windows 进程兼容设置无效')
  if (p.contextMode !== undefined && p.contextMode !== 'none' && p.contextMode !== 'recent' && p.contextMode !== 'selected') throw new Error('主对话上下文设置无效')
  if (p.contextTurns !== undefined && !(CONTEXT_TURNS as readonly unknown[]).includes(p.contextTurns)) throw new Error('主对话上下文轮数无效')
  if (!Array.isArray(p.models) || p.models.length !== 2) throw new Error('模型设置需要两个位置')
  const models = p.models.map((value: unknown): AgentRoute => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('模型设置无效')
    const r = value as Record<string, unknown>
    if (r.provider === undefined && r.model === undefined) return {}
    if (typeof r.provider !== 'string' || !r.provider.trim() || typeof r.model !== 'string' || !r.model.trim()) throw new Error('请选择包含服务与模型的完整配置')
    return { provider: r.provider, model: r.model }
  }) as [AgentRoute, AgentRoute]
  return { enabled: p.enabled, mode: p.mode as AbPreferences['mode'], generationMinutes: p.generationMinutes, models, ...(p.exampleKind === undefined ? {} : { exampleKind: p.exampleKind as 'quick' | 'full' }), ...(p.windowsProcessCompat === undefined ? {} : { windowsProcessCompat: p.windowsProcessCompat as 'auto' | 'off' }), ...(p.contextMode === undefined ? {} : { contextMode: p.contextMode as ConversationContextMode }), ...(p.contextTurns === undefined ? {} : { contextTurns: p.contextTurns as number }) }
}

export class PreferencesStore {
  constructor(private readonly store: RunStore, private readonly defaults = defaultPreferences()) {}

  private key(sessionId: string): string { return createHash('sha256').update(sessionId).digest('hex').slice(0, 32) }
  private file(sessionId: string): string { return path.join(this.store.home, 'preferences', `${this.key(sessionId)}.json`) }

  async load(sessionId: string): Promise<AbPreferences> {
    // A navigation can overlap the previous page's final save. Use the same
    // session lock so a new view cannot restore an older optimistic setting.
    return this.store.withLock(`preferences-${this.key(sessionId)}`, () => this.read(sessionId), { waitMs: 5000 })
  }

  private async read(sessionId: string): Promise<AbPreferences> {
    let text: string
    try { text = await readFile(this.file(sessionId), 'utf8') }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return this.defaults; throw e }
    const data = JSON.parse(text) as { version?: unknown; preferences?: unknown }
    if (data.version !== 1) throw new Error('比较设置版本无效，请重置设置')
    return parsePreferences(data.preferences)
  }

  async save(sessionId: string, value: unknown): Promise<AbPreferences> {
    const preferences = parsePreferences(value)
    return this.store.withLock(`preferences-${this.key(sessionId)}`, async () => {
      const file = this.file(sessionId)
      await mkdir(path.dirname(file), { recursive: true })
      const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`
      try {
        await writeFile(temporary, JSON.stringify({ version: 1, preferences }), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        for (let attempt = 0; ; attempt++) {
          try { await rename(temporary, file); break }
          catch (error) {
            if (attempt >= 8 || !['EPERM', 'EACCES', 'EBUSY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
            await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)))
          }
        }
        return preferences
      } finally { await unlink(temporary).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }) }
    }, { waitMs: 5000 })
  }
}

/** UI submissions carry frozen settings without asking users to write flags. */
export function parseUiSubmission(raw: string): { task: string; example: boolean; preferences: AbPreferences; contextIds?: number[] } | undefined {
  const text = raw.trim()
  if (!text.startsWith('@ui ')) return undefined
  const value = JSON.parse(text.slice(4)) as Record<string, unknown>
  if (value.version !== 1 || typeof value.task !== 'string' || typeof value.example !== 'boolean') throw new Error('比较任务格式无效')
  if (value.contextIds !== undefined && (!Array.isArray(value.contextIds) || value.contextIds.length > 200 || value.contextIds.some(id => !Number.isSafeInteger(id) || (id as number) < 0))) throw new Error('所选主对话消息无效')
  return { task: value.task, example: value.example, preferences: parsePreferences(value.preferences), ...(value.contextIds === undefined ? {} : { contextIds: [...new Set(value.contextIds as number[])] }) }
}

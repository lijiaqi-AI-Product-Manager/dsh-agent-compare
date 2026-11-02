import type { RunRecord } from '../core/types.ts'
import type { LegacySummary, RunStore } from '../core/run-store.ts'

export interface HistoryMeta {
  readonly version: 1
  readonly scope: 'all' | 'session'
  readonly query: string
  readonly total: number
  readonly offset: number
  readonly limit: number
  readonly hasNext: boolean
}

export class HistoryQueryError extends Error {
  constructor(message: string) { super(message); this.name = 'HistoryQueryError' }
}

const folded = (text: string): string => text.normalize('NFKC').toLowerCase()

/** Pages retained records without changing them; inline readers default to their own session. */
export async function historyPage(store: RunStore, input: Record<string, unknown>): Promise<{ runs: RunRecord[]; legacy: LegacySummary[]; history: HistoryMeta }> {
  if (input.scope !== undefined && input.scope !== 'all' && input.scope !== 'session') throw new HistoryQueryError('记录范围必须是全部对话或当前对话')
  if (input.sessionId !== undefined && (typeof input.sessionId !== 'string' || !input.sessionId || input.sessionId.length > 500)) throw new HistoryQueryError('对话编号无效')
  const sessionId = input.sessionId as string | undefined
  const scope = input.scope ?? (sessionId ? 'session' : 'all')
  if (scope === 'session' && !sessionId) throw new HistoryQueryError('查看当前对话需要对话编号')
  if (input.search !== undefined && (typeof input.search !== 'string' || input.search.length > 200)) throw new HistoryQueryError('搜索内容不能超过 200 个字符')
  if (input.offset !== undefined && (typeof input.offset !== 'number' || !Number.isSafeInteger(input.offset) || input.offset < 0)) throw new HistoryQueryError('记录页位置无效')
  const query = (input.search as string | undefined)?.trim() ?? '', needle = folded(query), limit = 30
  const all = await store.listAll()
  const rows: Array<RunRecord | LegacySummary> = [
    ...all.current.filter(record => scope === 'all' || record.sessionId === sessionId),
    // Old schemas have no trustworthy session association.
    ...(scope === 'all' ? all.legacy : []),
  ].filter(record => !needle || folded([record.task, record.runId, ...('legacy' in record ? [] : [record.baseline.repoRoot])].join('\n')).includes(needle))
  rows.sort((a, b) => b.createdAt - a.createdAt || (a.runId === b.runId ? 0 : a.runId < b.runId ? 1 : -1))
  const lastPage = Math.floor(Math.max(0, rows.length - 1) / limit) * limit
  const offset = Math.min(input.offset as number | undefined ?? 0, lastPage)
  const page = rows.slice(offset, offset + limit)
  return {
    runs: page.filter((record): record is RunRecord => !('legacy' in record)),
    legacy: page.filter((record): record is LegacySummary => 'legacy' in record),
    history: { version: 1, scope, query, total: rows.length, offset, limit, hasNext: offset + limit < rows.length },
  }
}

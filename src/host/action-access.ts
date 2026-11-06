import type { Comparer } from '../core/orchestrator.ts'
import { HttpError } from './request.ts'

export const CONVERSATION_ACTIONS: ReadonlySet<string> = new Set(['choose', 'preflight', 'adopt', 'revert', 'recover', 'cancel', 'cancelAdoption', 'cleanup', 'releaseCopies', 'salvage', 'retryVerification', 'reopenPreview'])

type Caller = { session: { id: string; header?: { origin?: string } } } | undefined
interface DispatchOptions {
  method: string
  comparer: Pick<Comparer, 'get'>
  caller(): Promise<Caller>
  runId(): string
  confirmation: unknown
  signal?: AbortSignal
}

/** Keep endpoint dispatch and its authorization in one exercised path. */
export async function dispatchComparisonAction<T>(options: DispatchOptions, invoke: () => Promise<T>): Promise<T> {
  if (CONVERSATION_ACTIONS.has(options.method)) await authorizeComparisonAction(options.comparer, await options.caller(), options.runId(), options.confirmation, options.signal)
  return invoke()
}

/** A misspelled control route must fail during setup rather than be omitted. */
export function assertComparisonActionRoutes(api: Readonly<Record<string, unknown>>): void {
  for (const method of CONVERSATION_ACTIONS) if (!Object.hasOwn(api, method) || typeof api[method] !== 'function') throw new Error(`Comparison control route is missing: ${method}`)
}

/** Resolve the caller through the host before this check. A confirmation records
 * cross-conversation intent; it does not replace the host's access permissions. */
export async function authorizeComparisonAction(comparer: Pick<Comparer, 'get'>, caller: { session: { id: string; header?: { origin?: string } } } | undefined, runId: string, confirmation: unknown, signal?: AbortSignal): Promise<void> {
  if (!caller?.session.id || caller.session.header?.origin === 'subagent') throw new HttpError(403, '请从主对话操作这次比较。')
  signal?.throwIfAborted()
  const record = await comparer.get(runId)
  signal?.throwIfAborted()
  if (!record) throw new HttpError(404, '没有这次比较')
  if ((!record.sessionId || record.sessionId !== caller.session.id) && confirmation !== true) {
    throw new HttpError(409, '这次比较不属于当前对话。请核对项目和运行编号，再确认操作。', 'other-session-confirmation')
  }
}

import type { Comparer } from '../core/orchestrator.ts'
import type { RunRecord } from '../core/types.ts'

interface StatusCaller { readonly session: { readonly id: string; readonly header: { readonly origin?: string } } }
type StatusResult = { error: string } | { record: RunRecord; control: Awaited<ReturnType<Comparer['control']>> }

/** Status may reconcile an orphan, so delegated callers cannot use this path
 * to manage resources outside their assigned implementation. */
export async function readComparisonStatus(comparer: Comparer, caller: StatusCaller | undefined, runId?: string, signal?: AbortSignal): Promise<StatusResult> {
  if (!caller) return { error: 'Comparison status requires a main conversation.' }
  if (caller.session.header.origin === 'subagent') return { error: 'A delegated or candidate agent cannot manage comparison status.' }
  signal?.throwIfAborted()
  const id = runId ?? (await comparer.store.list()).find(r => r.sessionId === caller.session.id)?.runId
  signal?.throwIfAborted()
  const record = id === undefined ? undefined : await comparer.observe(id)
  return record === undefined ? { error: 'no such run' } : { record, control: await comparer.control(record) }
}

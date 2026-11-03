/** Status may reconcile an orphan, so delegated callers cannot use this path
 * to manage resources outside their assigned implementation. */
export async function readComparisonStatus(comparer, caller, runId, signal) {
    if (!caller)
        return { error: 'Comparison status requires a main conversation.' };
    if (caller.session.header.origin === 'subagent')
        return { error: 'A delegated or candidate agent cannot manage comparison status.' };
    signal?.throwIfAborted();
    const id = runId ?? (await comparer.store.list()).find(r => r.sessionId === caller.session.id)?.runId;
    signal?.throwIfAborted();
    const record = id === undefined ? undefined : await comparer.observe(id);
    return record === undefined ? { error: 'no such run' } : { record, control: await comparer.control(record) };
}

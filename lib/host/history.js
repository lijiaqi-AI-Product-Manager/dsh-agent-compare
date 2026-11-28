export class HistoryQueryError extends Error {
    constructor(message) { super(message); this.name = 'HistoryQueryError'; }
}
const folded = (text) => text.normalize('NFKC').toLowerCase();
/** Pages retained records without changing them; inline readers default to their own session. */
export async function historyPage(store, input) {
    if (input.scope !== undefined && input.scope !== 'all' && input.scope !== 'session')
        throw new HistoryQueryError('记录范围必须是全部对话或当前对话');
    if (input.sessionId !== undefined && (typeof input.sessionId !== 'string' || !input.sessionId || input.sessionId.length > 500))
        throw new HistoryQueryError('对话编号无效');
    const sessionId = input.sessionId;
    const scope = input.scope ?? (sessionId ? 'session' : 'all');
    if (scope === 'session' && !sessionId)
        throw new HistoryQueryError('查看当前对话需要对话编号');
    if (input.search !== undefined && (typeof input.search !== 'string' || input.search.length > 200))
        throw new HistoryQueryError('搜索内容不能超过 200 个字符');
    if (input.offset !== undefined && (typeof input.offset !== 'number' || !Number.isSafeInteger(input.offset) || input.offset < 0))
        throw new HistoryQueryError('记录页位置无效');
    if (input.onlyUnavailable !== undefined && typeof input.onlyUnavailable !== 'boolean')
        throw new HistoryQueryError('需处理记录筛选无效');
    const onlyUnavailable = input.onlyUnavailable === true;
    const query = input.search?.trim() ?? '', needle = folded(query), limit = 30;
    const pathNeedle = needle.replaceAll('\\', '/');
    const all = await store.listAll();
    const matched = [
        ...all.current.filter(record => scope === 'all' || record.sessionId === sessionId),
        // Old schemas have no trustworthy session association.
        ...(scope === 'all' ? all.legacy : []),
    ].filter(record => {
        if (!needle)
            return true;
        if (folded(record.task).includes(needle) || record.runId.includes(needle))
            return true;
        if ('legacy' in record)
            return false;
        const directory = record.target ? record.target.folder : record.baseline.repoRoot;
        if (!directory)
            return false;
        const root = directory.replaceAll('\\', '/');
        const path = !record.target && record.baseline.projectPath ? `${root.replace(/\/$/, '')}/${record.baseline.projectPath}` : root;
        return folded(path).includes(pathNeedle);
    });
    const problems = matched.filter((record) => 'legacy' in record && record.unavailable === true);
    const rows = onlyUnavailable ? problems : matched;
    rows.sort((a, b) => b.createdAt - a.createdAt || (a.runId === b.runId ? 0 : a.runId < b.runId ? 1 : -1));
    const lastPage = Math.floor(Math.max(0, rows.length - 1) / limit) * limit;
    const offset = Math.min(input.offset ?? 0, lastPage);
    const page = rows.slice(offset, offset + limit);
    return {
        runs: page.filter((record) => !('legacy' in record)),
        legacy: page.filter((record) => 'legacy' in record),
        history: { version: 1, scope, query, total: rows.length, offset, limit, hasNext: offset + limit < rows.length, onlyUnavailable, unavailable: problems.length },
    };
}

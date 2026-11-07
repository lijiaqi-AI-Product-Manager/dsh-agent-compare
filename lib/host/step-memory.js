import { memoryNote, milestoneOf } from './conversation.js';
/** Notes for the newest comparisons first; older ones stay in history and the current-state context. */
const RECENT_RUNS = 20;
const NOTES_PER_STEP = 5;
export class StepMemory {
    deps;
    scans = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    /** Comparison facts this conversation's log does not contain yet, oldest first. */
    async pending(session) {
        const records = (await this.deps.records(session.id)).filter(record => record.sessionId === session.id);
        if (records.length === 0)
            return [];
        const keys = this.scan(session);
        const notes = [];
        for (const record of [...records].sort((a, b) => a.updatedAt - b.updatedAt).slice(-RECENT_RUNS)) {
            const milestone = milestoneOf(record), text = memoryNote(record);
            if (!milestone || !text || keys.has(`${record.runId}:${milestone}`))
                continue;
            notes.push({ runId: record.runId, milestone, text });
        }
        return notes.slice(-NOTES_PER_STEP);
    }
    /** Model-facing messages for the pending notes, or none when the host cannot build messages. */
    async messages(session) {
        const notes = await this.pending(session);
        if (notes.length === 0)
            return [];
        const create = await this.deps.createMessage();
        if (!create)
            return [];
        return notes.map(note => create({ content: [{ type: 'text', text: note.text }], source: { kind: 'agent-compare', runId: note.runId, milestone: note.milestone } }));
    }
    /** Whether the conversation's log already holds the record's current fact. */
    delivered(session, record) {
        const milestone = milestoneOf(record);
        if (!milestone || !memoryNote(record))
            return undefined;
        return this.scan(session).has(`${record.runId}:${milestone}`);
    }
    /** Read only the log entries appended since the previous scan of this session. */
    scan(session) {
        let state = this.scans.get(session.id);
        if (!state || session.seq < state.seq) {
            state = { seq: 0, keys: new Set() };
            this.scans.set(session.id, state);
        }
        if (session.seq !== state.seq) {
            // Overlap the last scanned position: re-reading it is harmless for a set,
            // and no entry is skipped whether the host's `seq` counts entries or names the last one.
            for (const event of session.snapshotEvents(Math.max(0, state.seq - 1))) {
                if (event.type !== 'user/message')
                    continue;
                const source = agentCompareSource(event.data);
                if (source)
                    state.keys.add(`${source.runId}:${source.milestone}`);
            }
            state.seq = session.seq;
        }
        return state.keys;
    }
}
/**
 * The `agent/pre-step` waterfall: pending comparison facts go ahead of the
 * step's own messages, so the user's message stays the latest input. Only an
 * admitted step of a top-level conversation is changed; an unexpected payload
 * or a failure leaves the step exactly as the host decided.
 */
export async function withComparisonNotes(payload, next, deps) {
    const decision = await next();
    try {
        const agent = payload?.agent;
        if (decision?.kind !== 'enter' || !Array.isArray(decision.messages) || payload?.signal?.aborted || !agent?.session || deps.delegated(agent))
            return decision;
        const notes = await deps.memory.messages(agent.session);
        if (notes.length === 0 || payload?.signal?.aborted)
            return decision;
        return { ...decision, messages: [...notes, ...decision.messages] };
    }
    catch (error) {
        // Memory is supplementary: a failure must never block the user's own request.
        deps.warn(`agent-compare: comparison notes unavailable for this step: ${error.message}`);
        return decision;
    }
}
function agentCompareSource(value, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 3)
        return undefined;
    const object = value;
    const source = object.source;
    if (source?.kind === 'agent-compare' && typeof source.runId === 'string' && typeof source.milestone === 'string')
        return { runId: source.runId, milestone: source.milestone };
    for (const key of ['message', 'data', 'entry']) {
        const found = agentCompareSource(object[key], depth + 1);
        if (found)
            return found;
    }
    return undefined;
}

import { memoryNote, milestoneOf } from './conversation.js';
/** Retry unavailable conversations; deduplicate against their durable messages and live inbox. */
export class ConversationMemory {
    deps;
    delivered = new Set();
    pending = new Map();
    constructor(deps) {
        this.deps = deps;
    }
    remember(record) {
        const milestone = milestoneOf(record), text = memoryNote(record), sessionId = record.sessionId;
        if (!milestone || !text || !sessionId)
            return Promise.resolve();
        const key = `${record.runId}:${milestone}`;
        if (this.delivered.has(key))
            return Promise.resolve();
        const pending = this.pending.get(key);
        if (pending)
            return pending;
        const runId = record.runId;
        const delivery = (async () => {
            const agent = this.deps.findAgent(sessionId);
            if (!agent?.inject)
                return;
            const previous = agent.session.snapshotEvents(0).filter(e => e.type === 'user/message').map(e => e.data);
            if (previous.some(message => containsNote(message, runId, milestone, text))) {
                this.delivered.add(key);
                return;
            }
            const queued = [...(agent.inbox?.nextTurn ?? []), ...(agent.inbox?.nextStep ?? [])];
            if (queued.some(message => containsNote(message, runId, milestone, text)))
                return;
            const create = await this.deps.createMessage();
            if (!create)
                return;
            agent.inject(create({ content: [{ type: 'text', text }], source: { kind: 'agent-compare', runId, milestone } }));
        })().catch(error => this.deps.warn(`agent-compare: could not record run ${runId} in its conversation: ${error.message}`))
            .finally(() => { this.pending.delete(key); });
        this.pending.set(key, delivery);
        return delivery;
    }
}
function containsNote(value, runId, milestone, text, depth = 0) {
    if (!value || typeof value !== 'object' || depth > 3)
        return false;
    const object = value;
    const source = object.source;
    if (source?.kind === 'agent-compare' && ((source.runId === runId && source.milestone === milestone)
        || (Array.isArray(object.content) && object.content.some(block => block?.type === 'text' && block.text === text))))
        return true;
    return ['message', 'data', 'entry'].some(key => containsNote(object[key], runId, milestone, text, depth + 1));
}

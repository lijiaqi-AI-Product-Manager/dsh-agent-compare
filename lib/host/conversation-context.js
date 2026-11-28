/**
 * Main-conversation context a user chooses to give both candidates.
 *
 * Only what DSH itself treats as the visible conversation is offered: the
 * user's own messages, assistant replies with text, compaction summaries and
 * AgentCompare's own result notes. Tools, reasoning and other injected
 * context stay out. Both candidates receive the identical, bounded text.
 */
import { createHash } from 'node:crypto';
export const MESSAGE_CHARS = 2_000;
export const CONTEXT_CHARS = 12_000;
const LISTED_ENTRIES = 40;
function textOf(content) {
    if (!Array.isArray(content))
        return '';
    const text = content.flatMap(block => block && block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n');
    return text.trim() ? text : '';
}
/** The visible conversation, oldest first. */
export function conversationEntries(events) {
    const entries = [];
    events.forEach((event, id) => {
        if (event.type === 'user/message') {
            const kind = event.data?.source?.kind;
            const role = kind === 'user' ? 'user' : kind === 'agent-compare' ? 'note' : typeof kind === 'string' && /compact/i.test(kind) ? 'summary' : undefined;
            const text = role ? textOf(event.data?.content) : '';
            if (role && text)
                entries.push({ id, role, text });
        }
        else if (event.type === 'assistant/message') {
            const text = textOf(event.data?.message?.content);
            if (text)
                entries.push({ id, role: 'assistant', text });
        }
    });
    return entries;
}
/** Move a UTF-16 boundary to the start of a character when it cuts a pair. */
function characterBoundary(text, offset) {
    const unit = text.charCodeAt(offset);
    return unit >= 0xdc00 && unit <= 0xdfff ? offset - 1 : offset;
}
export class ChangedContextSelectionError extends Error {
    constructor() { super('所选的主对话消息已变更或不在当前对话中，请重新选择。'); }
}
function entryDigest(entry) {
    return createHash('sha256').update(entry.role).update('\0').update(entry.text).digest('hex');
}
/** The digest identifies the complete message even when just its opening fits in the picker. */
export function listedEntries(events) {
    return conversationEntries(events).slice(-LISTED_ENTRIES).map(entry => ({
        ...entry, chars: entry.text.length, digest: entryDigest(entry),
        text: entry.text.length > 400 ? `${entry.text.slice(0, characterBoundary(entry.text, 400))}…` : entry.text,
    }));
}
const LABEL = { user: 'User', assistant: 'Assistant', summary: 'Conversation summary', note: 'AgentCompare result' };
/**
 * The text a candidate receives for one entry. A result note names the user's
 * project path, which is not the candidate's copy, so that line is left out;
 * and the excerpt cannot close or reopen its own block.
 */
function candidateText(entry) {
    const text = entry.role === 'note' ? entry.text.replace(/^(?:Target repository|Folder): .*(?:\r?\n|$)/m, '') : entry.text;
    return text.replace(/<(\/?\s*main-conversation)/gi, '&lt;$1');
}
/**
 * Build the text for one submission. `recent` takes the last `turns` user
 * messages and everything after the earliest of them, including the results
 * delivered with that message and `pending` results the log does not hold
 * yet; `selected` takes exactly the listed entries. Newest content is kept
 * when the bound is reached.
 */
export function buildConversationContext(events, request, pending = []) {
    if (request.mode === 'none')
        return undefined;
    const entries = conversationEntries(events);
    let chosen;
    if (request.mode === 'selected') {
        const ids = new Map(request.ids?.map((id, index) => [id, request.digests?.[index]]));
        chosen = entries.filter(entry => ids.has(entry.id));
        if (chosen.length !== ids.size || (request.digests && chosen.some(entry => ids.get(entry.id) !== entryDigest(entry)))) {
            throw new ChangedContextSelectionError();
        }
    }
    else {
        const users = entries.filter(entry => entry.role === 'user');
        // Fewer exchanges than requested: start from the first one.
        const first = users.at(-Math.min(users.length, Math.max(1, request.turns)));
        if (first) {
            // Results enter the log just ahead of the message they were delivered with: they belong to that exchange.
            let start = entries.indexOf(first);
            while (start > 0 && entries[start - 1].role === 'note')
                start--;
            chosen = entries.slice(start);
        }
        else
            chosen = entries.filter(entry => entry.role === 'summary').slice(-1);
        // A comparison finished since the last message is still the newest fact.
        chosen = [...chosen, ...pending.map((text, index) => ({ id: -1 - index, role: 'note', text }))];
    }
    if (chosen.length === 0)
        return undefined;
    let truncated = false;
    const blocks = [];
    let total = 0;
    for (const entry of [...chosen].reverse()) {
        let text = candidateText(entry);
        if (text.length > MESSAGE_CHARS) {
            // Preserve the opening request and the latest correction in a long message.
            const marker = '\n[…]\n';
            const width = Math.floor((MESSAGE_CHARS - marker.length) / 2);
            const startOfTail = characterBoundary(text, text.length - width);
            const tail = text.slice(startOfTail);
            const head = text.slice(0, characterBoundary(text, MESSAGE_CHARS - marker.length - tail.length));
            text = head + marker + tail;
            truncated = true;
        }
        const block = `[${LABEL[entry.role]}]\n${text}`;
        if (total + block.length > CONTEXT_CHARS) {
            truncated = true;
            break;
        }
        blocks.unshift(block);
        total += block.length + 2;
    }
    if (blocks.length === 0)
        return undefined;
    const text = blocks.join('\n\n');
    return { mode: request.mode, messages: blocks.length, chars: text.length, truncated, sha256: createHash('sha256').update(text).digest('hex'), text };
}

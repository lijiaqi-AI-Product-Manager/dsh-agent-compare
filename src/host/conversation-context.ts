/**
 * Main-conversation context a user chooses to give both candidates.
 *
 * Only what DSH itself treats as the visible conversation is offered: the
 * user's own messages, assistant replies with text, compaction summaries and
 * AgentCompare's own result notes. Tools, reasoning and other injected
 * context stay out. Both candidates receive the identical, bounded text.
 */
import { createHash } from 'node:crypto'
import type { ConversationContextRequest } from './preferences.ts'

export interface ContextSourceEvent { readonly type: string; readonly data?: any }
export type ContextRole = 'user' | 'assistant' | 'summary' | 'note'
export interface ContextEntry {
  /** Position in the conversation log; stable while the log is not replaced. */
  readonly id: number
  readonly role: ContextRole
  readonly text: string
}
export interface ConversationContext {
  readonly mode: 'recent' | 'selected'
  readonly messages: number
  readonly chars: number
  readonly truncated: boolean
  readonly sha256: string
  readonly text: string
}

export const MESSAGE_CHARS = 2_000
export const CONTEXT_CHARS = 12_000
const LISTED_ENTRIES = 40

const textOf = (content: unknown): string => Array.isArray(content)
  ? content.flatMap(block => block && block.type === 'text' && typeof block.text === 'string' ? [block.text] : []).join('\n').trim()
  : ''

/** The visible conversation, oldest first. */
export function conversationEntries(events: readonly ContextSourceEvent[]): ContextEntry[] {
  const entries: ContextEntry[] = []
  events.forEach((event, id) => {
    if (event.type === 'user/message') {
      const kind = event.data?.source?.kind
      const role: ContextRole | undefined = kind === 'user' ? 'user' : kind === 'agent-compare' ? 'note' : typeof kind === 'string' && /compact/i.test(kind) ? 'summary' : undefined
      const text = role ? textOf(event.data?.content) : ''
      if (role && text) entries.push({ id, role, text })
    } else if (event.type === 'assistant/message') {
      const text = textOf(event.data?.message?.content)
      if (text) entries.push({ id, role: 'assistant', text })
    }
  })
  return entries
}

/** Recent entries for the picker, newest last, with previews bounded for transport. */
export function listedEntries(events: readonly ContextSourceEvent[]): Array<ContextEntry & { chars: number }> {
  return conversationEntries(events).slice(-LISTED_ENTRIES).map(entry => ({ ...entry, chars: entry.text.length, text: entry.text.length > 400 ? `${entry.text.slice(0, 400)}…` : entry.text }))
}

const LABEL: Record<ContextRole, string> = { user: 'User', assistant: 'Assistant', summary: 'Conversation summary', note: 'AgentCompare result' }

/**
 * Build the text for one submission. `recent` takes the last `turns` user
 * messages and everything after the earliest of them; `selected` takes exactly
 * the listed entries. Newest content is kept when the bound is reached.
 */
export function buildConversationContext(events: readonly ContextSourceEvent[], request: ConversationContextRequest): ConversationContext | undefined {
  if (request.mode === 'none') return undefined
  const entries = conversationEntries(events)
  let chosen: ContextEntry[]
  if (request.mode === 'selected') {
    const ids = new Set(request.ids ?? [])
    chosen = entries.filter(entry => ids.has(entry.id))
    if (ids.size > 0 && chosen.length === 0) throw new Error('所选的主对话消息已不在当前对话中，请重新选择。')
  } else {
    const users = entries.filter(entry => entry.role === 'user')
    // Fewer exchanges than requested: start from the first one.
    const first = users.at(-Math.min(users.length, Math.max(1, request.turns)))
    chosen = first ? entries.filter(entry => entry.id >= first.id) : entries.filter(entry => entry.role === 'summary').slice(-1)
  }
  if (chosen.length === 0) return undefined
  let truncated = false
  const blocks: string[] = []
  let total = 0
  for (const entry of [...chosen].reverse()) {
    let text = entry.text
    if (text.length > MESSAGE_CHARS) { text = `${text.slice(0, MESSAGE_CHARS)}\n[… ${text.length - MESSAGE_CHARS} characters omitted …]`; truncated = true }
    const block = `[${LABEL[entry.role]}]\n${text}`
    if (total + block.length > CONTEXT_CHARS) { truncated = true; break }
    blocks.unshift(block); total += block.length + 2
  }
  if (blocks.length === 0) return undefined
  const text = blocks.join('\n\n')
  return { mode: request.mode, messages: blocks.length, chars: text.length, truncated, sha256: createHash('sha256').update(text).digest('hex'), text }
}

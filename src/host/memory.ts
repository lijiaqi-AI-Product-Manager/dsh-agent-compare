import type { RunRecord } from '../core/types.ts'
import { memoryNote, milestoneOf } from './conversation.ts'

interface MemoryAgent {
  session: { snapshotEvents(from: number): readonly { type: string; data?: unknown }[] }
  inbox?: { nextTurn: readonly unknown[]; nextStep: readonly unknown[] }
  inject?(message: unknown): void
}

/** Retry unavailable conversations; deduplicate against their durable messages and live inbox. */
export class ConversationMemory {
  private readonly delivered = new Set<string>()
  private readonly pending = new Map<string, Promise<void>>()

  constructor(private readonly deps: {
    findAgent(sessionId: string): MemoryAgent | undefined
    createMessage(): Promise<((message: unknown) => unknown) | undefined>
    warn(message: string): void
  }) {}

  remember(record: RunRecord): Promise<void> {
    const milestone = milestoneOf(record), text = memoryNote(record), sessionId = record.sessionId
    if (!milestone || !text || !sessionId) return Promise.resolve()
    const key = `${record.runId}:${milestone}`
    if (this.delivered.has(key)) return Promise.resolve()
    const pending = this.pending.get(key)
    if (pending) return pending
    const runId = record.runId
    const delivery = (async () => {
      const agent = this.deps.findAgent(sessionId)
      if (!agent?.inject) return
      const previous = agent.session.snapshotEvents(0).filter(e => e.type === 'user/message').map(e => e.data)
      if (previous.some(message => containsNote(message, runId, milestone, text))) { this.delivered.add(key); return }
      const queued = [...(agent.inbox?.nextTurn ?? []), ...(agent.inbox?.nextStep ?? [])]
      if (queued.some(message => containsNote(message, runId, milestone, text))) return
      const create = await this.deps.createMessage()
      if (!create) return
      agent.inject(create({ content: [{ type: 'text', text }], source: { kind: 'agent-compare', runId, milestone } }))
    })().catch(error => this.deps.warn(`agent-compare: could not record run ${runId} in its conversation: ${(error as Error).message}`))
      .finally(() => { this.pending.delete(key) })
    this.pending.set(key, delivery)
    return delivery
  }
}

function containsNote(value: unknown, runId: string, milestone: string, text: string, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 3) return false
  const object = value as Record<string, unknown>
  const source = object.source as Record<string, unknown> | undefined
  if (source?.kind === 'agent-compare' && ((source.runId === runId && source.milestone === milestone)
    || (Array.isArray(object.content) && object.content.some(block => block?.type === 'text' && block.text === text)))) return true
  return ['message', 'data', 'entry'].some(key => containsNote(object[key], runId, milestone, text, depth + 1))
}

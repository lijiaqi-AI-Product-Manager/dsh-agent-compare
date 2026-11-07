import type { RunRecord } from '../core/types.ts'
import { memoryNote, milestoneOf } from './conversation.ts'

/**
 * Conversation memory delivered inside the owning conversation's own steps.
 *
 * DSH admits durable context through the `agent/pre-step` waterfall: messages
 * returned there enter the request and the session log together. Queuing with
 * `agent.inject` from outside could miss a request whose batch was already
 * claimed, was discarded on cancellation, and needed the conversation to be
 * attached. Here every step of the owning conversation checks which current
 * comparison facts its log does not contain yet and adds them to that step.
 */
export interface MemorySession {
  readonly id: string
  readonly seq: number
  snapshotEvents(from: number): readonly { readonly type: string; readonly data?: unknown }[]
}

export interface PendingNote { readonly runId: string; readonly milestone: string; readonly text: string }

interface Scan { seq: number; readonly keys: Set<string> }

/** Notes for the newest comparisons first; older ones stay in history and the current-state context. */
const RECENT_RUNS = 20
const NOTES_PER_STEP = 5

export class StepMemory {
  private readonly scans = new Map<string, Scan>()

  constructor(private readonly deps: {
    /** Records owned by the conversation. */
    records(sessionId: string): Promise<readonly RunRecord[]>
    createMessage(): Promise<((message: unknown) => unknown) | undefined>
  }) {}

  /** Comparison facts this conversation's log does not contain yet, oldest first. */
  async pending(session: MemorySession): Promise<PendingNote[]> {
    const records = (await this.deps.records(session.id)).filter(record => record.sessionId === session.id)
    if (records.length === 0) return []
    const keys = this.scan(session)
    const notes: PendingNote[] = []
    for (const record of [...records].sort((a, b) => a.updatedAt - b.updatedAt).slice(-RECENT_RUNS)) {
      const milestone = milestoneOf(record), text = memoryNote(record)
      if (!milestone || !text || keys.has(`${record.runId}:${milestone}`)) continue
      notes.push({ runId: record.runId, milestone, text })
    }
    return notes.slice(-NOTES_PER_STEP)
  }

  /** Model-facing messages for the pending notes, or none when the host cannot build messages. */
  async messages(session: MemorySession): Promise<unknown[]> {
    const notes = await this.pending(session)
    if (notes.length === 0) return []
    const create = await this.deps.createMessage()
    if (!create) return []
    return notes.map(note => create({ content: [{ type: 'text', text: note.text }], source: { kind: 'agent-compare', runId: note.runId, milestone: note.milestone } }))
  }

  /** Whether the conversation's log already holds the record's current fact. */
  delivered(session: MemorySession, record: RunRecord): boolean | undefined {
    const milestone = milestoneOf(record)
    if (!milestone || !memoryNote(record)) return undefined
    return this.scan(session).has(`${record.runId}:${milestone}`)
  }

  /** Read only the log entries appended since the previous scan of this session. */
  private scan(session: MemorySession): Set<string> {
    let state = this.scans.get(session.id)
    if (!state || session.seq < state.seq) { state = { seq: 0, keys: new Set() }; this.scans.set(session.id, state) }
    if (session.seq !== state.seq) {
      for (const event of session.snapshotEvents(state.seq)) {
        if (event.type !== 'user/message') continue
        const source = agentCompareSource(event.data)
        if (source) state.keys.add(`${source.runId}:${source.milestone}`)
      }
      state.seq = session.seq
    }
    return state.keys
  }
}

function agentCompareSource(value: unknown, depth = 0): { runId: string; milestone: string } | undefined {
  if (!value || typeof value !== 'object' || depth > 3) return undefined
  const object = value as Record<string, unknown>
  const source = object.source as Record<string, unknown> | undefined
  if (source?.kind === 'agent-compare' && typeof source.runId === 'string' && typeof source.milestone === 'string') return { runId: source.runId, milestone: source.milestone }
  for (const key of ['message', 'data', 'entry']) {
    const found = agentCompareSource(object[key], depth + 1)
    if (found) return found
  }
  return undefined
}

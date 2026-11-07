import { describe, expect, it, vi } from 'vitest'
import { StepMemory, withComparisonNotes } from '../src/host/step-memory.ts'
import { fixtureRecord } from './record-fixture.ts'

describe('step memory reads', () => {
  it('reads no log for conversations without comparisons and scans only new log entries', async () => {
    const events: Array<{ type: string; data: unknown }> = []
    const snapshot = vi.fn((from: number) => events.slice(from))
    const session = { id: 's1', get seq() { return events.length }, snapshotEvents: snapshot }
    const record = fixtureRecord(); record.sessionId = 's1'; record.state = 'judging'
    const records = vi.fn(async (sessionId: string) => sessionId === 's1' ? [record] : [])
    const memory = new StepMemory({ records, createMessage: async () => message => message })

    expect(await memory.messages({ id: 'idle', seq: 0, snapshotEvents: snapshot })).toHaveLength(0)
    expect(snapshot).not.toHaveBeenCalled()

    const notes = await memory.messages(session)
    expect(notes).toHaveLength(1)
    for (const message of notes) events.push({ type: 'user/message', data: { message } })
    for (let i = 0; i < 50; i++) events.push({ type: 'assistant/message', data: {} })
    expect(await memory.messages(session)).toHaveLength(0)
    expect(snapshot.mock.calls.map(call => call[0])).toEqual([0])
    events.push({ type: 'assistant/message', data: {} })
    expect(await memory.messages(session)).toHaveLength(0)
    expect(snapshot.mock.calls.map(call => call[0])).toEqual([0, 50])
  })

  it('finds a note at the scan boundary when the snapshot excludes its start position', async () => {
    // A host whose snapshot returns positions after `from` must not lose the entry at `from`.
    const events: Array<{ type: string; data: unknown }> = [{ type: 'assistant/message', data: {} }]
    const session = { id: 's1', get seq() { return events.length }, snapshotEvents: (from: number) => events.slice(from + 1) }
    const record = fixtureRecord(); record.sessionId = 's1'; record.state = 'judging'
    const memory = new StepMemory({ records: async () => [record], createMessage: async () => message => message })
    expect(memory.delivered(session, record)).toBe(false)
    const notes = await memory.messages(session)
    // The note lands exactly at the previous scan's end position.
    events.push(...notes.map(message => ({ type: 'user/message', data: { message } })))
    expect(memory.delivered(session, record)).toBe(true)
    expect(await memory.messages(session)).toHaveLength(0)
  })

  it('puts notes ahead of an admitted step and otherwise leaves the host decision untouched', async () => {
    const session = { id: 's1', seq: 0, snapshotEvents: () => [] }
    const memory = { messages: vi.fn(async () => ['note']) }
    const warn = vi.fn()
    const deps = { memory, delegated: (agent: { delegated?: boolean }) => agent.delegated === true, warn }
    const enter = { kind: 'enter' as const, messages: ['user message'] }
    expect(await withComparisonNotes({ agent: { session }, signal: new AbortController().signal }, async () => enter, deps)).toEqual({ kind: 'enter', messages: ['note', 'user message'] })
    // Rejected, delegated, aborted and malformed steps are returned as the host decided.
    const reject = { kind: 'reject' as const }
    expect(await withComparisonNotes({ agent: { session } }, async () => reject, deps)).toBe(reject)
    expect(await withComparisonNotes({ agent: { session, delegated: true } }, async () => enter, deps)).toBe(enter)
    const aborted = new AbortController(); aborted.abort()
    expect(await withComparisonNotes({ agent: { session }, signal: aborted.signal }, async () => enter, deps)).toBe(enter)
    expect(await withComparisonNotes(undefined, async () => enter, deps)).toBe(enter)
    expect(await withComparisonNotes({ agent: {} }, async () => enter, deps)).toBe(enter)
    const odd = { kind: 'enter', messages: undefined } as never
    expect(await withComparisonNotes({ agent: { session } }, async () => odd, deps)).toBe(odd)
    expect(memory.messages).toHaveBeenCalledTimes(1)
    // A failure to read records never blocks the user's request.
    memory.messages.mockRejectedValueOnce(new Error('disk unavailable'))
    expect(await withComparisonNotes({ agent: { session } }, async () => enter, deps)).toBe(enter)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('disk unavailable'))
  })

  it('rescans from the start when the session log is replaced', async () => {
    let events: Array<{ type: string; data: unknown }> = []
    const session = { id: 's1', get seq() { return events.length }, snapshotEvents: (from: number) => events.slice(from) }
    const record = fixtureRecord(); record.sessionId = 's1'; record.state = 'judging'
    const memory = new StepMemory({ records: async () => [record], createMessage: async () => message => message })
    const notes = await memory.messages(session)
    events = [...notes.map(message => ({ type: 'user/message', data: { message } })), { type: 'assistant/message', data: {} }]
    expect(await memory.messages(session)).toHaveLength(0)
    // A cleared log no longer contains the note; it is delivered again.
    events = []
    expect(await memory.messages(session)).toHaveLength(1)
  })
})

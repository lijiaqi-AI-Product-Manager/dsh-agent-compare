import { describe, expect, it, vi } from 'vitest'
import { StepMemory } from '../src/host/step-memory.ts'
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
    expect(snapshot.mock.calls.map(call => call[0])).toEqual([0, 51])
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

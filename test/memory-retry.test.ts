import { describe, expect, it, vi } from 'vitest'
import { ConversationMemory } from '../src/host/memory.ts'
import { fixtureRecord } from './record-fixture.ts'

describe('pending conversation delivery', () => {
  it('does no record reads while empty or while the owning conversation is inactive', async () => {
    let online = false
    const queued: unknown[] = [], events: Array<{ type: string; data: unknown }> = []
    const agent = { session: { snapshotEvents: () => events }, inbox: { nextTurn: [], nextStep: queued }, inject: (message: unknown) => queued.push(message) }
    const memory = new ConversationMemory({ findAgent: () => online ? agent : undefined, createMessage: async () => message => message, warn: () => {} })
    const record = fixtureRecord(), load = vi.fn(async () => record)
    await memory.retryUndelivered(load)
    await memory.remember(record)
    await memory.retryUndelivered(load)
    expect(load).not.toHaveBeenCalled()
    online = true
    await memory.retryUndelivered(load)
    expect(queued).toHaveLength(1)
    queued.length = 0
    await memory.retryUndelivered(load)
    expect(queued).toHaveLength(1)
    events.push({ type: 'user/message', data: { message: queued.shift() } })
    await memory.retryUndelivered(load)
    load.mockClear()
    await memory.retryUndelivered(load)
    expect(load).not.toHaveBeenCalled()
    expect(queued).toHaveLength(0)
  })
  it('does not enqueue a superseded milestone after delayed message preparation', async () => {
    const queued: unknown[] = []
    let release!: () => void, entered!: () => void, calls = 0
    const gate = new Promise<void>(resolve => { release = resolve }), waiting = new Promise<void>(resolve => { entered = resolve })
    const agent = { session: { snapshotEvents: () => [] }, inbox: { nextTurn: [], nextStep: queued }, inject: (message: unknown) => queued.push(message) }
    const memory = new ConversationMemory({ findAgent: () => agent, createMessage: async () => { if (++calls === 1) { entered(); await gate } return message => message }, warn: () => {} })
    const old = fixtureRecord(); old.rev = 1
    const first = memory.remember(old)
    await waiting
    const current = structuredClone(old); current.rev = 2; current.state = 'revealed'; current.choice = { pick: 'A', at: 2 }
    await memory.remember(current)
    release(); await first
    expect(queued).toHaveLength(1)
    expect(JSON.stringify(queued)).toContain('picked A')
    await memory.remember(old)
    expect(queued).toHaveLength(1)
  })
})

import { describe, expect, it, vi } from 'vitest'
import { withCurrentComparison, type StepDecision } from '../src/host/step-context.ts'
import { fixtureRecord } from './record-fixture.ts'

function fixture() {
  const record = fixtureRecord(), controller = new AbortController()
  const latest = vi.fn(async (_session: string) => record), createMessage = vi.fn(async () => (message: unknown) => message), warn = vi.fn()
  const payload = { agent: { session: { id: record.sessionId!, header: {} as { origin?: string; delegationDepth?: number } } }, signal: controller.signal }
  const messages = [{ content: [{ type: 'text', text: 'continue after adoption' }], source: { kind: 'user' } }]
  const next = vi.fn(async (): Promise<StepDecision> => ({ kind: 'enter', messages, startsRequestSeries: true }))
  return { record, controller, latest, createMessage, warn, payload, messages, next }
}
const text = (result: StepDecision): string => result.kind === 'enter' ? JSON.stringify(result.messages.at(-1)) : ''
describe('current comparison context at step admission', () => {
  it('supersedes an older choice note with the durable adopted state after restart', async () => {
    const f = fixture()
    f.record.rev = 12; f.record.state = 'adopted'; f.record.choice = { pick: 'B', at: 2 }
    f.record.adoption = { label: 'B', mode: 'worktree', state: 'adopted', startedAt: 3 }
    const old = { content: [{ type: 'text', text: 'The user picked B. It is not adopted yet.' }], source: { kind: 'agent-compare', runId: f.record.runId, milestone: 'choice:B' } }
    f.messages.unshift(old)
    const original = structuredClone(f.messages), result = await withCurrentComparison(f.payload, f.next, f)
    expect(result).toMatchObject({ kind: 'enter', startsRequestSeries: true })
    expect(result.kind === 'enter' && result.messages.slice(0, -1)).toEqual(original)
    expect(f.messages).toEqual(original)
    expect(text(result)).toContain('adopted'); expect(text(result)).toContain('supersedes older status')
    expect(text(result)).toContain(f.record.runId); expect(text(result)).toContain('revision')
    expect(f.latest).toHaveBeenCalledExactlyOnceWith(f.record.sessionId)
  })
  it('does not turn an empty batch into another model step', async () => {
    const f = fixture(), decision: StepDecision = { kind: 'enter', messages: [] }
    expect(await withCurrentComparison(f.payload, async () => decision, f)).toBe(decision)
    expect(f.latest).not.toHaveBeenCalled(); expect(f.createMessage).not.toHaveBeenCalled()
  })
  it('preserves another listener rejection without reading comparison records', async () => {
    const f = fixture(), decision: StepDecision = { kind: 'reject' }
    expect(await withCurrentComparison(f.payload, async () => decision, f)).toBe(decision)
    expect(f.latest).not.toHaveBeenCalled()
  })
  it.each([{ origin: 'subagent' }, { delegationDepth: 1 }])('never adds parent state to a delegated candidate (%j)', async header => {
    const f = fixture(); f.payload.agent.session.header = header
    const result = await withCurrentComparison(f.payload, f.next, f)
    expect(result).toMatchObject({ kind: 'enter', messages: f.messages })
    expect(f.latest).not.toHaveBeenCalled(); expect(f.createMessage).not.toHaveBeenCalled()
  })
  it('ignores a loader result belonging to another conversation', async () => {
    const f = fixture(); f.record.sessionId = 'different-conversation'
    expect((await withCurrentComparison(f.payload, f.next, f))).toMatchObject({ messages: f.messages })
  })
  it('has no comparison context when the conversation has never run a comparison', async () => {
    const f = fixture()
    expect(await withCurrentComparison(f.payload, f.next, { ...f, latest: async () => undefined })).toMatchObject({ messages: f.messages })
  })
  it('uses a snapshot loaded after delayed message-factory preparation', async () => {
    const f = fixture(); let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    f.createMessage.mockImplementation(async () => { await gate; return message => message })
    const pending = withCurrentComparison(f.payload, f.next, f)
    await Promise.resolve(); expect(f.latest).not.toHaveBeenCalled()
    f.record.state = 'adopted'; f.record.choice = { pick: 'A', at: 1 }; f.record.adoption = { label: 'A', mode: 'worktree', state: 'reverted', startedAt: 1 }
    release(); expect(text(await pending)).toContain('reverted')
  })
  it('does not append after cancellation during record loading', async () => {
    const f = fixture()
    f.latest.mockImplementation(async () => { f.controller.abort(); return f.record })
    expect(await withCurrentComparison(f.payload, f.next, f)).toMatchObject({ messages: f.messages })
  })
  it('does not read records when the turn is already cancelled', async () => {
    const f = fixture(); f.controller.abort()
    expect(await withCurrentComparison(f.payload, f.next, f)).toMatchObject({ messages: f.messages })
    expect(f.latest).not.toHaveBeenCalled()
  })
  it('reports unknown state on a read failure instead of repeating a stale adoption claim', async () => {
    const f = fixture(); f.latest.mockRejectedValue(new Error('unreadable record'))
    const result = await withCurrentComparison(f.payload, f.next, f)
    expect(text(result)).toContain('state unavailable'); expect(text(result)).toContain('Do not infer adoption status')
    expect(f.warn).toHaveBeenCalledTimes(1)
  })
  it('keeps strategy, model and usage hidden before the user chooses', async () => {
    const f = fixture()
    f.record.candidates[0]!.route.model = 'hidden-model-name'; f.record.candidates[0]!.strategy.title = 'hidden-strategy-name'
    const result = text(await withCurrentComparison(f.payload, f.next, f))
    expect(result).toContain('not_adopted')
    for (const word of ['hidden-model-name', 'hidden-strategy-name', 'usage', 'inputTokens']) expect(result).not.toContain(word)
  })
  it.each(['adopted', 'reverted', 'blocked', 'needs-recovery'] as const)('preserves the recorded %s state and branch/worktree distinction', async state => {
    const f = fixture(); f.record.choice = { pick: 'A', at: 2 }; f.record.adoption = { label: 'A', mode: 'branch', state, startedAt: 3 }
    const result = text(await withCurrentComparison(f.payload, f.next, f))
    expect(result).toContain(state); expect(result).toContain('branch'); expect(result).toContain('does not change the working tree')
  })
})

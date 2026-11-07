import { describe, expect, it, vi } from 'vitest'
import { CURRENT_STATE_CONTEXT, withCurrentComparisonState } from '../src/host/current-state.ts'
import { fixtureRecord } from './record-fixture.ts'

function fixture() {
  const record = fixtureRecord(), controller = new AbortController()
  const agent = { session: { id: record.sessionId!, header: {} as { origin?: string; delegationDepth?: number } } }
  const context = { agent, scope: agent as unknown, signal: controller.signal }
  const assembly = { contexts: [{ name: 'another-module', text: 'retained context' }], sections: [], tools: [], variables: { model: 'selected-model' } }
  const latest = vi.fn(async (_id: string) => record), warn = vi.fn(), next = vi.fn(async () => assembly)
  return { record, controller, agent, context, assembly, latest, warn, next }
}
describe('current comparison prompt context', () => {
  it('uses durable adopted facts while preserving other prompt contributions', async () => {
    const f = fixture(); f.record.rev = 12; f.record.state = 'adopted'; f.record.choice = { pick: 'B', at: 2 }; f.record.adoption = { label: 'B', mode: 'worktree', state: 'adopted', startedAt: 3 }
    const original = structuredClone(f.assembly), result = await withCurrentComparisonState(f.context, f.next, f)
    expect(f.assembly).toEqual(original)
    expect(result.contexts[0]).toBe(f.assembly.contexts[0]); expect(result.variables).toBe(f.assembly.variables)
    const note = result.contexts.at(-1)!
    expect(note).toMatchObject({ name: CURRENT_STATE_CONTEXT, interpolate: false })
    const facts = JSON.parse(note.text.split('\n')[1]!)
    expect(facts).toMatchObject({ runId: f.record.runId, revision: 12, pick: 'B', adoptionState: 'adopted', adoptionMode: 'worktree' })
    expect(note.text).toContain('overrides older status statements')
  })
  it('replaces its earlier snapshot without accumulating contexts', async () => {
    const f = fixture(), first = await withCurrentComparisonState(f.context, f.next, f)
    f.record.rev++; f.record.adoption = { label: 'A', mode: 'worktree', state: 'reverted', startedAt: 3 }
    const updated = await withCurrentComparisonState(f.context, async () => first, f)
    expect(updated.contexts.filter(c => c.name === CURRENT_STATE_CONTEXT)).toHaveLength(1)
    expect(updated.contexts.at(-1)!.text).toContain('reverted')
    expect(updated.contexts[0]).toBe(f.assembly.contexts[0])
  })
  it.each([{ origin: 'subagent' }, { delegationDepth: 1 }])('does not expose parent facts to a delegated candidate (%j)', async header => {
    const f = fixture(); f.agent.session.header = header
    f.assembly.contexts.push({ name: CURRENT_STATE_CONTEXT, text: 'inherited parent facts' })
    const result = await withCurrentComparisonState(f.context, f.next, f)
    expect(result.contexts).toEqual([{ name: 'another-module', text: 'retained context' }]); expect(f.latest).not.toHaveBeenCalled()
  })
  it('skips diagnostics without an agent or a matching scope', async () => {
    const f = fixture()
    expect(await withCurrentComparisonState({}, f.next, f)).toBe(f.assembly)
    expect(await withCurrentComparisonState({ agent: f.agent, scope: {} }, f.next, f)).toBe(f.assembly)
    expect(f.latest).not.toHaveBeenCalled()
  })
  it('removes its cached snapshot if no comparison remains, preserving other modules', async () => {
    const f = fixture(); f.assembly.contexts.push({ name: CURRENT_STATE_CONTEXT, text: 'outdated adopted state' })
    const result = await withCurrentComparisonState(f.context, f.next, { ...f, latest: async () => undefined })
    expect(result.contexts).toEqual([{ name: 'another-module', text: 'retained context' }])
  })
  it('rejects a record from another conversation', async () => {
    const f = fixture(); f.record.sessionId = 'someone-else'
    expect(await withCurrentComparisonState(f.context, f.next, f)).toBe(f.assembly)
  })
  it('reports unknown state on a failed read instead of repeating old adoption facts', async () => {
    const f = fixture(); f.assembly.contexts.push({ name: CURRENT_STATE_CONTEXT, text: 'outdated adopted state' }); f.latest.mockRejectedValue(new Error('unreadable'))
    const result = await withCurrentComparisonState(f.context, f.next, f)
    expect(result.contexts.at(-1)!.text).toContain('state is unavailable'); expect(JSON.stringify(result)).not.toContain('outdated adopted state'); expect(f.warn).toHaveBeenCalledTimes(1)
  })
  it('does not read state after cancellation or append a context after a cancelled read', async () => {
    const f = fixture(); f.controller.abort()
    expect(await withCurrentComparisonState(f.context, f.next, f)).toBe(f.assembly); expect(f.latest).not.toHaveBeenCalled()
    const g = fixture(); g.latest.mockImplementation(async () => { g.controller.abort(); return g.record })
    expect(await withCurrentComparisonState(g.context, g.next, g)).toBe(g.assembly)
  })
  it('does not interpolate repository paths and does not reveal blind candidate identities', async () => {
    const f = fixture(); f.record.baseline.repoRoot += '/{{private_variable}}'; f.record.candidates[0]!.route.model = 'hidden-model'; f.record.candidates[0]!.strategy.title = 'hidden-strategy'
    const result = await withCurrentComparisonState(f.context, f.next, f), note = result.contexts.at(-1)!
    expect(note.interpolate).toBe(false); expect(note.text).toContain('{{private_variable}}')
    for (const field of ['hidden-model', 'hidden-strategy', 'inputTokens']) expect(note.text).not.toContain(field)
  })
  it.each([['adopted', true], ['needs-attention', true], ['reverted', false], ['rolled-back', false], ['blocked', false]] as const)('lists written files only while a %s adoption has them in the working tree', async (state, listed) => {
    const f = fixture(); f.record.choice = { pick: 'A', at: 1, initialPick: 'B' }
    f.record.adoption = { label: 'A', mode: 'worktree', state, startedAt: 3, writtenPaths: ['src/App.tsx'] }
    const result = await withCurrentComparisonState(f.context, f.next, f), facts = JSON.parse(result.contexts.at(-1)!.text.split('\n')[1]!)
    expect(facts).toMatchObject({ adoptionState: state, blindPick: 'B', task: f.record.task })
    expect(facts.writtenFiles).toEqual(listed ? ['src/App.tsx'] : undefined)
  })
  it.each(['adopted', 'reverted', 'blocked', 'needs-recovery'] as const)('reports exact %s state and branch/worktree distinction', async state => {
    const f = fixture(); f.record.choice = { pick: 'A', at: 1 }; f.record.adoption = { label: 'A', mode: 'branch', state, startedAt: 3 }
    const result = await withCurrentComparisonState(f.context, f.next, f), facts = JSON.parse(result.contexts.at(-1)!.text.split('\n')[1]!)
    expect(facts.adoptionState).toBe(state); expect(facts.adoptionMode).toBe('branch')
  })
})

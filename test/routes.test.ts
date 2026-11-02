import { describe, expect, it } from 'vitest'
import { observedRoute, selectedRoute } from '../src/host/routes.ts'
import { usageFromEvents } from '../src/host/index.ts'

describe('observed model routes and usage', () => {
  const used = { provider: 'old-provider', model: 'old-model', reasoningEffort: 'high' }
  const pending = { provider: 'next-provider', model: 'next-model' }
  const defaults = { provider: 'default-provider', model: 'default-model' }
  const agent = (state: unknown, header: unknown = { config: used }) => ({
    ctx: { get: (name: string) => name === 'sessionProjections' ? { stateOf: () => state } : name === 'agentDefaultModel' ? { currentSelection: () => defaults } : undefined },
    session: { requestHeader: () => header == null ? undefined : header as { config: typeof used } }, options: { provider: 'constructor-provider', model: 'constructor-model' },
  })

  it('freezes the pending session selection ahead of the last used route and constructor options', () => {
    expect(selectedRoute(agent({ pending, lastUsed: used }))).toEqual(pending)
    expect(observedRoute(agent({ pending }))).toEqual(used)
  })
  it('uses the recorded request or deployment default when nothing is pending', () => {
    expect(selectedRoute(agent({ pending: null }))).toEqual(used)
    expect(selectedRoute(agent({ pending: null }, null))).toEqual(defaults)
    expect(observedRoute(agent({}, null))).toBeUndefined()
    expect(observedRoute(agent({}, { config: used, adapterDefaults: { reasoningEffort: true } }))).toEqual({ provider: used.provider, model: used.model })
  })
  it('keeps absent usage unknown and derives only totals with both known components', () => {
    const event = (usage: unknown) => ({ type: 'assistant/message', data: { usage } })
    expect(usageFromEvents([event({})])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ inputTokens: 123 })])).toEqual({ kind: 'reported', inputTokens: 123 })
    expect(usageFromEvents([event({ inputTokens: 10, outputTokens: 2 })])).toEqual({ kind: 'reported', inputTokens: 10, outputTokens: 2, totalTokens: 12 })
    expect(usageFromEvents([event({ inputTokens: 10, outputTokens: 2 }), event(undefined)])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ totalTokens: -1, outputTokens: Infinity })])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ totalTokens: 0 })])).toEqual({ kind: 'reported', totalTokens: 0 })
  })
})

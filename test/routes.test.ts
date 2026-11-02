import { describe, expect, it } from 'vitest'
import { observedRoute, selectedRoute } from '../src/host/routes.ts'
import { progressOf, usageFromEvents } from '../src/host/index.ts'

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
  const event = (usage: unknown) => ({ type: 'assistant/message', data: { usage } })
  it('keeps absent usage and absent totals unknown', () => {
    expect(usageFromEvents([event({})])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ inputTokens: 123 })])).toEqual({ kind: 'reported', inputTokens: 123 })
    expect(usageFromEvents([event({ inputTokens: 10, outputTokens: 2 })])).toEqual({ kind: 'reported', inputTokens: 10, outputTokens: 2 })
    expect(usageFromEvents([event({ inputTokens: 10, outputTokens: 2 }), event(undefined)])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ totalTokens: -1, outputTokens: Infinity })])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ totalTokens: 0 })])).toEqual({ kind: 'reported', totalTokens: 0 })
  })
  it('preserves cache reads and writes without inventing a smaller total', () => {
    const usage = { inputTokens: 10, outputTokens: 2, cacheReadTokens: 100, cacheWriteTokens: 50 }
    expect(usageFromEvents([event(usage)])).toEqual({ kind: 'reported', ...usage })
    expect(progressOf([event(usage)])).toEqual({ steps: 0 })
    expect(usageFromEvents([event({ ...usage, totalTokens: 162 }), event({ ...usage, totalTokens: 162 })]))
      .toEqual({ kind: 'reported', inputTokens: 20, outputTokens: 4, cacheReadTokens: 200, cacheWriteTokens: 100, totalTokens: 324 })
    expect(progressOf([event({ ...usage, totalTokens: 162 })])).toEqual({ steps: 0, tokens: 162 })
  })
  it('does not display a contradictory total, including a reported zero', () => {
    const components = { inputTokens: 10, outputTokens: 2, cacheReadTokens: 100, cacheWriteTokens: 50 }
    for (const totalTokens of [0, 12, 161]) {
      expect(usageFromEvents([event({ ...components, totalTokens })])).toEqual({ kind: 'reported', ...components })
      expect(progressOf([event({ ...components, totalTokens })]).tokens).toBeUndefined()
    }
  })
  it('aggregates a field only when every message reports it', () => {
    const complete = { inputTokens: 10, outputTokens: 2, cacheReadTokens: 100, totalTokens: 112 }
    expect(usageFromEvents([event(complete), event({ inputTokens: 5, outputTokens: 1 })]))
      .toEqual({ kind: 'reported', inputTokens: 15, outputTokens: 3 })
    expect(usageFromEvents([event(complete), event({ ...complete, cacheReadTokens: undefined })]))
      .toEqual({ kind: 'reported', inputTokens: 20, outputTokens: 4, totalTokens: 224 })
  })
  it('rejects malformed, fractional, unsafe, and overflowing counts', () => {
    for (const invalid of [-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '12', null]) {
      expect(usageFromEvents([event({ inputTokens: invalid, outputTokens: invalid, totalTokens: invalid })])).toMatchObject({ kind: 'unknown' })
    }
    for (const usage of [null, [], 123, 'tokens']) expect(usageFromEvents([event(usage)])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([event({ totalTokens: Number.MAX_SAFE_INTEGER }), event({ totalTokens: 1 })])).toMatchObject({ kind: 'unknown' })
    expect(usageFromEvents([])).toMatchObject({ kind: 'unknown' })
  })
})

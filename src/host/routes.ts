import type { AgentRoute } from '../core/types.ts'

interface RouteAgent {
  ctx: { get(name: string): unknown }
  session: { requestHeader?(): { config?: AgentRoute; adapterDefaults?: { reasoningEffort?: boolean } } | undefined }
  options?: AgentRoute
}

const routeOf = (value: AgentRoute | undefined): AgentRoute | undefined => value?.provider && value.model
  ? { provider: value.provider, model: value.model, ...(typeof value.reasoningEffort === 'string' ? { reasoningEffort: value.reasoningEffort } : {}) }
  : undefined

/** Follow the published session controller: pending selection, used request, deployment default. */
export function selectedRoute(agent: RouteAgent): AgentRoute {
  const projections = agent.ctx.get('sessionProjections') as { stateOf(session: unknown, key: string): { pending?: AgentRoute | null; lastUsed?: AgentRoute | null } | undefined } | undefined
  const state = projections?.stateOf(agent.session, 'modelSelection')
  const pending = routeOf(state?.pending ?? undefined)
  if (pending) return pending
  const observed = observedRoute(agent)
  if (observed) return observed
  const used = routeOf(state?.lastUsed ?? undefined)
  if (used) return used
  const defaults = agent.ctx.get('agentDefaultModel') as { currentSelection(): AgentRoute } | undefined
  return routeOf(defaults?.currentSelection()) ?? routeOf(agent.options) ?? {}
}

/** Only a persisted request header proves which route actually executed. */
export function observedRoute(agent: Pick<RouteAgent, 'session'>): AgentRoute | undefined {
  const header = agent.session.requestHeader?.()
  const route = routeOf(header?.config)
  if (!route) return undefined
  if (header?.adapterDefaults?.reasoningEffort) return { provider: route.provider, model: route.model }
  return route
}

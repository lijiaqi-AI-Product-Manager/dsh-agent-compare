const routeOf = (value) => value?.provider && value.model
    ? { provider: value.provider, model: value.model, ...(typeof value.reasoningEffort === 'string' ? { reasoningEffort: value.reasoningEffort } : {}) }
    : undefined;
/** Follow the published session controller: pending selection, used request, deployment default. */
export function selectedRoute(agent) {
    const projections = agent.ctx.get('sessionProjections');
    const state = projections?.stateOf(agent.session, 'modelSelection');
    const pending = routeOf(state?.pending ?? undefined);
    if (pending)
        return pending;
    const observed = observedRoute(agent);
    if (observed)
        return observed;
    const used = routeOf(state?.lastUsed ?? undefined);
    if (used)
        return used;
    const defaults = agent.ctx.get('agentDefaultModel');
    return routeOf(defaults?.currentSelection()) ?? routeOf(agent.options) ?? {};
}
/** Only a persisted request header proves which route actually executed. */
export function observedRoute(agent) {
    const header = agent.session.requestHeader?.();
    const route = routeOf(header?.config);
    if (!route)
        return undefined;
    if (header?.adapterDefaults?.reasoningEffort)
        return { provider: route.provider, model: route.model };
    return route;
}

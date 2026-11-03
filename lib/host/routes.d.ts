import type { AgentRoute } from '../core/types.ts';
interface RouteAgent {
    ctx: {
        get(name: string): unknown;
    };
    session: {
        requestHeader?(): {
            config?: AgentRoute;
            adapterDefaults?: {
                reasoningEffort?: boolean;
            };
        } | undefined;
    };
    options?: AgentRoute;
}
/** Follow the published session controller: pending selection, used request, deployment default. */
export declare function selectedRoute(agent: RouteAgent): AgentRoute;
/** Only a persisted request header proves which route actually executed. */
export declare function observedRoute(agent: Pick<RouteAgent, 'session'>): AgentRoute | undefined;
export {};

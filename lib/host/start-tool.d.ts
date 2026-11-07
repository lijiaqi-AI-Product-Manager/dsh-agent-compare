import type { AgentRoute, StartInput } from '../core/index.ts';
import type { AbPreferences } from './preferences.ts';
export interface StartToolArgs {
    task: string;
    mode?: 'same-model' | 'cross-model';
    time_limit_minutes?: number;
}
/** A background comparison takes ownership only after start has admitted it. */
export declare function startToolComparison<A extends {
    session: {
        id: string;
    };
}>(args: StartToolArgs, exec: {
    agent: A;
    signal: AbortSignal;
    callId?: string;
}, ports: {
    preferences(sessionId: string): Promise<AbPreferences>;
    currentRoute(agent: A): AgentRoute;
    repoFor(agent: A, signal: AbortSignal): Promise<string>;
    start(input: StartInput): Promise<{
        runId: string;
        state: string;
    }>;
    /** The saved main-conversation context for both candidates, if any. */
    conversationContext?(agent: A, saved: AbPreferences): Promise<StartInput['conversationContext']>;
}): Promise<{
    runId: string;
    state: string;
    background: true;
    next: string;
}>;

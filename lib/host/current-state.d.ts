import type { RunRecord } from '../core/types.ts';
export declare const CURRENT_STATE_CONTEXT = "agent-compare:current-state";
interface Caller {
    session: {
        id: string;
        header?: {
            origin?: string;
            delegationDepth?: number;
        };
    };
}
export interface ComparisonAssembly {
    contexts: Array<{
        name: string;
        text: string;
        interpolate?: boolean;
    }>;
    [key: string]: unknown;
}
interface AssemblyContext {
    agent?: Caller;
    scope?: unknown;
    signal?: AbortSignal;
}
interface Dependencies {
    latest(sessionId: string): Promise<RunRecord | undefined>;
    warn(message: string): void;
}
/** Resolve current facts in this agent's prompt assembly. No inbox messages or
 * steps are created, and other modules' prompt contributions stay intact. */
export declare function withCurrentComparisonState(context: AssemblyContext, next: () => Promise<ComparisonAssembly>, deps: Dependencies): Promise<ComparisonAssembly>;
export {};

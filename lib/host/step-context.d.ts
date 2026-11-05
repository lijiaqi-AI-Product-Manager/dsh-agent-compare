import type { RunRecord } from '../core/types.ts';
interface Caller {
    session: {
        id: string;
        header?: {
            origin?: string;
            delegationDepth?: number;
        };
    };
}
export type StepDecision = {
    kind: 'reject';
} | {
    kind: 'enter';
    messages: unknown[];
    startsRequestSeries?: true;
};
interface Dependencies {
    latest(sessionId: string): Promise<RunRecord | undefined>;
    createMessage(): Promise<(message: unknown) => unknown>;
    warn(message: string): void;
}
/** Admit one current-state note with an existing main-conversation batch.
 * Empty batches must stay empty so this listener cannot keep a turn running. */
export declare function withCurrentComparison(payload: {
    agent: Caller;
    signal: AbortSignal;
}, next: () => Promise<StepDecision>, deps: Dependencies): Promise<StepDecision>;
export {};

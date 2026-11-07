import type { RunRecord } from '../core/types.ts';
/**
 * Conversation memory delivered inside the owning conversation's own steps.
 *
 * DSH admits durable context through the `agent/pre-step` waterfall: messages
 * returned there enter the request and the session log together. Queuing with
 * `agent.inject` from outside could miss a request whose batch was already
 * claimed, was discarded on cancellation, and needed the conversation to be
 * attached. Here every step of the owning conversation checks which current
 * comparison facts its log does not contain yet and adds them to that step.
 */
export interface MemorySession {
    readonly id: string;
    readonly seq: number;
    snapshotEvents(from: number): readonly {
        readonly type: string;
        readonly data?: unknown;
    }[];
}
export interface PendingNote {
    readonly runId: string;
    readonly milestone: string;
    readonly text: string;
}
export declare class StepMemory {
    private readonly deps;
    private readonly scans;
    constructor(deps: {
        /** Records owned by the conversation. */
        records(sessionId: string): Promise<readonly RunRecord[]>;
        createMessage(): Promise<((message: unknown) => unknown) | undefined>;
    });
    /** Comparison facts this conversation's log does not contain yet, oldest first. */
    pending(session: MemorySession): Promise<PendingNote[]>;
    /** Model-facing messages for the pending notes, or none when the host cannot build messages. */
    messages(session: MemorySession): Promise<unknown[]>;
    /** Whether the conversation's log already holds the record's current fact. */
    delivered(session: MemorySession, record: RunRecord): boolean | undefined;
    /** Read only the log entries appended since the previous scan of this session. */
    private scan;
}
export interface StepPayload<A> {
    readonly agent?: A;
    readonly step?: number;
    readonly signal?: AbortSignal;
}
export type StepDecision = {
    readonly kind: 'reject';
} | {
    readonly kind: 'enter';
    readonly messages: readonly unknown[];
};
/**
 * The `agent/pre-step` waterfall: pending comparison facts go ahead of the
 * step's own messages, so the user's message stays the latest input. Only an
 * admitted step of a top-level conversation is changed; an unexpected payload
 * or a failure leaves the step exactly as the host decided.
 */
export declare function withComparisonNotes<A extends {
    readonly session?: MemorySession;
}>(payload: StepPayload<A> | undefined, next: () => Promise<StepDecision>, deps: {
    memory: Pick<StepMemory, 'messages'>;
    delegated(agent: A): boolean;
    warn(message: string): void;
}): Promise<StepDecision>;

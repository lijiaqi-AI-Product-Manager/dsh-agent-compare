import type { RunRecord } from '../core/types.ts';
interface MemoryAgent {
    session: {
        snapshotEvents(from: number): readonly {
            type: string;
            data?: unknown;
        }[];
    };
    inbox?: {
        nextTurn: readonly unknown[];
        nextStep: readonly unknown[];
    };
    inject?(message: unknown): void;
}
/** Retry unavailable conversations; deduplicate against their durable messages and live inbox. */
export declare class ConversationMemory {
    private readonly deps;
    private readonly delivered;
    private readonly pending;
    private readonly undelivered;
    private readonly latestKey;
    private readonly latestRevision;
    constructor(deps: {
        findAgent(sessionId: string): MemoryAgent | undefined;
        createMessage(): Promise<((message: unknown) => unknown) | undefined>;
        warn(message: string): void;
    });
    remember(record: RunRecord): Promise<void>;
    /** No disk scan while idle; inactive sessions wait until an agent is attached. */
    retryUndelivered(load: (runId: string) => Promise<RunRecord | undefined>): Promise<void>;
}
export {};

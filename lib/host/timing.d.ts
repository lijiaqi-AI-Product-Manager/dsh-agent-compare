/** Observed event intervals. Other step time is not pure model waiting. */
export interface TimedEvent {
    readonly type: string;
    readonly time?: number;
    readonly data?: any;
}
export declare function sessionTiming(events: readonly TimedEvent[]): {
    stepMs?: number;
    toolMs?: number;
    otherStepMs?: number;
    completedSteps: number;
    completedCalls: number;
    incomplete: number;
    tools: Array<{
        name: string;
        calls: number;
        completed: number;
        wallMs?: number;
    }>;
};

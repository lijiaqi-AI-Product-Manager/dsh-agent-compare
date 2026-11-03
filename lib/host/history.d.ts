import type { RunRecord } from '../core/types.ts';
import type { LegacySummary, RunStore } from '../core/run-store.ts';
export interface HistoryMeta {
    readonly version: 1;
    readonly scope: 'all' | 'session';
    readonly query: string;
    readonly total: number;
    readonly offset: number;
    readonly limit: number;
    readonly hasNext: boolean;
    readonly onlyUnavailable: boolean;
    readonly unavailable: number;
}
export declare class HistoryQueryError extends Error {
    constructor(message: string);
}
/** Pages retained records without changing them; inline readers default to their own session. */
export declare function historyPage(store: RunStore, input: Record<string, unknown>): Promise<{
    runs: RunRecord[];
    legacy: LegacySummary[];
    history: HistoryMeta;
}>;

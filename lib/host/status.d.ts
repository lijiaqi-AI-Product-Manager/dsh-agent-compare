import type { Comparer } from '../core/orchestrator.ts';
import type { RunRecord } from '../core/types.ts';
interface StatusCaller {
    readonly session: {
        readonly id: string;
        readonly header: {
            readonly origin?: string;
        };
    };
}
type StatusResult = {
    error: string;
} | {
    record: RunRecord;
    control: Awaited<ReturnType<Comparer['control']>>;
};
/** Status may reconcile an orphan, so delegated callers cannot use this path
 * to manage resources outside their assigned implementation. */
export declare function readComparisonStatus(comparer: Comparer, caller: StatusCaller | undefined, runId?: string, signal?: AbortSignal): Promise<StatusResult>;
export {};

import type { Comparer } from '../core/orchestrator.ts';
export declare const CONVERSATION_ACTIONS: ReadonlySet<string>;
type Caller = {
    session: {
        id: string;
        header?: {
            origin?: string;
        };
    };
} | undefined;
interface DispatchOptions {
    method: string;
    comparer: Pick<Comparer, 'get'>;
    caller(): Promise<Caller>;
    runId(): string;
    confirmation: unknown;
    signal?: AbortSignal;
}
/** Keep endpoint dispatch and its authorization in one exercised path. */
export declare function dispatchComparisonAction<T>(options: DispatchOptions, invoke: () => Promise<T>): Promise<T>;
/** A misspelled control route must fail during setup rather than be omitted. */
export declare function assertComparisonActionRoutes(api: Readonly<Record<string, unknown>>): void;
/** Resolve the caller through the host before this check. A confirmation records
 * cross-conversation intent; it does not replace the host's access permissions. */
export declare function authorizeComparisonAction(comparer: Pick<Comparer, 'get'>, caller: {
    session: {
        id: string;
        header?: {
            origin?: string;
        };
    };
} | undefined, runId: string, confirmation: unknown, signal?: AbortSignal): Promise<void>;
export {};

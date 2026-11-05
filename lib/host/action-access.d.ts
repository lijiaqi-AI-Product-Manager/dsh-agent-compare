import type { Comparer } from '../core/orchestrator.ts';
export declare const CONVERSATION_ACTIONS: ReadonlySet<string>;
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

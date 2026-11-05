import { type RunRecord } from './types.ts';
export interface CopyResource {
    readonly label: string;
    readonly path: string;
    readonly bytes: number;
    readonly files: number;
    readonly links: number;
    readonly stopsPreview: boolean;
    readonly reason?: string;
}
export interface CopyCleanupPlan {
    readonly version: 1;
    readonly runId: string;
    readonly rev: number;
    readonly state: string;
    readonly allowed: boolean;
    readonly reasons: string[];
    readonly resources: CopyResource[];
    readonly bytes: number;
    readonly token: string;
    readonly retained?: {
        readonly gitRefs?: number;
        readonly childSessions: number;
        readonly sealedPatches: number;
        readonly sourceRepository: string;
    };
}
/** Inspect only. Never follows dependency links or deletes user material. */
export declare function planCopyCleanup(record: RunRecord, signal?: AbortSignal): Promise<CopyCleanupPlan>;

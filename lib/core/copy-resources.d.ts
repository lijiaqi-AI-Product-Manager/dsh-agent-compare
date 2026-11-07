import { type RunRecord } from './types.ts';
export interface CopyResource {
    readonly label: string;
    readonly path: string;
    readonly bytes: number;
    readonly files: number;
    readonly links: number;
    readonly stopsPreview: boolean;
    readonly reason?: string;
    /** Dependency and cache directories were sized within a time budget; the totals are a lower bound. */
    readonly estimated?: boolean;
}
export interface CopyScanLimits {
    /** Directory entries outside dependency and cache directories. */
    readonly entries?: number;
    readonly deadlineMs?: number;
    /** Size dependency and cache directories for display. Release skips it. */
    readonly measureDependencies?: boolean;
    readonly dependencyEntries?: number;
    readonly dependencyDeadlineMs?: number;
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
export declare function planCopyCleanup(record: RunRecord, signal?: AbortSignal, limits?: CopyScanLimits): Promise<CopyCleanupPlan>;

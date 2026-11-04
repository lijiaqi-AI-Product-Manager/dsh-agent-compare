import { type RunRecord } from './types.ts';
import { type FileLease } from './file-lock.ts';
export { BusyError } from './file-lock.ts';
/** Short root: Windows paths stay well under MAX_PATH even inside deep copies. */
export declare function defaultHome(): string;
export declare function newRunId(): string;
/** Read-only history: an older format or an entry that cannot safely be loaded. */
export interface LegacySummary {
    readonly runId: string;
    readonly schema: string;
    readonly task: string;
    readonly createdAt: number;
    readonly state: string;
    readonly legacy: true;
    readonly unavailable?: true;
    readonly reason?: string;
}
export declare class RecordUnavailableError extends Error {
    constructor(runId: string, reason: string);
}
export declare class StaleRecordError extends Error {
    constructor(runId: string);
}
/** Stable key for "the same repository", whatever spelling or symlink reached it. */
export declare function repoKey(repo: string): string;
export declare class RunStore {
    private readonly historyCache;
    private historyCacheBytes;
    readonly runsDir: string;
    readonly worktreesDir: string;
    readonly artifactsDir: string;
    readonly locksDir: string;
    readonly examplesDir: string;
    readonly home: string;
    constructor(home?: string);
    file(runId: string): string;
    artifacts(runId: string): string;
    /** Where `own-root` copies of one run live. */
    copies(runId: string): string;
    /**
     * Atomically write `record`, refusing when the stored copy has moved on
     * since `record` was read (another process or a concurrent operation saved
     * in between). On success `record.rev` is the new revision.
     */
    save(record: RunRecord): Promise<void>;
    private readEntry;
    load(runId: string): Promise<RunRecord | undefined>;
    loadLegacy(runId: string): Promise<LegacySummary | undefined>;
    /** Current records, newest first. */
    list(): Promise<RunRecord[]>;
    listAll(): Promise<{
        current: RunRecord[];
        legacy: LegacySummary[];
    }>;
    private forgetHistory;
    private historyStamp;
    private historyEntry;
    /** Cross-process lock. Its persistent SQLite guard is never removed. */
    withLock<T>(key: string, fn: () => Promise<T>, opts?: {
        waitMs?: number;
        busyMessage?: string;
    }): Promise<T>;
    /** Hold across asynchronous work, including the lifetime of a live run. */
    acquireLock(key: string, opts?: {
        waitMs?: number;
        busyMessage?: string;
    }): Promise<FileLease>;
}

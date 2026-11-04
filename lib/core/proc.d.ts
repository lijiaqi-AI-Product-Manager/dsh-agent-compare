import { type ChildProcess } from 'node:child_process';
/** Keep the initial failure explanation as well as the final diagnostic lines. */
export declare function diagnosticText(text: string, max?: number): string;
/** Keep at most `max` trailing characters of a growing log. */
export declare class Tail {
    private readonly max;
    private buf;
    constructor(max?: number);
    push(chunk: string): void;
    toString(): string;
}
/** Bounded preview diagnostics retaining the first error instead of only its stack tail. */
export declare class DiagnosticLog extends Tail {
    private readonly limit;
    private prefix;
    private total;
    constructor(limit?: number);
    push(chunk: string): void;
    toString(): string;
}
export interface RunResult {
    readonly code: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly timedOut: boolean;
    readonly aborted: boolean;
    /** True when output exceeded `maxOutput` and was cut; callers needing exact output must fail. */
    readonly truncated: boolean;
}
export interface RunOptions {
    readonly cwd: string;
    readonly env?: NodeJS.ProcessEnv;
    readonly input?: string;
    readonly timeoutMs?: number;
    readonly signal?: AbortSignal;
    /** Cap on captured stdout/stderr each (bytes of text). */
    readonly maxOutput?: number;
}
/** A stop request did not establish that the whole process tree exited. */
export declare class ProcessStopError extends Error {
    readonly pid: number | undefined;
    constructor(pid: number | undefined);
}
/**
 * Resolve an executable on PATH. On Windows this honours PATHEXT, so `npm`
 * resolves to `npm.cmd`. Returns undefined when nothing matches.
 */
export declare function which(command: string, envPath?: string): string | undefined;
export interface SpawnSpec {
    readonly file: string;
    readonly args: readonly string[];
    readonly shell: boolean;
}
/**
 * Build a spawn spec that works for real executables and Windows `.cmd` shims.
 * Node refuses to spawn `.cmd` files without a shell (CVE-2024-27980), so shims
 * go through cmd.exe with every argument quoted.
 */
export declare function spawnSpec(argv: readonly string[]): SpawnSpec;
/** Run a command to completion, capturing bounded output. Never throws on non-zero exit. */
export declare function run(argv: readonly string[], opts: RunOptions): Promise<RunResult>;
/** Run and throw with a bounded message unless the exit code is 0. */
export declare function runOk(argv: readonly string[], opts: RunOptions): Promise<string>;
/**
 * Terminate a process and all of its descendants. On Windows `taskkill /T`
 * walks the tree (shims spawn grandchildren); elsewhere children were started
 * in their own process group, so the group is signalled.
 */
export declare function killTree(pid: number | undefined): Promise<void>;
/** True when a pid currently names a live process. */
export declare function isAlive(pid: number): boolean;
export type ProcessObservation = {
    readonly state: 'gone';
} | {
    readonly state: 'observed';
    readonly commandLine: string;
} | {
    readonly state: 'unavailable';
    readonly reason: string;
};
/** A missing observation is uncertainty, never proof that a process exited. */
export declare function observeProcess(pid: number, timeoutMs?: number): Promise<ProcessObservation>;
/** The command line when observation succeeded; callers needing certainty use observeProcess. */
export declare function processCommandLine(pid: number): Promise<string | undefined>;
/**
 * True only when `pid` is alive AND its command line names every marker (for
 * a preview: the copy's vite binary path and its port). A recycled pid that now
 * belongs to something else fails this, so it is never killed.
 */
export declare function ownsProcess(pid: number, markers: readonly string[]): Promise<boolean>;
/** Complete command markers, including numeric-port boundaries. */
export declare function commandHasMarkers(line: string, markers: readonly string[], windows?: boolean): boolean;
/** Wait until `pid` has exited; false when it is still alive after `timeoutMs`. */
export declare function waitGone(pid: number, timeoutMs?: number): Promise<boolean>;
/** Start a long-running process with streaming output. The caller owns its lifetime. */
export declare function startLongRunning(argv: readonly string[], opts: {
    cwd: string;
    env?: NodeJS.ProcessEnv;
}): ChildProcess;

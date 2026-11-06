import { type RunOptions, type RunResult } from './proc.ts';
import type { WindowsCompatEvidence, WindowsProcessCompatMode } from './windows-compat.ts';
/** A host-prepared process: argv already carries its enforced file-write policy. */
export interface PreparedProjectProcess {
    readonly argv: readonly string[];
    readonly env: NodeJS.ProcessEnv;
    /** Undefined is unknown; trusted fixture runners cannot claim host enforcement. */
    readonly enforcement?: 'full' | 'partial';
    readonly windowsProcessCompat?: WindowsCompatEvidence;
    readonly observeStderr?: (chunk: string) => void;
}
export interface ProjectProcessRequest {
    readonly argv: readonly string[];
    readonly cwd: string;
    /** Deliberate command settings only; never spread the ambient environment here. */
    readonly env?: NodeJS.ProcessEnv;
    readonly signal?: AbortSignal;
    readonly windowsProcessCompat?: WindowsProcessCompatMode;
}
export type PrepareProjectProcess = (request: ProjectProcessRequest) => Promise<PreparedProjectProcess>;
export declare function prepareProjectProcess(request: ProjectProcessRequest, prepare?: PrepareProjectProcess): Promise<PreparedProjectProcess>;
/** Every installation and acceptance command must cross the same host boundary. */
export declare function runProjectProcess(argv: readonly string[], opts: RunOptions, prepare?: PrepareProjectProcess): Promise<RunResult>;

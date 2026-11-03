import { Tail } from './proc.ts';
import { type PrepareProjectProcess } from './project-process.ts';
/** Ask the OS for a free loopback port. The caller still uses --strictPort, so a race fails loudly. */
export declare function freePort(): Promise<number>;
export interface Preview {
    readonly url: string;
    readonly port: number;
    readonly pid: number;
    readonly log: Tail;
    stop(): Promise<void>;
}
export declare class PreviewError extends Error {
    readonly log: string;
    constructor(message: string, log: string);
}
/**
 * Serve a copy on a dedicated loopback port and return only after it answers
 * HTTP. `build` serves the output of the build the checks just ran (`vite
 * preview`), so what the user tries is the artifact that passed; `dev` runs the
 * dev server and is used only when there is no build to serve. The Vite binary
 * runs on the host Node directly, so the pid is the server itself, not a shim.
 */
export declare function startVitePreview(dir: string, opts?: {
    kind?: 'build' | 'dev';
    timeoutMs?: number;
    signal?: AbortSignal;
    prepareProjectProcess?: PrepareProjectProcess;
}): Promise<Preview>;

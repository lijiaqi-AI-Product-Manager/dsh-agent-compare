import { Tail } from './proc.ts';
import { type PrepareProjectProcess } from './project-process.ts';
import type { PreviewInfo } from './types.ts';
/** Ask the OS for a free loopback port. The caller still uses --strictPort, so a race fails loudly. */
export declare function freePort(host?: string): Promise<number>;
export interface Preview {
    readonly url: string;
    readonly port: number;
    readonly pid: number;
    readonly log: Tail;
    readonly launcher?: 'yarn';
    stop(): Promise<void>;
}
/** A persisted Yarn wrapper must name this exact project and preview port. */
export declare function isPreviewProcess(preview: PreviewInfo, commandLine: string, windows?: boolean): boolean;
export declare class PreviewError extends Error {
    readonly log: string;
    constructor(message: string, log: string);
}
/**
 * Serve a copy on a dedicated loopback port and return only after it answers
 * HTTP. `build` serves the output of the build the checks just ran (`vite
 * preview`), so what the user tries is the artifact that passed; `dev` runs the
 * dev server and is used only when there is no build to serve. The Vite binary
 * runs on the host Node directly, except modern Yarn's project-aware loader;
 * its wrapper and the complete child tree share this preview's lifecycle.
 */
export declare function startVitePreview(dir: string, opts?: {
    kind?: 'build' | 'dev';
    timeoutMs?: number;
    signal?: AbortSignal;
    prepareProjectProcess?: PrepareProjectProcess;
    loopbackHost?: string;
}): Promise<Preview>;

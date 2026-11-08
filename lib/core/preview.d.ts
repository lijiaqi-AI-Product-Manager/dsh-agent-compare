import { Tail } from './proc.ts';
import { type PrepareProjectProcess } from './project-process.ts';
import type { PreviewInfo } from './types.ts';
/** Ask the OS for a free loopback port. The caller still uses --strictPort, so a race fails loudly. */
export declare function freePort(): Promise<number>;
export interface Preview {
    readonly url: string;
    readonly port: number;
    readonly pid: number;
    readonly log: Tail;
    readonly launcher?: 'yarn';
    stop(): Promise<void>;
}
/**
 * The helper that serves static files and wraps script previews. It is plain
 * compiled CommonJS next to this module; from source (tests), the build output.
 */
export declare const PREVIEW_RUNNER: string;
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
}): Promise<Preview>;
/**
 * Serve a folder of static files (an `index.html` page, or another entry
 * page) through the preview helper. No project code runs; the helper only
 * reads files inside `dir`.
 */
export declare function startStaticPreview(dir: string, entry: string, opts?: {
    timeoutMs?: number;
    signal?: AbortSignal;
}): Promise<Preview>;
/**
 * Run a project's own `dev` or `start` script as a preview. The script runs
 * inside the host's process boundary like every other project command; the
 * helper only owns its process tree. `PORT` and `HOST` ask the server for this
 * preview's loopback port; a server that ignores them never answers there and
 * the preview ends as "no live page".
 */
export declare function startScriptPreview(dir: string, command: readonly string[], opts?: {
    timeoutMs?: number;
    signal?: AbortSignal;
    prepareProjectProcess?: PrepareProjectProcess;
}): Promise<Preview>;

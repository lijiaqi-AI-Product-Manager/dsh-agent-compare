import type { PrepareProjectProcess } from '../core/project-process.ts';
import type { WindowsProcessCompatMode } from '../core/windows-compat.ts';
/** Matches the current host's public process-confinement seam. */
export interface ProjectSandbox {
    confine(argv: readonly string[], policy: {
        mode: 'workspace-write';
        workspaceRoot: string;
    }, signal?: AbortSignal): Promise<{
        argv: string[];
        enforcement: 'full' | 'partial';
    }>;
}
/** Public profileContext packageManager shape supplied by packaged hosts. */
export interface ManagedPnpm {
    readonly command: string;
    readonly args: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
}
interface CommandResolution {
    readonly path?: string;
    readonly pnpm?: ManagedPnpm;
}
/** Resolve shell shims before confinement, but interpret them only inside it. */
export declare function projectCommandArgv(argv: readonly string[], cwd: string, platform?: NodeJS.Platform, resolution?: CommandResolution): string[];
/**
 * The canonical scrub is supplied by the host; no credential-bearing ambient
 * environment is copied back over it. Each copy owns its package caches.
 */
export declare function createProjectProcess(sandbox: () => ProjectSandbox | undefined, baseEnvironment?: () => Promise<NodeJS.ProcessEnv>, windowsProcessModule?: string, bundledPnpm?: () => ManagedPnpm | undefined, windowsProcessCompat?: WindowsProcessCompatMode): PrepareProjectProcess;
export {};

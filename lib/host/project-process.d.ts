import type { PrepareProjectProcess } from '../core/project-process.ts';
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
/** Resolve shell shims before confinement, but interpret them only inside it. */
export declare function projectCommandArgv(argv: readonly string[], cwd: string, platform?: NodeJS.Platform): string[];
/**
 * The canonical scrub is supplied by the host; no credential-bearing ambient
 * environment is copied back over it. Each copy owns its package caches.
 */
export declare function createProjectProcess(sandbox: () => ProjectSandbox | undefined, baseEnvironment?: () => Promise<NodeJS.ProcessEnv>, windowsProcessModule?: string): PrepareProjectProcess;

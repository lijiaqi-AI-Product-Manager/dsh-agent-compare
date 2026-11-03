import type { Acceptance, ChecksSpec } from './types.ts';
export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export interface ProjectInfo {
    readonly kind: 'vite' | 'unsupported';
    readonly packageManager: PackageManager;
    readonly lockfile?: string;
    readonly scripts: Record<string, string>;
    readonly reason?: string;
}
export declare const LOCKFILES: readonly ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'];
export declare function inspectProject(dir: string): Promise<ProjectInfo>;
/**
 * Install argv. With a lockfile the install is always frozen: a candidate that
 * changed dependencies without updating the lockfile fails here instead of
 * being resolved to a different tree than the one it will be adopted with.
 */
export declare function installArgv(info: ProjectInfo): {
    argv: string[];
    frozen: boolean;
};
export declare function scriptArgv(info: ProjectInfo, script: string): string[];
/**
 * The shared checks, derived once from the BASELINE (never from a candidate).
 * The build always runs, last, because the preview serves its output.
 */
export declare function defaultChecks(info: ProjectInfo): ChecksSpec;
/** The optional repository file that defines the acceptance (read from the baseline tree). */
export declare const ACCEPTANCE_FILE = ".agent-compare.json";
export declare const isBound: (p: string) => boolean;
/** Build the acceptance for a baseline tree. `override` (tests, API) replaces the derived checks. */
export declare function buildAcceptance(repo: string, tree: string, info: ProjectInfo, override?: ChecksSpec): Promise<Acceptance>;
/**
 * What a candidate changed that the acceptance is bound to, and whether it
 * changed dependencies. Returned paths read like `tsconfig.json` or
 * `package.json scripts.test`.
 */
export declare function acceptanceChanges(repo: string, acceptance: Acceptance, baseTree: string, candTree: string): Promise<{
    touched: string[];
    dependencyChange: boolean;
}>;

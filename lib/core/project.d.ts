import type { Acceptance, ChecksSpec } from './types.ts';
export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export interface ProjectInfo {
    readonly kind: 'vite' | 'unsupported';
    readonly packageManager: PackageManager;
    /** Exact manifest declaration, including its optional integrity suffix. */
    readonly packageManagerSpec?: string;
    readonly packageManagerVersion?: string;
    readonly modernYarn?: boolean;
    readonly lockfile?: string;
    readonly scripts: Record<string, string>;
    readonly reason?: string;
    readonly warning?: string;
    /** A usable package.json whose only gap is Vite: installs and scripts still work. */
    readonly node?: boolean;
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
/** An exact declared manager must be ready before either model receives work. */
export declare function managerVersionIssue(info: ProjectInfo, observed: string | undefined, platform?: NodeJS.Platform): string | undefined;
/**
 * The shared checks, derived once from the BASELINE (never from a candidate).
 * The build always runs, last, because the preview serves its output.
 */
export declare function defaultChecks(info: ProjectInfo): ChecksSpec;
/**
 * How a project directory is installed, checked and shown:
 * - `vite`: a Vite project (frozen install, shared checks, built preview).
 * - `node-web`: a usable package.json with a `dev` or `start` script.
 * - `node`: a usable package.json without a server script (checks only).
 * - `static`: an HTML page with no usable package.json, served as files.
 * - `files`: anything else; the written files and the answer are the result.
 */
export type ProjectProfile = 'vite' | 'node-web' | 'node' | 'static' | 'files';
export interface ProfiledProject {
    readonly profile: ProjectProfile;
    readonly info: ProjectInfo;
    /** The server script of `node-web`. */
    readonly script?: 'dev' | 'start';
    /** The page `static` serves at `/`. */
    readonly entry?: string;
    /** Why a package.json could not be used (its install and scripts are skipped). */
    readonly note?: string;
}
/** The page a static site opens with: `index.html`, else the first top-level HTML file. */
export declare function staticEntry(dir: string): Promise<string | undefined>;
export declare function profileProject(dir: string): Promise<ProfiledProject>;
/** Whether a profile installs dependencies and runs package scripts. */
export declare const installsDependencies: (profile: ProjectProfile) => boolean;
/** `file` relative to the project directory, or undefined when it lies outside it. */
export declare function projectRelative(projectPath: string | undefined, file: string): string | undefined;
/** The optional repository file that defines the acceptance (read from the baseline tree). */
export declare const ACCEPTANCE_FILE = ".agent-compare.json";
export declare const isBound: (p: string) => boolean;
/**
 * Build the acceptance for a baseline tree. `override` (tests, API) replaces
 * the derived checks. `projectPath` names the project directory inside the
 * repository; verification files are recognised relative to it.
 */
export declare function buildAcceptance(repo: string, tree: string, info: ProjectInfo, override?: ChecksSpec, windowsProcessCompat?: 'auto' | 'off', projectPath?: string): Promise<Acceptance>;
/**
 * What a candidate changed that the acceptance is bound to, and whether it
 * changed dependencies. Returned paths read like `tsconfig.json` or
 * `package.json scripts.test`.
 */
export declare function acceptanceChanges(repo: string, acceptance: Acceptance, baseTree: string, candTree: string, projectPath?: string): Promise<{
    touched: string[];
    dependencyChange: boolean;
}>;

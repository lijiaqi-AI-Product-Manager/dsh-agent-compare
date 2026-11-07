export type Workspace = {
    readonly kind: 'repository';
    readonly root: string;
    readonly projectPath: string;
} | {
    readonly kind: 'folder';
    readonly folder?: string;
};
export declare function resolveWorkspace(cwd: string | undefined): Promise<Workspace>;
/** A new, empty repository for one comparison. No user templates or hooks are copied into it. */
export declare function createPrivateWorkspace(dir: string): Promise<string>;
/** Limits for turning a folder into a repository: its files are copied into both versions. */
export declare const ENABLE_GIT_LIMITS: {
    readonly files: 5000;
    readonly bytes: number;
};
export type EnableGitCheck = {
    readonly ok: true;
    readonly folder: string;
    readonly files: number;
    readonly bytes: number;
} | {
    readonly ok: false;
    readonly reason: string;
};
/**
 * Whether `folder` may become a Git repository so both versions can start
 * from its files. Counts exactly what a comparison would copy: Git's own
 * ignore rules apply, and dependency folders are left out as in every run.
 */
export declare function checkEnableGit(folder: string, opts?: {
    timeoutMs?: number;
    limits?: {
        files: number;
        bytes: number;
    };
}): Promise<EnableGitCheck>;
/** Create a repository in `folder` after `checkEnableGit` allowed it. Nothing is committed; no file changes. */
export declare function enableGit(folder: string): Promise<{
    root: string;
}>;

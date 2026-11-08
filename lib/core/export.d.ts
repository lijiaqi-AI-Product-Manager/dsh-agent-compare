/** More files than this are not saved in one go; the branch-free copy remains in the record. */
export declare const MAX_EXPORT_FILES = 5000;
/** A readable, unique folder name: the start of the task, then the run id. */
export declare function exportFolderName(task: string, runId: string): string;
/** `base` when it is free, else `base-2`, `base-3`… in the same parent. */
export declare function freeFolder(parent: string, base: string): string;
export interface ExportResult {
    readonly exportPath: string;
    readonly written: string[];
    /** Path inside the folder → SHA-256 of what was written. */
    readonly digests: Record<string, string>;
    /** Links and other special entries that were not written as files. */
    readonly skipped: string[];
}
/**
 * Write every regular file of `tree` into the new folder `target` (which must
 * not exist yet). Checkout happens privately; publication never replaces a
 * path. On failure, leave partial output for inspection instead of deleting
 * a directory another writer may already have edited.
 */
export declare function exportTree(repo: string, tree: string, scratchDir: string, target: string): Promise<ExportResult>;
/**
 * Remove a saved folder's files, but only when none of them changed since they
 * were saved; otherwise nothing is removed and the changed paths are returned.
 * The folder itself is removed only when it ends up empty.
 */
export declare function exportUndoDirectory(exportPath: string): string;
export declare function removeExport(exportPath: string, digests: Readonly<Record<string, string>>, retainedDirectory: string): Promise<{
    removed: string[];
    changed: string[];
    folderRemoved: boolean;
}>;

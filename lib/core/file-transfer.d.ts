export interface FileTransferRef {
    readonly id: string;
    readonly token: string;
}
export interface FileFingerprint {
    readonly kind: 'missing' | 'file' | 'other';
    readonly sha256?: string;
    readonly size?: number;
    readonly mode?: number;
    readonly device?: string;
    readonly inode?: string;
    readonly modified?: string;
}
interface Entry {
    path: string;
    before: FileFingerprint;
    after: FileFingerprint;
    phase: 'prepared' | 'capturing' | 'captured' | 'publishing' | 'published' | 'undoing' | 'restored';
}
interface Journal {
    schema: 'agent-compare.file-transfer/v1';
    repo: string;
    ref: FileTransferRef;
    state: 'prepared' | 'writing' | 'applied' | 'restoring' | 'restored' | 'recovery';
    entries: Entry[];
}
export interface FileTransfer {
    readonly root: string;
    readonly journal: Journal;
}
export declare class FileTransferError extends Error {
    readonly paths: string[];
    constructor(message: string, paths?: string[]);
}
export declare function newFileTransferRef(): FileTransferRef;
/** Hash a stable ordinary file without following a substituted symbolic link. */
export declare function fileFingerprint(file: string): Promise<FileFingerprint>;
export declare function sameFile(a: FileFingerprint, b: FileFingerprint, identity?: boolean): boolean;
export declare function transferPreimages(repo: string, paths: readonly string[]): Promise<Record<string, FileFingerprint>>;
export declare function loadFileTransfer(repo: string, ref: FileTransferRef): Promise<FileTransfer>;
/** Prepare all replacement bytes and prove no-replace links work before moving any project file. */
export declare function prepareFileTransfer(repo: string, tree: string, operations: readonly {
    path: string;
    status: string;
}[], ref: FileTransferRef, expected?: Record<string, FileFingerprint>): Promise<FileTransfer>;
export declare function affectedTransferPaths(transfer: FileTransfer): string[];
/** Capture the actual old inode first; publish a hard link that can never replace an existing path. */
export declare function publishTransferEntry(transfer: FileTransfer, index: number): Promise<void>;
export declare function finishFileTransfer(transfer: FileTransfer): Promise<void>;
/** Never delete or replace a path created or edited by another writer. All captured bytes remain retained. */
export declare function restoreFileTransfer(repo: string, ref: FileTransferRef): Promise<{
    restored: string[];
    conflicts: string[];
}>;
export declare function fileTransferDirectory(repo: string, ref: FileTransferRef): string;
export {};

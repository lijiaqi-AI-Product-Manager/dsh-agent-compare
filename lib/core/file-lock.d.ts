export declare class BusyError extends Error {
    constructor(what: string);
}
export interface FileLease {
    release(): void;
}
/** An exclusive SQLite connection transaction; the OS releases it on exit.
 * Guard files keep their identity permanently: never unlink or rotate them.
 * Keep these local to the host, outside executable project copies. */
export declare function tryFileLease(file: string): Promise<FileLease | undefined>;

import type { IncomingMessage } from 'node:http';
export declare class HttpError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(status: number, message: string, code?: string | undefined);
}
/** Bounded object payloads; malformed input must not expose its contents. */
export declare function readBody(req: IncomingMessage): Promise<Record<string, unknown>>;

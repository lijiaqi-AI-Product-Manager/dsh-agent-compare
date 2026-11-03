import { type RunRecord } from './types.ts';
export declare const MAX_RECORD_BYTES: number;
export declare const isRunId: (value: unknown) => value is string;
export declare class RecordValidationError extends Error {
    readonly field: string;
    constructor(field: string);
}
/** Validate data, not authority: no record is allowed to select its own filename. */
export declare function assertRunRecord(value: unknown, expectedId: string, allowInitial?: boolean): asserts value is RunRecord;

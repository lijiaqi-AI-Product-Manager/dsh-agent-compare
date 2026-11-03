import type { Baseline } from './types.ts';
import { type FileFingerprint, type FileTransferRef } from './file-transfer.ts';
export interface NameStatus {
    readonly status: string;
    readonly path: string;
}
export interface AdoptInput {
    readonly baseline: Baseline;
    readonly candidateCommit: string;
    readonly nameStatus: readonly NameStatus[];
    readonly scratchDir: string;
}
/** The checkout as it is right now: files, HEAD, and what is staged. */
export interface TargetState {
    readonly tree: string;
    readonly head: string | undefined;
    readonly staged: string;
    readonly files?: Record<string, FileFingerprint>;
}
export declare function targetState(repo: string, scratchDir: string, paths?: readonly string[]): Promise<TargetState>;
/** Locations that changed since a target was checked, including Git state. */
export declare function targetChanges(repo: string, scratchDir: string, expected: TargetState): Promise<string[]>;
export type Preflight = {
    readonly ok: true;
    readonly targetChanged: boolean;
    readonly target: TargetState;
    readonly expectedTree: string;
} | {
    readonly ok: false;
    readonly reason: 'overlap';
    readonly overlapping: string[];
    readonly target: TargetState;
};
/**
 * Decide whether the candidate can land without touching anything the user
 * changed after the baseline, and compute the exact tree the checkout will
 * have afterwards: the checkout now, with the candidate's touched paths.
 */
export declare function preflight(input: AdoptInput): Promise<Preflight>;
/** Pin the checkout's current files as a commit, the restore point for every later undo. */
export declare function pinPreAdopt(repo: string, target: TargetState): Promise<string>;
/**
 * Write the candidate's version of every touched path into the working tree,
 * keeping raw original files in a durable transfer directory. Replacements
 * are materialized with Git's eol/filter settings in a separate directory,
 * then published with no-replace links. Index and HEAD remain untouched.
 */
export declare function writeCandidate(repo: string, candidateCommit: string, nameStatus: readonly NameStatus[], guard: {
    readonly expected: TargetState;
    readonly scratchDir: string;
    readonly transfer?: FileTransferRef;
    /** Persist the next write's intent before checking its preconditions. */
    readonly beforeWrite?: (paths: readonly string[]) => Promise<void>;
}): Promise<string[]>;
/** Only these paths may have been written; later paths must never be rolled back. */
export declare class CandidateWriteError extends Error {
    readonly changedLocations?: readonly string[] | undefined;
    readonly attemptedPaths: string[];
    constructor(message: string, attemptedPaths: readonly string[], changedLocations?: readonly string[] | undefined);
}
export interface WriteCheck {
    /** Touched paths whose content is not the candidate's. */
    readonly mismatched: string[];
    /** Other paths that differ from the expected tree (changed by someone during the write). */
    readonly concurrent: string[];
    readonly headChanged: boolean;
    readonly stagedChanged: boolean;
}
/** Compare the checkout after the write with the rehearsed tree. */
export declare function checkWritten(repo: string, scratchDir: string, input: {
    expectedTree: string;
    candidateCommit: string;
    touched: readonly string[];
    before: TargetState;
}): Promise<WriteCheck>;
/**
 * Undo an adoption, path by path. A path is restored only when its content
 * is still either the candidate's (we wrote it) or already the pre-adopt
 * content; anything else was edited by someone since and is left untouched
 * and reported. Works for a finished adoption and for an interrupted one.
 */
export declare function undoAdoption(repo: string, scratchDir: string, input: {
    preAdoptCommit: string;
    candidateCommit: string;
    touched: readonly string[];
    transfer?: FileTransferRef;
    legacyRestore?: FileTransferRef;
    beforeWrite?: (paths: readonly string[]) => Promise<void>;
}): Promise<{
    restored: string[];
    conflicts: string[];
}>;
/**
 * Create a branch holding the candidate on top of the baseline HEAD without
 * switching the checkout. When the baseline was dirty, the user's uncommitted
 * changes are part of that commit, and the message says so.
 */
export declare function adoptAsBranch(input: AdoptInput & {
    readonly branch: string;
    readonly note?: string;
}): Promise<{
    branch: string;
    commit: string;
}>;
export declare class AdoptError extends Error {
    readonly code: 'overlap' | 'verify' | 'exists' | 'integrity' | 'state' | 'ineligible';
    constructor(code: 'overlap' | 'verify' | 'exists' | 'integrity' | 'state' | 'ineligible', message: string);
}

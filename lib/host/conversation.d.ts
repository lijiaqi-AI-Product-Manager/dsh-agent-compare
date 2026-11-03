/**
 * How a comparison lives inside a conversation: the `/ab` command's input
 * grammar, and the notes that tell the conversation's model what happened
 * (generation finished, the user's pick, adoption) so later turns can build on
 * it. Notes state recorded facts only.
 */
import type { AgentRoute, RunRecord } from '../core/index.ts';
export interface AbInput {
    readonly task: string;
    readonly example: boolean;
    readonly minutes?: number;
    /** Two routes: a cross-model comparison. */
    readonly models?: readonly [AgentRoute, AgentRoute];
}
/**
 * `/ab [--example] [--minutes N] [--models provider/model,provider/model] <task>`.
 * Flags may appear anywhere; everything else is the task, kept verbatim.
 */
export declare function parseAbInput(raw: string): AbInput;
/** The run id a `/ab` command result carries. */
export declare const commandResultText: (runId: string) => string;
export declare const runIdInText: (text: string | undefined) => string | undefined;
/** A stable key per fact worth telling the model; a new key means a new note. */
export declare function milestoneOf(r: RunRecord): string | undefined;
/** The model-facing note for the run's current milestone. */
export declare function memoryNote(r: RunRecord): string | undefined;

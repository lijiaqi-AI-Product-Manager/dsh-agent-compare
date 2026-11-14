import type { Strategy } from './types.ts';
/**
 * Styles a candidate can be asked to work in.
 *
 * They vary along three things a person recognises when looking at results
 * side by side: how far the change goes (approach), how it looks and reads
 * (look), and what it puts first (focus). Every style still has to deliver
 * every requirement of the task; only the direction differs.
 *
 * `project` applies to a change made in a copy of the user's project; `fresh`
 * to a request that starts from an empty folder, and to any request that is
 * answered in words, wherever it was asked.
 */
export type StyleId = 'conservative' | 'bold' | 'minimal' | 'polished' | 'vibrant' | 'friendly' | 'rigorous' | 'lean' | 'balanced';
export type StyleGroup = 'approach' | 'look' | 'focus' | 'neutral';
export interface StyleDefinition {
    readonly id: StyleId;
    readonly title: string;
    readonly group: StyleGroup;
    readonly project: string;
    readonly fresh: string;
}
export declare const STYLES: readonly StyleDefinition[];
export declare const STYLE_IDS: readonly StyleId[];
/** A user's own description of a style: one line, quoted as data in the instruction. */
export declare const MAX_CUSTOM_STYLE = 120;
export declare const CUSTOM = "custom";
export interface StyleChoice {
    readonly id: StyleId | typeof CUSTOM;
    /** The custom style's description; required for `custom`, absent otherwise. */
    readonly note?: string;
}
/** Default styles for each number of candidates: different directions first, then look. */
export declare const DEFAULT_STYLES: Readonly<Record<2 | 3 | 4, readonly StyleId[]>>;
export declare function defaultStyleChoices(count: number): StyleChoice[];
/** Validate one choice as received from settings or a command. */
export declare function parseStyleChoice(value: unknown): StyleChoice;
/** The frozen strategy a candidate receives for `choice`. */
export declare function strategyFor(choice: StyleChoice): Strategy;
/** The instruction for a request that starts from nothing, for a recorded strategy. */
export declare function freshInstruction(strategy: Strategy): string;
export declare function isStyleId(value: unknown): value is StyleId;

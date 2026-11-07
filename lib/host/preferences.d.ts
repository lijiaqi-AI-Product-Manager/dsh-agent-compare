import { RunStore } from '../core/run-store.ts';
import type { AgentRoute } from '../core/types.ts';
export interface AbPreferences {
    readonly enabled: boolean;
    readonly mode: 'same-model' | 'cross-model';
    readonly generationMinutes: number;
    readonly exampleKind?: 'quick' | 'full';
    readonly windowsProcessCompat?: 'auto' | 'off';
    readonly models: readonly [AgentRoute, AgentRoute];
    /** Main-conversation context given to both candidates. Absent means the recent default. */
    readonly contextMode?: ConversationContextMode;
    /** Exchanges included by `recent`. */
    readonly contextTurns?: number;
}
export type ConversationContextMode = 'none' | 'recent' | 'selected';
export declare const CONTEXT_TURNS: readonly [1, 3, 6, 10];
export declare const DEFAULT_CONTEXT_TURNS = 3;
/** What one submission asks to include; `selected` names log entries the user ticked. */
export interface ConversationContextRequest {
    readonly mode: ConversationContextMode;
    readonly turns: number;
    readonly ids?: readonly number[];
}
export declare function contextRequestOf(preferences: AbPreferences, ids?: readonly number[]): ConversationContextRequest;
export declare function defaultPreferences(minutes?: number): AbPreferences;
export declare function parsePreferences(value: unknown): AbPreferences;
export declare class PreferencesStore {
    private readonly store;
    private readonly defaults;
    constructor(store: RunStore, defaults?: AbPreferences);
    private key;
    private file;
    load(sessionId: string): Promise<AbPreferences>;
    private read;
    save(sessionId: string, value: unknown): Promise<AbPreferences>;
}
/** UI submissions carry frozen settings without asking users to write flags. */
export declare function parseUiSubmission(raw: string): {
    task: string;
    example: boolean;
    preferences: AbPreferences;
    contextIds?: number[];
} | undefined;

import { RunStore } from '../core/run-store.ts';
import { type StyleChoice } from '../core/styles.ts';
import { type AgentRoute, type Strategy } from '../core/types.ts';
export interface AbPreferences {
    readonly enabled: boolean;
    readonly mode: 'same-model' | 'cross-model';
    readonly generationMinutes: number;
    readonly exampleKind?: 'quick' | 'full';
    readonly windowsProcessCompat?: 'auto' | 'off';
    /** One slot per possible version (2–4); only the first `versions` are used in cross-model mode. */
    readonly models: readonly AgentRoute[];
    /** Number of versions, 2–4. Absent: 2. */
    readonly versions?: number;
    /** Same-model mode: one style per version. Absent: the defaults for `versions`. */
    readonly styles?: readonly StyleChoice[];
    /** Cross-model mode: the style every model receives. Absent: balanced. */
    readonly crossStyle?: StyleChoice;
    /** `false`: open comparison. Absent: blind. */
    readonly blind?: boolean;
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
/** What a start asks for, from saved settings and any explicit override. */
export interface ComparisonPlan {
    readonly mode: 'same-model' | 'cross-model';
    readonly candidates: number;
    readonly strategies: Strategy[];
    readonly routes: AgentRoute[];
    readonly blind: boolean;
}
/**
 * The comparison the saved settings describe. Same-model: the current route
 * for every version, one style each. Cross-model: one complete, distinct
 * model per version and one shared style.
 */
export declare function comparisonPlan(saved: AbPreferences, current: AgentRoute, override?: {
    mode?: 'same-model' | 'cross-model';
    models?: readonly AgentRoute[];
    versions?: number;
}): ComparisonPlan;
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

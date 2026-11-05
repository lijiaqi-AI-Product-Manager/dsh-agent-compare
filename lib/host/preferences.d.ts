import { RunStore } from '../core/run-store.ts';
import type { AgentRoute } from '../core/types.ts';
export interface AbPreferences {
    readonly enabled: boolean;
    readonly mode: 'same-model' | 'cross-model';
    readonly generationMinutes: number;
    readonly exampleKind?: 'quick' | 'full';
    readonly models: readonly [AgentRoute, AgentRoute];
}
export declare function defaultPreferences(minutes?: number): AbPreferences;
export declare function parsePreferences(value: unknown): AbPreferences;
export declare class PreferencesStore {
    private readonly store;
    private readonly defaults;
    constructor(store: RunStore, defaults?: AbPreferences);
    private key;
    private file;
    load(sessionId: string): Promise<AbPreferences>;
    save(sessionId: string, value: unknown): Promise<AbPreferences>;
}
/** UI submissions carry frozen settings without asking users to write flags. */
export declare function parseUiSubmission(raw: string): {
    task: string;
    example: boolean;
    preferences: AbPreferences;
} | undefined;

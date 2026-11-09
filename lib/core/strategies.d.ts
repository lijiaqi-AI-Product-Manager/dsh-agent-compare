import type { Strategy } from './types.ts';
/**
 * Default same-model pair. They differ in intent the user can recognise at the
 * reveal, not in hidden sampling noise. Both must deliver every stated
 * requirement; only the approach differs. More styles: `styles.ts`.
 */
export declare const DEFAULT_STRATEGIES: readonly Strategy[];
/** Cross-model runs give every model the same instruction by default, so the model is the only variable. */
export declare const BALANCED: Strategy;
/**
 * Where the candidate works. `folder`: a private, empty directory (the user
 * started from a folder outside Git). `repository`: a copy of the user's
 * repository; `projectPath` names the project directory in it, and `answers`
 * says the project has nothing to run, so a reply alone is a valid result.
 */
export type PromptScope = {
    readonly kind: 'folder';
} | {
    readonly kind: 'repository';
    readonly projectPath?: string;
    readonly answers?: boolean;
};
/** How many candidates there are, and whether the user sees their styles while comparing. */
export interface PromptComparison {
    readonly candidates: number;
    readonly blind: boolean;
}
export declare function candidatePrompt(task: string, strategy: Strategy, isolation: 'own-root' | 'shared-root', conversationContext?: string, scope?: PromptScope, comparison?: PromptComparison): string;

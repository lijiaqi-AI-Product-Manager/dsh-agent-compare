import type { Strategy } from './types.ts';
/**
 * Default same-model pair. They differ in intent the user can recognise at the
 * reveal, not in hidden sampling noise. Both must deliver every stated
 * requirement; only the approach differs.
 */
export declare const DEFAULT_STRATEGIES: readonly [Strategy, Strategy];
/** Cross-model runs give both models the same instruction, so the model is the only variable. */
export declare const BALANCED: Strategy;
export declare function candidatePrompt(task: string, strategy: Strategy, isolation: 'own-root' | 'shared-root', conversationContext?: string): string;

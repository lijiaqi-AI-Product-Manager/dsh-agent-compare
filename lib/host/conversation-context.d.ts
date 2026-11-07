import type { ConversationContextRequest } from './preferences.ts';
export interface ContextSourceEvent {
    readonly type: string;
    readonly data?: any;
}
export type ContextRole = 'user' | 'assistant' | 'summary' | 'note';
export interface ContextEntry {
    /** Position in the conversation log; stable while the log is not replaced. */
    readonly id: number;
    readonly role: ContextRole;
    readonly text: string;
}
export interface ConversationContext {
    readonly mode: 'recent' | 'selected';
    readonly messages: number;
    readonly chars: number;
    readonly truncated: boolean;
    readonly sha256: string;
    readonly text: string;
}
export declare const MESSAGE_CHARS = 2000;
export declare const CONTEXT_CHARS = 12000;
/** The visible conversation, oldest first. */
export declare function conversationEntries(events: readonly ContextSourceEvent[]): ContextEntry[];
/** Recent entries for the picker, newest last, with previews bounded for transport. */
export declare function listedEntries(events: readonly ContextSourceEvent[]): Array<ContextEntry & {
    chars: number;
}>;
/**
 * Build the text for one submission. `recent` takes the last `turns` user
 * messages and everything after the earliest of them, including the results
 * delivered with that message and `pending` results the log does not hold
 * yet; `selected` takes exactly the listed entries. Newest content is kept
 * when the bound is reached.
 */
export declare function buildConversationContext(events: readonly ContextSourceEvent[], request: ConversationContextRequest, pending?: readonly string[]): ConversationContext | undefined;

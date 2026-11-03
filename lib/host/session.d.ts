/** The Session domain owns restoration, permissions and its writer claim. */
export interface ConversationAgent {
    readonly session: {
        readonly id: string;
    };
}
export interface SessionController<A extends ConversationAgent> {
    resolveAgent(sessionId: string): Promise<{
        agent: A;
    } | {
        error: {
            code?: string;
            message?: string;
        };
    }>;
}
export declare class SessionAccessError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/** Resolve without sending a prompt. Caller cancellation must not cancel a
 * restoration shared with another settings request. Never invent a session. */
export declare function conversationResolver<A extends ConversationAgent>(options: {
    attached(): readonly A[];
    controller(): SessionController<A> | undefined;
    guard(agent: A): void;
}): (sessionId: unknown, signal?: AbortSignal) => Promise<A>;

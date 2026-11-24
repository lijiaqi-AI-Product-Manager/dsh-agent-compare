/**
 * DeepSeek Harness Host half of AgentCompare.
 *
 * - Each candidate runs in its own DSH session created with `ctx.agents.create`
 *   whose session `cwd` is the candidate's private copy. DSH's sandbox takes a
 *   session's requested write boundary from that `cwd` ("own-root"); its
 *   actual enforcement includes the host's platform limitations. When the host has no
 *   agent factory, the `ctx.subagents` child path is used instead
 *   ("shared-root": copies inside the repository, escapes detected afterwards).
 * - Model-facing tools: `agent_compare_start`, `agent_compare_status`.
 * - Client API: POST /agent-compare/api/<method>, fenced like every first-party route.
 *
 * Interfaces are checked against the shipped 0.2.1-rc.5 and 0.2.2-rc.3 sources;
 * anything this file cannot obtain is reported as unknown rather than guessed.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type AgentRoute, type AgentRunner, type AgentRunRequest, type AgentRunResult, type Usage } from '../core/index.ts';
export declare const name = "agent-compare";
export declare const inject: string[];
export interface Config {
    /** `own-root` (default) or the experimental `shared-root` subagent path. */
    isolation?: 'own-root' | 'shared-root';
    /** Subagent provider for `shared-root`. */
    provider?: string;
    /** Per-candidate generation budget in minutes. */
    generationMinutes?: number;
    /** Comparisons generating at the same time. */
    maxActiveRuns?: number;
    /** Where run records, patches and copies live. */
    home?: string;
}
interface SessionEvent {
    readonly type: string;
    readonly data?: any;
}
interface SessionLike {
    readonly id: string;
    readonly header: {
        readonly cwd?: string;
        readonly origin?: string;
        readonly delegationDepth?: number;
    };
    readonly seq: number;
    append(type: string, data: unknown): void;
    snapshotEvents(from: number): readonly SessionEvent[];
    requestHeader?(): {
        config?: AgentRoute;
        adapterDefaults?: {
            reasoningEffort?: boolean;
        };
    } | undefined;
}
interface AgentLike {
    readonly id?: string;
    readonly session: SessionLike;
    readonly ctx: {
        get(name: string): unknown;
    };
    readonly options?: {
        readonly provider?: string;
        readonly model?: string;
        readonly reasoningEffort?: string;
    };
    readonly inbox?: {
        readonly nextTurn: readonly unknown[];
        readonly nextStep: readonly unknown[];
    };
    followup(message: unknown): void;
    /** Model-facing context for the next step; does not wake the agent. */
    inject?(message: unknown): void;
    cancel(cause: unknown): void;
    whenIdle(): Promise<void>;
}
interface AgentHandle {
    readonly agent: AgentLike;
    dispose(): Promise<void>;
}
interface AgentsService {
    create(options: unknown): Promise<AgentHandle>;
    list(): AgentLike[];
}
/** The admitted Peer the Web server hands to a route handler (DSH >= 0.2.2). */
interface WebPeer {
    readonly signal?: {
        readonly aborted?: boolean;
    };
}
/** `connection.admit()` answers with the admitted Peer or the HTTP rejection status. */
interface WebAdmission {
    readonly peer?: WebPeer | undefined;
    readonly rejection?: number | undefined;
}
/** The `connection` service across DSH 0.2.1 (`requestRejection`) and 0.2.2 (`admit`). */
interface WebConnection {
    admit?(request: IncomingMessage): WebAdmission | Promise<WebAdmission>;
    requestRejection?(request: IncomingMessage): unknown;
}
interface WebCtx {
    webServer: {
        register(route: {
            kind: 'prefix' | 'exact';
            path: string;
            /**
             * DSH 0.2.2 admits a registered route before the handler runs and passes the
             * Peer as the handler's third argument. Older releases leave admission to
             * the route's own `connection.requestRejection` check.
             */
            auth?: 'required' | 'anonymous' | 'deny';
            handler: (req: IncomingMessage, res: ServerResponse, peer?: WebPeer) => Promise<void> | void;
        }): () => void;
    };
    connection: WebConnection;
    effect(fn: () => () => void | Promise<void>, label?: string): void;
}
interface HostCtx {
    on(name: string, listener: (...args: any[]) => unknown): () => void;
    tools: {
        register(def: unknown): () => void;
    };
    inject(names: string[], cb: (sub: WebCtx) => void): unknown;
    get(name: string): unknown;
    effect(fn: () => () => void | Promise<void>, label?: string): void;
    logger: {
        info(m: string): void;
        warn(m: string): void;
    };
}
/** Aggregate only complete provider-reported counters. Cache counters are disjoint input. */
export declare function usageFromEvents(events: readonly SessionEvent[]): Usage;
/** Last non-empty assistant message text, as DSH's own subagent result selects it. */
export declare function finalText(events: readonly SessionEvent[]): string;
/** Observed activity so far: model steps taken, the latest tool call, tokens reported. */
export declare function progressOf(events: readonly SessionEvent[]): {
    steps: number;
    lastAction?: string;
    tokens?: number;
};
/** Map the epoch's last turn ending onto the subagent stop-reason vocabulary. */
export declare function stopReasonOf(events: readonly SessionEvent[]): string;
/** How long a finished turn must stay finished, with nothing queued, before the candidate counts as done. */
export declare const SETTLE_MS = 800;
/** After a stop, how long to wait for the session to end its turn before sealing what it wrote. */
export declare const STOP_GRACE_MS = 15000;
/** How long a session may sit idle, with nothing queued, before a turn that never began counts as over. */
export declare const UNSTARTED_MS = 10000;
/**
 * Wait until the candidate's work is over. That is the moment its last turn
 * ends with nothing queued to start another, not the moment the whole session
 * goes idle: other plugins may keep a finished session busy for minutes (for
 * example writing memories), and the result does not depend on them. A stop
 * waits briefly for the turn to end, then returns so what was written can be
 * sealed even if the session never acknowledges the stop.
 */
export declare function settled(child: Pick<AgentLike, 'session' | 'inbox' | 'whenIdle'>, start: number, signal: AbortSignal, { poll, settleMs, graceMs, unstartedMs }?: {
    graceMs?: number | undefined;
    poll?: number | undefined;
    settleMs?: number | undefined;
    unstartedMs?: number | undefined;
}): Promise<void>;
/**
 * Runs one candidate in a fresh DSH session whose `cwd` is the candidate copy.
 * The session's sandbox mode is pinned to workspace-write and approvals to
 * `never`, the same policy DSH gives its own delegated children, but the write
 * root is the copy instead of the parent's project.
 */
export declare class IsolatedSessionRunner implements AgentRunner {
    private readonly agents;
    private readonly userMessage;
    readonly isolation: 'own-root';
    constructor(agents: AgentsService, userMessage?: () => Promise<(m: unknown) => unknown>);
    run(req: AgentRunRequest): Promise<AgentRunResult>;
}
export declare function apply(ctx: HostCtx, config?: Config): Promise<void>;
/** Whether `child` is `parent` or below it, compared the way the platform compares paths. */
export declare function insideDirectory(parent: string, child: string | undefined): boolean;
/**
 * Decide whether this route may answer one request.
 *
 * DSH 0.2.2 moved route admission into the Web server: a registered route is
 * admitted before its handler runs and the handler receives the admitted Peer
 * as a third argument. The `connection.requestRejection` helper that routes
 * used before that release is gone (only `connection.admit` remains), so an
 * unconditional call to it throws and the Web server's last-resort guard answers
 * `400` with an empty body. Fall back to `admit` when no Peer is attached, keep
 * the older helper working for pre-0.2.2 hosts, and fail closed with 503 when
 * the deployment cannot prove the caller's identity.
 */
export declare function routeRejection(req: IncomingMessage, peer: WebPeer | undefined, connection: WebConnection | undefined): Promise<number | undefined>;
export {};

import type { PreviewOriginMode } from '../core/types.ts';
import type { RunStore } from '../core/run-store.ts';
import { HttpError } from './request.ts';
export interface PreviewNetworkStatus {
    platform: string;
    state: 'not-required' | 'needs-setup' | 'ready' | 'configuring' | 'unavailable';
    available: number;
    configured: number;
    used: number;
    unconfirmed: number;
    enabled?: boolean;
    diagnostic?: string;
}
export interface PreviewNetworkSystem {
    addresses(signal?: AbortSignal): Promise<ReadonlySet<string>>;
    provision(addresses: readonly string[], signal?: AbortSignal): Promise<string>;
}
/** The privileged payload contains only fixed tools and validated numeric addresses.
 * It never removes an existing address or writes a permanent system file. */
export declare function previewAliasCommand(addresses: readonly string[]): string;
export declare function previewAliasScript(addresses: readonly string[]): string;
/** Do not expose the privileged command text in a browser error. */
export declare function previewNetworkFailure(error: unknown): HttpError;
/** Journal and assignment live outside executable project copies. Configured
 * addresses are never reassigned, including after a preview or host stops. */
export declare class PreviewNetwork {
    private readonly store;
    private readonly system;
    private readonly platform;
    private configuring;
    private readonly file;
    constructor(store: RunStore, system?: PreviewNetworkSystem, platform?: string);
    private read;
    private write;
    status(signal?: AbortSignal): Promise<PreviewNetworkStatus>;
    /** An enabled shared pool must be usable before spending a generation budget. */
    assertReady(signal?: AbortSignal): Promise<PreviewOriginMode>;
    enable(confirmed: boolean, signal?: AbortSignal): Promise<PreviewNetworkStatus>;
    allocate(owner: {
        runId: string;
        label: string;
        mode?: PreviewOriginMode;
        replace?: boolean;
    }, signal: AbortSignal): Promise<string | undefined>;
}

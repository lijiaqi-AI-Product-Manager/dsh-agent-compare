import type { BrowserCheck } from './types.ts';
export interface AcceptanceConfig {
    readonly scripts?: string[];
    readonly protectedFiles?: string[];
    readonly browser?: BrowserCheck;
}
export declare function parseBrowserCheck(value: unknown): BrowserCheck;
/** Validate the baseline definition before any candidate starts. */
export declare function parseAcceptanceConfig(value: unknown, availableScripts: Readonly<Record<string, string>>): AcceptanceConfig;

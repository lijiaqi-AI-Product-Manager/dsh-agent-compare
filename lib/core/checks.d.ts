import { type PrepareProjectProcess } from './project-process.ts';
import type { BrowserCheck, CheckResult, ChecksSpec } from './types.ts';
export declare function runCommandChecks(dir: string, spec: ChecksSpec, signal?: AbortSignal, prepare?: PrepareProjectProcess): Promise<CheckResult[]>;
/**
 * Load the running app in a fresh, private browser context: it must render,
 * meet the optional expectations and scripted steps, and (by default) raise no
 * console errors. A desktop screenshot (and a phone-sized one) is saved.
 */
export declare function runBrowserCheck(url: string, check: BrowserCheck, screenshotFile: string): Promise<CheckResult & {
    screenshot?: string;
    mobileScreenshot?: string;
}>;
/** Score for "which candidate did the checks favour": passes minus failures; skips are neutral. */
export declare function checksScore(results: readonly CheckResult[] | undefined): number | undefined;

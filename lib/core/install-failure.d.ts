import { type RunResult } from './proc.ts';
import type { InstallFailure } from './types.ts';
/** Classify observed installation output; never infer a lock mismatch from a frozen install alone. */
export declare function installFailure(result: Pick<RunResult, 'stdout' | 'stderr' | 'timedOut' | 'aborted'>): InstallFailure;

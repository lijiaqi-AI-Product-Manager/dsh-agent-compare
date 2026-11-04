import type { Candidate } from './types.ts';
/** Evidence safe for an active blind comparison; the durable record stays intact. */
export declare function blindEvidence(candidate: Candidate): Pick<Candidate, 'install' | 'checks' | 'error' | 'verificationHistory' | 'progress' | 'generation' | 'verdict'>;

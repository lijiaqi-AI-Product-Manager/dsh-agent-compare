import type { Acceptance, AgentRoute, Candidate, CandidateLabel, CandidateStage, CheckResult, PreviewInfo, RunRecord, Strategy, Usage, Verdict } from './types.ts';
/** Shared by every sealing failure that found no change in the copy. */
export declare const NO_CHANGES = "\u6CA1\u6709\u6539\u52A8\u4EFB\u4F55\u6587\u4EF6";
export declare function canRetryVerification(r: RunRecord, c: Candidate): boolean;
/** Which candidate the checks favour: eligibility first, then passes minus failures. */
export declare function favoured(cands: readonly Candidate[]): RunRecord['checksFavoured'];
/** Decide adoption eligibility from recorded facts only. */
export declare function verdictOf(c: Candidate, acceptance: Acceptance): Verdict;
export interface PublicCandidate {
    readonly label: CandidateLabel;
    readonly stage: CandidateStage;
    readonly previewUrl?: string;
    readonly previewKind?: PreviewInfo['kind'];
    /** A result without a live page: an answer, or written files. */
    readonly result?: 'answer' | 'files';
    readonly previewNote?: string;
    /** The reply of an `answer` result. It is the result itself, so it is shown before the reveal. */
    readonly answer?: string;
    /** Paths a `files` result wrote; they are what the user judges, so they are listed before the reveal. */
    readonly resultFiles?: string[];
    readonly checks?: Candidate['checks'];
    readonly execution?: Candidate['execution'];
    readonly patchStats?: Candidate['patchStats'];
    readonly touchedFiles?: string[];
    readonly timings: Candidate['timings'];
    readonly error?: Candidate['error'];
    readonly verdict?: Verdict;
    readonly usage?: Usage;
    readonly install?: Candidate['install'];
    readonly verificationHistory?: Candidate['verificationHistory'];
    readonly canRetryVerification: boolean;
    readonly hasScreenshot: boolean;
    readonly hasMobileScreenshot: boolean;
    readonly generation?: Candidate['generation'];
    readonly progress?: Candidate['progress'];
    /** Failed while generating, and its copy is still there: what it wrote can still be verified. */
    readonly salvageable: boolean;
    /** Finished, not being served, and its copy still exists: the preview can be started again. */
    readonly canReopenPreview: boolean;
    /** Present only after the reveal. */
    readonly strategy?: Strategy;
    readonly route?: AgentRoute;
    readonly actualRoute?: AgentRoute;
    readonly summary?: string;
}
export type PublicRun = Omit<RunRecord, 'candidates' | 'baseline' | 'acceptance' | 'adoption'> & {
    candidates: PublicCandidate[];
    baseline: {
        dirty: boolean;
        headCommit?: string;
        repoRoot: string;
        projectPath?: string;
    };
    acceptance: {
        source: Acceptance['source'];
        checks: string[];
        steps: number;
        sha256: string;
        frozenInstall: boolean;
    };
    adoption?: Omit<NonNullable<RunRecord['adoption']>, 'rehearsal' | 'preAdoptCommit' | 'expectedTree' | 'headBefore' | 'stagedBefore' | 'fileTransfer' | 'transferReturn' | 'retainedTransfers' | 'exportDigests' | 'retainedExports'> & {
        rehearsed?: boolean;
        rehearsalChecks?: CheckResult[];
        retainedDirectory?: string;
        retainedDirectories?: string[];
    };
};
/**
 * The view the UI and the model see. Before the reveal it carries nothing
 * that names the strategy or model; summaries are withheld because agents
 * tend to describe their own approach.
 */
export declare function publicView(r: RunRecord): PublicRun;

export { publicView, verdictOf, type PublicCandidate, type PublicRun } from './run-view.ts';
import { type CopyCleanupPlan } from './copy-resources.ts';
import { type PrepareProjectProcess } from './project-process.ts';
import { type WindowsProcessCompatMode } from './windows-compat.ts';
import { RunStore } from './run-store.ts';
import { type AgentRoute, type CandidateLabel, type ChecksSpec, type RunRecord, type Strategy, type Usage } from './types.ts';
export interface AgentRunRequest {
    readonly label: CandidateLabel;
    readonly cwd: string;
    readonly prompt: string;
    readonly route: AgentRoute;
    readonly signal: AbortSignal;
    /** Opaque value from StartInput.hostContext (DSH: the parent Agent). */
    readonly hostContext?: unknown;
    /** Called while the agent works, whenever its observed activity changes. */
    readonly onProgress?: (p: AgentProgress) => void;
}
export interface AgentProgress {
    readonly steps: number;
    readonly lastAction?: string;
    readonly tokens?: number;
}
export interface AgentRunResult {
    readonly stopReason: string;
    readonly summary?: string;
    readonly usage: Usage;
    readonly childId?: string;
    /** The route the agent actually ran with, when the host reports it. */
    readonly actualRoute?: AgentRoute;
}
/** The one seam to the agent host. DSH implements it with its own sessions; tests script it. */
export interface AgentRunner {
    /**
     * `own-root`: the agent requests a host write boundary rooted in `cwd`,
     * subject to host platform limitations. `shared-root`: the agent can write wherever its
     * parent can, so copies must live inside the repository and escapes are only
     * detected afterwards.
     */
    readonly isolation: 'own-root' | 'shared-root';
    run(request: AgentRunRequest): Promise<AgentRunResult>;
}
export interface StartInput {
    readonly repo: string;
    readonly task: string;
    /** `same-model` (default): one route, two strategies. `cross-model`: two routes, one brief. */
    readonly mode?: 'same-model' | 'cross-model';
    readonly strategies?: readonly [Strategy, Strategy];
    /** same-model: routes[0] for both. cross-model: two different routes (required). */
    readonly routes?: readonly [AgentRoute, AgentRoute];
    readonly checks?: ChecksSpec;
    readonly sessionId?: string;
    readonly follows?: string;
    readonly origin?: RunRecord['origin'];
    readonly generationMs?: number;
    readonly windowsProcessCompat?: WindowsProcessCompatMode;
    /** Main-conversation excerpt for both candidates; recorded with the run. */
    readonly conversationContext?: RunRecord['conversationContext'];
    /** Fixed A/B assignment for tests; production shuffles. */
    readonly assignment?: 'fixed' | 'shuffle';
    /** Handed to every AgentRunner call; never persisted. */
    readonly hostContext?: unknown;
}
export interface ComparerOptions {
    readonly store?: RunStore;
    readonly runner: AgentRunner;
    readonly version: string;
    readonly onUpdate?: (record: RunRecord) => void;
    readonly onRecoveryIssue?: (issue: {
        runId: string;
        message: string;
    }) => void;
    readonly previewTimeoutMs?: number;
    /** Disable the headless-browser check (tests without a system browser). */
    readonly browserChecks?: boolean;
    /** Comparisons generating at the same time in this process. Default 1. */
    readonly maxActiveRuns?: number;
    /** Per-candidate generation budget. Default 30 minutes. */
    readonly generationMs?: number;
    /** Required for executable project commands; the host supplies its write boundary. */
    readonly prepareProjectProcess?: PrepareProjectProcess;
}
export declare const DEFAULT_GENERATION_MS: number;
export declare class Comparer {
    private readonly opts;
    readonly store: RunStore;
    private readonly live;
    private readonly queues;
    private readonly startReservations;
    private readonly operations;
    private readonly owners;
    private readonly ownerUses;
    private readonly adoptionControllers;
    private readonly lifetime;
    private closing;
    private disposal?;
    constructor(opts: ComparerOptions);
    /** Validate, snapshot the baseline, bind the acceptance, persist, then work in the background. */
    start(input: StartInput): Promise<RunRecord>;
    private startRun;
    private prepareStart;
    /** Resolve once every candidate has settled (ready, failed or cancelled). */
    wait(runId: string): Promise<RunRecord | undefined>;
    get(runId: string): Promise<RunRecord | undefined>;
    /** Reconcile a current-protocol orphan when opened after its owner exits.
     * A foreign live owner and an unmarked older record remain untouched. */
    observe(runId: string): Promise<RunRecord | undefined>;
    /** Run `fn` after every earlier operation on the same run in this process. */
    private serial;
    private persist;
    private drive;
    private driveCandidate;
    /** Freeze what the copy holds, then run the full acceptance on it. Ends in `ready` or throws. */
    private sealAndVerify;
    /** Verify the original sealed candidate again without recapturing or generating code. */
    private verifyCandidate;
    /** Explicit environment retry: same sealed bytes, original acceptance and no generation calls. */
    retryVerification(runId: string, label: CandidateLabel): Promise<RunRecord>;
    private retryRunVerification;
    /**
     * Seal and verify what a candidate had written when it failed during
     * generation (stopped by the budget, an earlier version, or a host
     * restart). Its copy must still be the one this run created.
     */
    salvage(runId: string, label: CandidateLabel): Promise<RunRecord>;
    private salvageRun;
    /**
     * Install, run the shared commands, serve the build, and run the browser
     * acceptance in `dir`, whose files must equal `sealedTree`. Used for each
     * candidate and for the adoption rehearsal.
     */
    private verifyCopy;
    /**
     * Compare the user's checkout (copies excluded) with the baseline and record
     * every differing path. Called when each candidate finishes generating.
     */
    private noteOutsideChanges;
    private stopPreview;
    /** Stop one candidate or the whole run. Shows "stopping" until each candidate has actually settled. */
    cancel(runId: string, label?: CandidateLabel): Promise<RunRecord | undefined>;
    private cancelRun;
    /**
     * Record the blind choice and reveal at once. Any finished candidate can be
     * picked; adoption rules come later. After the reveal the user may change the
     * pick to another finished candidate while nothing is adopted: the first,
     * blind pick stays recorded as `initialPick`.
     */
    choose(runId: string, pick: CandidateLabel | 'none', note?: string): Promise<RunRecord>;
    /**
     * Serve a finished candidate again (its preview stopped with a host
     * restart, or was never started). Uses the copy's existing build output
     * when there is one; the copy must still be the one this run created.
     */
    reopenPreview(runId: string, label: CandidateLabel): Promise<RunRecord>;
    private reopenRunPreview;
    /** Report-only adoption check: overlap, eligibility and whether a rehearsal will run. Writes nothing. */
    adoptPreflight(runId: string): Promise<{
        ok: boolean;
        eligible: boolean;
        reasons: string[];
        overlapping?: string[];
        targetChanged?: boolean;
        rehearsal?: boolean;
    }>;
    private preflightAdoption;
    /**
     * Land the chosen candidate.
     *
     * `worktree` (eligible candidates only): compute the tree the checkout will
     * have afterwards; when it differs from the checked candidate (the user
     * changed other files since), build and check it in a scratch copy first.
     * Only then persist a journal, write, and verify the checkout equals that
     * tree. HEAD, the index and commits are never touched.
     *
     * `branch`: create a branch with the candidate, switching nothing. Allowed
     * for any finished candidate, so an unverified one can still be inspected.
     */
    adopt(runId: string, mode?: 'worktree' | 'branch'): Promise<RunRecord>;
    /** Interrupt only this owner's rehearsal; file handoff must finish once writing begins. */
    cancelAdoption(runId: string): Promise<RunRecord>;
    private adoptRun;
    /** Build `tree` in a scratch copy and run the full acceptance on it. */
    private rehearse;
    /**
     * Undo a worktree adoption. Refuses (and lists the paths) when any touched
     * file was edited after adoption, so nothing the user wrote is overwritten.
     */
    revert(runId: string): Promise<RunRecord>;
    private revertRun;
    /**
     * Resolve a run left in `recovery`. `restore` puts every touched path that
     * still holds our content back to its pre-adopt state (paths edited by
     * someone else are listed, not touched); `keep` accepts the files as they are.
     */
    recoverAdoption(runId: string, action: 'restore' | 'keep'): Promise<RunRecord>;
    private recoverRunAdoption;
    /**
     * Stop previews and delete the copies this run can prove it created. The
     * record, patches and screenshots stay. Paths whose ownership cannot be
     * proven are kept and listed in `leftovers`.
     */
    cleanup(runId: string): Promise<RunRecord | undefined>;
    /** Explicit, inspectable copy release; source records and undo refs remain. */
    copyCleanupPlan(runId: string, signal?: AbortSignal): Promise<CopyCleanupPlan>;
    releaseCopies(runId: string, token: string): Promise<RunRecord>;
    private cleanupRun;
    /** Stop this run's previews and delete its owned copies; keep the record. */
    private releaseResources;
    /**
     * After a host restart: anything still marked in flight did not finish.
     * Previews are stopped only when the process is provably ours; an
     * interrupted write becomes `recovery`, never "done" or "failed".
     */
    recover(): Promise<string[]>;
    private recoverRuns;
    private recoverRecord;
    dispose(): Promise<void>;
    private finishDisposal;
    private assertOpen;
    private operation;
    private ensureOwnership;
    private withOwnership;
    private releaseOwnership;
    /** A snapshot for presentation; every action acquires ownership again. */
    control(r: RunRecord): Promise<{
        allowed: boolean;
        reason?: string;
        retryable?: boolean;
        canCancelAdoption?: boolean;
        adoptionCancellationRequested?: boolean;
    }>;
    private mustLoad;
    /** The live record, or a fresh read from disk (another process may have saved). */
    private fresh;
    private save;
    private mutate;
}

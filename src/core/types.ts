/**
 * Run record schema `agent-compare.run/v2`.
 *
 * Every field states a fact the code observed. Anything it could not observe is
 * left `undefined` or carries an explicit `unknown` marker; it is never zero-filled.
 * Records of an older schema are read-only history: nothing acts on their
 * recorded paths or process ids.
 */

export const RUN_SCHEMA = 'agent-compare.run/v2'
export const RUN_COORDINATION = 'sqlite-run/v1'
export const LEGACY_SCHEMAS: readonly string[] = ['agent-compare.run/v1']

export type CandidateLabel = 'A' | 'B'

export type CandidateStage =
  | 'queued'
  | 'preparing'
  | 'generating'
  | 'sealing'
  | 'installing'
  | 'verifying'
  | 'previewing'
  | 'ready'
  | 'failed'
  | 'stopping'
  | 'cancelled'
  | 'interrupted'

export type RunState =
  | 'running'
  | 'judging'
  | 'revealed'
  | 'adopting'
  | 'adopted'
  /** An adoption was interrupted or could not be rolled back cleanly; the user must decide. */
  | 'recovery'
  | 'abandoned'
  | 'interrupted'

export interface Strategy {
  readonly id: string
  readonly title: string
  /** Text appended to the shared task for this candidate only. */
  readonly instruction: string
}

export interface AgentRoute {
  readonly provider?: string
  readonly model?: string
  readonly reasoningEffort?: string
}

/** Token usage as the provider reported it, or an explicit unknown. */
export type Usage =
  | { readonly kind: 'reported'; readonly inputTokens?: number; readonly outputTokens?: number; readonly cacheReadTokens?: number; readonly cacheWriteTokens?: number; readonly totalTokens?: number }
  | { readonly kind: 'unknown'; readonly reason: string }

export interface CheckCommand {
  readonly name: string
  /** argv; argv[0] is resolved on PATH (npm/pnpm/node). */
  readonly argv: readonly string[]
  readonly timeoutMs?: number
}

/** One scripted interaction of the browser acceptance (Playwright selectors). */
export type BrowserStep =
  | { readonly fill: string; readonly text: string; readonly label?: string }
  | { readonly click: string; readonly label?: string }
  | { readonly press: string; readonly key: string; readonly label?: string }
  | { readonly expectVisible: string; readonly label?: string }
  | { readonly expectCount: string; readonly min?: number; readonly max?: number; readonly label?: string }
  | { readonly expectText: string; readonly label?: string }
  | { readonly viewport: { readonly width: number; readonly height: number }; readonly label?: string }

export interface BrowserCheck {
  readonly path?: string
  readonly expectText?: string
  readonly expectSelector?: string
  readonly failOnConsoleError?: boolean
  readonly steps?: readonly BrowserStep[]
  /** Also capture a phone-sized screenshot (390×844). Default true. */
  readonly mobileShot?: boolean
}

export interface ChecksSpec {
  readonly commands: readonly CheckCommand[]
  readonly browser?: BrowserCheck
}

/**
 * What "the same checks" means, bound to content: the commands, the bodies of
 * the package scripts they run, the baseline blobs of every file that defines
 * how verification behaves, and the runtime. A candidate that changes any of
 * the bound files is still checked, but its result is not counted as passing
 * the shared acceptance.
 */
export interface Acceptance {
  readonly checks: ChecksSpec
  /** Baseline package scripts, including lifecycle and nested commands. */
  readonly scripts: Readonly<Record<string, string>>
  /** Baseline path → blob sha of verification-defining files. */
  readonly bound: Readonly<Record<string, string>>
  readonly lockfile?: string
  readonly runtime: { readonly node: string; readonly packageManager: string; readonly platform: string; readonly yarnModern?: boolean }
  /** Where the checks came from: derived defaults, or the repository's `.agent-compare.json`. */
  readonly source: 'defaults' | 'repository'
  readonly sha256: string
}

export type CheckOutcome = 'passed' | 'failed' | 'skipped' | 'timeout'

export interface CheckResult {
  readonly name: string
  readonly outcome: CheckOutcome
  readonly durationMs: number
  /** Bounded tail of combined output (never the full log). */
  readonly tail: string
  readonly reason?: string
  /** Browser check only: per-step outcome. */
  readonly steps?: ReadonlyArray<{ readonly label: string; readonly ok: boolean; readonly detail?: string }>
}

export interface StageError {
  readonly stage: CandidateStage
  readonly message: string
}

export interface InstallFailure {
  readonly kind: 'network' | 'authentication' | 'filesystem' | 'runtime' | 'lockfile' | 'timeout' | 'cancelled' | 'unknown'
  readonly summary: string
  readonly hint: string
  readonly code?: string
  readonly diagnostic?: string
}

export interface VerificationAttempt {
  readonly recordedAt: number
  readonly durationMs?: number
  readonly install?: NonNullable<Candidate['install']>
  readonly checks?: CheckResult[]
  readonly error?: StageError
}

export interface VerificationRuntime {
  readonly hostNode: string
  readonly platform: string
  readonly packageManager: string
  readonly packageManagerVersion?: string
}

export interface PreviewInfo {
  readonly url: string
  readonly port: number
  readonly pid: number
  /** `build`: the built artifact the checks passed on. `dev`: dev server, shown only when the build failed. */
  readonly kind: 'build' | 'dev'
  /** Directory the server runs in; part of the ownership proof before any later kill. */
  readonly cwd: string
  /** Modern Yarn starts Vite through its project-aware dependency loader. */
  readonly launcher?: 'yarn'
}

/** Why a candidate may or may not be written into the user's checkout. */
export interface Verdict {
  readonly eligible: boolean
  /** Why it is not eligible (empty when eligible). */
  readonly reasons: string[]
  /** Facts worth seeing that do not block adoption (dependency change, skipped page check). */
  readonly warnings: string[]
}

export interface Candidate {
  readonly label: CandidateLabel
  readonly strategy: Strategy
  /** Route requested at start (frozen); `actualRoute` is what the agent ran with. */
  readonly route: AgentRoute
  actualRoute?: AgentRoute
  stage: CandidateStage
  /** How generation ended. Anything but `completed` still seals and verifies what was written. */
  generation?: { ended: 'completed' | 'budget' | 'agent-stopped'; stopReason?: string }
  /** Live activity of the agent while it generates (observed, not reported by the agent). */
  progress?: { steps: number; lastAction?: string; lastActivityAt: number; tokens?: number }
  /** The candidate's private copy (a detached git worktree). */
  dir?: string
  /** Random token written into the copy's git admin dir; required before deleting it. */
  ownerToken?: string
  childId?: string
  stopReason?: string
  /** Bounded final assistant message. */
  summary?: string
  usage?: Usage
  patchFile?: string
  patchSha256?: string
  patchStats?: { files: number; insertions: number; deletions: number; binary: number }
  touchedFiles?: string[]
  candidateCommit?: string
  candidateTree?: string
  /** Verification-defining files (or check scripts) the candidate changed. */
  acceptanceTouched?: string[]
  /** package.json dependencies or the lockfile changed. */
  dependencyChange?: boolean
  install?: { argv: string[]; frozen: boolean; durationMs: number; outcome?: 'passed' | 'failed' | 'timeout' | 'cancelled'; failure?: InstallFailure; runtime?: VerificationRuntime }
  /** Completed verification attempts, retained before an explicit retry. Generation is never repeated. */
  verificationHistory?: VerificationAttempt[]
  /** Weakest completeness reported across installation, checks and preview. */
  execution?: { enforcement: 'full' | 'partial' | 'unknown' }
  checks?: CheckResult[]
  /** Tree the checks ran on; must equal candidateTree. */
  checkedTree?: string
  /** Non-ignored paths that differed from the sealed tree after the checks. */
  drift?: string[]
  preview?: PreviewInfo
  screenshot?: string
  mobileScreenshot?: string
  verdict?: Verdict
  timings: Partial<Record<CandidateStage, { startedAt: number; endedAt?: number }>>
  error?: StageError
  /** Retain the copy when termination of a project process tree is unconfirmed. */
  stopUnconfirmed?: boolean
}

export interface Baseline {
  readonly repoRoot: string
  readonly headCommit: string | undefined
  /** Snapshot commit: HEAD plus every non-ignored uncommitted change. */
  readonly snapshotCommit: string
  readonly snapshotTree: string
  readonly dirty: boolean
}

export interface Choice {
  readonly pick: CandidateLabel | 'none'
  readonly at: number
  readonly note?: string
}

export type AdoptionState =
  /** Building the would-be result in a scratch copy and checking it. Nothing written. */
  | 'rehearsing'
  /** Refused before any write (overlap, ineligible, rehearsal failed). Nothing written. */
  | 'blocked'
  /** Writing into the checkout; the journal holds everything needed to undo. */
  | 'writing'
  /** Returning owned written files through the same protected handoff. */
  | 'reverting'
  /** Written, and the checkout now equals the rehearsed tree. */
  | 'adopted'
  /** Written correctly, but other files changed during the write; review them. */
  | 'needs-attention'
  /** A write failed and every touched path was restored. */
  | 'rolled-back'
  /** Interrupted or not fully restorable; see `attention`. */
  | 'needs-recovery'
  | 'reverted'

export interface Adoption {
  readonly label: CandidateLabel
  readonly mode: 'worktree' | 'branch'
  state: AdoptionState
  readonly startedAt: number
  endedAt?: number
  /** Snapshot of the checkout right before the first write (pinned). */
  preAdoptCommit?: string
  /** Tree the checkout must equal after the write. */
  expectedTree?: string
  /** HEAD and staged-state fingerprint before the write; both must be unchanged after. */
  headBefore?: string
  stagedBefore?: string
  rehearsal?: { reused: boolean; tree: string; checks?: CheckResult[]; dir?: string; ownerToken?: string; stopUnconfirmed?: boolean }
  /** Paths journaled before each write; paths not yet reached are excluded. */
  writtenPaths?: string[]
  /** Owned raw-file transfer; never forwarded into model or client payloads. */
  fileTransfer?: { readonly id: string; readonly token: string }
  /** Older adoptions use a protected inverse transfer when first undone. */
  transferDirection?: 'apply' | 'undo'
  /** State before a protected inverse of an older adoption started. */
  transferReturn?: 'adopted' | 'recovery'
  /** Completed recovery transfers remain available for manual inspection. */
  retainedTransfers?: Array<{ readonly id: string; readonly token: string }>
  branch?: string
  message?: string
  /** Paths the user needs to look at (conflicts, concurrent edits). */
  attention?: string[]
}

export interface RunRecord {
  readonly schema: typeof RUN_SCHEMA
  /** New runs use a host-held OS lease. Older active runs stay read-only. */
  coordination?: typeof RUN_COORDINATION
  readonly producer: { readonly name: 'dsh-agent-compare'; readonly version: string }
  readonly runId: string
  readonly createdAt: number
  readonly task: string
  readonly sessionId?: string
  /** Run this one continues (the previous adopted result is part of its baseline). */
  readonly follows?: string
  /** What started it: the `/ab` command in a conversation, the model's tool call, or the panel. */
  readonly origin?: { readonly kind: 'command' | 'tool' | 'panel'; readonly id?: string }
  readonly baseline: Baseline
  readonly acceptance: Acceptance
  /**
   * `same-model`: one route, two strategies. `cross-model`: two routes, one
   * strategy. Chosen explicitly at start, never inferred from route equality.
   */
  readonly mode: 'same-model' | 'cross-model'
  /** `own-root`: each candidate session's write boundary is its own copy. */
  readonly isolation: 'own-root' | 'shared-root'
  readonly budget: { readonly generationMs: number }
  state: RunState
  candidates: Candidate[]
  choice?: Choice
  revealedAt?: number
  /** Which candidate the programmatic checks favoured, recorded before reveal. */
  checksFavoured?: CandidateLabel | 'tie' | 'none'
  adoption?: Adoption
  /**
   * Paths in the user's checkout that differed from the baseline when a
   * candidate finished generating. With `own-root` isolation a candidate cannot
   * write there, so these are the user's own edits; with `shared-root` the
   * cause cannot be told apart and is not claimed.
   */
  outsideChanges?: string[]
  /** Paths cleanup refused to delete because ownership could not be proven. */
  leftovers?: string[]
  /** Explicitly released copies; records, source refs and undo originals remain. */
  copiesReleasedAt?: number
  /** Monotonic save counter; a save against a stale copy is refused. */
  rev: number
  updatedAt: number
}

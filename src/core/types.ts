/**
 * Run record schema `agent-compare.run/v1`.
 *
 * Every field states a fact the code observed. Anything it could not observe is
 * left `undefined` or carries an explicit `unknown` marker; it is never zero-filled.
 */

export const RUN_SCHEMA = 'agent-compare.run/v1'

export type CandidateLabel = 'A' | 'B'

export type CandidateStage =
  | 'queued'
  | 'worktree'
  | 'generating'
  | 'capturing'
  | 'installing'
  | 'starting'
  | 'checking'
  | 'ready'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

export type RunState =
  | 'running'
  | 'judging'
  | 'chosen'
  | 'revealed'
  | 'adopting'
  | 'adopted'
  | 'adopt-failed'
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
  | { readonly kind: 'reported'; readonly inputTokens?: number; readonly outputTokens?: number; readonly totalTokens?: number }
  | { readonly kind: 'unknown'; readonly reason: string }

export interface CheckCommand {
  readonly name: string
  /** argv; argv[0] is resolved on PATH (npm/pnpm/node). */
  readonly argv: readonly string[]
  readonly timeoutMs?: number
}

export interface BrowserCheck {
  readonly path?: string
  readonly expectText?: string
  readonly expectSelector?: string
  readonly failOnConsoleError?: boolean
}

export interface ChecksSpec {
  readonly commands: readonly CheckCommand[]
  readonly browser?: BrowserCheck
}

export type CheckOutcome = 'passed' | 'failed' | 'skipped' | 'timeout'

export interface CheckResult {
  readonly name: string
  readonly outcome: CheckOutcome
  readonly durationMs: number
  /** Bounded tail of combined output (never the full log). */
  readonly tail: string
  readonly reason?: string
}

export interface StageError {
  readonly stage: CandidateStage
  readonly message: string
}

export interface Candidate {
  readonly label: CandidateLabel
  readonly strategy: Strategy
  readonly route: AgentRoute
  stage: CandidateStage
  worktree?: string
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
  previewUrl?: string
  pid?: number
  port?: number
  checks?: CheckResult[]
  /** True when checks left non-ignored files behind that differ from the captured patch. */
  driftAfterChecks?: boolean
  screenshot?: string
  timings: Partial<Record<CandidateStage, { startedAt: number; endedAt?: number }>>
  error?: StageError
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

export interface Adoption {
  readonly label: CandidateLabel
  readonly mode: 'worktree' | 'branch'
  state: 'adopting' | 'adopted' | 'failed' | 'reverted'
  readonly startedAt: number
  endedAt?: number
  branch?: string
  /** Snapshot of the target checkout taken right before applying. */
  preAdoptCommit?: string
  verification?: CheckResult[]
  message?: string
}

export interface RunRecord {
  readonly schema: typeof RUN_SCHEMA
  readonly producer: { readonly name: 'dsh-agent-compare'; readonly version: string }
  readonly runId: string
  readonly createdAt: number
  readonly task: string
  readonly sessionId?: string
  readonly baseline: Baseline
  readonly checks: ChecksSpec
  readonly checksSha256: string
  /** Same model with two strategies, or two routes. Disclosed at reveal. */
  readonly mode: 'same-model' | 'cross-model'
  state: RunState
  candidates: Candidate[]
  choice?: Choice
  /** Which candidate the programmatic checks favoured, recorded before reveal. */
  checksFavoured?: CandidateLabel | 'tie' | 'none'
  adoption?: Adoption
  /**
   * Paths in the user's checkout (outside the candidate copies) that differed
   * from the baseline when a candidate finished generating. The sandbox lets a
   * candidate write anywhere in the repository, so this is checked, not assumed;
   * the cause (agent or user) cannot be told apart and is not claimed.
   */
  outsideChanges?: string[]
  updatedAt: number
}

import type { WindowsCompatEvidence } from './windows-compat.js'

export type Stage = 'queued' | 'preparing' | 'generating' | 'sealing' | 'installing' | 'verifying' | 'previewing' | 'ready' | 'failed' | 'stopping' | 'cancelled' | 'interrupted'
export interface Check { name: string; outcome: 'passed' | 'failed' | 'skipped' | 'timeout'; reason?: string; durationMs: number; steps?: Array<{ label: string; ok: boolean; detail?: string }> }
export interface Route { provider?: string; model?: string }
export interface InstallFailure { kind: string; summary: string; hint: string; code?: string; diagnostic?: string }
export interface VerificationRuntime { hostNode: string; platform: string; packageManager: string; packageManagerVersion?: string; windowsProcessCompat?: WindowsCompatEvidence }
export interface VerificationAttempt { recordedAt: number; durationMs?: number; install?: { failure?: InstallFailure; outcome?: string; runtime?: VerificationRuntime }; error?: { message: string }; checks?: Check[] }
export interface Setup { pluginVersion?: string; dshVersion?: string; projectProcess?: { platform: string; windowsCompatControl: boolean }; capabilities?: { ok: boolean; missing: string[]; warnings: string[] }; current: Route; generationMinutes: number; project?: { path: string; supported: boolean; reason?: string; warning?: string } }
export interface Cand {
  label: 'A' | 'B'
  stage: Stage
  previewUrl?: string
  previewKind?: 'build' | 'dev'
  checks?: Check[]
  execution?: { enforcement: 'full' | 'partial' | 'unknown' }
  patchStats?: { files: number; insertions: number; deletions: number; binary: number }
  timings: Partial<Record<Stage, { startedAt: number; endedAt?: number }>>
  error?: { stage: Stage; message: string }
  verdict?: { eligible: boolean; reasons: string[]; warnings: string[] }
  usage?: { kind: 'reported'; totalTokens?: number; inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } | { kind: 'unknown'; reason: string }
  hasScreenshot?: boolean
  hasMobileScreenshot?: boolean
  generation?: { ended: 'completed' | 'budget' | 'agent-stopped'; stopReason?: string }
  progress?: { steps: number; lastAction?: string; lastActivityAt: number; tokens?: number }
  salvageable?: boolean
  canRetryVerification?: boolean
  install?: { failure?: InstallFailure; frozen: boolean; runtime?: VerificationRuntime }
  verificationHistory?: VerificationAttempt[]
  canReopenPreview?: boolean
  strategy?: { id: string; title: string }
  route?: Route
  actualRoute?: Route
  summary?: string
}
export interface Adoption { state: string; mode: string; message?: string; branch?: string; attention?: string[]; rehearsed?: boolean; rehearsalChecks?: Check[]; transferDirection?: 'apply' | 'undo'; retainedDirectory?: string; retainedDirectories?: string[] }
export interface Run {
  rev?: number
  control?: { allowed: boolean; reason?: string; retryable?: boolean; canCancelAdoption?: boolean; adoptionCancellationRequested?: boolean }
  runId: string
  sessionId?: string
  /** The comparison ran in a built-in example repository. */
  example?: boolean
  budget?: { generationMs: number }
  task: string
  state: string
  mode: 'same-model' | 'cross-model'
  isolation: 'own-root' | 'shared-root'
  createdAt: number
  follows?: string
  origin?: { kind: 'command' | 'tool' | 'panel'; id?: string }
  baseline: { dirty: boolean; headCommit?: string; repoRoot?: string }
  acceptance: { source: 'defaults' | 'repository'; checks: string[]; steps: number; frozenInstall: boolean }
  candidates: Cand[]
  choice?: { pick: 'A' | 'B' | 'none'; initialPick?: 'A' | 'B' | 'none' }
  checksFavoured?: 'A' | 'B' | 'tie' | 'none'
  adoption?: Adoption
  outsideChanges?: string[]
  leftovers?: string[]
  copiesReleasedAt?: number
}
export interface CopyPlan { version: 1; runId: string; rev: number; state: string; allowed: boolean; reasons: string[]; bytes: number; token: string; otherSession?: boolean; retained?: { gitRefs?: number; childSessions: number; sealedPatches: number; sourceRepository: string }; resources: Array<{ label: string; path: string; bytes: number; files: number; links: number; stopsPreview: boolean; reason?: string; estimated?: boolean }> }
export interface Legacy { runId: string; task: string; createdAt: number; state: string; legacy: true; unavailable?: true; reason?: string }
export interface HistoryMeta { version: 1; scope: 'all' | 'session'; query: string; total: number; offset: number; limit: number; hasNext: boolean; onlyUnavailable?: boolean; unavailable?: number }
export interface ListResult { runs: Run[]; legacy: Legacy[]; isolation: 'own-root' | 'shared-root'; history?: HistoryMeta }
export interface ModelItem { provider: string; providerName: string; id: string; name: string }

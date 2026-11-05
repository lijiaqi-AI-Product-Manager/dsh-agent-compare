/**
 * Comparison controls and two live candidates belong in the conversation.
 * The header opens history and guidance. Labels stay A/B until a choice.
 *
 * HTTP goes through the page base (`document.baseURI`): in the desktop shell
 * the page is `dsh-app://app/` and the shell forwards plugin paths to the Host
 * same-origin; a root-absolute or Host-origin URL would break there.
 *
 * Colours, radii and shadows come from DSH's own `--dsw-*` tokens (with
 * fallbacks for other hosts), so the sheet follows the active theme.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { runIdFromToolResult } from './tool-result.js'
import { clientCapabilities } from './capabilities.js'
export const name = 'agent-compare-client'
export const inject = ['slots', 'remote', 'remote.commands']
interface SlotsLike {
  inject(name: string, cb: () => () => void): () => void
  register(spec: Record<string, unknown>, component: React.ComponentType<any>): () => void
}
interface ClientCtx { slots: SlotsLike; effect?(fn: () => () => void): void }
type Stage = 'queued' | 'preparing' | 'generating' | 'sealing' | 'installing' | 'verifying' | 'previewing' | 'ready' | 'failed' | 'stopping' | 'cancelled' | 'interrupted'
interface Check { name: string; outcome: 'passed' | 'failed' | 'skipped' | 'timeout'; reason?: string; durationMs: number; steps?: Array<{ label: string; ok: boolean; detail?: string }> }
interface Route { provider?: string; model?: string }
interface InstallFailure { kind: string; summary: string; hint: string; code?: string; diagnostic?: string }
interface VerificationRuntime { hostNode: string; platform: string; packageManager: string; packageManagerVersion?: string }
interface VerificationAttempt { recordedAt: number; durationMs?: number; install?: { failure?: InstallFailure; outcome?: string; runtime?: VerificationRuntime }; error?: { message: string }; checks?: Check[] }
interface Setup { pluginVersion?: string; dshVersion?: string; capabilities?: { ok: boolean; missing: string[]; warnings: string[] }; current: Route; generationMinutes: number; project?: { path: string; supported: boolean; reason?: string; warning?: string } }
interface Cand {
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
interface Adoption { state: string; mode: string; message?: string; branch?: string; attention?: string[]; rehearsed?: boolean; rehearsalChecks?: Check[]; transferDirection?: 'apply' | 'undo'; retainedDirectory?: string; retainedDirectories?: string[] }
interface Run {
  rev?: number
  control?: { allowed: boolean; reason?: string; retryable?: boolean }
  runId: string
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
  choice?: { pick: 'A' | 'B' | 'none' }
  checksFavoured?: 'A' | 'B' | 'tie' | 'none'
  adoption?: Adoption
  outsideChanges?: string[]
  leftovers?: string[]
  copiesReleasedAt?: number
}
interface CopyPlan { version: 1; runId: string; rev: number; state: string; allowed: boolean; reasons: string[]; bytes: number; token: string; otherSession?: boolean; retained?: { gitRefs?: number; childSessions: number; sealedPatches: number; sourceRepository: string }; resources: Array<{ label: string; path: string; bytes: number; files: number; links: number; stopsPreview: boolean; reason?: string }> }
interface Legacy { runId: string; task: string; createdAt: number; state: string; legacy: true; unavailable?: true; reason?: string }
interface HistoryMeta { version: 1; scope: 'all' | 'session'; query: string; total: number; offset: number; limit: number; hasNext: boolean; onlyUnavailable?: boolean; unavailable?: number }
interface ListResult { runs: Run[]; legacy: Legacy[]; isolation: 'own-root' | 'shared-root'; history?: HistoryMeta }
interface ModelItem { provider: string; providerName: string; id: string; name: string }
async function call<T>(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`agent-compare/api/${method}`, document.baseURI.replace(/[?#].*$/, '').replace(/[^/]*$/, ''))
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}) })
  const env = (await res.json()) as { ok: boolean; value?: T; error?: string }
  if (!env.ok) throw new Error(env.error ?? `HTTP ${res.status}`)
  return env.value as T
}
// ---- tiny shared store: which session's sheet is open, optionally on one run ----
type Tab = 'history' | 'guide'
let openSession: { sessionId: string; runId?: string; tab?: Tab } | undefined
let focusComposerOnClose: string | undefined
const listeners = new Set<() => void>()
function setOpen(sessionId: string | undefined, runId?: string, tab?: Tab): void {
  openSession = sessionId === undefined ? undefined : { sessionId, ...(runId ? { runId } : {}), ...(tab ? { tab } : {}) }
  for (const l of listeners) l()
}
function useOpen(): typeof openSession {
  const [, force] = useState(0)
  useEffect(() => {
    const l = (): void => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return openSession
}
// ---- the session's composer, reached through DSH's conversation service ----
interface InputShell {
  readonly projection?: { readonly clipboardText?: string }
  readonly state?: { getSnapshot(): { draft: string; draftRev: number; phase: string; claim?: { name: string; token: string }; attachmentIds?: readonly unknown[] }; subscribe?(fn: () => void): () => void }
  beginCommand?(claim: { name: string; token: string; hint: string; submit(args: string): Promise<{ kind: string; text?: string }> }, span: { start: number; end: number; draftRev: number }): boolean
  focus?(): void
}
interface SessionScope { get?(name: string): unknown; bail?(scope: SessionScope, event: string, request: unknown): unknown }
interface RemoteCommands { execute(sessionId: string, line: string, attachments: readonly unknown[]): Promise<{ ok: boolean; error?: { message?: string }; value?: { result: { kind: 'success' | 'error'; text?: string } } }> }
let clientCtx: { get?(name: string): unknown; remote?: { commands?: RemoteCommands }; events?: { dispatch(mode: 'emit', args: unknown[]): Iterable<(...args: unknown[]) => unknown> } } | undefined
function sessionScope(sessionId: string): SessionScope | undefined {
  try {
    const sessions = clientCtx?.get?.('sessions') as { scope?(id: string): SessionScope | undefined } | undefined
    return typeof sessions?.scope === 'function' ? sessions.scope(sessionId) : undefined
  } catch { return undefined }
}
function inputShell(sessionId: string): InputShell | undefined {
  try {
    const actx = sessionScope(sessionId)
    const conversation = actx?.get?.('conversation') as { input?: { for?(scope: unknown): InputShell } } | undefined
    return conversation?.input?.for?.(actx)
  } catch {
    return undefined
  }
}
function inputSnapshot(sessionId: string): ReturnType<NonNullable<InputShell['state']>['getSnapshot']> | undefined {
  try { return inputShell(sessionId)?.state?.getSnapshot?.() } catch { return undefined }
}
function clientSupport(sessionId: string) {
  return clientCapabilities(inputShell(sessionId), sessionScope(sessionId), clientCtx?.remote?.commands)
}
function clientSupportMessage(sessionId: string): string | undefined {
  const support = clientSupport(sessionId)
  return support.ok ? undefined : '当前 DSH 输入接口不兼容：' + support.missing.join('、') + '。请升级或回退至已验证的 DSH 版本；草稿和比较记录保留。'
}
function returnToComposer(sessionId: string): void {
  if (openSession) { focusComposerOnClose = sessionId; setOpen(undefined) }
  else inputShell(sessionId)?.focus?.()
}
interface AbPreferences { enabled: boolean; mode: 'same-model' | 'cross-model'; generationMinutes: number; models: [Route, Route]; exampleKind?: 'quick' | 'full' }
interface AbMode { preferences: AbPreferences; loaded: boolean; loading: boolean; collapsed: boolean; saving: number; runId?: string; refreshVersion?: number; dismissedRunId?: string; error?: string; pending: Promise<void>; listeners: Set<() => void> }
const modes = new Map<string, AbMode>()
const registeredShells = new WeakSet<InputShell>()
function modeFor(sessionId: string): AbMode {
  let mode = modes.get(sessionId)
  if (!mode) { mode = { preferences: { enabled: false, mode: 'same-model', generationMinutes: 30, models: [{}, {}] }, loaded: false, loading: false, collapsed: false, saving: 0, pending: Promise.resolve(), listeners: new Set() }; modes.set(sessionId, mode) }
  return mode
}
function publishMode(mode: AbMode): void { for (const update of mode.listeners) update() }
async function loadMode(sessionId: string): Promise<void> {
  const mode = modeFor(sessionId)
  if (mode.loading) return
  mode.loading = true; delete mode.error; publishMode(mode)
  try { mode.preferences = await call<AbPreferences>('preferences', { sessionId }); mode.loaded = true }
  catch (e) { mode.error = (e as Error).message }
  finally { mode.loading = false; publishMode(mode) }
}
function saveMode(sessionId: string, next: AbPreferences): void {
  const mode = modeFor(sessionId)
  mode.preferences = next; mode.saving++; delete mode.error; publishMode(mode)
  mode.pending = mode.pending.catch(() => {}).then(async () => { await call('preferences', { sessionId, value: next }) }).catch((e: Error) => { mode.error = `设置未保存：${e.message}`; throw e }).finally(() => { mode.saving--; publishMode(mode) })
  void mode.pending.catch(() => {})
}
function useAbMode(sessionId: string): AbMode {
  const [, force] = useState(0)
  const mode = modeFor(sessionId)
  useEffect(() => {
    const update = (): void => force((n) => n + 1)
    mode.listeners.add(update)
    const state = inputShell(sessionId)?.state
    const unsubscribe = typeof state?.subscribe === 'function' ? state.subscribe(update) : undefined
    if (!mode.loaded && !mode.loading) void loadMode(sessionId)
    return () => { mode.listeners.delete(update); unsubscribe?.() }
  }, [mode, sessionId])
  return mode
}
async function executeComparison(sessionId: string, task: string, example = false): Promise<{ kind: 'success' | 'error'; text?: string }> {
  const mode = modeFor(sessionId)
  const preferences = mode.preferences
  if (!mode.loaded) return { kind: 'error', text: '比较设置尚未读取，请稍后重试' }
  await mode.pending
  const support = clientSupport(sessionId)
  if (!support.canExecute || (!example && !support.ok)) return { kind: 'error', text: clientSupportMessage(sessionId) ?? '会话命令执行接口不可用，请检查 DSH 版本。' }
  const setup = await call<Setup>('setup', { sessionId })
  if (setup.capabilities?.ok === false) return { kind: 'error', text: '当前 DSH ' + (setup.dshVersion ?? '（版本未知）') + ' 缺少比较所需接口：' + setup.capabilities.missing.join('、') + '。请升级或回退至已验证的版本；草稿保留。' }
  if (!example && setup.project?.supported === false) return { kind: 'error', text: '当前项目不受支持：' + (setup.project.reason ?? '请使用仓库根目录的 Vite 项目。') + ' 草稿保留，也可以试跑内置示例。' }
  const remote = clientCtx?.remote?.commands
  if (!remote) throw new Error('会话命令执行器不可用，请重新打开对话')
  const result = await remote.execute(sessionId, `/ab @ui ${JSON.stringify({ version: 1, task, example, preferences })}`, [])
  if (!result.ok) throw new Error(result.error?.message ?? '比较未能进入会话')
  if (!result.value) throw new Error('比较命令未注册，请检查插件是否已加载')
  const outcome = result.value.result
  const args = ['command/executed', sessionId, 'ab', outcome]
  // Match the host's local acknowledgment; it is separate from durable command events.
  try {
    if (typeof clientCtx?.events?.dispatch === 'function') for (const listener of clientCtx.events.dispatch('emit', args)) {
      try {
        const returned = listener(sessionId, 'ab', outcome)
        if (returned && typeof (returned as Promise<unknown>).then === 'function') void Promise.resolve(returned).catch(() => {})
      } catch { /* A notification observer cannot change command admission. */ }
    }
  } catch { /* An unavailable notification seam cannot undo an admitted command. */ }
  if (outcome.kind === 'success') {
    mode.runId = /运行 ([0-9a-f]{8})/.exec(outcome.text ?? '')?.[1]
    mode.collapsed = true; publishMode(mode)
    return { kind: 'success' }
  }
  return outcome
}
function enterMode(sessionId: string): boolean {
  const shell = inputShell(sessionId), state = inputSnapshot(sessionId)
  if (typeof shell?.beginCommand !== 'function' || !state || !['plain', 'claimed'].includes(state.phase) || (state.claim && state.claim.name !== 'ab')) return false
  const applied = shell.beginCommand({ name: 'ab', token: '/ab ', hint: '只需写需求；模型与时长在上方选择', submit: (task) => executeComparison(sessionId, task) }, { start: 0, end: state.claim?.name === 'ab' ? 1 : 0, draftRev: state.draftRev })
  if (applied) registeredShells.add(shell)
  return applied
}
function leaveMode(sessionId: string): boolean {
  const scope = sessionScope(sessionId), state = inputSnapshot(sessionId)
  if (!state || !['plain', 'claimed'].includes(state.phase)) return false
  if (state.claim?.name !== 'ab') return true
  return scope?.bail?.(scope, 'slash/input-consume-token', { guard: { kind: 'span', span: { start: 0, end: 1, draftRev: state.draftRev } } }) === true
}
/** Re-render every second while `on`, for live elapsed times. */
function useTick(on: boolean): void {
  const [, set] = useState(0)
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => set((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [on])
}
// ---- copy ----
const PIPELINE: Array<{ stage: Stage; label: string }> = [
  { stage: 'preparing', label: '隔离副本' },
  { stage: 'generating', label: 'Agent 实现' },
  { stage: 'sealing', label: '封存改动' },
  { stage: 'installing', label: '冻结安装' },
  { stage: 'verifying', label: '检查与构建' },
  { stage: 'previewing', label: '运行构建产物' },
]
const STAGE_TEXT: Record<Stage, string> = {
  queued: '排队中', preparing: '准备隔离副本', generating: 'Agent 正在实现', sealing: '封存改动', installing: '安装依赖',
  verifying: '检查与构建', previewing: '启动并验收页面', ready: '可以体验', failed: '失败', stopping: '正在停止', cancelled: '已停止', interrupted: '已中断',
}
const CHECK_TEXT: Record<string, string> = { typecheck: '类型检查', lint: 'Lint', build: '构建', test: '测试', browser: '页面验收' }
const ERROR_STAGE: Partial<Record<Stage, string>> = { preparing: '准备副本', generating: '实现', sealing: '封存改动', installing: '安装依赖', verifying: '检查与构建', previewing: '启动与验收页面' }
const STATE_TEXT: Record<string, string> = {
  running: '进行中', judging: '待选择', revealed: '已揭晓', adopting: '采用中', adopted: '已采用', recovery: '需要处理', abandoned: '已结束', interrupted: '已中断',
}
const ACTIVE = new Set(['running', 'judging', 'revealed', 'adopting', 'recovery'])
const LIVE_POLL = new Set(['running', 'adopting'])
const REVEALED = new Set(['revealed', 'adopting', 'adopted', 'recovery'])
function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}
function elapsed(c: Cand): number {
  if (c.verificationHistory?.length) return Object.entries(c.timings).filter(([stage]) => ['installing', 'verifying', 'previewing'].includes(stage))
    .reduce((sum, [, timing]) => sum + (timing ? Math.max(0, (timing.endedAt ?? (busyStage(c.stage) ? Date.now() : timing.startedAt)) - timing.startedAt) : 0), 0)
  const timings = Object.entries(c.timings).filter(([s]) => s !== 'ready')
  const starts = timings.map(([, t]) => t?.startedAt ?? Infinity)
  const ends = timings.map(([, t]) => t?.endedAt ?? (busyStage(c.stage) ? Date.now() : t?.startedAt ?? 0))
  const first = Math.min(...starts)
  return Number.isFinite(first) ? Math.max(...ends) - first : 0
}
function busyStage(s: Stage): boolean {
  return !['ready', 'failed', 'cancelled', 'interrupted', 'queued'].includes(s)
}
function routeText(r?: Route): string {
  return r?.model ? `${r.model}${r.provider ? ` · ${r.provider}` : ''}` : ''
}
function when(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
// ---- styles (scoped by the .ac- prefix) ----
const CSS = `
.ac-root{--ac-bg:var(--dsw-alias-bg-base,#fff);--ac-l1:var(--dsw-alias-bg-layer-1,#f7f8fa);--ac-l2:var(--dsw-alias-bg-layer-2,#f0f2f5);
--ac-fg:var(--dsw-alias-label-primary,#0f1115);--ac-fg2:var(--dsw-alias-label-secondary,#4b5260);--ac-fg3:var(--dsw-alias-label-secondary,#596475);
--ac-border:var(--dsw-alias-border-l2,rgba(15,17,21,.10));--ac-border-strong:var(--dsw-alias-border-l3,rgba(15,17,21,.16));
--ac-brand:var(--dsw-alias-brand-primary,#4056d9);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#fff);
--ac-ok:var(--dsw-alias-state-success-primary,#157847);--ac-err:var(--dsw-alias-state-error-primary,#a91e2e);--ac-warn:var(--dsw-alias-state-warn-primary,#926200);
--ac-hover:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));
--ac-r-sm:var(--dsw-radius-sm,8px);--ac-r-md:var(--dsw-radius-md,10px);--ac-r-lg:var(--dsw-radius-lg,14px);
font-family:var(--dsw-font-family,inherit);color:var(--ac-fg);font-size:13px;line-height:1.5}
.ac-root *{box-sizing:border-box}
.ac-mask{position:fixed;inset:0;z-index:1000;background:var(--dsw-alias-bg-mask-1,rgba(15,17,21,.28));animation:ac-fade .15s ease-out}
.ac-sheet{position:fixed;z-index:1001;top:max(52px,calc(env(titlebar-area-height,0px) + 12px));left:16px;right:16px;bottom:16px;
background:var(--ac-bg);border:1px solid var(--ac-border);border-radius:var(--dsw-radius-panel,16px);box-shadow:var(--dsw-shadow-lv3,0 24px 64px rgba(15,17,21,.18));
display:flex;flex-direction:column;overflow:hidden;animation:ac-rise .18s ease-out}
@keyframes ac-fade{from{opacity:0}}@keyframes ac-rise{from{opacity:0;transform:translateY(8px)}}
@keyframes ac-spin{to{transform:rotate(360deg)}}@keyframes ac-pulse{50%{opacity:.45}}
.ac-head{display:flex;align-items:center;gap:12px;padding:12px 16px 12px 20px;border-bottom:1px solid var(--ac-border)}
.ac-logo{display:inline-flex;align-items:center;justify-content:center;height:24px;padding:0 7px;border-radius:7px;background:var(--ac-brand);color:var(--ac-brand-fg);font-weight:700;font-size:12px;letter-spacing:.02em}
.ac-title{font-weight:600;font-size:14px}
.ac-task{flex:1;min-width:0;color:var(--ac-fg2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-spacer{flex:1}
.ac-tabs{display:flex;gap:2px;padding:2px;border-radius:9px;background:var(--ac-l2)}
.ac-tab{border:none;background:transparent;color:var(--ac-fg2);font:inherit;font-size:12px;font-weight:500;height:26px;padding:0 10px;border-radius:7px;cursor:pointer}
.ac-tab.on{background:var(--ac-bg);color:var(--ac-fg);box-shadow:0 1px 2px rgba(15,17,21,.08)}
.ac-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--ac-r-sm);border:none;background:transparent;color:var(--ac-fg2);cursor:pointer}
.ac-icon-btn:hover{background:var(--ac-hover);color:var(--ac-fg)}
.ac-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--ac-r-sm);border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
.ac-btn:hover:not(:disabled){background:var(--ac-hover)}
.ac-btn:disabled{opacity:.5;cursor:default}
.ac-btn.primary{background:var(--dsw-alias-button-primary-fill,var(--ac-brand));border-color:transparent;color:var(--ac-brand-fg)}
.ac-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--ac-brand));filter:brightness(1.06)}
.ac-btn.lg{height:38px;padding:0 18px;font-size:14px}
.ac-btn.sm{height:26px;padding:0 10px;font-size:12px}
.ac-btn.danger{color:var(--ac-err)}
.ac-btn:focus-visible,.ac-icon-btn:focus-visible,.ac-chip:focus-visible,.ac-tab:focus-visible,.ac-seg button:focus-visible{outline:2px solid var(--ac-brand);outline-offset:2px}
.ac-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.ac-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;background:var(--ac-l2);color:var(--ac-fg2);white-space:nowrap}
.ac-pill.ok{background:color-mix(in srgb,var(--ac-ok) 14%,transparent);color:var(--ac-ok)}
.ac-pill.err{background:color-mix(in srgb,var(--ac-err) 12%,transparent);color:var(--ac-err)}
.ac-pill.warn{background:color-mix(in srgb,var(--ac-warn) 14%,transparent);color:var(--ac-warn)}
.ac-pill.ok,.ac-pill.err,.ac-pill.warn{color:var(--ac-fg)}
.ac-pill.ok .ac-dot{background:var(--ac-ok)}.ac-pill.err .ac-dot{background:var(--ac-err)}.ac-pill.warn .ac-dot{background:var(--ac-warn)}
.ac-pill.brand{background:color-mix(in srgb,var(--ac-brand) 12%,transparent);color:var(--ac-brand)}
.ac-spin{width:11px;height:11px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ac-spin .8s linear infinite}
.ac-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
/* start */
.ac-start{max-width:780px;margin:auto;width:100%;padding:36px 24px 32px;display:flex;flex-direction:column;gap:20px}
.ac-h1{font-size:22px;font-weight:650;letter-spacing:-.01em;margin:0}
.ac-lead{color:var(--ac-fg2);margin:6px 0 0;font-size:14px}
.ac-seg{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:var(--ac-l2);align-self:flex-start}
.ac-seg button{border:none;background:transparent;color:var(--ac-fg2);font:inherit;font-weight:500;height:30px;padding:0 14px;border-radius:8px;cursor:pointer}
.ac-seg button.on{background:var(--ac-bg);color:var(--ac-fg);box-shadow:0 1px 2px rgba(15,17,21,.08)}
.ac-models{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ac-models label{display:flex;flex-direction:column;gap:4px;color:var(--ac-fg3);font-size:12px}
.ac-models select{height:34px;border-radius:var(--ac-r-sm);border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;padding:0 8px}
.ac-field{border:1px solid var(--ac-border-strong);border-radius:var(--ac-r-lg);background:var(--ac-bg);transition:border-color .12s,box-shadow .12s}
.ac-field:focus-within{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-field textarea{display:block;width:100%;min-height:104px;resize:vertical;border:none;outline:none;background:transparent;color:var(--ac-fg);font:inherit;font-size:14px;padding:14px 16px 6px}
.ac-field textarea::placeholder{color:var(--ac-fg3)}
.ac-field-foot{display:flex;align-items:center;gap:8px;padding:8px 10px 10px 16px}
.ac-chips{flex:1;min-width:0;display:flex;gap:6px;flex-wrap:wrap}
.ac-chip{border:1px solid var(--ac-border);background:var(--ac-l1);color:var(--ac-fg2);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.ac-chip:hover{color:var(--ac-fg);background:var(--ac-hover)}
.ac-case{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:var(--ac-r-lg);border:1px dashed var(--ac-border-strong);background:var(--ac-l1)}
.ac-case div{flex:1;min-width:0}
.ac-case b{display:block;font-size:13px}
.ac-case span{color:var(--ac-fg3);font-size:12px}
.ac-note{color:var(--ac-fg3);font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
.ac-kbd{font-size:11px;color:var(--ac-fg3);margin-right:4px}
.ac-error{margin:0 16px;padding:8px 12px;border-radius:var(--ac-r-sm);background:color-mix(in srgb,var(--ac-err) 10%,transparent);color:var(--ac-err);white-space:pre-wrap}
/* compare */
.ac-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;min-height:540px}
.ac-card{display:flex;flex-direction:column;min-height:0;border:1px solid var(--ac-border);border-radius:var(--ac-r-lg);background:var(--ac-bg);overflow:hidden;transition:box-shadow .15s,border-color .15s}
.ac-card.picked{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-card-head{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ac-border)}
.ac-row{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.ac-label{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--ac-fg);color:var(--ac-bg);font-weight:700;font-size:14px}
.ac-meta{color:var(--ac-fg3);font-size:12px}
.ac-track{display:flex;gap:4px}
.ac-track i{flex:1;height:4px;border-radius:2px;background:var(--ac-l2)}
.ac-track i.done{background:var(--ac-ok)}
.ac-track i.now{background:var(--ac-brand);animation:ac-pulse 1.2s ease-in-out infinite}
.ac-track i.bad{background:var(--ac-err)}
.ac-checks{display:flex;flex-wrap:wrap;gap:6px}
.ac-check{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:6px;font-size:12px;background:var(--ac-l1);color:var(--ac-fg2);border:1px solid var(--ac-border)}
.ac-check.passed{color:var(--ac-ok)}.ac-check.failed,.ac-check.timeout{color:var(--ac-err)}.ac-check.skipped{color:var(--ac-fg3)}
.ac-verdict{font-size:12px;padding:6px 10px;border-radius:var(--ac-r-sm)}
.ac-verdict.ok{background:color-mix(in srgb,var(--ac-ok) 9%,transparent);color:var(--ac-ok)}
.ac-verdict.bad{background:color-mix(in srgb,var(--ac-err) 8%,transparent);color:var(--ac-err)}
.ac-verdict small{display:block;color:var(--ac-fg3)}
.ac-steps-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:2px;font-size:12px}
.ac-steps-list li.ok{color:var(--ac-fg2)}.ac-steps-list li.bad{color:var(--ac-err)}
.ac-details summary{cursor:pointer;color:var(--ac-fg3);font-size:12px}
.ac-strategy{margin-left:auto;font-weight:600;font-size:12px}
.ac-summary{color:var(--ac-fg2);font-size:12px;white-space:pre-wrap;max-height:84px;overflow:auto}
.ac-browser{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
.ac-chrome{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--ac-border);background:var(--ac-l1)}
.ac-lights{display:flex;gap:5px}.ac-lights i{width:9px;height:9px;border-radius:50%;background:var(--ac-border-strong)}
.ac-url{flex:1;min-width:0;height:24px;display:flex;align-items:center;padding:0 10px;border-radius:6px;background:var(--ac-bg);color:var(--ac-fg3);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ac-frame{flex:1;width:100%;min-height:0;border:none;background:#fff}
.ac-shot{flex:1;min-height:0;min-width:0;overflow:auto;padding:12px;background:var(--ac-l1)}
.ac-shot img{display:block;width:100%;max-width:1280px;height:auto;margin:0 auto;border-radius:8px;border:1px solid var(--ac-border);box-sizing:border-box}
.ac-shot img.m{max-width:390px}
.ac-shot.natural img{width:auto;max-width:none;margin:0}
.ac-shot:focus-visible{outline:2px solid var(--ac-brand);outline-offset:-3px}
.ac-shottools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid var(--ac-border);color:var(--ac-fg2);font-size:12px}
.ac-shottools span{flex:1}
.ac-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ac-fg3);padding:24px;text-align:center}
.ac-skel{width:min(320px,70%);display:flex;flex-direction:column;gap:8px}.ac-skel i{height:10px;border-radius:5px;background:var(--ac-l2);animation:ac-pulse 1.4s ease-in-out infinite}
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;white-space:pre-wrap}
.ac-fail b{display:block;color:var(--ac-err);font-family:var(--dsw-font-family,inherit);margin-bottom:6px}
.ac-fail.interrupted{background:color-mix(in srgb,var(--ac-warn) 8%,transparent)}
.ac-fail.interrupted b{color:var(--ac-warn)}
.ac-install-log{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}
.ac-salvage{display:flex;align-items:center;gap:12px;margin-top:14px;padding:10px 12px;border-radius:var(--ac-r-sm);background:var(--ac-bg);border:1px solid var(--ac-border);font-family:var(--dsw-font-family,inherit);white-space:normal;color:var(--ac-fg2)}
.ac-salvage span{flex:1}
.ac-activity code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;color:var(--ac-fg2)}
.ac-slow{color:var(--ac-warn)}
.ac-budget{display:inline-flex;align-items:center;gap:6px;color:var(--ac-fg3);font-size:12px;white-space:nowrap}
.ac-budget select{height:28px;border-radius:7px;border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-size:12px}
.ac-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--ac-border);background:var(--ac-bg);flex-wrap:wrap}
.ac-bar-text{flex:1;min-width:200px;color:var(--ac-fg2)}
.ac-bar-text strong{color:var(--ac-fg)}
.ac-banner{flex:none;margin:16px 16px 0;padding:12px 14px;border-radius:var(--ac-r-md);background:var(--ac-l1);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:6px}
.ac-banner.warn{background:color-mix(in srgb,var(--ac-warn) 10%,transparent);border-color:color-mix(in srgb,var(--ac-warn) 30%,transparent)}
.ac-banner.err{background:color-mix(in srgb,var(--ac-err) 8%,transparent);border-color:color-mix(in srgb,var(--ac-err) 25%,transparent)}
.ac-banner code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-banner .disclaimer{color:var(--ac-fg3);font-size:12px}
.ac-copy-space{margin:16px;padding:14px;border:1px solid var(--ac-border);border-radius:var(--ac-r-md);background:var(--ac-l1);font-size:13px}.ac-copy-space .ac-note{margin:5px 0}.ac-copy-plan{margin-top:12px;border-top:1px solid var(--ac-border);padding-top:8px}.ac-copy-plan p{line-height:1.7}.ac-copy-plan ul{padding-left:20px}.ac-copy-plan li{margin:10px 0}.ac-copy-plan code{overflow-wrap:anywhere}.ac-copy-plan .ac-row{flex-wrap:wrap}.ac-inline .ac-copy-space{margin:12px}
.ac-next{flex:none;margin:16px;padding:16px;border-radius:var(--ac-r-lg);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:10px}
.ac-next b{font-size:14px}
.ac-link{color:var(--dsw-alias-link,var(--ac-brand));text-decoration:underline;text-underline-offset:2px}
.ac-history{max-width:860px;width:100%;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:8px}
.ac-hrow{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--ac-r-md);border:1px solid var(--ac-border);background:var(--ac-bg);text-align:left;font:inherit;color:inherit;cursor:pointer}
.ac-hrow:hover{background:var(--ac-hover)}
.ac-hrow.legacy,.ac-hrow.legacy:hover{cursor:default;background:var(--ac-l1)}
.ac-hrow.ac-hrow-unavailable{border-color:var(--ac-warn)}.ac-history-issue-filter{display:flex;align-items:center;gap:8px;color:var(--ac-fg2);font-size:12px}.ac-history-issue-filter input{width:16px;height:16px;accent-color:var(--ac-brand)}.ac-history-problem{font-size:12px;line-height:1.6;color:var(--ac-fg2);overflow-wrap:anywhere}
.ac-hrow span.t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-history-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--ac-border)}
.ac-history-controls label{display:flex;flex-direction:column;gap:6px;color:var(--ac-fg2);font-size:12px}.ac-history-controls select,.ac-history-controls input{height:36px;box-sizing:border-box;border:1px solid var(--ac-border-strong);border-radius:8px;background:var(--ac-bg);color:var(--ac-fg);font:inherit;padding:0 10px;min-width:0}
.ac-history-search{display:flex;align-items:end;gap:8px;flex:1;min-width:200px}.ac-history-search label{flex:1;min-width:0}.ac-history-search input{width:100%}.ac-history-status,.ac-history-pages{display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--ac-fg2);font-size:12px}.ac-history-status{min-height:24px}.ac-history-pages{justify-content:space-between;padding-top:12px;border-top:1px solid var(--ac-border)}.ac-hrow-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}.ac-hrow-copy .ac-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-history .ac-empty{height:auto;min-height:180px;padding:24px;text-align:center}
@media(max-width:600px){.ac-history{padding:16px 12px}.ac-history-controls>label,.ac-history-search{width:100%}.ac-history-search{min-width:0;flex-basis:100%}.ac-hrow{padding:12px;gap:8px;flex-wrap:wrap}.ac-hrow>.ac-meta{margin-left:auto}.ac-history-pages>.ac-row{width:100%;justify-content:space-between}}
.ac-header-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 7px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 11px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));color:var(--dsw-alias-label-primary,#0f1115)}
.ac-header-tools{display:flex;align-items:center;gap:6px;-webkit-app-region:no-drag}.ac-header-tools-hero{position:fixed;top:var(--ac-header-top,max(6px,env(titlebar-area-height,0px)));right:var(--ac-header-right,56px);z-index:20;max-width:calc(100vw - 80px)}
@media (max-width:900px){.ac-grid{grid-template-columns:1fr;height:auto}.ac-card{min-height:460px}.ac-models{grid-template-columns:1fr}}
/* in the conversation */
.ac-inline{margin:4px 0 8px;border:1px solid var(--ac-border);border-radius:var(--ac-r-lg);background:var(--ac-bg);overflow:hidden}
.ac-inline-head{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--ac-border);background:var(--ac-l1)}
.ac-inline-head .ac-task{font-size:13px}
.ac-inline .ac-grid{min-height:0;padding:12px;gap:12px}
.ac-inline .ac-card{min-height:0}
.ac-inline .ac-browser,.ac-inline .ac-shotwrap,.ac-inline .ac-fail,.ac-inline .ac-empty{height:300px;flex:none}
.ac-inline .ac-banner{margin:12px 12px 0}
.ac-inline .ac-bar{padding:10px 12px}
.ac-inline-note{padding:10px 14px;color:var(--ac-fg2)}
.ac-shotwrap{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
.ac-shotbar{display:flex;align-items:center;gap:10px;padding:8px 12px;color:var(--ac-fg3);font-size:12px;border-bottom:1px solid var(--ac-border)}
.ac-shotbar span{flex:1}
.ac-mode-btn{display:inline-flex;align-items:center;justify-content:center;height:28px;padding:0 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 12px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-mode-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05))}
.ac-mode-btn.on{background:var(--dsw-alias-brand-primary,#4d6bfe);border-color:transparent;color:#fff}
.ac-guide{max-width:820px;width:100%;margin:0 auto;padding:24px;display:flex;flex-direction:column;gap:18px}
.ac-guide h3{margin:0;font-size:15px}
.ac-guide ol,.ac-guide ul{margin:6px 0 0;padding-left:20px;color:var(--ac-fg2);display:flex;flex-direction:column;gap:4px}
.ac-guide code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;background:var(--ac-l2);padding:1px 5px;border-radius:5px}
.ac-back{margin:12px 16px 0;align-self:flex-start}
/* Workspace layout */
.ac-sheet{top:max(48px,calc(env(titlebar-area-height,0px) + 8px));left:12px;right:12px;bottom:12px;outline:none}
.ac-head{min-height:64px;padding:14px 24px;gap:12px}
.ac-logo{height:30px;padding:0 9px;border-radius:9px;background:var(--ac-fg);color:var(--ac-bg)}
.ac-header-caption{color:var(--ac-fg3);font-size:12px;border-left:1px solid var(--ac-border);padding-left:12px}
.ac-tabs{background:transparent;gap:4px}.ac-tab{height:34px;padding:0 14px;font-size:13px}.ac-tab.on{background:var(--ac-l2);box-shadow:none;color:var(--ac-fg)}
.ac-root button,.ac-root select,.ac-root textarea{font-family:inherit}
.ac-root :is(input,select,textarea,a,summary):focus-visible{outline:2px solid var(--ac-brand);outline-offset:3px}
.ac-sr{position:absolute!important;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.ac-start{max-width:920px;margin:0 auto;padding:30px 36px 0;gap:22px}
.ac-eyebrow{display:block;color:var(--ac-fg3);font-size:12px;letter-spacing:.08em;margin-bottom:8px}
.ac-h1{font-size:30px;font-weight:650;letter-spacing:-.03em;line-height:1.35}.ac-lead{font-size:13px;margin-top:8px;line-height:1.7}
.ac-form-group{border:0;padding:0;margin:0;min-width:0;display:flex;flex-direction:column;gap:10px}
.ac-form-group legend{float:left;display:flex;align-items:center;gap:8px;width:100%;font-size:13px;font-weight:600;padding:0;margin-bottom:10px}
.ac-step-num{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:var(--ac-l2);color:var(--ac-fg2);border-radius:7px;font-size:11px}
.ac-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;clear:both}
.ac-option{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;border:1px solid var(--ac-border-strong);border-radius:12px;cursor:pointer;background:var(--ac-bg);min-width:0;transition:border-color .15s,background .15s}
.ac-option.selected{border-color:var(--ac-brand);background:color-mix(in srgb,var(--ac-brand) 4%,var(--ac-bg))}
.ac-option input{accent-color:var(--ac-brand);margin:3px 0 0;flex:none}
.ac-option>span{min-width:0;display:flex;flex-direction:column;gap:4px}.ac-option b{font-size:13px;font-weight:600}.ac-option small{font-size:12px;color:var(--ac-fg2);overflow-wrap:anywhere;line-height:1.5}
.ac-option em{font-style:normal;margin-left:5px;font-size:10px;font-weight:500;background:var(--ac-l2);color:var(--ac-fg2);padding:2px 5px;border-radius:4px}
.ac-field textarea{min-height:94px;padding:13px 15px 4px;line-height:1.65;font-size:14px}.ac-field-foot{padding:4px 12px 10px;gap:8px}
.ac-field textarea:focus-visible{outline:none}
.ac-field-note{margin:0;font-size:12px;color:var(--ac-fg2);line-height:1.6}.ac-field-note.warn{color:var(--ac-warn)}
.ac-limit{display:flex;align-items:center;gap:12px;flex-wrap:wrap;color:var(--ac-fg2);font-size:12px;padding-top:4px}
.ac-limit label{color:var(--ac-fg);font-weight:500}.ac-limit select{height:32px;padding:0 26px 0 10px;border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);border-radius:8px}.ac-limit>span{flex:1;min-width:180px}
.ac-start-foot{position:sticky;bottom:0;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0 20px;border-top:1px solid var(--ac-border);background:var(--ac-bg);z-index:2}
.ac-start-foot>div{display:flex;flex-direction:column;gap:4px}.ac-start-foot b{font-size:13px}.ac-start-foot span{font-size:12px;color:var(--ac-fg2)}.ac-start-foot .ac-btn{height:42px;min-width:155px;justify-content:center}
.ac-text-btn{border:0;background:transparent;color:var(--ac-brand);font:inherit;font-size:12px;padding:4px;cursor:pointer;white-space:nowrap}
.ac-feedback{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px;border:1px solid color-mix(in srgb,var(--ac-err) 35%,transparent);background:color-mix(in srgb,var(--ac-err) 6%,var(--ac-bg));border-radius:10px;white-space:pre-wrap}
.ac-prerequisite{display:block;overflow-wrap:anywhere}.ac-prerequisite-actions{display:flex;flex-wrap:wrap;gap:16px;margin-top:8px}
.ac-run-heading{display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--ac-border)}
.ac-action-dock{position:sticky;top:0;z-index:3;background:var(--ac-bg)}.ac-bar{border-top:0;border-bottom:1px solid var(--ac-border);padding:12px 20px;min-height:60px}
.ac-review{display:flex;justify-content:space-between;gap:20px;margin:16px 20px 0;padding:16px;border:1px solid var(--ac-brand);border-radius:12px;background:color-mix(in srgb,var(--ac-brand) 5%,var(--ac-bg))}.ac-review p{margin:6px 0;font-size:12px;color:var(--ac-fg2)}.ac-review .ac-row{align-self:flex-start;flex:none}.ac-project-path{overflow-wrap:anywhere}
.ac-compare-tools{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:16px 20px 0}.ac-compare-tools .ac-seg button{font-size:12px;height:28px;padding:0 12px}
.ac-preview-limits{margin:8px 20px 0;font-size:12px;color:var(--ac-fg2);flex:none}.ac-preview-limits summary{cursor:pointer}.ac-preview-limits p{max-width:900px;line-height:1.6;margin:6px 0 0}
.ac-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;min-height:0;flex:none;padding:16px 20px 20px;gap:16px}.ac-grid.focus{grid-template-columns:minmax(0,1fr)}
.ac-card{min-width:0;min-height:360px}.ac-card[hidden]{display:none}.ac-card-head{gap:6px;padding:12px}.ac-card .ac-empty,.ac-card .ac-fail{min-height:240px}.ac-card-head .ac-preview-open{margin-left:auto;flex:none}
.ac-evidence>summary,.ac-patch>summary{font-size:12px;color:var(--ac-fg2)}.ac-evidence[open]{display:flex;flex-direction:column;gap:8px}.ac-evidence .ac-verdict{margin-top:8px}
.ac-patch pre{max-height:340px;max-width:100%;overflow:auto;white-space:pre;font:11px/1.6 ui-monospace,monospace;background:var(--ac-l1);border:1px solid var(--ac-border);border-radius:8px;padding:12px}
.ac-patch .ac-meta{overflow-wrap:anywhere;margin-top:8px}.ac-checks{min-height:22px}.ac-strategy{margin-left:0;flex-basis:100%;overflow-wrap:anywhere;font-weight:500;color:var(--ac-fg2)}
.ac-preview-stage{padding:12px;background:var(--ac-l1);overflow:hidden;min-height:100px;display:flex;justify-content:center}
.ac-preview-surface{position:relative;flex:none;background:white;border-radius:6px;overflow:hidden;box-shadow:0 0 0 1px var(--ac-border)}
.ac-frame{position:absolute;left:0;top:0;transform-origin:top left;display:block;max-width:none;min-height:0;border:0;background:white}
.ac-guide{max-width:800px;padding:36px;gap:24px}.ac-guide-steps{counter-reset:step;list-style:none!important;padding:0!important;gap:22px!important}.ac-guide-steps li{padding-left:38px;position:relative;counter-increment:step}.ac-guide-steps li:before{content:counter(step);position:absolute;left:0;top:0;width:24px;height:24px;display:grid;place-items:center;background:var(--ac-l2);border-radius:8px;color:var(--ac-fg2);font-size:12px}.ac-guide-steps b{font-size:14px;color:var(--ac-fg)}.ac-guide-steps p{margin:6px 0 0;line-height:1.8;font-size:13px}
.ac-inline .ac-compare-tools{display:flex;padding:12px 12px 0}.ac-inline .ac-preview-stage{display:flex;min-height:0}.ac-inline .ac-browser{height:auto;min-height:0}.ac-inline .ac-card-head{padding:10px 12px;gap:6px}.ac-inline .ac-card{min-height:0}.ac-inline .ac-action-dock{position:static}
.ac-composer-settings{flex:none;border:1px solid var(--ac-border-strong);border-radius:12px;padding:12px 14px;background:var(--ac-bg);display:flex;flex-direction:column;gap:10px;margin:0 0 8px}
.ac-conversation-run{flex:none;width:100%;border:1px solid var(--ac-border-strong);background:var(--ac-bg);border-radius:12px;margin:0 0 10px;overflow:hidden}
.ac-conversation-run-head{display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--ac-border);font-size:12px}.ac-conversation-run-scroll{max-height:min(760px,60vh);max-height:clamp(170px,calc(100dvh - 360px),760px);overflow:auto;overscroll-behavior:contain}.ac-conversation-run .ac-inline{margin:0;border:0;border-radius:0;overflow:visible}.ac-conversation-run .ac-action-dock{position:sticky;top:0}.ac-preview-label{font-weight:700;color:var(--ac-fg);font-size:12px}
.ac-settings-head{display:flex;align-items:center;gap:10px}.ac-settings-head>div{display:flex;flex:1;flex-wrap:wrap;gap:4px 12px;align-items:center}.ac-settings-head b{font-size:13px}.ac-settings-head span:not(.ac-logo){color:var(--ac-fg2);font-size:12px}
.ac-settings-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.ac-settings-row>.ac-seg button{font-size:12px;height:28px;padding:0 10px}.ac-settings-row>.ac-btn{margin-left:auto}.ac-settings-foot{font-size:11px;color:var(--ac-fg2)}.ac-settings-project{overflow-wrap:anywhere}.ac-composer-settings .ac-models{max-width:100%}.ac-composer-settings .ac-models select{min-width:0;width:100%}.ac-composer-settings .ac-feedback{padding:8px;font-size:12px}
@media(max-width:600px){.ac-composer-settings{padding:10px}.ac-settings-head>div{display:block}.ac-settings-head>div>span{display:block;margin-top:3px}.ac-settings-row{gap:8px}.ac-settings-row>.ac-seg{flex-basis:100%;width:100%}.ac-settings-row>.ac-seg button{flex:1;min-height:36px}.ac-settings-row>.ac-btn{height:36px}.ac-composer-settings .ac-models{grid-template-columns:minmax(0,1fr)}.ac-inline .ac-inline-head{flex-wrap:wrap}.ac-inline .ac-inline-head .ac-task{min-width:50%}}
@media(max-width:900px){.ac-sheet{left:6px;right:6px;bottom:6px}.ac-head{padding:12px 14px;gap:8px}.ac-header-caption{display:none}.ac-start{padding:24px 20px 0}.ac-grid{grid-template-columns:minmax(0,1fr)}.ac-card{min-height:0}.ac-models{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:600px){.ac-sheet{top:max(40px,env(titlebar-area-height,0px));left:0;right:0;bottom:0;border-radius:0}.ac-head{flex-wrap:wrap;gap:6px}.ac-title{font-size:13px}.ac-tabs{order:2;flex-basis:100%;justify-content:center}.ac-tab{flex:1}.ac-h1{font-size:25px}.ac-start{padding:22px 16px 0;gap:20px}.ac-options,.ac-models{grid-template-columns:minmax(0,1fr)}.ac-start-foot{align-items:stretch;flex-direction:column;gap:10px;padding:12px 0}.ac-start-foot>div>span{display:none}.ac-start-foot .ac-btn{width:100%}.ac-bar{padding:10px 12px;gap:8px}.ac-bar-text{min-width:100%;font-size:12px}.ac-bar .ac-btn{flex:1;justify-content:center;min-height:40px}.ac-grid{padding:12px;gap:12px}.ac-compare-tools{padding:12px 12px 0;gap:8px}.ac-compare-tools>.ac-meta{display:none}.ac-seg button{min-height:36px}.ac-review{margin:12px;flex-direction:column}.ac-run-heading{padding:10px 12px}.ac-run-heading>.ac-meta{display:none}.ac-guide{padding:24px 18px}.ac-hrow{flex-wrap:wrap}.ac-hrow .t{min-width:150px}.ac-header-caption{display:none}.ac-field-foot>.ac-meta{font-size:11px}.ac-field-foot{gap:4px}}
@media(prefers-color-scheme:dark){.ac-root{--ac-brand:var(--dsw-alias-brand-primary,#a1b0ff);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#111827);--ac-ok:var(--dsw-alias-state-success-primary,#65d89f);--ac-err:var(--dsw-alias-state-error-primary,#ff98a3);--ac-warn:var(--dsw-alias-state-warn-primary,#edc575)}}
@media(prefers-reduced-motion:reduce){.ac-root *{animation:none!important;transition:none!important}}
`

function Styles(): React.ReactElement {
  return <style>{CSS}</style>
}
const IconClose = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)
const IconExternal = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
function StagePill({ c }: { c: Cand }): React.ReactElement {
  const complete = Boolean(c.checks?.length && c.checks.every(check => check.outcome === 'passed'))
  const kind = c.stage === 'ready' ? c.verdict?.eligible ? complete ? 'ok' : '' : c.verdict ? 'err' : '' : c.stage === 'failed' ? 'err' : c.stage === 'interrupted' ? 'warn' : busyStage(c.stage) ? 'brand' : ''
  const availability = c.previewUrl ? '可预览' : c.hasScreenshot || c.hasMobileScreenshot ? '截图记录' : '验收完成'
  const title = c.stage === 'ready' ? `${availability} · ${c.verdict ? c.verdict.eligible ? complete ? '检查通过' : '部分检查未运行' : '未通过检查' : '检查状态未知'}` : STAGE_TEXT[c.stage]
  return (
    <span className={`ac-pill ${kind}`}>
      {busyStage(c.stage) ? <span className="ac-spin" /> : <span className="ac-dot" />}
      {title}
    </span>
  )
}
function Track({ c }: { c: Cand }): React.ReactElement {
  const failedAt = c.stage === 'failed' || c.stage === 'interrupted' ? c.error?.stage : undefined
  const current = PIPELINE.findIndex((p) => p.stage === (failedAt ?? c.stage))
  return (
    <div className="ac-track" aria-label="进度">
      {PIPELINE.map((p, i) => {
        const cls = c.stage === 'ready' || i < current ? 'done' : i === current ? (failedAt ? 'bad' : busyStage(c.stage) ? 'now' : '') : ''
        return <i key={p.stage} className={cls} title={p.label} />
      })}
    </div>
  )
}
function Checks({ checks }: { checks?: Check[] }): React.ReactElement | null {
  if (!checks?.length) return null
  const icon = { passed: '✓', failed: '✕', skipped: '–', timeout: '⏱' }
  return (
    <div className="ac-checks">
      {checks.map((k) => (
        <span key={k.name} className={`ac-check ${k.outcome}`} title={k.reason ?? `${fmt(k.durationMs)}`}>
          {icon[k.outcome]} {CHECK_TEXT[k.name] ?? k.name}{k.outcome === 'skipped' ? ' 未运行' : ''}
        </span>
      ))}
    </div>
  )
}
function Verdict({ c }: { c: Cand }): React.ReactElement | null {
  const v = c.verdict
  if (v === undefined) return null
  const steps = c.checks?.find((k) => k.name === 'browser')?.steps
  return (
    <>
      <div className={`ac-verdict ${v.eligible ? 'ok' : 'bad'}`}>
        {v.eligible ? '✓ 已通过已配置的检查；采用前仍需审查与目标核验' : `✕ 当前不能采用：${v.reasons.join('；')}`}
        {v.warnings.length > 0 && <small>{v.warnings.join('；')}</small>}
      </div>
      {steps && steps.length > 0 && (
        <details className="ac-details">
          <summary>需求验收 {steps.filter((s) => s.ok).length}/{steps.length} 步通过</summary>
          <ul className="ac-steps-list">
            {steps.map((s, i) => <li key={i} className={s.ok ? 'ok' : 'bad'}>{s.ok ? '✓' : '✕'} {s.label}{s.detail ? `（${s.detail}）` : ''}</li>)}
          </ul>
        </details>
      )}
    </>
  )
}
/** A finished candidate that is no longer served: its verification screenshots, and a way to serve it again. */
function Screenshots({ runId, c, busy, act, device }: { runId: string; c: Cand; busy: boolean; act: Act; device: PreviewDevice }): React.ReactElement {
  const mobile = device === 'phone', key = `${runId}/${c.label}/${mobile ? 'phone' : 'desktop'}`
  const available = mobile ? c.hasMobileScreenshot : c.hasScreenshot
  const description = `候选 ${c.label} ${mobile ? '手机' : '桌面'}验收截图`
  const [image, setImage] = useState<{ key: string; loading: boolean; url?: string; error?: string }>({ key, loading: !!available })
  const [retry, setRetry] = useState(0)
  const [original, setOriginal] = useState<{ key: string; value: boolean }>({ key, value: false })
  const natural = original.key === key && original.value
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setImage({ key, loading: !!available })
    if (available) call<{ dataUrl: string }>('shot', { runId, label: c.label, ...(mobile ? { mobile: true } : {}) }, controller.signal).then(r => {
      if (active) setImage({ key, loading: false, url: r.dataUrl })
    }, (error: Error) => { if (active) setImage({ key, loading: false, error: error.message }) })
    return () => { active = false; controller.abort() }
  }, [key, runId, c.label, mobile, available, retry])
  const current = image.key === key ? image : { key, loading: !!available }
  const reopen = c.canReopenPreview
    ? <button className="ac-btn primary sm" disabled={busy} onClick={() => act('reopenPreview', { label: c.label })}>重新打开预览</button>
    : null
  return (
    <div className="ac-shotwrap">
      <div className="ac-shotbar">
        <span>{c.canReopenPreview ? '预览已停止（DSH 重启或已结束），可以重新打开。下面是验收时的截图：' : '副本已清理，下面是验收时的截图：'}</span>
        {reopen}
      </div>
      <div className="ac-shottools"><span>{mobile ? '手机' : '桌面'}验收截图 · 静态记录</span>{current.url && <button className="ac-text-btn" aria-pressed={natural} onClick={() => setOriginal({ key, value: !natural })}>{natural ? '适应宽度' : '原始尺寸'}</button>}</div>
      {current.loading ? <div className="ac-empty" role="status">正在读取{description}…</div>
        : current.error ? <div className="ac-empty" role="alert">截图读取失败：{current.error}<button className="ac-btn sm" onClick={() => setRetry(n => n + 1)}>重试读取截图</button></div>
        : current.url ? <div className={`ac-shot${natural ? ' natural' : ''}`} tabIndex={0} role="region" aria-label={description}>
          <img className={mobile ? 'm' : ''} src={current.url} alt={description} onError={() => setImage({ key, loading: false, error: '图片无法显示，请重试读取。' })} />
        </div> : <div className="ac-empty">此记录没有{mobile ? '手机' : '桌面'}验收截图。</div>}
    </div>
  )
}
/** What the agent is doing right now, so a slow run reads as slow rather than stuck. */
function Activity({ p }: { p: NonNullable<Cand['progress']> }): React.ReactElement {
  const idle = Date.now() - p.lastActivityAt
  return (
    <div className="ac-meta ac-activity">
      已进行 {p.steps} 轮{p.lastAction ? <> · 最近：<code>{p.lastAction}</code></> : null}
      {p.tokens ? ` · ${p.tokens.toLocaleString()} tokens` : ''}
      {idle > 90_000 ? <span className="ac-slow"> · {fmt(idle)} 没有新动作（在等模型或工具）</span> : null}
    </div>
  )
}
type PreviewDevice = 'adaptive' | 'desktop' | 'phone'
function LivePreview({ c, device, compact }: { c: Cand; device: PreviewDevice; compact: boolean }): React.ReactElement {
  const holder = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const size = device === 'adaptive' ? { width: Math.max(240, width - 24), height: compact ? 320 : 480 } : device === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
  useEffect(() => {
    const el = holder.current
    if (!el) return
    const observer = new ResizeObserver(() => { if (el.clientWidth > 0) setWidth(el.clientWidth) })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const scale = Math.min(1, Math.max(1, width - 24) / size.width)
  return <div ref={holder} className="ac-preview-stage"><div className="ac-preview-surface" style={{ width: size.width * scale, height: size.height * scale }}>
    <iframe className="ac-frame" title={`候选 ${c.label} 的运行页面`} src={c.previewUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }} />
  </div></div>
}
function PatchReview({ runId, label }: { runId: string; label: 'A' | 'B' }): React.ReactElement {
  const [patch, setPatch] = useState<{ text: string; sha256?: string; truncated: boolean }>()
  const [error, setError] = useState<string>()
  const read = (): void => { setError(undefined); call<NonNullable<typeof patch>>('patch', { runId, label }).then(setPatch, (e: Error) => setError(e.message)) }
  return <details className="ac-details ac-patch" onToggle={(e) => { if (e.currentTarget.open && !patch) read() }}><summary>查看 {label} 的代码改动</summary>
    {error ? <div role="alert">{error} <button className="ac-text-btn" onClick={read}>重试</button></div> : !patch ? <p className="ac-meta">正在读取补丁…</p> : <>
      <div className="ac-meta">SHA-256 {patch.sha256 ?? '未知'}{patch.truncated ? ' · 补丁较大，当前仅显示前 400,000 个字符，请另存分支进行完整审查。' : ''}</div>
      <pre tabIndex={0} aria-label={`候选 ${label} 的补丁`}>{patch.text || '没有文本改动'}</pre>
    </>}
  </details>
}
function CandidateCard({ run, c, revealed, picked, busy, act, device, compact, hidden }: { run: Run; c: Cand; revealed: boolean; picked: boolean; busy: boolean; act: Act; device: PreviewDevice; compact: boolean; hidden?: boolean }): React.ReactElement {
  const usage = !revealed ? undefined : c.usage?.kind !== 'reported' ? '用量未知' : [
    c.usage.totalTokens === undefined ? '总用量未知' : `${c.usage.totalTokens.toLocaleString()} tokens`,
    ...([['inputTokens', '未缓存输入'], ['outputTokens', '输出'], ['cacheReadTokens', '缓存读取'], ['cacheWriteTokens', '缓存写入']] as const)
      .flatMap(([key, label]) => c.usage?.kind === 'reported' && c.usage[key] !== undefined ? [`${label} ${c.usage[key].toLocaleString()}`] : []),
  ].join(' · ')
  const live = c.previewUrl !== undefined && !['failed', 'cancelled', 'interrupted'].includes(c.stage)
  const step = busyStage(c.stage) && c.stage !== 'stopping' ? PIPELINE.findIndex((p) => p.stage === c.stage) + 1 : 0
  const model = revealed ? routeText(c.actualRoute ?? c.route) : ''
  return (
    <section className={`ac-card${picked ? ' picked' : ''}`} aria-label={`候选 ${c.label}`} hidden={hidden}>
      <div className="ac-card-head">
        <div className="ac-row">
          <span className="ac-label">{c.label}</span>
          <StagePill c={c} />
          {c.previewKind === 'dev' && live && <span className="ac-pill warn" title="构建没有通过，这是开发模式，只供观察">开发模式</span>}
          <span className="ac-meta">{c.verificationHistory?.length ? '本次验收 ' : ''}{fmt(elapsed(c))}</span>
          {run.state === 'running' && busyStage(c.stage) && c.stage !== 'stopping' && <button className="ac-btn sm" disabled={busy} onClick={() => act('cancel', { label: c.label })}>停止这一版</button>}
          {live && <a className="ac-icon-btn ac-preview-open" href={c.previewUrl} target="_blank" rel="noreferrer" title={`在浏览器标签页中打开 ${c.previewUrl}；Cookie 与存储上下文可能和嵌入预览不同`} aria-label={`在浏览器中打开 ${c.label}`}><IconExternal /></a>}
          {revealed && c.strategy && <span className="ac-strategy">{c.strategy.title}{model ? ` · ${model}` : ''}</span>}
        </div>
        {busyStage(c.stage) && <Track c={c} />}
        {step > 0 && <div className="ac-meta">第 {step}/{PIPELINE.length} 步 · {STAGE_TEXT[c.stage]}</div>}
        {c.stage === 'generating' && c.progress && <Activity p={revealed ? c.progress : { steps: c.progress.steps, lastActivityAt: c.progress.lastActivityAt, ...(c.progress.lastAction ? { lastAction: '正在处理项目' } : {}) }} />}
        <Checks checks={c.checks} />
        <details className="ac-details ac-evidence"><summary>{revealed ? '检查依据与用量' : '检查依据 · 盲选中'}{c.verdict ? c.verdict.eligible ? ' · 已通过配置检查' : ' · 存在采用阻碍' : ''}</summary><Verdict c={c} />
        {!revealed && <div className="ac-meta">模型、策略、用量、改动规模和详细日志在选择后显示。</div>}
        {c.execution && <div className="ac-meta">项目命令：{c.execution.enforcement === 'full' ? '宿主报告完整文件写入约束' : c.execution.enforcement === 'partial' ? '宿主报告部分文件写入约束' : '约束完整性未知'}。不包含文件读取与网络隔离。</div>}
        {c.install?.runtime && <div className="ac-meta">验收宿主 Node {c.install.runtime.hostNode} · {c.install.runtime.platform} · {c.install.runtime.packageManager} {c.install.runtime.packageManagerVersion ?? '版本未记录'}</div>}
        {revealed && <div className="ac-meta">阶段耗时：{(['preparing', 'generating', 'installing', 'verifying', 'previewing'] as const).map(stage => { const timing = c.timings[stage]; return `${STAGE_TEXT[stage]} ${timing?.endedAt === undefined ? '未完整记录' : fmt(Math.max(0, timing.endedAt - timing.startedAt))}` }).join(' · ')}。各阶段包含相应宿主开销，不等于纯模型等待。</div>}
        {revealed && (c.patchStats || usage) && (
          <div className="ac-meta">
            {c.patchStats ? `${c.patchStats.files} 个文件 · +${c.patchStats.insertions} −${c.patchStats.deletions}${c.patchStats.binary ? ` · ${c.patchStats.binary} 个二进制` : ''}` : ''}
            {c.patchStats && usage ? ' · ' : ''}{usage}
          </div>
        )}
        {revealed && c.summary && <div className="ac-summary">{c.summary}</div>}</details>
        {!!c.verificationHistory?.length && <details className="ac-details"><summary>先前验收记录 · {c.verificationHistory.length} 次</summary><ol>{c.verificationHistory.map((attempt, index) => <li key={index}><b>{attempt.install?.failure?.summary ?? attempt.error?.message.split('\n')[0] ?? '先前验收未完成'}</b><div className="ac-meta">重试前归档于 {when(attempt.recordedAt)} · {attempt.durationMs === undefined ? '耗时未知' : fmt(attempt.durationMs)}{attempt.install?.failure?.code ? ` · ${attempt.install.failure.code}` : ''}</div><Checks checks={attempt.checks} /></li>)}</ol></details>}
        {revealed && c.patchStats && <PatchReview runId={run.runId} label={c.label} />}
      </div>
      {live ? (
        <div className="ac-browser">
          <LivePreview c={c} device={device} compact={compact} />
        </div>
      ) : c.error || c.canRetryVerification ? (
        <div className={`ac-fail${c.stage === 'interrupted' ? ' interrupted' : ''}`}>
          <b>{c.install?.failure?.summary ?? (c.error ? `${ERROR_STAGE[c.error.stage] ?? STAGE_TEXT[c.error.stage] ?? c.error.stage}${c.stage === 'interrupted' ? '时中断' : c.stage === 'cancelled' ? '已停止' : '失败'}` : '验收已停止')}</b>
          {c.install?.failure ? <p>{c.install.failure.hint}{c.install.failure.code ? `（${c.install.failure.code}）` : ''}</p> : c.error?.message}
          {c.canRetryVerification && <div className="ac-salvage"><span>保留已封存代码与共同验收，不重新生成。</span><button className="ac-btn primary sm" disabled={busy} onClick={() => act('retryVerification', { label: c.label })}>重新验收 {c.label}</button></div>}
          {revealed && c.install?.failure?.diagnostic && <details className="ac-details"><summary>查看安装日志</summary><pre className="ac-install-log" tabIndex={0}>{c.install.failure.diagnostic}</pre></details>}
          {c.salvageable && (
            <div className="ac-salvage">
              <span>副本里还保留着它已经写的改动，可以照样封存并跑完整验收，由验收结果决定能否采用。</span>
              <button className="ac-btn primary sm" disabled={busy} onClick={() => act('salvage', { label: c.label })}>验收已写的改动</button>
            </div>
          )}
        </div>
      ) : c.stage === 'ready' ? (
        <Screenshots runId={run.runId} c={c} busy={busy} act={act} device={device} />
      ) : (
        <div className="ac-empty">
          <div className="ac-skel"><i style={{ width: '60%' }} /><i /><i style={{ width: '80%' }} /></div>
          <div>{c.stage === 'cancelled' ? '已停止' : c.stage === 'stopping' ? '正在停止并回收资源…' : `${STAGE_TEXT[c.stage]}…构建产物启动后，这里会显示真实页面`}</div>
        </div>
      )}
    </section>
  )
}
function ExampleTimingEvidence(): React.ReactElement {
  return <details className="ac-details"><summary>基础示例实测：首个预览中位 41 秒（指定配置 3 轮）</summary><p className="ac-meta">2026-11-05，Windows · DSH 0.2.1-rc.5 · Node 26.13.0 · DeepSeek Flash，基础搜索与清空任务。首个预览 39–60 秒，两版验收中位 112.5 秒；6/6 候选通过，3 次测试采用与撤销成功。每版报告约 12.3–123.5 万 token，含缓存，不能直接换算费用。宿主已启动，缓存未重置；这不是其他配置的耗时承诺。<a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/first-use.md" target="_blank" rel="noreferrer">查看源码、样本和测量条件</a></p></details>
}
/** Session-scoped controls above the resident conversation composer. */
function ComposerSettings({ sessionId, session }: { sessionId: string; session?: unknown }): React.ReactElement | null {
  const mode = useAbMode(sessionId), p = mode.preferences
  const [models, setModels] = useState<ModelItem[]>([])
  const [modelError, setModelError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [setup, setSetup] = useState<Setup>()
  const [setupError, setSetupError] = useState<string>()
  const [setupRetry, setSetupRetry] = useState(0)
  const [error, setError] = useState<string>()
  const state = inputSnapshot(sessionId)
  const enabled = p.enabled || state?.claim?.name === 'ab'
  const loadModels = useCallback(async () => {
    setLoading(true); setModelError(undefined)
    try { setModels((await call<{ models: ModelItem[] }>('models', { sessionId })).models) }
    catch (e) { setModelError((e as Error).message) }
    finally { setLoading(false) }
  }, [sessionId])
  useEffect(() => {
    if (!enabled || mode.collapsed) return
    // A completed newer read supersedes older reads; slow polling must still make progress.
    let active = true, request = 0, applied = 0
    const refresh = (): void => {
      if (document.visibilityState === 'hidden') return
      const version = ++request
      call<Setup>('setup', { sessionId }).then(value => { if (active && version >= applied) { applied = version; setSetup(value); setSetupError(undefined) } }, (error: Error) => { if (active && version >= applied) { applied = version; setSetup(undefined); setSetupError(error.message) } })
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    return () => { active = false; clearInterval(timer) }
  }, [enabled, mode.collapsed, session, sessionId, setupRetry])
  useEffect(() => { if (enabled && p.mode === 'cross-model') void loadModels() }, [enabled, p.mode, loadModels])
  useEffect(() => {
    if (!p.enabled || !mode.loaded || !state || !clientSupport(sessionId).ok || !['plain', 'claimed'].includes(state.phase)) return
    if (!state.claim || (state.claim.name === 'ab' && !registeredShells.has(inputShell(sessionId)!))) {
      if (!enterMode(sessionId)) setError(clientSupportMessage(sessionId) ?? '当前输入框暂时无法进入比较模式，请稍后重试。草稿未改动。')
    }
  }, [p.enabled, mode.loaded, state?.phase, state?.draftRev, sessionId])
  const close = (): void => {
    if (!leaveMode(sessionId)) { setError('当前消息正在提交，请等它结束后退出比较模式'); return }
    saveMode(sessionId, { ...p, enabled: false }); inputShell(sessionId)?.focus?.()
  }
  const example = async (): Promise<void> => {
    setBusy(true); setError(undefined)
    try { const result = await executeComparison(sessionId, '', true); if (result.kind === 'error') setError(result.text ?? '示例未能开始') }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const validPair = p.models.every(m => m.provider && m.model) && JSON.stringify(p.models[0]) !== JSON.stringify(p.models[1])
  if (!enabled && !mode.error) return null
  return <section className="ac-root ac-composer-settings" aria-label="A|B 比较设置"><Styles />
    <div className="ac-settings-head"><span className="ac-logo">A|B</span><div><b>对比模式</b><span>{mode.collapsed ? `${p.mode === 'same-model' ? '同一模型 · 两种策略' : '两个模型 · 同一要求'} · 每版 ${p.generationMinutes} 分钟` : '在下方写需求，发送后在这条对话里运行两版。'}</span></div><button className="ac-text-btn" onClick={() => { mode.collapsed = !mode.collapsed; publishMode(mode) }}>{mode.collapsed ? '展开设置' : '收起'}</button><button className="ac-icon-btn" onClick={close} disabled={busy} aria-label="退出 A|B 模式"><IconClose /></button></div>
    {setup?.capabilities?.ok === false && <div className="ac-feedback" role="alert">当前 DSH {setup.dshVersion ?? '（版本未知）'} 缺少比较所需接口：{setup.capabilities.missing.join('、')}。请升级或回退至已验证版本；比较记录和草稿保留。</div>}
    {setup?.capabilities?.warnings.includes('sessionController.resolveAgent') && <div className="ac-feedback" role="status">当前 DSH 缺少会话恢复接口：sessionController.resolveAgent。已打开的对话仍可使用；历史对话请先在 DSH 中重新打开。</div>}
    {setup?.project?.supported === false && <div className="ac-feedback" role="status">当前项目不受支持：{setup.project.reason ?? '请使用仓库根目录的 Vite 项目。'} 草稿保留，可试跑内置示例。</div>}
    {setup?.project?.supported && setup.project.warning && <div className="ac-feedback" role="status">{setup.project.warning}</div>}
    {!mode.collapsed && <>
    <div className="ac-settings-row"><div className="ac-seg" role="group" aria-label="比较方式"><button className={p.mode === 'same-model' ? 'on' : ''} aria-pressed={p.mode === 'same-model'} onClick={() => saveMode(sessionId, { ...p, mode: 'same-model' })}>同一模型 · 两种策略</button><button className={p.mode === 'cross-model' ? 'on' : ''} aria-pressed={p.mode === 'cross-model'} onClick={() => saveMode(sessionId, { ...p, mode: 'cross-model' })}>两个模型 · 同一要求</button></div>
      <label className="ac-budget">每版上限 <select aria-label="每版生成上限" value={p.generationMinutes} onChange={e => saveMode(sessionId, { ...p, generationMinutes: Number(e.target.value) })}>{[...new Set([5, 15, 30, 60, 90, 120, p.generationMinutes])].sort((a, b) => a - b).map(m => <option key={m} value={m}>{m} 分钟</option>)}</select></label>
      <label className="ac-budget">示例 <select aria-label="内置示例范围" disabled={busy || !mode.loaded} value={p.exampleKind ?? 'quick'} onChange={e => saveMode(sessionId, { ...p, exampleKind: e.target.value as 'quick' | 'full' })}><option value="quick">基础 · 搜索与清空</option><option value="full">完整 · 组合筛选与手机适配</option></select></label>
      <button className="ac-btn sm" disabled={busy || !mode.loaded || setup?.capabilities?.ok === false || !clientSupport(sessionId).canExecute || (p.mode === 'cross-model' ? !validPair : !setup?.current.model)} onClick={() => { void example() }}>{busy ? '正在创建示例…' : '试跑内置示例'}</button>
    </div>
    {p.mode === 'cross-model' ? <div className="ac-models">{[0, 1].map(i => <label key={i}>{i === 0 ? '模型一' : '模型二'}<select disabled={loading || busy} value={p.models[i]?.model ? `${p.models[i]?.provider}/${p.models[i]?.model}` : ''} onChange={e => { const item = models.find(m => `${m.provider}/${m.id}` === e.target.value); const pair: [Route, Route] = [...p.models]; pair[i] = item ? { provider: item.provider, model: item.id } : {}; saveMode(sessionId, { ...p, models: pair }) }}><option value="">选择已配置的模型</option>{models.map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`} disabled={p.models[1-i]?.provider === m.provider && p.models[1-i]?.model === m.id}>{m.name} · {m.providerName}</option>)}</select></label>)}{loading ? <span className="ac-meta" role="status">正在读取模型…</span> : modelError ? <span className="ac-meta" role="alert">{modelError} <button className="ac-text-btn" onClick={() => { void loadModels() }}>重试模型列表</button></span> : models.length < 2 ? <span className="ac-meta">当前可读取的模型不足两个，可先使用同一模型的两种策略。</span> : null}</div>
      : <div className="ac-meta">当前模型：{routeText(setup?.current) || (setup ? '请先在输入框右下角选择模型' : '正在读取…')}{setup?.project?.path ? <span className="ac-settings-project" title={setup.project.path}> · 项目：{setup.project.path}</span> : ''}</div>}
    <div className="ac-settings-foot">到时验收已写的改动 · 两版分别消耗用量 · 示例也使用真实模型，生成耗时随模型与环境变化 · {mode.saving ? '正在保存设置…' : '设置已保存在此对话'}</div></>}
    {!mode.collapsed && (p.exampleKind ?? 'quick') === 'quick' && <ExampleTimingEvidence />}
    {setupError && !mode.collapsed && <div className="ac-feedback" role="alert">无法读取当前模型与项目：{setupError}<button className="ac-text-btn" onClick={() => { setSetupError(undefined); setSetupRetry(value => value + 1) }}>重新读取模型与项目</button></div>}
    {(error || mode.error) && <div className="ac-feedback" role="alert">{error ?? mode.error}<button className="ac-text-btn" onClick={() => { void loadMode(sessionId); setError(undefined) }}>重新读取设置</button></div>}
  </section>
}

/** Keep blank-session and background-tool results outside the host's folded tool turns. */
function ComposerDock({ sessionId, session }: { sessionId: string; session?: { blank?: boolean } }): React.ReactElement {
  // The host may reuse a slot component across sessions; its local state must not follow it.
  return <ComposerDockState key={sessionId} sessionId={sessionId} {...(session ? { session } : {})} />
}
function ComposerDockState({ sessionId, session }: { sessionId: string; session?: { blank?: boolean } }): React.ReactElement {
  const mode = useAbMode(sessionId)
  const capabilityError = clientSupportMessage(sessionId)
  const [latest, setLatest] = useState<Run>()
  const [collapsed, setCollapsed] = useState(false)
  const [error, setError] = useState<string>()
  const blank = session?.blank === true
  useEffect(() => {
    let active = true, request = 0, applied = 0
    const refresh = (): void => {
      if (document.visibilityState === 'hidden') return
      const version = ++request
      const latestRequest = blank && mode.runId ? call<Run>('get', { runId: mode.runId }) : call<Run | null>('latest', { sessionId })
      latestRequest.then(value => { if (active && version >= applied) { applied = version; setLatest(value ?? undefined); setError(undefined) } }, (e: Error) => { if (active && version >= applied) { applied = version; setError(e.message) } })
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [blank, sessionId, mode.runId, mode.refreshVersion])
  const resident = latest?.origin?.kind === 'tool' && latest.state !== 'abandoned' && mode.dismissedRunId !== latest.runId
  const runId = blank ? mode.runId ?? latest?.runId : resident ? latest?.runId : undefined
  useEffect(() => { setCollapsed(!blank && latest?.state === 'adopted' && latest.adoption?.state === 'adopted') }, [runId])
  return <>
    {capabilityError && <div className="ac-root"><Styles /><div className="ac-feedback ac-prerequisite" role="alert"><span>{capabilityError}</span><div className="ac-prerequisite-actions"><button className="ac-text-btn" onClick={() => { void loadMode(sessionId) }}>重新检查接口</button><button className="ac-text-btn" onClick={() => setOpen(sessionId)}>比较记录</button></div></div></div>}
    {runId && <section className="ac-root ac-conversation-run" aria-label="本对话的 A|B 结果"><Styles />
      {collapsed && <div className="ac-conversation-run-head"><b>本次比较</b><span className="ac-meta">{runId}</span><span className="ac-spacer" /><button className="ac-text-btn" onClick={() => setOpen(sessionId)}>记录与教程</button><button className="ac-text-btn" onClick={() => setCollapsed(false)}>展开结果</button></div>}
      <div className="ac-conversation-run-scroll" hidden={collapsed}><RunView key={runId} runId={runId} sessionId={sessionId} compact {...(latest?.runId === runId ? { initial: latest } : {})} onExpand={() => setOpen(sessionId, runId)} onCollapse={() => setCollapsed(true)} /></div>
    </section>}
    {error && (blank || mode.preferences.enabled || mode.refreshVersion) ? <div className="ac-root"><div className="ac-feedback" role="alert">读取比较记录失败：{error}</div></div> : null}
    <ComposerSettings sessionId={sessionId} session={session} />
  </>
}
function StarNudge(): React.ReactElement | null {
  const key = 'agent-compare.star-nudge'
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  if (hidden) return null
  const hide = (): void => { try { localStorage.setItem(key, '1') } catch { /* ignore */ } setHidden(true) }
  return (
    <span>
      觉得有用？<a className="ac-link" href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare" target="_blank" rel="noreferrer" onClick={hide}>给项目点个 Star</a>
      <button className="ac-icon-btn" style={{ width: 22, height: 22, verticalAlign: 'middle' }} onClick={hide} aria-label="不再显示"><IconClose /></button>
    </span>
  )
}
type Act = (method: string, extra?: Record<string, unknown>) => void
function ActionBar({ run, busy, pending, act, onDone, onContinue }: { run: Run; busy: boolean; pending?: string | undefined; act: Act; onDone?: () => void; onContinue?: () => void }): React.ReactElement | null {
  if (run.control?.allowed === false) return <div className="ac-bar" role="status" aria-label="比较操作权限"><span className="ac-bar-text"><strong>当前仅可查看。</strong>{run.control.reason}</span></div>
  const pick = run.choice?.pick
  const picked = run.candidates.find((c) => c.label === pick)
  const retrying = run.candidates.filter(c => c.verificationHistory?.length && busyStage(c.stage))
  const total = Math.max(...(retrying.length ? retrying : run.candidates).map(elapsed))
  const ready = run.candidates.filter((c) => c.stage === 'ready').length
  switch (run.state) {
    case 'running':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{retrying.length ? `正在重新验收 ${retrying.map(c => c.label).join('、')} · 本次已用 ` : '两个候选并行进行中 · 已用 '}<strong>{fmt(total)}</strong>{ready ? ` · ${ready} 个已可体验` : ''}</span>
          <button className="ac-btn danger" disabled={busy} onClick={() => act('cancel')}>{retrying.length ? '停止验收' : '全部停止'}</button>
        </div>
      )
    case 'judging':
      if (ready === 0) {
        const salvageable = run.candidates.some((c) => c.salvageable || c.canRetryVerification)
        return (
          <div className="ac-bar">
            <span className="ac-bar-text"><strong>两边都没有可体验的结果。</strong>{salvageable ? '改动仍保留。可以在卡片里查看原因并验收，或结束这次比较。' : '可以结束这次比较，调整描述或时间上限后再来。'}</span>
            <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>两版都不采用并揭晓</button>
          </div>
        )
      }
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{ready === 2 ? <><strong>两边都试一下</strong>，选出你更愿意采用的那一版；选完立即揭晓</> : <><strong>仅 {run.candidates.find(c => c.stage === 'ready')?.label} 已可体验。</strong>先操作这一版，再决定是否选择；选完立即揭晓。</>}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>都不满意</button>
          {run.candidates.filter((c) => c.stage === 'ready').map((c) => <button key={c.label} className="ac-btn primary" disabled={busy} onClick={() => act('choose', { pick: c.label })}>选 {c.label}</button>)}
        </div>
      )
    case 'revealed': {
      const eligible = picked?.verdict?.eligible === true
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{pick === 'none' || picked === undefined ? '这次两版都没选。可以换个描述再来一次。' : eligible ? '先核对目标与改动，必要时在副本中预演；确认后才写入。' : '这一版没有通过共同验收，不能写入工作区，可以另存为分支查看。'}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('reviewCopyCleanup')}>整理工作副本</button>
          {picked !== undefined && <button className="ac-btn" disabled={busy} onClick={() => act('adopt', { mode: 'branch' })} title="只新建分支（含一个提交），不切换、不改当前文件">另存为分支</button>}
          {picked !== undefined && eligible && <button className="ac-btn primary" disabled={busy} onClick={() => act('reviewAdoption')}>审查并采用 {pick}</button>}
        </div>
      )
    }
    case 'adopting':
      return (
        <div className="ac-bar"><span className="ac-bar-text"><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{run.adoption?.state === 'reverting' ? '正在恢复文件并核对，原始内容继续保留…' : run.adoption?.state === 'writing' ? '正在保留原始内容、写入并核对…' : '正在你当前项目的副本里预演并验收…'}</span></div>
      )
    case 'recovery':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.adoption?.transferDirection === 'undo' ? '上次恢复操作没有完整结束。可以回退到该操作开始前，或保留现在的文件。' : '采用没有完整结束。可以恢复保留的原始内容，或保留现在的文件。'}遇到新编辑会停下并保留双方内容。</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('recover', { action: 'keep' })}>保留当前文件</button>
          <button className="ac-btn primary" disabled={busy} onClick={() => act('recover', { action: 'restore' })}>{run.adoption?.transferDirection === 'undo' ? '回退未完成操作' : '恢复到采用前'}</button>
        </div>
      )
    case 'adopted':
      return (
        <div className="ac-bar" {...(busy && pending ? { role: 'status', 'aria-label': '采用操作状态' } : {})}>
          <span className="ac-bar-text">{busy && pending ? <><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{pending === 'adopt' ? '改动已写入，正在整理记录、预览与副本；完成后可撤销或继续。' : pending === 'revert' ? '正在撤销采用并核对项目，请稍候…' : '正在处理这次比较，请稍候…'}</> : <>采用记录已保存。<span className="ac-project-path">目标：{run.baseline.repoRoot ?? '本次比较的仓库'}</span> <StarNudge /></>}</span>
          {run.adoption?.mode === 'worktree' && <button className="ac-btn" disabled={busy} onClick={() => act('revert')}>撤销采用</button>}
          {onContinue && <button className="ac-btn primary" disabled={busy} onClick={onContinue} title="退出比较模式，在原输入框中继续。比较记录仍然保留。">继续主对话</button>}
          {onDone && <button className="ac-btn" disabled={busy} onClick={onDone}>完成</button>}
        </div>
      )
    default:
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.state === 'interrupted' ? '这次比较在宿主停止时中断，可验收副本里已经写出的改动。' : '这次比较已结束。'}</span>
          {run.state === 'interrupted' && <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>不采用本次结果，查看保留内容</button>}
        </div>
      )
  }
}
function copySize(bytes: number): string { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function CopySpace({ run, sessionId, blocked, publish, requestKey = 0, onReleaseBusy }: { run: Run; sessionId?: string; blocked: boolean; publish(next: Run): void; requestKey?: number; onReleaseBusy(value: boolean): void }): React.ReactElement {
  const [plan, setPlan] = useState<CopyPlan>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<'read' | 'release'>()
  const [otherConfirmed, setOtherConfirmed] = useState(false)
  const request = useRef(0)
  const abort = useRef<AbortController | undefined>(undefined)
  useEffect(() => { setPlan(undefined); setError(undefined); setBusy(undefined); setOtherConfirmed(false); request.current++; return () => { request.current++; abort.current?.abort() } }, [run.runId])
  const inspect = async (): Promise<void> => {
    const id = ++request.current, controller = new AbortController()
    abort.current?.abort(); abort.current = controller
    setBusy('read'); setError(undefined); setPlan(undefined); setOtherConfirmed(false)
    try { const value = await call<CopyPlan>('copyCleanupPlan', { runId: run.runId, sessionId }, controller.signal); if (id === request.current) setPlan(value) }
    catch (err) { if (!controller.signal.aborted && id === request.current) setError((err as Error).message) }
    finally { if (id === request.current) setBusy(undefined) }
  }
  useEffect(() => { if (requestKey > 0) void inspect() }, [requestKey])
  const release = async (): Promise<void> => {
    if (!plan?.allowed || (plan.otherSession && !otherConfirmed) || busy || blocked) return
    const id = ++request.current
    setBusy('release'); onReleaseBusy(true); setError(undefined)
    try { const value = await call<Run>('releaseCopies', { runId: run.runId, sessionId, token: plan.token, confirmOtherSession: otherConfirmed }); if (id === request.current) { publish(value); setPlan(undefined) } }
    catch (err) { if (id === request.current) { setError((err as Error).message); setPlan(undefined) } }
    finally { if (id === request.current) { setBusy(undefined); onReleaseBusy(false) } }
  }
  const stale = !!plan && run.rev !== undefined && plan.rev !== run.rev
  return <section className="ac-copy-space" aria-label="副本空间">
    <div className="ac-row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}><div><b>副本空间</b><div className="ac-note">{run.copiesReleasedAt ? '副本已释放；运行记录、源码补丁、截图与撤销原件继续保留。' : '查看空间与清单后再决定是否释放；没有自动过期删除。'}</div></div><button className="ac-btn" disabled={blocked || !!busy || !sessionId} onClick={() => { void inspect() }}>{busy === 'read' ? '正在核对空间…' : '查看副本空间'}</button></div>
    {error && <p className="ac-feedback" role="alert">{error}</p>}
    {plan && <div className="ac-copy-plan">
      <p><strong>本次清单：{copySize(plan.bytes)}</strong>（文件逻辑大小；不跟随链接，硬链接的实际释放量可能更少）</p>
      <p>确认后停止清单内的预览，删除对应副本及依赖。运行记录、封存源码与 Git 引用、截图、示例原仓库、候选会话及撤销原件保留；不修改当前项目。释放后不能重开这些副本的预览，仍可查看截图、审查采用或撤销已有采用。</p>
      {plan.retained && <details><summary>单独保留的资源</summary><p>记录了 {plan.retained.sealedPatches} 份封存补丁、{plan.retained.childSessions} 个候选会话，以及 {plan.retained.gitRefs === undefined ? '数量暂不可确认的' : plan.retained.gitRefs + ' 个'} Git 引用。会话、原仓库和采用恢复目录均不在删除清单中；占用空间不计入上面的可释放量。</p><code>{plan.retained.sourceRepository}</code></details>}
      {plan.resources.length > 0 && <ul>{plan.resources.map(resource => <li key={resource.label}><b>副本 {resource.label} · {copySize(resource.bytes)}</b> · {resource.files} 个文件{resource.links ? ` · ${resource.links} 个链接未跟随` : ''}{resource.stopsPreview ? ' · 将停止预览' : ''}<details><summary>目录位置</summary><code>{resource.path}</code></details>{resource.reason && <p>{resource.reason}</p>}</li>)}</ul>}
      {plan.reasons.map(reason => <p className="ac-feedback" key={reason}>{reason}</p>)}
      {stale && <p className="ac-feedback" role="alert">比较已变化，请重新查看清单后再确认。</p>}
      {plan.otherSession && <label className="ac-row"><input type="checkbox" checked={otherConfirmed} onChange={event => setOtherConfirmed(event.target.checked)} />这是其他对话的比较，确认释放该比较的副本。</label>}
      <div className="ac-row"><button className="ac-btn" disabled={!!busy} onClick={() => setPlan(undefined)}>保留副本</button><button className="ac-btn primary" disabled={blocked || !!busy || !plan.allowed || stale || (!!plan.otherSession && !otherConfirmed)} onClick={() => { void release() }}>{busy === 'release' ? '正在停止预览并释放…' : `确认释放 ${copySize(plan.bytes)} 副本`}</button></div>
    </div>}
  </section>
}
function Banners({ run }: { run: Run }): React.ReactElement {
  const pick = run.choice?.pick
  const fav = run.checksFavoured
  const revealed = REVEALED.has(run.state) || run.choice !== undefined
  const pickedTitle = run.candidates.find((c) => c.label === pick)?.strategy?.title
  const a = run.adoption
  const bad = a && ['blocked', 'rolled-back', 'needs-recovery'].includes(a.state)
  const comparison = revealed && pick !== undefined ? <>
    <div>{run.mode === 'same-model' ? '同一模型、两种策略。' : '两个模型、同一要求。'}
      你选了 <strong>{pick === 'none' ? '都不满意' : `${pick}${pickedTitle ? `（${pickedTitle}）` : ''}`}</strong>；程序验收倾向 <strong>{fav === 'tie' ? '持平' : fav === 'none' || fav === undefined ? '无' : fav}</strong>
      {pick !== 'none' && fav !== undefined && fav !== 'tie' && fav !== 'none' && fav !== pick ? '。你的选择和验收结论不同。' : '。'}</div>
    <div className="disclaimer">单次任务的结果不代表模型或策略的整体优劣。</div>
  </> : null
  return (
    <>
      {run.outsideChanges && run.outsideChanges.length > 0 && (
        <div className="ac-banner warn" role="alert">
          <div><strong>生成期间，你的项目里这些文件和开始时不一样了</strong>：<code>{run.outsideChanges.slice(0, 8).join('、')}{run.outsideChanges.length > 8 ? ` 等 ${run.outsideChanges.length} 个` : ''}</code></div>
          <div className="disclaimer">这些变化的来源尚未核实。采用前会检查是否与候选改动重叠；请先查看这些文件。</div>
        </div>
      )}
      {comparison && (run.state === 'adopted' ? <details className="ac-banner"><summary>已选 {pick} · 查看比较与选择记录</summary>{comparison}</details> : <div className="ac-banner">{comparison}</div>)}
      {a && (
        <div className={`ac-banner${bad ? ' err' : a.state === 'needs-attention' ? ' warn' : ''}`}>
          <div>
            <span className={`ac-pill ${a.state === 'adopted' ? 'ok' : bad ? 'err' : a.state === 'needs-attention' ? 'warn' : ''}`}>
              {{ rehearsing: '预演中', blocked: '未写入', writing: '写入中', reverting: '恢复中', adopted: a.mode === 'branch' ? '已建分支' : '已采用', 'needs-attention': '已采用 · 请查看', 'rolled-back': '已恢复', 'needs-recovery': '需要处理', reverted: '已撤销' }[a.state] ?? a.state}
            </span>{' '}
            <span style={{ color: 'var(--ac-fg2)' }}>{a.message}</span>
          </div>
          {a.rehearsalChecks && <Checks checks={a.rehearsalChecks} />}
          {a.attention && a.attention.length > 0 && <code>{a.attention.slice(0, 12).join('、')}</code>}
          {(a.retainedDirectory || a.retainedDirectories?.length) ? <details><summary>查看保留内容的位置</summary><p>原始文件与交接记录保存在下面的目录中，不随预览清理。发生冲突时，请先核对当前文件和保留内容，再决定如何合并。</p>{[a.retainedDirectory, ...a.retainedDirectories ?? []].filter(Boolean).map(directory => <div className="ac-project-path" key={directory}><code>{directory}</code></div>)}</details> : null}
        </div>
      )}
    </>
  )
}
/**
 * One comparison, live: candidate cards, banners and the action bar. Used
 * both inside the conversation (compact) and in the large window.
 */
function RunView({ runId, sessionId, initial, compact, onDone, onExpand, onCollapse }: { runId: string; sessionId?: string; initial?: Run; compact?: boolean; onDone?: () => void; onExpand?: () => void; onCollapse?: () => void }): React.ReactElement {
  const [run, setRun] = useState<Run | undefined>(initial)
  const [err, setErr] = useState<string>()
  const [readErr, setReadErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<string>()
  const [copyBusy, setCopyBusy] = useState(false)
  const [copyRequest, setCopyRequest] = useState<{ runId: string; id: number }>()
  const activeId = useRef(runId)
  activeId.current = runId
  const mounted = useRef(true)
  const reads = useRef<{ version: number; pending: boolean; controller?: AbortController }>({ version: 0, pending: false })
  const action = useRef({ version: 0, pending: false })
  const [device, setDevice] = useState<PreviewDevice>('adaptive')
  const [layout, setLayout] = useState<'side' | 'A' | 'B'>('side')
  const [preflight, setPreflight] = useState<{ ok: boolean; reasons: string[]; overlapping?: string[]; rehearsal?: boolean; protectedWorktreeApply?: boolean }>()
  const publish = useCallback((next: Run, expectedId: string): void => {
    if (!mounted.current || activeId.current !== expectedId || next.runId !== expectedId) return
    setRun(previous => previous?.runId === next.runId && typeof previous.rev === 'number' && typeof next.rev === 'number'
      && Number.isSafeInteger(previous.rev) && Number.isSafeInteger(next.rev) && previous.rev > next.rev ? previous : next)
  }, [])
  const refresh = useCallback(async (force = false) => {
    // Polls share an outstanding read; an explicit action refresh supersedes that read.
    if (!force && reads.current.pending && !reads.current.controller?.signal.aborted) return
    const version = ++reads.current.version, controller = new AbortController()
    reads.current.controller?.abort()
    reads.current.controller = controller
    reads.current.pending = true
    const current = (): boolean => mounted.current && activeId.current === runId && version === reads.current.version && !controller.signal.aborted
    try {
      const next = await call<Run>('get', { runId }, controller.signal)
      if (!current()) return
      if (!next || next.runId !== runId) throw new Error('收到的记录与当前比较不一致，请刷新后重试')
      publish(next, runId); setReadErr(undefined)
    } catch (error) { if (current()) setReadErr((error as Error).message) }
    finally { if (version === reads.current.version) reads.current.pending = false }
  }, [runId, publish])
  useEffect(() => {
    mounted.current = true
    action.current.version++; action.current.pending = false
    setBusy(false); setCopyBusy(false); setCopyRequest(undefined); setPending(undefined); setErr(undefined); setReadErr(undefined); setPreflight(undefined)
    setRun(previous => previous?.runId === runId ? previous : initial?.runId === runId ? initial : undefined)
    void refresh(true)
    return () => { mounted.current = false; reads.current.version++; reads.current.controller?.abort(); action.current.version++ }
    // Seed a selected record once per identity; subsequent reads are authoritative.
  }, [runId, refresh])
  const live = run !== undefined && (busy || run.control?.retryable === true || LIVE_POLL.has(run.state) || run.candidates.some((c) => busyStage(c.stage)))
  useEffect(() => {
    // Live runs refresh quickly; settled ones slowly, so a card in the chat follows actions taken elsewhere.
    const t = setInterval(() => { void refresh() }, live ? 1500 : 6000)
    return () => clearInterval(t)
  }, [live, refresh])
  useTick(run?.state === 'running')
  const act: Act = (method, extra = {}) => {
    if (!run || run.runId !== runId || action.current.pending || copyBusy) return
    if (run?.control?.allowed === false) { setErr(run.control.reason ?? '当前仅可查看这次比较'); return }
    if (method === 'cleanup' || method === 'reviewCopyCleanup') {
      if (!REVEALED.has(run.state) && run.choice === undefined) { setErr('请先结束选择，再查看副本清单；尚未删除任何内容。'); return }
      setCopyRequest(previous => ({ runId, id: (previous?.id ?? 0) + 1 }))
      return
    }
    const version = ++action.current.version, targetId = runId
    action.current.pending = true
    reads.current.version++; reads.current.controller?.abort()
    const current = (): boolean => mounted.current && activeId.current === targetId && action.current.version === version
    const failed = (error: Error): void => { if (current()) setErr(error.message) }
    const finished = (): void => { if (current()) { action.current.pending = false; setBusy(false); setPending(undefined); void refresh(true) } }
    setBusy(true)
    setPending(method)
    setErr(undefined)
    if (method === 'reviewAdoption') {
      call<NonNullable<typeof preflight>>('preflight', { runId }).then(value => { if (current()) setPreflight(value.protectedWorktreeApply === true ? value : { ...value, ok: false, reasons: ['插件服务尚未启用文件交接保护。请重启 DSH 后重新审查；也可以先另存为分支。'] }) }, failed).finally(finished)
      return
    }
    setPreflight(undefined)
    call<Run | null>(method, { runId, ...extra })
      .then((r) => { if (current() && r && typeof r === 'object' && 'runId' in r) publish(r, targetId) }, failed)
      .finally(finished)
  }
  if (run === undefined || run.runId !== runId) return <div className={compact ? 'ac-inline-note' : 'ac-empty'}>{err ?? readErr ?? '正在读取这次比较…'}</div>
  const blocked = busy || copyBusy || run.control?.allowed === false
  const revealed = REVEALED.has(run.state) || run.choice !== undefined
  const continueConversation = sessionId ? (): void => {
    if (!leaveMode(sessionId)) { setErr('消息正在提交，请等它结束后继续对话。'); return }
    const mode = modeFor(sessionId)
    mode.dismissedRunId = runId
    saveMode(sessionId, { ...mode.preferences, enabled: false })
    returnToComposer(sessionId)
  } : undefined
  const previewHosts = run.candidates.filter(c => c.previewUrl).map(c => { try { return new URL(c.previewUrl!).hostname } catch { return '' } })
  const independentHosts = previewHosts.length > 0 && previewHosts.every(host => /^ac-[0-9a-f]{32}\.localhost$/.test(host)) && new Set(previewHosts).size === previewHosts.length
  const body = (
    <>
      {(err || readErr) && <div className="ac-error" role="alert" style={{ marginTop: 12 }}>{err ?? readErr}</div>}
      <div className="ac-action-dock"><ActionBar run={run} busy={busy || copyBusy} pending={pending} act={act} {...(onDone ? { onDone } : {})} {...(continueConversation ? { onContinue: continueConversation } : {})} /></div>
      {!!run.leftovers?.length && <section className="ac-banner warn" role="status" aria-label="资源清理状态"><div><b>{run.state === 'adopted' ? '采用已完成，仍有资源等待清理' : '仍有资源等待清理'}</b><p>可以重试清理。清理只处理本次比较拥有的资源。</p><ul>{run.leftovers.map((detail, index) => <li key={index}>{detail}</li>)}</ul><button className="ac-btn" disabled={blocked} onClick={() => act('cleanup')}>重试清理</button></div></section>}
      {preflight && <section className="ac-review" aria-label="采用前审查" role="region"><div><b>{preflight.ok ? '目标核验通过，请确认采用' : '当前无法采用'}</b><p className="ac-project-path">目标：{run.baseline.repoRoot ?? '本次比较的项目'}</p><p>{preflight.ok ? preflight.rehearsal ? '项目有新改动，将先合并到临时副本中重新验收。' : '将写入选中版本；不自动提交，保留暂存状态。' : preflight.reasons.join('；')}</p>{preflight.ok && <p>先保留原始文件，再交接候选。交接时出现新编辑会停止并保留双方内容；请等操作完成后再继续编辑涉及的文件。</p>}{preflight.overlapping?.length ? <code>{preflight.overlapping.join('、')}</code> : null}</div><div className="ac-row"><button className="ac-btn" onClick={() => setPreflight(undefined)}>返回审查</button><button className="ac-btn primary" disabled={blocked || !preflight.ok} onClick={() => act('adopt', { mode: 'worktree' })}>确认采用 {run.choice?.pick}</button></div></section>}
      <Banners run={run} />
      {revealed && <CopySpace key={runId} run={run} sessionId={sessionId} blocked={busy || run.control?.allowed === false} requestKey={copyRequest?.runId === runId ? copyRequest.id : 0} publish={next => publish(next, runId)} onReleaseBusy={value => { if (activeId.current === runId) setCopyBusy(value) }} />}
      <div className="ac-compare-tools"><div className="ac-seg" aria-label="比较布局">{(['side', 'A', 'B'] as const).map((v) => <button key={v} className={layout === v ? 'on' : ''} aria-pressed={layout === v} onClick={() => setLayout(v)}>{{ side: '并排比较', A: '专注 A', B: '专注 B' }[v]}</button>)}</div><div className="ac-seg" aria-label="预览尺寸"><button className={device === 'adaptive' ? 'on' : ''} aria-pressed={device === 'adaptive'} onClick={() => setDevice('adaptive')}>适应窗口</button><button className={device === 'desktop' ? 'on' : ''} aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}>桌面 1280</button><button className={device === 'phone' ? 'on' : ''} aria-pressed={device === 'phone'} onClick={() => setDevice('phone')}>手机 390</button></div><span className="ac-meta">{device === 'adaptive' ? '直接在对话中操作真实页面' : '相同视口 · 按可用宽度缩放'}</span></div>
      {previewHosts.length > 0 && <details className="ac-preview-limits"><summary>预览环境与限制</summary><p>{independentHosts ? '候选使用独立本地地址，避免同名 Cookie 相互影响。' : '这条旧记录的预览没有独立本地域名，两个端口的 Cookie 可能相互影响；建议使用当前版本重新开始比较。'}嵌入页面仍受浏览器的 Cookie 与存储策略限制；登录、外部后端和共享数据库暂不在支持范围内。重新启动预览会更换浏览器地址，页面内临时数据不保留；比较记录和验收截图仍保留。外部标签页可能使用不同的存储上下文。</p></details>}
      <div className={`ac-grid${layout !== 'side' ? ' focus' : ''}`}>
        {run.candidates.map((c) => <CandidateCard key={c.label} run={run} c={c} revealed={revealed} picked={revealed && run.choice?.pick === c.label} busy={blocked} act={act} device={device} compact={compact === true} hidden={layout !== 'side' && layout !== c.label} />)}
      </div>
    </>
  )
  if (!compact) return body
  return (
    <div className="ac-root ac-inline" aria-label={`A|B 比较 ${run.runId}`}>
      <Styles />
      <div className="ac-inline-head">
        <span className="ac-logo">A|B</span>
        <span className="ac-task" title={run.task}>{run.task}</span>
        <span className={`ac-pill ${run.state === 'adopted' ? 'ok' : ACTIVE.has(run.state) ? 'brand' : ''}`}>{STATE_TEXT[run.state] ?? run.state}</span>
        {onExpand && <button className="ac-btn sm" onClick={onExpand}>大窗口查看</button>}
        {onCollapse && <button className="ac-text-btn" onClick={onCollapse}>收起结果</button>}
      </div>
      {body}
    </div>
  )
}
const runIdIn = (text: string | undefined): string | undefined => /运行 ([0-9a-f]{8})/.exec(text ?? '')?.[1] ?? /"runId"\s*:\s*"([0-9a-f]{8})"/.exec(text ?? '')?.[1]
/** The `/ab` command row in the conversation: the comparison it started, live. */
function CommandView({ node, sessionId }: { node: { name?: string; args?: string | null; outcome: { kind: string; text?: string } | null }; sessionId?: string }): React.ReactElement {
  const runId = runIdIn(node.outcome?.text)
  let task = node.args?.trim() ?? ''
  if (task.startsWith('@ui ')) { try { task = (JSON.parse(task.slice(4)) as { task?: string }).task ?? '示例任务' } catch { task = '' } }
  if (node.outcome === null) return <div className="ac-root ac-inline"><Styles /><div className="ac-inline-note"><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />正在准备 A|B 比较：{task.slice(0, 400)}</div></div>
  if (node.outcome.kind !== 'success' || runId === undefined) {
    return <div className="ac-root ac-inline"><Styles /><div className="ac-fail" style={{ height: 'auto' }}><b>A|B 比较没有开始</b>{node.outcome.text ?? ''}</div></div>
  }
  return <RunView runId={runId} compact {...(sessionId ? { sessionId, onExpand: () => setOpen(sessionId, runId) } : {})} />
}
/** The model's `agent_compare_start` tool call in the conversation: the same live card. */
function ToolView(props: { sessionId?: string; callId?: string; phase?: string; block?: unknown }): React.ReactElement {
  const fromResult = runIdFromToolResult(props.block, props.phase)
  const key = JSON.stringify([props.sessionId, props.callId])
  const [binding, setBinding] = useState<{ key: string; runId: string }>()
  useEffect(() => {
    if (fromResult !== undefined || !props.sessionId || !props.callId || props.phase === 'result') return
    let active = true
    const refresh = (): void => {
      if (document.visibilityState === 'hidden') return
      call<ListResult>('list', { sessionId: props.sessionId }).then(list => {
        const run = list.runs.find(record => record.origin?.kind === 'tool' && record.origin.id === props.callId)
        if (active && run) setBinding({ key, runId: run.runId })
      }, () => {})
    }
    refresh()
    const timer = setInterval(refresh, 5000)
    return () => { active = false; clearInterval(timer) }
  }, [fromResult, props.sessionId, props.callId, props.phase, key])
  const found = fromResult ?? (binding?.key === key ? binding.runId : undefined)
  useEffect(() => {
    if (!found || !props.sessionId) return
    const mode = modeFor(props.sessionId)
    mode.refreshVersion = (mode.refreshVersion ?? 0) + 1
    publishMode(mode)
  }, [found, props.sessionId])
  if (found === undefined) return <div className="ac-root ac-inline"><Styles /><div className="ac-inline-note">{props.phase === 'result' ? 'A|B 比较未取得运行编号，请查看此工具的返回结果。' : <><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />正在准备 A|B 比较…</>}</div></div>
  const sid = props.sessionId
  if (!sid) return <RunView key={found} runId={found} compact />
  return <div className="ac-root ac-inline ac-tool-summary" aria-label={`A|B 工具记录 ${found}`}><Styles /><div className="ac-inline-note">本次比较 · {found}。进度、预览和采用记录持续保留。<button className="ac-text-btn" onClick={() => setOpen(sid, found)}>查看本次比较</button></div></div>
}
/** The composer owns comparison mode; history never replaces its entry point. */
function AbModeButton({ sessionId }: { sessionId: string }): React.ReactElement {
  const mode = useAbMode(sessionId)
  const state = inputSnapshot(sessionId)
  const enabled = mode.preferences.enabled || state?.claim?.name === 'ab'
  const capabilityError = clientSupportMessage(sessionId)
  const toggle = (): void => {
    if (!mode.loaded) { void loadMode(sessionId); return }
    const applied = enabled ? leaveMode(sessionId) : enterMode(sessionId)
    if (!applied) { mode.error = clientSupportMessage(sessionId) ?? '输入框正在提交或已有其他命令模式，请等它结束后再切换。'; publishMode(mode); return }
    mode.collapsed = false
    saveMode(sessionId, { ...mode.preferences, enabled: !enabled }); inputShell(sessionId)?.focus?.()
  }
  return <><Styles /><button className={`ac-mode-btn${enabled ? ' on' : ''}`} onClick={toggle} disabled={mode.loading || !!capabilityError} aria-pressed={enabled} title={capabilityError ?? (enabled ? 'A|B 对比模式已开启，点此退出' : '开启 A|B 对比模式，在主对话里运行两版')} aria-label="A|B 对比模式">A|B</button></>
}
function History({ data, open, busy, failed, scope, query, onScope, onSearch, onPage, onlyUnavailable, problemSupported, onUnavailable }: {
  data?: ListResult; open: (r: Run) => void; busy: boolean; failed?: string
  scope: 'all' | 'session'; query: string; onScope: (scope: 'all' | 'session') => void; onSearch: (query: string) => void; onPage: (offset: number) => void
  onlyUnavailable: boolean; problemSupported: boolean; onUnavailable: (only: boolean) => void
}): React.ReactElement {
  const [draft, setDraft] = useState(query)
  const region = useRef<HTMLElement | null>(null)
  useEffect(() => setDraft(query), [query])
  const meta = data?.history, outdated = data !== undefined && meta?.version !== 1
  const rows = [...(data?.runs ?? []), ...(data?.legacy ?? [])].sort((a, b) => b.createdAt - a.createdAt || (a.runId === b.runId ? 0 : a.runId < b.runId ? 1 : -1))
  return (
    <section ref={region} className="ac-history" aria-label="比较记录列表" aria-busy={busy} tabIndex={-1}>
      <div className="ac-history-controls">
        <label>记录范围<select aria-label="记录范围" value={scope} disabled={outdated} onChange={event => onScope(event.target.value as 'all' | 'session')}><option value="all">全部对话</option><option value="session">当前对话</option></select></label>
        <form className="ac-history-search" role="search" onSubmit={event => { event.preventDefault(); onSearch(draft) }}>
          <label>查找记录<input type="search" aria-label="搜索比较记录" placeholder="需求、项目或运行编号" maxLength={200} value={draft} disabled={outdated} onChange={event => setDraft(event.target.value)} /></label>
          <button className="ac-btn" type="submit" disabled={outdated}>搜索</button>
          {(query || draft) && <button className="ac-text-btn" type="button" disabled={outdated} onClick={() => { setDraft(''); onSearch('') }}>清空搜索</button>}
        </form>
      </div>
      {problemSupported && <label className="ac-history-issue-filter"><input type="checkbox" checked={onlyUnavailable} onChange={event => onUnavailable(event.target.checked)} />只看需处理</label>}
      <div className="ac-history-status" role="status">{busy ? <><span className="ac-spin" />正在读取记录…</> : failed ? '记录读取失败，原始文件仍保留。' : meta ? `${scope === 'all' ? '全部对话' : '当前对话'} · ${meta.total} 条${meta.query ? ` · 搜索“${meta.query}”` : ''}` : '已读取当前服务端提供的记录'}</div>
      {outdated && <div className="ac-feedback" role="alert">服务端尚未更新。请重启 DSH 后使用全部对话、搜索与翻页；以下仍是旧服务端返回的记录。</div>}
      {!!meta?.unavailable && <div className="ac-feedback" role="alert">有 {meta.unavailable} 条记录无法安全载入。这些记录保持只读，原始文件已保留；可勾选“只看需处理”查看原因。</div>}
      {!busy && !failed && rows.length === 0 && <div className="ac-empty">{query ? '没有匹配的记录。换个关键词，或清空搜索查看已有比较。' : onlyUnavailable ? '没有需处理的记录。取消筛选可以查看其它比较。' : scope === 'session' ? '当前对话还没有比较。切换到“全部对话”可以查看以前的结果。' : '还没有比较记录。点输入框左下角的 A|B，在主对话里开始第一次真实比较。'}</div>}
      {rows.map(r => 'legacy' in r ? (
        <div key={r.runId} className={`ac-hrow legacy${r.unavailable ? ' ac-hrow-unavailable' : ''}`} title={r.unavailable ? '无法安全载入，原始记录保留' : '旧版本记录只读，原始文件保留'}>
          <span className="ac-pill">{r.unavailable ? '需处理' : '旧版'}</span>
          <span className="ac-hrow-copy"><span className="t">{r.task}</span><span className="ac-meta">{r.runId} · 只读</span>{r.reason && <span className="ac-history-problem">{r.reason}</span>}</span>
          <span className="ac-meta">{r.createdAt > 0 ? when(r.createdAt) : '时间未知'}</span>
        </div>
      ) : (
        <button key={r.runId} className="ac-hrow" onClick={() => open(r)}>
          <span className={`ac-pill ${r.state === 'adopted' ? 'ok' : ACTIVE.has(r.state) ? 'brand' : ''}`}>{STATE_TEXT[r.state] ?? r.state}</span>
          <span className="ac-hrow-copy"><span className="t" title={r.task}>{r.task}</span><span className="ac-meta" title={r.baseline.repoRoot}>{r.baseline.repoRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? '项目未知'} · {r.runId}</span></span>
          <span className="ac-meta">{r.choice?.pick && r.choice.pick !== 'none' ? `选了 ${r.choice.pick} · ` : ''}{when(r.createdAt)}</span>
        </button>
      ))}
      {meta && meta.total > 0 && <nav className="ac-history-pages" aria-label="记录翻页"><span>{meta.offset + 1}–{Math.min(meta.offset + meta.limit, meta.total)} / {meta.total} 条</span><div className="ac-row"><button className="ac-btn" disabled={busy || meta.offset === 0} onClick={() => { region.current?.focus(); region.current?.scrollIntoView({ block: 'start' }); onPage(Math.max(0, meta.offset - meta.limit)) }}>上一页</button><button className="ac-btn" disabled={busy || !meta.hasNext} onClick={() => { region.current?.focus(); region.current?.scrollIntoView({ block: 'start' }); onPage(meta.offset + meta.limit) }}>下一页</button></div></nav>}
    </section>
  )
}
function Guide({ sessionId }: { sessionId: string }): React.ReactElement {
  const mode = useAbMode(sessionId)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const example = async (): Promise<void> => {
    setBusy(true); setError(undefined)
    try { const result = await executeComparison(sessionId, '', true); if (result.kind === 'success') setOpen(undefined); else setError(result.text ?? '示例未能开始') }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="ac-guide">
    <div><span className="ac-eyebrow">从比较到交付</span><h2 className="ac-h1">体验真实结果，做出开发决策。</h2><p className="ac-lead">适合存在多种可行方案的界面、布局与交互任务。已有明确答案的小修复通常用一个 Agent 更直接。</p></div>
    <ol className="ac-guide-steps">
      <li><b>在主对话里开启 A|B</b><p>点输入框左下角的 A|B，上方即出现设置条。直接选择比较方式、模型和每版时长；在原输入框里写需求并发送，不用填写参数。</p></li>
      <li><b>体验两版</b><p>独立生成后运行安装、检查与构建。桌面和手机预览使用统一尺寸，可以并排观察或专注体验其中一版。</p></li>
      <li><b>选择并审查</b><p>选择后揭晓模型和策略。查看代码改动、程序检查与未验证的部分；一次偏好选择不代表模型的整体排名。</p></li>
      <li><b>采用结果</b><p>采用前检查目标是否变化；必要时在临时副本中预演。工作区采用不自动提交；另存分支会明确创建一个提交。</p></li>
    </ol>
    <div className="ac-case"><div><b>试跑真实的示例商店</b><span>新建独立仓库，不修改当前项目。基础示例实现搜索与清空；完整示例再加入组合筛选和手机适配。使用当前模型与时长设置，两版分别消耗用量；任务、结果和选择保留在主对话。</span><label className="ac-budget">示例范围 <select aria-label="内置示例范围" disabled={busy || !mode.loaded} value={mode.preferences.exampleKind ?? 'quick'} onChange={e => saveMode(sessionId, { ...mode.preferences, exampleKind: e.target.value as 'quick' | 'full' })}><option value="quick">基础 · 搜索与清空</option><option value="full">完整 · 组合筛选与手机适配</option></select></label></div><button className="ac-btn primary" disabled={busy || !mode.loaded} onClick={() => { void example() }}>{busy ? '正在创建…' : '试跑内置示例'}</button></div>
    {error && <div className="ac-feedback" role="alert">{error}</div>}
    {(mode.preferences.exampleKind ?? 'quick') === 'quick' && <ExampleTimingEvidence />}
    <button className="ac-btn" onClick={() => { mode.collapsed = false; if (enterMode(sessionId)) saveMode(sessionId, { ...modeFor(sessionId).preferences, enabled: true }); returnToComposer(sessionId) }}>回到输入框，开启 A|B</button><div className="ac-note">支持范围：仓库根目录中的本地 Vite 前端。页面检查通过只代表配置的步骤通过，仍需实际体验需求和边界情况。</div>
  </div>
}
/** History, guidance, and expanded inspection share the same persisted records. */
function Sheet({ sessionId, runId, tab }: { sessionId: string; runId?: string; tab?: Tab }): React.ReactElement {
  const [view, setView] = useState<Tab>(runId ? 'history' : tab ?? 'history')
  const [selected, setSelected] = useState<string | undefined>(runId)
  const [list, setList] = useState<ListResult>()
  const [err, setErr] = useState<string>()
  const [historyScope, setHistoryScope] = useState<'all' | 'session'>('all')
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyOffset, setHistoryOffset] = useState(0)
  const [historyBusy, setHistoryBusy] = useState(true)
  const [onlyUnavailable, setOnlyUnavailable] = useState(false)
  const [problemSupported, setProblemSupported] = useState(false)
  const historyRequest = useRef(0)
  const historyAbort = useRef<AbortController | undefined>(undefined)
  const sheet = useRef<HTMLDivElement>(null)
  const refreshList = useCallback(async (signal?: AbortSignal) => {
    const request = ++historyRequest.current
    historyAbort.current?.abort()
    const controller = new AbortController()
    historyAbort.current = controller
    const active = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    setHistoryBusy(true); setErr(undefined); setList(undefined)
    try {
      const data = await call<ListResult>('list', { sessionId, scope: historyScope, search: historyQuery, offset: historyOffset, onlyUnavailable }, active)
      if (!active.aborted && request === historyRequest.current) { setList(data); setProblemSupported(typeof data.history?.onlyUnavailable === 'boolean') }
    } catch (e) { if (!active.aborted && request === historyRequest.current) setErr((e as Error).message) }
    finally { if (!active.aborted && request === historyRequest.current) setHistoryBusy(false) }
  }, [sessionId, historyScope, historyQuery, historyOffset, onlyUnavailable])
  useEffect(() => { const controller = new AbortController(); void refreshList(controller.signal); return () => controller.abort() }, [refreshList])
  useEffect(() => () => { historyAbort.current?.abort() }, [])
  useEffect(() => { setSelected(runId); setView(runId ? 'history' : tab ?? 'history') }, [runId, tab])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = sheet.current
    if (!element) return
    const siblings: Array<{ el: HTMLElement; inert: boolean }> = []
    let node: HTMLElement = element.parentElement!
    while (node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && sibling instanceof HTMLElement) { siblings.push({ el: sibling, inert: sibling.inert }); sibling.inert = true }
      }
      node = node.parentElement
      if (node === document.body) break
    }
    element.focus()
    const focusables = (): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,iframe,[tabindex="0"]')).filter((el) => el.getClientRects().length > 0 && !el.closest('[hidden]'))
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(undefined) }
      if (e.key === 'Tab') {
        const items = focusables(), first = items[0], last = items.at(-1)
        if (!first) { e.preventDefault(); element.focus() }
        else if (e.shiftKey && (document.activeElement === first || document.activeElement === element)) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    const onFocus = (e: FocusEvent): void => { if (e.target instanceof Node && !element.contains(e.target)) element.focus() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('focusin', onFocus)
    return () => {
      document.removeEventListener('keydown', onKey); document.removeEventListener('focusin', onFocus)
      for (const item of siblings) item.el.inert = item.inert
      document.body.style.overflow = previousOverflow
      const composer = focusComposerOnClose
      focusComposerOnClose = undefined
      if (composer) inputShell(composer)?.focus?.()
      else if (previous?.isConnected) previous.focus()
      else (document.querySelector<HTMLElement>('[aria-label="打开 AgentCompare 比较记录"]') ?? document.querySelector<HTMLElement>('.ac-mode-btn:not(:disabled)'))?.focus()
    }
  }, [])
  const current = list?.runs.find((r) => r.runId === selected)
  const navigate = (next: Tab): void => { setView(next); setSelected(undefined); if (next === 'history') void refreshList() }
  return (
    <div className="ac-root">
      <Styles /><div className="ac-mask" onClick={() => setOpen(undefined)} />
      <div ref={sheet} className="ac-sheet" role="dialog" aria-modal="true" aria-label="AgentCompare" tabIndex={-1}>
        <header className="ac-head"><span className="ac-logo">A|B</span><span className="ac-title">AgentCompare</span><span className="ac-header-caption">跑过再选</span><span className="ac-spacer" />
          <nav className="ac-tabs" aria-label="比较工作区">{(['history', 'guide'] as const).map((item) => <button key={item} className={`ac-tab${view === item && !selected ? ' on' : ''}`} aria-current={view === item && !selected ? 'page' : undefined} onClick={() => navigate(item)}>{{ history: '历史记录', guide: '使用教程' }[item]}</button>)}</nav>
          <button className="ac-icon-btn" onClick={() => setOpen(undefined)} aria-label="关闭（Esc）" title="关闭（Esc）"><IconClose /></button>
        </header>
        {err && <div className="ac-error" role="alert">{err}<button className="ac-text-btn" onClick={() => { void refreshList() }}>重试</button></div>}
        <div className="ac-body">{selected ? <>
          <div className="ac-run-heading"><button className="ac-text-btn" onClick={() => navigate('history')}>← 比较记录</button><span className="ac-task" title={current?.task}>{current?.task ?? '比较结果'}</span><span className="ac-meta">{selected}</span></div>
          <RunView key={selected} runId={selected} sessionId={sessionId} {...(current ? { initial: current } : {})} onDone={() => navigate('history')} />
        </> : view === 'guide' ? <Guide sessionId={sessionId} /> : <History data={list} open={(r) => setSelected(r.runId)} busy={historyBusy} failed={err} scope={historyScope} query={historyQuery} onScope={scope => { setHistoryScope(scope); setHistoryOffset(0) }} onSearch={query => { const trimmed = query.trim(); if (trimmed === historyQuery && historyOffset === 0) void refreshList(); else { setHistoryQuery(trimmed); setHistoryOffset(0) } }} onPage={setHistoryOffset} onlyUnavailable={onlyUnavailable} problemSupported={problemSupported} onUnavailable={only => { setOnlyUnavailable(only); setHistoryOffset(0) }} />}</div>
      </div>
    </div>
  )
}
function HeaderButton({ sessionId }: { sessionId: string }): React.ReactElement {
  return (
    <div className="ac-root ac-header-tools" role="group" aria-label="AgentCompare 导航">
      <Styles />
      <button className="ac-header-btn" title="AgentCompare：比较记录" aria-label="打开 AgentCompare 比较记录" onClick={() => setOpen(sessionId)}>比较记录</button>
      <button className="ac-header-btn" title="AgentCompare：使用教程" aria-label="打开 AgentCompare 使用教程" onClick={() => setOpen(sessionId, undefined, 'guide')}>使用教程</button>
    </div>
  )
}
/** The host does not mount header utilities while its blank-session Hero is shown. */
function HeroHeader({ sessionId }: { sessionId: string }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [anchored, setAnchored] = useState(false)
  useEffect(() => {
    const corner = document.querySelector<HTMLElement>('[data-conversation-header-corner]')
    const element = ref.current
    if (!corner || !element) return
    setAnchored(true)
    const align = (): void => {
      const rect = corner.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      element.style.setProperty('--ac-header-top', `${Math.max(4, rect.top + (rect.height - 26) / 2)}px`)
      element.style.setProperty('--ac-header-right', `${Math.max(12, innerWidth - rect.left + 8)}px`)
    }
    align()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(align)
    observer?.observe(corner)
    const header = corner.closest('header')
    if (header) observer?.observe(header)
    window.addEventListener('resize', align)
    return () => { observer?.disconnect(); window.removeEventListener('resize', align) }
  }, [])
  return <div ref={ref} className="ac-header-tools-hero" hidden={!anchored}>{anchored && <HeaderButton sessionId={sessionId} />}</div>
}
function Overlay(): React.ReactElement | null {
  const open = useOpen()
  return open === undefined ? null : <Sheet key={open.sessionId} sessionId={open.sessionId} {...(open.runId ? { runId: open.runId } : {})} {...(open.tab ? { tab: open.tab } : {})} />
}
/**
 * DSH 0.2.1 treats any client entry that fails to activate as a fatal web
 * boot (the desktop app then disables every third-party plugin). So nothing
 * here may throw: a slot that cannot be registered only loses that surface.
 */
export function apply(ctx: ClientCtx): void {
  clientCtx = ctx as unknown as typeof clientCtx
  const disposers: Array<() => void> = []
  const safely = (label: string, fn: () => () => void): void => {
    try {
      disposers.push(fn())
    } catch (error) {
      console.warn(`[dsh-agent-compare] ${label} unavailable:`, error)
    }
  }
  const withSession = (sessionId: string): { sessionId: string } => ({ sessionId })
  safely('header button', () => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities', id: 'agent-compare', order: 30, registrant: 'dsh-agent-compare', inject: withSession,
  }, HeaderButton)))
  safely('new conversation navigation', () => ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({
    name: 'conversation.hero.options', id: 'agent-compare-navigation', order: 30, registrant: 'dsh-agent-compare', inject: withSession,
  }, HeroHeader)))
  safely('composer A|B button', () => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'agent-compare', order: 50, registrant: 'dsh-agent-compare', inject: withSession,
  }, AbModeButton)))
  safely('composer settings', () => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'agent-compare-settings', order: 10, registrant: 'dsh-agent-compare', inject: withSession,
  }, ComposerDock)))
  safely('/ab command view', () => ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview', key: 'ab', registrant: 'dsh-agent-compare', inject: withSession,
  }, CommandView)))
  safely('tool view', () => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: 'agent_compare_start', registrant: 'dsh-agent-compare', inject: withSession,
  }, ToolView)))
  safely('overlay', () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'agent-compare', order: 30, registrant: 'dsh-agent-compare', inject: () => ({}),
  }, Overlay)))
  try {
    ctx.effect?.(() => () => { for (const d of disposers.reverse()) d() })
  } catch (error) {
    console.warn('[dsh-agent-compare] cleanup hook unavailable:', error)
  }
}

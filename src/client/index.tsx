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
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CSS } from './styles.js'
import type { Route, Setup, Cand, Run, CopyPlan, ListResult, ModelItem } from './model.js'
import { PIPELINE, STAGE_TEXT, ERROR_STAGE, STATE_TEXT, ACTIVE, LIVE_POLL, REVEALED, fmt, elapsed, busyStage, routeText, when, StagePill, Track, Checks, Verdict, Activity } from './candidate-evidence.js'
import { t, currentLocale, localeSnapshot, subscribeLocale } from './i18n.js'
import { LanguageControl, Diagnostic } from './language.js'
import { runIdFromToolResult } from './tool-result.js'
import { clientCapabilities } from './capabilities.js'
import { WindowsProcessControl, WindowsProcessEvidence } from './windows-compat.js'
import { ConversationContextControl, type ContextMode } from './conversation-context.js'
import { CopyButton, ProjectNotes, ResultView } from './results.js'
import { BlindControl, MAX_VERSIONS, MIN_VERSIONS, revealedStyleName, Segmented, StyleCombos, StyleHabit, StylePicker, StyleSlots, stylesFor, VersionsControl, type StyleChoice } from './style-picker.js'
import { LABELS, MAX_PICK_NOTE, PICK_REASONS, type Label, type PickReason, type StyleStat } from './model.js'
import { attachFx, burst, LiquidMeter } from './fx.js'
export const name = 'agent-compare-client'
export const inject = ['slots', 'remote', 'remote.commands']
interface SlotsLike {
  inject(name: string, cb: () => () => void): () => void
  register(spec: Record<string, unknown>, component: React.ComponentType<any>): () => void
}
interface ClientCtx { slots: SlotsLike; effect?(fn: () => () => void): void }
async function call<T>(method: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`agent-compare/api/${method}`, document.baseURI.replace(/[?#].*$/, '').replace(/[^/]*$/, ''))
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...(signal ? { signal } : {}) })
  const env = (await res.json()) as { ok: boolean; value?: T; error?: string; code?: string }
  if (!env.ok) throw Object.assign(new Error(env.error ?? `HTTP ${res.status}`), { code: env.code })
  return env.value as T
}
// ---- tiny shared store: which session's sheet is open, optionally on one run ----
type Tab = 'history' | 'guide'
let openSession: { sessionId: string; runId?: string; tab?: Tab; trigger?: HTMLElement } | undefined
let focusComposerOnClose: string | undefined
const listeners = new Set<() => void>()
function setOpen(sessionId: string | undefined, runId?: string, tab?: Tab, trigger?: HTMLElement): void {
  openSession = sessionId === undefined ? undefined : { sessionId, ...(runId ? { runId } : {}), ...(tab ? { tab } : {}), ...(trigger ? { trigger } : {}) }
  for (const l of listeners) l()
}
function useOpen(): typeof openSession {
  return useSyncExternalStore(useCallback(listener => { listeners.add(listener); return () => { listeners.delete(listener) } }, []), () => openSession, () => undefined)
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
  return support.ok ? undefined : t("当前 DSH 输入接口不兼容：") + support.missing.join('、') + t("。请升级或回退至已验证的 DSH 版本；草稿和比较记录保留。")
}
function returnToComposer(sessionId: string): void {
  if (openSession) { focusComposerOnClose = sessionId; setOpen(undefined) }
  else inputShell(sessionId)?.focus?.()
}
interface AbPreferences { enabled: boolean; mode: 'same-model' | 'cross-model'; generationMinutes: number; models: Route[]; versions?: number; styles?: StyleChoice[]; crossStyle?: StyleChoice; blind?: boolean; exampleKind?: 'quick' | 'full'; windowsProcessCompat?: 'auto' | 'off'; contextMode?: ContextMode; contextTurns?: number }
const versionsOf = (p: AbPreferences): number => Math.min(MAX_VERSIONS, Math.max(MIN_VERSIONS, p.versions ?? MIN_VERSIONS))
/** Saved settings with a new number of versions: styles and model slots follow. */
function withVersions(p: AbPreferences, versions: number): AbPreferences {
  const models = Array.from({ length: Math.max(MIN_VERSIONS, versions, p.models.length) }, (_, i) => p.models[i] ?? {}).slice(0, MAX_VERSIONS)
  return { ...p, versions, styles: stylesFor(versions, p.styles), models }
}
/** `contextIds`: main-conversation entries ticked for the next submission; kept per conversation in memory only. */
interface AbMode { preferences: AbPreferences; version: number; loaded: boolean; loading: boolean; collapsed: boolean; saving: number; runId?: string; refreshVersion?: number; dismissedRunId?: string; autoCollapsedRunId?: string; contextIds: number[]; error?: string; pending: Promise<void>; listeners: Set<() => void> }
const modes = new Map<string, AbMode>()
const registeredShells = new WeakSet<InputShell>()
function modeFor(sessionId: string): AbMode {
  let mode = modes.get(sessionId)
  if (!mode) { mode = { preferences: { enabled: false, mode: 'same-model', generationMinutes: 30, models: [{}, {}] }, version: 0, loaded: false, loading: false, collapsed: false, saving: 0, contextIds: [], pending: Promise.resolve(), listeners: new Set() }; modes.set(sessionId, mode) }
  return mode
}
function publishMode(mode: AbMode): void { mode.version++; for (const update of mode.listeners) update() }
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
  mode.pending = mode.pending.catch(() => {}).then(async () => { await call('preferences', { sessionId, value: next }) }).catch((e: Error) => { mode.error = t("设置未保存：{0}", { 0: e.message }); throw e }).finally(() => { mode.saving--; publishMode(mode) })
  void mode.pending.catch(() => {})
}
function useAbMode(sessionId: string): AbMode {
  const mode = modeFor(sessionId)
  const subscribe = useCallback((update: () => void) => {
    mode.listeners.add(update)
    const state = inputShell(sessionId)?.state
    const unsubscribe = typeof state?.subscribe === 'function' ? state.subscribe(update) : undefined
    return () => { mode.listeners.delete(update); unsubscribe?.() }
  }, [mode, sessionId])
  const snapshot = useCallback(() => {
    const state = inputSnapshot(sessionId)
    return JSON.stringify([mode.version, state?.draftRev, state?.phase, state?.claim?.name])
  }, [mode, sessionId])
  // Separate host slots use separate React roots. Recheck after subscribing so
  // a settings read between render and subscription cannot leave one root stale.
  useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => { if (!mode.loaded && !mode.loading) void loadMode(sessionId) }, [mode, sessionId])
  return mode
}
async function executeComparison(sessionId: string, task: string, example = false): Promise<{ kind: 'success' | 'error'; text?: string }> {
  const mode = modeFor(sessionId)
  const preferences = mode.preferences
  if (!mode.loaded) return { kind: 'error', text: t("比较设置尚未读取，请稍后重试") }
  await mode.pending
  const support = clientSupport(sessionId)
  if (!support.canExecute || (!example && !support.ok)) return { kind: 'error', text: clientSupportMessage(sessionId) ?? t("会话命令执行接口不可用，请检查 DSH 版本。") }
  const setup = await call<Setup>('setup', { sessionId })
  if (setup.capabilities?.ok === false) return { kind: 'error', text: t("当前 DSH ") + (setup.dshVersion ?? t("（版本未知）")) + t(" 缺少比较所需接口：") + setup.capabilities.missing.join('、') + t("。请升级或回退至已验证的版本；草稿保留。") }
  if (!example && setup.project?.supported === false) return { kind: 'error', text: t("当前项目不受支持：") + (setup.project.reason ?? t("这个项目暂时无法比较。")) + t(" 草稿保留，也可以试跑内置示例。") }
  const remote = clientCtx?.remote?.commands
  if (!remote) throw new Error(t("会话命令执行器不可用，请重新打开对话"))
  const contextIds = !example && (preferences.contextMode ?? 'recent') === 'selected' ? { contextIds: mode.contextIds } : {}
  const result = await remote.execute(sessionId, `/ab @ui ${JSON.stringify({ version: 1, task, example, preferences, ...contextIds })}`, [])
  if (!result.ok) throw new Error(result.error?.message ?? t("比较未能进入会话"))
  if (!result.value) throw new Error(t("比较命令未注册，请检查插件是否已加载"))
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
  const applied = shell.beginCommand({ name: 'ab', token: '/ab ', hint: t("只需写需求；模型与时长在上方选择"), submit: (task) => executeComparison(sessionId, task) }, { start: 0, end: state.claim?.name === 'ab' ? 1 : 0, draftRev: state.draftRev })
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
// ---- styles (scoped by the .ac- prefix) ----
function Styles(): React.ReactElement {
  // The effects follow the root this style sheet sits in.
  const sheet = useRef<HTMLStyleElement>(null)
  useEffect(() => {
    const root = sheet.current?.parentElement?.closest('.ac-root')
    return root instanceof HTMLElement ? attachFx(root) : undefined
  }, [])
  return <style ref={sheet}>{CSS}</style>
}
const IconClose = (): React.ReactElement => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
)
const IconExternal = (): React.ReactElement => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h2.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
function Screenshots({ runId, c, busy, act, device }: { runId: string; c: Cand; busy: boolean; act: Act; device: PreviewDevice }): React.ReactElement {
  const mobile = device === 'phone', key = `${runId}/${c.label}/${mobile ? 'phone' : 'desktop'}`
  const available = mobile ? c.hasMobileScreenshot : c.hasScreenshot
  const description = t("候选 {0} {1}验收截图", { 0: c.label, 1: mobile ? t("手机") : t("桌面") })
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
    ? <button className="ac-btn primary sm" disabled={busy} onClick={() => act('reopenPreview', { label: c.label })}>{t("重新打开预览")}</button>
    : null
  return (
    <div className="ac-shotwrap">
      <div className="ac-shotbar ac-shottools"><span>{mobile ? t("手机验收截图 · 静态记录") : t("桌面验收截图 · 静态记录")}</span>{reopen}{current.url && <button className="ac-text-btn" aria-pressed={natural} onClick={() => setOriginal({ key, value: !natural })}>{natural ? t("适应宽度") : t("原始尺寸")}</button>}</div>
      {current.loading ? <div className="ac-empty" role="status">{t("正在读取")}{description}…</div>
        : current.error ? <div className="ac-empty" role="alert">{t("截图读取失败：")}{current.error}<button className="ac-btn sm" onClick={() => setRetry(n => n + 1)}>{t("重试读取截图")}</button></div>
        : current.url ? <div className={`ac-shot${natural ? ' natural' : ''}`} tabIndex={0} role="region" aria-label={description}>
          <img className={mobile ? 'm' : ''} src={current.url} alt={description} onError={() => setImage({ key, loading: false, error: t("图片无法显示，请重试读取。") })} />
        </div> : <div className="ac-empty">{t("此记录没有")}{mobile ? t("手机") : t("桌面")}{t("验收截图。")}</div>}
    </div>
  )
}
/** What the agent is doing right now, so a slow run reads as slow rather than stuck. */
type PreviewDevice = 'adaptive' | 'desktop' | 'phone'
function LivePreview({ c, device, compact, dense = false }: { c: Cand; device: PreviewDevice; compact: boolean; dense?: boolean }): React.ReactElement {
  const holder = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  // Three or four versions side by side get shorter adaptive pages, so every one stays in view.
  const size = device === 'adaptive' ? { width: Math.max(240, width - 24), height: compact ? (dense ? 300 : 320) : (dense ? 300 : 480) } : device === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
  useLayoutEffect(() => {
    const el = holder.current
    if (!el) return
    const measure = (): void => { if (el.clientWidth > 0) setWidth(el.clientWidth) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const scale = width === 0 ? 1 : Math.min(1, Math.max(1, width - 24) / size.width)
  return <div ref={holder} className="ac-preview-stage"><div className="ac-preview-surface" style={{ width: size.width * scale, height: size.height * scale }}>
    <iframe className="ac-frame" title={t("候选 {0} 的运行页面", { 0: c.label })} src={c.previewUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads" style={{ width: size.width, height: size.height, transform: `scale(${scale})` }} />
  </div></div>
}
function PatchReview({ runId, label }: { runId: string; label: Label }): React.ReactElement {
  const [patch, setPatch] = useState<{ text: string; sha256?: string; truncated: boolean }>()
  const [error, setError] = useState<string>()
  const read = (): void => { setError(undefined); call<NonNullable<typeof patch>>('patch', { runId, label }).then(setPatch, (e: Error) => setError(e.message)) }
  return <details className="ac-details ac-patch" onToggle={(e) => { if (e.currentTarget.open && !patch) read() }}><summary>{t("查看 ")}{label}{t(" 的代码改动")}</summary>
    {error ? <div role="alert"><Diagnostic text={error} /> <button className="ac-text-btn" onClick={read}>{t("重试")}</button></div> : !patch ? <p className="ac-meta">{t("正在读取补丁…")}</p> : <>
      <div className="ac-meta">SHA-256 {patch.sha256 ?? t("未知")}{patch.truncated ? t(" · 补丁较大，当前仅显示前 400,000 个字符，请另存分支进行完整审查。") : ''}</div>
      <pre tabIndex={0} aria-label={t("候选 {0} 的补丁", { 0: label })}>{patch.text || t("没有文本改动")}</pre>
    </>}
  </details>
}
/** A candidate set aside while narrowing down: one line, restorable. Nothing in the record changes. */
function ExcludedCard({ c, onRestore }: { c: Cand; onRestore(): void }): React.ReactElement {
  return <section className="ac-card ac-card-excluded" data-label={c.label} aria-label={t("候选 {0}（已排除）", { 0: c.label })}>
    <div className="ac-row"><span className="ac-label">{c.label}</span><span className="ac-meta">{t("已排除，暂不比较")}</span><span className="ac-spacer" /><button type="button" className="ac-text-btn" onClick={onRestore}>{t("恢复 {0}", { 0: c.label })}</button></div>
  </section>
}
function CandidateCard({ run, c, revealed, picked, busy, act, device, compact, hidden, onExclude, dense = false }: { run: Run; c: Cand; revealed: boolean; picked: boolean; busy: boolean; act: Act; device: PreviewDevice; compact: boolean; hidden?: boolean; onExclude?: () => void; dense?: boolean }): React.ReactElement {
  const usage = !revealed ? undefined : c.usage?.kind !== 'reported' ? t("用量未知") : [
    c.usage.totalTokens === undefined ? t("总用量未知") : `${c.usage.totalTokens.toLocaleString(currentLocale())} tokens`,
    ...([['inputTokens', t("未缓存输入")], ['outputTokens', t("输出")], ['cacheReadTokens', t("缓存读取")], ['cacheWriteTokens', t("缓存写入")]] as const)
      .flatMap(([key, label]) => c.usage?.kind === 'reported' && c.usage[key] !== undefined ? [`${label} ${c.usage[key].toLocaleString(currentLocale())}`] : []),
  ].join(' · ')
  const live = c.previewUrl !== undefined && !['failed', 'cancelled', 'interrupted'].includes(c.stage)
  const step = busyStage(c.stage) && c.stage !== 'stopping' ? PIPELINE.findIndex((p) => p.stage === c.stage) + 1 : 0
  const model = revealed ? routeText(c.actualRoute ?? c.route) : ''
  // The moment of the pick and the reveal: light sweeps the cards, the pick bursts. Only on the change, never on reload.
  const card = useRef<HTMLElement>(null)
  const seen = useRef({ picked, revealed })
  useEffect(() => {
    const before = seen.current
    seen.current = { picked, revealed }
    const element = card.current
    if (!element) return
    if (picked && !before.picked) burst(element.querySelector('.ac-label') ?? element)
    if (revealed && !before.revealed) {
      element.classList.add('ac-revealing')
      const timer = setTimeout(() => element.classList.remove('ac-revealing'), 1400)
      return () => { clearTimeout(timer); element.classList.remove('ac-revealing') }
    }
    return undefined
  }, [picked, revealed])
  return (
    <section ref={card} className={`ac-card${picked ? ' picked' : ''}`} data-label={c.label} aria-label={t("候选 {0}", { 0: c.label })} hidden={hidden}>
      <div className="ac-card-head">
        <div className="ac-row">
          <span className="ac-label">{c.label}</span>
          <StagePill c={c} />
          {picked && <span className="ac-pill brand ac-picked">{t("你的选择")}</span>}
          {c.previewKind === 'dev' && live && run.acceptance.checks.includes('build') && <span className="ac-pill warn" title={t("构建没有通过，这是开发模式，只供观察")}>{t("开发模式")}</span>}
          {c.stage === 'ready' && c.result === 'answer' && <span className="ac-pill">{t("回答")}</span>}
          {c.stage === 'ready' && c.result === 'files' && <span className="ac-pill">{t("文件")}</span>}
          <span className="ac-meta">{c.verificationHistory?.length ? t("本次验收 ") : ''}{fmt(elapsed(c))}</span>
          {run.state === 'running' && busyStage(c.stage) && c.stage !== 'stopping' && <button className="ac-btn sm" disabled={busy} onClick={() => act('cancel', { label: c.label })}>{t("停止这一版")}</button>}
          {onExclude && <button type="button" className="ac-text-btn ac-exclude" disabled={busy} onClick={onExclude} title={t("先把这一版放到一边，剩下的版本重新排布；随时可以恢复")}>{t("排除")}</button>}
          {live && <a className="ac-icon-btn ac-preview-open" href={c.previewUrl} target="_blank" rel="noreferrer" title={t("在浏览器标签页中打开 {0}；Cookie 与存储上下文可能和嵌入预览不同", { 0: c.previewUrl })} aria-label={t("在浏览器中打开 {0}", { 0: c.label })}><IconExternal /></a>}
          {revealed && c.strategy && <span className="ac-strategy">{revealedStyleName(c.strategy)}{model ? ` · ${model}` : ''}</span>}
        </div>
        {busyStage(c.stage) && <Track c={c} />}
        {step > 0 && <div className="ac-meta">{t("第 ")}{step}/{PIPELINE.length}{t(" 步 · ")}{t(STAGE_TEXT[c.stage])}</div>}
        {c.stage === 'generating' && c.progress && <Activity p={revealed ? c.progress : { steps: c.progress.steps, lastActivityAt: c.progress.lastActivityAt, ...(c.progress.lastAction ? { lastAction: t("正在处理项目") } : {}) }} />}
        <Checks checks={c.checks} />
      </div>
      {live ? (
        <div className="ac-browser">
          <LivePreview c={c} device={device} compact={compact} dense={dense} />
        </div>
      ) : c.error || c.canRetryVerification ? (
        <div className={`ac-fail${c.stage === 'interrupted' ? ' interrupted' : ''}`}>
          <b>{t(c.install?.failure?.summary) ?? (c.error ? (stage => c.stage === 'interrupted' ? `${stage}${t("时中断")}` : c.stage === 'cancelled' ? t("{0}已停止", { 0: stage }) : t("{0}失败", { 0: stage }))(t(ERROR_STAGE[c.error.stage]) ?? t(STAGE_TEXT[c.error.stage]) ?? c.error.stage) : t("验收已停止"))}</b>
          {c.install?.failure ? <p><Diagnostic text={c.install.failure.hint} />{c.install.failure.code ? `（${c.install.failure.code}）` : ''}</p> : <Diagnostic text={c.error?.message} />}
          {c.canRetryVerification && <div className="ac-salvage"><span>{t("保留已封存代码与共同验收，不重新生成。")}</span><button className="ac-btn primary sm" disabled={busy} onClick={() => act('retryVerification', { label: c.label })}>{t("重新验收 ")}{c.label}</button></div>}
          {revealed && c.install?.failure?.diagnostic && <details className="ac-details"><summary>{t("查看安装日志")}</summary><pre className="ac-install-log" tabIndex={0}>{c.install.failure.diagnostic}</pre></details>}
          {c.salvageable && (
            <div className="ac-salvage">
              <span>{t("副本里还保留着它已经写的改动，可以照样封存并跑完整验收，由验收结果决定能否采用。")}</span>
              <button className="ac-btn primary sm" disabled={busy} onClick={() => act('salvage', { label: c.label })}>{t("验收已写的改动")}</button>
            </div>
          )}
        </div>
      ) : c.stage === 'ready' && c.result ? (
        <ResultView run={run} c={c} call={call} />
      ) : c.stage === 'ready' ? (
        <Screenshots runId={run.runId} c={c} busy={busy} act={act} device={device} />
      ) : (
        <div className="ac-empty">
          {busyStage(c.stage) && c.stage !== 'stopping' ? <LiquidMeter level={step / PIPELINE.length} busy /> : <div className="ac-skel"><i style={{ width: '60%' }} /><i /><i style={{ width: '80%' }} /></div>}
          <div>{c.stage === 'cancelled' ? t("已停止") : c.stage === 'stopping' ? t("正在停止并回收资源…") : run.target !== undefined || !['installing', 'verifying', 'previewing'].includes(c.stage) ? t("{0}…完成后这里会显示结果：页面、文件或回答", { 0: t(STAGE_TEXT[c.stage]) }) : t("{0}…构建产物启动后，这里会显示真实页面", { 0: t(STAGE_TEXT[c.stage]) })}</div>
        </div>
      )}
      <div className="ac-card-evidence">
        <details className="ac-details ac-evidence"><summary>{revealed ? t("检查依据与用量") : t("检查依据 · 盲选中")}{c.verdict ? c.verdict.eligible ? c.result !== undefined && !c.checks?.length ? t(" · 没有可运行的检查") : t(" · 已通过配置检查") : t(" · 存在采用阻碍") : ''}</summary><Verdict c={c} />
        {!revealed && <div className="ac-meta">{t("风格、模型、用量、改动规模和详细日志在选择后显示。")}</div>}
        {c.execution && <div className="ac-meta">{t("项目命令：")}{c.execution.enforcement === 'full' ? t("宿主报告完整文件写入约束") : c.execution.enforcement === 'partial' ? t("宿主报告部分文件写入约束") : t("约束完整性未知")}{t("。不包含文件读取与网络隔离。")}</div>}
        {c.install?.runtime && <div className="ac-meta">{t("验收宿主 Node ")}{c.install.runtime.hostNode} · {c.install.runtime.platform} · {c.install.runtime.packageManager} {c.install.runtime.packageManagerVersion ?? t("版本未记录")}</div>}
        {revealed && <WindowsProcessEvidence value={c.install?.runtime?.windowsProcessCompat} failed={c.stage === 'failed'} />}
        {revealed && <div className="ac-meta">{t("阶段耗时：")}{(['preparing', 'generating', 'installing', 'verifying', 'previewing'] as const).map(stage => { const timing = c.timings[stage]; return `${t(STAGE_TEXT[stage])} ${timing?.endedAt === undefined ? t("未完整记录") : fmt(Math.max(0, timing.endedAt - timing.startedAt))}` }).join(' · ')}{t("。各阶段包含相应宿主开销，不等于纯模型等待。")}</div>}
        {revealed && (c.patchStats || usage) && (
          <div className="ac-meta">
            {c.patchStats ? t("{0} 个文件 · +{1} −{2}{3}", { 0: c.patchStats.files, 1: c.patchStats.insertions, 2: c.patchStats.deletions, 3: c.patchStats.binary ? t(" · {0} 个二进制", { 0: c.patchStats.binary }) : '' }) : ''}
            {c.patchStats && usage ? ' · ' : ''}{usage}
          </div>
        )}
        {revealed && c.summary && <div className="ac-summary"><small>{t("候选说明（原文）")}</small>{c.summary}</div>}</details>
        {!!c.verificationHistory?.length && <details className="ac-details"><summary>{t("先前验收记录 · ")}{c.verificationHistory.length}{t(" 次")}</summary><ol>{c.verificationHistory.map((attempt, index) => <li key={index}><b>{attempt.install?.failure?.summary ?? attempt.error?.message.split('\n')[0] ?? t("先前验收未完成")}</b><div className="ac-meta">{t("重试前归档于 ")}{when(attempt.recordedAt)} · {attempt.durationMs === undefined ? t("耗时未知") : fmt(attempt.durationMs)}{attempt.install?.failure?.code ? ` · ${attempt.install.failure.code}` : ''}</div><Checks checks={attempt.checks} /></li>)}</ol></details>}
        {revealed && c.patchStats && <PatchReview runId={run.runId} label={c.label} />}
      </div>
    </section>
  )
}
function ExampleTimingEvidence(): React.ReactElement {
  return <details className="ac-details"><summary>{t("基础示例实测：首个预览中位 41 秒（指定配置 3 轮）")}</summary><p className="ac-meta">{t("2026-11-05，Windows · DSH 0.2.1-rc.5 · Node 26.13.0 · DeepSeek Flash，基础搜索与清空任务。首个预览 39–60 秒，两版验收中位 112.5 秒；6/6 候选通过，3 次测试采用与撤销成功。每版报告约 12.3–123.5 万 token，含缓存，不能直接换算费用。宿主已启动，缓存未重置；这不是其他配置的耗时承诺。")}<a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/first-use.md" target="_blank" rel="noreferrer">{t("查看源码、样本和测量条件")}</a></p></details>
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
      if (!enterMode(sessionId)) setError(clientSupportMessage(sessionId) ?? t("当前输入框暂时无法进入比较模式，请稍后重试。草稿未改动。"))
    }
  }, [p.enabled, mode.loaded, state?.phase, state?.draftRev, sessionId])
  const close = (): void => {
    if (!leaveMode(sessionId)) { setError(t("当前消息正在提交，请等它结束后退出比较模式")); return }
    saveMode(sessionId, { ...p, enabled: false }); inputShell(sessionId)?.focus?.()
  }
  const example = async (): Promise<void> => {
    setBusy(true); setError(undefined)
    try { const result = await executeComparison(sessionId, '', true); if (result.kind === 'error') setError(result.text ?? t("示例未能开始")) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  const versions = versionsOf(p)
  const slots = Array.from({ length: versions }, (_, i) => p.models[i] ?? {})
  const validPair = slots.every(m => m.provider && m.model) && new Set(slots.map(m => `${m.provider}/${m.model}`)).size === slots.length
  const styles = p.styles?.length === versions ? p.styles : stylesFor(versions, p.styles)
  const blind = p.blind !== false
  if (!enabled && !mode.error) return null
  return <section lang={currentLocale()} className="ac-root ac-composer-settings" aria-label={t("A|B 比较设置")}><Styles />
    <div className="ac-settings-head"><span className="ac-logo">A|B</span><div><b>{t("对比模式")}</b><span>{mode.collapsed ? t("{0} · {1} 版 · {2} · 每版 {3} 分钟", { 0: p.mode === 'same-model' ? t("同一模型 · 不同风格") : t("不同模型 · 同一风格"), 1: versions, 2: blind ? t("盲选") : t("公开对比"), 3: p.generationMinutes }) : t("在下方写需求，发送后在这条对话里同时运行各版。")}</span></div><button className="ac-text-btn" onClick={() => { mode.collapsed = !mode.collapsed; publishMode(mode) }}>{mode.collapsed ? t("展开设置") : t("收起")}</button><button className="ac-icon-btn" onClick={close} disabled={busy} aria-label={t("退出 A|B 模式")}><IconClose /></button></div>
    {setup?.capabilities?.ok === false && <div className="ac-feedback" role="alert">{t("当前 DSH ")}{setup.dshVersion ?? t("（版本未知）")}{t(" 缺少比较所需接口：")}{setup.capabilities.missing.join('、')}{t("。请升级或回退至已验证版本；比较记录和草稿保留。")}</div>}
    {setup?.capabilities?.warnings.includes('sessionController.resolveAgent') && <div className="ac-feedback" role="status">{t("当前 DSH 缺少会话恢复接口：sessionController.resolveAgent。已打开的对话仍可使用；历史对话请先在 DSH 中重新打开。")}</div>}
    {/* One text run: inline pieces must not become separate flex columns. */}
    {setup?.project?.supported === false && <div className="ac-feedback" role="status"><span>{t("当前项目不受支持：")}<Diagnostic text={setup.project.reason ?? t("这个项目暂时无法比较。")} />{t(" 草稿保留，可试跑内置示例。")}</span></div>}
    {setup?.project?.supported && setup.project.warning && <div className="ac-feedback" role="status"><Diagnostic text={setup.project.warning} /></div>}
    {setup?.project?.supported && !mode.collapsed && <ProjectNotes project={setup.project} sessionId={sessionId} call={call} disabled={busy} onChanged={() => setSetupRetry(value => value + 1)} />}
    {!mode.collapsed && <>
    <div className="ac-settings-row">
      <Segmented label={t("比较方式")} value={p.mode} onChange={value => saveMode(sessionId, { ...p, mode: value })} options={[{ value: 'same-model', text: t("同一模型 · 不同风格") }, { value: 'cross-model', text: t("不同模型 · 同一风格") }]} />
      <VersionsControl value={versions} disabled={busy || !mode.loaded} onChange={n => saveMode(sessionId, withVersions(p, n))} />
      <BlindControl blind={blind} disabled={busy || !mode.loaded} onChange={value => saveMode(sessionId, { ...p, blind: value })} />
      <label className="ac-budget">{t("每版上限 ")}<select aria-label={t("每版生成上限")} value={p.generationMinutes} onChange={e => saveMode(sessionId, { ...p, generationMinutes: Number(e.target.value) })}>{[...new Set([5, 15, 30, 60, 90, 120, p.generationMinutes])].sort((a, b) => a - b).map(m => <option key={m} value={m}>{m}{t(" 分钟")}</option>)}</select></label>
    </div>
    {p.mode === 'cross-model' ? <div className="ac-models" role="group" aria-label={t("各版模型")}>{slots.map((slot, i) => <label key={i}><span className="ac-style-badge" aria-hidden="true">{blind ? i + 1 : LABELS[i]}</span><select aria-label={t("第 {0} 个模型", { 0: i + 1 })} disabled={loading || busy} value={slot.model ? `${slot.provider}/${slot.model}` : ''} onChange={e => { const item = models.find(m => `${m.provider}/${m.id}` === e.target.value); const next = slots.map((value, at) => at === i ? (item ? { provider: item.provider, model: item.id } : {}) : value); saveMode(sessionId, { ...p, versions, models: next }) }}><option value="">{t("选择已配置的模型")}</option>{models.map(m => <option key={`${m.provider}/${m.id}`} value={`${m.provider}/${m.id}`} disabled={slots.some((other, at) => at !== i && other.provider === m.provider && other.model === m.id)}>{m.name} · {m.providerName}</option>)}</select></label>)}
      <StylePicker index={0} shared open={!blind} choice={p.crossStyle ?? { id: 'balanced' }} disabled={busy || !mode.loaded} onChange={crossStyle => saveMode(sessionId, { ...p, crossStyle })} />
      {loading ? <span className="ac-meta" role="status">{t("正在读取模型…")}</span> : modelError ? <span className="ac-meta" role="alert">{modelError} <button className="ac-text-btn" onClick={() => { void loadModels() }}>{t("重试模型列表")}</button></span> : models.length < versions ? <span className="ac-meta">{t("当前可读取的模型不足 {0} 个，可减少版本数，或使用同一模型的不同风格。", { 0: versions })}</span> : null}</div>
      : <>
        <StyleSlots styles={styles} blind={blind} disabled={busy || !mode.loaded} onChange={next => saveMode(sessionId, { ...p, versions, styles: next })} />
        <StyleCombos styles={styles} disabled={busy || !mode.loaded} onPick={next => saveMode(sessionId, { ...withVersions(p, next.length), versions: next.length, styles: next })} />
      </>}
    <div className="ac-meta ac-settings-facts">
      {p.mode === 'same-model' && <span>{t("当前模型：")}{routeText(setup?.current) || (setup ? t("请先在输入框右下角选择模型") : t("正在读取…"))}</span>}
      {setup?.project?.path ? <span className="ac-settings-project" title={setup.project.path}>{t("项目：")}{setup.project.path}</span> : null}
      {versions > 2 && <span className="ac-usage-hint">{t("{0} 版同时生成，用量约为单版的 {0} 倍", { 0: versions })}</span>}
      <StyleHabit load={() => call<{ comparisons: number; styles: StyleStat[] }>('styleStats', { sessionId })} />
    </div>
    <div className="ac-settings-row ac-example-row">
      <label className="ac-budget">{t("示例 ")}<select aria-label={t("内置示例范围")} disabled={busy || !mode.loaded} value={p.exampleKind ?? 'quick'} onChange={e => saveMode(sessionId, { ...p, exampleKind: e.target.value as 'quick' | 'full' })}><option value="quick">{t("基础 · 搜索与清空")}</option><option value="full">{t("完整 · 组合筛选与手机适配")}</option></select></label>
      <button className="ac-btn sm" disabled={busy || !mode.loaded || setup?.capabilities?.ok === false || !clientSupport(sessionId).canExecute || (p.mode === 'cross-model' ? !validPair : !setup?.current.model)} onClick={() => { void example() }}>{busy ? t("正在创建示例…") : t("试跑内置示例")}</button>
    </div>
    <ConversationContextControl sessionId={sessionId} mode={p.contextMode ?? 'recent'} turns={p.contextTurns ?? 3} selected={mode.contextIds} disabled={busy || !mode.loaded} call={call}
      onMode={contextMode => saveMode(sessionId, { ...p, contextMode })} onTurns={contextTurns => saveMode(sessionId, { ...p, contextTurns })}
      onSelected={ids => { mode.contextIds = ids; publishMode(mode) }} />
    {setup?.projectProcess?.platform === 'win32' && setup.projectProcess.windowsCompatControl && <WindowsProcessControl mode={p.windowsProcessCompat} disabled={busy || !mode.loaded} onChange={windowsProcessCompat => saveMode(sessionId, { ...p, windowsProcessCompat })} />}
    <div className="ac-settings-foot"><span>{t("到时验收已写的改动 · 各版分别消耗用量 · 示例也使用真实模型，生成耗时随模型与环境变化 · ")}{mode.saving ? t("正在保存设置…") : t("设置已保存在此对话")}</span>{(p.exampleKind ?? 'quick') === 'quick' && <ExampleTimingEvidence />}</div></>}
    {setupError && !mode.collapsed && <div className="ac-feedback" role="alert"><span>{t("无法读取当前模型与项目：")}<Diagnostic text={setupError} /></span><button className="ac-text-btn" onClick={() => { setSetupError(undefined); setSetupRetry(value => value + 1) }}>{t("重新读取模型与项目")}</button></div>}
    {(error || mode.error) && <div className="ac-feedback" role="alert"><Diagnostic text={error ?? mode.error} /><button className="ac-text-btn" onClick={() => { void loadMode(sessionId); setError(undefined) }}>{t("重新读取设置")}</button></div>}
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
  useEffect(() => {
    // An open comparison needs the space above the composer; fold the settings once per comparison.
    if (!latest || !ACTIVE.has(latest.state) || mode.autoCollapsedRunId === latest.runId) return
    mode.autoCollapsedRunId = latest.runId
    if (!mode.collapsed) { mode.collapsed = true; publishMode(mode) }
  }, [latest?.runId, latest?.state, mode])
  const resident = latest?.origin?.kind === 'tool' && latest.state !== 'abandoned' && mode.dismissedRunId !== latest.runId
  const runId = blank ? mode.runId ?? latest?.runId : resident ? latest?.runId : undefined
  useEffect(() => { setCollapsed(!blank && latest?.state === 'adopted' && latest.adoption?.state === 'adopted') }, [runId])
  return <>
    {capabilityError && <div lang={currentLocale()} className="ac-root"><Styles /><div className="ac-feedback ac-prerequisite" role="alert"><span><Diagnostic text={capabilityError} /></span><div className="ac-prerequisite-actions"><button className="ac-text-btn" onClick={() => { void loadMode(sessionId) }}>{t("重新检查接口")}</button><button className="ac-text-btn" onClick={() => setOpen(sessionId)}>{t("比较记录")}</button></div></div></div>}
    {runId && <section lang={currentLocale()} className="ac-root ac-conversation-run" aria-label={t("本对话的 A|B 结果")}><Styles />
      {collapsed && <div className="ac-conversation-run-head"><b>{t("本次比较")}</b><span className="ac-meta">{runId}</span><span className="ac-spacer" /><button className="ac-text-btn" onClick={() => setOpen(sessionId)}>{t("记录与教程")}</button><button className="ac-text-btn" onClick={() => setCollapsed(false)}>{t("展开结果")}</button></div>}
      <div className="ac-conversation-run-scroll" hidden={collapsed}><RunView key={runId} runId={runId} sessionId={sessionId} compact {...(latest?.runId === runId ? { initial: latest } : {})} onExpand={() => setOpen(sessionId, runId)} onCollapse={() => setCollapsed(true)} /></div>
    </section>}
    {error && (blank || mode.preferences.enabled || mode.refreshVersion) ? <div lang={currentLocale()} className="ac-root"><div className="ac-feedback" role="alert"><span>{t("读取比较记录失败：")}<Diagnostic text={error} /></span></div></div> : null}
    <ComposerSettings sessionId={sessionId} session={session} />
  </>
}
function StarNudge(): React.ReactElement | null {
  const key = 'agent-compare.star-nudge'
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  if (hidden) return null
  const hide = (): void => { try { localStorage.setItem(key, '1') } catch { /* ignore */ } setHidden(true) }
  return (
    <span>{t("觉得有用？")}<a className="ac-link" href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare" target="_blank" rel="noreferrer" onClick={hide}>{t("给项目点个 Star")}</a>
      <button className="ac-icon-btn" style={{ width: 22, height: 22, verticalAlign: 'middle' }} onClick={hide} aria-label={t("不再显示")}><IconClose /></button>
    </span>
  )
}
type Act = (method: string, extra?: Record<string, unknown>) => void
const BUDGET_OPTIONS = [5, 15, 30, 60, 90, 120]
/** The same limit again, or the next longer one when generation ran out of time. */
function suggestedMinutes(run: Run): number {
  const base = Math.min(120, Math.max(5, Math.round((run.budget?.generationMs ?? 30 * 60_000) / 60_000)))
  if (!run.candidates.some(c => c.generation?.ended === 'budget')) return base
  return BUDGET_OPTIONS.find(minutes => minutes > base) ?? 120
}
/** Start the same requirement again from the conversation that owns this comparison. */
function RerunControl({ run, sessionId, busy, act }: { run: Run; sessionId?: string; busy: boolean; act: Act }): React.ReactElement | null {
  const [minutes, setMinutes] = useState(() => suggestedMinutes(run))
  if (!sessionId || run.sessionId !== sessionId) return null
  return <span className="ac-rerun">
    <label className="ac-budget">{t("每版上限 ")}<select aria-label={t("重新比较的每版生成上限")} value={minutes} disabled={busy} onChange={e => setMinutes(Number(e.target.value))}>{[...new Set([...BUDGET_OPTIONS, minutes])].sort((a, b) => a - b).map(m => <option key={m} value={m}>{m}{t(" 分钟")}</option>)}</select></label>
    <button className="ac-btn" disabled={busy} onClick={() => act('rerun', { minutes })} title={t("用同一条需求在本对话里重新比较；这次的结果和记录继续保留。")}>{t("再比较一次")}</button>
  </span>
}
function ActionBar({ run, sessionId, busy, pending, act, onDone, onContinue, excluded = new Set() }: { run: Run; sessionId?: string; busy: boolean; pending?: string | undefined; act: Act; onDone?: () => void; onContinue?: () => void; excluded?: ReadonlySet<Label> }): React.ReactElement | null {
  if (run.control?.allowed === false) return <div className="ac-bar" role="status" aria-label={t("比较操作权限")}><span className="ac-bar-text"><strong>{t("当前仅可查看。")}</strong><Diagnostic text={run.control.reason} /></span></div>
  const pick = run.choice?.pick
  const picked = run.candidates.find((c) => c.label === pick)
  const retrying = run.candidates.filter(c => c.verificationHistory?.length && busyStage(c.stage))
  const total = Math.max(...(retrying.length ? retrying : run.candidates).map(elapsed))
  const ready = run.candidates.filter((c) => c.stage === 'ready').length
  switch (run.state) {
    case 'running':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{retrying.length ? t("正在重新验收 {0} · 本次已用 ", { 0: retrying.map(c => c.label).join('、') }) : t("{0} 个版本并行进行中 · 已用 ", { 0: run.candidates.length })}<strong>{fmt(total)}</strong>{ready ? t(" · {0} 个已可体验", { 0: ready }) : ''}</span>
          <button className="ac-btn danger" disabled={busy} onClick={() => act('cancel')}>{retrying.length ? t("停止验收") : t("全部停止")}</button>
        </div>
      )
    case 'judging':
      if (ready === 0) {
        const salvageable = run.candidates.some((c) => c.salvageable || c.canRetryVerification)
        return (
          <div className="ac-bar">
            <span className="ac-bar-text"><strong>{t("没有可体验的结果。")}</strong>{salvageable ? t("改动仍保留。可以在卡片里查看原因并验收，或结束这次比较。") : t("可以结束这次比较，调整描述或时间上限后再来。")}</span>
            <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>{t("都不采用并揭晓")}</button>
            <RerunControl run={run} sessionId={sessionId} busy={busy} act={act} />
          </div>
        )
      }
      {
        const n = run.candidates.length, open = run.blind === false
        const choosable = run.candidates.filter(c => c.stage === 'ready' && !excluded.has(c.label))
        const readyLabels = run.candidates.filter(c => c.stage === 'ready').map(c => c.label)
        const results = run.candidates.every(c => c.result !== undefined)
        // Open comparisons have nothing to reveal; blind ones reveal on the pick.
        const tail = open ? t("，选出你更满意的那一版") : t("，选出你更满意的那一版；选完立即揭晓")
        const text = ready === n
          ? <><strong>{results ? (n === 2 ? t("比较两版的结果") : t("比较 {0} 版的结果", { 0: n })) : (n === 2 ? t("两边都试一下") : t("每一版都试一下"))}</strong>{tail}{excluded.size ? t("（已排除 {0}）", { 0: [...excluded].sort().join('、') }) : ''}</>
          : ready === 1 ? <><strong>{t("仅 ")}{readyLabels[0]}{t(" 已可体验。")}</strong>{open ? t("先操作这一版，再决定是否选择。") : t("先操作这一版，再决定是否选择；选完立即揭晓。")}</>
          : <><strong>{t("{0} 已可体验。", { 0: readyLabels.join('、') })}</strong>{open ? t("先操作这些版本，再决定选哪一版。") : t("先操作这些版本，再决定选哪一版；选完立即揭晓。")}</>
        return (
          <div className="ac-bar">
            <span className="ac-bar-text">{text}</span>
            <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>{t("都不满意")}</button>
            {choosable.map((c) => <button key={c.label} className="ac-btn primary" disabled={busy} onClick={() => act('choose', { pick: c.label })}>{t("选 ")}{c.label}</button>)}
          </div>
        )
      }
    case 'revealed': {
      const eligible = picked?.verdict?.eligible === true
      // Nothing adopted yet: the user may switch to the other finished version after seeing both revealed.
      const alternatives = run.adoption === undefined ? run.candidates.filter(c => c.stage === 'ready' && c.label !== pick) : []
      const alternativeEligible = alternatives.some(c => c.verdict?.eligible === true)
      const folder = run.target !== undefined
      const answer = picked?.result === 'answer'
      const text = pick === 'none' || picked === undefined ? alternatives.length ? t("这次都没选。揭晓后仍可改选一版，或用同一需求再比较一次。") : t("这次都没选。可以换个描述再来一次。")
        : answer ? <><strong>{t("你选了 {0} 的回答。", { 0: pick })}</strong>{t("接着在主对话里提问就会用上它，没有需要保存的文件。")}</>
        : folder ? run.target?.folder ? <span title={run.target.folder}>{t("选中的文件还没有保存。保存时会在 {0} 里新建一个文件夹，不改动原有文件。", { 0: `「${run.target.folder.split(/[\\/]/).filter(Boolean).at(-1) ?? run.target.folder}」` })}</span> : t("这条对话没有目录；选中的文件可以在卡片里查看。")
        : eligible ? t("先核对目标与改动，必要时在副本中预演；确认后才写入。") : alternativeEligible ? t("这一版没有通过共同验收，不能写入工作区。可以改选通过验收的另一版，或另存为分支查看。") : t("这一版没有通过共同验收，不能写入工作区，可以另存为分支查看。")
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{text}</span>
          {picked !== undefined && !run.choice?.reasons?.length && !run.choice?.note && <WhyLink pick={picked.label} />}
          {alternatives.map(c => <button key={c.label} className={`ac-btn${!eligible && c.verdict?.eligible ? ' primary' : ''}`} disabled={busy} onClick={() => act('choose', { pick: c.label })} title={t("揭晓后改选；最初的盲选结果仍保留在记录中。")}>{t("改选 {0}", { 0: c.label })}</button>)}
          {(pick === 'none' || picked === undefined || (!eligible && !folder && !answer)) && <RerunControl run={run} sessionId={sessionId} busy={busy} act={act} />}
          {!answer && <button className="ac-btn" disabled={busy} onClick={() => act('reviewCopyCleanup')}>{t("整理工作副本")}</button>}
          {answer && picked?.answer && <CopyButton className="ac-btn" text={picked.answer} label={t("复制回答")} title={t("复制选中回答的原文")} />}
          {answer && onContinue && <button className="ac-btn primary" disabled={busy} onClick={onContinue} title={t("退出比较模式，在原输入框中继续。比较记录仍然保留。")}>{t("继续主对话")}</button>}
          {picked !== undefined && !folder && !answer && <button className="ac-btn" disabled={busy} onClick={() => act('adopt', { mode: 'branch' })} title={t("只新建分支（含一个提交），不切换、不改当前文件")}>{t("另存为分支")}</button>}
          {picked !== undefined && !folder && !answer && eligible && <button className="ac-btn primary" disabled={busy} onClick={() => act('reviewAdoption')}>{t("审查并采用 ")}{pick}</button>}
          {picked !== undefined && folder && !answer && run.target?.folder && <button className="ac-btn primary" disabled={busy} onClick={() => act('adopt', { mode: 'folder' })} title={t("新建一个文件夹保存选中的文件；不会覆盖或改动已有文件，之后可以撤销")}>{t("保存到当前目录")}</button>}
        </div>
      )
    }
    case 'adopting':
      return (
        <div className="ac-bar"><span className="ac-bar-text"><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{run.adoption?.state === 'reverting' ? t("正在恢复文件并核对，原始内容继续保留…") : run.adoption?.state === 'writing' ? t("正在保留原始内容、写入并核对…") : run.control?.adoptionCancellationRequested ? t("正在停止预演并确认进程退出；候选成果继续保留…") : t("正在你当前项目的副本里预演并验收…")}</span>{run.adoption?.state === 'rehearsing' && run.control?.canCancelAdoption && <button className="ac-btn danger" disabled={pending === 'cancelAdoption' || pending === 'confirmation' || run.control.adoptionCancellationRequested} onClick={() => act('cancelAdoption')}>{t("停止采用预演")}</button>}</div>
      )
    case 'recovery':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.adoption?.transferDirection === 'undo' ? t("上次恢复操作没有完整结束。可以回退到该操作开始前，或保留现在的文件。") : t("采用没有完整结束。可以恢复保留的原始内容，或保留现在的文件。")}{t("遇到新编辑会停下并保留双方内容。")}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('recover', { action: 'keep' })}>{t("保留当前文件")}</button>
          <button className="ac-btn primary" disabled={busy} onClick={() => act('recover', { action: 'restore' })}>{run.adoption?.transferDirection === 'undo' ? t("回退未完成操作") : t("恢复到采用前")}</button>
        </div>
      )
    case 'adopted':
      return (
        <div className="ac-bar" {...(busy && pending ? { role: 'status', 'aria-label': t("采用操作状态") } : {})}>
          <span className="ac-bar-text">{busy && pending ? <><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{pending === 'adopt' ? t("改动已写入，正在整理记录、预览与副本；完成后可撤销或继续。") : pending === 'revert' ? t("正在撤销采用并核对项目，请稍候…") : t("正在处理这次比较，请稍候…")}</>
            : run.adoption?.mode === 'folder' ? <><strong>{t("已保存到新文件夹")}</strong><code className="ac-path-chip" title={run.adoption.exportPath}>{run.adoption.exportPath}</code><StarNudge /></>
            : <>{t("采用记录已保存。")}{' '}<span className="ac-project-path">{t("目标：")}{run.baseline.repoRoot ?? t("本次比较的仓库")}</span> <StarNudge /></>}</span>
          {run.adoption?.mode === 'worktree' && <button className="ac-btn" disabled={busy} onClick={() => act('revert')}>{t("撤销采用")}</button>}
          {run.adoption?.mode === 'folder' && run.adoption.exportPath && <CopyButton className="ac-btn" text={run.adoption.exportPath} label={t("复制路径")} title={t("复制保存的文件夹路径")} />}
          {run.adoption?.mode === 'folder' && <button className="ac-btn" disabled={busy} onClick={() => act('revert')} title={t("只删除保存后没有改过的文件；改过的文件会保留")}>{t("撤销保存")}</button>}
          {onContinue && <button className="ac-btn primary" disabled={busy} onClick={onContinue} title={t("退出比较模式，在原输入框中继续。比较记录仍然保留。")}>{t("继续主对话")}</button>}
          {onDone && <button className="ac-btn" disabled={busy} onClick={onDone}>{t("完成")}</button>}
        </div>
      )
    default:
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.state === 'interrupted' ? t("这次比较在宿主停止时中断，可验收副本里已经写出的改动。") : t("这次比较已结束。")}</span>
          {run.state === 'interrupted' && <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>{t("不采用本次结果，查看保留内容")}</button>}
          {(run.state === 'abandoned' || run.state === 'interrupted') && <RerunControl run={run} sessionId={sessionId} busy={busy} act={act} />}
        </div>
      )
  }
}
/** From the bar to the reasons below the results, so the results stay first. */
function WhyLink({ pick }: { pick: Label }): React.ReactElement {
  return <button type="button" className="ac-text-btn ac-why-link" onClick={event => {
    const why = event.currentTarget.closest('dialog, .ac-root')?.querySelector<HTMLElement>('.ac-why')
    why?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    why?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true })
  }}>{t("为什么选 {0}？", { 0: pick })}</button>
}
/** After a pick: why it won, in a few taps. The main conversation hears it with its next message. */
function PickReasons({ run, busy, act }: { run: Run; busy: boolean; act: Act }): React.ReactElement | null {
  const pick = run.choice?.pick
  const order = PICK_REASONS.map(reason => reason.id)
  const canonical = (list: readonly PickReason[]): PickReason[] => order.filter(id => list.includes(id))
  const saved = canonical(run.choice?.reasons ?? [])
  const savedNote = run.choice?.note ?? ''
  const clean = (text: string): string => text.replace(/\s+/g, ' ').trim()
  // Taps answer at once; quick taps are saved together once nothing else is running.
  const [wanted, setWanted] = useState<{ reasons: PickReason[]; note: string }>()
  const [draft, setDraft] = useState(savedNote)
  const field = useRef<HTMLInputElement>(null)
  const tried = useRef('')
  useEffect(() => { if (document.activeElement !== field.current) setDraft(savedNote) }, [savedNote])
  const shown = wanted ?? { reasons: saved, note: savedNote }
  const key = (value: { reasons: readonly PickReason[]; note: string }): string => `${value.reasons.join(',')}|${value.note}`
  useEffect(() => {
    if (!wanted) return
    if (key(wanted) === key({ reasons: saved, note: savedNote })) { setWanted(undefined); tried.current = ''; return }
    // A save that did not take is not repeated; the comparison shows why.
    if (busy || tried.current === key(wanted)) { if (!busy) setWanted(undefined); return }
    const timer = setTimeout(() => { tried.current = key(wanted); act('explain', { pick, reasons: wanted.reasons, note: wanted.note }) }, 450)
    return () => clearTimeout(timer)
  }, [wanted, busy, saved.join(','), savedNote])
  if (!pick || pick === 'none') return null
  const toggle = (id: PickReason): void => setWanted({ reasons: canonical(shown.reasons.includes(id) ? shown.reasons.filter(reason => reason !== id) : [...shown.reasons, id]), note: shown.note })
  const commit = (): void => { const note = clean(draft); if (note !== shown.note) setWanted({ reasons: shown.reasons, note }) }
  const said = saved.length > 0 || savedNote !== ''
  return <section className={`ac-why${said ? ' said' : ''}`} aria-label={t("为什么选 {0}", { 0: pick })}>
    <span className="ac-why-q">{t("为什么选 {0}？", { 0: pick })}</span>
    <div className="ac-why-chips" role="group" aria-label={t("选择理由")}>
      {PICK_REASONS.map(reason => { const on = shown.reasons.includes(reason.id); return <button key={reason.id} type="button" className={`ac-chip${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggle(reason.id)}>{t(reason.name)}</button> })}
      <input ref={field} className="ac-why-note" type="text" maxLength={MAX_PICK_NOTE} value={draft} aria-label={t("补充一句理由")} placeholder={t("补一句，例如：按钮更好找")}
        onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } }} />
    </div>
    <span className="ac-meta" role="status">{said ? t("已记下。主对话的下一条消息会带上这些理由，后续修改会保留这些优点。") : t("可选：选几个理由，主对话接着修改时会保留这些优点。")}</span>
  </section>
}
function copySize(bytes: number): string { return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function CopySpace({ run, sessionId, blocked, publish, requestKey = 0, onReleaseBusy }: { run: Run; sessionId?: string; blocked: boolean; publish(next: Run): void; requestKey?: number; onReleaseBusy(value: boolean): void }): React.ReactElement {
  const section = useRef<HTMLElement>(null)
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
  useEffect(() => {
    if (requestKey <= 0) return
    void inspect()
    section.current?.scrollIntoView({ block: 'center' })
    section.current?.focus({ preventScroll: true })
  }, [requestKey])
  const release = async (): Promise<void> => {
    if (!plan?.allowed || (plan.otherSession && !otherConfirmed) || busy || blocked) return
    const id = ++request.current
    setBusy('release'); onReleaseBusy(true); setError(undefined)
    try { const value = await call<Run>('releaseCopies', { runId: run.runId, sessionId, token: plan.token, confirmOtherSession: otherConfirmed }); if (id === request.current) { publish(value); setPlan(undefined) } }
    catch (err) { if (id === request.current) { setError((err as Error).message); setPlan(undefined) } }
    finally { if (id === request.current) { setBusy(undefined); onReleaseBusy(false) } }
  }
  const stale = !!plan && run.rev !== undefined && plan.rev !== run.rev
  return <section ref={section} tabIndex={-1} className="ac-copy-space" aria-label={t("副本空间")}>
    <div className="ac-row" style={{ flexWrap: 'wrap', justifyContent: 'space-between' }}><div><b>{t("副本空间")}</b><div className="ac-note">{run.copiesReleasedAt ? t("副本已释放；运行记录、源码补丁、截图与撤销原件继续保留。") : t("查看空间与清单后再决定是否释放；没有自动过期删除。")}</div></div><button className="ac-btn" disabled={blocked || !!busy || !sessionId} onClick={() => { void inspect() }}>{busy === 'read' ? t("正在核对空间…") : t("查看副本空间")}</button></div>
    {error && <p className="ac-feedback" role="alert"><Diagnostic text={error} /></p>}
    {plan && <div className="ac-copy-plan">
      <p><strong>{t("本次清单：")}{plan.resources.some(resource => resource.estimated) ? '≥ ' : ''}{copySize(plan.bytes)}</strong>{t("（文件逻辑大小；不跟随链接，硬链接的实际释放量可能更少）")}{plan.resources.some(resource => resource.estimated) ? t("依赖与缓存目录较大，已在时限内估算，实际释放量更多；它们会随副本一起删除。") : ''}</p>
      <p>{t("确认后停止清单内的预览，删除对应副本及依赖。运行记录、封存源码与 Git 引用、截图、示例原仓库、候选会话及撤销原件保留；不修改当前项目。释放后不能重开这些副本的预览，仍可查看截图、审查采用或撤销已有采用。")}</p>
      {plan.retained && <details><summary>{t("单独保留的资源")}</summary><p>{t("记录了 ")}{plan.retained.sealedPatches}{t(" 份封存补丁、")}{plan.retained.childSessions}{t(" 个候选会话，以及 ")}{plan.retained.gitRefs === undefined ? t("数量暂不可确认的") : plan.retained.gitRefs + t(" 个")}{t(" Git 引用。会话、原仓库和采用恢复目录均不在删除清单中；占用空间不计入上面的可释放量。")}</p><code>{plan.retained.sourceRepository}</code></details>}
      {plan.resources.length > 0 && <ul>{plan.resources.map(resource => <li key={resource.label}><b>{t("副本 ")}{resource.label} · {resource.estimated ? '≥ ' : ''}{copySize(resource.bytes)}</b> · {resource.files}{t(" 个文件")}{resource.links ? t(" · {0} 个链接未跟随", { 0: resource.links }) : ''}{resource.stopsPreview ? t(" · 将停止预览") : ''}<details><summary>{t("目录位置")}</summary><code>{resource.path}</code></details>{resource.reason && <p><Diagnostic text={resource.reason} /></p>}</li>)}</ul>}
      {plan.reasons.map(reason => <p className="ac-feedback" key={reason}>{reason}</p>)}
      {stale && <p className="ac-feedback" role="alert">{t("比较已变化，请重新查看清单后再确认。")}</p>}
      {plan.otherSession && <label className="ac-row"><input type="checkbox" checked={otherConfirmed} onChange={event => setOtherConfirmed(event.target.checked)} />{t("这是其他对话的比较，确认释放该比较的副本。")}</label>}
      <div className="ac-row"><button className="ac-btn" disabled={!!busy} onClick={() => setPlan(undefined)}>{t("保留副本")}</button><button className="ac-btn primary" disabled={blocked || !!busy || !plan.allowed || stale || (!!plan.otherSession && !otherConfirmed)} onClick={() => { void release() }}>{busy === 'release' ? t("正在停止预览并释放…") : t("确认释放 {0} 副本", { 0: `${plan.resources.some(resource => resource.estimated) ? '≥ ' : ''}${copySize(plan.bytes)}` })}</button></div>
    </div>}
  </section>
}
/** How this comparison is tied to the main conversation: what went in, and whether the result came back. */
function ConversationLink({ run }: { run: Run }): React.ReactElement | null {
  const context = run.conversationContext, memory = run.conversationMemory
  if (!context && !memory) return null
  return <div className="ac-link-strip">
    {context ? <details className="ac-link-item"><summary><span className="ac-link-dot in" aria-hidden="true" />{t("各版都带入了主对话的 {0} 条内容，约 {1} 字", { 0: context.messages, 1: context.chars.toLocaleString() })}{context.truncated ? t("（已截取）") : ''}</summary><pre className="ac-context-text" tabIndex={0}>{context.text}</pre></details>
      : <span className="ac-link-item"><span className="ac-link-dot" aria-hidden="true" />{t("各版只看到了需求本身")}</span>}
    {memory && <span className={`ac-link-item${memory === 'synced' ? ' ok' : ''}`} role="status"><span className={`ac-link-dot ${memory === 'synced' ? 'ok' : 'wait'}`} aria-hidden="true" />{memory === 'synced' ? t("结果已写入主对话记忆") : t("结果会在你下一条消息时写入主对话记忆")}</span>}
  </div>
}
function Banners({ run, recordOnly = false }: { run: Run; recordOnly?: boolean }): React.ReactElement | null {
  const pick = run.choice?.pick
  const fav = run.checksFavoured
  const revealed = REVEALED.has(run.state) || run.choice !== undefined
  const pickedTitle = run.candidates.find((c) => c.label === pick)?.strategy?.title
  const a = run.adoption
  const bad = a && ['blocked', 'rolled-back', 'needs-recovery'].includes(a.state)
  const comparison = revealed && pick !== undefined ? <>
    <div>{run.blind === false ? t("公开对比，") : ''}{t("{0} 版，", { 0: run.candidates.length })}{run.mode === 'same-model' ? t("同一模型、不同风格。") : t("不同模型、同一风格。")}{t("你选了 ")}<strong>{pick === 'none' ? t("都不满意") : `${pick}${pickedTitle ? `（${pickedTitle}）` : ''}`}</strong>{run.choice?.initialPick !== undefined && <>{t("（揭晓后改选；盲选时选了 {0}）", { 0: run.choice.initialPick === 'none' ? t("都不满意") : run.choice.initialPick })}</>}{t("；程序验收倾向 ")}<strong>{fav === 'tie' ? t("持平") : fav === 'none' || fav === undefined ? t("无") : fav}</strong>
      {pick !== 'none' && fav !== undefined && fav !== 'tie' && fav !== 'none' && fav !== pick ? t("。你的选择和验收结论不同。") : '。'}</div>
    <div className="disclaimer">{t("单次任务的结果不代表模型或策略的整体优劣。")}</div>
  </> : null
  if (recordOnly) return comparison ? <details className="ac-banner"><summary>{t("已选 ")}{pick === 'none' ? t("都不满意") : pick}{t(" · 查看比较与选择记录")}</summary>{comparison}</details> : null
  const adoptionTitle = a ? { rehearsing: t("预演中"), blocked: t("未写入"), writing: t("写入中"), reverting: t("恢复中"), adopted: a.mode === 'branch' ? t("已建分支") : a.mode === 'folder' ? t("已保存") : t("已采用"), 'needs-attention': t("已采用 · 请查看"), 'rolled-back': t("已恢复"), 'needs-recovery': t("需要处理"), reverted: t("已撤销") }[a.state] ?? a.state : ''
  const adoptionDetails = a ? <>
    <div style={{ color: 'var(--ac-fg2)' }}><Diagnostic text={a.message} /></div>
    {a.rehearsalChecks && <Checks checks={a.rehearsalChecks} />}
    {a.attention && a.attention.length > 0 && <code>{a.attention.slice(0, 12).join('、')}</code>}
    {(a.retainedDirectory || a.retainedDirectories?.length) ? <details><summary>{t("查看保留内容的位置")}</summary><p>{t("原始文件与交接记录保存在下面的目录中，不随预览清理。发生冲突时，请先核对当前文件和保留内容，再决定如何合并。")}</p>{[a.retainedDirectory, ...a.retainedDirectories ?? []].filter(Boolean).map(directory => <div className="ac-project-path" key={directory}><code>{directory}</code></div>)}</details> : null}
  </> : null
  return (
    <>
      {run.outsideChanges && run.outsideChanges.length > 0 && (
        <div className="ac-banner warn" role="alert">
          <div><strong>{t("生成期间，你的项目里这些文件和开始时不一样了")}</strong>：<code>{run.outsideChanges.slice(0, 8).join('、')}{run.outsideChanges.length > 8 ? t(" 等 {0} 个", { 0: run.outsideChanges.length }) : ''}</code></div>
          <div className="disclaimer">{t("这些变化的来源尚未核实。采用前会检查是否与候选改动重叠；请先查看这些文件。")}</div>
        </div>
      )}
      {a && (a.state === 'adopted' || a.state === 'reverted' ? <details className="ac-banner ac-adoption-record"><summary><span className={`ac-pill ${a.state === 'adopted' ? 'ok' : ''}`}>{adoptionTitle}</span>{' '}{t("采用与恢复记录")}</summary>{adoptionDetails}</details> : (
        <div className={`ac-banner${bad ? ' err' : a.state === 'needs-attention' ? ' warn' : ''}`}>
          <div><span className={`ac-pill ${bad ? 'err' : a.state === 'needs-attention' ? 'warn' : ''}`}>{adoptionTitle}</span></div>
          {adoptionDetails}
        </div>
      ))}
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
  const [cancelBusy, setCancelBusy] = useState(false)
  const cancellation = useRef({ version: 0, pending: false })
  const [copyRequest, setCopyRequest] = useState<{ runId: string; id: number }>()
  const [confirmation, setConfirmation] = useState<{ method: string; extra: Record<string, unknown> }>()
  const confirmationBox = useRef<HTMLDivElement>(null)
  const activeId = useRef(runId)
  activeId.current = runId
  const mounted = useRef(true)
  const reads = useRef<{ version: number; pending: boolean; controller?: AbortController }>({ version: 0, pending: false })
  const action = useRef({ version: 0, pending: false })
  const [device, setDevice] = useState<PreviewDevice>('adaptive')
  const [layout, setLayout] = useState<'side' | Label>('side')
  // Narrowing down is a view of this card only; the record keeps every candidate.
  const [excluded, setExcluded] = useState<ReadonlySet<Label>>(new Set())
  useEffect(() => { setExcluded(new Set()); setLayout('side') }, [runId])
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
      if (!next || next.runId !== runId) throw new Error(t("收到的记录与当前比较不一致，请刷新后重试"))
      publish(next, runId); setReadErr(undefined)
    } catch (error) { if (current()) setReadErr((error as Error).message) }
    finally { if (version === reads.current.version) reads.current.pending = false }
  }, [runId, publish])
  useEffect(() => {
    if (!confirmation) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
    confirmationBox.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [confirmation])
  useEffect(() => {
    mounted.current = true
    action.current.version++; action.current.pending = false
    cancellation.current.version++; cancellation.current.pending = false; setCancelBusy(false)
    setBusy(false); setCopyBusy(false); setCopyRequest(undefined); setConfirmation(undefined); setPending(undefined); setErr(undefined); setReadErr(undefined); setPreflight(undefined)
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
  const failure = (error: Error, method: string, extra: Record<string, unknown>): void => {
    if ((error as Error & { code?: string }).code === 'other-session-confirmation') { setConfirmation({ method, extra }); setErr(undefined) }
    else setErr(error.message)
  }
  const act: Act = (method, extra = {}) => {
    if (confirmation && extra.confirmOtherSession !== true) return
    if (method === 'cancelAdoption') {
      if (!run || run.runId !== runId || !run.control?.canCancelAdoption || run.control.allowed === false || cancellation.current.pending) return
      const version = ++cancellation.current.version, targetId = runId
      cancellation.current.pending = true; setCancelBusy(true); setErr(undefined)
      const current = (): boolean => mounted.current && activeId.current === targetId && cancellation.current.version === version
      call<Run>('cancelAdoption', { runId, sessionId, ...extra }).then(next => { if (current()) publish(next, targetId) }, error => { if (current()) failure(error as Error, method, extra) })
        .finally(() => { if (current()) { cancellation.current.pending = false; setCancelBusy(false); void refresh(true) } })
      return
    }
    if (!run || run.runId !== runId || action.current.pending || copyBusy) return
    if (run?.control?.allowed === false) { setErr(run.control.reason ?? t("当前仅可查看这次比较")); return }
    if (method === 'cleanup' || method === 'reviewCopyCleanup') {
      if (!REVEALED.has(run.state) && run.choice === undefined) { setErr(t("请先结束选择，再查看副本清单；尚未删除任何内容。")); return }
      setCopyRequest(previous => ({ runId, id: (previous?.id ?? 0) + 1 }))
      return
    }
    const version = ++action.current.version, targetId = runId
    action.current.pending = true
    reads.current.version++; reads.current.controller?.abort()
    const current = (): boolean => mounted.current && activeId.current === targetId && action.current.version === version
    const failed = (error: Error): void => { if (current()) failure(error, method, extra) }
    const finished = (): void => { if (current()) { action.current.pending = false; setBusy(false); setPending(undefined); void refresh(true) } }
    setBusy(true)
    setPending(method)
    setErr(undefined)
    if (method === 'reviewAdoption') {
      call<NonNullable<typeof preflight>>('preflight', { runId, sessionId, ...extra }).then(value => { if (current()) setPreflight(value.protectedWorktreeApply === true ? value : { ...value, ok: false, reasons: [t("插件服务尚未启用文件交接保护。请重启 DSH 后重新审查；也可以先另存为分支。")] }) }, failed).finally(finished)
      return
    }
    if (method === 'rerun') {
      // A new comparison through the composer command, so its card appears in this conversation.
      const owner = sessionId, source = run
      void (async () => {
        if (!owner || source.sessionId !== owner) throw new Error(t("只能在发起这次比较的对话里重新比较。"))
        const mode = modeFor(owner)
        if (!mode.loaded) await loadMode(owner)
        if (!mode.loaded) throw new Error(mode.error ?? t("比较设置尚未读取，请稍后重试"))
        const minutes = typeof extra.minutes === 'number' && BUDGET_OPTIONS.includes(extra.minutes) ? extra.minutes : mode.preferences.generationMinutes
        if (minutes !== mode.preferences.generationMinutes) saveMode(owner, { ...mode.preferences, generationMinutes: minutes })
        // An example repeat uses the example task that matches the repository it creates.
        const result = await executeComparison(owner, source.example === true ? '' : source.task, source.example === true)
        if (result.kind === 'error') throw new Error(result.text ?? t("重新比较未能开始"))
        if (openSession?.sessionId === owner) setOpen(undefined)
      })().catch(failed).finally(finished)
      return
    }
    // Saying why a version won leaves an open adoption review as it is.
    if (method !== 'explain') setPreflight(undefined)
    call<Run | null>(method, { runId, sessionId, ...extra })
      .then((r) => { if (current() && r && typeof r === 'object' && 'runId' in r) publish(r, targetId) }, failed)
      .finally(finished)
  }
  if (run === undefined || run.runId !== runId) return <div className={compact ? 'ac-inline-note' : 'ac-empty'}>{err ?? readErr ?? t("正在读取这次比较…")}</div>
  const operationBlocked = busy || copyBusy || run.control?.allowed === false
  const blocked = operationBlocked || confirmation !== undefined
  const confirmationLabel = confirmation?.method === 'choose'
    ? confirmation.extra.pick === 'none' ? t("都不采用并揭晓") : t("选择 {0} 并揭晓", { 0: LABELS.find(label => label === confirmation.extra.pick) ?? '' })
    : confirmation?.method === 'adopt' ? confirmation.extra.mode === 'branch' ? t("另存 {0} 为分支", { 0: run.choice?.pick ?? '' }) : t("采用候选 {0}", { 0: run.choice?.pick ?? '' }) : undefined
  // An open comparison shows every identity from the start.
  const revealed = REVEALED.has(run.state) || run.choice !== undefined || run.blind === false
  const judging = run.state === 'judging'
  const shown = run.candidates.filter(c => !excluded.has(c.label))
  // Narrowing down is offered while choosing among three or four; at least two stay in view.
  const canExclude = judging && run.candidates.length > 2 && shown.length > 2
  const exclude = (label: Label): void => { setExcluded(previous => new Set([...previous, label])); if (layout === label) setLayout('side') }
  const restore = (label: Label): void => setExcluded(previous => { const next = new Set(previous); next.delete(label); return next })
  const keyboard = (event: React.KeyboardEvent): void => {
    // Digits focus a version, 0 shows them all; typing in a field is never taken over.
    if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented || event.nativeEvent.isComposing || !/^[0-4]$/.test(event.key)) return
    const target = event.target as HTMLElement
    if (target.isContentEditable || target.closest('input, textarea, select, [role="textbox"]')) return
    const index = Number(event.key)
    if (index === 0) { setLayout('side'); event.preventDefault(); return }
    const candidate = run.candidates[index - 1]
    if (candidate && !excluded.has(candidate.label)) { setLayout(candidate.label); event.preventDefault() }
  }
  const continueConversation = sessionId ? (): void => {
    if (!leaveMode(sessionId)) { setErr(t("消息正在提交，请等它结束后继续对话。")); return }
    const mode = modeFor(sessionId)
    mode.dismissedRunId = runId
    saveMode(sessionId, { ...mode.preferences, enabled: false })
    returnToComposer(sessionId)
  } : undefined
  const previewHosts = run.candidates.filter(c => c.previewUrl).map(c => { try { return new URL(c.previewUrl!).hostname } catch { return '' } })
  const savedOnly = run.candidates.some(c => !c.previewUrl && (c.hasScreenshot || c.hasMobileScreenshot))
  const contentOnly = previewHosts.length === 0 && !savedOnly && run.candidates.every(c => c.result === 'answer' || c.result === 'files')
  const previewHint = previewHosts.length === run.candidates.length && previewHosts.length > 0
    ? device === 'adaptive' ? t("直接在对话中操作真实页面") : t("相同视口 · 按可用宽度缩放")
    : previewHosts.length > 0
      ? savedOnly ? t("实时预览与验收截图 · 查看各候选状态") : t("部分候选可交互 · 查看各候选状态")
      : savedOnly ? t("验收截图 · 静态记录，不可交互") : contentOnly ? t("按内容比较 · 没有实时页面") : t("预览尚不可用 · 查看各候选状态")
  const independentHosts = previewHosts.length > 0 && previewHosts.every(host => /^ac-[0-9a-f]{32}\.localhost$/.test(host)) && new Set(previewHosts).size === previewHosts.length
  const body = (
    <>
      {(err || readErr) && <div className="ac-error" role="alert" style={{ marginTop: 12 }}><Diagnostic text={err ?? readErr} /></div>}
      {confirmation && <div ref={confirmationBox} tabIndex={-1} className="ac-review" role="region" aria-label={t("跨对话操作确认")} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setConfirmation(undefined) } }}><div><b>{t("这次比较来自另一个对话")}</b><p>{t("请确认要操作的项目：")}{run.baseline.repoRoot ?? t("记录中未提供项目路径")}</p><p>{t("运行编号：")}<code>{runId}</code>{t(" · 将执行：")}{confirmationLabel ?? ({ choose: t("选择并揭晓"), reviewAdoption: t("审查采用"), adopt: t("采用候选"), revert: t("撤销采用"), recover: t("恢复文件"), cancel: t("停止比较"), cancelAdoption: t("停止采用预演"), salvage: t("验收已有改动"), retryVerification: t("重新验收"), reopenPreview: t("重新打开预览") } as Record<string, string>)[confirmation.method] ?? t("更新这次比较")}</p><p>{t("确认仅适用于这一次操作，仍会重新核验项目、候选与归属。")}</p></div><div className="ac-row"><button className="ac-btn" onClick={() => setConfirmation(undefined)}>{t("取消操作")}</button><button className="ac-btn primary" disabled={cancelBusy || (confirmation.method === 'cancelAdoption' ? run.control?.allowed === false : operationBlocked)} onClick={() => { const next = confirmation; setConfirmation(undefined); act(next.method, { ...next.extra, confirmOtherSession: true }) }}>{t("确认本次操作")}</button></div></div>}
      <div className="ac-action-dock"><ActionBar run={run} {...(sessionId ? { sessionId } : {})} busy={busy || copyBusy || !!confirmation} pending={confirmation ? 'confirmation' : cancelBusy ? 'cancelAdoption' : pending} act={act} excluded={judging ? excluded : new Set()} {...(onDone ? { onDone } : {})} {...(continueConversation ? { onContinue: continueConversation } : {})} /></div>
      {!!run.leftovers?.length && <section className="ac-banner warn" role="status" aria-label={t("资源清理状态")}><div><b>{run.state === 'adopted' ? t("采用已完成，仍有资源等待清理") : t("仍有资源等待清理")}</b><p>{t("可以重试清理。清理只处理本次比较拥有的资源。")}</p><ul>{run.leftovers.map((detail, index) => <li key={index}>{detail}</li>)}</ul><button className="ac-btn" disabled={blocked} onClick={() => act('cleanup')}>{t("重试清理")}</button></div></section>}
      {preflight && <section className="ac-review" aria-label={t("采用前审查")} role="region"><div><b>{preflight.ok ? t("目标核验通过，请确认采用") : t("当前无法采用")}</b><p className="ac-project-path">{t("目标：")}{run.baseline.repoRoot ?? t("本次比较的项目")}</p><p>{preflight.ok ? preflight.rehearsal ? t("项目有新改动，将先合并到临时副本中重新验收。") : t("将写入选中版本；不自动提交，保留暂存状态。") : preflight.reasons.join('；')}</p>{preflight.ok && <p>{t("先保留原始文件，再交接候选。交接时出现新编辑会停止并保留双方内容；请等操作完成后再继续编辑涉及的文件。")}</p>}{preflight.overlapping?.length ? <code>{preflight.overlapping.join('、')}</code> : null}</div><div className="ac-row"><button className="ac-btn" onClick={() => setPreflight(undefined)}>{t("返回审查")}</button><button className="ac-btn primary" disabled={blocked || !preflight.ok} onClick={() => act('adopt', { mode: 'worktree' })}>{t("确认采用 ")}{run.choice?.pick}</button></div></section>}
      <Banners run={run} />
      <div className="ac-compare-tools"><div className="ac-seg" role="group" aria-label={t("比较布局")} title={t("在卡片里按 1–{0} 专注某一版，按 0 回到全部", { 0: run.candidates.length })}>{(['side', ...run.candidates.filter(c => !excluded.has(c.label) || !judging).map(c => c.label)] as const).map((v) => { const text = v === 'side' ? (run.candidates.length > 2 ? t("全部并排") : t("并排比较")) : t("专注 {0}", { 0: v }); return <button key={v} className={layout === v ? 'on' : ''} aria-pressed={layout === v} data-text={text} onClick={() => setLayout(v)}>{text}</button> })}</div>{!contentOnly && <div className="ac-seg" aria-label={t("预览尺寸")}>{([['adaptive', t("适应窗口")], ['desktop', t("桌面 1280")], ['phone', t("手机 390")]] as const).map(([value, text]) => <button key={value} className={device === value ? 'on' : ''} aria-pressed={device === value} data-text={text} onClick={() => setDevice(value)}>{text}</button>)}</div>}<span className="ac-meta">{previewHint}</span></div>
      {previewHosts.length > 0 && <details className="ac-preview-limits"><summary>{t("预览环境与限制")}</summary><p>{independentHosts ? t("候选使用独立本地地址，避免同名 Cookie 相互影响。") : t("这条旧记录的预览没有独立本地域名，两个端口的 Cookie 可能相互影响；建议使用当前版本重新开始比较。")}{t("嵌入页面仍受浏览器的 Cookie 与存储策略限制；登录、外部后端和共享数据库暂不在支持范围内。重新启动预览会更换浏览器地址，页面内临时数据不保留；比较记录和验收截图仍保留。外部标签页可能使用不同的存储上下文。")}</p></details>}
      <div className={`ac-grid count-${layout === 'side' ? (judging ? shown.length : run.candidates.length) : 1}${layout !== 'side' ? ' focus' : ''}`} data-state={run.state} onKeyDown={keyboard}>
        {run.candidates.map((c) => judging && excluded.has(c.label)
          ? (layout === 'side' ? <ExcludedCard key={c.label} c={c} onRestore={() => restore(c.label)} /> : null)
          : <CandidateCard key={c.label} run={run} c={c} revealed={revealed} picked={revealed && run.choice?.pick === c.label} busy={blocked} act={act} device={device} compact={compact === true} hidden={layout !== 'side' && layout !== c.label} dense={layout === 'side' && (judging ? shown.length : run.candidates.length) > 2} {...(canExclude ? { onExclude: () => exclude(c.label) } : {})} />)}
      </div>
      {run.choice !== undefined && run.choice.pick !== 'none' && run.control?.allowed !== false && run.state !== 'recovery' && <PickReasons key={`${runId}:${run.choice.pick}`} run={run} busy={blocked} act={act} />}
      {/* Secondary facts follow the applications: what went in from the main conversation and whether the result came back. */}
      <ConversationLink run={run} />
      <Banners run={run} recordOnly />
      {revealed && <CopySpace key={runId} run={run} sessionId={sessionId} blocked={busy || !!confirmation || run.control?.allowed === false} requestKey={copyRequest?.runId === runId ? copyRequest.id : 0} publish={next => publish(next, runId)} onReleaseBusy={value => { if (activeId.current === runId) setCopyBusy(value) }} />}
    </>
  )
  if (!compact) return body
  return (
    <div lang={currentLocale()} className="ac-root ac-inline" data-state={run.state} aria-label={t("A|B 比较 {0}", { 0: run.runId })}>
      <Styles />
      <div className="ac-inline-head">
        <span className="ac-logo">A|B</span>
        <span className="ac-task" title={run.task}>{run.task}</span>
        <span className={`ac-pill ${run.state === 'adopted' ? 'ok' : ACTIVE.has(run.state) ? 'brand' : ''}`}>{t(STATE_TEXT[run.state]) ?? run.state}</span>
        {onExpand && <button className="ac-btn sm" onClick={onExpand}>{t("大窗口查看")}</button>}
        {onCollapse && <button className="ac-text-btn" onClick={onCollapse}>{t("收起结果")}</button>}
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
  if (task.startsWith('@ui ')) { try { task = (JSON.parse(task.slice(4)) as { task?: string }).task ?? t("示例任务") } catch { task = '' } }
  if (node.outcome === null) return <div lang={currentLocale()} className="ac-root ac-inline"><Styles /><div className="ac-inline-note"><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{t("正在准备 A|B 比较：")}{task.slice(0, 400)}</div></div>
  if (node.outcome.kind !== 'success' || runId === undefined) {
    return <div lang={currentLocale()} className="ac-root ac-inline"><Styles /><div className="ac-fail" style={{ height: 'auto' }}><b>{t("A|B 比较没有开始")}</b><Diagnostic text={node.outcome.text ?? ''} /></div></div>
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
  if (found === undefined) return <div lang={currentLocale()} className="ac-root ac-inline"><Styles /><div className="ac-inline-note">{props.phase === 'result' ? t("A|B 比较未取得运行编号，请查看此工具的返回结果。") : <><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{t("正在准备 A|B 比较…")}</>}</div></div>
  const sid = props.sessionId
  if (!sid) return <RunView key={found} runId={found} compact />
  return <div lang={currentLocale()} className="ac-root ac-inline ac-tool-summary" aria-label={t("A|B 工具记录 {0}", { 0: found })}><Styles /><div className="ac-inline-note">{t("本次比较 · ")}{found}{t("。进度、预览和采用记录持续保留。")}<button className="ac-text-btn" onClick={() => setOpen(sid, found)}>{t("查看本次比较")}</button></div></div>
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
    if (!applied) { mode.error = clientSupportMessage(sessionId) ?? t("输入框正在提交或已有其他命令模式，请等它结束后再切换。"); publishMode(mode); return }
    mode.collapsed = false
    saveMode(sessionId, { ...mode.preferences, enabled: !enabled }); inputShell(sessionId)?.focus?.()
  }
  return <><Styles /><button className={`ac-mode-btn${enabled ? ' on' : ''}`} onClick={toggle} disabled={!mode.loaded || mode.loading || !!capabilityError} aria-pressed={enabled} title={capabilityError ?? (enabled ? t("A|B 对比模式已开启，点此退出") : t("开启 A|B 对比模式，在主对话里同时运行 2–4 版"))} aria-label={t("A|B 对比模式")}>A|B</button></>
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
    <section ref={region} className="ac-history" aria-label={t("比较记录列表")} aria-busy={busy} tabIndex={-1}>
      <div className="ac-history-controls">
        <label>{t("记录范围")}<select aria-label={t("记录范围")} value={scope} disabled={outdated} onChange={event => onScope(event.target.value as 'all' | 'session')}><option value="all">{t("全部对话")}</option><option value="session">{t("当前对话")}</option></select></label>
        <form className="ac-history-search" role="search" onSubmit={event => { event.preventDefault(); onSearch(draft) }}>
          <label>{t("查找记录")}<input type="search" aria-label={t("搜索比较记录")} placeholder={t("需求、项目或运行编号")} maxLength={200} value={draft} disabled={outdated} onChange={event => setDraft(event.target.value)} /></label>
          <button className="ac-btn" type="submit" disabled={outdated}>{t("搜索")}</button>
          {(query || draft) && <button className="ac-text-btn" type="button" disabled={outdated} onClick={() => { setDraft(''); onSearch('') }}>{t("清空搜索")}</button>}
        </form>
      </div>
      {problemSupported && <label className="ac-history-issue-filter"><input type="checkbox" role="switch" checked={onlyUnavailable} onChange={event => onUnavailable(event.target.checked)} />{t("只看需处理")}</label>}
      <div className="ac-history-status" role="status">{busy ? <><span className="ac-spin" />{t("正在读取记录…")}</> : failed ? t("记录读取失败，原始文件仍保留。") : meta ? t("{0} · {1} 条{2}", { 0: scope === 'all' ? t("全部对话") : t("当前对话"), 1: meta.total, 2: meta.query ? t(" · 搜索“{0}”", { 0: meta.query }) : '' }) : t("已读取当前服务端提供的记录")}</div>
      {outdated && <div className="ac-feedback" role="alert">{t("服务端尚未更新。请重启 DSH 后使用全部对话、搜索与翻页；以下仍是旧服务端返回的记录。")}</div>}
      {!!meta?.unavailable && <div className="ac-feedback" role="alert">{t("有 ")}{meta.unavailable}{t(" 条记录无法安全载入。这些记录保持只读，原始文件已保留；可打开“只看需处理”查看原因。")}</div>}
      {!busy && !failed && rows.length === 0 && <div className="ac-empty">{query ? t("没有匹配的记录。换个关键词，或清空搜索查看已有比较。") : onlyUnavailable ? t("没有需处理的记录。取消筛选可以查看其它比较。") : scope === 'session' ? t("当前对话还没有比较。切换到“全部对话”可以查看以前的结果。") : t("还没有比较记录。点输入框左下角的 A|B，在主对话里开始第一次真实比较。")}</div>}
      {rows.map(r => 'legacy' in r ? (
        <div key={r.runId} className={`ac-hrow legacy${r.unavailable ? ' ac-hrow-unavailable' : ''}`} title={r.unavailable ? t("无法安全载入，原始记录保留") : t("旧版本记录只读，原始文件保留")}>
          <span className="ac-pill">{r.unavailable ? t("需处理") : t("旧版")}</span>
          <span className="ac-hrow-copy"><span className="t">{r.task}</span><span className="ac-meta">{r.runId}{t(" · 只读")}</span>{r.reason && <span className="ac-history-problem"><Diagnostic text={r.reason} /></span>}</span>
          <span className="ac-meta">{r.createdAt > 0 ? when(r.createdAt) : t("时间未知")}</span>
        </div>
      ) : (
        <button key={r.runId} className="ac-hrow" onClick={() => open(r)}>
          <span className={`ac-pill ${r.state === 'adopted' ? 'ok' : ACTIVE.has(r.state) ? 'brand' : ''}`}>{t(STATE_TEXT[r.state]) ?? r.state}</span>
          <span className="ac-hrow-copy"><span className="t" title={r.task}>{r.task}</span><span className="ac-meta" title={r.baseline.repoRoot}>{r.baseline.repoRoot?.split(/[\\/]/).filter(Boolean).at(-1) ?? t("项目未知")} · {r.runId}{r.choice?.reasons?.length ? <span className="ac-hrow-why">{t(" · 因为")}{PICK_REASONS.filter(reason => r.choice!.reasons!.includes(reason.id)).slice(0, 3).map(reason => t(reason.name)).join(t("、"))}</span> : null}</span></span>
          <span className="ac-meta">{r.choice?.pick && r.choice.pick !== 'none' ? t("选了 {0} · ", { 0: r.choice.pick }) : ''}{when(r.createdAt)}</span>
        </button>
      ))}
      {meta && meta.total > 0 && <nav className="ac-history-pages" aria-label={t("记录翻页")}><span>{meta.offset + 1}–{Math.min(meta.offset + meta.limit, meta.total)} / {meta.total}{t(" 条")}</span><div className="ac-row"><button className="ac-btn" disabled={busy || meta.offset === 0} onClick={() => { region.current?.focus(); region.current?.scrollIntoView({ block: 'start' }); onPage(Math.max(0, meta.offset - meta.limit)) }}>{t("上一页")}</button><button className="ac-btn" disabled={busy || !meta.hasNext} onClick={() => { region.current?.focus(); region.current?.scrollIntoView({ block: 'start' }); onPage(meta.offset + meta.limit) }}>{t("下一页")}</button></div></nav>}
    </section>
  )
}
function Guide({ sessionId }: { sessionId: string }): React.ReactElement {
  const mode = useAbMode(sessionId)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const example = async (): Promise<void> => {
    setBusy(true); setError(undefined)
    try { const result = await executeComparison(sessionId, '', true); if (result.kind === 'success') setOpen(undefined); else setError(result.text ?? t("示例未能开始")) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="ac-guide">
    <div><span className="ac-eyebrow">{t("从比较到交付")}</span><h2 className="ac-h1">{t("体验真实结果，做出开发决策。")}</h2><p className="ac-lead">{t("适合存在多种可行方案的界面、布局与交互任务。已有明确答案的小修复通常用一个 Agent 更直接。")}</p></div>
    <ol className="ac-guide-steps">
      <li><b>{t("在主对话里开启 A|B")}</b><p>{t("点输入框左下角的 A|B，上方即出现设置条。直接选择比较方式、模型和每版时长；在原输入框里写需求并发送，不用填写参数。")}</p></li>
      <li><b>{t("体验各版")}</b><p>{t("独立生成后运行安装、检查与构建。桌面和手机预览使用统一尺寸，可以并排观察、逐个排除，或专注体验其中一版。")}</p></li>
      <li><b>{t("选择并审查")}</b><p>{t("选择后揭晓模型和策略。查看代码改动、程序检查与未验证的部分；一次偏好选择不代表模型的整体排名。")}</p></li>
      <li><b>{t("采用结果")}</b><p>{t("采用前检查目标是否变化；必要时在临时副本中预演。工作区采用不自动提交；另存分支会明确创建一个提交。")}</p></li>
    </ol>
    <div className="ac-case"><div><b>{t("试跑真实的示例商店")}</b><span>{t("新建独立仓库，不修改当前项目。基础示例实现搜索与清空；完整示例再加入组合筛选和手机适配。使用当前比较与时长设置，各版分别消耗用量；任务、结果和选择保留在主对话。")}</span><label className="ac-budget">{t("示例范围 ")}<select aria-label={t("内置示例范围")} disabled={busy || !mode.loaded} value={mode.preferences.exampleKind ?? 'quick'} onChange={e => saveMode(sessionId, { ...mode.preferences, exampleKind: e.target.value as 'quick' | 'full' })}><option value="quick">{t("基础 · 搜索与清空")}</option><option value="full">{t("完整 · 组合筛选与手机适配")}</option></select></label></div><button className="ac-btn primary" disabled={busy || !mode.loaded} onClick={() => { void example() }}>{busy ? t("正在创建…") : t("试跑内置示例")}</button></div>
    {error && <div className="ac-feedback" role="alert"><Diagnostic text={error} /></div>}
    {(mode.preferences.exampleKind ?? 'quick') === 'quick' && <ExampleTimingEvidence />}
    <button className="ac-btn" onClick={() => { mode.collapsed = false; if (enterMode(sessionId)) saveMode(sessionId, { ...modeFor(sessionId).preferences, enabled: true }); returnToComposer(sessionId) }}>{t("回到输入框，开启 A|B")}</button><div className="ac-note">{t("支持范围：仓库根目录中的本地 Vite 前端。页面检查通过只代表配置的步骤通过，仍需实际体验需求和边界情况。")}</div>
  </div>
}
/** History, guidance, and expanded inspection share the same persisted records. */
function Sheet({ sessionId, runId, tab, trigger }: { sessionId: string; runId?: string; tab?: Tab; trigger?: HTMLElement }): React.ReactElement {
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
  const sheet = useRef<HTMLDialogElement>(null)
  const backdropPointer = useRef(false)
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
  useLayoutEffect(() => {
    // Safari does not necessarily focus a button when it is clicked.
    const previous = trigger ?? document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const element = sheet.current
    if (!element) return
    if (typeof element.showModal === 'function' && !element.open) {
      try { element.showModal() }
      catch { setErr(t("比较窗口暂时无法进入前景层。请关闭其他弹窗后重新打开。")) }
    }
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
      if (element.open) element.close()
      const composer = focusComposerOnClose
      focusComposerOnClose = undefined
      if (composer) inputShell(composer)?.focus?.()
      else if (previous?.isConnected && previous !== document.body && previous !== document.documentElement) previous.focus()
      else (document.querySelector<HTMLElement>('[data-ac-history]') ?? document.querySelector<HTMLElement>('.ac-mode-btn:not(:disabled)'))?.focus()
    }
  }, [])
  const current = list?.runs.find((r) => r.runId === selected)
  const navigate = (next: Tab): void => { setView(next); setSelected(undefined); if (next === 'history') void refreshList() }
  return (
    <div lang={currentLocale()} className="ac-root">
      <Styles /><div className="ac-mask" onClick={() => setOpen(undefined)} />
      <dialog ref={sheet} className="ac-sheet" role="dialog" aria-modal="true" aria-label="AgentCompare" tabIndex={-1}
        onCancel={event => { event.preventDefault(); setOpen(undefined) }}
        onPointerDown={event => {
          const r = event.currentTarget.getBoundingClientRect()
          backdropPointer.current = event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)
        }}
        onClick={event => {
          const r = event.currentTarget.getBoundingClientRect()
          const outside = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom
          if (backdropPointer.current && event.target === event.currentTarget && outside) setOpen(undefined)
          backdropPointer.current = false
        }}>
        <header className="ac-head"><span className="ac-logo">A|B</span><span className="ac-title">AgentCompare</span><span className="ac-header-caption">{t("跑过再选")}</span><span className="ac-spacer" /><LanguageControl compact />
          <nav className="ac-tabs" aria-label={t("比较工作区")}>{(['history', 'guide'] as const).map((item) => { const text = { history: t("历史记录"), guide: t("使用教程") }[item]; return <button key={item} className={`ac-tab${view === item && !selected ? ' on' : ''}`} aria-current={view === item && !selected ? 'page' : undefined} data-text={text} onClick={() => navigate(item)}>{text}</button> })}</nav>
          <button className="ac-icon-btn" onClick={() => setOpen(undefined)} aria-label={t("关闭（Esc）")} title={t("关闭（Esc）")}><IconClose /></button>
        </header>
        {err && <div className="ac-error" role="alert"><Diagnostic text={err} /><button className="ac-text-btn" onClick={() => { void refreshList() }}>{t("重试")}</button></div>}
        <div className="ac-body">{selected ? <>
          <div className="ac-run-heading"><button className="ac-text-btn" onClick={() => navigate('history')}>{t("← 比较记录")}</button><span className="ac-task" title={current?.task}>{current?.task ?? t("比较结果")}</span><span className="ac-meta">{selected}</span></div>
          <RunView key={selected} runId={selected} sessionId={sessionId} {...(current ? { initial: current } : {})} onDone={() => navigate('history')} />
        </> : view === 'guide' ? <Guide sessionId={sessionId} /> : <History data={list} open={(r) => setSelected(r.runId)} busy={historyBusy} failed={err} scope={historyScope} query={historyQuery} onScope={scope => { setHistoryScope(scope); setHistoryOffset(0) }} onSearch={query => { const trimmed = query.trim(); if (trimmed === historyQuery && historyOffset === 0) void refreshList(); else { setHistoryQuery(trimmed); setHistoryOffset(0) } }} onPage={setHistoryOffset} onlyUnavailable={onlyUnavailable} problemSupported={problemSupported} onUnavailable={only => { setOnlyUnavailable(only); setHistoryOffset(0) }} />}</div>
      </dialog>
    </div>
  )
}
function HeaderButton({ sessionId }: { sessionId: string }): React.ReactElement {
  return (
    <div lang={currentLocale()} className="ac-root ac-header-tools" role="group" aria-label={t("AgentCompare 导航")}>
      <Styles />
      <LanguageControl compact />
      <button data-ac-history="true" className="ac-header-btn" title={t("AgentCompare：比较记录")} aria-label={t("打开 AgentCompare 比较记录")} onClick={event => setOpen(sessionId, undefined, undefined, event.currentTarget)}><span className="ac-header-label">{t("比较记录")}</span><svg className="ac-header-glyph" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 3v4h4M2.2 6A6 6 0 1 1 2 10M8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
      <button className="ac-header-btn" title={t("AgentCompare：使用教程")} aria-label={t("打开 AgentCompare 使用教程")} onClick={event => setOpen(sessionId, undefined, 'guide', event.currentTarget)}><span className="ac-header-label">{t("使用教程")}</span><svg className="ac-header-glyph" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 6a1.5 1.5 0 1 1 2 1.4c-.5.2-.5.6-.5 1.1M8 11h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg></button>
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
  return open === undefined ? null : <Sheet key={open.sessionId} sessionId={open.sessionId} {...(open.runId ? { runId: open.runId } : {})} {...(open.tab ? { tab: open.tab } : {})} {...(open.trigger ? { trigger: open.trigger } : {})} />
}
/**
 * DSH 0.2.1 treats any client entry that fails to activate as a fatal web
 * boot (the desktop app then disables every third-party plugin). So nothing
 * here may throw: a slot that cannot be registered only loses that surface.
 */
function localized(Component: React.ComponentType<any>): React.ComponentType<any> {
  return function LocalizedRoot(props: any): React.ReactElement {
    useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot)
    return <Component {...props} />
  }
}
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
  }, localized(HeaderButton))))
  safely('new conversation navigation', () => ctx.slots.inject('conversation.hero.options', () => ctx.slots.register({
    name: 'conversation.hero.options', id: 'agent-compare-navigation', order: 30, registrant: 'dsh-agent-compare', inject: withSession,
  }, localized(HeroHeader))))
  safely('composer A|B button', () => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left', id: 'agent-compare', order: 50, registrant: 'dsh-agent-compare', inject: withSession,
  }, localized(AbModeButton))))
  safely('composer settings', () => ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock', id: 'agent-compare-settings', order: 10, registrant: 'dsh-agent-compare', inject: withSession,
  }, localized(ComposerDock))))
  safely('/ab command view', () => ctx.slots.inject('conversation.chat.commandview', () => ctx.slots.register({
    name: 'conversation.chat.commandview', key: 'ab', registrant: 'dsh-agent-compare', inject: withSession,
  }, localized(CommandView))))
  safely('tool view', () => ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
    name: 'tool.call.toolview', key: 'agent_compare_start', registrant: 'dsh-agent-compare', inject: withSession,
  }, localized(ToolView))))
  safely('overlay', () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'agent-compare', order: 30, registrant: 'dsh-agent-compare', inject: () => ({}),
  }, localized(Overlay))))
  try {
    ctx.effect?.(() => () => { for (const d of disposers.reverse()) d() })
  } catch (error) {
    console.warn('[dsh-agent-compare] cleanup hook unavailable:', error)
  }
}

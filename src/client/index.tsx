/**
 * Client half: a header button opens a modal sheet with the two live
 * candidates side by side. Labels stay A/B until the user has chosen.
 *
 * HTTP goes through the page base (`document.baseURI`): in the desktop shell
 * the page is `dsh-app://app/` and the shell forwards plugin paths to the Host
 * same-origin; a root-absolute or Host-origin URL would break there.
 *
 * Colours, radii and shadows come from DSH's own `--dsw-*` tokens (with
 * fallbacks for other hosts), so the sheet follows the active theme.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'

export const name = 'agent-compare-client'
export const inject = ['slots']

interface SlotsLike {
  inject(name: string, cb: () => () => void): () => void
  register(spec: Record<string, unknown>, component: React.ComponentType<any>): () => void
}
interface ClientCtx { slots: SlotsLike; effect?(fn: () => () => void): void }

type Stage = 'queued' | 'preparing' | 'generating' | 'sealing' | 'installing' | 'verifying' | 'previewing' | 'ready' | 'failed' | 'stopping' | 'cancelled' | 'interrupted'
interface Check { name: string; outcome: 'passed' | 'failed' | 'skipped' | 'timeout'; reason?: string; durationMs: number; steps?: Array<{ label: string; ok: boolean; detail?: string }> }
interface Route { provider?: string; model?: string }
interface Cand {
  label: 'A' | 'B'
  stage: Stage
  previewUrl?: string
  previewKind?: 'build' | 'dev'
  checks?: Check[]
  patchStats?: { files: number; insertions: number; deletions: number; binary: number }
  timings: Partial<Record<Stage, { startedAt: number; endedAt?: number }>>
  error?: { stage: Stage; message: string }
  verdict?: { eligible: boolean; reasons: string[]; warnings: string[] }
  usage?: { kind: 'reported'; totalTokens?: number; inputTokens?: number; outputTokens?: number } | { kind: 'unknown'; reason: string }
  hasScreenshot?: boolean
  hasMobileScreenshot?: boolean
  strategy?: { id: string; title: string }
  route?: Route
  actualRoute?: Route
  summary?: string
}
interface Adoption { state: string; mode: string; message?: string; branch?: string; attention?: string[]; rehearsed?: boolean; rehearsalChecks?: Check[] }
interface Run {
  runId: string
  task: string
  state: string
  mode: 'same-model' | 'cross-model'
  isolation: 'own-root' | 'shared-root'
  createdAt: number
  follows?: string
  baseline: { dirty: boolean; headCommit?: string }
  acceptance: { source: 'defaults' | 'repository'; checks: string[]; steps: number; frozenInstall: boolean }
  candidates: Cand[]
  choice?: { pick: 'A' | 'B' | 'none' }
  checksFavoured?: 'A' | 'B' | 'tie' | 'none'
  adoption?: Adoption
  outsideChanges?: string[]
  leftovers?: string[]
}
interface Legacy { runId: string; task: string; createdAt: number; state: string; legacy: true }
interface ListResult { runs: Run[]; legacy: Legacy[]; isolation: 'own-root' | 'shared-root' }
interface ModelItem { provider: string; providerName: string; id: string; name: string }

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const url = new URL(`agent-compare/api/${method}`, document.baseURI.replace(/[?#].*$/, '').replace(/[^/]*$/, ''))
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const env = (await res.json()) as { ok: boolean; value?: T; error?: string }
  if (!env.ok) throw new Error(env.error ?? `HTTP ${res.status}`)
  return env.value as T
}

// ---- tiny shared store: which session's sheet is open ----
let openSession: string | undefined
const listeners = new Set<() => void>()
function setOpen(id: string | undefined): void {
  openSession = id
  for (const l of listeners) l()
}
function useOpen(): string | undefined {
  const [, force] = useState(0)
  useEffect(() => {
    const l = (): void => force((n) => n + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  return openSession
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
const STATE_TEXT: Record<string, string> = {
  running: '进行中', judging: '待选择', revealed: '已揭晓', adopting: '采用中', adopted: '已采用', recovery: '需要处理', abandoned: '已结束', interrupted: '已中断',
}
const ACTIVE = new Set(['running', 'judging', 'revealed', 'adopting', 'recovery'])
const LIVE_POLL = new Set(['running', 'adopting'])
const REVEALED = new Set(['revealed', 'adopting', 'adopted', 'recovery'])
const EXAMPLES = [
  '重新设计首页顶部区域，突出主要操作按钮',
  '把设置页改成分组卡片布局，并加上保存成功提示',
]

function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}
function elapsed(c: Cand): number {
  const starts = Object.values(c.timings).map((t) => t?.startedAt ?? Infinity)
  const ends = Object.values(c.timings).map((t) => t?.endedAt ?? Date.now())
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
--ac-fg:var(--dsw-alias-label-primary,#0f1115);--ac-fg2:var(--dsw-alias-label-secondary,#4b5260);--ac-fg3:var(--dsw-alias-label-tertiary,#8a919e);
--ac-border:var(--dsw-alias-border-l2,rgba(15,17,21,.10));--ac-border-strong:var(--dsw-alias-border-l3,rgba(15,17,21,.16));
--ac-brand:var(--dsw-alias-brand-primary,#4d6bfe);--ac-brand-fg:var(--dsw-alias-label-primary-foreground,#fff);
--ac-ok:var(--dsw-alias-state-success-primary,#1a9a5a);--ac-err:var(--dsw-alias-state-error-primary,#e5484d);--ac-warn:var(--dsw-alias-state-warn-primary,#d08700);
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
.ac-shot{flex:1;min-height:0;overflow:auto;display:flex;gap:12px;align-items:flex-start;justify-content:center;padding:12px;background:var(--ac-l1)}
.ac-shot img{max-width:100%;border-radius:8px;border:1px solid var(--ac-border)}
.ac-shot img.m{max-width:34%}
.ac-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ac-fg3);padding:24px;text-align:center}
.ac-skel{width:min(320px,70%);display:flex;flex-direction:column;gap:8px}.ac-skel i{height:10px;border-radius:5px;background:var(--ac-l2);animation:ac-pulse 1.4s ease-in-out infinite}
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;white-space:pre-wrap}
.ac-fail b{display:block;color:var(--ac-err);font-family:var(--dsw-font-family,inherit);margin-bottom:6px}
.ac-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--ac-border);background:var(--ac-bg);flex-wrap:wrap}
.ac-bar-text{flex:1;min-width:200px;color:var(--ac-fg2)}
.ac-bar-text strong{color:var(--ac-fg)}
.ac-banner{flex:none;margin:16px 16px 0;padding:12px 14px;border-radius:var(--ac-r-md);background:var(--ac-l1);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:6px}
.ac-banner.warn{background:color-mix(in srgb,var(--ac-warn) 10%,transparent);border-color:color-mix(in srgb,var(--ac-warn) 30%,transparent)}
.ac-banner.err{background:color-mix(in srgb,var(--ac-err) 8%,transparent);border-color:color-mix(in srgb,var(--ac-err) 25%,transparent)}
.ac-banner code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-banner .disclaimer{color:var(--ac-fg3);font-size:12px}
.ac-next{flex:none;margin:16px;padding:16px;border-radius:var(--ac-r-lg);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:10px}
.ac-next b{font-size:14px}
.ac-link{color:var(--dsw-alias-link,var(--ac-brand));text-decoration:none}.ac-link:hover{text-decoration:underline}
.ac-history{max-width:860px;width:100%;margin:0 auto;padding:20px 24px;display:flex;flex-direction:column;gap:8px}
.ac-hrow{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--ac-r-md);border:1px solid var(--ac-border);background:var(--ac-bg);text-align:left;font:inherit;color:inherit;cursor:pointer}
.ac-hrow:hover{background:var(--ac-hover)}
.ac-hrow.legacy{cursor:default;opacity:.7}
.ac-hrow span.t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ac-header-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 7px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 11px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));color:var(--dsw-alias-label-primary,#0f1115)}
@media (max-width:900px){.ac-grid{grid-template-columns:1fr;height:auto}.ac-card{min-height:460px}.ac-models{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.ac-root *{animation:none!important}}
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
  const kind = c.stage === 'ready' ? 'ok' : c.stage === 'failed' || c.stage === 'interrupted' ? 'err' : busyStage(c.stage) ? 'brand' : ''
  return (
    <span className={`ac-pill ${kind}`}>
      {busyStage(c.stage) ? <span className="ac-spin" /> : <span className="ac-dot" />}
      {STAGE_TEXT[c.stage]}
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
        {v.eligible ? '✓ 通过共同验收，可以采用' : `✕ 未通过共同验收：${v.reasons.join('；')}`}
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

function Screenshots({ runId, c }: { runId: string; c: Cand }): React.ReactElement {
  const [desk, setDesk] = useState<string>()
  const [mob, setMob] = useState<string>()
  useEffect(() => {
    if (c.hasScreenshot) call<{ dataUrl: string }>('shot', { runId, label: c.label }).then((r) => setDesk(r.dataUrl), () => {})
    if (c.hasMobileScreenshot) call<{ dataUrl: string }>('shot', { runId, label: c.label, mobile: true }).then((r) => setMob(r.dataUrl), () => {})
  }, [runId, c.label, c.hasScreenshot, c.hasMobileScreenshot])
  if (!desk && !mob) return <div className="ac-empty">预览已停止</div>
  return (
    <div className="ac-shot">
      {desk && <img src={desk} alt={`候选 ${c.label} 桌面截图`} />}
      {mob && <img className="m" src={mob} alt={`候选 ${c.label} 手机截图`} />}
    </div>
  )
}

function CandidateCard({ run, c, revealed, picked, busy, act }: { run: Run; c: Cand; revealed: boolean; picked: boolean; busy: boolean; act: Act }): React.ReactElement {
  const usage = c.usage === undefined ? '' : c.usage.kind === 'unknown' ? '用量未知' : `${(c.usage.totalTokens ?? 0).toLocaleString()} tokens`
  const live = c.previewUrl !== undefined && !['failed', 'cancelled', 'interrupted'].includes(c.stage)
  const step = busyStage(c.stage) && c.stage !== 'stopping' ? PIPELINE.findIndex((p) => p.stage === c.stage) + 1 : 0
  const model = revealed ? routeText(c.actualRoute ?? c.route) : ''
  return (
    <section className={`ac-card${picked ? ' picked' : ''}`} aria-label={`候选 ${c.label}`}>
      <div className="ac-card-head">
        <div className="ac-row">
          <span className="ac-label">{c.label}</span>
          <StagePill c={c} />
          <span className="ac-meta">{fmt(elapsed(c))}</span>
          {run.state === 'running' && busyStage(c.stage) && c.stage !== 'stopping' && <button className="ac-btn sm" disabled={busy} onClick={() => act('cancel', { label: c.label })}>停止这一版</button>}
          {revealed && c.strategy && <span className="ac-strategy">{c.strategy.title}{model ? ` · ${model}` : ''}</span>}
        </div>
        <Track c={c} />
        {step > 0 && <div className="ac-meta">第 {step}/{PIPELINE.length} 步 · {STAGE_TEXT[c.stage]}</div>}
        <Checks checks={c.checks} />
        <Verdict c={c} />
        {(c.patchStats || usage) && (
          <div className="ac-meta">
            {c.patchStats ? `${c.patchStats.files} 个文件 · +${c.patchStats.insertions} −${c.patchStats.deletions}${c.patchStats.binary ? ` · ${c.patchStats.binary} 个二进制` : ''}` : ''}
            {c.patchStats && usage ? ' · ' : ''}{usage}
          </div>
        )}
        {revealed && c.summary && <div className="ac-summary">{c.summary}</div>}
      </div>
      {live ? (
        <div className="ac-browser">
          <div className="ac-chrome">
            <span className="ac-lights"><i /><i /><i /></span>
            {c.previewKind === 'dev' && <span className="ac-pill warn" title="构建没有通过，这是开发模式，只供观察">开发模式</span>}
            <span className="ac-url" title={c.previewUrl}>{c.previewUrl}</span>
            <a className="ac-icon-btn" href={c.previewUrl} target="_blank" rel="noreferrer" title="在独立浏览器窗口中打开" aria-label={`在浏览器中打开 ${c.label}`}><IconExternal /></a>
          </div>
          <iframe className="ac-frame" title={`候选 ${c.label} 的运行页面`} src={c.previewUrl} />
        </div>
      ) : c.error ? (
        <div className="ac-fail"><b>{STAGE_TEXT[c.error.stage] ?? c.error.stage}阶段失败</b>{c.error.message}</div>
      ) : c.stage === 'ready' ? (
        <Screenshots runId={run.runId} c={c} />
      ) : (
        <div className="ac-empty">
          <div className="ac-skel"><i style={{ width: '60%' }} /><i /><i style={{ width: '80%' }} /></div>
          <div>{c.stage === 'cancelled' ? '已停止' : c.stage === 'stopping' ? '正在停止并回收资源…' : `${STAGE_TEXT[c.stage]}…构建产物启动后，这里会显示真实页面`}</div>
        </div>
      )}
    </section>
  )
}

function ModeAndModels({ sessionId, mode, setMode, pair, setPair }: { sessionId: string; mode: 'same-model' | 'cross-model'; setMode: (m: 'same-model' | 'cross-model') => void; pair: [string, string]; setPair: (p: [string, string]) => void }): React.ReactElement {
  const [models, setModels] = useState<ModelItem[]>()
  const [current, setCurrent] = useState<Route>()
  const [err, setErr] = useState<string>()
  useEffect(() => {
    call<{ current: Route; models: ModelItem[] }>('models', { sessionId }).then((r) => { setModels(r.models); setCurrent(r.current) }, (e: Error) => setErr(e.message))
  }, [sessionId])
  const key = (m: ModelItem): string => `${m.provider}\u0000${m.id}`
  return (
    <>
      <div className="ac-seg" role="tablist" aria-label="比较方式">
        <button className={mode === 'same-model' ? 'on' : ''} onClick={() => setMode('same-model')} role="tab" aria-selected={mode === 'same-model'}>同一模型 · 两种策略</button>
        <button className={mode === 'cross-model' ? 'on' : ''} onClick={() => setMode('cross-model')} role="tab" aria-selected={mode === 'cross-model'}>两个模型 · 同一要求</button>
      </div>
      {mode === 'same-model' ? (
        <div className="ac-meta">两边都用当前对话的模型{current?.model ? `（${routeText(current)}）` : ''}，一边「稳妥」沿用现有写法，一边「大胆」重做交互；揭晓前你看不到哪边是哪种。</div>
      ) : models === undefined ? (
        <div className="ac-meta">{err ? `读取模型列表失败：${err}` : '正在读取已配置的模型…'}</div>
      ) : models.length < 2 ? (
        <div className="ac-meta">至少需要两个已配置的模型。请先在 DSH 的模型设置里添加。</div>
      ) : (
        <div className="ac-models">
          {[0, 1].map((i) => (
            <label key={i}>{i === 0 ? '模型一' : '模型二'}
              <select value={pair[i]} onChange={(e) => { const next: [string, string] = [...pair]; next[i] = e.target.value; setPair(next) }}>
                <option value="">选择模型</option>
                {models.map((m) => <option key={key(m)} value={key(m)}>{m.name} · {m.providerName}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
    </>
  )
}

function Composer({ sessionId, follows, onStarted, compact }: { sessionId: string; follows?: string; onStarted: (r: Run) => void; compact?: boolean }): React.ReactElement {
  const [task, setTask] = useState('')
  const [mode, setMode] = useState<'same-model' | 'cross-model'>('same-model')
  const [pair, setPair] = useState<[string, string]>(['', ''])
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const pairOk = mode === 'same-model' || (pair[0] !== '' && pair[1] !== '' && pair[0] !== pair[1])
  const start = (example = false): void => {
    if (busy || (!example && (task.trim() === '' || !pairOk))) return
    setBusy(true)
    setErr(undefined)
    const models = mode === 'cross-model' ? pair.map((k) => { const [provider, model] = k.split('\u0000'); return { provider, model } }) : undefined
    call<Run>('start', { sessionId, task, mode: example ? 'same-model' : mode, ...(models && !example ? { models } : {}), ...(follows ? { follows } : {}), ...(example ? { example: true } : {}) })
      .then(onStarted, (e: Error) => setErr(e.message)).finally(() => setBusy(false))
  }
  return (
    <>
      <ModeAndModels sessionId={sessionId} mode={mode} setMode={setMode} pair={pair} setPair={setPair} />
      <div className="ac-field">
        <textarea ref={ref} value={task} onChange={(e) => setTask(e.target.value)} placeholder={follows ? '在刚采用的版本上，下一项想做什么？' : '这次想做什么？把每条要求都写清楚，两版才好比较'}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) start() }} aria-label="对比任务" style={compact ? { minHeight: 72 } : undefined} />
        <div className="ac-field-foot">
          <div className="ac-chips">{!compact && EXAMPLES.map((x) => <button key={x} className="ac-chip" onClick={() => { setTask(x); ref.current?.focus() }}>{x}</button>)}</div>
          <span className="ac-kbd">Ctrl + Enter</span>
          <button className="ac-btn primary lg" disabled={busy || task.trim() === '' || !pairOk} onClick={() => start()}>{busy ? <><span className="ac-spin" />准备中</> : follows ? '再次比较' : '开始对比'}</button>
        </div>
      </div>
      {!compact && (
        <div className="ac-case">
          <div><b>先用内置案例试一次</b><span>新建一个独立的示例商店仓库（不碰你的项目），要求两版都做出搜索、组合筛选、清空和手机适配，并逐条自动验收。</span></div>
          <button className="ac-btn" disabled={busy} onClick={() => start(true)}>试跑内置案例</button>
        </div>
      )}
      {err && <div className="ac-error" style={{ margin: 0 }}>{err}</div>}
    </>
  )
}

function StartView({ sessionId, isolation, onStarted }: { sessionId: string; isolation?: 'own-root' | 'shared-root'; onStarted: (r: Run) => void }): React.ReactElement {
  return (
    <div className="ac-start">
      <div>
        <h2 className="ac-h1">同一需求，两版真跑</h2>
        <p className="ac-lead">两个 Agent 各在自己的隔离副本里做一版，构建后真的跑起来给你试，并按同一套验收逐条检查。先体验、再选择，选完立即揭晓。</p>
      </div>
      <Composer sessionId={sessionId} onStarted={onStarted} />
      <div className="ac-note">
        <span>需要：Git 仓库 · Vite 项目</span>
        <span>{isolation === 'shared-root' ? '隔离：副本在仓库内，越界写入只能事后发现' : '隔离：每个候选只能写自己的副本'}</span>
        <span>采用前先预演；不提交、不动 index</span>
      </div>
    </div>
  )
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

function ActionBar({ run, busy, act, home }: { run: Run; busy: boolean; act: Act; home: () => void }): React.ReactElement | null {
  const pick = run.choice?.pick
  const picked = run.candidates.find((c) => c.label === pick)
  const total = Math.max(...run.candidates.map(elapsed))
  const ready = run.candidates.filter((c) => c.stage === 'ready').length
  switch (run.state) {
    case 'running':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">两个候选并行进行中 · 已用 <strong>{fmt(total)}</strong>{ready ? ` · ${ready} 个已可体验` : ''}</span>
          <button className="ac-btn danger" disabled={busy} onClick={() => act('cancel')}>全部停止</button>
        </div>
      )
    case 'judging':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text"><strong>两边都试一下</strong>，选出你更愿意采用的那一版；选完立即揭晓</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>都不满意</button>
          {run.candidates.filter((c) => c.stage === 'ready').map((c) => <button key={c.label} className="ac-btn primary" disabled={busy} onClick={() => act('choose', { pick: c.label })}>选 {c.label}</button>)}
        </div>
      )
    case 'revealed': {
      const eligible = picked?.verdict?.eligible === true
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{pick === 'none' || picked === undefined ? '这次两版都没选。可以换个描述再来一次。' : eligible ? '采用前会先在你当前项目的副本里预演并验收；不提交，不动 index。' : '这一版没有通过共同验收，不能写入工作区，可以另存为分支查看。'}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('cleanup')}>结束并清理</button>
          {picked !== undefined && <button className="ac-btn" disabled={busy} onClick={() => act('adopt', { mode: 'branch' })} title="只新建分支（含一个提交），不切换、不改当前文件">另存为分支</button>}
          {picked !== undefined && eligible && <button className="ac-btn primary" disabled={busy} onClick={() => act('adopt', { mode: 'worktree' })}>采用 {pick} 到工作区</button>}
        </div>
      )
    }
    case 'adopting':
      return (
        <div className="ac-bar"><span className="ac-bar-text"><span className="ac-spin" style={{ display: 'inline-block', marginRight: 8 }} />{run.adoption?.state === 'writing' ? '正在写入并核对…' : '正在你当前项目的副本里预演并验收…'}</span></div>
      )
    case 'recovery':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">采用没有完整结束。可以把涉及的文件恢复到采用前，或保留现在的文件。</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('recover', { action: 'keep' })}>保留当前文件</button>
          <button className="ac-btn primary" disabled={busy} onClick={() => act('recover', { action: 'restore' })}>恢复到采用前</button>
        </div>
      )
    case 'adopted':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text"><StarNudge /></span>
          {run.adoption?.mode === 'worktree' && <button className="ac-btn" disabled={busy} onClick={() => act('revert')}>撤销采用</button>}
          <button className="ac-btn" disabled={busy} onClick={home}>完成</button>
        </div>
      )
    default:
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.state === 'interrupted' ? '这次比较因宿主重启而中断。' : '这次比较已结束。'}{run.leftovers?.length ? ` 有 ${run.leftovers.length} 个目录无法确认归属，没有删除。` : ''}</span>
          {run.state === 'interrupted' && <button className="ac-btn" disabled={busy} onClick={() => act('cleanup')}>清理</button>}
          <button className="ac-btn primary" disabled={busy} onClick={home}>新的比较</button>
        </div>
      )
  }
}

function Banners({ run }: { run: Run }): React.ReactElement {
  const pick = run.choice?.pick
  const fav = run.checksFavoured
  const revealed = REVEALED.has(run.state) || (run.choice !== undefined)
  const pickedTitle = run.candidates.find((c) => c.label === pick)?.strategy?.title
  const a = run.adoption
  const bad = a && ['blocked', 'rolled-back', 'needs-recovery'].includes(a.state)
  return (
    <>
      {run.outsideChanges && run.outsideChanges.length > 0 && (
        <div className="ac-banner warn" role="alert">
          <div><strong>生成期间，你的项目里这些文件和开始时不一样了</strong>：<code>{run.outsideChanges.slice(0, 8).join('、')}{run.outsideChanges.length > 8 ? ` 等 ${run.outsideChanges.length} 个` : ''}</code></div>
          <div className="disclaimer">{run.isolation === 'own-root' ? '候选只能写自己的副本，这些是你自己的编辑；采用时会检查是否和候选的改动重叠。' : '可能是候选 Agent 越界写入，也可能是你自己的编辑；请在采用前检查这些文件。'}</div>
        </div>
      )}
      {revealed && pick !== undefined && (
        <div className="ac-banner">
          <div>
            {run.mode === 'same-model' ? '同一模型、两种策略。' : '两个模型、同一要求。'}
            你选了 <strong>{pick === 'none' ? '都不满意' : `${pick}${pickedTitle ? `（${pickedTitle}）` : ''}`}</strong>；程序验收倾向 <strong>{fav === 'tie' ? '持平' : fav === 'none' || fav === undefined ? '无' : fav}</strong>
            {pick !== 'none' && fav !== undefined && fav !== 'tie' && fav !== 'none' && fav !== pick ? '。你的选择和验收结论不同。' : '。'}
          </div>
          <div className="disclaimer">单次任务的结果不代表模型或策略的整体优劣。</div>
        </div>
      )}
      {a && (
        <div className={`ac-banner${bad ? ' err' : a.state === 'needs-attention' ? ' warn' : ''}`}>
          <div>
            <span className={`ac-pill ${a.state === 'adopted' ? 'ok' : bad ? 'err' : a.state === 'needs-attention' ? 'warn' : ''}`}>
              {{ rehearsing: '预演中', blocked: '未写入', writing: '写入中', adopted: a.mode === 'branch' ? '已建分支' : '已采用', 'needs-attention': '已采用 · 请查看', 'rolled-back': '已恢复', 'needs-recovery': '需要处理', reverted: '已撤销' }[a.state] ?? a.state}
            </span>{' '}
            <span style={{ color: 'var(--ac-fg2)' }}>{a.message}</span>
          </div>
          {a.rehearsalChecks && <Checks checks={a.rehearsalChecks} />}
          {a.attention && a.attention.length > 0 && <code>{a.attention.slice(0, 12).join('、')}</code>}
        </div>
      )}
    </>
  )
}

function History({ data, open }: { data?: ListResult; open: (r: Run) => void }): React.ReactElement {
  if (data === undefined) return <div className="ac-empty"><span className="ac-spin" /></div>
  if (data.runs.length === 0 && data.legacy.length === 0) return <div className="ac-empty">还没有比较记录</div>
  return (
    <div className="ac-history">
      {data.runs.map((r) => (
        <button key={r.runId} className="ac-hrow" onClick={() => open(r)}>
          <span className={`ac-pill ${r.state === 'adopted' ? 'ok' : ACTIVE.has(r.state) ? 'brand' : ''}`}>{STATE_TEXT[r.state] ?? r.state}</span>
          <span className="t" title={r.task}>{r.task}</span>
          <span className="ac-meta">{r.choice?.pick && r.choice.pick !== 'none' ? `选了 ${r.choice.pick} · ` : ''}{when(r.createdAt)}</span>
        </button>
      ))}
      {data.legacy.map((r) => (
        <div key={r.runId} className="ac-hrow legacy" title="旧版本留下的记录，只能查看">
          <span className="ac-pill">旧版</span>
          <span className="t">{r.task}</span>
          <span className="ac-meta">{when(r.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}

function Sheet({ sessionId }: { sessionId: string }): React.ReactElement {
  const [view, setView] = useState<'home' | 'run' | 'history'>('home')
  const [run, setRun] = useState<Run>()
  const [list, setList] = useState<ListResult>()
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)

  const refreshList = useCallback(async (): Promise<ListResult | undefined> => {
    try {
      const l = await call<ListResult>('list', { sessionId })
      setList(l)
      setErr(undefined)
      return l
    } catch (e) { setErr((e as Error).message); return undefined } finally { setLoaded(true) }
  }, [sessionId])
  // On open: resume a comparison still in progress for this conversation, otherwise start fresh.
  useEffect(() => {
    void refreshList().then((l) => {
      const active = l?.runs.find((r) => ACTIVE.has(r.state))
      if (active) { setRun(active); setView('run') }
    })
  }, [refreshList])
  const refreshRun = useCallback(async () => {
    if (!run) return
    try { setRun(await call<Run>('get', { runId: run.runId })) } catch (e) { setErr((e as Error).message) }
  }, [run?.runId])
  const polling = view === 'run' && run !== undefined && (LIVE_POLL.has(run.state) || run.candidates.some((c) => busyStage(c.stage)))
  useEffect(() => {
    if (!polling) return
    const t = setInterval(() => { void refreshRun() }, 1500)
    return () => clearInterval(t)
  }, [polling, refreshRun])
  useTick(run?.state === 'running')
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(undefined) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const act: Act = (method, extra = {}) => {
    if (!run) return
    setBusy(true)
    setErr(undefined)
    call<Run | null>(method, { runId: run.runId, ...extra })
      .then((r) => { if (r && typeof r === 'object' && 'runId' in r) setRun(r) }, (e: Error) => setErr(e.message))
      .finally(() => { setBusy(false); void refreshRun() })
  }
  const home = (): void => { setRun(undefined); setView('home'); void refreshList() }
  const started = (r: Run): void => { setRun(r); setView('run') }

  const revealed = run ? REVEALED.has(run.state) || run.choice !== undefined : false
  const runningCount = run?.candidates.filter((c) => busyStage(c.stage)).length ?? 0
  return (
    <div className="ac-root">
      <Styles />
      <div className="ac-mask" onClick={() => setOpen(undefined)} />
      <div className="ac-sheet" role="dialog" aria-modal="true" aria-label="AgentCompare">
        <header className="ac-head">
          <span className="ac-logo">A|B</span>
          <span className="ac-title">AgentCompare</span>
          {view === 'run' && run ? <span className="ac-task" title={run.task}>{run.task}</span> : <span className="ac-spacer" />}
          {view === 'run' && run?.baseline.dirty && <span className="ac-pill" title="未提交的改动已一起复制给两个候选；你的文件没有被修改">含未提交改动</span>}
          {view === 'run' && run && runningCount > 0 && <span className="ac-pill brand"><span className="ac-spin" />进行中</span>}
          <div className="ac-tabs" role="tablist">
            <button className={`ac-tab${view !== 'history' ? ' on' : ''}`} onClick={() => setView(run ? 'run' : 'home')} role="tab" aria-selected={view !== 'history'}>{run ? '当前比较' : '新的比较'}</button>
            <button className={`ac-tab${view === 'history' ? ' on' : ''}`} onClick={() => { setView('history'); void refreshList() }} role="tab" aria-selected={view === 'history'}>历史记录</button>
          </div>
          <button className="ac-icon-btn" onClick={() => setOpen(undefined)} aria-label="关闭（Esc）" title="关闭（Esc）"><IconClose /></button>
        </header>
        {err && <div className="ac-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="ac-body">
          {!loaded ? (
            <div className="ac-empty" style={{ height: '100%' }}><span className="ac-spin" /></div>
          ) : view === 'history' ? (
            <History data={list} open={(r) => { setRun(r); setView('run') }} />
          ) : view === 'run' && run ? (
            <>
              <Banners run={run} />
              <div className="ac-grid">
                {run.candidates.map((c) => <CandidateCard key={c.label} run={run} c={c} revealed={revealed} picked={revealed && run.choice?.pick === c.label} busy={busy} act={act} />)}
              </div>
              {run.state === 'adopted' && run.adoption?.mode === 'worktree' && (
                <div className="ac-next">
                  <b>继续这份成果</b>
                  <Composer sessionId={sessionId} follows={run.runId} onStarted={started} compact />
                </div>
              )}
            </>
          ) : (
            <StartView sessionId={sessionId} {...(list?.isolation ? { isolation: list.isolation } : {})} onStarted={started} />
          )}
        </div>
        {view === 'run' && run && <ActionBar run={run} busy={busy} act={act} home={home} />}
      </div>
    </div>
  )
}

function HeaderButton({ sessionId }: { sessionId: string }): React.ReactElement {
  return (
    <>
      <Styles />
      <button className="ac-header-btn" title="AgentCompare：同一需求，两版真跑" aria-label="打开 AgentCompare" onClick={() => setOpen(sessionId)}>A|B</button>
    </>
  )
}

function Overlay(): React.ReactElement | null {
  const sid = useOpen()
  return sid === undefined ? null : <Sheet sessionId={sid} />
}

/**
 * DSH 0.2.1 treats any client entry that fails to activate as a fatal web
 * boot (the desktop app then disables every third-party plugin). So nothing
 * here may throw: a slot that cannot be registered only loses this button.
 */
export function apply(ctx: ClientCtx): void {
  const disposers: Array<() => void> = []
  const safely = (label: string, fn: () => () => void): void => {
    try {
      disposers.push(fn())
    } catch (error) {
      console.warn(`[dsh-agent-compare] ${label} unavailable:`, error)
    }
  }
  safely('header button', () => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'agent-compare',
    order: 30,
    registrant: 'dsh-agent-compare',
    inject: (sessionId: string) => ({ sessionId }),
  }, HeaderButton)))
  safely('overlay', () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'agent-compare',
    order: 30,
    registrant: 'dsh-agent-compare',
    inject: () => ({}),
  }, Overlay)))
  try {
    ctx.effect?.(() => () => { for (const d of disposers.reverse()) d() })
  } catch (error) {
    console.warn('[dsh-agent-compare] cleanup hook unavailable:', error)
  }
}

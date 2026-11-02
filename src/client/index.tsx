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

type Stage = 'queued' | 'worktree' | 'generating' | 'capturing' | 'installing' | 'starting' | 'checking' | 'ready' | 'failed' | 'cancelled' | 'interrupted'
interface Check { name: string; outcome: 'passed' | 'failed' | 'skipped' | 'timeout'; reason?: string; durationMs: number }
interface Cand {
  label: 'A' | 'B'
  stage: Stage
  previewUrl?: string
  checks?: Check[]
  patchStats?: { files: number; insertions: number; deletions: number; binary: number }
  timings: Partial<Record<Stage, { startedAt: number; endedAt?: number }>>
  error?: { stage: Stage; message: string }
  usage?: { kind: 'reported'; totalTokens?: number; inputTokens?: number; outputTokens?: number } | { kind: 'unknown'; reason: string }
  strategy?: { id: string; title: string }
  route?: { provider?: string; model?: string }
  summary?: string
  driftAfterChecks?: boolean
}
interface Run {
  runId: string
  task: string
  state: string
  mode: 'same-model' | 'cross-model'
  createdAt: number
  baseline: { dirty: boolean; headCommit?: string }
  candidates: Cand[]
  choice?: { pick: 'A' | 'B' | 'none' }
  checksFavoured?: 'A' | 'B' | 'tie' | 'none'
  adoption?: { state: string; mode: string; message?: string; branch?: string; verification?: Check[] }
  outsideChanges?: string[]
}

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
  { stage: 'worktree', label: '隔离副本' },
  { stage: 'generating', label: 'Agent 实现' },
  { stage: 'capturing', label: '冻结改动' },
  { stage: 'installing', label: '安装依赖' },
  { stage: 'starting', label: '启动应用' },
  { stage: 'checking', label: '统一验收' },
]
const STAGE_TEXT: Record<Stage, string> = {
  queued: '排队中', worktree: '准备隔离副本', generating: 'Agent 正在实现', capturing: '冻结改动', installing: '安装依赖',
  starting: '启动应用', checking: '运行验收', ready: '可以体验', failed: '失败', cancelled: '已停止', interrupted: '已中断',
}
const CHECK_TEXT: Record<string, string> = { typecheck: '类型检查', lint: 'Lint', build: '构建', test: '测试', browser: '页面加载', target: '主仓库复验' }
const EXAMPLES = [
  '给商品列表加上搜索框和分类筛选，手机上也要好用',
  '重新设计首页顶部区域，突出主要操作按钮',
  '把设置页改成分组卡片布局，并加上保存成功提示',
]
const TERMINAL = new Set(['adopted', 'abandoned', 'interrupted'])
const REVEALED = new Set(['revealed', 'adopting', 'adopted', 'adopt-failed'])

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
.ac-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--ac-r-sm);border:none;background:transparent;color:var(--ac-fg2);cursor:pointer}
.ac-icon-btn:hover{background:var(--ac-hover);color:var(--ac-fg)}
.ac-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--ac-r-sm);border:1px solid var(--ac-border-strong);background:var(--ac-bg);color:var(--ac-fg);font:inherit;font-weight:500;cursor:pointer;white-space:nowrap}
.ac-btn:hover:not(:disabled){background:var(--ac-hover)}
.ac-btn:disabled{opacity:.5;cursor:default}
.ac-btn.primary{background:var(--dsw-alias-button-primary-fill,var(--ac-brand));border-color:transparent;color:var(--ac-brand-fg)}
.ac-btn.primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover,var(--ac-brand));filter:brightness(1.06)}
.ac-btn.lg{height:38px;padding:0 18px;font-size:14px}
.ac-btn.danger{color:var(--ac-err)}
.ac-btn:focus-visible,.ac-icon-btn:focus-visible,.ac-chip:focus-visible{outline:2px solid var(--ac-brand);outline-offset:2px}
.ac-body{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column}
.ac-pill{display:inline-flex;align-items:center;gap:6px;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:500;background:var(--ac-l2);color:var(--ac-fg2);white-space:nowrap}
.ac-pill.ok{background:color-mix(in srgb,var(--ac-ok) 14%,transparent);color:var(--ac-ok)}
.ac-pill.err{background:color-mix(in srgb,var(--ac-err) 12%,transparent);color:var(--ac-err)}
.ac-pill.brand{background:color-mix(in srgb,var(--ac-brand) 12%,transparent);color:var(--ac-brand)}
.ac-spin{width:11px;height:11px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:ac-spin .8s linear infinite}
.ac-dot{width:7px;height:7px;border-radius:50%;background:currentColor}
/* start */
.ac-start{max-width:760px;margin:0 auto;padding:40px 24px 32px;display:flex;flex-direction:column;gap:24px}
.ac-h1{font-size:22px;font-weight:650;letter-spacing:-.01em;margin:0}
.ac-lead{color:var(--ac-fg2);margin:6px 0 0;font-size:14px}
.ac-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.ac-step{padding:14px;border-radius:var(--ac-r-md);background:var(--ac-l1);border:1px solid var(--ac-border)}
.ac-step b{display:flex;align-items:center;gap:8px;font-size:13px;margin-bottom:4px}
.ac-step span{color:var(--ac-fg3);font-size:12px}
.ac-num{display:inline-flex;width:20px;height:20px;border-radius:50%;align-items:center;justify-content:center;background:var(--ac-bg);border:1px solid var(--ac-border-strong);font-size:11px;font-weight:600}
.ac-field{border:1px solid var(--ac-border-strong);border-radius:var(--ac-r-lg);background:var(--ac-bg);transition:border-color .12s,box-shadow .12s}
.ac-field:focus-within{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-field textarea{display:block;width:100%;min-height:112px;resize:vertical;border:none;outline:none;background:transparent;color:var(--ac-fg);font:inherit;font-size:14px;padding:14px 16px 6px}
.ac-field textarea::placeholder{color:var(--ac-fg3)}
.ac-field-foot{display:flex;align-items:center;gap:8px;padding:8px 10px 10px 16px;flex-wrap:wrap}
.ac-chip{border:1px solid var(--ac-border);background:var(--ac-l1);color:var(--ac-fg2);border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}
.ac-chip:hover{color:var(--ac-fg);background:var(--ac-hover)}
.ac-note{color:var(--ac-fg3);font-size:12px;display:flex;gap:14px;flex-wrap:wrap}
.ac-kbd{font-size:11px;color:var(--ac-fg3);margin-right:4px}
.ac-error{margin:0 16px;padding:8px 12px;border-radius:var(--ac-r-sm);background:color-mix(in srgb,var(--ac-err) 10%,transparent);color:var(--ac-err)}
/* compare */
.ac-grid{flex:1;display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px;min-height:520px}
.ac-card{display:flex;flex-direction:column;min-height:0;border:1px solid var(--ac-border);border-radius:var(--ac-r-lg);background:var(--ac-bg);overflow:hidden;transition:box-shadow .15s,border-color .15s}
.ac-card.picked{border-color:var(--ac-brand);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac-brand) 16%,transparent)}
.ac-card-head{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-bottom:1px solid var(--ac-border)}
.ac-row{display:flex;align-items:center;gap:8px;min-width:0}
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
.ac-strategy{margin-left:auto;font-weight:600;font-size:12px}
.ac-summary{color:var(--ac-fg2);font-size:12px;white-space:pre-wrap;max-height:84px;overflow:auto}
.ac-browser{flex:1;display:flex;flex-direction:column;min-height:0;background:var(--ac-l1)}
.ac-chrome{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--ac-border);background:var(--ac-l1)}
.ac-lights{display:flex;gap:5px}.ac-lights i{width:9px;height:9px;border-radius:50%;background:var(--ac-border-strong)}
.ac-url{flex:1;min-width:0;height:24px;display:flex;align-items:center;padding:0 10px;border-radius:6px;background:var(--ac-bg);color:var(--ac-fg3);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.ac-frame{flex:1;width:100%;min-height:0;border:none;background:#fff}
.ac-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ac-fg3);padding:24px;text-align:center}
.ac-skel{width:min(320px,70%);display:flex;flex-direction:column;gap:8px}.ac-skel i{height:10px;border-radius:5px;background:var(--ac-l2);animation:ac-pulse 1.4s ease-in-out infinite}
.ac-fail{flex:1;margin:12px;padding:12px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-err) 7%,transparent);color:var(--ac-fg);overflow:auto;font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px;white-space:pre-wrap}
.ac-fail b{display:block;color:var(--ac-err);font-family:var(--dsw-font-family,inherit);margin-bottom:6px}
.ac-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--ac-border);background:var(--ac-bg);flex-wrap:wrap}
.ac-bar-text{flex:1;min-width:200px;color:var(--ac-fg2)}
.ac-bar-text strong{color:var(--ac-fg)}
.ac-examples{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:-12px}
.ac-examples>span{color:var(--ac-fg3);font-size:12px}
.ac-start{margin:auto;width:100%}
.ac-warn{flex:none;margin:16px 16px 0;padding:10px 14px;border-radius:var(--ac-r-md);background:color-mix(in srgb,var(--ac-warn) 10%,transparent);border:1px solid color-mix(in srgb,var(--ac-warn) 30%,transparent)}
.ac-warn code{font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:12px}
.ac-reveal{flex:none;margin:16px 16px 0;padding:12px 14px;border-radius:var(--ac-r-md);background:var(--ac-l1);border:1px solid var(--ac-border);display:flex;flex-direction:column;gap:6px}
.ac-reveal .disclaimer{color:var(--ac-fg3);font-size:12px}
.ac-link{color:var(--dsw-alias-link,var(--ac-brand));text-decoration:none}.ac-link:hover{text-decoration:underline}
.ac-header-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 7px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,rgba(15,17,21,.12));background:transparent;color:var(--dsw-alias-label-secondary,#4b5260);font:600 11px/1 var(--dsw-font-family,inherit);letter-spacing:.03em;cursor:pointer}
.ac-header-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(15,17,21,.05));color:var(--dsw-alias-label-primary,#0f1115)}
@media (max-width:900px){.ac-grid{grid-template-columns:1fr;height:auto}.ac-card{min-height:460px}.ac-steps{grid-template-columns:1fr}}
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

function CandidateCard({ c, revealed, picked }: { c: Cand; revealed: boolean; picked: boolean }): React.ReactElement {
  const usage = c.usage === undefined ? '—' : c.usage.kind === 'unknown' ? '未知' : `${c.usage.totalTokens ?? '?'} tokens`
  const live = c.previewUrl !== undefined && !['failed', 'cancelled', 'interrupted'].includes(c.stage)
  const step = busyStage(c.stage) ? PIPELINE.findIndex((p) => p.stage === c.stage) + 1 : 0
  return (
    <section className={`ac-card${picked ? ' picked' : ''}`} aria-label={`候选 ${c.label}`}>
      <div className="ac-card-head">
        <div className="ac-row">
          <span className="ac-label">{c.label}</span>
          <StagePill c={c} />
          <span className="ac-meta">{fmt(elapsed(c))}</span>
          {revealed && c.strategy && <span className="ac-strategy">{c.strategy.title}{c.route?.model ? ` · ${c.route.model}` : ''}</span>}
        </div>
        <Track c={c} />
        {step > 0 && <div className="ac-meta">第 {step}/{PIPELINE.length} 步 · {STAGE_TEXT[c.stage]}</div>}
        <Checks checks={c.checks} />
        {(c.patchStats || c.usage) && (
          <div className="ac-meta">
            {c.patchStats ? `${c.patchStats.files} 个文件 · +${c.patchStats.insertions} −${c.patchStats.deletions}${c.patchStats.binary ? ` · ${c.patchStats.binary} 个二进制` : ''}` : ''}
            {c.patchStats && c.usage ? ' · ' : ''}
            {c.usage ? `用量 ${usage}` : ''}
            {c.driftAfterChecks ? ' · 验收后工作区多出未计入补丁的文件' : ''}
          </div>
        )}
        {revealed && c.summary && <div className="ac-summary">{c.summary}</div>}
      </div>
      {live ? (
        <div className="ac-browser">
          <div className="ac-chrome">
            <span className="ac-lights"><i /><i /><i /></span>
            <span className="ac-url" title={c.previewUrl}>{c.previewUrl}</span>
            <a className="ac-icon-btn" href={c.previewUrl} target="_blank" rel="noreferrer" title="在浏览器中打开（预览空白时使用）" aria-label={`在浏览器中打开 ${c.label}`}><IconExternal /></a>
          </div>
          <iframe className="ac-frame" title={`候选 ${c.label} 的运行页面`} src={c.previewUrl} />
        </div>
      ) : c.error ? (
        <div className="ac-fail"><b>{STAGE_TEXT[c.error.stage]}阶段失败</b>{c.error.message}</div>
      ) : (
        <div className="ac-empty">
          <div className="ac-skel"><i style={{ width: '60%' }} /><i /><i style={{ width: '80%' }} /></div>
          <div>{c.stage === 'cancelled' ? '已停止' : `${STAGE_TEXT[c.stage]}…应用启动后，这里会显示真实页面`}</div>
        </div>
      )}
    </section>
  )
}

function StartView({ sessionId, onStarted }: { sessionId: string; onStarted: (r: Run) => void }): React.ReactElement {
  const [task, setTask] = useState('')
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  const start = (): void => {
    if (busy || task.trim() === '') return
    setBusy(true)
    setErr(undefined)
    call<Run>('start', { sessionId, task }).then(onStarted, (e: Error) => setErr(e.message)).finally(() => setBusy(false))
  }
  return (
    <div className="ac-start">
      <div>
        <h2 className="ac-h1">同一需求，两版真跑</h2>
        <p className="ac-lead">两个 Agent 各做一版，真的跑起来给你试。先体验、再选择，选完才揭晓谁用了什么策略。</p>
      </div>
      <div className="ac-steps">
        <div className="ac-step"><b><span className="ac-num">1</span>两个独立实现</b><span>同一模型，「稳妥」与「大胆」两种策略，各在隔离副本里工作</span></div>
        <div className="ac-step"><b><span className="ac-num">2</span>真实运行 + 统一验收</b><span>各自安装依赖、启动应用，跑同一套类型检查、构建和页面检查</span></div>
        <div className="ac-step"><b><span className="ac-num">3</span>盲选后再采用</b><span>只看 A / B 做选择；采用时不提交、不覆盖你的改动</span></div>
      </div>
      <div className="ac-field">
        <textarea ref={ref} value={task} onChange={(e) => setTask(e.target.value)} placeholder="这次想做什么？描述得越具体，两版越好比较"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) start() }} aria-label="对比任务" />
        <div className="ac-field-foot">
          <span className="ac-spacer" />
          <span className="ac-kbd">Ctrl + Enter</span>
          <button className="ac-btn primary lg" disabled={busy || task.trim() === ''} onClick={start}>{busy ? <><span className="ac-spin" />准备中</> : '开始对比'}</button>
        </div>
      </div>
      <div className="ac-examples">
        <span>试试：</span>
        {EXAMPLES.map((x) => <button key={x} className="ac-chip" onClick={() => { setTask(x); ref.current?.focus() }}>{x}</button>)}
      </div>
      {err && <div className="ac-error" style={{ margin: 0 }}>{err}</div>}
      <div className="ac-note"><span>需要：Git 仓库 · Vite 项目</span><span>适合：界面与交互类任务</span><span>你的文件和 index 在采用前不会被改动</span></div>
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
      选到了愿意采用的版本？<a className="ac-link" href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare" target="_blank" rel="noreferrer" onClick={hide}>Star 支持更多项目类型</a>
      <button className="ac-icon-btn" style={{ width: 22, height: 22, verticalAlign: 'middle' }} onClick={hide} aria-label="不再显示"><IconClose /></button>
    </span>
  )
}

function ActionBar({ run, busy, act }: { run: Run; busy: boolean; act: (m: string, extra?: Record<string, unknown>) => void }): React.ReactElement {
  const pick = run.choice?.pick
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
          <span className="ac-bar-text"><strong>两边都试一下</strong>，选出你更愿意采用的那一版</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('choose', { pick: 'none' })}>都不满意</button>
          {run.candidates.filter((c) => c.stage === 'ready').map((c) => <button key={c.label} className="ac-btn primary" disabled={busy} onClick={() => act('choose', { pick: c.label })}>选 {c.label}</button>)}
        </div>
      )
    case 'chosen':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">你选了 <strong>{pick === 'none' ? '都不满意' : pick}</strong>，看看两边分别用了什么策略</span>
          <button className="ac-btn primary lg" disabled={busy} onClick={() => act('reveal')}>揭晓</button>
        </div>
      )
    case 'revealed':
    case 'adopt-failed':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{pick === 'none' ? '这次两版都没选。可以换个描述再来一次。' : '采用不会提交，也不会改动你的 index。'}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('cleanup')}>结束并清理</button>
          {pick !== 'none' && <>
            <button className="ac-btn" disabled={busy} onClick={() => act('adopt', { mode: 'branch' })} title="只新建分支，不切换、不改当前文件">采用为新分支</button>
            <button className="ac-btn primary" disabled={busy} onClick={() => act('adopt', { mode: 'worktree' })}>采用 {pick} 到工作区</button>
          </>}
        </div>
      )
    case 'adopted':
      return (
        <div className="ac-bar">
          <span className="ac-bar-text"><StarNudge /></span>
          {run.adoption?.mode === 'worktree' && <button className="ac-btn" disabled={busy} onClick={() => act('revert')}>撤销采用</button>}
          <button className="ac-btn primary" disabled={busy} onClick={() => act('cleanup')}>完成并清理</button>
        </div>
      )
    default:
      return (
        <div className="ac-bar">
          <span className="ac-bar-text">{run.state === 'interrupted' ? '这次对比因宿主重启而中断。' : ''}</span>
          <button className="ac-btn" disabled={busy} onClick={() => act('cleanup')}>结束并清理</button>
        </div>
      )
  }
}

function RevealBanner({ run }: { run: Run }): React.ReactElement {
  const pick = run.choice?.pick
  const fav = run.checksFavoured
  const pickedTitle = run.candidates.find((c) => c.label === pick)?.strategy?.title
  const a = run.adoption
  return (
    <div className="ac-reveal">
      <div>
        {run.mode === 'same-model' ? '同一模型、两种策略。' : '两个不同模型。'}
        你选了 <strong>{pick === 'none' ? '都不满意' : `${pick}${pickedTitle ? `（${pickedTitle}）` : ''}`}</strong>；程序验收倾向 <strong>{fav === 'tie' ? '持平' : fav === 'none' || fav === undefined ? '无' : fav}</strong>
        {pick !== 'none' && fav !== undefined && fav !== 'tie' && fav !== 'none' && fav !== pick ? '。你的选择和验收结论不同。' : '。'}
      </div>
      {a && (
        <div>
          <span className={`ac-pill ${a.state === 'adopted' ? 'ok' : a.state === 'failed' ? 'err' : ''}`}>
            {a.state === 'adopted' ? '已采用' : a.state === 'failed' ? '采用失败' : a.state === 'reverted' ? '已撤销' : '采用中'}
          </span>{' '}
          <span style={{ color: 'var(--ac-fg2)' }}>{a.message}</span>
          {a.verification && <div style={{ marginTop: 6 }}><Checks checks={a.verification} /></div>}
        </div>
      )}
      <div className="disclaimer">单次任务的结果不代表模型或策略的整体优劣。</div>
    </div>
  )
}

function Sheet({ sessionId }: { sessionId: string }): React.ReactElement {
  const [run, setRun] = useState<Run>()
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const runs = await call<Run[]>('list', { sessionId })
      setRun(runs.find((r) => r.state !== 'abandoned'))
      setErr(undefined)
    } catch (e) { setErr((e as Error).message) } finally { setLoaded(true) }
  }, [sessionId])
  useEffect(() => { void refresh() }, [refresh])
  const live = run !== undefined && !(TERMINAL.has(run.state) && run.state !== 'adopted')
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { void refresh() }, 1500)
    return () => clearInterval(t)
  }, [live, refresh])
  useTick(run?.state === 'running')
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(undefined) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const act = (method: string, extra: Record<string, unknown> = {}): void => {
    if (!run) return
    setBusy(true)
    call<Run | null>(method, { runId: run.runId, ...extra })
      .then((r) => { if (r && typeof r === 'object' && 'runId' in r) setRun(r) }, (e: Error) => setErr(e.message))
      .finally(() => { setBusy(false); void refresh() })
  }

  const revealed = run ? REVEALED.has(run.state) : false
  const runningCount = run?.candidates.filter((c) => busyStage(c.stage)).length ?? 0
  return (
    <div className="ac-root">
      <Styles />
      <div className="ac-mask" onClick={() => setOpen(undefined)} />
      <div className="ac-sheet" role="dialog" aria-modal="true" aria-label="AgentCompare">
        <header className="ac-head">
          <span className="ac-logo">A|B</span>
          <span className="ac-title">AgentCompare</span>
          {run ? <span className="ac-task" title={run.task}>{run.task}</span> : <span className="ac-spacer" />}
          {run?.baseline.dirty && <span className="ac-pill" title="未提交的改动已一起复制给两个候选；你的文件没有被修改">含未提交改动</span>}
          {run && runningCount > 0 && <span className="ac-pill brand"><span className="ac-spin" />进行中</span>}
          <button className="ac-icon-btn" onClick={() => setOpen(undefined)} aria-label="关闭（Esc）" title="关闭（Esc）"><IconClose /></button>
        </header>
        {err && <div className="ac-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="ac-body">
          {!loaded ? (
            <div className="ac-empty" style={{ height: '100%' }}><span className="ac-spin" /></div>
          ) : run ? (
            <>
              {run.outsideChanges && run.outsideChanges.length > 0 && (
                <div className="ac-warn" role="alert">
                  <strong>生成期间，你的仓库里这些文件和开始时不一样了</strong>（在两个候选副本之外）：
                  <code> {run.outsideChanges.slice(0, 8).join('、')}{run.outsideChanges.length > 8 ? ` 等 ${run.outsideChanges.length} 个` : ''}</code>
                  <div className="ac-meta">可能是候选 Agent 越界写入，也可能是你自己的编辑；AgentCompare 无法区分，请在采用前检查这些文件。</div>
                </div>
              )}
              {revealed && <RevealBanner run={run} />}
              <div className="ac-grid">
                {run.candidates.map((c) => <CandidateCard key={c.label} c={c} revealed={revealed} picked={revealed && run.choice?.pick === c.label} />)}
              </div>
            </>
          ) : (
            <StartView sessionId={sessionId} onStarted={setRun} />
          )}
        </div>
        {run && <ActionBar run={run} busy={busy} act={act} />}
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

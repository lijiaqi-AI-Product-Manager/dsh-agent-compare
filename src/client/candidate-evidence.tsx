import React from 'react'
import { t, currentLocale } from './i18n.js'
import { Diagnostic } from './language.js'
import type { Stage, Cand, Check, Route } from './model.js'

export const PIPELINE: Array<{ stage: Stage; label: string }> = [
  { stage: 'preparing', label: '隔离副本' },
  { stage: 'generating', label: 'Agent 实现' },
  { stage: 'sealing', label: '封存改动' },
  { stage: 'installing', label: '冻结安装' },
  { stage: 'verifying', label: '检查与构建' },
  { stage: 'previewing', label: '运行构建产物' },
]
export const STAGE_TEXT: Record<Stage, string> = {
  queued: '排队中', preparing: '准备隔离副本', generating: 'Agent 正在实现', sealing: '封存改动', installing: '安装依赖',
  verifying: '检查与构建', previewing: '启动并验收页面', ready: '可以体验', failed: '失败', stopping: '正在停止', cancelled: '已停止', interrupted: '已中断',
}
export const CHECK_TEXT: Record<string, string> = { typecheck: '类型检查', lint: 'Lint', build: '构建', test: '测试', browser: '页面验收' }
export const ERROR_STAGE: Partial<Record<Stage, string>> = { preparing: '准备副本', generating: '实现', sealing: '封存改动', installing: '安装依赖', verifying: '检查与构建', previewing: '启动与验收页面' }
export const STATE_TEXT: Record<string, string> = {
  running: '进行中', judging: '待选择', revealed: '已揭晓', adopting: '采用中', adopted: '已采用', recovery: '需要处理', abandoned: '已结束', interrupted: '已中断',
}
export const ACTIVE = new Set(['running', 'judging', 'revealed', 'adopting', 'recovery'])
export const LIVE_POLL = new Set(['running', 'adopting'])
export const REVEALED = new Set(['revealed', 'adopting', 'adopted', 'recovery'])
export function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}
export function elapsed(c: Cand): number {
  if (c.verificationHistory?.length) return Object.entries(c.timings).filter(([stage]) => ['installing', 'verifying', 'previewing'].includes(stage))
    .reduce((sum, [, timing]) => sum + (timing ? Math.max(0, (timing.endedAt ?? (busyStage(c.stage) ? Date.now() : timing.startedAt)) - timing.startedAt) : 0), 0)
  const timings = Object.entries(c.timings).filter(([s]) => s !== 'ready')
  const starts = timings.map(([, t]) => t?.startedAt ?? Infinity)
  const ends = timings.map(([, t]) => t?.endedAt ?? (busyStage(c.stage) ? Date.now() : t?.startedAt ?? 0))
  const first = Math.min(...starts)
  return Number.isFinite(first) ? Math.max(...ends) - first : 0
}
export function busyStage(s: Stage): boolean {
  return !['ready', 'failed', 'cancelled', 'interrupted', 'queued'].includes(s)
}
export function routeText(r?: Route): string {
  return r?.model ? `${r.model}${r.provider ? ` · ${r.provider}` : ''}` : ''
}
export function when(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function StagePill({ c }: { c: Cand }): React.ReactElement {
  const complete = Boolean(c.checks?.length && c.checks.every(check => check.outcome === 'passed'))
  const kind = c.stage === 'ready' ? c.verdict?.eligible ? complete ? 'ok' : '' : c.verdict ? 'err' : '' : c.stage === 'failed' ? 'err' : c.stage === 'interrupted' ? 'warn' : busyStage(c.stage) ? 'brand' : ''
  const availability = c.previewUrl ? t("可预览") : c.hasScreenshot || c.hasMobileScreenshot ? t("截图记录") : t("验收完成")
  const title = c.stage === 'ready' ? `${availability} · ${c.verdict ? c.verdict.eligible ? complete ? t("检查通过") : t("部分检查未运行") : t("未通过检查") : t("检查状态未知")}` : t(STAGE_TEXT[c.stage])
  return (
    <span className={`ac-pill ${kind}`}>
      {busyStage(c.stage) ? <span className="ac-spin" /> : <span className="ac-dot" />}
      {title}
    </span>
  )
}
export function Track({ c }: { c: Cand }): React.ReactElement {
  const failedAt = c.stage === 'failed' || c.stage === 'interrupted' ? c.error?.stage : undefined
  const current = PIPELINE.findIndex((p) => p.stage === (failedAt ?? c.stage))
  return (
    <div className="ac-track" aria-label={t("进度")}>
      {PIPELINE.map((p, i) => {
        const cls = c.stage === 'ready' || i < current ? 'done' : i === current ? (failedAt ? 'bad' : busyStage(c.stage) ? 'now' : '') : ''
        return <i key={p.stage} className={cls} title={t(p.label)} />
      })}
    </div>
  )
}
export function Checks({ checks }: { checks?: Check[] }): React.ReactElement | null {
  if (!checks?.length) return null
  const icon = { passed: '✓', failed: '✕', skipped: '–', timeout: '⏱' }
  return (
    <div className="ac-checks">
      {checks.map((k) => (
        <span key={k.name} className={`ac-check ${k.outcome}`} title={k.reason ?? `${fmt(k.durationMs)}`}>
          {icon[k.outcome]} {t(CHECK_TEXT[k.name]) ?? k.name}{k.outcome === 'skipped' ? t(" 未运行") : ''}
        </span>
      ))}
    </div>
  )
}
export function Verdict({ c }: { c: Cand }): React.ReactElement | null {
  const v = c.verdict
  if (v === undefined) return null
  const steps = c.checks?.find((k) => k.name === 'browser')?.steps
  return (
    <>
      <div className={`ac-verdict ${v.eligible ? 'ok' : 'bad'}`}>
        {v.eligible ? t("✓ 已通过已配置的检查；采用前仍需审查与目标核验") : t("✕ 当前不能采用：{0}", { 0: v.reasons.map(message => t(message)).join('; ') })}
        {v.warnings.length > 0 && <small>{v.warnings.map((message, index) => <React.Fragment key={index}>{index > 0 && '; '}<Diagnostic text={message} /></React.Fragment>)}</small>}
      </div>
      {steps && steps.length > 0 && (
        <details className="ac-details">
          <summary>{t("需求验收 ")}{steps.filter((s) => s.ok).length}/{steps.length}{t(" 步通过")}</summary>
          <ul className="ac-steps-list">
            {steps.map((s, i) => <li key={i} className={s.ok ? 'ok' : 'bad'}>{s.ok ? '✓' : '✕'} {s.label}{s.detail ? `（${s.detail}）` : ''}</li>)}
          </ul>
        </details>
      )}
    </>
  )
}
/** A finished candidate that is no longer served: its verification screenshots, and a way to serve it again. */
export function Activity({ p }: { p: NonNullable<Cand['progress']> }): React.ReactElement {
  const idle = Date.now() - p.lastActivityAt
  return (
    <div className="ac-meta ac-activity">{t("已进行 ")}{p.steps}{t(" 轮")}{p.lastAction ? <>{t(" · 最近：")}<code>{p.lastAction}</code></> : null}
      {p.tokens ? ` · ${p.tokens.toLocaleString(currentLocale())} tokens` : ''}
      {idle > 90_000 ? <span className="ac-slow"> · {fmt(idle)}{t(" 没有新动作（在等模型或工具）")}</span> : null}
    </div>
  )
}

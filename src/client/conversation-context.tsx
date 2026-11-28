/**
 * Choose what the two candidates learn from the main conversation: nothing,
 * the most recent exchanges, or messages ticked one by one. The preview shows
 * exactly what both receive before anything is sent.
 */
import React, { useEffect, useState } from 'react'
import { t } from './i18n.js'

export type ContextMode = 'none' | 'recent' | 'selected'
export const CONTEXT_TURNS = [1, 3, 6, 10] as const
export interface SelectedMessage { id: number; digest?: string }
export interface ContextEntry extends SelectedMessage { role: 'user' | 'assistant' | 'summary' | 'note'; text: string; chars: number }
function selectionOf({ id, digest }: SelectedMessage): SelectedMessage { return digest ? { id, digest } : { id } }

/** Older hosts return message positions alone. New hosts can also verify their original contents. */
export function selectedDigests(entries: readonly SelectedMessage[]): string[] | undefined {
  return entries.length && entries.every(entry => typeof entry.digest === 'string') ? entries.map(entry => entry.digest!) : undefined
}

export interface ContextPreview { mode: 'recent' | 'selected'; messages: number; chars: number; truncated: boolean; text: string }
type Call = <T>(method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<T>

const ROLE: Record<ContextEntry['role'], string> = { user: '你', assistant: '助手', summary: '摘要', note: '比较结果' }

export function ConversationContextControl({ sessionId, mode, turns, selected, disabled, call, onMode, onTurns, onSelected }: {
  sessionId: string
  mode: ContextMode
  turns: number
  selected: readonly SelectedMessage[]
  disabled: boolean
  call: Call
  onMode(mode: ContextMode): void
  onTurns(turns: number): void
  onSelected(entries: SelectedMessage[]): void
}): React.ReactElement {
  const [picking, setPicking] = useState(false)
  const [entries, setEntries] = useState<ContextEntry[]>()
  const [entriesError, setEntriesError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [snapshot, setSnapshot] = useState<{ key: string; value?: ContextPreview | null; error?: string }>()
  const openPicker = (): void => { setAttempt(value => value + 1); setPicking(true) }
  const key = JSON.stringify([sessionId, mode, turns, selected, mode === 'selected' ? attempt : 0])
  const preview = snapshot?.key === key ? snapshot.value : undefined
  const previewError = snapshot?.key === key ? snapshot.error : undefined
  useEffect(() => {
    if (mode === 'none') return
    const controller = new AbortController()
    // Wait for the user to stop clicking before reading the conversation again.
    const timer = setTimeout(() => {
      call<ContextPreview | null>('contextPreview', { sessionId, mode, turns, ...(mode === 'selected' ? { ids: selected.map(entry => entry.id), digests: selectedDigests(selected) } : {}) }, controller.signal)
        .then(value => { if (!controller.signal.aborted) setSnapshot({ key, value }) },
          (error: Error) => { if (!controller.signal.aborted) setSnapshot({ key, error: error.message }) })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [key, call])
  useEffect(() => {
    setEntries(undefined); setEntriesError(undefined)
    if (mode !== 'selected' || !picking) return
    const controller = new AbortController()
    call<{ entries: ContextEntry[] }>('contextEntries', { sessionId }, controller.signal).then(
      value => { if (!controller.signal.aborted) setEntries(value.entries) },
      (error: Error) => { if (!controller.signal.aborted) setEntriesError(error.message) },
    )
    return () => controller.abort()
  }, [sessionId, mode, picking, attempt, call])
  const has = (entry: ContextEntry): boolean => selected.some(item => item.id === entry.id && (!item.digest || !entry.digest || item.digest === entry.digest))
  const toggle = (entry: ContextEntry): void => {
    const others = selected.filter(item => item.id !== entry.id)
    onSelected(has(entry) ? others : [...others, selectionOf(entry)].sort((a, b) => a.id - b.id))
  }
  const summary = mode === 'none' ? t("各版只看到你写的需求，不带入主对话内容。")
    : previewError ? t(previewError)
    : preview === undefined ? t("正在读取主对话…")
    : preview === null ? (mode === 'selected' ? t("还没有勾选消息；各版只看到需求。") : t("主对话里还没有可带入的内容。"))
    : t("各版都会看到同样的 {0} 条主对话内容，约 {1} 字{2}", { 0: preview.messages, 1: preview.chars.toLocaleString(), 2: preview.truncated ? t("（已按长度上限缩短）") : '' })
  return <div className="ac-context">
    <div className="ac-settings-row">
      <span className="ac-context-label">{t("主对话上下文")}</span>
      <div className="ac-seg" role="group" aria-label={t("主对话上下文")}>
        {(['none', 'recent', 'selected'] as const).map(value => { const text = { none: t("不带"), recent: t("最近对话"), selected: t("手动选择") }[value]; return <button key={value} className={mode === value ? 'on' : ''} aria-pressed={mode === value} disabled={disabled} data-text={text} onClick={() => { onMode(value); if (value === 'selected') openPicker() }}>{text}</button> })}
      </div>
      {mode === 'recent' && <label className="ac-budget"><span className="ac-sr">{t("带入的最近对话轮数")}</span><select aria-label={t("带入的最近对话轮数")} value={turns} disabled={disabled} onChange={event => onTurns(Number(event.target.value))}>{CONTEXT_TURNS.map(value => <option key={value} value={value}>{t("最近 {0} 轮对话", { 0: value })}</option>)}</select></label>}
      {mode === 'selected' && <button className="ac-text-btn" aria-expanded={picking} onClick={() => picking ? setPicking(false) : openPicker()}>{picking ? t("收起消息列表") : t("选择消息（已选 {0} 条）", { 0: selected.length })}</button>}
    </div>
    <div className="ac-context-summary" role="status">{summary}{previewError && mode === 'selected' && <button className="ac-text-btn" onClick={openPicker}>{t("重新读取")}</button>}{preview ? <details><summary>{t("查看将带入的内容")}</summary><pre className="ac-context-text" tabIndex={0}>{preview.text}</pre></details> : mode !== 'none' ? <div className="ac-context-reserved" aria-hidden="true">{t("查看将带入的内容")}</div> : null}</div>
    {mode === 'selected' && picking && <div className="ac-context-picker" role="group" aria-label={t("选择要带入的主对话消息")}>
      {entriesError ? <p className="ac-feedback" role="alert">{t(entriesError)} <button className="ac-text-btn" onClick={() => setAttempt(value => value + 1)}>{t("重新读取")}</button></p>
        : entries === undefined ? <p className="ac-meta" role="status">{t("正在读取主对话…")}</p>
        : entries.length === 0 ? <p className="ac-meta">{t("主对话里还没有可选的消息。")}</p>
        : <>
          <div className="ac-row"><span className="ac-meta">{t("最近 {0} 条消息，按时间排列", { 0: entries.length })}</span><span className="ac-spacer" /><button className="ac-text-btn" disabled={disabled} onClick={() => onSelected(entries.slice(-4).map(selectionOf))}>{t("选最近 4 条")}</button><button className="ac-text-btn" disabled={disabled || selected.length === 0} onClick={() => onSelected([])}>{t("清空")}</button></div>
          <ul>{entries.map(entry => <li key={entry.id} className={has(entry) ? 'on' : ''}><label><input type="checkbox" disabled={disabled} checked={has(entry)} onChange={() => toggle(entry)} /><span className={`ac-context-role ${entry.role}`}>{t(ROLE[entry.role])}</span><span className="ac-context-preview">{entry.text}</span>{entry.chars > 400 && <span className="ac-meta">{t("共 {0} 字", { 0: entry.chars.toLocaleString() })}</span>}</label></li>)}</ul>
        </>}
    </div>}
  </div>
}

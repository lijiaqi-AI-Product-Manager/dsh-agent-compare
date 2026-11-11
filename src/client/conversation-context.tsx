/**
 * Choose what the two candidates learn from the main conversation: nothing,
 * the most recent exchanges, or messages ticked one by one. The preview shows
 * exactly what both receive before anything is sent.
 */
import React, { useEffect, useRef, useState } from 'react'
import { t } from './i18n.js'

export type ContextMode = 'none' | 'recent' | 'selected'
export const CONTEXT_TURNS = [1, 3, 6, 10] as const
export interface ContextEntry { id: number; role: 'user' | 'assistant' | 'summary' | 'note'; text: string; chars: number }
export interface ContextPreview { mode: 'recent' | 'selected'; messages: number; chars: number; truncated: boolean; text: string }
type Call = <T>(method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<T>

const ROLE: Record<ContextEntry['role'], string> = { user: '你', assistant: '助手', summary: '摘要', note: '比较结果' }

export function ConversationContextControl({ sessionId, mode, turns, selected, disabled, call, onMode, onTurns, onSelected }: {
  sessionId: string
  mode: ContextMode
  turns: number
  selected: readonly number[]
  disabled: boolean
  call: Call
  onMode(mode: ContextMode): void
  onTurns(turns: number): void
  onSelected(ids: number[]): void
}): React.ReactElement {
  const [picking, setPicking] = useState(false)
  const [entries, setEntries] = useState<ContextEntry[]>()
  const [entriesError, setEntriesError] = useState<string>()
  const [preview, setPreview] = useState<ContextPreview | null>()
  const [previewError, setPreviewError] = useState<string>()
  const request = useRef(0)
  const key = `${mode}/${turns}/${selected.join(',')}`
  useEffect(() => {
    if (mode === 'none') { setPreview(null); setPreviewError(undefined); return }
    const id = ++request.current, controller = new AbortController()
    // Wait for the user to stop clicking before reading the conversation again.
    const timer = setTimeout(() => {
      call<ContextPreview | null>('contextPreview', { sessionId, mode, turns, ...(mode === 'selected' ? { ids: selected } : {}) }, controller.signal)
        .then(value => { if (id === request.current) { setPreview(value); setPreviewError(undefined) } }, (error: Error) => { if (id === request.current && !controller.signal.aborted) { setPreview(undefined); setPreviewError(error.message) } })
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [sessionId, key])
  const loadEntries = (): void => {
    setEntriesError(undefined)
    call<{ entries: ContextEntry[] }>('contextEntries', { sessionId }).then(value => setEntries(value.entries), (error: Error) => setEntriesError(error.message))
  }
  // Read the conversation again each time the list opens: new messages may have arrived since.
  useEffect(() => { if (picking) loadEntries() }, [picking])
  useEffect(() => { setEntries(undefined); setPicking(false) }, [sessionId])
  const toggle = (id: number): void => onSelected(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id].sort((a, b) => a - b))
  const summary = mode === 'none' ? t("各版只看到你写的需求，不带入主对话内容。")
    : previewError ? previewError
    : preview === undefined ? t("正在读取主对话…")
    : preview === null ? (mode === 'selected' ? t("还没有勾选消息；各版只看到需求。") : t("主对话里还没有可带入的内容。"))
    : t("各版都会看到同样的 {0} 条主对话内容，约 {1} 字{2}", { 0: preview.messages, 1: preview.chars.toLocaleString(), 2: preview.truncated ? t("（已按上限截取最新部分）") : '' })
  return <div className="ac-context">
    <div className="ac-settings-row">
      <span className="ac-context-label">{t("主对话上下文")}</span>
      <div className="ac-seg" role="group" aria-label={t("主对话上下文")}>
        {(['none', 'recent', 'selected'] as const).map(value => <button key={value} className={mode === value ? 'on' : ''} aria-pressed={mode === value} disabled={disabled} onClick={() => { onMode(value); if (value === 'selected') setPicking(true) }}>{{ none: t("不带"), recent: t("最近对话"), selected: t("手动选择") }[value]}</button>)}
      </div>
      {mode === 'recent' && <label className="ac-budget"><span className="ac-sr">{t("带入的最近对话轮数")}</span><select aria-label={t("带入的最近对话轮数")} value={turns} disabled={disabled} onChange={event => onTurns(Number(event.target.value))}>{CONTEXT_TURNS.map(value => <option key={value} value={value}>{t("最近 {0} 轮对话", { 0: value })}</option>)}</select></label>}
      {mode === 'selected' && <button className="ac-text-btn" aria-expanded={picking} onClick={() => setPicking(value => !value)}>{picking ? t("收起消息列表") : t("选择消息（已选 {0} 条）", { 0: selected.length })}</button>}
    </div>
    <div className="ac-context-summary" role="status">{summary}{preview ? <details><summary>{t("查看将带入的内容")}</summary><pre className="ac-context-text" tabIndex={0}>{preview.text}</pre></details> : mode !== 'none' ? <div className="ac-context-reserved" aria-hidden="true">{t("查看将带入的内容")}</div> : null}</div>
    {mode === 'selected' && picking && <div className="ac-context-picker" role="group" aria-label={t("选择要带入的主对话消息")}>
      {entriesError ? <p className="ac-feedback" role="alert">{entriesError} <button className="ac-text-btn" onClick={loadEntries}>{t("重新读取")}</button></p>
        : entries === undefined ? <p className="ac-meta" role="status">{t("正在读取主对话…")}</p>
        : entries.length === 0 ? <p className="ac-meta">{t("主对话里还没有可选的消息。")}</p>
        : <>
          <div className="ac-row"><span className="ac-meta">{t("最近 {0} 条消息，按时间排列", { 0: entries.length })}</span><span className="ac-spacer" /><button className="ac-text-btn" onClick={() => onSelected(entries.slice(-4).map(entry => entry.id))}>{t("选最近 4 条")}</button><button className="ac-text-btn" disabled={selected.length === 0} onClick={() => onSelected([])}>{t("清空")}</button></div>
          <ul>{entries.map(entry => <li key={entry.id} className={selected.includes(entry.id) ? 'on' : ''}><label><input type="checkbox" checked={selected.includes(entry.id)} onChange={() => toggle(entry.id)} /><span className={`ac-context-role ${entry.role}`}>{t(ROLE[entry.role])}</span><span className="ac-context-preview">{entry.text}</span>{entry.chars > 400 && <span className="ac-meta">{t("共 {0} 字", { 0: entry.chars.toLocaleString() })}</span>}</label></li>)}</ul>
        </>}
    </div>}
  </div>
}

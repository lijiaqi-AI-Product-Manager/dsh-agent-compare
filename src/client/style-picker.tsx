/**
 * How many versions, which style each one gets, and whether the comparison is
 * blind. Choices are saved per conversation; the host validates them again.
 * A custom style is saved only once it has a description.
 */
import React, { useEffect, useState } from 'react'
import { currentLocale, t } from './i18n.js'
import { BALANCED_STYLE, CUSTOM_STYLE, DEFAULT_STYLE_IDS, MAX_CUSTOM_STYLE, STYLE_CATALOG, STYLE_GROUPS, styleById } from './style-catalog.js'
import type { StyleStat } from './model.js'

export interface StyleChoice { id: string; note?: string }
export const MIN_VERSIONS = 2
export const MAX_VERSIONS = 4
const LETTERS = ['A', 'B', 'C', 'D'] as const

/** The interface name of a style, as it appears in this language. */
export function styleName(choice: StyleChoice): string {
  if (choice.id === CUSTOM_STYLE) return choice.note ? t("自定义：{0}", { 0: choice.note }) : t("自定义")
  const style = styleById(choice.id)
  return style ? t(style.name) : choice.id
}

/** Localise known style labels without translating a user's custom description. */
export function revealedStyleName(style: { id: string; title: string }): string {
  const known = styleById(style.id)
  if (known) return currentLocale() === 'en' ? t(known.name) : style.title
  if (style.id === CUSTOM_STYLE && style.title.startsWith('自定义 · ')) return `${t("自定义")} · ${style.title.slice('自定义 · '.length)}`
  return t(style.title)
}

/** The styles for `count` versions: keep what was chosen, then add defaults not used yet. */
export function stylesFor(count: number, current: readonly StyleChoice[] | undefined): StyleChoice[] {
  const kept = (current ?? []).slice(0, count)
  const defaults = DEFAULT_STYLE_IDS[count] ?? DEFAULT_STYLE_IDS[2]!
  const used = new Set(kept.map(choice => choice.id))
  const extra = [...defaults, ...STYLE_CATALOG.map(style => style.id)].filter(id => !used.has(id))
  while (kept.length < count) kept.push({ id: extra.shift() ?? defaults[kept.length] ?? 'bold' })
  return kept
}

export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: ReadonlyArray<{ value: T; text: string; title?: string }>; onChange(value: T): void; disabled?: boolean }): React.ReactElement {
  return <div className="ac-seg" role="group" aria-label={label}>
    {options.map(option => <button key={String(option.value)} type="button" className={value === option.value ? 'on' : ''} aria-pressed={value === option.value} disabled={disabled} {...(option.title ? { title: option.title } : {})} onClick={() => { if (value !== option.value) onChange(option.value) }}>{option.text}</button>)}
  </div>
}

export function VersionsControl({ value, onChange, disabled }: { value: number; onChange(value: number): void; disabled?: boolean }): React.ReactElement {
  return <Segmented label={t("版本数")} value={value} disabled={disabled} onChange={onChange}
    options={[2, 3, 4].map(n => ({ value: n, text: t("{0} 版", { 0: n }), title: n === 2 ? t("两版并排，最快") : t("{0} 版同时生成，用量约为单版的 {0} 倍", { 0: n }) }))} />
}

export function BlindControl({ blind, onChange, disabled }: { blind: boolean; onChange(blind: boolean): void; disabled?: boolean }): React.ReactElement {
  return <Segmented label={t("比较时是否显示风格")} value={blind ? 'blind' : 'open'} disabled={disabled} onChange={value => onChange(value === 'blind')}
    options={[{ value: 'blind', text: t("盲选"), title: t("选完再揭晓每一版的风格和模型，避免先入为主") }, { value: 'open', text: t("公开对比"), title: t("一开始就显示每一版的风格和模型") }]} />
}

/** One version's style: presets grouped by what they change, plus a custom description. */
export function StylePicker({ index, choice, open, onChange, disabled, shared }: { index: number; choice: StyleChoice; open: boolean; onChange(choice: StyleChoice): void; disabled?: boolean; shared?: boolean }): React.ReactElement {
  const [pending, setPending] = useState(false)
  const [note, setNote] = useState(choice.note ?? '')
  useEffect(() => { setNote(choice.note ?? ''); if (choice.id === CUSTOM_STYLE) setPending(false) }, [choice.id, choice.note])
  const custom = pending || choice.id === CUSTOM_STYLE
  const commit = (): void => {
    const text = note.replace(/\s+/g, ' ').trim()
    if (text && (text !== choice.note || choice.id !== CUSTOM_STYLE)) onChange({ id: CUSTOM_STYLE, note: text })
  }
  const style = styleById(choice.id)
  const label = shared ? t("各版共用的风格") : open ? t("{0} 的风格", { 0: LETTERS[index] }) : t("第 {0} 种风格", { 0: index + 1 })
  return <span className={`ac-style-slot${custom ? ' custom' : ''}`}>
    {!shared && <span className="ac-style-badge" aria-hidden="true">{open ? LETTERS[index] : index + 1}</span>}
    <select aria-label={label} disabled={disabled} value={custom ? CUSTOM_STYLE : choice.id} title={style ? t(style.hint) : choice.note ?? ''}
      onChange={event => { const id = event.target.value; if (id === CUSTOM_STYLE) { setPending(true); return } setPending(false); onChange({ id }) }}>
      {shared && <option value={BALANCED_STYLE.id}>{t(BALANCED_STYLE.name)}</option>}
      {STYLE_GROUPS.map(group => <optgroup key={group.id} label={t(group.name)}>{STYLE_CATALOG.filter(s => s.group === group.id).map(s => <option key={s.id} value={s.id}>{t(s.name)}</option>)}</optgroup>)}
      <optgroup label={t("自定义")}><option value={CUSTOM_STYLE}>{t("自定义…")}</option></optgroup>
    </select>
    {custom && <input type="text" className="ac-style-note" aria-label={t("{0}：自定义描述", { 0: label })} maxLength={MAX_CUSTOM_STYLE} value={note} disabled={disabled}
      placeholder={t("例如：像复古游戏机")} onChange={event => setNote(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit() } if (event.key === 'Escape' && pending) { event.preventDefault(); setPending(false) } }} />}
  </span>
}

/** The styles of every version, with how a blind comparison assigns them. */
export function StyleSlots({ styles, blind, onChange, disabled }: { styles: readonly StyleChoice[]; blind: boolean; onChange(styles: StyleChoice[]): void; disabled?: boolean }): React.ReactElement {
  const last = LETTERS[styles.length - 1]
  return <div className="ac-style-row" role="group" aria-label={t("各版风格")}>
    <span className="ac-style-row-label">{t("风格")}</span>
    {styles.map((choice, index) => <StylePicker key={index} index={index} choice={choice} open={!blind} disabled={disabled}
      onChange={next => onChange(styles.map((item, at) => at === index ? next : item))} />)}
    <span className="ac-meta">{blind ? t("开始时随机分到 A–{0}，选完再揭晓", { 0: last }) : t("按顺序对应 A–{0}，比较时直接显示", { 0: last })}</span>
  </div>
}

/** The styles this user picked most often, once there is enough history to say so. */
export function StyleHabit({ load }: { load(): Promise<{ comparisons: number; styles: StyleStat[] }> }): React.ReactElement | null {
  const [stats, setStats] = useState<{ comparisons: number; styles: StyleStat[] }>()
  useEffect(() => {
    let active = true
    load().then(value => { if (active) setStats(value) }, () => {})
    return () => { active = false }
  }, [])
  const top = stats?.styles.filter(style => style.picked > 0).slice(0, 2) ?? []
  if (!stats || stats.comparisons < 3 || top.length === 0) return null
  return <span className="ac-meta ac-style-habit">{t("你常选：")}{top.map(style => `${style.id === CUSTOM_STYLE ? t("自定义") : styleName({ id: style.id })} ${style.picked}/${style.offered}`).join(t("、"))}</span>
}

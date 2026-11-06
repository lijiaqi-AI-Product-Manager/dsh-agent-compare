import { messages } from './messages.js'

export type Locale = 'zh-CN' | 'en'
export type LocalePreference = 'auto' | Locale
type Parameters = Readonly<Record<string, string | number | boolean | undefined>>
const KEY = 'agent-compare.interface-language.v1'
let preference: LocalePreference | undefined
const listeners = new Set<() => void>()
function valid(value: unknown): value is LocalePreference { return value === 'auto' || value === 'zh-CN' || value === 'en' }
export function languagePreference(): LocalePreference {
  if (preference !== undefined) return preference
  try { const saved: unknown = typeof window === 'undefined' ? null : window.localStorage.getItem(KEY); preference = valid(saved) ? saved : 'auto' }
  catch { preference = 'auto' }
  return preference
}
export function currentLocale(): Locale {
  const selected = languagePreference()
  if (selected !== 'auto') return selected
  const languages = typeof navigator === 'undefined' ? ['zh-CN'] : navigator.languages?.length ? navigator.languages : [navigator.language]
  return /^zh(?:-|$)/i.test(languages[0] ?? '') ? 'zh-CN' : 'en'
}
export function localeSnapshot(): string { return `${languagePreference()}/${currentLocale()}` }
const notify = (): void => { for (const listener of listeners) listener() }
function stored(event: StorageEvent): void {
  if (event.key !== KEY && event.key !== null) return
  preference = valid(event.newValue) ? event.newValue : 'auto'
  notify()
}
export function subscribeLocale(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined') { window.addEventListener('storage', stored); window.addEventListener('languagechange', notify) }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && typeof window !== 'undefined') { window.removeEventListener('storage', stored); window.removeEventListener('languagechange', notify) }
  }
}
export function setLanguagePreference(value: LocalePreference): void {
  if (!valid(value)) throw new Error('Unsupported interface language')
  preference = value
  try { if (typeof window !== 'undefined') window.localStorage.setItem(KEY, value) } catch { /* Keep the choice in memory when browser storage is unavailable. */ }
  notify()
}
const reverse = new Map(Object.entries(messages).map(([source, translated]) => [translated, source]))
const fill = (text: string, parameters?: Parameters): string => text.replace(/\{(\d+)\}/g, (original, key: string) => parameters?.[key] === undefined ? original : String(parameters[key]))
export function t(value: string, parameters?: Parameters): string
export function t(value: string | undefined, parameters?: Parameters): string | undefined
export function t(value: string | undefined, parameters?: Parameters): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  const source = Object.hasOwn(messages, trimmed) ? trimmed : reverse.get(value) ?? reverse.get(trimmed)
  if (source === undefined) return fill(value, parameters)
  if (currentLocale() === 'zh-CN') return fill(source === trimmed ? value : source, parameters)
  const translated = messages[source]!
  const leading = /^\s*/.exec(value)![0], trailing = /\s*$/.exec(value)![0]
  return fill(`${leading}${translated}${trailing}`, parameters)
}
/** Unknown diagnostics stay verbatim; the UI labels them as original evidence. */
export function translatedDiagnostic(value: string): string | undefined {
  const translated = t(value)
  if (currentLocale() === 'zh-CN' || translated !== value || !/[\u3400-\u9fff]/.test(value)) return translated
  return undefined
}

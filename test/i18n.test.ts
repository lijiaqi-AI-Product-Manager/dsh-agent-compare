import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFile, readdir } from 'node:fs/promises'
import { currentLocale, languagePreference, localeSnapshot, setLanguagePreference, subscribeLocale, t, translatedDiagnostic } from '../src/client/i18n.ts'
import { messages } from '../src/client/messages.ts'

const KEY = 'agent-compare.interface-language.v1'
let storage: Map<string, string>, events: EventTarget
beforeEach(() => {
  storage = new Map(); events = new EventTarget()
  vi.stubGlobal('window', Object.assign(events, { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value) } } }))
  vi.stubGlobal('navigator', { languages: ['en-US'], language: 'en-US' })
  setLanguagePreference('auto')
})
afterEach(() => { vi.unstubAllGlobals() })

describe('interface language', () => {
  it('follows the preferred device language, with explicit choices taking precedence', () => {
    expect(currentLocale()).toBe('en')
    vi.stubGlobal('navigator', { languages: ['zh-Hant', 'en-US'] })
    expect(currentLocale()).toBe('zh-CN')
    setLanguagePreference('en'); expect(currentLocale()).toBe('en')
    expect(storage.get(KEY)).toBe('en')
    setLanguagePreference('auto'); expect(currentLocale()).toBe('zh-CN')
    expect(languagePreference()).toBe('auto')
  })
  it('notifies for an explicit choice even when its effective language equals the device default', () => {
    const changed = vi.fn(), dispose = subscribeLocale(changed), first = localeSnapshot()
    setLanguagePreference('en')
    expect(localeSnapshot()).not.toBe(first); expect(changed).toHaveBeenCalledOnce()
    dispose(); setLanguagePreference('zh-CN'); expect(changed).toHaveBeenCalledOnce()
  })
  it('synchronizes storage changes across tabs and releases its subscriptions', () => {
    const changed = vi.fn(), dispose = subscribeLocale(changed)
    const event = Object.assign(new Event('storage'), { key: KEY, newValue: 'zh-CN' })
    events.dispatchEvent(event)
    expect(currentLocale()).toBe('zh-CN'); expect(changed).toHaveBeenCalledOnce()
    dispose(); events.dispatchEvent(Object.assign(new Event('storage'), { key: KEY, newValue: 'en' }))
    expect(changed).toHaveBeenCalledOnce()
  })
  it('keeps the in-memory selection if persistent browser storage is unavailable', () => {
    Object.defineProperty(window, 'localStorage', { get: () => { throw new Error('storage unavailable') }, configurable: true })
    expect(() => setLanguagePreference('en')).not.toThrow()
    expect(currentLocale()).toBe('en')
  })
  it('formats translated labels without interpreting parameter values or changing unknown content', () => {
    setLanguagePreference('en')
    expect(t('候选 {0}', { 0: 'A' })).toBe('Candidate A')
    expect(t('候选 {0}', { 0: '<img src=x onerror=alert(1)>' })).toBe('Candidate <img src=x onerror=alert(1)>')
    expect(t('user-provided content')).toBe('user-provided content')
    expect(t(undefined)).toBeUndefined()
    setLanguagePreference('zh-CN')
    expect(t('候选 {0}', { 0: 'B' })).toBe('候选 B')
    expect(t('Retry')).toBe('重试')
  })
  it('preserves unrecognized diagnostic evidence instead of inventing a translation', () => {
    setLanguagePreference('en')
    expect(translatedDiagnostic('磁盘提供程序返回了未识别错误 <raw>')).toBeUndefined()
    expect(translatedDiagnostic('包服务连接或证书检查失败')).toBe('Package registry connection or certificate check failed')
    expect(translatedDiagnostic('ENOSPC: disk full')).toBe('ENOSPC: disk full')
    setLanguagePreference('zh-CN')
    expect(translatedDiagnostic('磁盘提供程序返回了未识别错误 <raw>')).toBe('磁盘提供程序返回了未识别错误 <raw>')
  })
  it('translates exact copy including intentional surrounding whitespace', () => {
    setLanguagePreference('en')
    for (const [source, translated] of Object.entries(messages)) expect(t(source), source).toBe(translated)
    expect(t(' \n候选 {0}\t', { 0: 'A' })).toBe(' \nCandidate A\t')
    setLanguagePreference('zh-CN')
    expect(t('进程兼容方式 ')).toBe('进程兼容方式 ')
    expect(t(' · 观察到的触发：')).toBe(' · 观察到的触发：')
  })
  it('covers every explicit interface-copy call with an English entry', async () => {
    const directory = new URL('../src/client/', import.meta.url)
    for (const name of (await readdir(directory, { recursive: true })).filter(name => /\.tsx?$/.test(name))) {
      const source = await readFile(new URL('../src/client/' + name, import.meta.url), 'utf8')
      for (const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g)) {
        const key: string = match[1]!.startsWith('"') ? JSON.parse(match[1]!) : match[1]!.slice(1, -1)
        expect(messages[key] ?? messages[key.trim()], `Missing English copy in ${name}: ${key}`).toBeDefined()
      }
    }
    for (const [key, value] of Object.entries(messages)) {
      expect(value, key).not.toMatch(/[\u3400-\u9fff]/)
      expect([...value.matchAll(/\{\d+\}/g)].map(x => x[0]).sort(), key).toEqual([...key.matchAll(/\{\d+\}/g)].map(x => x[0]).sort())
    }
  })
})

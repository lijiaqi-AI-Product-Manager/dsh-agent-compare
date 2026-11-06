import React, { useState, useSyncExternalStore } from 'react'
import { currentLocale, languagePreference, localeSnapshot, setLanguagePreference, subscribeLocale, t, translatedDiagnostic, type LocalePreference } from './i18n.js'

export function LanguageControl({ compact = false }: { compact?: boolean }): React.ReactElement {
  useSyncExternalStore(subscribeLocale, localeSnapshot, localeSnapshot)
  return <label className={`ac-language${compact ? ' compact' : ''}`} title={t('语言设置只影响界面，不修改应用或记录。')}>
    <span className={compact ? 'ac-sr' : ''}>{t('界面语言')}</span>
    <select aria-label={t('界面语言')} value={languagePreference()} onChange={event => setLanguagePreference(event.target.value as LocalePreference)}>
      <option value="auto">{t(compact ? '自动' : '跟随系统')}</option><option value="zh-CN">中文</option><option value="en">English</option>
    </select>
  </label>
}

export function Diagnostic({ text }: { text?: string }): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false)
  if (!text) return null
  const translated = translatedDiagnostic(text)
  if (translated !== undefined) return <span>{translated}</span>
  return <span className="ac-diagnostic" lang={currentLocale()}>
    <span>{t('查看原始诊断以了解详情。')}</span>{' '}
    <button type="button" className="ac-text-btn" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{t('原始诊断')}</button>
    <span className="ac-original-diagnostic" hidden={!expanded} lang="zh-CN">{text}</span>
  </span>
}

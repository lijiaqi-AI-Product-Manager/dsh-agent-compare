/**
 * The interface and the backend of this plugin update separately: DSH reloads
 * a plugin's interface at once, but keeps running the backend it loaded when
 * it started. Report that mismatch and let the user save their draft before
 * restarting DSH.
 */
import { Banner } from './review.js'
import React, { useEffect, useState } from 'react'
import { t } from './i18n.js'

declare const __AC_CLIENT_VERSION__: string | undefined
/** Set by the build; absent when the source runs unbundled. */
export const CLIENT_VERSION: string | undefined = typeof __AC_CLIENT_VERSION__ === 'string' ? __AC_CLIENT_VERSION__ : undefined

type Call = <T>(method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<T>
/** What the backend says about itself: a version, `older` when it predates the version route, or nothing to report. */
export type Backend = { version: string } | { older: true } | undefined

let asked: Promise<Backend> | undefined
/** Share a confirmed version across the page. A later view can retry a temporary failure. */
export function backendVersion(call: Call): Promise<Backend> {
  if (asked) return asked
  const pending = call<{ pluginVersion?: unknown }>('version', {}).then(
    value => typeof value?.pluginVersion === 'string' ? { version: value.pluginVersion } : undefined,
    (error: Error) => /unknown method/i.test(error.message) ? { older: true } as const : undefined,
  )
  asked = pending
  void pending.then(backend => { if (backend === undefined && asked === pending) asked = undefined })
  return pending
}

/** The backend DSH is running, when it is not the one this interface belongs to. */
export function useStaleBackend(call: Call): Backend {
  const [stale, setStale] = useState<Backend>()
  useEffect(() => {
    let active = true
    if (CLIENT_VERSION === undefined) return
    void backendVersion(call).then(backend => {
      if (!active || backend === undefined) return
      if ('older' in backend || backend.version !== CLIENT_VERSION) setStale(backend)
    })
    return () => { active = false }
  }, [call])
  return stale
}

/** A plain, prominent request to restart DSH. */
export function StaleBackendNotice({ call }: { call: Call }): React.ReactElement | null {
  const stale = useStaleBackend(call)
  if (stale === undefined) return null
  const running = 'version' in stale ? stale.version : t('3.1.0 之前的版本')
  return <Banner className="ac-feedback ac-stale-backend" tone="warn" role="alert">
    <b>{t('请完全退出并重新打开 DSH')}</b>
    <span>{t('当前界面版本为 {0}，DSH 加载的后台版本为 {1}。保存输入框里的草稿，重启后再开始新的比较。', { 0: CLIENT_VERSION ?? '', 1: running })}</span>
  </Banner>
}

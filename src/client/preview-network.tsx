import React, { useCallback, useEffect, useRef, useState } from 'react'
import { t } from './i18n.js'
import { Diagnostic } from './language.js'

export interface PreviewNetworkStatus { platform: string; state: 'not-required' | 'needs-setup' | 'ready' | 'configuring' | 'unavailable'; available: number; configured: number; used: number; unconfirmed: number; diagnostic?: string }
export type NetworkRequest = (method: string, body: Record<string, unknown>, signal?: AbortSignal) => Promise<PreviewNetworkStatus>
export function macWebKit(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /Macintosh/.test(userAgent) && /AppleWebKit/.test(userAgent) && !/Chrome|Chromium|Edg\/|OPR\/|Firefox|FxiOS/.test(userAgent)
}
export function numericPreviewHost(host: string): boolean {
  const parts=host.split('.')
  return parts.length===4 && parts[0]==='127' && parts.every(part=>/^(?:0|[1-9]\d{0,2})$/.test(part)&&Number(part)<=255) && Number(parts[1])>=64 && Number(parts[1])<=127
}
export function safariSetupRequired(status: PreviewNetworkStatus | undefined): boolean {
  return macWebKit() && (status?.platform==='darwin' || status===undefined) && (status?.state!=='ready' || status.available<2)
}
export function safariPreviewBlocked(url: string | undefined): boolean {
  if(!url || !macWebKit())return false
  try{const host=new URL(url).hostname;return !numericPreviewHost(host) || (typeof location!=='undefined' && host===location.hostname)}catch{return true}
}

export function useSafariPreviewNetwork(sessionId: string | undefined, request: NetworkRequest): { status?: PreviewNetworkStatus; error?: string; refresh(): void; update(value: PreviewNetworkStatus): void } {
  const [status,setStatus]=useState<PreviewNetworkStatus>(),[error,setError]=useState<string>(),[retry,setRetry]=useState(0)
  useEffect(()=>{
    if(!sessionId || !macWebKit())return
    let active=true,pending=false
    const controller=new AbortController()
    const refresh=async():Promise<void>=>{
      if(pending || document.visibilityState==='hidden')return
      pending=true
      try {const value=await request('previewNetworkStatus',{sessionId},controller.signal);if(active){setStatus(value);setError(undefined)}}
      catch(cause){if(active)setError((cause as Error).message)}finally{pending=false}
    }
    void refresh();const timer=setInterval(()=>{void refresh()},10000)
    return()=>{active=false;controller.abort();clearInterval(timer)}
  },[sessionId,request,retry])
  return {status,error,update:setStatus,refresh:useCallback(()=>setRetry(value=>value+1),[])}
}

export function SafariPreviewSetup({sessionId,status,error,request,onStatus,onRefresh}:{sessionId?:string;status?:PreviewNetworkStatus;error?:string;request:NetworkRequest;onStatus?(value:PreviewNetworkStatus):void;onRefresh?():void}):React.ReactElement|null {
  const [expanded,setExpanded]=useState(false),[busy,setBusy]=useState(false),[failure,setFailure]=useState<string>()
  const mounted=useRef(true)
  const container=useRef<HTMLElement|null>(null),review=useRef<HTMLDivElement|null>(null),trigger=useRef<HTMLButtonElement|null>(null)
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[])
  useEffect(()=>{if(expanded)review.current?.focus()},[expanded])
  const returnFocus=():void=>{requestAnimationFrame(()=>{if(mounted.current)(trigger.current??container.current)?.focus()})}
  const dismiss=():void=>{if(busy)return;setExpanded(false);setFailure(undefined);returnFocus()}
  if(!macWebKit() || status?.platform==='win32' || status?.platform==='linux' || status?.state==='not-required')return null
  const enable=async():Promise<void>=>{
    if(!sessionId || busy)return
    setBusy(true);setFailure(undefined)
    try {const next=await request('enablePreviewNetwork',{sessionId,confirmed:true});if(mounted.current){onStatus?.(next);setExpanded(false);onRefresh?.();returnFocus()}}
    catch(cause){if(mounted.current){setFailure((cause as Error).message);onRefresh?.()}}
    finally{if(mounted.current)setBusy(false)}
  }
  return <section ref={container} tabIndex={-1} className="ac-preview-network" role="region" aria-label={t("Safari 实时比较设置")}>
    <div className="ac-row"><strong>{status?.state==='ready'?t("Safari 实时比较已就绪"):t("启用 Safari 实时比较")}</strong>{status && <span>{t("可用预览地址：{0}",{0:status.available})}</span>}</div>
    {!status && !error && <p role="status">{t("正在读取 Safari 预览环境…")}</p>}
    {(failure || error || status?.diagnostic) && <div role="alert"><Diagnostic text={failure??error??status?.diagnostic}/>{onRefresh && <button className="ac-text-btn" disabled={busy} onClick={onRefresh}>{t("重新检查预览环境")}</button>}</div>}
    {!!status?.unconfirmed && <p>{t("上次配置中有未确认的地址，已保留记录；不会重新分配这些地址。")}</p>}
    {status && status.state!=='unavailable' && status.state!=='configuring' && status.available<2 && !expanded && <><p>{t("Safari 需要独立本机地址来隔离两版状态。只在你确认后请求系统授权，需求和历史记录保留。")}</p><button ref={trigger} className="ac-btn" disabled={!sessionId || busy} onClick={()=>setExpanded(true)}>{t("启用 Safari 实时比较")}</button></>}
    {status?.state==='configuring' && <p role="status">{t("本机预览地址正在配置，请完成或取消系统授权后重新检查。")}</p>}
    {expanded && <div ref={review} tabIndex={-1} className="ac-review" role="region" aria-label={t("确认本机地址配置")} onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.preventDefault();event.stopPropagation();dismiss()}}}><div><p>{t("将为 AgentCompare 添加 64 个专用回环地址，仅用于本机预览。系统重启后地址释放；再次启用会使用新的地址。")}</p><p>{t("不修改 DNS、证书、防火墙或永久启动项，不删除已有地址。管理员验证只在系统窗口中完成，插件不读取或保存密码。")}</p><p>{t("嵌入页面仍受 Safari 的 Cookie 策略限制；需要第一方存储时，可打开真实标签页继续交互。")}</p></div><div className="ac-row"><button className="ac-btn" disabled={busy} onClick={dismiss}>{t("暂不启用")}</button><button className="ac-btn primary" disabled={busy || !sessionId} onClick={()=>{void enable()}}>{busy?t("等待系统授权…"):t("继续并请求系统授权")}</button></div></div>}
  </section>
}

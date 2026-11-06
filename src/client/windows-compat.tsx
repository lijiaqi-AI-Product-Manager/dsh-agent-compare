import React from 'react'
import { t } from './i18n.js'
export type WindowsProcessCompatMode = 'auto' | 'off'
export interface WindowsCompatEvidence {
  mode: WindowsProcessCompatMode | 'not-required' | 'unknown'
  observedHooks: Array<'esbuild-service' | 'esbuild-version' | 'vite-net-use'>
}

export function WindowsProcessControl({ mode = 'auto', disabled, onChange }: { mode?: WindowsProcessCompatMode; disabled: boolean; onChange(mode: WindowsProcessCompatMode): void }): React.ReactElement {
  return <details className="ac-details"><summary>{t('Windows 高级设置')}</summary>
    <label className="ac-budget ac-process-control">{t('进程兼容方式 ')}<select aria-label={t('Windows 进程兼容方式')} disabled={disabled} value={mode} onChange={event => onChange(event.target.value as WindowsProcessCompatMode)}>
      <option value="auto">{t('自动（推荐）')}</option><option value="off">{t('关闭兼容层')}</option>
    </select></label>
    <p className="ac-meta">{t('为 Windows 受限进程适配 esbuild 管道和 Vite 探测。关闭后保留宿主约束、锁文件和全部检查；部分项目可能无法启动。设置仅用于之后开始的比较，已开始的比较和历史记录保留原设置。')}</p>
  </details>
}

export function WindowsProcessEvidence({ value, failed }: { value?: WindowsCompatEvidence; failed: boolean }): React.ReactElement | null {
  if (!value || value.mode === 'not-required') return null
  const names = { 'esbuild-service': t('esbuild 服务管道'), 'esbuild-version': t('esbuild 版本探测'), 'vite-net-use': t('Vite 网络盘探测') }
  return <div className="ac-meta">
    <div>{t('Windows 进程兼容：')}{value.mode === 'auto' ? t('自动开启') : value.mode === 'off' ? t('已关闭') : t('未记录')}{t(' · 观察到的触发：')}{value.observedHooks.length ? value.observedHooks.map(hook => names[hook]).join(' · ') : t('未观察到')}</div>
    {failed && value.mode === 'auto' && <p>{t('如怀疑工具链与兼容层冲突，可在下一次比较前打开「Windows 高级设置」并关闭兼容层。原候选和验收记录会保留；关闭不会放宽宿主权限。')}</p>}
  </div>
}

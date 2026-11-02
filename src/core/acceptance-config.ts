import path from 'node:path'
import type { BrowserCheck, BrowserStep } from './types.ts'

export interface AcceptanceConfig {
  readonly scripts?: string[]
  readonly protectedFiles?: string[]
  readonly browser?: BrowserCheck
}

function invalid(where: string, detail: string): never { throw new Error(`.agent-compare.json ${where}：${detail}`) }
function object(value: unknown, where: string, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(where, '必须是对象')
  const out = value as Record<string, unknown>
  const unknown = Object.keys(out).filter(key => !keys.includes(key))
  if (unknown.length) invalid(where, `未知字段 ${unknown.join('、')}`)
  return out
}
function text(value: unknown, where: string, max = 2000, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max || value.includes('\0')) return invalid(where, `必须是${empty ? '' : '非空'}文本，最多 ${max} 个字符`)
  return value
}
function integer(value: unknown, where: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) return invalid(where, `必须是 ${min}–${max} 的整数`)
  return value
}
function list(value: unknown, where: string, max: number, item: (value: unknown, where: string) => string): string[] {
  if (!Array.isArray(value) || value.length > max) return invalid(where, `必须是最多 ${max} 项的数组`)
  const items = value.map((v, index) => item(v, `${where}[${index}]`))
  if (new Set(items).size !== items.length) invalid(where, '不允许重复项')
  return items
}

function step(value: unknown, where: string): BrowserStep {
  const actions = ['fill', 'click', 'press', 'expectVisible', 'expectCount', 'expectText', 'viewport']
  const raw = object(value, where, [...actions, 'label', 'text', 'key', 'min', 'max'])
  const selected = actions.filter(key => Object.hasOwn(raw, key))
  if (selected.length !== 1) return invalid(where, '每步必须且只能包含一种操作')
  const action = selected[0]!
  const allowed = [action, 'label', ...(action === 'fill' ? ['text'] : action === 'press' ? ['key'] : action === 'expectCount' ? ['min', 'max'] : [])]
  for (const key of Object.keys(raw)) if (!allowed.includes(key)) invalid(where, `${action} 不接受字段 ${key}`)
  const label = raw.label === undefined ? {} : { label: text(raw.label, `${where}.label`, 200) }
  if (action === 'viewport') {
    const viewport = object(raw.viewport, `${where}.viewport`, ['width', 'height'])
    return { viewport: { width: integer(viewport.width, `${where}.viewport.width`, 1, 4096), height: integer(viewport.height, `${where}.viewport.height`, 1, 4096) }, ...label }
  }
  const target = text(raw[action], `${where}.${action}`, action === 'expectText' ? 10000 : 2000)
  if (action === 'fill') return { fill: target, text: text(raw.text, `${where}.text`, 10000, true), ...label }
  if (action === 'press') return { press: target, key: text(raw.key, `${where}.key`, 100), ...label }
  if (action === 'expectCount') {
    if (raw.min === undefined && raw.max === undefined) return invalid(where, '数量检查至少需要 min 或 max')
    const min = raw.min === undefined ? undefined : integer(raw.min, `${where}.min`, 0, 100000)
    const max = raw.max === undefined ? undefined : integer(raw.max, `${where}.max`, 0, 100000)
    if (min !== undefined && max !== undefined && min > max) invalid(where, 'min 不能大于 max')
    return { expectCount: target, ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }), ...label }
  }
  if (action === 'click') return { click: target, ...label }
  if (action === 'expectVisible') return { expectVisible: target, ...label }
  return { expectText: target, ...label }
}

export function parseBrowserCheck(value: unknown): BrowserCheck {
  const raw = object(value, 'browser', ['path', 'expectText', 'expectSelector', 'failOnConsoleError', 'mobileShot', 'steps'])
  const out: Record<string, unknown> = {}
  if (raw.path !== undefined) {
    const route = text(raw.path, 'browser.path')
    if (!route.startsWith('/') || route.startsWith('//') || route.includes('\\') || new URL(route, 'http://127.0.0.1').origin !== 'http://127.0.0.1') invalid('browser.path', '必须是当前应用内的绝对路径')
    out.path = route
  }
  for (const key of ['expectText', 'expectSelector'] as const) if (raw[key] !== undefined) out[key] = text(raw[key], `browser.${key}`, key === 'expectText' ? 10000 : 2000)
  for (const key of ['failOnConsoleError', 'mobileShot'] as const) if (raw[key] !== undefined) {
    if (typeof raw[key] !== 'boolean') invalid(`browser.${key}`, '必须是布尔值')
    out[key] = raw[key]
  }
  if (raw.steps !== undefined) {
    if (!Array.isArray(raw.steps) || raw.steps.length > 100) invalid('browser.steps', '必须是最多 100 项的数组')
    out.steps = raw.steps.map((value, index) => step(value, `browser.steps[${index}]`))
  }
  return out as BrowserCheck
}

/** Validate the baseline definition before any candidate starts. */
export function parseAcceptanceConfig(value: unknown, availableScripts: Readonly<Record<string, string>>): AcceptanceConfig {
  const raw = object(value, '配置', ['browser', 'scripts', 'protectedFiles'])
  const scripts = raw.scripts === undefined ? undefined : list(raw.scripts, 'scripts', 50, (v, where) => {
    const script = text(v, where, 200)
    if (!Object.hasOwn(availableScripts, script)) invalid(where, `package.json 中不存在脚本 ${script}`)
    return script
  })
  const protectedFiles = raw.protectedFiles === undefined ? undefined : list(raw.protectedFiles, 'protectedFiles', 512, (v, where) => {
    const file = text(v, where, 512)
    if (path.posix.isAbsolute(file) || path.win32.isAbsolute(file) || file.includes('\\') || file.includes(':') || file.split('/').some(part => !part || part === '.' || part === '..') || /[*?\[\]]/.test(file)) invalid(where, '必须是仓库内的具体相对文件路径，不接受通配符')
    return file
  })
  return { ...(scripts === undefined ? {} : { scripts }), ...(protectedFiles === undefined ? {} : { protectedFiles }), ...(raw.browser === undefined ? {} : { browser: parseBrowserCheck(raw.browser) }) }
}

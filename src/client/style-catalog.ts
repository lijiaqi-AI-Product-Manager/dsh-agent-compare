/**
 * The styles the settings strip offers, grouped the way people tell results
 * apart: how far the change goes, how it looks and reads, and what it puts
 * first. Ids match `src/core/styles.ts`; the host validates every choice.
 * `name` and `hint` are interface copy, translated where they are shown.
 */
export type StyleGroupId = 'approach' | 'look' | 'focus'
export interface CatalogStyle { readonly id: string; readonly name: string; readonly english: string; readonly group: StyleGroupId; readonly hint: string }

export const STYLE_GROUPS: ReadonlyArray<{ readonly id: StyleGroupId; readonly name: string }> = [
  { id: 'approach', name: '改动幅度' },
  { id: 'look', name: '视觉气质' },
  { id: 'focus', name: '优先目标' },
]

export const STYLE_CATALOG: readonly CatalogStyle[] = [
  { id: 'conservative', name: '稳妥', english: 'Conservative', group: 'approach', hint: '沿用现有写法，改动最小' },
  { id: 'bold', name: '大胆', english: 'Bold', group: 'approach', hint: '重新思考布局与交互' },
  { id: 'minimal', name: '极简', english: 'Minimal', group: 'look', hint: '元素少、留白多，一眼看懂' },
  { id: 'polished', name: '精致', english: 'Polished', group: 'look', hint: '专业质感，层级清楚，状态完整' },
  { id: 'vibrant', name: '活力', english: 'Vibrant', group: 'look', hint: '色彩、动效与个性' },
  { id: 'friendly', name: '易用', english: 'Friendly', group: 'focus', hint: '新手友好，可访问，手机优先' },
  { id: 'rigorous', name: '严谨', english: 'Rigorous', group: 'focus', hint: '校验、边界情况与测试' },
  { id: 'lean', name: '轻快', english: 'Lean', group: 'focus', hint: '代码少、加载快、不加依赖' },
]

/** Cross-model comparisons share one style; balanced adds no direction of its own. */
export const BALANCED_STYLE: CatalogStyle = { id: 'balanced', name: '均衡', english: 'Balanced', group: 'approach', hint: '不额外指定方向，只比较模型' }
export const CUSTOM_STYLE = 'custom'
export const MAX_CUSTOM_STYLE = 120

/** Defaults per number of versions; the host uses the same ones. */
export const DEFAULT_STYLE_IDS: Readonly<Record<number, readonly string[]>> = {
  2: ['conservative', 'bold'],
  3: ['conservative', 'bold', 'minimal'],
  4: ['conservative', 'bold', 'minimal', 'vibrant'],
}

export const styleById = (id: string): CatalogStyle | undefined => id === BALANCED_STYLE.id ? BALANCED_STYLE : STYLE_CATALOG.find(style => style.id === id)

import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { git } from './git.ts'

/**
 * The built-in case. Its requirements are explicit and the DOM contract is
 * stated, so the example repository's `.agent-compare.json` can check that
 * both versions actually deliver them, not only that they render.
 */
export const EXAMPLE_TASK = [
  '给商品列表加上搜索框和分类筛选，手机上也要好用。',
  '要求：',
  '1. 搜索框按商品名称过滤，不区分大小写；',
  '2. 分类筛选可以和搜索同时生效；',
  '3. 有一个「清空」按钮，一次恢复显示全部商品；',
  '4. 宽度 390px 的手机屏幕上，搜索框和分类筛选都能直接使用。',
  '页面约定（验收会按这些来检查）：搜索框是 <input type="search">；每个商品卡片带 data-testid="product-card"；每个分类按钮带 aria-pressed 并显示分类名（Audio / Desk / Bags / Light）；清空按钮的文字是「清空」。',
].join('\n')

export type ExampleKind = 'quick' | 'full'
export const QUICK_EXAMPLE_TASK = [
  '给现有商品列表加上搜索和清空，保持现有商品内容。',
  '要求：使用 <input type="search"> 按商品名称过滤，不区分大小写；有一个文字为「清空」的按钮，点击后清空搜索并恢复全部 8 个商品。',
  '每个可见商品卡片带 data-testid="product-card"；搜索框有可访问名称。沿用项目现有依赖，不增加分类筛选或其他功能。',
].join('\n')

/** Each example binds its own requirements before either candidate starts. */
export const exampleTask = (kind: ExampleKind): string => kind === 'quick' ? QUICK_EXAMPLE_TASK : EXAMPLE_TASK

/** The template shipped in the package: `<package>/examples/vite-react-demo`. */
export function exampleTemplateDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'examples', 'vite-react-demo')
}

/**
 * Create a fresh, committed example repository under `parent` (a new folder
 * each time; nothing existing is touched) and return its path.
 */
export async function createExampleRepo(parent: string, template = exampleTemplateDir(), kind: ExampleKind = 'full'): Promise<string> {
  if (kind !== 'quick' && kind !== 'full') throw new Error('invalid example kind')
  if (!existsSync(path.join(template, 'package.json'))) throw new Error(`example template not found: ${template}`)
  await mkdir(parent, { recursive: true })
  const taken = new Set(await readdir(parent))
  let n = 1
  while (taken.has(`shop-${n}`)) n++
  const dir = path.join(parent, `shop-${n}`)
  const skip = (src: string): boolean => path.relative(template, src).split(path.sep).some((seg) => seg === 'node_modules' || seg === 'dist')
  await cp(template, dir, { recursive: true, errorOnExist: true, filter: (src) => !skip(src) })
  if (kind === 'quick') await writeFile(path.join(dir, '.agent-compare.json'), JSON.stringify({ browser: { path: '/', failOnConsoleError: true, steps: [
    { label: '初始显示全部 8 个商品', expectCount: '[data-testid=product-card]', min: 8, max: 8 },
    { label: '搜索 LAMP，不区分大小写', fill: 'input[type=search]', text: 'LAMP' },
    { label: '搜索结果为 1 个', expectCount: '[data-testid=product-card]', min: 1, max: 1 },
    { label: '点击清空', click: 'button:has-text("清空")' },
    { label: '清空后恢复 8 个商品', expectCount: '[data-testid=product-card]', min: 8, max: 8 },
  ] } }, null, 2) + '\n')
  // npm never ships `.gitignore` inside a package, so the published template has none.
  if (!existsSync(path.join(dir, '.gitignore'))) await writeFile(path.join(dir, '.gitignore'), 'node_modules\ndist\n')
  await git(dir, ['init', '-q', '-b', 'main'])
  await git(dir, ['add', '-A'])
  await git(dir, ['-c', 'user.name=AgentCompare example', '-c', 'user.email=example@agent-compare.invalid', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'Example shop'])
  return dir
}

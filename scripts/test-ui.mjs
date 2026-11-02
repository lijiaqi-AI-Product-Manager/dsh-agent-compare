import assert from 'node:assert/strict'
import { mkdtemp, mkdir } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { createUiHarness } from './preview-ui.mjs'

// Real client components and browser interaction, using labelled sample runs.
const harness = await createUiHarness({ port: 0, demoPort: 0 })
const output = process.env.AGENT_COMPARE_UI_ARTIFACTS ?? await mkdtemp(path.join(os.tmpdir(), 'agent-compare-ui-'))
await mkdir(output, { recursive: true })
let browser
let assertions = 0
const check = (value, message) => { assert.ok(value, message); assertions++ }
try {
  browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const open = async (state, extra = '') => {
    await page.emulateMedia({ colorScheme: extra.includes('theme=dark') ? 'dark' : 'light' })
    await page.goto(`${harness.url}/?state=${state}${extra}`)
    await page.getByRole('dialog', { name: 'AgentCompare' }).waitFor()
    if (!['start', 'history', 'guide'].includes(state)) await page.getByRole('region', { name: '候选 A', exact: true }).waitFor()
  }
  const requests = (method) => page.evaluate(m => window.__requests.filter(r => r.method === m), method)

  await open('start')
  const start = page.getByRole('button', { name: '开始比较 →', exact: true })
  await page.locator('#ac-time-limit').waitFor()
  await page.waitForFunction(() => !document.querySelector('form')?.textContent.includes('正在读取当前项目'))
  check(await start.isDisabled(), 'empty project task must not start')
  await page.getByLabel('想比较的需求').fill('Improve search and category navigation')
  await page.getByLabel('每版生成上限').selectOption('60')
  check(await start.isEnabled(), 'one configured model should suffice')
  await page.screenshot({ path: path.join(output, 'setup-desktop.png') })
  await start.click()
  await page.getByRole('region', { name: '候选 A', exact: true }).waitFor()
  const normal = (await requests('start')).at(-1).body
  check(normal.generationMinutes === 60 && normal.mode === 'same-model' && normal.example === false, 'form must submit actual budget and mode')
  check(!normal.task.includes('--minutes') && !normal.task.includes('/ab'), 'task must not be encoded as a command')
  check((await requests('models')).length === 0, 'the default route must not wait for remote model discovery')

  await open('start')
  await page.getByText('体验示例商店', { exact: true }).click()
  await page.getByText('两个模型，同一要求', { exact: true }).click()
  const selectors = page.locator('.ac-models select')
  check(await start.isDisabled(), 'cross-model requires a complete pair')
  await selectors.nth(0).selectOption('deepseek/deepseek-chat')
  await page.waitForFunction(() => document.querySelectorAll('.ac-models select')[1]?.querySelector('option[value="deepseek/deepseek-chat"]')?.disabled)
  check(await selectors.nth(1).locator('option[value="deepseek/deepseek-chat"]').evaluate(option => option.disabled), 'same model must not be selected twice')
  await selectors.nth(1).selectOption('deepseek/deepseek-reasoner')
  await start.click()
  await page.getByRole('region', { name: '候选 A', exact: true }).waitFor()
  const example = (await requests('start')).at(-1).body
  check(example.example === true && example.models.length === 2 && example.task === '', 'example must start with a structured route pair and default task')
  check(example.models[1].model === 'deepseek-reasoner', 'selected model must reach the start request')

  await open('start', '&error=start')
  await page.getByText('体验示例商店', { exact: true }).click()
  await start.click()
  await page.getByRole('alert').filter({ hasText: '请求失败' }).waitFor()
  check(await start.isEnabled(), 'failed start must permit retry')

  await open('start', '&error=setup')
  await page.getByRole('alert').waitFor()
  check(await start.isDisabled(), 'missing configuration must not silently use defaults')
  await page.getByRole('button', { name: '重新读取' }).click()
  await page.waitForFunction(() => window.__requests.filter(r => r.method === 'setup').length === 2)
  check((await requests('setup')).length === 2, 'configuration must be retryable')

  await open('start', '&error=models')
  await page.getByText('体验示例商店', { exact: true }).click()
  await page.getByText('两个模型，同一要求', { exact: true }).click()
  await page.getByRole('button', { name: '重试模型列表' }).waitFor()
  check(await start.isDisabled(), 'failed model discovery must not submit an incomplete pair')
  await page.getByText('一个模型，两种策略', { exact: false }).click()
  check(await start.isEnabled(), 'failed model discovery must not prevent using the current model')

  await open('judging')
  await page.locator('iframe').nth(1).waitFor()
  const frames = page.frames().filter(f => f !== page.mainFrame())
  await Promise.all(frames.map(f => f.waitForLoadState('domcontentloaded')))
  check(frames.length === 2, 'both applications must actually load')
  for (const f of frames) check(await f.evaluate(() => innerWidth) === 1280, 'desktop viewports must match')
  await page.getByRole('button', { name: '手机 390', exact: true }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('iframe')].every(f => f.style.width === '390px'))
  for (const f of frames) check(await f.evaluate(() => innerWidth) === 390, 'phone viewports must match')
  await frames[0].getByPlaceholder('搜索商品').fill('preserved interaction')
  await page.getByRole('button', { name: '专注 A', exact: true }).click()
  check(await page.getByRole('region', { name: '候选 B', exact: true }).count() === 0, 'focused mode must hide the other candidate')
  await page.getByRole('button', { name: '并排比较', exact: true }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('.ac-preview-surface')].every(el => el.clientWidth >= 389))
  check(await frames[0].getByPlaceholder('搜索商品').inputValue() === 'preserved interaction', 'view switches must retain application state')
  await page.screenshot({ path: path.join(output, 'compare-phone.png') })
  await page.getByRole('button', { name: '选 A', exact: true }).click()
  await page.getByRole('button', { name: '审查并采用 A' }).waitFor()
  check((await requests('adopt')).length === 0, 'choosing a candidate must not adopt it')
  await page.getByText('查看 A 的代码改动', { exact: true }).click()
  await page.getByRole('region', { name: '候选 A', exact: true }).locator('pre').waitFor()
  check((await requests('patch')).length === 1, 'source changes must be reviewable')
  await page.getByRole('button', { name: '审查并采用 A' }).click()
  await page.getByRole('region', { name: '采用前审查' }).waitFor()
  check((await requests('preflight')).length === 1 && (await requests('adopt')).length === 0, 'preflight must precede a separate confirmation')
  await page.getByRole('button', { name: '确认采用 A' }).click()
  await page.getByRole('button', { name: '撤销采用', exact: true }).waitFor()
  check((await requests('adopt')).at(-1).body.mode === 'worktree', 'confirmation must perform the requested adoption')

  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const state of ['start', 'running', 'judging', 'failed', 'blocked', 'recovery']) {
      await open(state)
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state}: no page overflow at ${viewport.width}`)
      if (state === 'recovery') {
        const rect = await page.getByRole('button', { name: '恢复到采用前', exact: true }).boundingBox()
        check(rect && rect.y > 0 && rect.y + rect.height < viewport.height, 'recovery must be visible without scrolling')
      }
      if (viewport.width === 390) await page.screenshot({ path: path.join(output, `${state}-phone.png`) })
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const theme of ['light', 'dark']) for (const state of ['start', 'judging', 'revealed', 'recovery']) {
    await open(state, `&theme=${theme}`)
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
    const result = await page.evaluate(async () => window.axe.run(document.querySelector('[role="dialog"]'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    check(result.violations.length === 0, `${state} ${theme}: ${JSON.stringify(result.violations.map(v => ({ id: v.id, elements: v.nodes.map(n => n.target) })))}`)
  }
  await open('start', '&theme=dark')
  await page.screenshot({ path: path.join(output, 'setup-dark.png') })
  await page.getByRole('button', { name: '关闭（Esc）' }).focus()
  await page.keyboard.press('Tab')
  check(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), 'Tab must remain inside the modal')
  await page.keyboard.press('Shift+Tab')
  check(await page.evaluate(() => document.querySelector('[role="dialog"]').contains(document.activeElement)), 'reverse Tab must remain inside the modal')
  await page.keyboard.press('Escape')
  check(await page.getByRole('dialog').count() === 0, 'Escape must close the workspace')
  check(await page.evaluate(() => document.activeElement.classList.contains('ac-header-btn')), 'closing must restore entry-button focus')
  check(errors.length === 0, `unexpected browser errors: ${errors.join('; ')}`)
  console.log(JSON.stringify({ assertions, screenshots: output, browser: browser.version() }))
} finally {
  await browser?.close()
  await harness.close()
}

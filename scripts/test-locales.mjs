import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { launchUiBrowser } from './ui-browser.mjs'
import { createUiHarness } from './preview-ui.mjs'

const harness = await createUiHarness({ port: 0, demoPort: 0 })
const output = process.env.AGENT_COMPARE_UI_ARTIFACTS ?? await mkdtemp(path.join(os.tmpdir(), 'agent-compare-locales-'))
await mkdir(output, { recursive: true })
const check = (condition, message) => { assert.ok(condition, message); assertions++ }
let assertions = 0, browser, page
const errors = []
try {
  const launched = await launchUiBrowser()
  const { engine, channel } = launched
  browser = launched.browser
  page = await browser.newPage({ locale: 'en-GB', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  page.on('pageerror', error => errors.push(error.message))
  const language = () => page.getByRole('combobox', { name: 'Interface language', exact: true }).first()
  const open = async (state, extra = '') => {
    await page.goto(`${harness.url}/?state=${state}${extra}`)
    await page.getByRole('combobox', { name: 'Interface language', exact: true }).first().waitFor()
    if (state === 'compose') {
      const toggle = page.getByRole('button', { name: 'A|B comparison mode', exact: true })
      await toggle.waitFor()
      await page.waitForFunction(() => !document.querySelector('.ac-mode-btn').disabled)
      if (await toggle.getAttribute('aria-pressed') !== 'true') await toggle.click()
      await page.getByRole('region', { name: 'A|B comparison settings', exact: true }).waitFor()
      const expand = page.getByRole('button', { name: 'Expand settings', exact: true })
      if (await expand.isVisible()) await expand.click()
    } else if (!['start', 'blank'].includes(state)) {
      await page.getByRole('dialog', { name: 'AgentCompare' }).waitFor()
      if (state.startsWith('history')) await page.locator('.ac-history[aria-busy="false"]').waitFor()
      else await page.getByRole('region', { name: 'Candidate A', exact: true }).waitFor()
    }
  }

  await open('blank')
  check(await page.getByRole('button', { name: 'Open AgentCompare comparison records', exact: true }).isVisible(), 'new conversations must expose translated history navigation')
  check(await language().inputValue() === 'auto', 'English must follow the preferred browser language without setup')
  await language().selectOption('zh-CN')
  check(await page.getByRole('button', { name: '打开 AgentCompare 比较记录', exact: true }).isVisible(), 'language changes must reach the blank-session header')
  await page.reload()
  await page.getByRole('combobox', { name: '界面语言', exact: true }).first().waitFor()
  check(await page.getByRole('combobox', { name: '界面语言', exact: true }).first().inputValue() === 'zh-CN', 'explicit language choice must survive reload')
  await page.getByRole('combobox', { name: '界面语言', exact: true }).first().selectOption('en')

  await open('compose')
  const editor = page.getByRole('textbox', { name: '需求', exact: true })
  const task = 'Keep this task: 中文 <original>\nSearch and clear.'
  await editor.fill(task)
  await page.getByRole('button', { name: 'Two models · one brief', exact: true }).click()
  const models = page.locator('.ac-models select')
  await models.nth(0).selectOption('deepseek/deepseek-chat')
  await models.nth(1).selectOption('deepseek/deepseek-reasoner')
  await page.getByRole('combobox', { name: 'Generation limit per candidate', exact: true }).selectOption('60')
  const before = await page.evaluate(() => ({ references: JSON.stringify(window.__input().occurrences), edits: window.__edits.length, commands: window.__commands.length }))
  await language().selectOption('zh-CN')
  check(await editor.inputValue() === task, 'switching language must preserve a multiline task verbatim')
  check(await page.getByLabel('每版生成上限').inputValue() === '60', 'switching language must retain the selected time limit')
  check(await page.locator('.ac-models select').nth(1).inputValue() === 'deepseek/deepseek-reasoner', 'switching language must retain cross-model selections')
  await page.getByRole('combobox', { name: '界面语言', exact: true }).first().selectOption('en')
  const after = await page.evaluate(() => ({ references: JSON.stringify(window.__input().occurrences), edits: window.__edits.length, commands: window.__commands.length }))
  check(JSON.stringify(before) === JSON.stringify(after), 'language changes must not edit the composer, alter references or start comparisons')
  await page.getByRole('button', { name: '发送', exact: true }).click()
  await page.getByRole('region', { name: 'Candidate A', exact: true }).waitFor()
  check(await page.locator('.ac-inline iframe').count() === 2, 'English submissions must produce the same two live preview frames')
  const frameUrls = await page.locator('.ac-inline iframe').evaluateAll(frames => frames.map(frame => frame.src))
  const submitted = await page.evaluate(() => JSON.parse(window.__commands.at(-1).line.slice('/ab @ui '.length)))
  check(submitted.task === task && submitted.preferences.models[1].model === 'deepseek-reasoner', 'translated controls must submit the original task and configured routes')
  await page.getByRole('button', { name: 'Choose A', exact: true }).click()
  await page.getByRole('button', { name: 'Review and adopt A', exact: true }).waitFor()
  await page.locator('.ac-inline iframe').evaluateAll(frames => frames.forEach((frame, index) => { frame.dataset.languageIdentity = 'candidate-' + index }))
  const previewInput = page.frameLocator('.ac-inline iframe').first().getByRole('searchbox')
  await previewInput.fill('retained preview input')
  await language().selectOption('zh-CN')
  await page.getByRole('button', { name: '审查并采用 A', exact: true }).waitFor()
  check(JSON.stringify(await page.locator('.ac-inline iframe').evaluateAll(frames => frames.map(frame => frame.src))) === JSON.stringify(frameUrls), 'switching language must not restart either preview')
  check(JSON.stringify(await page.locator('.ac-inline iframe').evaluateAll(frames => frames.map(frame => frame.dataset.languageIdentity))) === JSON.stringify(['candidate-0', 'candidate-1']), 'switching language must retain the actual iframe DOM nodes')
  check(await previewInput.inputValue() === 'retained preview input', 'switching language must retain state inside the live application')
  check(await page.evaluate(() => window.__commands.length) === before.commands + 1, 'switching a running record must not create a second comparison')
  await page.getByRole('combobox', { name: '界面语言', exact: true }).first().selectOption('en')

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const state of ['compose', 'judging', 'history', 'recovery']) {
      await open(state)
      if (state === 'compose') await page.locator('.ac-composer-settings details > summary').filter({ hasText: 'Advanced Windows settings' }).click()
      const surface = page.locator(state === 'compose' ? '.ac-composer-settings' : '.ac-sheet')
      await page.screenshot({ path: path.join(output, `english-${state}-${width}.png`) })
      const overflow = await surface.evaluate(element => { const root = element.getBoundingClientRect(); return [...element.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.left < root.left - 1 || r.right > root.right + 1) }).slice(0, 5).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent.slice(0, 100), width: e.getBoundingClientRect().width })) })
      check(await surface.evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${state}: English controls must fit ${width}px without horizontal clipping: ${JSON.stringify(overflow)}`)
      const clipped = await surface.locator('button,select,input').evaluateAll(elements => elements.filter(element => {
        const r = element.getBoundingClientRect(), root = element.closest('.ac-sheet,.ac-composer-settings').getBoundingClientRect()
        return r.width && r.height && (r.left < root.left - 1 || r.right > root.right + 1)
      }).map(element => element.textContent || element.getAttribute('aria-label')))
      check(clipped.length === 0, `${state} ${width}px: controls outside the surface: ${JSON.stringify(clipped)}`)
      await page.screenshot({ path: path.join(output, `english-${state}-${width}.png`) })
    }
  }

  for (const theme of ['light', 'dark']) for (const state of ['compose', 'running', 'judging', 'install-failure', 'revealed', 'recovery', 'undo-recovery', 'history', 'history-damaged', 'foreign', 'retained']) {
    await page.emulateMedia({ colorScheme: theme })
    await open(state, `&theme=${theme}`)
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
    const result = await page.evaluate(async () => window.axe.run(document.querySelector('[role=dialog]') ?? document.querySelector('.ac-composer-settings'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    check(result.violations.length === 0, `${state} English ${theme}: ${JSON.stringify(result.violations.map(v => ({ id: v.id, elements: v.nodes.map(n => n.target) })))}`)
  }
  await open('install-failure')
  check(await page.getByText('Package registry connection or certificate check failed', { exact: true }).isVisible(), 'English installation failures must explain the actual failure category')
  check(await page.getByText(/Check the network, registry, proxy and certificates/).isVisible(), 'English installation failures must provide an actionable recovery hint')
  await open('history-damaged')
  const original = page.getByRole('button', { name: 'Original diagnostic', exact: true }).first()
  await original.waitFor()
  await original.focus(); await page.keyboard.press('Enter')
  check(await original.getAttribute('aria-expanded') === 'true', 'original diagnostics must remain keyboard-accessible and explicitly expandable')
  check(await page.getByText('JSON 内容不完整或格式错误', { exact: true }).isVisible(), 'unrecognized diagnostic evidence must remain verbatim')
  const close = page.getByRole('button', { name: 'Close (Esc)', exact: true })
  await close.focus(); await page.keyboard.press('Tab')
  check(await page.evaluate(() => document.querySelector('[role=dialog]').contains(document.activeElement)), 'English modal keyboard focus must stay inside the dialog')
  await page.keyboard.press('Escape')
  check(await page.getByRole('dialog').count() === 0, 'English Escape behavior must close the dialog')
  check(await page.evaluate(() => document.activeElement.matches('[data-ac-history]')), 'English close must restore the translated history entry focus')
  check(errors.length === 0, `unexpected browser errors: ${errors.join('; ')}`)
  console.log(JSON.stringify({ localeAssertions: assertions, screenshots: output, browser: browser.version(), engine, channel, locale: 'en-GB', languages: ['zh-CN', 'en'] }))
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'language-failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'language-failure.json'), JSON.stringify({ localeAssertions: assertions, message: error.message, browser: browser?.version(), pageErrors: errors }, null, 2))
  throw error
} finally { await browser?.close(); await harness.close() }

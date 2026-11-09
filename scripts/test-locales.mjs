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
    if (state === 'compose' || state === 'folder-start') {
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
  await page.getByRole('button', { name: 'Different models · one style', exact: true }).click()
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

  for (const [state, expected] of [
    ['judging', 'Interact with real pages in this conversation'],
    ['mixed-preview', "Live previews and saved screenshots · see each candidate's status"],
    ['interrupted-peer', "Some candidates are interactive · see each candidate's status"],
    ['retained', 'Saved acceptance screenshots · static, not interactive'],
    ['running', "Previews are not available yet · see each candidate's status"],
  ]) {
    await open(state)
    check(await page.locator('.ac-compare-tools').innerText().then(text => text.includes(expected)), `${state}: the English preview description must match current availability`)
    if (state === 'retained') {
      check(await page.locator('.ac-shotbar').allTextContents().then(texts => texts.length === 2 && texts.every(text => text.includes('static record') && !text.includes('copy was released'))), 'both concise English captions must identify static records without inferring deletion')
      check(await page.locator('.ac-bar-text').innerText().then(text => text.includes('Adoption was recorded. Target:')), 'English adoption confirmation must retain the word boundary before its target')
      check(await page.locator('.ac-shottools').first().innerText().then(text => text.includes('Desktop acceptance screenshot · static record')), 'the desktop screenshot caption must be a complete translated phrase')
      await page.getByRole('button', { name: 'Phone 390', exact: true }).click()
      check(await page.locator('.ac-shottools').first().innerText().then(text => text.includes('Phone acceptance screenshot · static record')), 'the phone screenshot caption must be a complete translated phrase')
    }
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const state of ['compose', 'judging', 'history', 'recovery', 'retained', 'mixed-preview']) {
      await open(state)
      if (state === 'compose') {
        await page.locator('.ac-composer-settings details > summary').filter({ hasText: 'Advanced Windows settings' }).click()
        const control = page.getByRole('combobox', { name: 'Windows process compatibility', exact: true })
        const label = await control.locator('..').evaluate(element => [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim())
        check(label === 'Process compatibility', `visible advanced-setting label must be English at ${width}px: ${label}`)
      }
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

  await page.setViewportSize({ width: 390, height: 844 })
  await open('reverted-history')
  const restored = page.getByRole('img', { name: 'Candidate A · Desktop acceptance screenshot', exact: true })
  await restored.waitFor()
  await page.waitForFunction(() => [...document.images].some(img => img.alt === 'Candidate A · Desktop acceptance screenshot' && img.complete && img.naturalWidth === 1280))
  check(await restored.evaluate(img => img.getBoundingClientRect().top + 120 < innerHeight), 'English restored history must expose application pixels in the initial phone viewport')
  const largerStatusFont = await page.addStyleTag({ content: '.ac-card-head .ac-label + .ac-pill{font-family:monospace;font-size:13px;letter-spacing:.4px}' })
  check(await page.locator('.ac-card-head').first().evaluate(head => { const label=head.querySelector('.ac-label').getBoundingClientRect(),status=head.querySelector('.ac-label + .ac-pill').getBoundingClientRect();return Math.abs(label.top+label.height/2-status.top-status.height/2)<1 }), 'larger platform font metrics must keep the candidate identity beside its status')
  check(await restored.evaluate(img => img.getBoundingClientRect().top + 120 < innerHeight), 'larger status text must preserve initial application visibility without truncating its facts')
  await page.screenshot({ path: path.join(output, 'results-first-font-metrics-en-phone.png') })
  await largerStatusFont.evaluate(style => style.remove())
  const adoptionRecord = page.locator('.ac-adoption-record')
  check(await adoptionRecord.locator('summary').first().innerText().then(text => text.includes('Undone') && text.includes('Adoption and recovery record')), 'English compact history must expose its actual undo state')
  await adoptionRecord.locator('summary').first().click()
  await adoptionRecord.getByText('View retained-content locations', { exact: true }).click()
  check((await adoptionRecord.innerText()).includes('.agent-compare-transfer-'), 'compacting successful history must retain access to recovery originals')
  await page.screenshot({ path: path.join(output, 'results-first-reverted-en-phone.png') })
  await page.setViewportSize({ width: 1440, height: 1000 })

  for (const theme of ['light', 'dark']) for (const state of ['compose', 'running', 'judging', 'install-failure', 'revealed', 'recovery', 'undo-recovery', 'history', 'history-damaged', 'foreign', 'retained', 'mixed-preview', 'reverted-history']) {
    await page.emulateMedia({ colorScheme: theme })
    await open(state, `&theme=${theme}`)
    await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' })
    const result = await page.evaluate(async () => window.axe.run(document.querySelector('[role=dialog]') ?? document.querySelector('.ac-composer-settings'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }))
    check(result.violations.length === 0, `${state} English ${theme}: ${JSON.stringify(result.violations.map(v => ({ id: v.id, elements: v.nodes.map(n => n.target) })))}`)
  }
  await open('install-failure')
  check(await page.getByText('Package registry connection or certificate check failed', { exact: true }).isVisible(), 'English installation failures must explain the actual failure category')
  check(await page.getByText(/Check the network, registry, proxy and certificates/).isVisible(), 'English installation failures must provide an actionable recovery hint')
  await open('allfailed')
  const failedCandidate = page.getByRole('region', { name: 'Candidate B', exact: true })
  check(await failedCandidate.getByText('Implementation failed', { exact: true }).isVisible(), 'English failure titles must keep the stage and outcome as separate words')
  check((await page.locator('.ac-bar-text').first().innerText()).includes('usable preview. Changes'), 'English sentences assembled from separate strings must keep their spacing')
  check(await failedCandidate.locator('.ac-fail').evaluate(element => !/mono/i.test(getComputedStyle(element).fontFamily)), 'failure explanations must use the interface font; raw logs stay monospace')
  check(await page.getByRole('button', { name: 'Compare again', exact: true }).isVisible(), 'English failures must offer repeating the same requirement')
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

  // Folders outside Git and results without a page read naturally in English.
  await open('folder-start')
  check((await page.locator('.ac-project-notes').innerText()).includes('This folder is not a Git repository.'), 'the folder note must be translated')
  check(await page.getByRole('button', { name: 'Enable Git in this folder', exact: true }).isVisible(), 'the enable-Git action must be translated')
  await open('folder')
  check(await page.getByRole('region', { name: 'Candidate A answer', exact: true }).isVisible(), 'an answer must be labelled in English')
  check(await page.getByRole('region', { name: 'Files written by candidate B', exact: true }).isVisible(), 'written files must be labelled in English')
  check((await page.getByRole('region', { name: 'Candidate A', exact: true }).innerText()).includes('Finished · Compare by content'), 'a content-judged result must not claim missing checks')
  check(!/[㐀-鿿]/.test(await page.locator('.ac-result-head').first().innerText()), 'result headings must have no untranslated copy')
  check(await page.getByRole('button', { name: 'Copy answer', exact: true }).isVisible() && await page.locator('.ac-md-code').getByRole('button', { name: 'Copy', exact: true }).isVisible(), 'copy actions must be translated')
  check((await page.locator('[role="dialog"]').innerText()).includes('No runnable checks'), 'the evidence summary must be translated')
  await page.screenshot({ path: path.join(output, 'folder-results-en.png') })
  await open('folder-answer')
  check(await page.getByRole('region', { name: 'Candidate A', exact: true }).locator('.ac-picked').innerText() === 'Your pick', 'the pick marker must be translated')
  check((await page.locator('.ac-bar').innerText()).includes("You picked A's answer."), 'the picked-answer bar must be translated')
  check(await page.getByRole('button', { name: 'Continue conversation', exact: true }).isVisible(), 'continuing after a picked answer must be translated')
  check(!/[㐀-鿿]/.test(await page.locator('.ac-bar').innerText()), 'the picked-answer bar must have no untranslated copy')

  // Versions, styles and the blind switch read naturally in English.
  await open('compose')
  const settings = page.getByRole('region', { name: 'A|B comparison settings' })
  await settings.getByRole('button', { name: 'One model · different styles', exact: true }).click()
  await settings.getByRole('button', { name: '3 versions', exact: true }).click()
  await settings.getByRole('group', { name: 'Styles of the versions', exact: true }).locator('select').nth(2).waitFor()
  check(await settings.getByRole('group', { name: 'Styles of the versions', exact: true }).locator('select').count() === 3, 'the style choices must be labelled in English')
  check(await settings.getByLabel('Style 3', { exact: true }).locator('option:checked').innerText() === 'Minimal', 'style names must be translated')
  check(await settings.getByRole('button', { name: 'Blind', exact: true }).isVisible() && await settings.getByRole('button', { name: 'Open', exact: true }).isVisible(), 'the blind switch must be translated')
  check((await settings.innerText()).includes('3 versions generate at once'), 'the usage hint must be translated')
  check(!/[㐀-鿿]/.test(await settings.locator('.ac-style-row').innerText()), 'the style row must have no untranslated copy')
  await page.screenshot({ path: path.join(output, 'settings-versions-en.png') })
  await open('four')
  check(await page.getByRole('button', { name: 'All side by side', exact: true }).isVisible() && await page.getByRole('button', { name: 'Focus D', exact: true }).isVisible(), 'layout choices for four versions must be translated')
  await page.getByRole('region', { name: 'Candidate B', exact: true }).getByRole('button', { name: 'Set aside', exact: true }).click()
  check(await page.getByRole('button', { name: 'Restore B', exact: true }).isVisible() && (await page.locator('.ac-bar').innerText()).includes('(B set aside)'), 'narrowing down must be translated')
  await open('four-open')
  const styleLabels = await page.locator('.ac-strategy').allTextContents()
  check(styleLabels.length === 4 && styleLabels.every(text => !/[㐀-鿿]/.test(text)) && styleLabels.some(text => text.includes('Minimal')) && styleLabels.some(text => text.includes('Vibrant')), 'every revealed preset style must follow the English interface language')
  check(!/[㐀-鿿]/.test(await page.locator('.ac-bar').innerText()) && !(await page.locator('.ac-bar').innerText()).includes('reveal'), 'an open comparison bar must be translated and promise no reveal')
  check(errors.length === 0, `unexpected browser errors: ${errors.join('; ')}`)
  console.log(JSON.stringify({ localeAssertions: assertions, screenshots: output, browser: browser.version(), engine, channel, locale: 'en-GB', languages: ['zh-CN', 'en'] }))
} catch (error) {
  await page?.screenshot({ path: path.join(output, 'language-failure.png') }).catch(() => {})
  await writeFile(path.join(output, 'language-failure.json'), JSON.stringify({ localeAssertions: assertions, message: error.message, browser: browser?.version(), pageErrors: errors }, null, 2))
  throw error
} finally { await browser?.close(); await harness.close() }

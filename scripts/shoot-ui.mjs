// Screenshot every preview-ui state (light + dark) with headless Edge/Chrome.
// Requires `node scripts/preview-ui.mjs` running. Output: .research/ui-shots/*.png
import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const out = '.research/ui-shots'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true })
const states = (process.argv[2] ?? 'start,history,running,judging,failed,revealed,blocked,adopted,recovery').split(',')
const themes = (process.argv[3] ?? 'light,dark').split(',')
for (const theme of themes) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme })
  for (const state of states) {
    await page.goto(`http://127.0.0.1:4317/?state=${state}&theme=${theme}`)
    await page.addStyleTag({ content: '.ac-root *{animation:none!important;transition:none!important}' })
    await page.waitForSelector('.ac-sheet')
    await page.waitForTimeout(state === 'start' ? 300 : 900)
    await page.screenshot({ path: `${out}/${state}-${theme}.png` })
    console.log(`${state}-${theme}.png`)
  }
  await page.close()
}
await browser.close()

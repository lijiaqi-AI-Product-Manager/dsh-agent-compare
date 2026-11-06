import assert from 'node:assert/strict'
import { chromium, firefox, webkit } from 'playwright-core'

export async function launchUiBrowser() {
  const engine = process.env.AGENT_COMPARE_UI_BROWSER_ENGINE ?? 'chromium'
  const channel = process.env.AGENT_COMPARE_UI_BROWSER_CHANNEL
  assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), 'Unsupported UI browser engine')
  assert.ok(channel === undefined || ['msedge', 'chrome'].includes(channel), 'Unsupported UI browser channel')
  assert.ok(!channel || engine === 'chromium', 'Branded browser channels require the Chromium engine')
  const launcher = { chromium, firefox, webkit }[engine]
  const browser = channel ? await chromium.launch({ channel, headless: true }) : engine === 'chromium'
    ? await chromium.launch({ headless: true }).catch(() => chromium.launch({ channel: process.platform === 'win32' ? 'msedge' : 'chrome', headless: true }))
    : await launcher.launch({ headless: true })
  return { browser, engine, channel: channel ?? engine }
}

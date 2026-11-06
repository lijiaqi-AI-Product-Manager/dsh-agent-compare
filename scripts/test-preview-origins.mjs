import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { launchUiBrowser } from './ui-browser.mjs'
import { createUiHarness } from './preview-ui.mjs'

const harness = await createUiHarness({ port: 0, demoPort: 0 })
const output = path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS ?? '.runtime-checks/browser-evidence')
await mkdir(output, { recursive: true })
const { browser, engine, channel } = await launchUiBrowser()
const parentCookie = 'ac-parent-' + randomBytes(8).toString('hex')
const candidateKey = 'ac-candidate-' + randomBytes(8).toString('hex')
let result, page
const errors = []
try {
  page = await browser.newPage({ locale: 'en-GB', viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  await page.context().addCookies([{ name: parentCookie, value: 'owned-canary', httpOnly: true, sameSite: 'Lax', url: harness.url }])
  await page.goto(harness.url + '/?state=judging')
  await page.getByRole('region', { name: 'Candidate A', exact: true }).waitFor()
  const frames = page.locator('.ac-grid iframe')
  assert.equal(await frames.count(), 2)
  const urls = await frames.evaluateAll(elements => elements.map(element => element.src))
  assert.equal(new Set(urls.map(url => new URL(url).hostname)).size, 2)
  for (const url of urls) assert.match(new URL(url).hostname, /^ac-[0-9a-f]{32}\.localhost$/)
  const a = page.frameLocator('.ac-grid iframe').nth(0), b = page.frameLocator('.ac-grid iframe').nth(1)
  await a.getByRole('heading', { name: 'Demo Shop · A' }).waitFor()
  await b.getByRole('heading', { name: 'Demo Shop · B' }).waitFor()
  await a.getByRole('searchbox').fill('isolated input')
  assert.equal(await b.getByRole('searchbox').inputValue(), '')
  const first = await a.locator('body').evaluate((_element, key) => {
    let cookie = false, storage = false
    try { document.cookie = key + '=A; Path=/; SameSite=Lax'; cookie = document.cookie.includes(key + '=A') } catch { /* Browser policy can deny embedded cookies. */ }
    try { localStorage.setItem(key, 'A'); storage = localStorage.getItem(key) === 'A' } catch { /* Report unavailable storage without asserting it worked. */ }
    return { cookie, storage }
  }, candidateKey)
  const second = await b.locator('body').evaluate((_element, key) => {
    let cookie, storage
    try { cookie = document.cookie.includes(key + '=A') } catch { cookie = null }
    try { storage = localStorage.getItem(key) } catch { storage = null }
    return { cookie, storage }
  }, candidateKey)
  if (first.cookie) assert.equal(second.cookie, false, 'Candidate cookies crossed host boundaries')
  if (first.storage) assert.equal(second.storage, null, 'Candidate storage crossed origin boundaries')
  assert.ok(harness.previewRequests.length >= 2)
  assert.ok(harness.previewRequests.every(request => !request.cookieNames.includes(parentCookie)), 'A parent HttpOnly cookie was sent to an application preview')
  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('region', { name: 'Candidate A', exact: true }).getByRole('link', { name: 'Open A in browser', exact: true }).click()])
  await tab.getByRole('heading', { name: 'Demo Shop · A' }).waitFor()
  assert.equal(new URL(tab.url()).hostname, new URL(urls[0]).hostname)
  assert.equal(await tab.evaluate(() => window.opener === null), true, 'The direct-tab fallback must not expose an opener')
  await tab.screenshot({ path: path.join(output, engine + '-direct-preview.png') }); await tab.close()
  assert.equal(await a.getByRole('searchbox').inputValue(), 'isolated input')
  assert.deepEqual(errors, [])
  result = { engine, channel, browser: browser.version(), platform: process.platform, node: process.version, scenario: 'host-independent interface with two live HTTP preview fixtures', independentHosts: true, independentInput: true, cookieIsolation: first.cookie ? 'verified' : 'blocked-by-browser', storageIsolation: first.storage ? 'verified' : 'blocked-by-browser', parentHttpOnlyCookieForwarded: false, directTabReachable: true, openerRetained: false, pageErrors: errors.length }
  await page.screenshot({ path: path.join(output, engine + '-preview-pair.png') })
  await writeFile(path.join(output, engine + '-preview-origins.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  await page?.screenshot({ path: path.join(output, engine + '-preview-failure.png') }).catch(() => {})
  await writeFile(path.join(output, engine + '-preview-failure.json'), JSON.stringify({ engine, channel, browser: browser.version(), platform: process.platform, message: error.message, pageErrors: errors }, null, 2))
  throw error
} finally { await browser.close(); await harness.close() }

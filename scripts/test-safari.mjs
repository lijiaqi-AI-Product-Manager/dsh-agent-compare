// Native Safari, not a WebKit substitute. Runs only on an isolated macOS runner.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createUiHarness } from './preview-ui.mjs'

assert.equal(process.platform, 'darwin', 'Native Safari acceptance requires macOS')
const output = path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS ?? '.runtime-checks/safari-evidence')
await mkdir(output, { recursive: true })
const harness = await createUiHarness({ port: 0, demoPort: 0 })
const port = await new Promise((resolve, reject) => {
  const server = createServer(); server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => address && typeof address === 'object' ? resolve(address.port) : reject(new Error('No driver port'))) })
})
const driver = spawn('/usr/bin/safaridriver', ['--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] })
let driverLog = '', session, capabilities, result
for (const stream of [driver.stdout, driver.stderr]) stream.setEncoding('utf8').on('data', chunk => { driverLog = (driverLog + chunk).slice(-12000) })
const endpoint = `http://127.0.0.1:${port}`
async function request(method, route, body) {
  const response = await fetch(endpoint + route, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) })
  const data = await response.json()
  if (!response.ok || data.value?.error) throw new Error(`${method} ${route}: ${data.value?.error ?? response.status} ${data.value?.message ?? ''}`)
  return data.value
}
async function until(predicate, name, timeout = 30000) {
  const end = Date.now() + timeout; let last
  while (Date.now() < end) {
    try { const value = await predicate(); if (value) return value } catch (error) { last = error }
    if (driver.exitCode !== null) throw new Error('Safari driver exited: ' + driverLog)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(name + ' did not complete' + (last ? ': ' + last.message : ''))
}
const command = (method, route, body) => request(method, '/session/' + session + route, body)
const execute = (script, ...args) => command('POST', '/execute/sync', { script, args })
const find = async selector => (await command('POST', '/elements', { using: 'css selector', value: selector }))
const idOf = element => element['element-6066-11e4-a52e-4f735466cecf'] ?? element.ELEMENT
const top = () => command('POST', '/frame', { id: null })
const frame = element => command('POST', '/frame', { id: element })
const screenshot = async name => writeFile(path.join(output, name + '.png'), Buffer.from(await command('GET', '/screenshot'), 'base64'))
try {
  await until(async () => (await request('GET', '/status'))?.ready === true, 'Safari driver readiness')
  const created = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari', 'safari:automaticInspection': false, 'safari:automaticProfiling': false } } })
  session = created.sessionId; capabilities = created.capabilities
  assert.ok(session); assert.equal(capabilities.browserName.toLowerCase(), 'safari')
  await command('POST', '/timeouts', { implicit: 0, pageLoad: 30000, script: 30000 })
  await command('POST', '/url', { url: harness.url + '/?state=judging' })
  await until(() => execute('return document.querySelectorAll(".ac-grid iframe").length === 2'), 'Two preview frames')
  const parentCookie = 'ac-parent-' + randomBytes(8).toString('hex'), candidateKey = 'ac-candidate-' + randomBytes(8).toString('hex')
  await command('POST', '/cookie', { cookie: { name: parentCookie, value: 'owned-canary', path: '/', httpOnly: true, sameSite: 'Lax' } })
  // Navigate after setting the parent canary so real preview HTTP requests carry
  // it only if the origin boundary is wrong. The fixture retains names only.
  await command('POST', '/url', { url: harness.url + '/?state=judging' })
  await until(() => execute('return document.querySelectorAll(".ac-grid iframe").length === 2'), 'Preview frames after parent cookie')
  const frames = await find('.ac-grid iframe')
  const urls = await execute('return Array.from(document.querySelectorAll(".ac-grid iframe"), frame => frame.src)')
  assert.equal(new Set(urls.map(url => new URL(url).hostname)).size, 2)
  await frame(frames[0])
  await until(() => execute('return document.querySelector("h2")?.textContent === "Demo Shop · A"'), 'Safari preview A reachability')
  const input = (await find('input[type=search]'))[0]
  await command('POST', '/element/' + idOf(input) + '/value', { text: 'Safari preserved input' })
  const first = await execute('let cookie=false,storage=false;try{document.cookie=arguments[0]+"=A; Path=/; SameSite=Lax";cookie=document.cookie.includes(arguments[0]+"=A")}catch{}try{localStorage.setItem(arguments[0],"A");storage=localStorage.getItem(arguments[0])==="A"}catch{}return {cookie,storage}', candidateKey)
  await top(); await frame(frames[1])
  await until(() => execute('return document.querySelector("h2")?.textContent === "Demo Shop · B"'), 'Safari preview B reachability')
  assert.equal(await execute('return document.querySelector("input[type=search]").value'), '')
  const second = await execute('let cookie=null,storage=null;try{cookie=document.cookie.includes(arguments[0]+"=A")}catch{}try{storage=localStorage.getItem(arguments[0])}catch{}return {cookie,storage}', candidateKey)
  if (first.cookie) assert.equal(second.cookie, false)
  if (first.storage) assert.equal(second.storage, null)
  assert.ok(harness.previewRequests.length >= 2)
  assert.ok(harness.previewRequests.every(request => !request.cookieNames.includes(parentCookie)), 'A parent HttpOnly cookie reached a preview')
  await top()
  await execute('for(const frame of document.querySelectorAll(".ac-grid iframe"))frame.dataset.languageIdentity="retained";const s=document.querySelector("[role=dialog] .ac-language select");s.value="zh-CN";s.dispatchEvent(new Event("change",{bubbles:true}))')
  await until(() => execute('return document.querySelector(".ac-sheet")?.closest(".ac-root").lang === "zh-CN"'), 'Chinese interface')
  await execute('const s=document.querySelector("[role=dialog] .ac-language select");s.value="en";s.dispatchEvent(new Event("change",{bubbles:true}))')
  await until(() => execute('return document.querySelector(".ac-sheet")?.closest(".ac-root").lang === "en"'), 'English interface')
  assert.equal(await execute('return Array.from(document.querySelectorAll(".ac-grid iframe")).every(frame=>frame.dataset.languageIdentity==="retained")'), true)
  await frame((await find('.ac-grid iframe'))[0])
  assert.equal(await execute('return document.querySelector("input[type=search]").value'), 'Safari preserved input')
  await top(); await screenshot('safari-comparison')
  const originalWindow = await command('GET', '/window')
  const tab = await command('POST', '/window/new', { type: 'tab' })
  await command('POST', '/window', { handle: tab.handle })
  await command('POST', '/url', { url: urls[0] })
  await until(() => execute('return document.querySelector("h2")?.textContent === "Demo Shop · A"'), 'Safari direct-tab preview')
  await screenshot('safari-direct-preview')
  await command('DELETE', '/window'); await command('POST', '/window', { handle: originalWindow })
  result = { browser: capabilities.browserName, browserVersion: capabilities.browserVersion, macOS: execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(), kernel: os.release(), architecture: process.arch, node: process.version, scenario: 'native Safari driver; host-independent UI and live HTTP preview fixtures', independentHosts: true, independentInput: true, cookieIsolation: first.cookie ? 'verified' : 'blocked-by-browser', storageIsolation: first.storage ? 'verified' : 'blocked-by-browser', parentHttpOnlyCookieForwarded: false, directTabReachable: true, bothInterfaceLanguages: true, iframeIdentityPreserved: true }
  await writeFile(path.join(output, 'native-safari.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  let documentState
  if (session) { await top().catch(() => {}); documentState = await execute('return {url:location.href,ready:document.readyState,encoding:document.characterSet,text:document.body.innerText.slice(0,12000),errors:window.__harnessErrors,frames:Array.from(document.querySelectorAll("iframe"),f=>f.src)}').catch(() => undefined) }
  if (session) { await top().catch(() => {}); await screenshot('safari-failure').catch(() => {}) }
  await writeFile(path.join(output, 'native-safari-failure.json'), JSON.stringify({ capabilities, platform: process.platform, kernel: os.release(), message: error.message, driverLog, documentState }, null, 2))
  throw error
} finally {
  if (session) await command('DELETE', '').catch(() => {})
  if (driver.exitCode === null) {
    driver.kill('SIGTERM')
    await Promise.race([new Promise(resolve => driver.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))])
    if (driver.exitCode === null) driver.kill('SIGKILL')
  }
  await harness.close()
}

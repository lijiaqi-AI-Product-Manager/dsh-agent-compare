// Native Safari, not a WebKit substitute. Runs only on an isolated macOS runner.
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createUiHarness } from './preview-ui.mjs'
import { inspectPngEvidence } from './png-evidence.mjs'
import { prepareNativeSafariSession } from './prepare-native-safari-session.mjs'
import { probeNativeSafariProtocol } from './safari-protocol-probe.mjs'

assert.equal(process.platform, 'darwin', 'Native Safari acceptance requires macOS')
const output = path.resolve(process.env.AGENT_COMPARE_UI_ARTIFACTS ?? '.runtime-checks/safari-evidence')
await mkdir(output, { recursive: true })
const startup=await prepareNativeSafariSession()
await writeFile(path.join(output,'native-browser-startup.json'),JSON.stringify(startup,null,2))
const harness = await createUiHarness({ port: 0, demoPort: 0 })
const port = await new Promise((resolve, reject) => {
  const server = createServer(); server.once('error', reject)
  server.listen(0, '127.0.0.1', () => { const address = server.address(); server.close(() => address && typeof address === 'object' ? resolve(address.port) : reject(new Error('No driver port'))) })
})
const driver = spawn('/usr/bin/safaridriver', ['--port', String(port), '--diagnose'], { stdio: ['ignore', 'pipe', 'pipe'] })
const driverStartedAt = Date.now()
const awake=process.env.GITHUB_ACTIONS==='true'?spawn('/usr/bin/caffeinate',['-d','-i','-u','-t','600'],{stdio:'ignore'}):undefined
let awakeError,wakeAssertionObserved=false
awake?.once('error',error=>{awakeError=error})
let driverLog = '', session, capabilities, result, nativeScreen, nativeWindow, driverVersion
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
const imageEvidence = []
const screenshot = async (name, verify = true) => {
  let bytes, pixels, attempts=0
  const target=(await find('.ac-sheet'))[0]??(await find('body'))[0]
  assert.ok(target,'A real application element is required for native visual acceptance')
  const end=Date.now()+10000
  do {
    if (verify) await command('POST', '/execute/async', { script: 'const done=arguments[arguments.length-1];requestAnimationFrame(()=>requestAnimationFrame(()=>done(document.visibilityState)))', args: [] })
    bytes=Buffer.from(await command('GET','/element/'+idOf(target)+'/screenshot'),'base64');pixels=inspectPngEvidence(bytes);attempts++
    if(!verify || pixels.colors>=128 && pixels.distinctPixels>=1500)break
  } while(Date.now()<end)
  await writeFile(path.join(output, name + '.png'), bytes)
  const layout=await execute('const view=e=>{if(!e)return null;const s=getComputedStyle(e);return {opacity:s.opacity,visibility:s.visibility,display:s.display,transform:s.transform,zIndex:s.zIndex,animationName:s.animationName,animationPlayState:s.animationPlayState,rect:e.getBoundingClientRect().toJSON()}};return {sheet:view(document.querySelector(".ac-sheet")),mask:view(document.querySelector(".ac-mask")),body:view(document.body),animations:document.getAnimations().map(a=>({state:a.playState,time:a.currentTime,name:a.animationName}))}').catch(()=>undefined)
  const windowBytes=Buffer.from(await command('GET','/screenshot'),'base64'),windowPixels=inspectPngEvidence(windowBytes)
  await writeFile(path.join(output,name+'-window.png'),windowBytes)
  imageEvidence.push({ name, capture:'webdriver-element', attempts, usable:pixels.colors>=128&&pixels.distinctPixels>=1500, ...pixels, layout,
    windowCapture:{file:name+'-window.png',status:windowPixels.colors>=128&&windowPixels.distinctPixels>=1500?'available':'blank',...windowPixels} })
}
try {
  if(awake)await until(async()=>{
    if(awakeError)throw awakeError
    const assertions=execFileSync('/usr/bin/pmset',['-g','assertions'],{encoding:'utf8',timeout:5000})
    wakeAssertionObserved=assertions.includes('pid '+awake.pid+'(')&&/PreventUserIdleDisplaySleep\s+1/.test(assertions)
    return wakeAssertionObserved
  },'Disposable display wake assertion',10000)
  driverVersion=execFileSync('/usr/bin/safaridriver',['--version'],{encoding:'utf8',timeout:10000}).trim()
  await until(async () => (await request('GET', '/status'))?.ready === true, 'Safari driver readiness')
  const created = await request('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } })
  session = created.sessionId; capabilities = created.capabilities
  assert.ok(session); assert.equal(capabilities.browserName.toLowerCase(), 'safari')
  nativeScreen=await execute('return {width:screen.width,height:screen.height,availWidth:screen.availWidth,availHeight:screen.availHeight,availLeft:screen.availLeft,availTop:screen.availTop,scale:devicePixelRatio}')
  assert.ok(nativeScreen.availWidth>=900&&nativeScreen.availHeight>=600,'The native runner needs a usable visible desktop')
  nativeWindow=await command('POST','/window/rect',{x:Math.max(0,nativeScreen.availLeft??0),y:Math.max(0,nativeScreen.availTop??0),width:Math.min(1440,nativeScreen.availWidth),height:Math.min(1000,nativeScreen.availHeight)})
  // Stay within WebDriver. Apple Events would request a second, unrelated
  // desktop-control permission and can obscure the actual page with a dialog.
  await command('POST','/window',{handle:await command('GET','/window')})
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
  await command('POST', '/element/' + idOf(input) + '/click', {})
  await command('POST', '/element/' + idOf(input) + '/value', { text: 'Safari preserved input', value: Array.from('Safari preserved input') })
  await until(() => execute('return document.querySelector("input[type=search]").value === "Safari preserved input"'), 'Native Safari text entry')
  const documentMarker = randomBytes(8).toString('hex')
  await execute('window.__acDocumentMarker=arguments[0]', documentMarker)
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
  assert.equal(await execute('return window.__acDocumentMarker'), documentMarker, 'Language switching reloaded the actual preview document')
  assert.equal(await execute('return document.querySelector("input[type=search]").value'), 'Safari preserved input')
  await top()
  await execute('document.querySelector(".ac-grid").scrollIntoView({block:"start",behavior:"instant"})')
  await screenshot('safari-comparison')
  const originalWindow = await command('GET', '/window')
  const tab = await command('POST', '/window/new', { type: 'tab' })
  await command('POST', '/window', { handle: tab.handle })
  await command('POST', '/url', { url: urls[0] })
  await until(() => execute('return document.querySelector("h2")?.textContent === "Demo Shop · A"'), 'Safari direct-tab preview')
  const directKey='ac-direct-'+Date.now()
  const directA=await execute('document.cookie=arguments[0]+"=A; Path=/; SameSite=Lax";document.cookie=arguments[0]+"-parent=shared; Domain=localhost; Path=/";localStorage.setItem(arguments[0],"A");sessionStorage.setItem(arguments[0],"A");return {cookie:document.cookie.includes(arguments[0]+"=A"),parent:document.cookie.includes(arguments[0]+"-parent="),secure:isSecureContext,uuid:typeof crypto.randomUUID}',directKey)
  assert.equal(directA.cookie,true,'First-party Safari cookies must work')
  assert.equal(directA.parent,false,'Safari accepted a shared localhost cookie at a numeric origin')
  assert.equal(directA.secure,true,'Numeric loopback must remain a secure browser context')
  assert.equal(directA.uuid,'function')
  const partialDomains=await execute('const accepted=[];const parts=location.hostname.split(".");for(let i=1;i<parts.length;i++){const key=arguments[0]+"-numeric-"+i;document.cookie=key+"=shared; Domain="+parts.slice(i).join(".")+"; Path=/";if(document.cookie.includes(key+"="))accepted.push(parts.slice(i).join("."))}return accepted',directKey)
  assert.deepEqual(partialDomains,[],'Safari accepted a partial numeric address as a shared cookie domain')
  await command('POST','/url',{url:urls[1]})
  await until(()=>execute('return document.querySelector("h2")?.textContent === "Demo Shop · B"'),'Safari direct B')
  const directB=await execute('return {cookie:document.cookie.includes(arguments[0]+"=A"),parent:document.cookie.includes(arguments[0]+"-parent="),local:localStorage.getItem(arguments[0]),session:sessionStorage.getItem(arguments[0])}',directKey)
  assert.deepEqual(directB,{cookie:false,parent:false,local:null,session:null},'First-party candidate state leaked to B')
  await execute('document.cookie=arguments[0]+"=B; Path=/; SameSite=Lax";localStorage.setItem(arguments[0],"B")',directKey)
  await command('POST','/url',{url:urls[0]})
  await until(()=>execute('return document.querySelector("h2")?.textContent === "Demo Shop · A"'),'Safari return to direct A')
  const retainedA=await execute('return {cookie:document.cookie.includes(arguments[0]+"=A"),local:localStorage.getItem(arguments[0]),session:sessionStorage.getItem(arguments[0])}',directKey)
  assert.deepEqual(retainedA,{cookie:true,local:'A',session:'A'})
  await screenshot('safari-direct-preview')
  await command('DELETE', '/window'); await command('POST', '/window', { handle: originalWindow })
  result = { browser: capabilities.browserName, browserVersion: capabilities.browserVersion, macOS: execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(), kernel: os.release(), architecture: process.arch, node: process.version, scenario: 'native Safari driver; host-independent UI and live HTTP preview fixtures', independentHosts: true, independentInput: true, cookieIsolation: first.cookie ? 'verified' : 'blocked-by-browser', storageIsolation: first.storage ? 'verified' : 'blocked-by-browser', parentHttpOnlyCookieForwarded: false, directTabReachable: true, bothInterfaceLanguages: true, iframeIdentityPreserved: true }
  result.firstPartyCookieIsolation=true
  result.firstPartyStorageIsolation=true
  result.numericSecureContext=true
  result.driverReportedVersion=capabilities.browserVersion
  result.driverExecutableVersion=driverVersion
  result.browserStartup=startup
  result.browserVersion=execFileSync('/usr/libexec/PlistBuddy',['-c','Print :CFBundleShortVersionString','/Applications/Safari.app/Contents/Info.plist'],{encoding:'utf8',timeout:10000}).trim()
  result.userAgent=await execute('return navigator.userAgent')
  result.imageEvidence = imageEvidence
  result.nativeScreen=nativeScreen
  result.nativeWindow=nativeWindow
  result.displayWake={disposableCi:Boolean(awake),wakeAssertionObserved,permanentSettingsChanged:false}
  await writeFile(path.join(output,'native-safari-observations.json'),JSON.stringify({...result,visualAcceptance:imageEvidence.every(e=>e.usable)?'passed':'failed'},null,2))
  assert.ok(imageEvidence.every(e=>e.usable),'Safari returned blank or incomplete screenshot evidence: '+JSON.stringify(imageEvidence.map(({name,colors,distinctPixels,usable})=>({name,colors,distinctPixels,usable}))))
  await writeFile(path.join(output, 'native-safari.json'), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
} catch (error) {
  let documentState, runnerState
  if (session) { await top().catch(() => {}); documentState = await execute('return {url:location.href,ready:document.readyState,visibility:document.visibilityState,focused:document.hasFocus(),encoding:document.characterSet,text:document.body.innerText.slice(0,12000),errors:window.__harnessErrors,frames:Array.from(document.querySelectorAll("iframe"),f=>({src:f.src,rect:f.getBoundingClientRect().toJSON()})),dialog:document.querySelector("[role=dialog]")?.getBoundingClientRect().toJSON()}').catch(() => undefined) }
  if (session) { await top().catch(() => {}); await screenshot('safari-failure', false).catch(() => {}) }
  // Capture only the disposable CI runner, never a maintainer's own desktop.
  if (process.env.GITHUB_ACTIONS === 'true') {
    runnerState = 'Native WebDriver evidence; no Apple Events desktop-control request'
    try { execFileSync('/usr/sbin/screencapture', ['-x', path.join(output, 'safari-runner-screen.png')], { timeout: 10000 }) } catch (cause) { runnerState += '\nScreen capture: ' + cause.message }
    const diagnostics = { processes: [], driver: [] }
    try {
      diagnostics.processes = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,uid=,lstart=,comm='], { encoding: 'utf8', timeout: 5000 })
        .split('\n').filter(line => /\/(?:Safari|safaridriver|webinspectord|com\.apple\.WebKit\.[\w.]+)$/.test(line)).slice(-32)
      const folder = path.join(os.homedir(), 'Library/Logs/com.apple.WebDriver')
      diagnostics.driverFiles = (await readdir(folder)).slice(-32)
      for (const name of diagnostics.driverFiles.slice(-8)) {
        const file = path.join(folder, name), info = await stat(file)
        if (!info.isFile() || info.size > 2 * 1024 * 1024 || info.mtimeMs < driverStartedAt - 1000) continue
        const text = await readFile(file, 'utf8')
        diagnostics.driver.push({ name, bytes: info.size, messages: text.split('\n').slice(-80) })
      }
    } catch (cause) { diagnostics.collectionError = cause.code ?? cause.name }
    try {
      diagnostics.systemMessages = execFileSync('/usr/bin/log', ['show', '--last', '2m', '--style', 'compact', '--predicate', 'process == "safaridriver" OR process == "Safari" OR process == "webinspectord"'], { encoding: 'utf8', timeout: 15000, maxBuffer: 3 * 1024 * 1024 })
        .split('\n').filter(line => /RWI|automation|remote.?inspect|webinspectord|WebDriver|dyld/i.test(line) || /safaridriver/.test(line) && /fail|error|denied|compatib/i.test(line)).slice(-96)
    } catch (cause) { diagnostics.systemCollectionError = cause.code ?? cause.name }
    diagnostics.remotePreferences = {}
    for (const key of ['AllowRemoteAutomation', 'IncludeDevelopMenu', 'RemoteAutomationEnabled']) {
      try { diagnostics.remotePreferences[key] = execFileSync('/usr/bin/defaults', ['read', 'com.apple.Safari', key], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
      catch { diagnostics.remotePreferences[key] = 'not explicitly configured' }
    }
    await writeFile(path.join(output, 'native-startup-diagnostics.json'), JSON.stringify(diagnostics, null, 2))
    if (!session) {
      if (driver.exitCode === null) {
        driver.kill('SIGTERM')
        await Promise.race([new Promise(resolve => driver.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))])
        if (driver.exitCode === null) driver.kill('SIGKILL')
      }
      await writeFile(path.join(output, 'native-protocol-capabilities.json'), JSON.stringify(await probeNativeSafariProtocol({url:harness.url+'/?state=judging',output}), null, 2))
    }
  }
  await writeFile(path.join(output, 'native-safari-failure.json'), JSON.stringify({ capabilities, platform: process.platform, kernel: os.release(), message: error.message, driverLog, documentState, runnerState, nativeScreen, nativeWindow, imageEvidence, wakeAssertionObserved, driverVersion }, null, 2))
  throw error
} finally {
  if (session) await command('DELETE', '').catch(() => {})
  if (driver.exitCode === null) {
    driver.kill('SIGTERM')
    await Promise.race([new Promise(resolve => driver.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))])
    if (driver.exitCode === null) driver.kill('SIGKILL')
  }
  if(awake&&awake.exitCode===null){awake.kill('SIGTERM');await Promise.race([new Promise(resolve=>awake.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,2000))]);if(awake.exitCode===null)awake.kill('SIGKILL')}
  await harness.close()
}

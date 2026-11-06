// Interface-only setup fixtures. No system authorization or address changes occur here.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import path from 'node:path'
import {launchUiBrowser} from './ui-browser.mjs'
import {createUiHarness} from './preview-ui.mjs'

const hosts=process.env.AGENT_COMPARE_UI_PREVIEW_HOSTS?.split(',')??['127.87.44.19','127.87.44.20']
const harness=await createUiHarness({port:0,demoPort:0,previewHosts:hosts})
const output=process.env.AGENT_COMPARE_UI_ARTIFACTS??'.runtime-checks/browser-evidence'
await mkdir(output,{recursive:true})
let browser,context,page,assertions=0
const errors=[],check=(value,message)=>{assert.ok(value,message);assertions++}
try {
  const launched=await launchUiBrowser();browser=launched.browser
  context=await browser.newContext({locale:'en-GB',viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.2 Safari/605.1.15'})
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message))
  const open=async error=>{
    await page.goto(harness.url+'/?state=compose&error='+error)
    const toggle=page.getByRole('button',{name:'A|B comparison mode',exact:true})
    await toggle.waitFor();await page.waitForFunction(()=>!document.querySelector('.ac-mode-btn').disabled)
    if(await toggle.getAttribute('aria-pressed')!=='true')await toggle.click()
    await page.getByRole('region',{name:'A|B comparison settings',exact:true}).waitFor()
    const expand=page.getByRole('button',{name:'Expand settings',exact:true});if(await expand.isVisible())await expand.click()
    await page.getByRole('button',{name:'Enable Safari live comparison',exact:true}).waitFor()
  }
  const count=()=>page.evaluate(()=>window.__requests.filter(request=>request.method==='enablePreviewNetwork').length)
  const editor=()=>page.getByRole('textbox',{name:'需求',exact:true})
  const setup=()=>page.getByRole('region',{name:'Safari live comparison setup',exact:true}).first()
  await open('preview-network')
  await editor().fill('Keep this task while setting up Safari')
  const draft=await editor().inputValue(),references=await page.evaluate(()=>JSON.stringify(window.__input().occurrences))
  check(await page.getByRole('button',{name:'Try built-in example',exact:true}).isDisabled(),'an unprepared Safari example must not start generation')
  await setup().getByRole('button',{name:'Enable Safari live comparison',exact:true}).click()
  await page.getByRole('region',{name:'Confirm loopback address setup',exact:true}).waitFor()
  check(await count()===0,'reading the setup explanation must not request system authorization')
  await page.getByRole('button',{name:'Not now',exact:true}).click()
  check(await count()===0,'canceling the explanation must not request authorization')
  check(await editor().inputValue()===draft,'canceling setup must retain the task')
  await setup().getByRole('button',{name:'Enable Safari live comparison',exact:true}).click()
  await page.setViewportSize({width:390,height:844})
  check(await setup().evaluate(element=>element.scrollWidth<=element.clientWidth+1),'setup must fit a narrow composer')
  check(await page.getByRole('region',{name:'Confirm loopback address setup',exact:true}).evaluate(element=>element.firstElementChild.getBoundingClientRect().width>=element.clientWidth-28),'the permission explanation must retain a readable full-width column')
  await page.screenshot({path:path.join(output,'safari-setup-confirmation.png')})
  await page.getByRole('button',{name:'Continue and request system authorization',exact:true}).click()
  await setup().getByText('Safari live comparison is ready',{exact:true}).waitFor()
  check(await count()===1,'one explicit confirmation must make exactly one request')
  const admitted=await page.evaluate(()=>window.__requests.find(request=>request.method==='enablePreviewNetwork').body)
  check(admitted.confirmed===true && admitted.sessionId==='s1','authorization must be explicitly confirmed in the owning conversation')
  check(await editor().inputValue()===draft,'successful setup must retain the task')
  check(await page.evaluate(()=>JSON.stringify(window.__input().occurrences))===references,'setup must retain structured references')
  check(await page.evaluate(()=>window.__commands.length)===0,'setup must not start a comparison')
  check(await page.getByRole('button',{name:'Try built-in example',exact:true}).isEnabled(),'successful setup must enable an explicit later example action')
  await open('preview-network-cancel')
  await editor().fill('Keep this task after canceled authorization')
  await setup().getByRole('button',{name:'Enable Safari live comparison',exact:true}).click()
  await page.getByRole('button',{name:'Continue and request system authorization',exact:true}).click()
  await setup().getByRole('alert').waitFor()
  check((await setup().getByRole('alert').innerText()).includes('System authorization was canceled.'),'a known authorization cancellation must be explained in the selected interface language')
  check(await editor().inputValue()==='Keep this task after canceled authorization','a rejected system request must preserve the task')
  check(await count()===1 && await page.evaluate(()=>window.__commands.length)===0,'a rejected request must neither retry nor generate')
  await page.getByRole('button',{name:'Continue and request system authorization',exact:true}).click()
  await setup().getByText('Safari live comparison is ready',{exact:true}).waitFor()
  check(await count()===2,'retry needs a second explicit action')
  await page.goto(harness.url+'/?state=judging')
  const dialog=page.getByRole('dialog',{name:'AgentCompare',exact:true})
  const candidate=dialog.getByRole('region',{name:'Candidate A',exact:true})
  await candidate.locator('iframe').waitFor()
  check(await dialog.getByText('Safari may restrict cookies in embedded pages.',{exact:false}).isVisible(),'Safari must show its first-party storage path beside live previews')
  check(await candidate.getByRole('link',{name:'Open A in browser',exact:true}).isVisible(),'a dedicated numeric preview must expose the real-tab action')
  await page.evaluate(()=>{const legacy=window.__runSnapshot();const port=new URL(legacy.candidates[0].previewUrl).port;legacy.candidates[0].previewUrl='http://ac-'+ 'a'.repeat(32)+'.localhost:'+port+'/a';for(let i=0;i<10;i++)window.__getPlans.push({value:legacy})})
  const reopen=candidate.getByRole('button',{name:'Open A at a dedicated address',exact:true})
  await reopen.waitFor()
  check(await candidate.locator('iframe').count()===0,'an unsafe legacy Safari origin must not remain embedded')
  check(await candidate.getByRole('link',{name:'Open A in browser',exact:true}).count()===0,'the legacy shortcut must not bypass the origin transition')
  await page.evaluate(()=>window.__getPlans.splice(0))
  await reopen.click()
  await candidate.locator('iframe').waitFor()
  check(await candidate.getByRole('link',{name:'Open A in browser',exact:true}).isVisible(),'the direct-tab action must return after a successful origin transition')
  const resumed=await page.evaluate(()=>window.__requests.find(request=>request.method==='reopenPreview').body)
  check(resumed.runId==='0a1b2c3d'&&resumed.label==='A'&&resumed.replace===true,'reopening a legacy preview must target that exact candidate and explicitly replace the old process')
  check(await page.evaluate(()=>window.__commands.length)===0,'reopening a legacy preview must not generate the candidate again')
  check(errors.length===0,errors.join('; '))
  const result={scenario:'interface-only setup responses with an explicit Safari user-agent fixture; no system changes',assertions,engine:launched.engine,browser:browser.version(),systemAuthorizationExecuted:false,independentNumericFixtureAddresses:true,pageErrors:errors.length}
  await writeFile(path.join(output,'safari-setup-interface.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
} catch(error){await page?.screenshot({path:path.join(output,'safari-setup-failure.png')}).catch(()=>{});throw error}
finally {await context?.close();await browser?.close();await harness.close()}

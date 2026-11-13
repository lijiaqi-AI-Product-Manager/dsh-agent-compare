import test from 'node:test'
import assert from 'node:assert/strict'
import {collectTotal, lifetimeTotal, renderTotal, renderBadge} from '../scripts/npm-total-downloads.mjs'

test('lifetime coverage includes older days rather than a rolling window', () => {
  const rows = Array.from({length: 400}, (_, index) => ({day: new Date(Date.UTC(2025,0,1) + index * 86400000).toISOString().slice(0,10), downloads: 2}))
  assert.equal(lifetimeTotal(rows[0].day, rows.at(-1).day, rows).total, 800)
})
test('zero is accepted only as a present daily observation', () => {
  assert.equal(lifetimeTotal('2026-11-10','2026-11-11',[{day:'2026-11-10',downloads:9779},{day:'2026-11-11',downloads:0}]).total,9779)
  assert.throws(()=>lifetimeTotal('2026-11-10','2026-11-11',[{day:'2026-11-10',downloads:9779}]),/Missing/)
})
test('duplicate, negative and fractional source values are rejected', () => {
  for(const rows of [[{day:'2026-11-11',downloads:1},{day:'2026-11-11',downloads:1}],[{day:'2026-11-11',downloads:-1}],[{day:'2026-11-11',downloads:1.5}]]) {
    assert.throws(()=>lifetimeTotal('2026-11-11','2026-11-11',rows))
  }
})
test('an unreported future day is not appended as zero', () => {
  assert.throws(()=>lifetimeTotal('2026-11-11','2026-11-11',[{day:'2026-11-11',downloads:156},{day:'2026-11-12',downloads:0}]),/outside/)
})
test('invalid dates and unsafe totals are rejected', () => {
  assert.throws(()=>lifetimeTotal('2026-02-30','2026-03-01',[]))
  assert.throws(()=>lifetimeTotal('2026-11-10','2026-11-11',[{day:'2026-11-10',downloads:Number.MAX_SAFE_INTEGER},{day:'2026-11-11',downloads:1}]),/precision/)
})
test('collector uses the publication day and the official available cutoff', async () => {
  const urls=[]
  const get=async url=>{
    urls.push(url)
    if(url.includes('registry.npmjs.org'))return{name:'dsh-agent-compare',time:{created:'2026-11-10T12:00:00Z'}}
    if(url.includes('point/last-day'))return{package:'dsh-agent-compare',start:'2026-11-11',end:'2026-11-11',downloads:156}
    return{package:'dsh-agent-compare',start:'2026-11-10',end:'2026-11-11',downloads:[{day:'2026-11-10',downloads:9779},{day:'2026-11-11',downloads:156}]}
  }
  const data=await collectTotal(get,'2026-11-13T00:00:00Z')
  assert.equal(data.total,9935)
  assert.equal(data.asOf,'2026-11-11')
  assert.ok(urls.some(x=>x.includes('/range/2026-11-10:2026-11-11/')))
})
test('unavailable sources and inconsistent point/range results fail closed', async () => {
  await assert.rejects(collectTotal(async()=>{throw Error('unavailable')}),/unavailable/)
  const get=async url=>url.includes('registry.npmjs.org')?{name:'dsh-agent-compare',time:{created:'2026-11-11T00:00:00Z'}}:
    url.includes('point/last-day')?{package:'dsh-agent-compare',start:'2026-11-11',end:'2026-11-11',downloads:156}:
    {package:'dsh-agent-compare',start:'2026-11-11',end:'2026-11-11',downloads:[{day:'2026-11-11',downloads:0}]}
  await assert.rejects(collectTotal(get,'2026-11-13T00:00:00Z'),/disagree/)
})
test('collector keeps the full lifetime when it exceeds one API range', async () => {
  const ranges=[]
  const get=async url=>{
    if(url.includes('registry.npmjs.org'))return{name:'dsh-agent-compare',time:{created:'2025-01-01T12:00:00Z'}}
    if(url.includes('point/last-day'))return{package:'dsh-agent-compare',start:'2026-11-11',end:'2026-11-11',downloads:1}
    const [start,end]=new URL(url).pathname.split('/')[3].split(':')
    ranges.push({start,end})
    const downloads=[]
    for(let time=Date.parse(start+'T00:00:00Z');time<=Date.parse(end+'T00:00:00Z');time+=86400000)downloads.push({day:new Date(time).toISOString().slice(0,10),downloads:1})
    return{package:'dsh-agent-compare',start,end,downloads}
  }
  const data=await collectTotal(get,'2026-11-13T00:00:00Z')
  assert.equal(data.total,(Date.parse('2026-11-11')-Date.parse('2025-01-01'))/86400000+1)
  assert.equal(ranges.length,2)
  assert.ok(ranges.every(r=>(Date.parse(r.end)-Date.parse(r.start))/86400000<365))
})
test('card and badge expose the same complete lifetime number and coverage', () => {
  const snapshot={firstDay:'2026-11-10',asOf:'2026-11-11',total:9935,daily:[{day:'2026-11-10',downloads:9779},{day:'2026-11-11',downloads:156}]}
  for(const theme of ['light','dark'])for(const mobile of [false,true]){
    const svg=renderTotal(snapshot,theme,mobile)
    assert.ok(svg.includes('9,935')&&svg.includes('2026-11-10')&&svg.includes('2026-11-11'))
    assert.ok(!svg.includes('<polyline'))
  }
  assert.ok(renderBadge(snapshot).includes('9,935'))
  assert.throws(()=>renderTotal({...snapshot,total:156}),/differs/)
})


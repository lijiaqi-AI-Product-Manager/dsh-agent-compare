import { describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PreviewNetwork, previewAliasCommand, previewAliasScript, previewNetworkFailure, type PreviewNetworkSystem } from '../src/host/preview-network.ts'
import { RunStore } from '../src/core/run-store.ts'
import { isNumericPreviewHost } from '../src/core/preview-url.ts'
import { tmp } from './fixture.ts'

async function fixture() {
  const store = new RunStore(await tmp('ac-preview-network'))
  const present = new Set<string>(['127.0.0.1', '127.87.44.19'])
  const batches: string[][] = []
  const system: PreviewNetworkSystem = {
    addresses: vi.fn(async () => new Set(present)),
    provision: vi.fn(async addresses => {
      const ledger=JSON.parse(await readFile(path.join(store.home,'preview-network.json'),'utf8'))
      expect(ledger.entries.filter((entry: {state:string})=>entry.state==='planned')).toHaveLength(addresses.length)
      batches.push([...addresses]);for(const address of addresses)present.add(address)
      return addresses.map(address=>'created:'+address).join('\n')
    }),
  }
  return { store, present, batches, system, network: new PreviewNetwork(store, system, 'darwin'), signal: new AbortController().signal }
}

describe('explicit Safari preview network setup',()=>{
  it('does not inspect or configure the network on other platforms',async()=>{
    const f=await fixture(), network=new PreviewNetwork(f.store,f.system,'win32')
    expect((await network.status()).state).toBe('not-required')
    expect(await network.allocate({runId:'1234abcd',label:'A'},f.signal)).toBeUndefined()
    await expect(network.enable(true)).rejects.toThrow(/不需要/)
    expect(f.system.addresses).not.toHaveBeenCalled();expect(f.system.provision).not.toHaveBeenCalled()
  })
  it('needs explicit confirmation and never configures addresses while reading setup',async()=>{
    const f=await fixture()
    expect((await f.network.status()).state).toBe('needs-setup')
    await expect(f.network.enable(false)).rejects.toThrow(/先确认/)
    expect(await f.network.allocate({runId:'1234abcd',label:'A'},f.signal)).toBeUndefined()
    expect(f.system.provision).not.toHaveBeenCalled()
  })
  it('journals first, excludes existing addresses, confirms observations and avoids duplicate prompts',async()=>{
    const f=await fixture(), ready=await f.network.enable(true)
    expect(ready).toMatchObject({state:'ready',available:64,configured:64,used:0,unconfirmed:0})
    expect(f.batches[0]!.every(isNumericPreviewHost)).toBe(true)
    expect(f.batches[0]).not.toContain('127.87.44.19')
    await new PreviewNetwork(new RunStore(f.store.home),f.system,'darwin').enable(true)
    expect(f.system.provision).toHaveBeenCalledTimes(1)
    expect(f.present.has('127.87.44.19')).toBe(true)
  })
  it('assigns distinct addresses across instances, labels, restarts and reopened previews',async()=>{
    const f=await fixture();await f.network.enable(true)
    const other=new PreviewNetwork(new RunStore(f.store.home),f.system,'darwin')
    const hosts=await Promise.all([f.network.allocate({runId:'1234abcd',label:'A'},f.signal),other.allocate({runId:'1234abcd',label:'B'},f.signal)])
    hosts.push(await new PreviewNetwork(new RunStore(f.store.home),f.system,'darwin').allocate({runId:'1234abcd',label:'A'},f.signal))
    hosts.push(await other.allocate({runId:'aabbccdd',label:'R'},f.signal))
    expect(new Set(hosts).size).toBe(4)
    expect(await other.status()).toMatchObject({available:60,used:4})
    await expect(other.allocate({runId:'bad',label:'A'},f.signal)).rejects.toThrow(/运行归属/)
  })
  it('does not reuse used addresses when the system releases aliases on reboot',async()=>{
    const f=await fixture();await f.network.enable(true)
    const used=await f.network.allocate({runId:'1234abcd',label:'A'},f.signal)
    const original=[...f.batches[0]!];f.present.clear();f.present.add('127.0.0.1')
    expect((await f.network.status()).state).toBe('needs-setup')
    await expect(f.network.allocate({runId:'1234abcd',label:'B'},f.signal)).rejects.toThrow(/系统重启/)
    await f.network.enable(true)
    expect(f.batches[1]!.some(address=>original.includes(address))).toBe(false)
    expect(await f.network.allocate({runId:'1234abcd',label:'A'},f.signal)).not.toBe(used)
  })
  it('retains an unconfirmed journal after cancellation and requires a fresh explicit retry',async()=>{
    const f=await fixture();f.system.provision=vi.fn(async addresses=>{f.present.add(addresses[0]!);throw new Error('User canceled')})
    await expect(f.network.enable(true)).rejects.toThrow('User canceled')
    expect(await f.network.status()).toMatchObject({state:'needs-setup',available:0,unconfirmed:64})
    expect(f.present.size).toBe(3)
    expect(await f.network.allocate({runId:'1234abcd',label:'A'},f.signal)).toBeUndefined()
  })
  it('does not treat a partial command receipt or existing system address as confirmed ownership',async()=>{
    const f=await fixture();let confirmed:string|undefined;f.system.provision=vi.fn(async addresses=>{
      for(const address of addresses)f.present.add(address)
      confirmed=addresses[0]
      return 'created:'+addresses[0]+'\nexisting:'+addresses[1]+'\ncreated:127.87.44.19'
    })
    await expect(f.network.enable(true)).rejects.toThrow(/足够/)
    expect(await f.network.status()).toMatchObject({state:'needs-setup',available:1,configured:1,unconfirmed:63})
    expect(await f.network.allocate({runId:'1234abcd',label:'A'},f.signal)).toBe(confirmed)
    await expect(f.network.allocate({runId:'1234abcd',label:'B'},f.signal)).rejects.toThrow(/不足/)
  })
  it('keeps damaged or redirected journals intact instead of resetting them',async()=>{
    const f=await fixture(), file=path.join(f.store.home,'preview-network.json')
    await writeFile(file,'{invalid')
    expect((await f.network.status()).state).toBe('unavailable')
    await expect(f.network.enable(true)).rejects.toThrow()
    expect(await readFile(file,'utf8')).toBe('{invalid')
    expect(f.system.provision).not.toHaveBeenCalled()
  })
  it('rejects incomplete assignment ownership instead of treating a previously used address as unused',async()=>{
    const f=await fixture();await f.network.enable(true)
    const address=await f.network.allocate({runId:'1234abcd',label:'A'},f.signal),file=path.join(f.store.home,'preview-network.json')
    const original=JSON.parse(await readFile(file,'utf8'))
    for(const change of ['missing-owner','missing-time','unconfirmed-assignment']){
      const ledger=structuredClone(original),entry=ledger.entries.find((item:{address:string})=>item.address===address)
      if(change==='missing-owner')delete entry.usedBy
      else if(change==='missing-time')delete entry.usedAt
      else entry.state='unconfirmed'
      const bytes=JSON.stringify(ledger);await writeFile(file,bytes)
      const restored=new PreviewNetwork(new RunStore(f.store.home),f.system,'darwin')
      expect((await restored.status()).state).toBe('unavailable')
      await expect(restored.allocate({runId:'aabbccdd',label:'B'},f.signal)).rejects.toThrow(/无效条目/)
      expect(await readFile(file,'utf8')).toBe(bytes)
    }
    expect(f.system.provision).toHaveBeenCalledTimes(1)
  })
  it('rejects redirected journals without modifying the target',async context=>{
    const second=await fixture(), target=path.join(second.store.home,'other.json'), link=path.join(second.store.home,'preview-network.json')
    await writeFile(target,'unchanged')
    try {await symlink(target,link)} catch(error) {if(process.platform==='win32'&&(error as NodeJS.ErrnoException).code==='EPERM'){context.skip();return}throw error}
    expect((await second.network.status()).state).toBe('unavailable')
    expect(await readFile(target,'utf8')).toBe('unchanged')
  })
  it('accepts the carriage-return receipt format produced by AppleScript',async()=>{
    const f=await fixture()
    f.system.provision=vi.fn(async addresses=>{for(const address of addresses)f.present.add(address);return addresses.map(address=>'created:'+address).join('\r')})
    expect(await f.network.enable(true)).toMatchObject({state:'ready',configured:64,available:64})
  })
  it.skipIf(process.platform!=='darwin')('compiles the system authorization payload without running it',async()=>{
    const f=await fixture(), output=path.join(f.store.home,'setup.scpt')
    execFileSync('/usr/bin/osacompile',['-o',output,'-e',previewAliasScript(['127.87.44.19','127.87.44.20'])],{timeout:10000,stdio:'pipe'})
  })
  it('rejects unexpected privileged payloads and keeps passwords out of the script',()=>{
    for(const hosts of [[],['127.0.0.1'],['127.87.44.19; echo x'],['127.87.44.19','127.87.44.19'],Array(65).fill('127.87.44.19')])expect(()=>previewAliasCommand(hosts)).toThrow()
    const command=previewAliasCommand(['127.87.44.19','127.87.44.20']),script=previewAliasScript(['127.87.44.19'])
    expect(command).toContain('existing:127.87.44.19');expect(command).toContain('created:127.87.44.20')
    expect(command).not.toMatch(/-alias|networksetup|hosts|launchctl|sudoers|password/)
    expect(script).toMatch(/^do shell script /);expect(script).toMatch(/with administrator privileges$/)
    expect(script).not.toMatch(/password|user name/)
  })
  it('classifies canceled and timed-out system authorization without exposing its command',()=>{
    const command=previewAliasScript(['127.87.44.19'])
    expect(previewNetworkFailure({stderr:'execution error: User canceled. (-128)',message:command})).toMatchObject({status:409,code:'preview-network-cancelled'})
    expect(previewNetworkFailure({code:'ETIMEDOUT',message:command})).toMatchObject({status:504,code:'preview-network-timeout'})
    expect(previewNetworkFailure({killed:true,message:command})).toMatchObject({status:504,code:'preview-network-timeout'})
    const failure=previewNetworkFailure(new Error(command))
    expect(failure).toMatchObject({status:500,code:'preview-network-failed'})
    expect(failure.message).not.toContain('osascript');expect(failure.message).not.toContain('127.87.44.19')
  })
})

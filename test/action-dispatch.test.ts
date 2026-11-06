import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { dispatchComparisonAction } from '../src/host/action-access.ts'
import { HttpError, readBody } from '../src/host/request.ts'
import { fixtureRecord } from './record-fixture.ts'

describe('preview restart HTTP authorization',()=>{
  it('checks the actual endpoint before invoking a restart and does not retain confirmation',async()=>{
    const restart=vi.fn(async()=>({restarted:true})), record=fixtureRecord()
    const server=createServer(async(req,res)=>{
      try {
        const method=req.url?.split('/').at(-1)??''
        if(method!=='reopenPreview'){res.writeHead(404);res.end();return}
        const body=await readBody(req)
        const value=await dispatchComparisonAction({method,comparer:{get:async()=>record},caller:async()=>({session:{id:String(body.sessionId),header:{}}}),runId:()=>String(body.runId),confirmation:body.confirmOtherSession},restart)
        res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(value))
      }catch(error){res.writeHead(error instanceof HttpError?error.status:500,{'content-type':'application/json'});res.end(JSON.stringify({error:(error as Error).message,code:error instanceof HttpError?error.code:undefined}))}
    })
    server.listen(0,'127.0.0.1');await once(server,'listening')
    const address=server.address();if(!address||typeof address==='string')throw new Error('No HTTP address')
    const post=(sessionId:string,confirmOtherSession?:unknown)=>fetch(`http://127.0.0.1:${address.port}/agent-compare/api/reopenPreview`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({runId:record.runId,label:'A',sessionId,confirmOtherSession})})
    try {
      const rejected=await post('another-conversation')
      expect(rejected.status).toBe(409);expect(await rejected.json()).toMatchObject({code:'other-session-confirmation'})
      expect(restart).not.toHaveBeenCalled()
      expect((await post('session-one')).status).toBe(200)
      expect(restart).toHaveBeenCalledTimes(1)
      expect((await post('another-conversation','true')).status).toBe(409)
      expect((await post('another-conversation',true)).status).toBe(200)
      expect(restart).toHaveBeenCalledTimes(2)
      expect((await post('another-conversation')).status).toBe(409)
      expect(restart).toHaveBeenCalledTimes(2)
    }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}
  })
  it('keeps read-only history independent of a conversation resolver',async()=>{
    const caller=vi.fn(async()=>{throw new Error('must not resolve a caller')}),runId=vi.fn(()=>{throw new Error('must not require a run')})
    expect(await dispatchComparisonAction({method:'list',comparer:{get:async()=>undefined},caller,runId,confirmation:undefined},async()=>['retained-history'])).toEqual(['retained-history'])
    expect(caller).not.toHaveBeenCalled();expect(runId).not.toHaveBeenCalled()
  })
})

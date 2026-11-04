import { createServer, request, type IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { HttpError, readBody } from '../src/host/request.ts'

const incoming = (...chunks: Buffer[]): IncomingMessage => Readable.from(chunks) as IncomingMessage

describe('comparison request payloads', () => {
  it('accepts empty bodies and objects split across UTF-8 byte boundaries', async () => {
    await expect(readBody(incoming())).resolves.toEqual({})
    const bytes = Buffer.from('{"task":"搜索商品","options":{"minutes":5}}')
    await expect(readBody(incoming(bytes.subarray(0, 12), bytes.subarray(12, 13), bytes.subarray(13)))).resolves.toEqual({ task: '搜索商品', options: { minutes: 5 } })
  })

  it.each(['null', '[]', '5', 'true', '"task"', '{"private-value":', '{"x":1,}', '{} trailing'])('rejects invalid object input %s as 400 without echoing it', async body => {
    const result = await readBody(incoming(Buffer.from(body))).catch(error => error)
    expect(result).toBeInstanceOf(HttpError)
    expect(result.status).toBe(400)
    expect(result.message).not.toContain('private-value')
  })

  it('uses bytes for the inclusive 256 KiB limit', async () => {
    const exact = JSON.stringify({ task: 'x'.repeat(256 * 1024 - 11) })
    expect(Buffer.byteLength(exact)).toBe(256 * 1024)
    await expect(readBody(incoming(Buffer.from(exact)))).resolves.toHaveProperty('task')
    await expect(readBody(incoming(Buffer.from(exact + ' ')))).rejects.toMatchObject({ status: 413 })
    const unicode = Buffer.from(JSON.stringify({ task: '字'.repeat(100000) }))
    await expect(readBody(incoming(unicode))).rejects.toMatchObject({ status: 413 })
  })

  it('preserves transport failures instead of calling them malformed JSON', async () => {
    const failure = new Error('connection reset')
    const stream = Readable.from((async function* () { yield Buffer.from('{'); throw failure })()) as IncomingMessage
    await expect(readBody(stream)).rejects.toBe(failure)
  })

  it('returns 400 and 413 through real HTTP sockets without invoking the endpoint', async () => {
    let accepted = 0
    const server = createServer(async (req, res) => {
      try {
        const body = await readBody(req)
        accepted++
        res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body))
      } catch (error) {
        res.writeHead(error instanceof HttpError ? error.status : 500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: (error as Error).message }))
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (!address || typeof address === 'string') throw new Error('HTTP test server missing its port')
      const post = (body: string) => new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request({ hostname: '127.0.0.1', port: address.port, method: 'POST', headers: { 'content-type': 'application/json' } }, res => {
          const chunks: Buffer[] = []
          res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }))
        })
        req.on('error', reject); req.end(body)
      })
      const malformed = await post('{"private-value":')
      expect(malformed.status).toBe(400)
      expect(malformed.body).not.toContain('private-value')
      expect((await post('x'.repeat(256 * 1024 + 1))).status).toBe(413)
      expect(accepted).toBe(0)
      expect(await post('{"task":"search"}')).toEqual({ status: 200, body: '{"task":"search"}' })
      expect(accepted).toBe(1)
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})

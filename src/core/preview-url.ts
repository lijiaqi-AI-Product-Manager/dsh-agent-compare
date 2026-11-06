import { request } from 'node:http'

/** Preview hosts are local browser names; never resolve arbitrary stored
 * names when probing a recorded preview from the host process. */
export const PREVIEW_HOST = /^ac-[0-9a-f]{32}\.localhost$/

/** Dedicated numeric origins never include the conventional parent-host address.
 * Provisioning and assignment must be proved by the caller before binding. */
export function isNumericPreviewHost(host: string): boolean {
  const parts = host.split('.')
  return parts.length === 4 && parts[0] === '127' && parts.every(part => /^(?:0|[1-9]\d{0,2})$/.test(part) && Number(part) <= 255)
    && Number(parts[1]) >= 64 && Number(parts[1]) <= 127
}

export function parsePreviewUrl(value: string, port?: number): URL {
  const url = new URL(value)
  if (url.protocol !== 'http:' || (!PREVIEW_HOST.test(url.hostname) && !isNumericPreviewHost(url.hostname) && url.hostname !== '127.0.0.1')
    || url.username || url.password || (port !== undefined && Number(url.port || 80) !== port)) throw new Error('Invalid local preview URL')
  return url
}

/** Keep the logical Host header while connecting directly to loopback. Node
 * and system resolvers need not implement the browser's .localhost rule. */
export function previewRequest(value: string): { url: string; headers: { Host: string } } {
  const logical = parsePreviewUrl(value), target = new URL(logical)
  if (PREVIEW_HOST.test(logical.hostname)) target.hostname = '127.0.0.1'
  return { url: target.href, headers: { Host: logical.host } }
}

export function fetchPreview(value: string, init: Pick<RequestInit, 'headers' | 'signal'> = {}): Promise<Response> {
  const { url, headers } = previewRequest(value)
  const requestHeaders = new Headers(init.headers)
  requestHeaders.set('Host', headers.Host)
  // The built-in fetch client rewrites Host in current Node releases. Use an
  // explicit HTTP request so the probe checks the host the browser will use.
  return new Promise((resolve, reject) => {
    const req = request(url, { headers: Object.fromEntries(requestHeaders), ...(init.signal ? { signal: init.signal } : {}) }, res => {
      const responseHeaders = new Headers()
      for (const [key, value] of Object.entries(res.headers)) if (value !== undefined) {
        for (const part of Array.isArray(value) ? value : [value]) responseHeaders.append(key, part)
      }
      const status = res.statusCode ?? 500
      if ([204, 205, 304].includes(status)) { res.destroy(); resolve(new Response(null, { status, headers: responseHeaders })); return }
      let finished = false
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          res.on('data', (chunk: Buffer) => { if (!finished) { controller.enqueue(chunk); if ((controller.desiredSize ?? 0) <= 0) res.pause() } })
          res.on('end', () => { if (!finished) { finished = true; controller.close() } })
          res.on('error', error => { if (!finished) { finished = true; controller.error(error) } })
          res.on('close', () => { if (!finished) { finished = true; controller.error(new Error('Preview response closed before completion')) } })
        },
        pull() { res.resume() },
        cancel() { finished = true; res.destroy() },
      })
      resolve(new Response(stream, { status, headers: responseHeaders }))
    })
    req.on('error', reject)
    req.on('upgrade', (_response, socket) => { socket.destroy(); reject(new Error('Preview returned a protocol upgrade')) })
    req.end()
  })
}

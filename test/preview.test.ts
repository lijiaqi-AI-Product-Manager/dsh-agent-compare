import { describe, expect, it } from 'vitest'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isPreviewProcess, startVitePreview } from '../src/core/preview.ts'
import { fetchPreview, parsePreviewUrl, previewRequest, PREVIEW_HOST } from '../src/core/preview-url.ts'
import { prepareFixtureProcess, tmp } from './fixture.ts'

async function project(status = 200) {
  const dir = await tmp('ac-preview-host'), bin = path.join(dir, 'node_modules/vite/bin')
  await mkdir(bin, { recursive: true })
  await writeFile(path.join(bin, 'vite.js'), `const http=require('node:http'),fs=require('node:fs');const port=Number(process.argv[process.argv.indexOf('--port')+1]);
const server=http.createServer((req,res)=>{const allowed=/^ac-[0-9a-f]{32}\\.localhost:\\d+$/.test(req.headers.host);res.statusCode=req.url==='/nested/?v=1'&&allowed?${status}:404;res.end(JSON.stringify({host:req.headers.host,path:req.url}));});
server.listen(port,'127.0.0.1',()=>{fs.writeFileSync('listening.json',JSON.stringify({port,pid:process.pid}));console.log('Local: http://127.0.0.1:'+port+'/nested/?v=1')});`)
  return dir
}

describe('local preview browser hosts', () => {
  it('requires a Yarn wrapper to name the exact project, invocation and port', () => {
    const cwd = path.join(process.cwd(), 'copy with space')
    const preview = { cwd, port: 1234, pid: 3, url: 'http://127.0.0.1:1234/', kind: 'build' as const, launcher: 'yarn' as const }
    const command = `node yarn.js --cwd "${cwd}" exec vite preview --port 1234 --strictPort`
    expect(isPreviewProcess(preview, command)).toBe(true)
    expect(isPreviewProcess(preview, command.replace('1234', '12345'))).toBe(false)
    expect(isPreviewProcess(preview, command.replace(cwd, cwd + '-other'))).toBe(false)
    expect(isPreviewProcess(preview, command.replace('exec vite', 'exec other'))).toBe(false)
    expect(isPreviewProcess({ ...preview, launcher: undefined }, command)).toBe(false)
  })
  it('uses distinct browser hosts per launch, probes the actual Host and keeps the configured entry path', async () => {
    const dir = await project(), previews = []
    try {
      for (let i = 0; i < 2; i++) previews.push(await startVitePreview(dir, { prepareProjectProcess: prepareFixtureProcess, timeoutMs: 15000 }))
      const hosts = previews.map(preview => new URL(preview.url).hostname)
      expect(hosts.every(host => PREVIEW_HOST.test(host))).toBe(true)
      expect(new Set(hosts).size).toBe(2)
      for (const preview of previews) {
        const response = await fetchPreview(preview.url)
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ host: `${new URL(preview.url).hostname}:${preview.port}`, path: '/nested/?v=1' })
      }
      await previews[0]!.stop()
      await expect(fetchPreview(previews[0]!.url, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
      expect((await fetchPreview(previews[1]!.url)).status).toBe(200)
    } finally { await Promise.all(previews.map(preview => preview.stop())) }
  }, 60000)

  it.each([403, 404, 500])('does not call HTTP %s a ready application', async status => {
    const dir = await project(status)
    await expect(startVitePreview(dir, { prepareProjectProcess: prepareFixtureProcess, timeoutMs: 2000 })).rejects.toThrow(/没有响应/)
    const { port } = JSON.parse(await readFile(path.join(dir, 'listening.json'), 'utf8'))
    await expect(fetchPreview(`http://ac-${'a'.repeat(32)}.localhost:${port}/nested/?v=1`, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
  }, 15000)

  it('stops its server when cancelled while waiting for a valid response', async () => {
    const dir = await project(404), controller = new AbortController()
    const pending = startVitePreview(dir, { prepareProjectProcess: prepareFixtureProcess, timeoutMs: 15000, signal: controller.signal })
    void pending.catch(() => {})
    const deadline = Date.now() + 10000
    let listening: { port: number } | undefined
    try {
      while (Date.now() < deadline) {
        listening = await readFile(path.join(dir, 'listening.json'), 'utf8').then(JSON.parse).catch(() => undefined)
        if (listening) break
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      expect(listening).toBeDefined()
    } finally { controller.abort() }
    await expect(pending).rejects.toThrow(/cancelled/)
    await expect(fetchPreview(`http://ac-${'b'.repeat(32)}.localhost:${listening!.port}/nested/?v=1`, { signal: AbortSignal.timeout(1000) })).rejects.toThrow()
  }, 20000)

  it('supports retained legacy loopback URLs and uses direct loopback transport for named hosts', () => {
    expect(parsePreviewUrl('http://127.0.0.1:1234/base/', 1234).hostname).toBe('127.0.0.1')
    const logical = `http://ac-${'c'.repeat(32)}.localhost:4321/base/?v=1`
    expect(previewRequest(logical)).toEqual({ url: 'http://127.0.0.1:4321/base/?v=1', headers: { Host: `ac-${'c'.repeat(32)}.localhost:4321` } })
    expect(() => parsePreviewUrl(logical, 4322)).toThrow()
  })

  it.each(['https://example.com/', 'http://example.com:4321/', 'http://localhost:4321/', 'http://ac-bad.localhost:4321/', `http://ac-${'a'.repeat(32)}.localhost.example.com:4321/`, 'http://user:password@127.0.0.1:1234/', 'file:///etc/hosts'])('refuses an untrusted probe destination %s', url => {
    expect(() => fetchPreview(url)).toThrow()
  })
})

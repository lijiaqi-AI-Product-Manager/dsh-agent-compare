import { describe, expect, it } from 'vitest'
import { configureUbuntuBrowserSources, selectUbuntuBrowserMirror } from '../scripts/ubuntu-browser-sources.mjs'

function fixture(entries: Record<string, string>, unsafe?: string) {
  const files = new Map(Object.entries(entries)), writes: string[] = []
  return { files, writes, io: {
    async lstat(file: string) {
      if (!files.has(file)) throw Object.assign(new Error('missing'), { code: 'ENOENT' })
      return { isFile: () => true, isSymbolicLink: () => file === unsafe, size: Buffer.byteLength(files.get(file)!) }
    },
    async readFile(file: string) { return files.get(file)! },
    async writeFile(file: string, value: string) { writes.push(file); files.set(file, value) },
  } }
}

describe('Ubuntu browser dependency sources', () => {
  it('updates indirect mirror lists while preserving priority and signed sources', async () => {
    const source = '/etc/apt/sources.list.d/ubuntu.sources', mirrors = '/etc/apt/apt-mirrors.txt'
    const config = 'Types: deb\nURIs: mirror+file:/etc/apt/apt-mirrors.txt\nSuites: noble noble-updates\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n'
    const f = fixture({ [source]: config, [mirrors]: 'http://azure.archive.ubuntu.com/ubuntu/ priority:1\nhttp://archive.ubuntu.com/ubuntu/ priority:2\n' })
    expect(await configureUbuntuBrowserSources(f.io)).toEqual({ changedSourceFiles: 1 })
    expect(f.files.get(mirrors)).toBe('https://archive.ubuntu.com/ubuntu/ priority:1\nhttps://archive.ubuntu.com/ubuntu/ priority:2\n')
    expect(f.files.get(source)).toBe(config)
    expect(f.writes).toEqual([mirrors])
  })

  it('updates security mirror lists and classic sources without changing packages', async () => {
    const source = '/etc/apt/sources.list', mirrors = '/etc/apt/apt-mirrors-security.txt'
    const f = fixture({ [source]: 'deb http://azure.archive.ubuntu.com/ubuntu noble main universe\n', [mirrors]: 'https://azure.archive.ubuntu.com/ubuntu\r\n' })
    expect((await configureUbuntuBrowserSources(f.io)).changedSourceFiles).toBe(2)
    expect(f.files.get(source)).toBe('deb https://archive.ubuntu.com/ubuntu noble main universe\n')
    expect(f.files.get(mirrors)).toBe('https://archive.ubuntu.com/ubuntu\r\n')
    expect((await configureUbuntuBrowserSources(f.io)).changedSourceFiles).toBe(0)
  })

  it('preserves unrelated repositories and similarly named paths', async () => {
    const file = '/etc/apt/sources.list', text = 'deb https://packages.microsoft.com/ubuntu/24.04/prod noble main\nhttp://azure.archive.ubuntu.com/ubuntu-other\nhttp://azure.archive.ubuntu.com.example/ubuntu\n'
    const f = fixture({ [file]: text })
    expect((await configureUbuntuBrowserSources(f.io)).changedSourceFiles).toBe(0)
    expect(f.writes).toEqual([])
    expect(f.files.get(file)).toBe(text)
  })

  it('refuses a symbolic-link mirror list before writing it', async () => {
    const file = '/etc/apt/apt-mirrors.txt', f = fixture({ [file]: 'http://azure.archive.ubuntu.com/ubuntu\n' }, file)
    await expect(configureUbuntuBrowserSources(f.io)).rejects.toThrow()
    expect(f.writes).toEqual([])
  })

  it('selects a responding official origin when the primary cannot resolve', async () => {
    const probed: string[] = []
    const selected = await selectUbuntuBrowserMirror({ codename: 'noble', probe: async (url: string) => {
      probed.push(url)
      if (new URL(url).hostname === 'archive.ubuntu.com') throw Object.assign(new Error('DNS unavailable'), { code: 'EAI_AGAIN' })
      return true
    } })
    expect(selected.mirror).toBe('https://security.ubuntu.com/ubuntu')
    expect(probed).toHaveLength(3)
    expect(probed.every(url => url.endsWith('/dists/noble/InRelease'))).toBe(true)
    const file = '/etc/apt/sources.list.d/ubuntu.sources'
    const config = 'Types: deb\nURIs: https://archive.ubuntu.com/ubuntu/\nSuites: noble noble-updates noble-security\nComponents: main universe\nSigned-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg\n'
    const f = fixture({ [file]: config })
    await configureUbuntuBrowserSources(f.io, selected.mirror)
    expect(f.files.get(file)).toBe(config.replace('https://archive.ubuntu.com/ubuntu/', 'https://security.ubuntu.com/ubuntu/'))
  })

  it('keeps a healthy primary origin regardless of probe completion order', async () => {
    const selected = await selectUbuntuBrowserMirror({ codename: 'noble', probe: async (url: string) => {
      if (new URL(url).hostname === 'archive.ubuntu.com') await new Promise(resolve => setTimeout(resolve, 5))
      return true
    } })
    expect(selected.mirror).toBe('https://archive.ubuntu.com/ubuntu')
  })

  it('bounds stalled probes, aborts them and fails when all origins are unavailable', async () => {
    const signals: AbortSignal[] = []
    await expect(selectUbuntuBrowserMirror({ codename: 'noble', timeoutMs: 10, probe: async (_url: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal)
      return await new Promise(() => {})
    } })).rejects.toThrow('No official Ubuntu HTTPS archive responded within 10 ms')
    expect(signals).toHaveLength(3)
    expect(signals.every(signal => signal.aborted)).toBe(true)
  })

  it('refuses an unapproved origin without reading or writing the source files', async () => {
    const f = fixture({ '/etc/apt/sources.list': 'deb https://archive.ubuntu.com/ubuntu noble main\n' })
    await expect(configureUbuntuBrowserSources(f.io, 'https://unapproved.example/ubuntu')).rejects.toThrow('Unsupported Ubuntu archive origin')
    expect(f.writes).toEqual([])
  })

  it('validates release paths and probe limits before making requests', async () => {
    let calls = 0
    const probe = async () => { calls++; return true }
    await expect(selectUbuntuBrowserMirror({ codename: '../noble', probe })).rejects.toThrow()
    await expect(selectUbuntuBrowserMirror({ codename: 'noble', probe, timeoutMs: 0 })).rejects.toThrow()
    await expect(selectUbuntuBrowserMirror({ codename: 'noble', probe, timeoutMs: 10001 })).rejects.toThrow()
    expect(calls).toBe(0)
  })
})

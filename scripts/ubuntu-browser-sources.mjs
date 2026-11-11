import assert from 'node:assert/strict'

const OFFICIAL_MIRRORS = Object.freeze([
  'https://archive.ubuntu.com/ubuntu',
  'https://security.ubuntu.com/ubuntu',
  'https://azure.archive.ubuntu.com/ubuntu',
])

async function probeArchive(url, { signal }) {
  const response = await fetch(url, { method: 'HEAD', redirect: 'error', signal })
  await response.body?.cancel()
  return response.status === 200
}

// A transport probe chooses an available origin; APT still verifies signatures.
// Probe all fixed official origins concurrently, with a bound on every request.
export async function selectUbuntuBrowserMirror({ codename, probe = probeArchive, timeoutMs = 5000 }) {
  assert.match(codename, /^[a-z][a-z0-9-]*$/)
  assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10000)
  const probes = await Promise.all(OFFICIAL_MIRRORS.map(async mirror => {
    const controller = new AbortController()
    let timer
    try {
      const expired = new Promise(resolve => { timer = setTimeout(() => { controller.abort(); resolve(false) }, timeoutMs) })
      const available = Promise.resolve().then(() => probe(`${mirror}/dists/${codename}/InRelease`, { signal: controller.signal }))
      return { mirror, reachable: (await Promise.race([available, expired])) === true }
    } catch { return { mirror, reachable: false } }
    finally { clearTimeout(timer); controller.abort() }
  }))
  const selected = probes.find(result => result.reachable)
  assert.ok(selected, `No official Ubuntu HTTPS archive responded within ${timeoutMs} ms; browser dependencies were not changed`)
  return { mirror: selected.mirror, probes, timeoutMs }
}

// Ubuntu runners may resolve repositories through local APT mirror lists.
// Change only approved origins; preserve suites, components and keyrings.
export async function configureUbuntuBrowserSources({ lstat, readFile, writeFile }, mirror = OFFICIAL_MIRRORS[0]) {
  assert.ok(OFFICIAL_MIRRORS.includes(mirror), 'Unsupported Ubuntu archive origin')
  let changedSourceFiles = 0
  for (const file of ['/etc/apt/sources.list.d/ubuntu.sources', '/etc/apt/sources.list', '/etc/apt/apt-mirrors.txt', '/etc/apt/apt-mirrors-security.txt']) {
    let info
    try { info = await lstat(file) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size < 1024 * 1024)
    const before = await readFile(file, 'utf8')
    const after = before.replace(/https?:\/\/(?:azure\.archive|archive|security)\.ubuntu\.com\/ubuntu(?=\/|\s|$)/g, mirror)
    if (after !== before) { await writeFile(file, after); changedSourceFiles++ }
  }
  return { changedSourceFiles }
}

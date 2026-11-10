import assert from 'node:assert/strict'

// Ubuntu runners may resolve repositories through local APT mirror lists.
// Keep their priorities, suites and signed-package policy intact.
export async function configureUbuntuBrowserSources({ lstat, readFile, writeFile }) {
  let changedSourceFiles = 0
  for (const file of ['/etc/apt/sources.list.d/ubuntu.sources', '/etc/apt/sources.list', '/etc/apt/apt-mirrors.txt', '/etc/apt/apt-mirrors-security.txt']) {
    let info
    try { info = await lstat(file) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    assert.ok(info.isFile() && !info.isSymbolicLink() && info.size < 1024 * 1024)
    const before = await readFile(file, 'utf8')
    const after = before.replace(/https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu(?=\/|\s|$)/g, 'https://archive.ubuntu.com/ubuntu')
    if (after !== before) { await writeFile(file, after); changedSourceFiles++ }
  }
  return { changedSourceFiles }
}

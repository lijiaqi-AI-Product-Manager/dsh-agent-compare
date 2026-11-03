import fs from 'node:fs/promises'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { loadFileTransfer, publishTransferEntry, restoreFileTransfer } from '../lib/core/file-transfer.js'

const [mode, repo, serialized] = process.argv.slice(2)
const ref = JSON.parse(serialized)
if (mode === 'restore') {
  process.stdout.write(JSON.stringify(await restoreFileTransfer(repo, ref)))
} else {
  const transfer = await loadFileTransfer(repo, ref)
  const original = fs.rename
  const pause = async () => {
    process.stdout.write('captured\n')
    await new Promise(() => setInterval(() => {}, 1000))
  }
  fs.rename = async (source, destination) => {
    await original(source, destination)
    if (path.resolve(String(source)) === path.join(repo, 'item.txt') && String(destination).includes(`${path.sep}${mode === 'undo' ? 'undo' : 'before'}${path.sep}`) && mode !== 'publish') {
      // The parent terminates this owned process after the real rename and
      // before the updated phase can reach the journal.
      await pause()
    }
  }
  const originalLink = fs.link
  fs.link = async (source, destination) => {
    await originalLink(source, destination)
    if (mode === 'publish' && path.resolve(String(destination)) === path.join(repo, 'item.txt')) await pause()
  }
  syncBuiltinESMExports()
  if (mode === 'undo') await restoreFileTransfer(repo, ref)
  else await publishTransferEntry(transfer, 0)
}

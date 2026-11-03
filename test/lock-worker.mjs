import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { RunStore, BusyError } from '../lib/core/run-store.js'

const [home, key, action = 'hold'] = process.argv.slice(2)
const store = new RunStore(home)
const safety = setTimeout(() => process.exit(3), 30000)
try {
  if (action === 'increment') {
    for (let i = 0; i < 8; i++) await store.withLock(key, async () => {
      const file = path.join(home, 'counter.txt'), count = Number(await readFile(file, 'utf8'))
      await new Promise(resolve => setTimeout(resolve, 5))
      await writeFile(file, String(count + 1))
    }, { waitMs: 20000 })
    process.send?.({ state: 'done' })
  } else {
    const lease = await store.acquireLock(key)
    process.send?.({ state: 'held' })
    await new Promise(resolve => process.once('message', resolve))
    lease.release()
    process.send?.({ state: 'released' })
  }
} catch (error) {
  process.send?.({ state: error instanceof BusyError ? 'busy' : 'error', message: error.message })
  process.exitCode = 1
} finally { clearTimeout(safety); process.disconnect?.() }

import { lstat, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export class BusyError extends Error {
  constructor(what: string) { super(what); this.name = 'BusyError' }
}

export interface FileLease { release(): void }

/** An exclusive SQLite connection transaction; the OS releases it on exit.
 * Guard files keep their identity permanently: never unlink or rotate them.
 * Keep these local to the host, outside executable project copies. */
export async function tryFileLease(file: string): Promise<FileLease | undefined> {
  await mkdir(path.dirname(file), { recursive: true })
  let info
  try { info = await lstat(file) } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  if (info && (!info.isFile() || info.isSymbolicLink())) throw new Error('锁文件必须是普通文件')
  const database = new DatabaseSync(file)
  try {
    database.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE')
  } catch (error) {
    database.close()
    const code = (error as { errcode?: number }).errcode
    if (code !== undefined && ((code & 0xff) === 5 || (code & 0xff) === 6)) return undefined
    throw error
  }
  let released = false
  return {
    release() {
      if (released) return
      released = true
      try { database.exec('ROLLBACK') } finally { database.close() }
    },
  }
}

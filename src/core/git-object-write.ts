import { setTimeout as delay } from 'node:timers/promises'

/** Git can lose a race finalizing an identical loose object on Windows.
 * Only retry this diagnostic around explicitly selected object writes. */
export async function withGitObjectWriteRetry<T>(operation: () => Promise<T>, platform: NodeJS.Platform = process.platform): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const transient = error instanceof Error
        && /\bexited 128:/.test(error.message)
        && /\berror: unable to write file [^\r\n]*[/\\]objects[/\\][0-9a-f]{2}[/\\](?:[0-9a-f]{38}|[0-9a-f]{62}): Permission denied(?:\r?\n|$)/i.test(error.message)
      if (platform !== 'win32' || attempt >= 2 || !transient) throw error
      await delay(50 * (attempt + 1))
    }
  }
}

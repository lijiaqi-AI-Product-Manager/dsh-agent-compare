export interface ClientCapabilities {
  ok: boolean
  canExecute: boolean
  missing: string[]
}

/** Inspect the input contract without changing the draft or claiming a token. */
export function clientCapabilities(shell: unknown, scope: unknown, commands: unknown): ClientCapabilities {
  const input = shell as { beginCommand?: unknown; state?: { getSnapshot?: unknown; subscribe?: unknown } } | undefined
  const context = scope as { bail?: unknown } | undefined
  const executor = commands as { execute?: unknown } | undefined
  const missing: string[] = []
  if (typeof input?.beginCommand !== 'function') missing.push('input.beginCommand')
  if (typeof input?.state?.subscribe !== 'function') missing.push('input.state.subscribe')
  if (typeof context?.bail !== 'function') missing.push('session.bail')
  const canExecute = typeof executor?.execute === 'function'
  if (!canExecute) missing.push('commands.execute')
  try {
    const state = typeof input?.state?.getSnapshot === 'function' ? input.state.getSnapshot() : undefined
    if (!state || typeof state.draft !== 'string' || !Number.isSafeInteger(state.draftRev) || typeof state.phase !== 'string') missing.push('input.state.getSnapshot')
  } catch { missing.push('input.state.getSnapshot') }
  return { ok: missing.length === 0, canExecute, missing }
}

/** Read only a settled tool's result content, never its arguments or call head. */
export function runIdFromToolResult(block: unknown, phase?: string): string | undefined {
  if (phase !== 'result' || !block || typeof block !== 'object') return undefined
  const result = block as { content?: Array<{ type?: unknown; text?: unknown }>; isError?: unknown }
  if (result.isError === true || !Array.isArray(result.content)) return undefined
  for (const item of result.content) {
    if (item?.type !== 'text' || typeof item.text !== 'string') continue
    try {
      const value: unknown = JSON.parse(item.text)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const id = (value as { runId?: unknown }).runId
        if (typeof id === 'string' && /^[0-9a-f]{8}$/.test(id)) return id
      }
    } catch { /* Other result text is not a comparison identity. */ }
  }
  return undefined
}

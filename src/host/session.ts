/** The Session domain owns restoration, permissions and its writer claim. */
export interface ConversationAgent { readonly session: { readonly id: string } }
export interface SessionController<A extends ConversationAgent> {
  resolveAgent(sessionId: string): Promise<{ agent: A } | { error: { code?: string; message?: string } }>
}
export class SessionAccessError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'SessionAccessError' }
}

/** Resolve without sending a prompt. Caller cancellation must not cancel a
 * restoration shared with another settings request. Never invent a session. */
export function conversationResolver<A extends ConversationAgent>(options: {
  attached(): readonly A[]
  controller(): SessionController<A> | undefined
  guard(agent: A): void
}): (sessionId: unknown, signal?: AbortSignal) => Promise<A> {
  const pending = new Map<string, Promise<A>>()
  return async (sessionId, signal) => {
    if (typeof sessionId !== 'string' || !sessionId.trim() || sessionId.length > 500) throw new SessionAccessError(400, '会话编号无效，请重新打开对话后重试')
    signal?.throwIfAborted()
    let resolution = pending.get(sessionId)
    if (!resolution) {
      resolution = (async () => {
        const controller = options.controller()
        let agent: A | undefined
        if (typeof controller?.resolveAgent === 'function') {
          const result = await controller.resolveAgent(sessionId)
          if ('error' in result) {
            const code = result.error.code
            const status = code === 'session/not-found' ? 404 : code === 'session/agent-busy' || code === 'session/writer-held' ? 409 : 503
            throw new SessionAccessError(status, result.error.message ?? (status === 404 ? '这个会话不存在，请重新打开对话' : '宿主暂时无法恢复这个会话，请稍后重试'))
          }
          agent = result.agent
        } else agent = options.attached().find(candidate => candidate.session.id === sessionId)
        if (!agent) throw new SessionAccessError(503, '宿主没有可用的会话恢复接口，请升级 DSH 或重新打开对话后重试')
        if (agent.session.id !== sessionId) throw new SessionAccessError(503, '宿主返回了不同的会话，已停止本次操作')
        options.guard(agent)
        return agent
      })()
      pending.set(sessionId, resolution)
      const current = resolution
      const clear = (): void => { if (pending.get(sessionId) === current) pending.delete(sessionId) }
      void current.then(clear, clear)
    }
    return waitForCaller(resolution, signal)
  }
}

function waitForCaller<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const aborted = (): void => { reject(signal.reason) }
    signal.addEventListener('abort', aborted, { once: true })
    void promise.then(value => { signal.removeEventListener('abort', aborted); resolve(value) }, error => { signal.removeEventListener('abort', aborted); reject(error) })
  })
}

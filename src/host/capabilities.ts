export interface HostCapabilities {
  ok: boolean
  missing: string[]
  warnings: string[]
}

/** Required execution seams fail closed; attached sessions can work without restoration. */
export function hostCapabilities(services: {
  isolation: 'own-root' | 'shared-root'
  agents?: { create?: unknown }
  subagents?: { startActivation?: unknown }
  sandbox?: { confine?: unknown }
  commands?: { register?: unknown }
  sessionController?: { resolveAgent?: unknown }
  scrubbedParentEnv: boolean
}): HostCapabilities {
  const missing: string[] = [], warnings: string[] = []
  if (services.isolation === 'own-root' && typeof services.agents?.create !== 'function') missing.push('agents.create')
  if (services.isolation === 'shared-root' && typeof services.subagents?.startActivation !== 'function') missing.push('subagents.startActivation')
  if (typeof services.sandbox?.confine !== 'function') missing.push('sandbox.confine')
  if (!services.scrubbedParentEnv) missing.push('scrubbedParentEnv')
  if (typeof services.commands?.register !== 'function') missing.push('commands.register')
  if (typeof services.sessionController?.resolveAgent !== 'function') warnings.push('sessionController.resolveAgent')
  return { ok: missing.length === 0, missing, warnings }
}

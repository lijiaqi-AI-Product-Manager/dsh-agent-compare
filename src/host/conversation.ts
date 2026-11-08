/**
 * How a comparison lives inside a conversation: the `/ab` command's input
 * grammar, and the notes that tell the conversation's model what happened
 * (generation finished, the user's pick, adoption) so later turns can build on
 * it. Notes state recorded facts only.
 */
import { publicView, type AgentRoute, type RunRecord } from '../core/index.ts'

export interface AbInput {
  readonly task: string
  readonly example: boolean
  readonly minutes?: number
  /** Two routes: a cross-model comparison. */
  readonly models?: readonly [AgentRoute, AgentRoute]
}

/**
 * `/ab [--example] [--minutes N] [--models provider/model,provider/model] <task>`.
 * Flags may appear anywhere; everything else is the task, kept verbatim.
 */
export function parseAbInput(raw: string): AbInput {
  const tokens = raw.trim().split(/(\s+)/)
  let example = false
  let minutes: number | undefined
  let models: [AgentRoute, AgentRoute] | undefined
  const rest: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!
    if (t === '--example') { example = true; i++; continue }
    if (t === '--minutes' || t === '--models') {
      // tokens alternate word / whitespace; the value is two positions ahead.
      const value = tokens[i + 2]
      if (value === undefined) throw new Error(`${t} 需要一个值`)
      if (t === '--minutes') {
        const n = Number(value)
        if (!Number.isFinite(n) || n < 5 || n > 120) throw new Error('--minutes 需要 5 到 120 之间的分钟数')
        minutes = n
      } else {
        const pair = value.split(',').map((s) => s.trim()).filter(Boolean).map(routeOf)
        if (pair.length !== 2) throw new Error('--models 需要两个模型，用逗号分隔，例如 deepseek/deepseek-chat,deepseek/deepseek-reasoner')
        models = [pair[0]!, pair[1]!]
      }
      i += 3
      continue
    }
    rest.push(t)
  }
  return { task: rest.join('').trim(), example, ...(minutes === undefined ? {} : { minutes }), ...(models === undefined ? {} : { models }) }
}

function routeOf(spec: string): AgentRoute {
  const slash = spec.indexOf('/')
  return slash > 0 ? { provider: spec.slice(0, slash), model: spec.slice(slash + 1) } : { model: spec }
}

/** The run id a `/ab` command result carries. */
export const commandResultText = (runId: string): string => `A|B 比较已开始 · 运行 ${runId}`
export const runIdInText = (text: string | undefined): string | undefined => /运行 ([0-9a-f]{8})/.exec(text ?? '')?.[1] ?? /"runId"\s*:\s*"([0-9a-f]{8})"/.exec(text ?? '')?.[1]

/** A stable key per fact worth telling the model; a new key means a new note. */
export function milestoneOf(r: RunRecord): string | undefined {
  if (r.adoption !== undefined && ['adopted', 'needs-attention', 'reverted', 'rolled-back', 'blocked', 'needs-recovery'].includes(r.adoption.state)) {
    return `adoption:${r.adoption.mode}:${r.adoption.state}:${r.adoption.startedAt}`
  }
  // A pick changed after the reveal is a new fact; the original key stays unchanged for older records.
  if (r.choice !== undefined) return r.choice.initialPick === undefined ? `choice:${r.choice.pick}` : `choice:${r.choice.pick}:revised:${r.choice.at}`
  if (r.state === 'judging') return 'judging'
  if (r.state === 'abandoned') return 'abandoned'
  return undefined
}

const files = (paths: readonly string[] | undefined): string => (paths && paths.length > 0 ? paths.slice(0, 20).join(', ') + (paths.length > 20 ? ` (+${paths.length - 20} more)` : '') : 'none')

/** The model-facing note for the run's current milestone. */
export function memoryNote(r: RunRecord): string | undefined {
  const m = milestoneOf(r)
  if (m === undefined) return undefined
  // A folder comparison ran in a private workspace; the user's folder is what matters to them.
  const folder = r.target !== undefined
  const head = `[AgentCompare run ${r.runId}] Task: ${r.task.slice(0, 400)}\n${folder ? `Folder: ${r.target!.folder ?? '(none: the conversation has no directory)'}` : `Target repository: ${r.baseline.repoRoot}`}`
  const place = folder ? 'folder' : 'project'
  if (m === 'judging') {
    const lines = publicView(r).candidates.map((c) => {
      if (c.stage !== 'ready') return `- ${c.label}: did not produce a result (${c.error?.message.split('\n')[0] ?? c.stage})`
      if (c.result === 'answer') return `- ${c.label}: replied with an answer and wrote no files`
      const v = c.verdict
      const kind = c.result === 'files' ? `wrote ${c.resultFiles?.length ?? 'some'} file(s), no live page; ` : ''
      return `- ${c.label}: ${kind}${v?.eligible ? 'passed the shared acceptance' : `did not pass (${v?.reasons.join('; ') ?? 'no verdict'})`}`
    })
    return `${head}\nBoth candidates have finished in isolated copies; nothing in the ${place} has changed yet. The user compares both in the A|B card and chooses; do not choose for them or reveal strategies.\n${lines.join('\n')}`
  }
  if (m.startsWith('choice:')) {
    const pick = r.choice!.pick
    if (pick === 'none') return `${head}\nThe user rejected both versions. The ${place} is unchanged.`
    const c = r.candidates.find((x) => x.label === pick)!
    const route = c.actualRoute ?? c.route
    const revised = r.choice!.initialPick !== undefined ? ` after the reveal (blind pick: ${r.choice!.initialPick === 'none' ? 'neither' : r.choice!.initialPick})` : ''
    const picked = `The user picked ${pick}${revised} (strategy: ${c.strategy.title}${route.model ? `; model: ${route.model}` : ''}).`
    // An answer is the whole result: the conversation keeps the picked text itself.
    if (c.result === 'answer') return `${head}\n${picked} It is an answer with no files; nothing needs to be written. The picked answer:\n${(c.summary ?? '').slice(0, 2000)}${(c.summary ?? '').length > 2000 ? '\n[…]' : ''}`
    if (folder) return `${head}\n${picked} Its files are not saved yet; the folder is unchanged. Files: ${files(c.touchedFiles)}.`
    return `${head}\n${picked} It is not adopted yet; the project is unchanged.`
  }
  if (m === 'abandoned') return `${head}\nThe comparison was ended without adopting anything. The ${place} is unchanged.`
  const a = r.adoption!
  const c = r.candidates.find((x) => x.label === a.label)
  const touched = a.writtenPaths ?? c?.touchedFiles
  if (a.mode === 'folder') {
    if (a.state === 'adopted') return `${head}\nCandidate ${a.label}'s files were saved into the new folder ${a.exportPath ?? '(unknown)'}; nothing else in the folder changed. Files: ${files(touched)}.`
    if (a.state === 'reverted') return `${head}\nThe saved folder ${a.exportPath ?? '(unknown)'} was removed again; nothing else changed.`
    return undefined
  }
  switch (a.state) {
    case 'adopted':
    case 'needs-attention':
      if (a.mode === 'branch') return `${head}\nCandidate ${a.label} was saved as branch ${a.branch ?? '(unknown)'}; the working tree and current branch are unchanged.`
      return `${head}\nCandidate ${a.label} (${c?.strategy.title ?? ''}) is now in the target repository's working tree, uncommitted. Files written: ${files(touched)}. These changes apply only to the target repository above. Before following up, confirm your working directory matches it; an example repository can differ from this conversation's original project.${a.state === 'needs-attention' ? ` Other files changed during the write: ${files(a.attention)}.` : ''}`
    case 'reverted':
    case 'rolled-back':
      return `${head}\nThe adoption of ${a.label} was undone; these files are back to their previous content: ${files(touched)}.`
    case 'blocked':
      return `${head}\nAdopting ${a.label} was refused before anything was written: ${a.message ?? ''}`
    case 'needs-recovery':
      return `${head}\nAdopting ${a.label} did not finish cleanly; the user must restore or keep the files: ${files(a.attention)}.`
    default:
      return undefined
  }
}

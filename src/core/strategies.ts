import type { Strategy } from './types.ts'

/**
 * Default same-model pair. They differ in intent the user can recognise at the
 * reveal, not in hidden sampling noise.
 */
export const DEFAULT_STRATEGIES: readonly [Strategy, Strategy] = [
  {
    id: 'conservative',
    title: '稳妥 · Conservative',
    instruction:
      'Strategy: CONSERVATIVE. Reuse the components, styles and patterns that already exist in this project. Make the smallest change that fully delivers the task. Do not add dependencies.',
  },
  {
    id: 'bold',
    title: '大胆 · Bold',
    instruction:
      'Strategy: BOLD. Rethink the layout and interaction to give the best possible experience for this task. You may restructure the affected UI freely, but keep the app building and do not add dependencies unless they are essential.',
  },
]

export function candidatePrompt(task: string, strategy: Strategy): string {
  return [
    'You are implementing one candidate for a side-by-side comparison. Another agent implements the same task independently; the user will try both running apps and pick one.',
    '',
    `Task:\n${task.trim()}`,
    '',
    strategy.instruction,
    '',
    'Rules:',
    '- Work only inside your current working directory: it is your own copy of the project (under .agents/worktrees). Never write to the repository root or to any other .agents/worktrees copy; the user\'s files and the other candidate live there.',
    '- Do not run git commit, git checkout, git reset, git stash or any command that changes git history or branches.',
    '- Do not start a dev server; AgentCompare installs dependencies, starts the app and runs the checks itself.',
    '- Keep the project building (type errors and build errors count against you).',
    '- When done, reply with a short summary (under 120 words) of what you changed and why.',
  ].join('\n')
}

import type { Strategy } from './types.ts'

/**
 * Default same-model pair. They differ in intent the user can recognise at the
 * reveal, not in hidden sampling noise. Both must deliver every stated
 * requirement; only the approach differs.
 */
export const DEFAULT_STRATEGIES: readonly [Strategy, Strategy] = [
  {
    id: 'conservative',
    title: '稳妥 · Conservative',
    instruction:
      'Strategy: CONSERVATIVE. Reuse the components, styles and patterns that already exist in this project. Make the smallest change that fully delivers every requirement of the task. Do not add dependencies.',
  },
  {
    id: 'bold',
    title: '大胆 · Bold',
    instruction:
      'Strategy: BOLD. Rethink the layout and interaction to give the best possible experience for this task, while still delivering every requirement it states. You may restructure the affected UI freely; do not add dependencies unless they are essential.',
  },
]

/** Cross-model runs give both models the same instruction, so the model is the only variable. */
export const BALANCED: Strategy = {
  id: 'balanced',
  title: '同一策略 · Same brief',
  instruction: 'Deliver every requirement of the task with a clean, idiomatic change that fits this project. Do not add dependencies unless they are essential.',
}

export function candidatePrompt(task: string, strategy: Strategy, isolation: 'own-root' | 'shared-root'): string {
  const where = isolation === 'own-root'
    ? '- Your current working directory is your own private copy of the project, and your file permissions are limited to it. Work only there.'
    : '- Work only inside your current working directory: it is your own copy of the project (under .agents/worktrees). Never write to the repository root or to any other .agents/worktrees copy; the user\'s files and the other candidate live there.'
  return [
    'You are implementing one candidate for a side-by-side comparison. Another agent implements the same task independently; the user will try both running apps and pick one.',
    '',
    `Task:\n${task.trim()}`,
    '',
    strategy.instruction,
    '',
    'Rules:',
    where,
    '- Do not run git commit, git checkout, git reset, git stash or any command that changes git history or branches.',
    '- Do not edit or delete the files that define verification: tsconfig*.json, vite/vitest config, lint config, existing test files, the scripts in package.json, or .agent-compare.json. The shared checks are bound to them; a change there means your result does not count as passing. Adding new tests is fine.',
    '- If you add or change a dependency, update the lockfile in the same change (run the package manager inside your copy). The shared install is frozen to the lockfile.',
    '- You may run the project\'s typecheck, build and test scripts to check your work. Do not start a long-running dev server; AgentCompare builds, serves and checks the app itself.',
    '- Do not start another comparison.',
    '- When done, reply with a short summary (under 120 words) of what you changed and why.',
  ].join('\n')
}

# Changelog

## 0.2.0-alpha.1 — 2026-11-02

Reworked around trustworthy delivery: isolation before execution, acceptance bound to content, adoption as a rehearsed and recoverable transaction, and resources with provable owners.

### Isolation
- Each candidate runs in its own DSH session whose directory is its private copy, so DSH's sandbox confines its writes before it runs (`own-root`). Copies moved out of the repository to `~/.dsh/agent-compare/w/<run>/<label>`.
- The 0.1 subagent path remains as an explicit fallback (`isolation: shared-root`) and is labelled as such.
- A candidate or delegated session cannot start another comparison.

### Acceptance
- Checks are bound to the baseline: script bodies, verification files (tsconfig, Vite/Vitest/lint config, existing tests, `.agent-compare.json`), lockfile and runtime. Changing any of them makes a candidate not adoptable even if its checks pass.
- The copy is verified to equal the sealed tree before and after the checks.
- Install is always frozen when a lockfile exists; the silent unlocked retry is gone.
- The preview serves the build output (`vite preview`); a dev server is shown only when the build failed, marked for observation.
- `.agent-compare.json` adds scripted browser steps (`fill`, `click`, `press`, `expectVisible`, `expectCount`, `expectText`, `viewport`) and extra scripts; a phone-sized screenshot is captured.
- Each candidate gets a verdict (`eligible`, `reasons`, `warnings`).

### Adoption
- Only eligible candidates can be written into the working tree; others can be saved as a branch.
- The expected tree (current checkout + candidate paths) is computed first; when it differs from the checked candidate, it is rehearsed with the full acceptance in a scratch copy before anything is written.
- A journal is persisted before the first write; the result must equal the rehearsed tree with HEAD and index unchanged. States: blocked, adopted, needs-attention, rolled-back, needs-recovery, reverted.
- Interrupted adoptions become `recovery` after a restart and can be restored or kept. A repository-level lock serialises adoptions across runs and processes.

### Resources and records
- Copies carry an owner mark; cleanup deletes only registered worktrees whose mark matches, and lists anything else.
- Recorded previews are stopped only when the process command line proves ownership.
- Run records use schema `agent-compare.run/v2` with a revision counter; stale saves are refused. 0.1 records are read-only history.
- Per-candidate generation budget (default 30 minutes) and a limit on concurrent comparisons.

### Panel
- Mode choice: one model with two strategies, or two configured models with one brief.
- "Try the built-in case" creates a separate example repository with explicit requirements and step-by-step acceptance.
- Choosing reveals at once. Verdicts, step results, real token usage and the actual model are shown.
- After adoption: "continue from this result" with the next task; history is a separate tab.

### Other
- Example project upgraded to Vite 6.4.5 (no known advisories).
- `engines.dsh` declared at the package root.

## 0.1.0-alpha.3 — 2026-11-01

First working version: two candidates in detached worktrees, real install and dev server, shared checks, blind pick, adoption into the working tree or a branch.

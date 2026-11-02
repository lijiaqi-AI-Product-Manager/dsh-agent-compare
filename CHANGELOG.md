# Changelog

## Unreleased

- Revalidate checkout content, HEAD and staged entries after adoption rehearsal and before each write or deletion, including changes made while its journal is saved. A changed target stops adoption before the pending path is touched.
- Journal each pending path and limit rollback to paths whose writes were attempted. Preserve new ignored files at addition paths and later edits to replacement or deletion paths.
- The smoke run now changes notes after the baseline and requires the combined checkout to be rehearsed before adoption.

## 0.2.0-alpha.3 — 2026-11-02

Comparisons now run inside the conversation, and the conversation keeps the record.

- **`/ab <task>` command.** Registered with DSH's command registry, so it runs directly against the conversation's agent, is listed in the command menu, and is logged in the session (`command/run`, `command/done`). Flags: `--minutes`, `--models provider/model,provider/model`, `--example`.
- **A|B button in the composer.** Turns the draft into an `/ab` command line and back.
- **A|B card in the conversation.** The `/ab` command row and the model's `agent_compare_start` tool call render the live comparison: two small windows with the running builds, progress, verdicts, and choose / adopt / undo / salvage actions; "大窗口查看" opens it large.
- **Conversation memory.** When generation finishes, when the user picks, and when a candidate is adopted, undone or blocked, a model-visible note is added to the conversation (hidden from the chat, kept in the log), so the next request can build on what was adopted.
- **Header button** opens history and a usage guide; the guide puts the built-in case or a two-model command into the composer.
- **Previews from history.** After adoption the record no longer points at stopped previews (history showed an empty frame); a finished candidate whose preview stopped with a host restart can be served again ("重新打开预览").

## 0.2.0-alpha.2 — 2026-11-02

From the first real-model run on DSH desktop (Windows 11): both candidates hit the 30-minute budget and everything they wrote was discarded, although one of them had already delivered every requirement (its copy later passed all 12 acceptance steps).

- **Work is never discarded at the budget.** When the budget runs out or the agent stops abnormally, the agent is stopped and what it wrote is sealed and verified like any other candidate. The acceptance decides eligibility; the verdict notes that generation was cut short.
- **Salvage.** A candidate that failed while generating (including under the previous version) and whose copy still exists can be verified from the panel ("验收已写的改动").
- **Live activity.** While generating, each card shows the number of model steps, the latest tool call, tokens so far, and how long the agent has been quiet, so a slow run reads as slow rather than stuck.
- **Time limit per comparison** (15 / 30 / 60 / 90 minutes) next to the task box.
- **Both candidates failed:** the panel says so and offers the next step instead of asking to choose.
- Copy paths are compared by their real path, so 8.3 short names, junctions and symlinks no longer stop cleanup from recognising its own copies.

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

# AgentCompare

English | [中文](README.zh.md)

**Same task. Two live builds. Pick blind.**

AgentCompare is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin. It hands one front-end task to two independent agents, each confined to its own copy of your project. It then **installs from the lockfile, builds, and actually serves both build outputs**, and runs **the same content-bound acceptance** on each. You try both real pages and choose; the strategy or model behind each is revealed right after. Before adopting, it **rehearses the chosen version on a copy of your current project** and writes it back only if that passes — with undo and recovery from interruption.

> Status: **0.2.0-alpha.3, not yet on npm.** "Verified" below lists only what was actually run.

## What it is for

UI and interaction tasks, where quality is judged by using it and tests can only tell whether something was delivered: search and filters, form flows, landing pages, dashboard layouts, component redesigns. Bug fixes and refactors with one right answer are better served by a single agent plus tests.

| Mode | Same on both sides | Different |
|---|---|---|
| One model, two strategies (default) | model, task, acceptance | "Conservative" (reuse what exists) vs "Bold" (rethink the interaction) |
| Two models, one brief | task, acceptance, instructions | the model (any two configured in DSH) |

## What it does for you

- Both versions start from **the same baseline**, including uncommitted work, without touching your index or files.
- Each candidate **can only write its own copy** — not your project, not the other candidate.
- Two installs, two builds, two ports, **running at once**.
- **One fixed, content-bound acceptance**: a candidate that edits the test script, configs or existing tests does not count as passing.
- Adoption checks the result **together with what you changed meanwhile**, and stops when the checked target changes before a pending write.

## How it works

1. **Baseline** — snapshot the working tree through a private temporary index (uncommitted and untracked files included, ignored ones excluded).
2. **Bound acceptance** — derive the checks from the baseline (`typecheck` / `lint` / `test` / `build` scripts plus a page check) and record the script bodies, content hashes of verification files (`tsconfig*`, Vite/Vitest config, lint config, existing tests, `.agent-compare.json`), the lockfile and runtime. A committed `.agent-compare.json` can add step-by-step interaction checks.
3. **Owned copies** — one branchless `git worktree` per candidate under the plugin home (`~/.dsh/agent-compare/w/<run>/<A|B>`), with an owner mark in its git admin dir.
4. **Candidate sessions** — each candidate is its own DSH session whose directory is its copy. DSH's sandbox takes a session's write boundary from that directory, so the candidate is confined **before it runs**; approvals are pinned to `never`. Each has a generation time limit (15 / 30 / 60 / 90 minutes per comparison, 30 by default). When it runs out, the agent is stopped and what it wrote is still sealed and verified; while it works, the card shows its steps, latest action and how long it has been quiet.
5. **Seal** — the session is closed and the change frozen as a commit plus a full binary patch (SHA-256); `node_modules` is always excluded.
6. **Verify** — copy equals the sealed tree → **frozen install** (a failure fails; there is no unlocked retry) → acceptance commands → serve the **build output** with `vite preview` → page acceptance in a fresh headless browser context (loads, no console errors, scripted steps, desktop and phone screenshots) → the copy still equals the sealed tree. When the build fails, only a dev-server preview is offered, marked "for observation only".
7. **Verdict** — "adoptable" only when every check passed, no verification file was touched, and the checked tree is the sealed tree. Dependency changes, missing lockfiles and a missing system browser are shown as warnings.
8. **Blind pick** — two iframes show the running builds as A and B. Choosing reveals strategy, actual model and token usage at once, and whether your pick matches what the checks favoured.
9. **Adopt** (adoptable candidates only):
   - Compute the exact tree your checkout will have: your current files plus the candidate's touched paths. If you edited any of those paths since the baseline, stop — nothing is written.
   - If you changed other files meanwhile, **rehearse** that combination in a scratch copy with the full acceptance; if it fails, stop — nothing is written.
   - Recheck the checkout, HEAD and staged entries after rehearsal and before each file write or deletion. A detected change stops adoption; only earlier attempted paths are considered for rollback, preserving later user edits.
   - Persist a recovery journal (pre-adopt snapshot, expected tree, HEAD and staged-state fingerprints) and hold a repository lock before the first write.
   - Write using the repository's own eol/filter settings, then verify the checkout **equals the rehearsed tree** and HEAD and the index are unchanged. Nothing is committed.
   - A failed write is rolled back automatically; an interrupted one is offered for recovery the next time the panel opens. Undo is available later unless you edited those files (they are listed, never overwritten).
   - A candidate that did not pass can only be saved as a branch (one commit, no checkout switch) for inspection.
10. **Continue** — after a successful adoption, copies and previews are released and the panel offers "continue from this result": the next task starts from what you just adopted. History is browsed separately.

## Isolation and safety: what is and is not guaranteed

| Area | How | Limit |
|---|---|---|
| Candidate writes | The candidate session's directory is its copy; DSH's sandbox enforces it up front | DSH marks its Windows sandbox as partial; platform temp areas may be writable |
| Your project | Compared with the baseline while candidates run and shown in the panel | Candidates cannot write there, so differences are your own edits; adoption checks for overlap |
| Concurrent editing | Rechecks the target after rehearsal and before each write, including after saving its journal | The repository lock coordinates plugin operations; it does not lock external editors. Pause edits during the brief write stage |
| Acceptance | Script bodies, configs and test files are hash-bound; the copy is checked before and after | Requirements that cannot be checked automatically are left to you, never claimed as verified |
| Dependencies | Always a frozen install when a lockfile exists | Projects without a lockfile get an unlocked install, with a warning |
| Processes | A recorded preview is stopped only when its command line proves it is ours | Network and processes are **not** isolated; the preview servers are not sandboxed |
| Cleanup | Deletes only registered worktrees of that repository with a matching owner mark | Anything else is kept and listed |
| Older records | Records from 0.1 are shown read-only | Nothing acts on their recorded paths or pids |

If the host has no session factory (`ctx.agents.create`), AgentCompare falls back to the 0.1 subagent path (`isolation: shared-root`): copies live inside the repository under `.agents/worktrees`, and escapes are only detected afterwards. The panel and the run record state which one is in use.

## Install

Until it is on npm, build from source and install into a DSH profile:

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
```

```bash
cd dsh-agent-compare && npm ci && npm pack
```

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-0.2.0-alpha.3.tgz
```

After restarting DSH, comparisons run inside the conversation:

- **The A|B button at the bottom left of the composer** sends the message as an `/ab` command; click it again to turn it off. Typing `/ab <task>` does the same.
- **The A|B card in the conversation** shows both candidates' running builds in two small windows, with progress and verdicts; choosing, adopting and undoing all happen in the card ("大窗口查看" enlarges it).
- **Record and memory**: the command and its result are in the conversation's session log, and each milestone (generation finished, your pick, adoption or undo) is written into the conversation as a model-visible note, so the next message can build on what was adopted.
- **The A|B button in the header** opens history (with reopening stopped previews) and the guide; the guide puts the built-in case (`/ab --example`) into the composer for a first try.

Flags: `--minutes 60` per-candidate time limit; `--models provider/model,provider/model` two models; `--example` the built-in case in a new example repository.

A model can also call the `agent_compare_start` tool (`task`, optional `time_limit_minutes`); the conversation shows the same A|B card.

## Configuration (optional)

Append an id-targeted entry to the profile's `cordis.patch.yml`:

```yaml
- id: agent-compare
  name: dsh-agent-compare
  config:
    generationMinutes: 20
```

| Key | Default | Meaning |
|---|---|---|
| `generationMinutes` | `30` | Per-candidate generation budget |
| `maxActiveRuns` | `1` | Comparisons generating at the same time |
| `isolation` | `own-root` | `shared-root` is the experimental 0.1 path |
| `home` | `~/.dsh/agent-compare` | Records, patches, screenshots and copies |

## Repository acceptance: `.agent-compare.json`

Commit it at the repository root (the baseline version is used; a candidate editing it does not count):

```json
{
  "scripts": ["test:e2e"],
  "browser": {
    "path": "/",
    "steps": [
      { "label": "8 products at first", "expectCount": "[data-testid=product-card]", "min": 8, "max": 8 },
      { "fill": "input[type=search]", "text": "lamp" },
      { "expectCount": "[data-testid=product-card]", "min": 1, "max": 1 },
      { "click": "button:has-text(\"Clear\")" },
      { "viewport": { "width": 390, "height": 844 } },
      { "expectVisible": "input[type=search]" }
    ]
  }
}
```

Step kinds: `fill`, `click`, `press`, `expectVisible`, `expectCount`, `expectText`, `viewport`; selectors are Playwright selectors. A complete example: [examples/vite-react-demo/.agent-compare.json](examples/vite-react-demo/.agent-compare.json).

## Compatibility

| Item | Status |
|---|---|
| DSH 0.2.1-rc.3 desktop, Windows 11 | A full real-model round (generate, verify, pick, adopt) completed; candidate sessions write only their own copy, and shell commands work |
| DSH 0.2.1-rc.4+, Web UI | Not tested |
| macOS / Linux | Core tests run in CI; not tested inside DSH |
| Node | ≥ 22.19 (tested on 24) |
| Projects | Vite; npm / pnpm / yarn; a Git repository with at least one commit |

## Verified (2026-11-02, Windows 11, Node 24.22, Git 2.53)

- 76 automated tests, including real git, frozen npm installs, builds and preview processes (temporary paths contain spaces), plus unit and host-contract tests. Regressions cover: a rewritten test script passes its check but is not adoptable; failing checks; dependency changes without a lockfile update fail the frozen install with no unlocked retry; generation budget; exact adoption with HEAD and index untouched and resources released; rehearsal that adopts and keeps your other changes, or blocks without writing when the combination fails; overlap; recovery after an interrupted write; the repository lock; cleanup refusing directories it cannot prove it owns; stale-record saves; read-only legacy records; process ownership by command line; and the candidate session contract (directory = copy, sandbox `workspace-write`, approvals `never`, a stop before start, reported token usage).
- Adoption regressions preserve edits made during rehearsal or journal persistence, stop on concurrent HEAD/index changes, guard replacements and deletions, preserve ignored files at addition paths, and roll back only attempted paths. Retrying after resolving an overlap still supports adoption and undo.
- `node scripts/smoke.mjs`: the built-in case with scripted agents on real Vite 6 and system Edge. The complete version passes 12/12 acceptance steps; the one missing the clear button passes 9/12 and is not adoptable. Notes are edited after the baseline, so adoption must rehearse the combined result and preserve the updated notes. With `--escape B`, a write outside the copy is detected.

- Real model (DSH 0.2.1-rc.3 desktop, deepseek-flash, built-in case): both candidate session headers record their own copy as `cwd`, with `sandbox/mode` `workspace-write` and `approval/policy` `never`; `pwsh` runs inside the candidates (the 0.1 `SetNamedSecurityInfoW` error is gone); token usage comes from the session logs. Neither candidate declared completion within 30 minutes. One had written its whole change, and the shared acceptance run on its copy afterwards passed the frozen install, typecheck, build and 12/12 page steps — which is why 0.2.0-alpha.2 verifies written work when the time limit is reached.

- A full real-model round (DSH 0.2.1-rc.3 desktop, deepseek-flash, one model with two strategies, 60-minute limit): each candidate generated for about 42 minutes, using about 2.64M and 2.94M tokens; both passed typecheck, build and page acceptance; B was picked and adopted into the working tree (`src/App.tsx`, `src/styles.css`), uncommitted, with index and HEAD unchanged.
- In-conversation runs (DSH 0.2.1-rc.3 runtime, test profile): `/ab` appears in the command menu; the composer's A|B button turns the draft into `/ab …`, which is executed as the command; the session log records `command/run` (`ab` and its arguments) and `command/done` (with the run id); when generation finishes, a note describing the result is queued into that conversation for the model's next step; the host accepted every registration (composer button, command card, tool card, header button).

## Not verified yet

- How the in-chat A|B card looks in the desktop app, and the full "adopt, then ask for the next change" flow with the model reading the record.
- On this Windows machine each tool call inside DSH's sandbox took from about ten seconds to several minutes, and the model often waited two to three minutes between steps, so one comparison can exceed 30 minutes. The cause lies on the DSH and model-service side and has not been pinned down.
- Whether storage inside the panel's iframes is isolated from your own browser; use "open in browser" when it matters.
- Provider behaviour in two-model mode.

## Known limitations

- Vite projects only; a Git repository with at least one commit.
- npm 11 blocks dependency install scripts by default; projects that need them may require approval in the project first.
- One comparison says nothing about a model's or strategy's overall quality.

## Development

```bash
npm ci && npm run typecheck && npm test
```

```bash
npm run smoke
```

```bash
node scripts/preview-ui.mjs
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [CHANGELOG.md](CHANGELOG.md).

## License

MIT

<p align="center">
  <a href="#install"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp" width="1200" alt="AgentCompare：同一需求，两版真跑。支持 DSH 桌面端与浏览器 / One task. Two live builds. DSH Desktop + Web."></a>
</p>

# AgentCompare

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=0f766e&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=0f766e&style=flat&labelColor=334155&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=334155&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5-2563eb?style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · **English** · [日本語](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ja.md) · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · [Deutsch](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.de.md)

**Same task. Two live builds. Pick blind.**

**DSH 桌面端 + 浏览器 / Desktop + Web**

<p align="center"><a href="#install">安装 / Install</a> · <a href="#demo">真实演示 / Recorded demo</a></p>

> **1.0.1 · Stable release.** Supports the DSH desktop app and browser interface. Local Git repositories with a root-level Vite front end. Reuses your current DSH model.

The main branch's two example scopes, copy-space review and package-manager expansion are unreleased. The published npm 1.0.1 does not include them; see [Unreleased](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md#unreleased).

AgentCompare is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin: build two versions of one front-end task, run shared checks, and try both real pages. Choose before seeing the model or strategy, then review the combination with your current project before adoption.

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [Plugin directories and installation](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [Listing status / 收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

<p align="center">
  <a href="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp" width="1200" alt="真跑，才好选；看清，再采用。同一任务独立运行，审查选中候选后确认写回 / Run it. Then choose. Review. Then adopt. Run separately and inspect the selected candidate before applying."></a>
</p>

<p align="center"><sub>功能示意 / Product illustrations · <a href="#demo">查看真实演示 / Watch the recorded workflow</a></sub></p>

<a id="demo"></a>

## Watch the complete workflow

[![Fixed-candidate workflow: interact with both apps, check, choose and adopt](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/docs/media/comparison-preview.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

Fixed-candidate sample with a Chinese interface. Application execution, shared checks and adoption are real; waiting periods are cut and local paths are hidden.

[Full video (28 seconds)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [Method and results](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<a id="install"></a>

## Install

Interface language in 1.0: Simplified Chinese. Both DSH Desktop and Web are supported; the documentation languages are independent of the interface language.

These commands target a self-managed DSH Web profile. The desktop application's `desktop` profile is app-managed; use its Plugins page.

Install the npm package into the default Web profile (the npm badge above shows registry status):

```bash
dsh plugin --profile web add dsh-agent-compare@1.0.1
```

For another self-managed profile, replace `web` with its actual name.

Or build from source and install:

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
```

```bash
cd dsh-agent-compare
npm ci
npm pack
```

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-1.0.1.tgz
```

After restarting DSH, enable **A|B at the bottom left of the conversation composer**:

1. A settings strip opens above the existing input. Choose one model with two strategies, or select two configured models. The default reuses the current model.
2. Select a per-candidate generation limit (5–120 minutes). Settings are retained for this conversation across reopening.
3. Write the task in the original composer and send. No flags to type. Mode switching changes only its command chip, preserving the draft, references, and attachments. Unsupported attachment submissions are refused by the host while retaining the originals.
4. The conversation renders a persistent A|B card with two **live, interactive applications**. In a new conversation without a chat timeline, the same record appears above the composer. Adaptive views support direct interaction; matching desktop/phone sizes and focused A/B views are available. Expand the card for closer inspection.
5. Choose, reveal, and review source changes. Adoption displays its target repository and preflight result before a separate confirmation writes anything. Recovery actions stay at the top. **Continue conversation** exits comparison mode and focuses the original composer, retaining the record.

The example selector offers a smaller search-and-clear case or the full filtering/mobile case and remembers the choice. It creates a separate repository in the same conversation, preserving unrelated drafts; adoption targets that example repository. Both candidates use the configured real model and consume usage. Smaller scope is not a fixed-time guarantee. [Example scope and timing](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/first-use.md).

Use **comparison records** and **tutorial** at the upper right of new or existing conversations. History retains the task, checks, choice, adoption and undo. When previews stop, verification screenshots remain available.

[Records, restarts and recovery](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/runs-and-recovery.en.md) · [Supported scope](#compatibility) · [Custom acceptance](#repository-acceptance-agent-comparejson)

## What it is for

UI and interaction tasks, where quality is judged by using it and tests can only tell whether something was delivered: search and filters, form flows, landing pages, dashboard layouts, component redesigns. Bug fixes and refactors with one right answer are better served by a single agent plus tests.

| Mode | Same on both sides | Different |
|---|---|---|
| One model, two strategies (default) | model, task, acceptance | "Conservative" (reuse what exists) vs "Bold" (rethink the interaction) |
| Two models, one brief | task, acceptance, instructions | the model (any two configured in DSH) |

## What it does for you

- Both versions start from **the same baseline**, including uncommitted work, without touching your index or files.
- Each candidate requests the host's write policy rooted in its own copy; the host's enforcement limits are disclosed.
- Two installs, two builds, two ports, **running at once**.
- **One fixed, content-bound acceptance**: a candidate that edits the test script, configs or existing tests does not count as passing.
- Adoption checks the result **together with what you changed meanwhile**, and stops when the checked target changes before a pending write.

## How it works

1. **Baseline** — snapshot the working tree through a private temporary index (uncommitted and untracked files included, ignored ones excluded).
2. **Bound acceptance** — derive the checks from the baseline (`typecheck` / `lint` / `test` / `build` scripts plus a page check) and record the script bodies, content hashes of verification files (`tsconfig*`, Vite/Vitest config, lint config, existing tests, `.agent-compare.json`), the lockfile and runtime. A committed `.agent-compare.json` can add step-by-step interaction checks.
3. **Owned copies** — one branchless `git worktree` per candidate under the plugin home (`~/.dsh/agent-compare/w/<run>/<A|B>`), with an owner mark in its git admin dir.
4. **Candidate sessions** — each candidate is its own DSH session whose directory is its copy. The session requests `workspace-write` for that root before it runs; approvals are pinned to `never`. This uses the host's enforcement, including its platform limitations below. Each has a generation time limit (5 / 15 / 30 / 60 / 120 minutes in the interface, 30 by default). When it runs out, the agent is stopped and what it wrote is still sealed and verified; while it works, the card shows its steps, latest action and how long it has been quiet.
5. **Seal** — the session is closed and the change frozen as a commit plus a full binary patch (SHA-256); `node_modules` is always excluded.
6. **Verify** — copy equals the sealed tree → **frozen install** (a failure fails; there is no unlocked retry) → acceptance commands → serve the **build output** with `vite preview` → page acceptance in a fresh headless browser context (loads, no console errors, scripted steps, desktop and phone screenshots) → the copy still equals the sealed tree. When the build fails, only a dev-server preview is offered, marked "for observation only".
7. **Verdict** — adoption requires recorded checks without failures or timeouts, unchanged verification definitions and a checked tree matching the sealed tree. An unrun scripted page acceptance blocks direct adoption. A skipped basic page-load check remains an explicit warning, not a verified check. Dependency changes and missing lockfiles are also disclosed.
8. **Blind pick** — two iframes show the running builds as A and B. Choosing reveals strategy, actual model and token usage at once, and whether your pick matches what the checks favoured.
9. **Adopt** (adoptable candidates only):
   - Compute the exact tree your checkout will have: your current files plus the candidate's touched paths. If you edited any of those paths since the baseline, stop — nothing is written.
   - If you changed other files meanwhile, **rehearse** that combination in a scratch copy with the full acceptance; if it fails, stop — nothing is written.
   - Recheck the checkout, HEAD and staged entries after rehearsal and before each file write or deletion. A detected change stops adoption; only earlier attempted paths are considered for rollback, preserving later user edits.
   - Persist a recovery journal (pre-adopt snapshot, expected tree, HEAD and staged-state fingerprints) and hold a repository lock before the first write.
   - Prepare candidate bytes with the repository's eol/filter settings, retain the actual original files, and publish through links that cannot replace an existing path. An edit or new file at the handoff boundary stops the operation while retaining both contents. Verify the checkout **equals the rehearsed tree** and HEAD and the index are unchanged. Nothing is committed.
   - A failed write is rolled back automatically; an interrupted one is offered for recovery the next time the panel opens. Undo is available later unless you edited those files (they are listed, never overwritten).
   - A candidate that did not pass can only be saved as a branch (one commit, no checkout switch) for inspection.
10. **Continue** — after a successful adoption, copies and previews are released and the panel offers "continue from this result": the next task starts from what you just adopted. History is browsed separately.

## Isolation and safety: what is and is not guaranteed

Candidate sealing and verification resolve the owned Git administration from the original repository, check reciprocal links and owner marks, and use explicit Git directory/worktree arguments. Changed, linked, oversized or missing pointer metadata blocks further capture or preview reopening; ambiguous copies are retained during cleanup. Ambient Git repository/index/config selectors are ignored, while intentional private indexes remain supported. These checks protect lifecycle operations from Git pointer redirection; the host sandbox remains responsible for project processes.

| Area | How | Limit |
|---|---|---|
| Candidate writes | The candidate session's directory is its copy; DSH's sandbox enforces it up front | DSH marks its Windows sandbox as partial; platform temp areas may be writable |
| Project commands | Installation, checks, initial preview and reopened preview use the host's `workspace-write` policy; ambient child variables use its canonical scrub | Missing confinement fails without an unconfined retry. Partial enforcement is recorded and shown; this is not read or network isolation |
| Your project | Compared with the baseline while candidates run and shown in the panel | Differences are reported without attributing their source; adoption checks for overlap |
| Concurrent editing | Checks the checkout and raw-file fingerprints, retains original files before publishing with no-replace links, and preserves conflicting content during undo and recovery | The repository lock does not lock external editors. Handoff is per file; wait before editing affected paths or rearranging directories. This is not a sandbox against same-permission processes |
| Acceptance | Script bodies, configs and test files are hash-bound; the copy is checked before and after | Requirements that cannot be checked automatically are left to you, never claimed as verified |
| Dependencies | Always a frozen install when a lockfile exists; package caches stay inside each copy | Projects without a lockfile get an unlocked install, with a warning |
| Processes | A recorded preview is stopped only when its command line proves it is ours; preview file writes use the same host policy | Network access and process visibility are **not** isolated |
| Browser state | Each preview launch gets a fresh random `.localhost` hostname; the server stays on `127.0.0.1`. Host probes connect directly to loopback and require a successful HTTP status | Embedded cookies follow browser policy. Login, external backends and shared databases are outside the current scope; an external tab may use different storage. Reopening resets page state, while comparison records and screenshots remain |
| Embedded navigation | Preview frames permit scripts and forms but cannot navigate the top-level comparison window | This is not a complete hostile-code sandbox; opened pages and network requests still use the browser's policies |
| Cleanup | Deletes only registered worktrees of that repository with a matching owner mark | Anything else is kept and listed |
| Retained originals | A self-ignored `.agent-compare-transfer-*` directory in the project retains raw files and a durable journal. Its location is available in the result, and preview cleanup keeps it | Direct application requires ordinary files, at most 10,000 paths, 128 MiB total original/replacement bytes and hard-link support. Symlinks, special files and unsupported filesystems can use branch adoption. Keep these directories until recovery is complete |
| Older records | Records from 0.1 are shown read-only | Nothing acts on their recorded paths or pids |

If the host has no session factory (`ctx.agents.create`), AgentCompare falls back to the 0.1 subagent path (`isolation: shared-root`): copies live inside the repository under `.agents/worktrees`, and escapes are only detected afterwards. The panel and the run record state which one is in use.

The current Windows host restricts named-pipe stdio in confined grandchildren. npm lifecycle scripts use foreground output without changing the project's script permissions. Private files capture esbuild version checks and Vite's optional `net use` probe; the esbuild service uses the host's public anonymous-pipe primitives and inherits the same restricted token. Other tools requiring nested named pipes may still fail; they are not retried with wider permissions. File-read access and network access remain outside this boundary.

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

Step kinds: `fill`, `click`, `press`, `expectVisible`, `expectCount`, `expectText`, `viewport`; selectors are Playwright selectors. A complete example: [examples/vite-react-demo/.agent-compare.json](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json).

The definition is validated before generation. Unknown fields, unavailable scripts, malformed steps, and cross-origin page paths are rejected. Binding includes root JS/TS helpers, `scripts/`, `tools/`, `config/`, known configuration and existing tests. New verification configuration and changes to package scripts, including lifecycle hooks, also prevent direct adoption. Protect additional baseline data or helpers with `"protectedFiles": ["custom/fixture.json"]`; each entry must name an existing repository-relative file.

Binding does not infer every file an arbitrary program can read dynamically. Programmatic acceptance describes the configured checks; other quality requirements still need hands-on use and source review.

## Compatibility

| Item | Status |
|---|---|
| DSH 0.2.1-rc.3 desktop, Windows 11 | Historical compatibility case: real-model generation, verification, choice and adoption completed; candidate sessions requested their own copy's write boundary and shell commands ran |
| DSH 0.2.1-rc.5, Web UI, Windows 11 | Production command, real child sessions, live previews, adoption, refreshed history, and adopted-result context in the next main-session request; local scripted adapter |
| Linux, Ubuntu CI, DSH 0.2.1-rc.5 | Core regressions and real host confinement, environment scrub, frozen install, build, preview reopening and cancellation passed; no complete external-model delivery case yet |
| DSH next channel | Separate Windows/Linux native runtime canaries print the resolved version; see [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml). This is separate from full model-delivery acceptance |
| macOS | Not tested yet |
| Node | 26.13.0 is the primary development baseline; current 22/24 maintenance releases also have CI compatibility jobs |
| Projects | Root-level Vite projects in a Git repository with at least one commit. See the [execution matrix](docs/package-managers.md) for complete package-manager checks and known limitations |

## Verified (maintained through current CI and the cases below)

Current results are available in [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml). The reproducible runtime check also exercised DSH 0.2.1-rc.5 with Node 26.13 and Vite 8.3.5 on Windows: adjacent writes denied, child environment scrubbed, frozen installation, typecheck/build, two preview starts and cancelled writes stopped. Windows correctly reported partial enforcement.

To repeat that check using the official current host in a separate dependency directory:

```bash
npm install --prefix .runtime-checks/host-sdk --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@latest
npm run test:runtime
```

The host dependency directory is ignored and excluded from the plugin package. This runtime check uses a controlled example and does not request a model.

- Automated regressions (see the current CI results for the count), including real git, frozen npm installs, builds and preview processes (temporary paths contain spaces), plus unit and host-contract tests. Regressions cover: a rewritten test script passes its check but is not adoptable; failing checks; dependency changes without a lockfile update fail the frozen install with no unlocked retry; generation budget; exact adoption with HEAD and index untouched and resources released; rehearsal that adopts and keeps your other changes, or blocks without writing when the combination fails; overlap; recovery after an interrupted write; the repository lock; cleanup refusing directories it cannot prove it owns; stale-record saves; read-only legacy records; process ownership by command line; and the candidate session contract (directory = copy, sandbox `workspace-write`, approvals `never`, a stop before start, reported token usage).
- Adoption regressions preserve edits made during rehearsal or journal persistence, stop on concurrent HEAD/index changes, guard replacements and deletions, preserve ignored files at addition paths, and roll back only attempted paths. Retrying after resolving an overlap still supports adoption and undo.
- Startup regressions reserve capacity before asynchronous preparation, permit retry after an initial-save failure and preserve history on identifier collisions. Shutdown drains pending starts, both candidates and journaled adoption. History tests page through 65 actual record files without changing their bytes.
- Browser assertions cover composer controls and persisted settings, separate run identities, two interactive previews, blank-conversation navigation and reopening, source review, adoption confirmation, return-to-composer focus, responsive states, and dialog keyboard behaviour. History navigation covers 72 sample entries, pagination, search, late responses, older backends, retry and read-only issue filtering. Light/dark interface states pass the automated WCAG 2 A/AA and 2.1 AA rules. These checks use labelled sample runs.
- `node scripts/smoke.mjs`: the built-in case with scripted agents on React 19.3.1, Vite 8.3.5, and Playwright Chromium 156.0.8078.4. The complete version passes 12/12 acceptance steps; the one missing the clear button passes 9/12 and is not adoptable. Notes are edited after the baseline, so adoption must rehearse the combined result and preserve the updated notes. With `--escape B`, a write outside the copy is detected.
- DSH 0.2.1-rc.5, isolated profile: the production command consumes a five-minute generation setting, creates two actual candidate sessions, serves both apps, and completes review and adoption. After reload and returning to normal conversation, a local scripted adapter observes the adopted result in the real main-session request. New and existing header controls remain available, with no page errors. No external model request is made in this check.
- Development and example dependency audits report zero known advisories. Backend coverage is reported separately by `npm run test:coverage`; browser and native-host integration checks are separate layers and are not included in that percentage.

- Real model (DSH 0.2.1-rc.3 desktop, deepseek-flash, built-in case): both candidate session headers record their own copy as `cwd`, with `sandbox/mode` `workspace-write` and `approval/policy` `never`; `pwsh` runs inside the candidates (the 0.1 `SetNamedSecurityInfoW` error is gone); token usage comes from the session logs. Neither candidate declared completion within 30 minutes. One had written its whole change, and the shared acceptance run on its copy afterwards passed the frozen install, typecheck, build and 12/12 page steps — which is why 0.2.0-alpha.2 verifies written work when the time limit is reached.

- A full real-model round (DSH 0.2.1-rc.3 desktop, deepseek-flash, one model with two strategies, 60-minute limit): each candidate generated for about 42 minutes, using about 2.64M and 2.94M tokens; both passed typecheck, build and page acceptance; B was picked and adopted into the working tree (`src/App.tsx`, `src/styles.css`), uncommitted, with index and HEAD unchanged.
- In-conversation runs (DSH 0.2.1-rc.3 runtime, test profile): `/ab` appears in the command menu; the composer's A|B button turns the draft into `/ab …`, which is executed as the command; the session log records `command/run` (`ab` and its arguments) and `command/done` (with the run id); when generation finishes, a note describing the result is queued into that conversation for the model's next step; the host accepted every registration (composer button, command card, tool card, header button).
- Packed-plugin interface checks (DSH 0.2.1-rc.3 Web UI, isolated profile): graphical submission through the resident composer, two real Vite previews with search and clear interaction, choice, adoption review and working-tree writes, persisted result notes in the next-step inbox, reload recovery of the adopted record, and return to ordinary conversation. This check used fixed scripted candidates, without a model request.

## Not verified yet

- The desktop shell's final appearance after updating, and the latest host's "adopt, then ask for the next change" flow with an external model provider. Request-context delivery has been checked with the local scripted adapter.
- Historical Windows cases recorded long tool calls and inter-step waits, sometimes exceeding 30 minutes per comparison. The contributing costs have not been isolated and cannot be attributed to a particular plugin or service; the current host still needs performance measurements with an external model.
- Privacy modes and browser engines beyond the tested Chromium/Edge environments. Candidate-state separation was checked in Chromium; embedded cookies and external tabs still follow their own browser policies. This is not a complete browser security boundary.
- Provider behaviour in two-model mode.

## Known limitations

- Vite projects only; a Git repository with at least one commit.
- npm 12 installation policy can block dependency scripts; projects requiring native installation steps must first allow them under their own policy.
- One comparison says nothing about a model's or strategy's overall quality.

## Development

Use Node 26.13.0 (`.nvmrc`) and npm 12.2.1. The compiler and test baseline is TypeScript 7, React 19.3, and Vitest 5. The distributed client reuses the React runtime supplied by DSH.

```bash
npm ci && npm run typecheck && npm test
```

```bash
npx playwright-core install --only-shell chromium
npm run test:ui
npm run test:coverage
npm run smoke
```

```bash
node scripts/preview-ui.mjs
```

See [CONTRIBUTING.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md) and [CHANGELOG.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md).

## License

MIT

<!-- project-growth:start -->

## Project growth

Star history updates daily. Refresh dates use UTC; Star dates follow GitHub's aggregates. Daily npm download requests are also shown.

<a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-light.svg" width="960" alt="AgentCompare · GitHub Star history">
</picture>
</a>

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-light.svg" width="960" alt="AgentCompare · Daily download requests">
</picture>
</a>

Download requests include repeated and automated traffic; they are not unique or active users.

[Data sources and metric definitions](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/main/docs/growth.md)

<!-- project-growth:end -->

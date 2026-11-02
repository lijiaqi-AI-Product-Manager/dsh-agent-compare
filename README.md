# AgentCompare

English | [中文](README.zh.md)

**Same task. Two live builds. Pick blind.**

AgentCompare is a [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) plugin. It hands one front-end task to two independent agents, each working in its own isolated copy of your project. It then **actually installs and starts both apps** and runs **the same checks** on each. You try both real pages and choose. Only after that does it reveal which strategy (or model) built which. The winner is then **adopted safely** into your checkout.

> Status: **0.1.0-alpha, not on npm yet.** "Verified" below lists only what has actually been run.

## When to use it

Use it for UI and interaction work where quality has to be experienced rather than unit-tested: landing pages, dashboard layouts, search/filter interactions, component redesigns. Bug fixes and refactors with one right answer are better served by a single agent plus tests.

## What it does that two chat sessions don't

- Both candidates start from **one baseline**, including your uncommitted work, without touching your index or files.
- Each candidate gets its own dependencies and its own port, and **both run at the same time**.
- Both are compared with **one fixed set of checks**, defined before generation. Tests the agents wrote for themselves don't count as the shared bar.
- Adoption never overwrites what you edited while the comparison ran.

## How it works

1. **Baseline.** The working tree (tracked, untracked, not ignored) is snapshotted through a private temporary index. Your index and files are never touched.
2. **Isolation.** Each candidate gets a detached `git worktree`. No branches are created.
3. **Generation.** Each candidate runs as a DSH `spawn` subagent whose `cwd` is its own worktree.
4. **Capture.** The change is frozen as a full binary patch with its SHA-256. `node_modules` is always excluded.
5. **Run.** Dependencies are installed from the lockfile (`npm ci` / `pnpm --frozen-lockfile`), and Vite starts on a dedicated port. The candidate only counts as running once its URL answers HTTP.
6. **Checks.** The project's `typecheck` / `lint` / `build` / `test` scripts run, plus a headless-browser check: the page renders, there are no console errors, and a screenshot is saved. The browser check uses the system Edge or Chrome.
7. **Blind choice.** The two live apps are shown side by side, labelled only A and B. The reveal comes after your choice, together with whether the programmatic checks agreed with you.
8. **Adoption.**
   - **Into your working tree** (default): the touched files must be unchanged since the baseline. They are written through the repository's own eol and filter settings, then verified file by file against the checked candidate. Nothing is committed and the index is left alone. A failed write rolls back automatically. You can revert later as long as you haven't edited those files since.
   - **As a branch**: the branch is created without switching or modifying your checkout.

## Verified (2026-11-01, Windows 11, Node 24, Git 2.53)

- **19 unit/integration tests** against real git, in temp paths that contain spaces. They cover:
  - the snapshot leaving the user index untouched;
  - edits, deletions, binary files and nested new files;
  - refusing an overlapping adoption without writing a byte;
  - adopting next to non-overlapping user edits;
  - revert;
  - branch mode;
  - CRLF repositories.
- **`node scripts/smoke.mjs`**, a scripted agent with everything else real. Both Vite apps were interactive in about 16–22 s. The shared checks, the browser check and adoption all passed. The user's uncommitted file was preserved, and no dev servers were left behind after cleanup.
- **`--break B`**: B's type error was caught by `typecheck`, while `vite build` still passed. "Builds" and "passes the checks" are different levels of result.
- **Install**: the `npm pack` tarball installs into a fresh, isolated profile (`dsh plugin --profile <name> add <tgz>`) and composes on DSH 0.2.1-rc.3.

## Not yet verified (do not assume)

- The panel inside the DSH desktop app and the Web UI, including iframes on the `dsh-app://` page. If a preview stays blank, use the "open in browser" link the panel provides.
- Duration and success rate of a full run with a real model.
- How well the Windows sandbox blocks writes outside the worktree. DSH documents its enforcement there as partial.
- macOS and Linux.

## Known limits

- **Project type**: Vite projects with an npm, pnpm or yarn lockfile only, in a Git repository with at least one commit.
- **Usage**: DSH 0.2.1 subagent results carry no token usage, so usage shows as **unknown**, never as zero.
- **Isolation**: code is isolated by worktrees and writes are bounded by the DSH sandbox. Network and processes are **not** isolated, and the dev servers AgentCompare starts run outside the sandbox.
- **Install scripts**: npm 11 blocks install scripts by default (`allowScripts`), so projects that need native install scripts may have to approve them first.

## License

MIT

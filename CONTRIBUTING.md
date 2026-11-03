# Contributing

Thanks for helping. Issues and pull requests are welcome in Chinese or English.

## Ground rules

- **Facts only.** The run record, the panel and the README state what was observed. Anything not observed is `unknown` or "not verified", never a guess or a zero.
- **Never touch what we cannot prove we own.** Code that deletes paths or stops processes must check ownership first (owner mark, registered worktree, command line).
- **The user's checkout is sacred.** No commits, no index changes, no overwriting of edits made after the baseline.
- **Every bug gets a regression test** that fails before the fix.

## Setup

```bash
npm ci
```

```bash
npm run typecheck && npm test
```

Run `npm run check:docs` after documentation or version changes. The Chinese entry and `README.zh.md` remain identical; eight language guides share the current archive version and are included in the package. This check validates local links, heading targets, language navigation and the actual package file list.

The comparer tests use an offline fixture project (a stub `vite` installed through `file:`), so they need no network. They do start real processes and take a few minutes on Windows.

```bash
npm run smoke
```

The smoke run uses the real example project, real Vite and a system Edge or Chrome, and needs network access for the first `npm ci`.

```bash
node scripts/preview-ui.mjs
```

Then open `http://127.0.0.1:4317/?state=judging` (states: `start`, `history`, `running`, `judging`, `failed`, `revealed`, `blocked`, `adopted`, `recovery`; add `&theme=dark`). `node scripts/shoot-ui.mjs` captures them all.

## Layout

| Path | What |
|---|---|
| `src/core/` | Host-independent engine: snapshot, copies, acceptance, verification, adoption, records |
| `src/host/` | The DSH host plugin: candidate sessions, tools, HTTP API |
| `src/client/` | The panel (React, built to a classic script for DSH's module loader) |
| `test/` | Vitest suites; `fixture.ts` builds the offline project |
| `examples/vite-react-demo/` | The built-in case and its `.agent-compare.json` |

## Testing inside DSH

```bash
npm pack
```

```bash
dsh plugin --profile <test-profile> add ./dsh-agent-compare-<version>.tgz
```

Use a separate profile. Bump the version before each pack: pnpm caches a `file:` tarball by version. A client entry that throws during activation stops the whole DSH web boot, so `src/client` must never throw from `apply` (covered by `test/client-bundle.test.ts`).

## Pull requests

- Keep the change focused; describe what you observed before and after.
- Run `npm run typecheck && npm test` and, for anything touching verification or adoption, `npm run smoke`.
- Update `CHANGELOG.md` and the README's "Verified" section only with things you actually ran.

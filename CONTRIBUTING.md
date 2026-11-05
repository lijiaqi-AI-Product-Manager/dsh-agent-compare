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

Maintain the complete Chinese guide in `README.md`, then run `node scripts/sync-chinese-guide.mjs` to refresh `README.zh.md`, a smaller section index retaining the existing document URL and fragment entry points. Run `npm run check:docs` after documentation or version changes. Eight complete language guides and the Chinese section index are included in the package. This check validates local links, heading targets, language navigation and the actual package file list.

Commit rebuilt `lib/` files with changes to `src/`: GitHub source installs use those prebuilt entry points. After building, `npm run check:distribution` validates the bundle, icon, screenshots and repository mapping. `npm run check:prebuilt` checks that the committed runtime matches the build; CI runs it on Windows and Linux.

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

## Local validation

Use `npm run test:fast` for the unit project without project installation or Vite processes. `npm test` and required CI run both the unit and integration projects; the fast command is not a release gate. `npm run check:test-projects` verifies that every test file belongs to exactly one project.

After merging the workflow definition, CI can also be started explicitly for a branch through the Actions page. Check the actual run commit; an older branch result does not validate a newer head.

Repository-only demo media remain available through the documentation links. The npm package keeps its icon and screenshot metadata and images, while `check:docs` still verifies the original recorded-media hashes.

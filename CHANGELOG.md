# Changelog

## 2.0.0

- **Upgrade notes.** Existing two-version records remain readable. Records with three or four versions require 2.0.0 or later; earlier readers keep them read-only. Updating the plugin does not migrate or delete those records.
- **Keyboard and copy reliability.** Space activates the focused button instead of changing layout. Composition and editable text do not trigger digit shortcuts. Clipboard fallback always removes its temporary field and preserves focus, including denied or unavailable clipboard access.
- Revealed preset style names follow the selected interface language. Custom descriptions remain as written.

- **Two to four versions.** A comparison runs 2, 3 or 4 versions at once, labelled A–D. Records hold two to four candidates in order, and a pick, the favoured result or an adoption must name one of them. Two-version records are unchanged; release 1.3.0 and earlier list a record with more candidates as one to handle and do not act on it.
- **Styles.** Every version can get a style:
  - Approach: Conservative, Bold.
  - Look and feel: Minimal, Polished, Vibrant.
  - Priority: Friendly, Rigorous, Lean.
  - A one-line custom description of up to 120 characters, quoted as data.

  Each style has an instruction for a project and one for a request that starts from nothing or may be answered in words. Defaults are Conservative and Bold for two versions, plus Minimal for three and Vibrant for four. Comparing models gives every model one shared style, Balanced by default.
- **Blind or open.** A blind comparison keeps styles, models, summaries, change sizes and usage hidden until the pick, and shuffles the chosen styles across the labels. An open comparison shows them from the start in the chosen order. Prompts, conversation notes and the current-state context say how many versions there are and whether the user sees their styles.
- **Narrow down.** With three or four versions, any version can be set aside while choosing; the rest move up side by side, and set-aside versions cannot be picked until restored. Digits 1–4 in the card focus a version and 0 shows them all. Pages are shorter when three or four are side by side, so every version stays in view.
- **Settings.** The strip chooses the mode, the number of versions, blind or open, and a style for each version or a model for each version. It notes that more versions use more, and shows the styles this user picks most. `/ab` takes `--versions N` and two to four `--models`; the start tool takes `versions`.
- **Media.** The README header, workflow illustration, demo video, GIF, directory screenshots and social preview show four live versions, a blind pick and the reveal. The 1.1.0 recording is kept under `docs/media/history/1.1.0/`.
- **Answers read like answers.** An answer is rendered from its Markdown: headings, lists, tables, quotes, inline code and code blocks. Nothing in it is inserted as HTML, and only `http`, `https` and `mailto` links are kept. Answer cards beside each other share one height.
- **Copy what you picked.** Answers, code blocks, opened files and the saved folder path each have a copy action that copies the original text.
- **A clear end to an answer comparison.** The picked card is marked **Your pick**. After an answer is picked, the bar names it, offers **Copy answer** and **Continue conversation**, and no longer shows a clean-up action that has nothing to clean up from there.
- A result compared by content says **No runnable checks** instead of claiming that configured checks passed.
- The saved folder path stands on its own line instead of running into the Star prompt. **Enable Git in this folder** follows its question on one line, and the settings footer takes one line less.
- The README lists what each kind of request gives and how to start in three steps. Known limitations in every language no longer say that only Vite projects, or only repositories with a commit, are supported.

## 1.3.0

- **Compare in any folder.** A|B no longer refuses directories that are not the root of a Git repository with a Vite project.
  - **A folder outside Git**, or no folder, starts both versions in a private, empty repository of the run; nothing in the user's folder is read or written. **Save to this folder** writes the picked files into a new subfolder without replacing anything. **Undo save** removes only files that are unchanged since saving.
  - **Enable Git in this folder** counts what both versions would copy (Git ignore rules apply, dependency folders are left out) and runs `git init` only after confirmation. It refuses the home folder, drive roots, system folders and folders over 5,000 files or 300 MB.
- **Any project type.**
  - A project in a repository subfolder installs, checks and previews there.
  - Non-Vite Node projects are served by their own `dev` or `start` script on the preview port.
  - HTML pages are served read-only by a helper that never lists directories or follows links out of the copy.
  - Other projects are compared by their written files, which can be opened before the pick.
  - An unusable `package.json` only skips the install and says why.
- **Answers are results.** Where the baseline has nothing to run, a version that replies without writing files is a finished answer, shown side by side before the pick. The picked answer enters the main conversation's memory. A version that neither wrote nor answered still fails.
- Shared checks run only the scripts a baseline has, and Vite keeps its build fallback. A lockfile written by an install without one is not drift. A Git failure other than "not a repository" is reported instead of silently starting from an empty workspace.

- Resolve physical-path aliases in private-workspace acceptance on Windows and macOS. Folder saves publish without replacing paths, retain partial output on failure, and capture undo originals before checking concurrent edits. Retained locations remain visible in the result card.

## 1.2.0

- **Comparison results now reliably reach the main conversation.** Notes were queued from outside with `agent.inject`, which DSH may skip for a request whose batch is already claimed, may discard on cancellation, and which needed the conversation to be attached. They now enter the owning conversation's own next request through `agent/pre-step`, ahead of the user's message, deduplicated against the session log, and are retried when a request is cancelled before admission. An unexpected step payload or a failed record read leaves the request exactly as the host admitted it. The current-state system context adds the task, the blind pick, the branch and the files that are in the working tree now. While the conversation is open, each card shows whether its result is already in the conversation's memory or enters it with the next message. Verified on a real DSH 0.2.1-rc.3 web host with a local recording model.
- **Choose what both versions see from the main conversation.** The A|B settings offer *None*, *Recent* (1/3/6/10 exchanges, default 3) or *Choose* (tick individual messages, including earlier comparison results), with a live preview of the exact excerpt. *Recent* also carries the results delivered with those messages and any result the conversation has not received yet, so back-to-back comparisons build on each other. Both candidates receive the identical bounded excerpt (2,000 characters per message, 12,000 in total, newest kept) as data ahead of the task. Result notes leave out the user's project path, and the excerpt cannot close its own block. The excerpt is recorded with the run and reviewable on its card. Tools, reasoning and other injected context are excluded, and built-in examples include none. A typed `/ab` command or the model's tool call uses *Recent* when *Choose* is saved.
- Refresh the visual layer with one smart-violet brand and a lime accent, a diffuse top glow, glass surfaces instead of hairline boxes, pill controls, warm in-progress status, a light sweep on live progress and small spring/staggered motion. Text keeps WCAG AA contrast in light and dark, and reduced motion turns movement off.
- Keep multi-part notices on one line instead of splitting them into flex columns, and stop offering "verify written changes" when the copy was sealed with no change.
- Release copies of projects with large dependency trees. Dependency and cache directories (`node_modules`, `.vite`, Yarn cache and unplugged) are bound by identity instead of per-file scanning and sized within a separate budget, shown as a lower bound when large; source entries are still checked against the sealed content. Previously a typical `node_modules` exceeded the 100,000-entry / 20-second scan and blocked release permanently. The release no longer re-measures sizes, and the confirmation token no longer depends on them.
- Let the user pick the other finished version after the reveal while nothing is adopted, for example when the blind pick failed the shared checks. The blind pick stays recorded as `initialPick`, the reveal summary marks the change, and the conversation receives a separate note.
- Offer **Compare again** when no result is usable, neither version was picked or the pick failed the checks. It runs the same requirement through the conversation command with a selectable time limit, suggesting the next longer limit after a timeout; example comparisons create a fresh example repository.
- Fold the composer settings once when the conversation already shows an open comparison, so the live previews keep their space.
- Keep English failure titles and assembled sentences correctly spaced, and render failure explanations in the interface font while installation logs stay monospace.

- Translate exact interface-copy keys with intentional whitespace, including advanced Windows labels and hook evidence. Let the longer process selector wrap on small screens. Check literal copy in every client module and the visible English label at narrow and wide widths.

- Refresh the acceptance baseline to Playwright 1.65.0, Vite 8.3.6 and pnpm 12.18.0, regenerate manager fixture locks with their exact tools, and add native macOS regression/runtime jobs with pinned minimum and current DSH versions. Keep native Safari and known Windows/PnP limits separately identified.

- Add an advanced Windows auto/off control bound to each comparison. Preserve confinement and frozen checks when disabled; record observed compatibility hooks separately from the configured mode and withhold hook fingerprints until reveal.

- Apply conversation ownership and per-request confirmation to the actual preview restart endpoint. Validate control-route names against registered handlers and retain read-only history access.
- Refresh workflow media from the verified public 1.1.0 archive on DSH 0.2.2-rc.1. Preserve controlled-candidate labels, real checks/adoption/undo, editing conditions and historical assets; package two focused screenshots instead of inactive media.
- Synchronize composer and overlay state across separate host roots without losing settings updates. Disable mode entry until saved settings load, retain drafts on retry and restore history/tutorial focus to the actual trigger.
- Measure restored preview width before paint and preserve usable desktop/phone layouts. Serialize settings reads with admitted writes for the same conversation without blocking unrelated conversations.

- Add a Simplified Chinese/English interface with a persistent visible language selector and device-language default. Preserve drafts, references, model choices, live previews and comparison identity during switching; retain original application and diagnostic content.
- Keep long English controls inside 320px layouts and use labeled history/tutorial icons in narrow headers. Extract shared interface copy and scoped styles, verify both languages and retain the existing package-size budget with repository-linked measurement/distribution notes.

## 1.1.0

- Check tracked source inside build directories instead of ignoring every path named dist. Use baseline-bound Git exclusions for generated output, exercise a custom Vite output directory in smoke acceptance, and explain unsealed output without skipping source checks.

- Bind a bounded current-state summary to each owning main conversation prompt assembly, so restored or delayed milestone notes cannot leave selection mistaken for adoption. Preserve historical notes and other prompt contributions, exclude delegated and diagnostic scopes, and create no inbox messages or extra steps.

- Resolve the current conversation through the host before write or resource-control actions. Require explicit confirmation for each action on another conversation's comparison, including records without an owner, while keeping history readable.

- Maintain one complete Chinese guide and generate the existing alternate document as a checked section index. Preserve its URL and section entry points while reducing duplicate packaged content.

- Let the owning conversation stop adoption rehearsal before file handoff starts. Confirm process-tree exit, retain candidates for retry, and keep writing or recovery operations uninterrupted.

- Refresh development, CI and native package-manager acceptance to npm 12.2.2; retain the recorded tool versions of historical measurements.

- Add a smaller search-and-clear example with five shared browser steps; keep the full combination/mobile case selectable and remember the choice per conversation. Neither option requires typed flags or changes the user's current project.
- Reduce redundant candidate-side installation and check loops while retaining independent frozen installation and common verification after generation. Duration limits remain unchanged until measured samples justify a change.
- Record three source-bound real-model examples with verification, adoption, undo, complete usage and interval evidence. Keep detailed measurement records in the repository and compress the client bundle while preserving exported names and packaged translations.

- Honor exact package-manager declarations, distinguish Yarn lock generations and use immutable modern Yarn installs. Detect missing commands and reject incompatible versions before model work.
- Reuse the host's public bundled-pnpm invocation when absent from PATH without copying its package-operation credentials. Keep mutable caches and Yarn runtime state private to each copy.
- Seal source through a trusted private Git index, regenerate modern Yarn loaders, and retain project/port ownership when previews launch through Yarn.
- Exercise native npm, pnpm and both Yarn generations, project registries and local proxies on Windows/Linux CI. Explicitly retain the Windows pnpm lock and TypeScript 7/PnP limitations instead of bypassing checks.
- Record verification platform and architecture consistently with the baseline.
- Add an explicit copy-space inspection and confirmation flow after reveal. Refresh ownership, sealed content, record revisions and directory fingerprints before releasing settled copies under the existing locks.
- Keep records, source patches, screenshots, candidate sessions, source repositories, Git refs and undo originals. Block active work, unresolved recovery, uncertain process exits and changed plans; show partial cleanup truthfully.

## 1.0.1

- Return request-format errors as HTTP 400 and keep oversized requests eligible for a proper HTTP 413 response.
- Pin required host runtime checks and track the next channel separately; test the shipped compatibility evaluator and exclude next-minor prereleases.
- Identify missing input and execution capabilities, show unsupported projects before submission, preserve drafts and keep history accessible.
- Return model-tool admission immediately, reuse saved comparison settings and bind pending/result cards to their actual call identities.
- Keep background tool comparisons in the resident conversation result area when tool turns fold; preserve individual history links without duplicating preview frames.
- Withhold candidate usage, change scale, detailed activity and prose before reveal, including conversation notes and earlier verification evidence; retain complete local records.
- Bound validated history caching without weakening direct loads or revision checks, and retry only pending conversation milestones for attached sessions.
- Reduce the npm payload while retaining directory screenshot assets. Separate fast checks from the complete integration suite, verify exclusive test discovery and support explicit CI runs.

## 1.0.0 — 2026-11-04

- Keep npm lifecycle scripts in the foreground on Windows without changing script permissions. Capture esbuild version checks through private files and run its service over anonymous pipes with the existing restricted token; preserve input, output, argument boundaries, exit failures and cancellation. Exercise explicitly allowed and denied lifecycle scripts in the native-host regression.
- Diagnose installation failures from observed output: distinguish network and certificate errors, registry access, filesystem resources, unsupported runtimes, lock mismatches, timeout and cancellation. Keep bounded diagnostics with recognizable credentials redacted; never infer a lock mismatch merely from frozen installation failing.
- Offer explicit verification retry for sealed candidates after environment failures or interruption. Reuse the same commit, patch and acceptance, reject changed content, retain earlier attempts and usage, and never repeat generation. Preserve admission on save failure and coordinate retry with cancellation, restart and run capacity.
- Keep actionable recovery above collapsed logs, retain prior verification facts, show the current verification time without idle history, and record the observed package-manager version and verification host environment. Lock mismatches require a corrected new comparison instead of repeating an unchanged failure.
- Pin the documented npm installation to the tested release so stale package-manager metadata cannot silently select an earlier build. Keep source-install archives and all language guides aligned.
- Bound Windows process inspection and tree-stop helpers. If a stop cannot be confirmed, preserve the candidate or adoption rehearsal, prevent another verification or adoption from racing it, and retain the cleanup record across restart.
- Preserve original candidate-preparation diagnostics in the integration fixtures before reporting later adoption assertions.
- Provide bilingual product illustrations with explicit Desktop and Web scope, recorded demonstrations, localized guides and tested prebuilt runtime artifacts.

## 0.2.0-alpha.18 — 2026-11-03

- Retain actual original files before direct adoption, and publish prepared candidate bytes with no-replace links. A late edit or newly occupied path stops the handoff without overwriting either version; HEAD and the staged index remain unchanged.
- Persist per-file handoff phases for adoption, undo and recovery, including the first protected undo of older records. Keep raw originals independently after restoration, refuse redirected ownership metadata and unsupported filesystems, and expose retained-content locations in the result.
- Distinguish unfinished inverse recovery from restoration before adoption. Block updated clients from applying through an older backend, and show preservation and concurrent-edit limits before confirmation.
- Allocate each adoption overlay a unique private index. Add real file-boundary races, three process-termination boundaries, raw line-ending and permission restoration, older-record recovery, and browser compatibility regressions.

## 0.2.0-alpha.17 — 2026-11-03

- Prepare the first public npm preview with prebuilt Host and Client entries, the bundle patch, executable example and localized installation guides. Keep the supported scope and preview status explicit.
- Add dynamic project-status badges and verify reopened-preview cleanup by process identity, service shutdown, retained records and owned-copy removal.

- Reset composer results and settings at session boundaries; ignore older completed polling responses while allowing slow reads to make progress. Show setup failures with a retry that preserves the draft.
- Default expanded comparison to readable adaptive previews, provide more preview height and consolidate the real-address action into each candidate header. Explain adoption finishing and undo processing while retaining action exclusion.

- Show a complete recorded comparison and adoption workflow in every language guide. Keep fixed-candidate and editing disclosures visible, provide original video and asset hashes, and separate first use from record-recovery details.

- Make Chinese the default repository entry, preserve the existing Chinese URL and full English guide, and add Japanese, Korean, Spanish, Brazilian Portuguese, French and German guides. Put source installation first and keep graphical controls, current evidence and limits consistent.
- Include localized guides and contributor instructions in the package. Check language navigation, local links and heading targets, versioned installation archives and actual pack contents in CI.

## 0.2.0-alpha.15 — 2026-11-03

- Give every preview launch a fresh random localhost subdomain while keeping the server bound to loopback. Separate same-name cookies and origin storage between candidates; retain validation for legacy loopback records.
- Probe the advertised Host and configured entry path through a direct loopback HTTP transport, require a successful status and stop the owned server on cancellation. Reject non-local stored preview destinations.
- Constrain embedded navigation without disabling normal scripts and forms. Explain embedded cookie restrictions, external-tab differences and page-state reset; preserve comparison records and screenshots.

## 0.2.0-alpha.14 — 2026-11-03

- Match retained verification screenshots to the existing desktop/mobile controls. Fit one image within each card, offer original-resolution scrolling, and show explicit loading, missing-image and retryable error states. Ignore obsolete screenshot responses after switching views.
- Describe interrupted generation separately from failure and identify a single available result in partial comparisons. Improve adopted-status text contrast and keep inline support links visibly underlined.

## 0.2.0-alpha.13 — 2026-11-03

- Bind candidate sealing and verification to worktree administration discovered from the original repository. Check owner marks, reciprocal links and bounded ordinary metadata files; refuse redirected or damaged pointers and retain ambiguous copies during cleanup.
- Recheck ownership before reopening a preview and throughout candidate and adoption rehearsal verification. Ignore ambient Git repository, index and config selectors; preserve deliberate private indexes and disable external diff/text conversion during candidate capture.

## 0.2.0-alpha.12 — 2026-11-03

- Reconcile current-protocol orphaned comparisons when opened or acquired after the previous host exits, including an already-open peer. Preserve live-owner exclusion and older unmarked records; turn interrupted writes into explicit adoption recovery.
- Coalesce recovery with concurrent observations and actions. Restrict the model-facing status path to main conversations so delegated candidates cannot reconcile other runs.
- Abort obsolete card reads, reject mismatched run identities and older revisions, and retain action errors across successful background refreshes.

## 0.2.0-alpha.11 — 2026-11-03

- Restore persisted ordinary conversations through the host Session domain before loading comparison preferences, project details or models. Keep native permissions and session identity; do not create a replacement conversation or send a model prompt.
- Share concurrent restoration requests, allow an individual caller to cancel without cancelling another caller's restoration, and retain explicit missing-session, writer-conflict and unsupported-host errors.

## 0.2.0-alpha.10 — 2026-11-03

- Hold a process-backed lease for each live comparison. Another host can inspect its history and previews but cannot interrupt, select, adopt or clean up its resources. Recover orphaned current-protocol runs only after ownership becomes available.
- Keep SQLite guard files stable and let connection termination release locks. Retain older PID-directory locks for inspection; preserve unmarked older runs with potentially active resources as read-only history.
- Coordinate adoption, undo and journal recovery in the Git common directory across plugin homes and linked checkouts. Show management ownership in the conversation and disable unavailable actions without hiding previews or source review.

## 0.2.0-alpha.9 — 2026-11-03

- Validate stored records before recovery, rendering or actions. Retain malformed, unsupported, oversized and unreadable entries as read-only history with an explanation and a dedicated filter.
- Refuse updates over damaged or removed records, bound UTF-8 reads and writes to 16 MiB, and publish flushed temporary files without replacing existing new-record names. Reject unsafe record and lock identifiers.
- Retry record reads when atomic replacement or an in-place change occurs during inspection; unaffected comparisons remain available.

## 0.2.0-alpha.8 — 2026-11-03

- Browse retained comparisons across conversations, search tasks, repositories or run identifiers, and navigate all pages. Keep inline cards scoped to their own conversation and disclose an older backend that needs restarting.
- Check current Node patches in CI and preserve concurrent test observations under Vitest 5. Include history in light/dark accessibility checks.

- Close admission before shutdown, drain accepted starts and journaled writes, cancel rehearsal, await both candidates after persistence failures, and save stopped preview addresses. Host unloading now awaits cleanup.

- Reserve comparison capacity before repository preparation, transfer the slot without double-counting, and release failed startup entries. Create new records without replacing existing history, and pin baseline references only after the record is accepted.

## 0.2.0-alpha.7 — 2026-11-03

- Apply the host file-write policy and canonical child-environment scrub to installation, checks and both initial and reopened previews. Keep caches inside each copy and disclose partial enforcement.
- Adapt the standard Windows Vite CLI's optional network-drive probe to file-backed output under confinement. Preserve completed verification evidence when a later stage fails, including the initial failure explanation in bounded diagnostics.

- Give concurrent snapshots independent, atomically allocated private index directories, even within one wall-clock tick. Include the retained copy path when process inspection prevents cleanup.
- Remove the repeated blank-conversation result header, size compact previews to the available window, distinguish preview availability from passing acceptance, and restore focus to current navigation when a previous session header has unmounted.
- Serialize worktree administration within each Git common directory, including across processes, so one candidate cannot inspect another candidate's incomplete worktree metadata. Candidate generation remains parallel.
- Distinguish unavailable process identity from a stopped process. Keep preview ownership and cleanup records through recovery until inspection succeeds; bound integration-test resource concurrency.
- Validate repository acceptance definitions before generation. Bind verification helpers, all package-script definitions and added verification configuration; support explicit protected baseline files.
- Await the owned preview process exit, escalate commands that ignore a graceful stop, and retain incomplete resource cleanup for retry.
- Keep a durably completed adoption intact if cleanup fails. Show remaining resources and a cleanup retry without undoing the selected result.
- Preserve missing provider token totals as unknown. Aggregate uncached input, output, cache reads, and cache writes separately; reject contradictory or unsafe totals and show the available counters in comparison evidence.

## 0.2.0-alpha.6 — 2026-11-02

- Update the development baseline to Node 26.13, npm 12.2, TypeScript 7, React 19.3, Vitest 5, and the current Playwright-supported Chromium. Update the executable example to Vite 8.3.5.
- Bundle the client as the host's required classic loader entry using esbuild, while reusing the host's React runtime. Make bundle-contract checks mandatory in the standard test command.
- Resolve the reported development dependency advisories and add separate project/example audit gates, backend coverage reporting, and Node 22/24/26 compatibility jobs on Windows and Ubuntu.
- Verify the production comparison command and child sessions on DSH 0.2.1-rc.5 through a local scripted adapter, including delivery of the adopted result to the main conversation request.

## 0.2.0-alpha.5 — 2026-11-02

- Keep comparison records and a direct tutorial control visible in the upper-right corner before a new conversation's first message. Use the host's blank-session extension without replacing its corner control.
- Cover new and existing session transitions, direct guidance, correct history targeting, refresh, focus restoration, and narrow-window placement in browser checks.

## 0.2.0-alpha.4 — 2026-11-02

- Add a settings strip above the conversation composer: comparison mode, configured models, generation limit, and a one-click example. Preserve the draft and structured references when entering or leaving A|B mode; retain controls per conversation across reopening.
- Start through the host's session command executor and display both live applications inside the conversation. Keep the header dedicated to history, guidance, and the example. Add adaptive and matching desktop/phone preview sizes, focused A/B views, source patch review, and a separate adoption preflight confirmation.
- Keep recovery actions visible at the top, contain dialog focus, restore focus on close, and support narrow windows, both themes, and reduced motion. Add browser interaction and WCAG checks using labelled sample runs.
- Render the same result above the composer before a blank session has a chat timeline. Prevent the host's flex layout from clipping its controls, retain applications while collapsing the card, and return to ordinary conversation after adoption.
- Retry model-facing notes when a conversation is unavailable or injection fails, deduplicate against history and inbox, and identify the actual target repository for follow-up work.
- Preserve unknown token totals. Settled execution durations no longer grow while a result waits for a choice.

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

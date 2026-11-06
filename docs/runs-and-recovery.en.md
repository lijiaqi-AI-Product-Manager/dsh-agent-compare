# Records and recovery

[中文](runs-and-recovery.md) · **English** · [Quick start](quickstart.en.md)

Find the comparison in its original conversation or open comparison records in the upper-right corner. Records retain the task, checks, choice and adoption state. Choosing a candidate does not yet write it to the project.

| Situation | Next action |
| --- | --- |
| A preview stopped or disappeared after restart | Reopen it if its copy remains; otherwise inspect retained screenshots and patches. |
| Installation, checks or preview failed | Read the reason, then retry verification when eligible; generation is not repeated. |
| Adoption rehearsal is taking too long | Stop the rehearsal before writing begins and wait for process exit. |
| Adoption, undo or recovery was interrupted | Follow the recovery destination shown on the card; retain original files and review conflicts. |
| Another window owns the comparison | Use that window or wait for it to close; do not delete lock files. |
| Disk space needs releasing | Inspect and confirm the copy-space plan; records, patches and undo originals remain. |

## Previews and history

The upper-right **comparison records** and **tutorial** controls work in both new and existing conversations. They open history or guidance directly, preserving the host's corner control. Stopped previews show explicit status and available screenshots; retained copies can be reopened.

History defaults to all conversations, with a current-conversation filter, task/repository/run-id search, and 30 records per page. Original records remain retained; older schemas are read-only. If a newly installed client reports an older backend, restart DSH before using the new controls.

## Retry verification

Before choosing a result, a sealed candidate that failed or was interrupted during installation, verification or preview can be retried from its card. Retry uses the original commit, patch and acceptance without another generation request, and refuses changed copies or patches. Earlier checks and failures are archived, generation usage stays intact, and the observed package-manager and verification-host versions are recorded. A changed host environment is disclosed; missing versions or durations are not recorded as zero. Current verification time excludes historical idle time.

Retry shares run capacity and can be stopped independently while keeping the completed peer. Retained candidates can be checked again after a restart. Chosen, adopted, cleaned-up or lock-mismatched results cannot use this action. Correct a lock mismatch in a new comparison; frozen installation is never relaxed. Each record can archive up to 100 retries.

## Adoption and recovery

History remains readable across conversations. Write and resource-control actions resolve the current conversation through the host first. A comparison from another conversation, or an old record without an owner, requires confirmation of the project and run ID for that individual action. Confirmation does not replace host permissions, the run ownership lock or file integrity checks. Escape dismisses confirmation and keeps the history window open.

When adoption needs to combine later project edits, the original conversation can stop the rehearsal before file handoff begins. It waits for the process tree to exit, keeps candidate source, patches and records, and allows another adoption review. An unconfirmed exit keeps the rehearsal copy and blocks another attempt. Once original-file preservation and writing begin, cancellation is unavailable until handoff and verification finish.

Direct adoption retains the actual original files before publishing candidate files. A new edit or occupied destination at the handoff boundary stops the operation and retains both contents. The result exposes a self-ignored `.agent-compare-transfer-*` directory inside the project. It contains original project content and a durable journal, survives copy/preview cleanup, and must remain until recovery is complete. Do not upload it as public demonstration material.

Interrupted adoption, undo and older-record recovery have different destinations. “Restore before adoption” restores retained originals; “Roll back unfinished operation” returns to the start of the last undo or recovery and may leave the original adoption requiring another recovery. Conflicting paths are retained for review. Older records also use protected handoff on their first undo or recovery, but bytes not retained by older versions cannot be reconstructed.

Direct application supports ordinary files, up to 10,000 paths and 128 MiB total original/replacement bytes, on a local filesystem with hard-link support. Unsupported cases stop before application and can use branch adoption; there is no overwrite-based fallback. An updated client connected to an older backend blocks direct application and asks for a DSH restart.

## Project checks and processes

Build directories follow the baseline's Git exclusions, not a hard-coded `dist` exception. For a custom Vite `build.outDir`, add its generated output directory to `.gitignore` before starting a comparison; Vite configuration and `.gitignore` are bound to the baseline, including admitted uncommitted edits. Already tracked files remain checked even inside ignored directories. An unignored generated file or a tracked file changed during verification blocks adoption and requires a corrected new comparison. The plugin does not rewrite the current acceptance or silently delete these files. This stricter source-drift behavior applies from 1.1.0; historical records retain their original evidence.

Windows process inspection and termination helpers have bounded waits. If termination of a task's whole process tree cannot be confirmed, the record preserves its candidate or adoption rehearsal and blocks another verification or adoption on that copy. Restart does not turn uncertainty into a successful stop. Check the task and its descendants before manually cleaning the retained copy. Completed peers remain available for review and selection.

Finish active comparisons and close older plugin instances before upgrading. Damaged records or uncertain ownership stay read-only; the plugin does not infer that a task stopped. See [maintenance and retained resources](maintenance.en.md) for locking, old formats, state synchronization and retained data. Use [copy-space cleanup](copy-cleanup.md#english) to inspect releasable copies.

`/ab <task>` remains an optional shortcut. Common settings are graphical controls above the composer.

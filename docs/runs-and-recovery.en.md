# Records and recovery

[中文](runs-and-recovery.md) · **English** · [Back to usage](../README.en.md#install)

The upper-right **comparison records** and **tutorial** controls work in both new and existing conversations. They open history or guidance directly, preserving the host's corner control. Stopped previews show explicit status and available screenshots; retained copies can be reopened.

Opening saved-conversation controls after a restart restores the same session through DSH's Session domain without sending a prompt. Concurrent settings requests share restoration; a cancelled request does not cancel another request, and native session permissions still apply.

History defaults to all conversations, with a current-conversation filter, task/repository/run-id search, and 30 records per page. Original records remain retained; older schemas are read-only. If a newly installed client reports an older backend, restart DSH before using the new controls.

Incomplete, unsupported, unreadable or larger-than-16-MiB records are retained read-only with a reason and an issue filter. They do not block unaffected history or drive project/process actions. Stale updates cannot replace damaged records.

A live comparison belongs to the host that started it. Other current-version hosts sharing its local home can inspect history, source changes and real previews; management actions stay read-only until the owner closes. The UI refreshes ownership automatically. Shutdown drains accepted work before releasing ownership, and a crashed process releases its SQLite connection locks so a new host can recover the record. Adoption, undo and journal recovery also share a lock in the repository's Git common directory, including across different plugin homes.

An already-open peer reconciles an orphan when its record is opened, refreshed or acquired for an action. Generation becomes interrupted, stopped preview addresses are cleared after successful inspection and an interrupted write offers recovery. Resources whose ownership or cleanup cannot be confirmed remain retained with an explanation. A live foreign owner and older unmarked records remain untouched. Card reads check the run identity and revision so a delayed response cannot undo a newer choice or adoption. The model-facing status path is limited to main conversations because orphan reconciliation can stop owned previews.

Before upgrading, finish or clean up active comparisons and close every older plugin instance. Mixed-version concurrent mutation is unsupported. New records carry a coordination marker that alpha.9 treats as read-only unavailable data; earlier builds do not understand that boundary. Older unmarked records with potentially active resources stay viewable but cannot be terminated or adopted by inference. Old `.lock` directories are retained and block that key until inspected after older instances stop. SQLite guard files must remain in place on a local filesystem; network-share locking is not a supported configuration.

Submissions use the host command executor and session log. Every surface reads the same persisted run by id. Model-facing notes describe the result, choice, adoption, or undo; unavailable conversations and failed injections are retried with history/inbox deduplication. Notes identify the target repository, including when an example differs from the original project.

Direct adoption retains the actual original files before publishing candidate files. A new edit or occupied destination at the handoff boundary stops the operation and retains both contents. The result exposes a self-ignored `.agent-compare-transfer-*` directory inside the project. It contains original project content and a durable journal, survives copy/preview cleanup, and must remain until recovery is complete. Do not upload it as public demonstration material.

Interrupted adoption, undo and older-record recovery have different destinations. “Restore before adoption” restores retained originals; “Roll back unfinished operation” returns to the start of the last undo or recovery and may leave the original adoption requiring another recovery. Conflicting paths are retained for review. Older records also use protected handoff on their first undo or recovery, but bytes not retained by older versions cannot be reconstructed.

Direct application supports ordinary files, up to 10,000 paths and 128 MiB total original/replacement bytes, on a local filesystem with hard-link support. Unsupported cases stop before application and can use branch adoption; there is no overwrite-based fallback. An updated client connected to an older backend blocks direct application and asks for a DSH restart.

`/ab <task>` remains an optional shortcut. Common settings are graphical controls above the composer.

Before choosing a result, a sealed candidate that failed or was interrupted during installation, verification or preview can be retried from its card. Retry uses the original commit, patch and acceptance without another generation request, and refuses changed copies or patches. Earlier checks and failures are archived, generation usage stays intact, and the observed package-manager and verification-host versions are recorded. A changed host environment is disclosed; missing versions or durations are not recorded as zero. Current verification time excludes historical idle time.

Retry shares run capacity and can be stopped independently while keeping the completed peer. Retained candidates can be checked again after a restart. Chosen, adopted, cleaned-up or lock-mismatched results cannot use this action. Correct a lock mismatch in a new comparison; frozen installation is never relaxed. Each record can archive up to 100 retries.

A model can also call the `agent_compare_start` tool (`task`, optional `time_limit_minutes`); the conversation shows the same A|B card.

Windows process inspection and termination helpers have bounded waits. If termination of a task's whole process tree cannot be confirmed, the record preserves its candidate or adoption rehearsal and blocks another verification or adoption on that copy. Restart does not turn uncertainty into a successful stop. Check the task and its descendants before manually cleaning the retained copy. Completed peers remain available for review and selection.

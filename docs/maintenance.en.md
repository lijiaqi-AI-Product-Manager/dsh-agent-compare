# Maintenance and retained resources

[中文](maintenance.md) · **English** · [User recovery guide](runs-and-recovery.en.md)

## What copy release keeps

| Resource | After confirmed copy release | Purpose |
| --- | --- | --- |
| Releasable dependency/candidate copies and preview processes | Released only through the verified ownership plan | Reclaim reproducible execution resources. |
| Run records, sealed patches and screenshots | Retained | History, review and later adoption. |
| Source and pre-adoption refs under `refs/agent-compare/<run>/` | Retained | Bind candidate content and support adoption/undo; they are not ordinary unused branches. |
| DSH child sessions and logs | Retained | Generation history and parent-child relationships. |
| Example repositories | Retained | These are comparison and possible adoption targets, not just caches. |
| Original files and journals in `.agent-compare-transfer-*` | Retained | Recovery, undo and both sides of a conflict. |

Copy release does not erase this history or apply a seven-day expiry policy. Disk use can remain after release. Do not remove undo evidence merely to reduce directory or ref counts. Any deletion of historical results needs a separate decision based on each comparison’s adoption, undo and recovery state.

DSH 0.2.2-rc.1 treats Workspace registration, child sessions and first-time history migration as separate mechanisms. Candidate sessions retain their own directories and parent relationship; session-directory counts do not establish equal sidebar Workspace counts. Host session archival hides grouping entries without deleting logs or reclaiming their disk space. The plugin does not automatically archive them. First-time history migration may group existing sessions by directory and should be distinguished from ordinary post-initialization registration.

## Ownership, recovery and version boundaries

Version 1.1.0 adds rehearsal cancellation, cross-conversation action confirmation and current-state synchronization. Version 1.0.1 does not include these changes. The [recorded context checks](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/measurements/current-context-2026-11-05.json) distinguish the installed source, admitted context and reply. The two requests use one controlled comparison and do not establish an all-model reliability rate.

Each scoped main-conversation prompt assembly receives the most recently updated comparison state for that conversation: run ID, revision, choice, adoption mode and adoption state. This snapshot supersedes older status notes for the same run and distinguishes selection, worktree adoption, branch export and undo. Historical notes remain. Delegated conversations and diagnostic assemblies receive no snapshot; a read failure explicitly marks the current state unknown.

Opening saved-conversation controls after a restart restores the same session through DSH's Session domain without sending a prompt. Concurrent settings requests share restoration; a cancelled request does not cancel another request, and native session permissions still apply.

Incomplete, unsupported, unreadable or larger-than-16-MiB records are retained read-only with a reason and an issue filter. They do not block unaffected history or drive project/process actions. Stale updates cannot replace damaged records.

A live comparison belongs to the host that started it. Other current-version hosts sharing its local home can inspect history, source changes and real previews; management actions stay read-only until the owner closes. The UI refreshes ownership automatically. Shutdown drains accepted work before releasing ownership, and a crashed process releases its SQLite connection locks so a new host can recover the record. Adoption, undo and journal recovery also share a lock in the repository's Git common directory, including across different plugin homes.

An already-open peer reconciles an orphan when its record is opened, refreshed or acquired for an action. Generation becomes interrupted, stopped preview addresses are cleared after successful inspection and an interrupted write offers recovery. Resources whose ownership or cleanup cannot be confirmed remain retained with an explanation. A live foreign owner and older unmarked records remain untouched. Card reads check the run identity and revision so a delayed response cannot undo a newer choice or adoption. The model-facing status path is limited to main conversations because orphan reconciliation can stop owned previews.

Before upgrading, finish or clean up active comparisons and close every older plugin instance. Mixed-version concurrent mutation is unsupported. New records carry a coordination marker that alpha.9 treats as read-only unavailable data; earlier builds do not understand that boundary. Older unmarked records with potentially active resources stay viewable but cannot be terminated or adopted by inference. Old `.lock` directories are retained and block that key until inspected after older instances stop. SQLite guard files must remain in place on a local filesystem; network-share locking is not a supported configuration.

Submissions use the host command executor and session log. Every surface reads the same persisted run by id. Model-facing notes describe the result, choice, adoption, or undo; unavailable conversations and failed injections are retried with history/inbox deduplication. Notes identify the target repository, including when an example differs from the original project.

A model can also call the `agent_compare_start` tool (`task`, optional `time_limit_minutes`); the conversation shows the same A|B card.

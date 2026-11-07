# Quick start

[中文](quickstart.md) · **English**

1. **Install and open a project.** Follow the [full guide](../README.en.md#install) to install `dsh-agent-compare` and reload DSH when needed. Reuse your configured model. npm 1.2.0 needs a local Git repository with at least one commit and a root Vite application; unreleased main works in any folder, see [folders and project types](workspaces-and-projects.md#english).
2. **Select A|B and describe the task.** Use the settings above the composer for comparison mode, optional configured models and duration. The built-in example creates a separate shop repository. No flags are required.
3. **Try the real applications.** The conversation card shows both previews, factual states and shared checks. Each candidate consumes model usage. Missing usage stays unknown; a time limit does not establish that the task was completed.
4. **Review and adopt.** After choosing, inspect identity, differences and checks, confirm the target, then adopt. Later edits are checked and rehearsed when necessary. Continue in the main conversation after successful adoption or use undo on the card.

Same-model mode compares two strategies, not two different models. Choice and adoption are separate actions. Example results target the example repository, not your original project.

For unsupported projects, stopped previews or interrupted adoption, use [records and recovery](runs-and-recovery.en.md). To reclaim dependency copies, inspect [copy space](copy-cleanup.md#english). The full guide’s version notes and compatibility table distinguish the published package from unreleased main-branch changes.

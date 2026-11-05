# 释放工作副本 / Release comparison copies

在主对话的比较结果或历史记录中，完成选择后点“查看副本空间”。先核对清单，再决定是否确认。盲选时不展示两版空间，避免通过规模猜测模型或策略。

## 会释放什么

仅释放清单内、归属可验证的候选及已结束预演副本，包括它们的独立依赖和缓存。列有预览的条目会先停止预览。展示的是文件逻辑大小，不跟随符号链接或 junction；硬链接的实际磁盘释放量可能更少。

## 保留什么

- 本地运行记录、封存源码补丁、截图与验收事实。
- 用户项目，包括原始示例仓库；当前工作区和暂存状态不参与副本删除。
- 比较的 Git 引用与采用的撤销原件。释放副本不把比较改成“放弃”，通过验收的选中结果仍可审查采用；已有采用仍走原有撤销核验。
- 候选会话。清单单独显示记录的会话和 Git 引用数量，不调用尚未验证的宿主会话删除接口。

这些保留资源不计入“可释放量”，仍会占用空间。此版本没有自动过期删除、没有总空间上限，也不迁移采用交接日志。不要手动删除撤销和恢复资料来整理目录。

## 何时不能释放

比较、验收、采用或恢复尚未结束；任务进程未确认退出；目录归属不明确；副本有封存后的源文件修改；扫描不完整；或清单在确认前变化。上述情况会保留副本并说明原因。执行时在现有归属锁、仓库锁和串行队列内重新核对记录修订、内容及扫描指纹。跨对话操作另需勾选确认。

清理部分失败时保留记录和恢复依据，不能显示为全部释放。重新查看清单，根据具体原因处理。释放成功后，旧副本不能重新打开预览；历史仍能显示保留截图，并进入代码与采用审查。

## English

After revealing a comparison, use **View copy space**, inspect the directories and confirm explicitly. Only owned, settled working copies and their disposable dependencies/caches are eligible. The plan states which previews stop and estimates logical file bytes; links are not followed and hard links can reclaim less physical space.

Records, sealed patches, screenshots, source repositories, candidate sessions, Git refs and adoption undo originals remain. Releasing copies neither abandons the selected result nor discards undo evidence. These retained resources are excluded from the reclaimable-byte estimate. There is no automatic expiry or total-storage guarantee.

Active work, unresolved recovery, unconfirmed process exits, unknown ownership, unsealed source edits and changed/incomplete plans block release. Execution rechecks the inspected plan under ownership and repository locks. Cross-conversation release requires an additional confirmation. A partial failure retains recovery evidence and must not be reported as complete.

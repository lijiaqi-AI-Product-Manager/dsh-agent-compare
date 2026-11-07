# 目录与项目类型 / Folders and project types

## 任何目录都能比较

A|B 不再只限于 Git 仓库根目录下的 Vite 项目。打开任何目录（包括 DSH 的默认工作区），或者对话没有目录，都可以直接比较。

| 当前对话的目录 | 两版从哪里开始 | 结果怎样查看 | 选定之后 |
|---|---|---|---|
| Git 仓库里的 Vite 项目 | 仓库副本 | 实时页面，构建并通过共同验收 | 审查并写入工作区，或另存分支 |
| Git 仓库里的其他 Node 项目（有 `dev` 或 `start` 脚本） | 仓库副本 | 运行这个脚本得到的实时页面 | 同上 |
| Git 仓库里的静态网页（有 HTML 页面） | 仓库副本 | 直接打开页面，不安装依赖 | 同上 |
| Git 仓库里的其他项目（Python、Go、文档等） | 仓库副本 | 写出的文件；没有改文件时看回答 | 同上 |
| 不是 Git 仓库的目录 | 新的空白目录 | 页面、文件或回答 | 保存到当前目录的新文件夹 |
| 对话没有目录 | 新的空白目录 | 页面、文件或回答 | 在卡片里查看 |

- 项目在仓库的子目录里（例如 monorepo 的 `apps/web`）时，安装、检查和预览都在这个子目录运行。
- 不是 Vite 的项目，会以 `PORT` 和 `HOST=127.0.0.1` 运行它的 `dev` 或 `start` 脚本。服务没有在这个端口响应时，这一版按文件比较，不算失败。
- 静态网页由插件自带的只读服务提供，只能读取副本里的文件，不列目录，也不会跟随指向副本外的链接。
- `package.json` 无法使用时（例如有多个锁文件），这次不安装依赖，并在设置条里说明原因；比较照常进行。

## 不是 Git 仓库的目录

两版在插件自己的空白目录里完成，**不会读写你当前目录里的任何文件**。

- 只需要回答的请求（例如「背一下乘法口诀表」）：两版的回答并排显示，盲选前就能看到。选定的回答会写入主对话记忆，之后可以直接接着问。
- 做网页：两版各自生成页面，像普通比较一样实时试用。
- 其他文件：列出两版写出的文件，盲选前可以逐个打开查看；揭晓后还能看完整改动。
- 「保存到当前目录」会新建一个文件夹（以需求开头、运行编号结尾，重名时加序号），把选中的文件写进去，不覆盖、不改动原有文件。
- 「撤销保存」只删除保存后没有改过的文件；只要有一个文件被改过，就整体不撤销，并列出改过的文件。

### 在此目录启用 Git

如果想让两版基于这个目录里的现有文件修改，可以点「在此目录启用 Git」：

1. 先检查目录：按 Git 的忽略规则统计两版会复制的文件，`node_modules` 等依赖目录不计入。
2. 显示文件数和大小，确认后才执行 `git init`。不提交，也不改动任何现有文件。
3. 之后这个目录按 Git 仓库处理：选定的版本可以审查后写回。

以下情况不能启用：用户主目录、磁盘根目录、系统目录、已经在 Git 仓库里的目录，以及排除依赖后仍超过 5,000 个文件或 300 MB 的目录。这类目录请打开具体的项目文件夹，或先用 `.gitignore` 排除缓存。

## 共同验收

- Vite 项目的验收规则不变。
- 其他 Node 项目只运行基线里确实存在的 `typecheck`、`lint`、`test`、`build` 脚本。
- 没有 `package.json` 的基线没有命令检查；有实时页面时，检查页面能否打开、控制台有没有错误。
- 没有锁文件时，依赖安装会生成锁文件。这是安装产物，不算两版的改动。
- 一版既没有改文件、也没有给出回答时，仍然算失败。

## 记录兼容

新版本的比较记录会多出几个字段（目录、项目子目录、回答或文件结果、保存的文件夹）。1.2.0 及更早的版本读到这些记录时会标为「需处理」，并保留原文件，不会据此执行任何操作。

## English

**Any folder works.** A|B is no longer limited to a Vite project at the root of a Git repository.

| The conversation's folder | Both versions start from | The result | After the pick |
|---|---|---|---|
| A Vite project in Git | a copy of the repository | a live page, built and checked | review and write into the working tree, or save a branch |
| Another Node project in Git (`dev` or `start` script) | a copy | a live page from that script | as above |
| A static site in Git (an HTML page) | a copy | the page, served as files | as above |
| Any other project in Git (Python, Go, docs) | a copy | the written files, or the answer when nothing changed | as above |
| A folder outside Git | a new empty folder | a page, files or an answer | save into a new folder here |
| No folder | a new empty folder | a page, files or an answer | review on the card |

Project details:
- **Subfolder projects.** A project in a repository subfolder (such as `apps/web`) installs, checks and previews there.
- **Non-Vite servers.** Non-Vite projects run their `dev` or `start` script with `PORT` and `HOST=127.0.0.1`. A server that does not answer on that port is compared by its files, not failed.
- **Static pages.** Static pages are served read-only from inside the copy, with no directory listings and no links outside it.

**Outside Git**, both versions work in a private empty folder, and nothing in your folder is read or written.
- **Answers.** Answers are shown side by side before the pick, and the picked answer enters the main conversation's memory.
- **Files.** Written files can be opened one by one before the pick.
- **Saving.** **Save to this folder** creates a new folder and never replaces existing files.
- **Undoing a save.** **Undo save** removes only saved files that are unchanged; if any was edited, nothing is removed.

**Enable Git in this folder** checks first, then shows exactly how many files both versions would copy, and runs `git init` only after you confirm. Nothing is committed or changed. It refuses the following:
- the home folder;
- a drive root;
- system folders;
- folders already in a repository;
- folders over 5,000 files or 300 MB after dependency folders are left out.

**Shared checks.** Vite projects keep their checks. Other Node projects run only the `typecheck`, `lint`, `test` and `build` scripts their baseline has. Baselines without `package.json` have no command checks; a live page is checked for loading and console errors. A lockfile written by an install without one is install output. A version that neither wrote files nor answered still fails.

**Records.** Records with the new fields show as needing attention in 1.2.0 and earlier, which leave them untouched.

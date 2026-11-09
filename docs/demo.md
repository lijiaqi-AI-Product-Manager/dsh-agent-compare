# 演示条件与结果 / Demo conditions and results

[中文指南](../README.md#install) · [English guide](../README.en.md#install) · [完整视频 / Full video](media/comparison-workflow.mp4)

## 中文

这段演示在真实的 DSH Web 宿主中录制，使用固定候选：由本地脚本模型通过 DSH 自带的写文件工具，按每版收到的风格写出一个番茄钟页面。4 个隔离副本、实时页面、共同页面检查、盲选、揭晓、保存到新文件夹和继续主对话都真实执行。没有发送外部模型请求，因此不能用它评价模型的生成质量或耗时。正常使用时，每一版都会调用你配置的模型，并各自消耗用量。

来源：1.4.0 发布候选的源码提交 `c7cbb8f6a92643e392435438a8a29f0c99597659`。该提交打包后装入独立的测试 profile，压缩包 SHA-256 为 `52accfd3ef80924b6e1cd0849be53620a771677b39a18961ad278160b19f1fdb`。公开的 1.4.0 压缩包之后由发布提交构建，那次提交只改动版本号。环境为 Windows、DSH `0.2.2-rc.1`、Microsoft Edge `156.0.4314.58`（无界面模式）。

任务是在一个普通文件夹（不是 Git 仓库）里「做一个番茄钟网页」，选择 4 版、盲选，风格为稳妥、大胆、极简、活力。

| 版本 | 揭晓后的风格 | 共同页面检查 |
| --- | --- | --- |
| A | 活力 · Vibrant | 通过 |
| B | 大胆 · Bold | 通过 |
| C | 极简 · Minimal | 通过 |
| D | 稳妥 · Conservative | 通过 |

演示过程：
1. 在设置条选择「4 版」并发送需求。
2. 4 个版本并行生成，之后在大窗口里以 2×2 显示 4 个实时页面。
3. 在 A 和 C 里点开始，计时器实际运行。
4. 排除 B 和 D，剩下的 A 和 C 移到一起并排显示。
5. 选择 C。揭晓后才看到每一版的风格：盲选开始时，风格被随机分到了 A–D。
6. 把 C 保存到当前目录的新文件夹，然后继续主对话。原有的 `notes.txt` 没有被改动。

原始录制 **67.72 秒**。完整视频剪去了生成期间的等待，保留 **36.88 秒**，全部按原速播放。GIF 截取 `48.02–61.58` 秒，按原速、每秒 10 帧播放，内容是 4 个实时页面、排除、选择和揭晓。剪辑区间、文件哈希与录制条件见[素材清单](media/manifest.json)。

画面中做了三处处理：
- 本地路径已隐藏为「…」；
- 加上了固定候选标签；
- 加上了一个可见的鼠标指针。

执行结论没有改写。界面中的耗时只属于这一次固定候选流程。

目录截图来自同一次录制。顶部图和流程图是功能示意图，不是截图。[1.1.0 的演示及其条件](media/history/1.1.0/manifest.json)和[更早的演示](media/history/0.2.0-alpha.17/manifest.json)继续保留。真实模型的三轮测量单独记录在[首次体验记录](first-use.md)。

## English

This recording was made in a real DSH Web host with controlled candidates. A local scripted model writes one pomodoro-timer page per version through DSH's own write tool, following the style each version received. Four isolated copies, live pages, shared page checks, a blind pick, the reveal, a save into a new folder and continuing the conversation all execute for real. No external model request is made, so the recording measures neither model quality nor model latency. In normal use, every version calls your configured model and consumes usage separately.

Source: the 1.4.0 release-candidate commit `c7cbb8f6a92643e392435438a8a29f0c99597659`. It was packed and installed into an isolated test profile, with archive SHA-256 `52accfd3ef80924b6e1cd0849be53620a771677b39a18961ad278160b19f1fdb`. The public 1.4.0 archive is built later from the release commit, which changes only version fields. Environment: Windows, DSH `0.2.2-rc.1`, Microsoft Edge `156.0.4314.58` (headless).

The task is "做一个番茄钟网页" (make a pomodoro timer page) in a plain folder outside Git, with four versions, blind, and the styles Conservative, Bold, Minimal and Vibrant.

| Version | Style, revealed | Shared page check |
| --- | --- | --- |
| A | Vibrant | Passed |
| B | Bold | Passed |
| C | Minimal | Passed |
| D | Conservative | Passed |

What happens in the recording:
1. The settings strip selects four versions, and the task is sent.
2. All four versions generate in parallel. The large window then shows four live pages, two by two.
3. The timers in A and C are started, and they really run.
4. B and D are set aside, and A and C move up side by side.
5. C is picked. The styles appear only at the reveal: the blind start had shuffled them across A–D.
6. C is saved into a new folder in the current directory, and the conversation continues. The existing `notes.txt` is unchanged.

The raw recording is **67.72 seconds**. The full video removes the waiting during generation and keeps **36.88 seconds**, all at the original speed. The GIF covers seconds `48.02–61.58` at the original speed and 10 frames per second: four live pages, setting two aside, the pick and the reveal. [The manifest](media/manifest.json) records the editing intervals, file hashes and recording conditions.

Three things were added to the picture:
- Local paths are hidden as "…".
- A controlled-candidate caption is shown.
- A visible pointer is shown.

Execution outcomes are unchanged. Displayed durations describe this controlled run only.

The directory screenshots come from the same recording. The header and workflow images are product illustrations, not screenshots. [The 1.1.0 demo and its conditions](media/history/1.1.0/manifest.json) and [the earlier demo](media/history/0.2.0-alpha.17/manifest.json) remain available. The three real-provider measurements are recorded separately in [first use](first-use.md).

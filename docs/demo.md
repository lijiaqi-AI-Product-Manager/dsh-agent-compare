# 演示条件与结果 / Demo conditions and results

[中文指南](../README.md#install) · [English guide](../README.en.md#install) · [流程短片 / Workflow clip](media/comparison-workflow.mp4)

## 中文

演示录制于真实 DSH Web 宿主，安装 AgentCompare 2.0.0 候选包。固定本地候选通过 DSH 自带的写文件工具，按各自收到的风格写出番茄钟页面；四个隔离副本、页面检查、独立操作、盲选、保存、撤销和继续主对话都实际执行。没有发送外部模型请求，因此这段演示不能衡量模型生成质量、费用或真实模型耗时。正常使用时，各版分别调用已配置的模型并消耗用量。

源码提交：`d36bdb0e4146afa83d624679225ad2c8f5674bd2`。用于本次录制的候选包 SHA-256：`5d013ddf0d9cc90cbdf8f9f3ba8fa9fbdb3ce1e18a32e45118aa110589c85b6e`。独立测试 profile 中的 95 个运行文件与该提交构建逐字节一致。之后的发布提交更新文档和素材；公开发布包的摘要以 Release 附件为准，不把录制候选的摘要冒充为最终产物摘要。

环境：Windows、DSH `0.2.2-rc.1`、Microsoft Edge `156.0.4314.58`（无界面模式）。未操作用户桌面 profile。界面中的计时器是实际运行的 HTML 页面。

任务：在普通文件夹里做一个能开始、暂停、重置的番茄钟网页，使用四版盲选。盲选时风格随机分配，选择后才揭晓：

| 版本 | 揭晓后的风格 | 共同页面检查 |
| --- | --- | --- |
| A | 活力 · Vibrant | passed |
| B | 稳妥 · Conservative | passed |
| C | 大胆 · Bold | passed |
| D | 极简 · Minimal | passed |

录制中启动 A、C 的计时器，确认 B 保持未启动；排除 B、D 后选择 C，保存到新文件夹，再继续主对话。原有 `notes.txt` 保持不变，之后撤销保存也成功。同一次完整验收还比较了三版英文 Markdown 回答，检查 390 像素窗口，选择 B 并继续主对话；下一次主对话模型请求确实收到该比较的记忆。

原始录制 **50.8 秒**；流程短片 **10.64 秒**，只保留四版页面的设置、操作、选择和保存流程，剪去等待，保留片段均按原速播放。GIF **6.5 秒、6 帧/秒**，截取四版交互、排除、选择和揭晓，并裁去宿主外框、加入可见的固定候选标签。它不把生成时间压缩成性能承诺。区间、哈希与处理方式见[素材清单](media/manifest.json)。

本地路径已隐藏；顶部图和流程图标为功能示意，不是实际截图。英文回答和手机截图来自同一候选包的真实界面。目录中的两张 PNG 仅缩小并压缩颜色，没有改写操作结果。[1.1.0 历史演示](media/history/1.1.0/manifest.json)、[更早的演示](media/history/0.2.0-alpha.17/manifest.json)和[真实模型的首次体验测量](first-use.md)继续保留。

## English

This recording uses a real DSH Web host with an AgentCompare 2.0.0 candidate installed. A controlled local model writes each timer through DSH's native write tool, using the assigned style. Four isolated copies, shared page checks, independent interaction, a blind pick, saving into a new folder, undo and continuing the conversation execute for real. No external model request is made. This recording establishes neither model quality nor real-model latency or cost. Normal use calls your configured models and consumes usage per version.

Source commit: `d36bdb0e4146afa83d624679225ad2c8f5674bd2`. Recording candidate archive SHA-256: `5d013ddf0d9cc90cbdf8f9f3ba8fa9fbdb3ce1e18a32e45118aa110589c85b6e`. All 95 installed runtime files matched the build. Later release commits update documentation and media; the final published archive has its own checksum in the Release assets.

Environment: Windows, DSH `0.2.2-rc.1`, Microsoft Edge `156.0.4314.58` (headless). The user's desktop profile is untouched. A and C count down independently while B remains idle. B and D are set aside, C is picked and saved into a new folder, and the conversation continues. The existing `notes.txt` is unchanged and undo succeeds. The same acceptance also compares three English Markdown answers at desktop and 390-pixel widths. After choosing B and continuing, the next main-conversation model request contains that comparison's memory.

The raw recording lasts **50.8 seconds**. The **10.64-second** workflow clip keeps the four-page setup, interaction, choice and save sequence, cutting waits and playing retained footage at the original speed. The **6.5-second GIF at 6 fps** crops the host frame and adds a visible controlled-candidate caption. Neither clip is a generation-time promise. [The manifest](media/manifest.json) records the intervals, hashes and edits.

Local paths are hidden. The header and workflow graphics are labelled product illustrations. English and phone images are actual screenshots from the same installed candidate. Directory PNGs are resized and palette-compressed without changing outcomes. [The 1.1.0 recording](media/history/1.1.0/manifest.json), [earlier recordings](media/history/0.2.0-alpha.17/manifest.json) and [real-model first-use measurements](first-use.md) remain separate evidence.

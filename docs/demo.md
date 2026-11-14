# 演示条件与结果 / Demo conditions and results

[中文指南](../README.md#install) · [English guide](../README.en.md#install) · [流程短片 / Workflow clip](media/comparison-workflow.mp4)

## 中文

演示录制于真实 DSH Web 宿主，安装 AgentCompare 2.1.0 候选包。固定本地候选通过 DSH 自带的写文件工具，按各自收到的风格写出番茄钟页面；四个隔离副本、页面检查、独立操作、盲选、选择理由、保存和继续主对话都实际执行。没有发送外部模型请求，因此这段演示不能衡量模型生成质量、费用或真实模型耗时。正常使用时，各版分别调用已配置的模型并消耗用量。

源码提交：`2b5c9920378b8414dfa1449033808385c30f55c8`。录制用候选包 SHA-256：`804d302ce8e4d018664d5c5744b09eb4d78ec0ed1c1222e33fa44ffbcb363e8b`（同一提交的构建，以唯一开发版本号打包，装入独立测试 profile）。profile 中的 95 个运行文件与该提交的构建逐字节一致。之后的提交只更新文档和素材；公开发布包的摘要以 Release 附件为准，不把录制候选的摘要冒充为最终产物摘要。

环境：Windows、DSH `0.2.2-rc.1`、Microsoft Edge `157.0.4341.42`（无界面模式）。未操作用户桌面 profile。界面中的计时器是实际运行的 HTML 页面。

任务：在普通文件夹里做一个能开始、暂停、重置的番茄钟网页，使用四版盲选。盲选时风格随机分配，选择后才揭晓：

| 版本 | 揭晓后的风格 | 共同页面检查 |
| --- | --- | --- |
| A | 活力 · Vibrant | passed |
| B | 大胆 · Bold | passed |
| C | 稳妥 · Conservative | passed |
| D | 极简 · Minimal | passed |

录制中启动 A、C 的计时器；排除 B、D 后选择 C，揭晓时卡片上有光粒和扫光。随后点选两个理由「布局」「更简洁」，保存到新文件夹，再继续主对话。文件夹里原有的 `notes.txt` 保持不变。

同一宿主还做了两项检查，截图收在[图库](storefront-gallery.md)：

- **在项目里打招呼。** 在带 `typecheck` 和 `build` 脚本的 Vite 仓库里发送「你好」，四版按各自风格直接回答，都没有改文件，也没有安装依赖、构建或预览；仓库的工作区和提交保持不变。同一仓库里发送「做一个番茄钟网页」，四版照常各自生成并构建实时页面。
- **英文界面。** 快速组合「三种视觉」得到 Minimal、Polished、Vibrant 三版公开对比的回答，选择 B 并点选「Layout」「More complete」。390 像素窗口的截图也来自这次检查。

原始录制 **69.68 秒**；流程短片 **28.2 秒**，保留设置、发送，以及大窗口里四版页面的操作、排除、选择、理由和保存，剪去等待，保留片段均按原速播放。GIF **13.9 秒、6 帧/秒、720 像素宽**，截取四版实时页面、排除、选择揭晓和理由；画面加入可见的固定候选标签。它不把生成时间压缩成性能承诺。区间、哈希与处理方式见[素材清单](media/manifest.json)。

本地路径已隐藏；顶部主图、流程图和社交预览图标为功能示意，不是实际截图。界面截图只做了裁剪和缩小，打包进插件的两张 PNG 另做了颜色压缩，没有改写操作结果。[1.1.0 历史演示](media/history/1.1.0/manifest.json)、[更早的演示](media/history/0.2.0-alpha.17/manifest.json)和[真实模型的首次体验测量](first-use.md)继续保留。

## English

This recording uses a real DSH Web host with an AgentCompare 2.1.0 candidate installed. A controlled local model writes each timer through DSH's native write tool, using the assigned style. Four isolated copies, shared page checks, independent interaction, a blind pick, reasons for the pick, saving into a new folder and continuing the conversation execute for real. No external model request is made. This recording establishes neither model quality nor real-model latency or cost. Normal use calls your configured models and consumes usage per version.

Source commit: `2b5c9920378b8414dfa1449033808385c30f55c8`. Recording candidate archive SHA-256: `804d302ce8e4d018664d5c5744b09eb4d78ec0ed1c1222e33fa44ffbcb363e8b` (that commit's build, packed with a unique development version and installed in an isolated test profile). All 95 installed runtime files matched the committed build byte for byte. Later commits update documentation and media only; the final published archive has its own checksum in the Release assets.

Environment: Windows, DSH `0.2.2-rc.1`, Microsoft Edge `157.0.4341.42` (headless). The user's desktop profile is untouched. The four styles are assigned blind and revealed after the pick: A Vibrant, B Bold, C Conservative, D Minimal; every shared page check passed. A and C count down independently. B and D are set aside and C is picked; light bursts and sweeps across the cards at the reveal. Two reasons, Layout and Simpler, are tapped, the pick is saved into a new folder, and the conversation continues. The existing `notes.txt` is unchanged.

The same host ran two more checks, shown in the [gallery](storefront-gallery.md):

- **A greeting in a project.** In a Vite repository with `typecheck` and `build` scripts, "你好" (hello) was answered by four versions in their own styles. None changed a file, and nothing was installed, built or served; the repository's working tree and commits stayed unchanged. In the same repository, a request for a pomodoro page still made all four versions build live pages.
- **English interface.** The Three looks quick set gives an open comparison of Minimal, Polished and Vibrant answers; B is picked with Layout and More complete. The 390-pixel image comes from this check.

The raw recording lasts **69.68 seconds**. The **28.2-second** workflow clip keeps the setup, sending, and in the large window the interaction with the four pages, setting two aside, the pick, the reasons and the save, cutting waits and playing retained footage at the original speed. The **13.9-second GIF at 6 fps and 720 pixels** shows the four live pages, setting two aside, the pick with its reveal and the reasons, with a visible controlled-candidate caption. Neither clip is a generation-time promise. [The manifest](media/manifest.json) records the intervals, hashes and edits.

Local paths are hidden. The header, workflow graphic and social preview are labelled product illustrations, not screenshots. Interface captures are only cropped and resized; the two PNGs packaged with the plugin are also palette-compressed, without changing outcomes. [The 1.1.0 recording](media/history/1.1.0/manifest.json), [earlier recordings](media/history/0.2.0-alpha.17/manifest.json) and [real-model first-use measurements](first-use.md) remain separate evidence.

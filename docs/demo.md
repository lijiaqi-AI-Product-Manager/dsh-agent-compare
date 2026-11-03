# 演示条件与结果 / Demo conditions and results

[中文使用指南](../README.md#install) · [English guide](../README.en.md#install) · [完整视频 / Full video](media/comparison-workflow.mp4)

## 中文

这段演示使用固定的两份候选代码，展示从界面设置到采用完成的实际流程。它不发送外部模型请求，不用于评价模型或策略的生成质量与性能。界面揭晓的策略表示本次比较的配置；候选代码由样例预先确定。

记录环境：AgentCompare `0.2.0-alpha.17`，源码提交 `9d036c5d53377c9da2878e226580a3caba0d9baa`；DSH `0.2.1-rc.5`，Node `26.13.0`，Chromium `156.0.8078.4`，Windows。使用独立的 DSH profile 和新建示例仓库。

需求：给商品列表增加搜索、组合分类筛选、一次清空和手机适配。

| 检查 | A | B |
|---|---|---|
| 类型检查 | 通过 | 通过 |
| 构建 | 通过 | 通过 |
| 同一套页面行为验收 | 通过 | 未通过：缺少「清空」按钮 |
| 直接采用资格 | 允许，仍需审查和确认 | 阻止 |

演示中实际搜索、切换分类及手机尺寸，再选择 A、审查目标并确认采用。A 的两个文件写入示例仓库；HEAD 和暂存状态未变。完成后保留采用记录与验收截图，提供撤销和继续主对话入口，清理本次拥有的预览与副本。

原始录制约 118 秒，完整剪辑 28.16 秒，GIF 摘要 12.6 秒。等待部分被剪去；本地用户路径被隐藏，检查和采用结果未被改写。画面中的耗时来自固定候选的本地流程，不代表外部模型生成耗时。预览停止后展示的是明确标注的验收截图。

固定候选仅用于这段流程演示。插件界面中的「试跑内置示例」会使用用户已配置的模型实际生成两份实现，并分别消耗用量；它只操作新建示例仓库。两份实现是否通过，取决于实际结果。

[GIF 摘要](media/comparison-preview.gif) · [分享封面](media/social-preview.png) · [素材 SHA-256 与记录条件](media/manifest.json)

## English

This recording uses two fixed candidate implementations to demonstrate the real workflow from graphical settings through completed adoption. It makes no external model requests and does not measure model or strategy generation quality or performance. Revealed strategies describe the comparison configuration; the sample code is predetermined.

Environment: AgentCompare `0.2.0-alpha.17`, source commit `9d036c5d53377c9da2878e226580a3caba0d9baa`, DSH `0.2.1-rc.5`, Node `26.13.0`, Chromium `156.0.8078.4`, Windows. It uses an independent DSH profile and a new example repository.

Task: add product search, combined category filtering, one-step clearing and mobile support.

| Check | A | B |
|---|---|---|
| Typecheck | Passed | Passed |
| Build | Passed | Passed |
| Same browser acceptance | Passed | Failed: missing the clear button |
| Direct adoption | Allowed after review and confirmation | Blocked |

The recording interacts with search, categories and mobile view, chooses A, reviews the target and confirms adoption. Two files are written to the example repository while HEAD and staged content remain unchanged. The record and verification screenshots remain available, undo and continuation controls become usable, and owned previews and copies are cleaned up.

The original recording is about 118 seconds, the edited video 28.16 seconds and the GIF 12.6 seconds. Waiting periods are cut and local user paths are hidden; check and adoption outcomes are unchanged. Displayed durations belong to this fixed-candidate local workflow, not external model generation. After previews stop, retained images are explicitly labelled verification screenshots.

Fixed candidates are specific to this recording. The plugin's built-in example button uses the user's configured model to generate both implementations, consuming usage separately. It operates only on a new example repository. Actual results determine whether either candidate passes.

[GIF preview](media/comparison-preview.gif) · [Social preview](media/social-preview.png) · [Asset hashes and conditions](media/manifest.json)

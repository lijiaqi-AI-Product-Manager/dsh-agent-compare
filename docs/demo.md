# 演示条件与结果 / Demo conditions and results

[中文指南](../README.md#install) · [English guide](../README.en.md#install) · [完整视频 / Full video](media/comparison-workflow.mp4)

## 中文

这段演示使用公开 npm `dsh-agent-compare@1.1.0` 的固定候选，运行真实的应用、共同验收、审查采用与撤销。没有发送外部模型请求，不能用它评价模型生成质量或估算模型耗时。内置示例按钮在正常使用时仍会调用用户已配置的模型，两版分别消耗用量。

来源：发布源码 `8dd54760981823be252feb46ce4ebd8e67ba26cd`，npm 压缩包 SHA-256 `0f8a5b3dcbc24bd45bf915bab47f55e305e5505b0ae74efdabf16355bbd3723b`。独立 profile 内 81 个运行文件与公开包一致。环境为 Windows、DSH `0.2.2-rc.1`、Node `26.13.0`、Chromium `156.0.8078.4`。演示的 1.1.0 界面为中文；1.2.0 的界面更新（包括英文界面）不在这段录制中。

任务是基础示例中的商品搜索与清空，两个候选使用同一份已绑定验收。操作 A 的搜索时 B 保持原列表；操作 B 时 A 保持原列表。

| 检查 | A | B |
| --- | --- | --- |
| 类型检查 | 通过 | 通过 |
| 构建 | 通过 | 通过 |
| 共同页面验收 | 通过 | 未通过：缺少清空按钮 |
| 采用资格 | 审查和确认后允许 | 阻止 |

演示先隐藏模型／策略身份，实际体验后选择 A，再审查并确认采用。两个文件被写入独立示例项目，随后完成撤销；HEAD 和暂存内容保持不变。原始文件、选择与采用记录继续保留。

原始视频 **52.76 秒**，实际操作记录约 **50.85 秒**。完整剪辑 **28.76 秒**，保留原始速度并剪去一段等待；GIF 摘取原始 `32.6–35.1` 秒，以 **0.5 倍速**回放为 5 秒。剪辑区间、文件哈希与记录条件见[素材清单](media/manifest.json)。本地路径已隐藏，画面增加了固定候选标签，执行结论未被改写。界面中的耗时属于这一次固定候选流程。

目录截图来自同一公开版本。采用完成后显示的是保留的验收截图；运行中的两格才是交互页面。[早期演示及原始条件](media/history/0.2.0-alpha.17/manifest.json)继续保留，真实模型的三轮测量仍单独见[首次体验记录](first-use.md)。

## English

This recording uses controlled candidates with the public npm `dsh-agent-compare@1.1.0` artifact. Applications, shared checks, reviewed adoption and undo execute for real. No external model request is made; it measures neither model generation quality nor model latency. During normal use, the built-in example uses the configured model and each candidate consumes usage separately.

Source: release commit `8dd54760981823be252feb46ce4ebd8e67ba26cd`; npm archive SHA-256 `0f8a5b3dcbc24bd45bf915bab47f55e305e5505b0ae74efdabf16355bbd3723b`. All 81 installed runtime files match the public archive in a fresh profile. Environment: Windows, DSH `0.2.2-rc.1`, Node `26.13.0`, Chromium `156.0.8078.4`. The recorded 1.1.0 interface is Chinese; the 1.2.0 interface update, including English, is not part of this recording.

The task is the basic product-search-and-clear example with shared, bound acceptance. Searching in A leaves B unchanged, and searching in B leaves A unchanged.

| Check | A | B |
| --- | --- | --- |
| Typecheck | Passed | Passed |
| Build | Passed | Passed |
| Shared browser acceptance | Passed | Failed: missing clear button |
| Adoption | Allowed after review and confirmation | Blocked |

Identity stays hidden until selection. The recording chooses A, reviews and confirms adoption, writes two files into the independent example project, then undoes the adoption. HEAD and staged content stay unchanged; retained originals and comparison/adoption records remain available.

The raw video is **52.76 seconds**, with an action log of about **50.85 seconds**. The edited workflow is **28.76 seconds**, at the original speed with one waiting interval removed. The GIF replays raw seconds `32.6–35.1` at **0.5×**, lasting 5 seconds. [The manifest](media/manifest.json) records editing intervals and hashes. Local paths are hidden and controlled-candidate captions are added; execution outcomes are unchanged. Displayed durations describe this controlled run.

The directory screenshots identify the same released artifact. Images retained after adoption are verification screenshots; running panes are interactive applications. [Earlier demonstration evidence](media/history/0.2.0-alpha.17/manifest.json) and the separate [three real-provider measurements](first-use.md) remain identifiable.

# 首次体验与耗时 / First use and timing

输入框上方和使用教程都能选择示例范围，无需输入命令参数。选择保存在当前对话。

| 示例 | 要求 | 共同浏览器验收 |
| --- | --- | --- |
| 基础 | 现有列表的商品名称搜索、不区分大小写、一次清空 | 5 步，验证初始 8 个商品、搜索 LAMP 剩 1 个、清空恢复 8 个 |
| 完整 | 搜索、组合分类筛选、清空、390px 手机适配 | 原有 12 步，额外检查 Desk 筛选、组合搜索及手机控件 |

两者都创建独立示例仓库并调用当前配置的真实模型。两版分别消耗用量；较小的任务范围不是完成时间或费用保证。每版时长上限保持原设置，到时仍会验收已写的改动。原始完整示例保留，不把基础示例的结果当成完整场景通过。

生成结束后仍执行冻结安装、类型检查、构建和对应的共同浏览器检查。提示词限制无理由的重复安装和重复检查，不减少正式验收。揭晓后“检查依据与用量”显示实际记录的准备、生成、安装、检查与预览验收时长；未完成的阶段明确显示未完整记录。

旧版本的 42 分钟样本保持原版本标签，不能作为当前版本的性能结论。发布当前耗时中位数、范围或成功率前，应记录至少三轮可比样本：源码、宿主、系统、Node、模型、任务、基线、验收标识、预算、首个可交互结果、双候选结果与采用结果。缺失用量保持未知，不把 token 数写成货币费用。

维护者可在本地导出候选 Session 的事件数组（保留 `type`、`time`、`data`），构建后运行 `node scripts/phase-timing.mjs <private-export.json>`。它也接受逐行事件 JSON。输出只包含区间和工具类别统计，不输出提示词、工具参数或文件路径。导出文件保存在仓库外，不提交会话内容或凭据。

分析按 `turn/step` 和 `callId` / `message.toolCallId` 配对，重叠区间取并集，不累加并发耗时。工具调用到返回的区间包含工具调度等开销；其余步骤时间包含模型、队列与宿主工作，不能称为纯模型等待。没有时间戳、未配对或异常顺序的事件保留在 `incomplete` 中；未测量时长不显示为零。

## 2026-11-05：三轮真实模型样本

测量源码为 [`37ea3c0`](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/commit/37ea3c0559a974a4776c78cfee833b1d98ec4e7c) 的未发布候选，不是 npm 上已经发布的 1.0.1 安装包。实际安装的 77 个运行文件与该提交逐字节一致；安装包哈希、完整环境、逐候选用量、阶段与工具区间见[结构化记录](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/measurements/first-use-2026-11-05.json)。后续教程名称与并发示例目录分配修改不在本次模型样本中。原始指标留在源码仓库，不随运行包分发。

环境：Windows、Node 26.13.0、DSH 0.2.1-rc.5、`deepseek-account/deepseek-flash`，基础任务；每版生成上限 5 分钟。三轮依次执行，各自使用新建仓库、候选会话与独立可变依赖目录。宿主在计时前启动，未重置系统或服务端缓存，不属于冷启动测量。自动选择第一份合格候选仅用于在示例仓库测试采用和撤销，不代表用户偏好。

| 轮次 | 首个通过共同检查的交互预览 | 两版均验收完成 | 包含测试采用与撤销的总时长 | 每版报告 token（含缓存） |
| --- | --- | --- | --- | --- |
| 1 | 59.6 秒 | 202.2 秒 | 209.5 秒 | A 1,234,664；B 220,083 |
| 2 | 41.4 秒 | 99.8 秒 | 107.1 秒 | A 122,977；B 385,742 |
| 3 | 39.5 秒 | 112.5 秒 | 121.2 秒 | A 391,766；B 123,810 |

首个预览中位数 **41.4 秒**，两版均验收完成中位数 **112.5 秒**。三轮双版通过，共 6/6 候选通过冻结安装、类型检查、构建与五步浏览器验收，三次测试采用和撤销均成功，均在 5 分钟生成上限内正常结束。首个预览按 2 秒轮询观测，存在轮询误差；两版均完成使用最后一份候选的 ready 时间戳。每版报告总 token 范围 **122,977–1,234,664**，包含大量缓存读取，不能直接解释为付费 token 或货币费用。

三轮均保留，没有剔除较慢或较高用量的样本。这些结果只覆盖该任务、版本与环境，不能推出其他模型、冷启动或实际项目的完成率，也没有隔离测量每个改动的因果收益。默认时长仍未加长。

## English

Choose the smaller search-and-clear case or the original complete filtering/mobile case in the composer or guide. The choice persists per conversation; no flags are required. Both create a separate repository, use the configured real model and consume usage for each candidate. The smaller scope is not a completion-time or price guarantee.

The five-step case and the original twelve-step case bind different acceptance before generation. Both retain frozen installation, typecheck, build and their common browser checks. Existing duration limits remain unchanged. After reveal, recorded stage durations distinguish preparation, generation, installation, checking and preview acceptance; missing stages remain unmeasured.

Historical benchmarks retain their source versions. At least three comparable current samples are required before publishing a median or completion rate; record exact source, host, model, baseline, acceptance, budget, interactive readiness and adoption. Unknown usage stays unknown.

The local timing script accepts a private event-array or JSONL export. It unions overlapping step/tool intervals, reports incomplete observations and emits no prompts, arguments or paths. Other step time includes model, queue and host work; it is not pure model waiting. Keep exports outside the repository.

On 2026-11-05, three sequential real-model runs on the recorded unreleased source used Windows, Node 26.13.0, DSH 0.2.1-rc.5 and deepseek-account/deepseek-flash with a five-minute generation limit per candidate. All six candidates passed, and all three scripted example adoption/undo checks succeeded. Median first verified interactive preview was 41.4 seconds; median completion of both candidates' checks was 112.5 seconds. Per-candidate reported totals ranged from 122,977 to 1,234,664 tokens, including cache counters. The host was already running; caches were not reset. These are three task-specific observations, not a cold-start, currency-cost or cross-model performance claim. The table and linked structured record preserve all three runs, source identity, artifact hash and conditions.

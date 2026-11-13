# 下载统计与维护进展说明（2026-11-13）

[English](download-statistics-2026-11-13.en.md)

AgentCompare 正在持续维护。当前公开稳定包为 **2.0.0**，源码中的后续修复与 npm 正式包分别发布。增长图中的单日下降保留原始数据，以下说明它的日期、统计口径和已核实的维护进展。

## 下降对应哪一天

| npm 统计日（UTC） | 下载请求 |
| --- | ---: |
| 2026-11-10 | 9,779 |
| 2026-11-11 | 156 |

这两天相差约 **98.4%**。11 月 11 日的统计区间换算为北京时间是 **11 月 11 日 08:00 至 11 月 12 日 08:00（不含结束时刻）**。它与图上的刷新日期是两个概念。[npm 逐日接口](https://api.npmjs.org/downloads/range/2026-11-10:2026-11-11/dsh-agent-compare)、[11 月 11 日单日接口](https://api.npmjs.org/downloads/point/2026-11-11/dsh-agent-compare)和[已保存的图表数据](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/07f50ed4dd158da6e3e0247d10b9ec19e70b3089/data/growth.json)均记录了这两个数值。

截至本次核验，npm 的 `last-day` 仍返回 11 月 11 日。查询包含 11 月 12 日的范围时，该日返回 0，但它晚于 `last-day` 所给的最后可用日，不能当成已经完成的零下载日。图表应以最后可用日为截止；延迟并不固定为两日。**11 月 11 日的 156 已由两个接口一致返回，本说明不把它解释为“尚未汇总所以接近零”。** [npm 官方接口定义](https://github.com/npm/registry/blob/main/docs/download-counts.md)

## 请求量说明什么

下载请求可能包含重复安装、自动化和测试访问，不能直接换算成独立用户、活跃用户或成功安装。公开的逐日聚合接口没有提供本项目请求来源的明细；仅凭这条曲线，无法确认高峰及下降的具体成因，也无法据此判断用户规模的同幅变化。[数据来源与统计口径](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/main/docs/growth.md)

## 同期维护与发布进展

11 月 11 日（UTC）已合并的维护包括：

- [恢复原蓝色界面并改善阅读细节（#162）](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/162)。
- [修复上下文摘要加载时模式按钮位移（#166）](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/166)。
- [改进 Ubuntu 浏览器检查所用的签名归档镜像选择（#164）](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/164)。

npm 记录的 2.0.0 发布时间为 **2026-11-10 12:22:39 UTC**。2026-11-13 核验时，`latest` 仍为 2.0.0，安装包入口的 HEAD 请求返回 HTTP 200。以上是发布时间和本次可用性检查，不是对过去每个时刻可用性的测量。[npm 发布元数据](https://registry.npmjs.org/dsh-agent-compare)

这些维护与发布记录不构成“当日全市场统一下架”或“暂停 npm 下载”的证据；目前没有查到支持这些说法的操作记录，因此不将其作为下降的已确认原因。各市场展示版本、图片和统计数字可能分别缓存，收录状态与安装验证也需要分开核对。

我们保留原始曲线，并继续按同一口径核对后续数据。核验时间、原始响应、显示截止日及发布记录已保存在[本次公开数据快照](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/measurements/npm-downloads-2026-11-13.json)中。

[返回 README](../README.md#项目增长)


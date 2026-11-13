# 累计 npm 下载请求 · Total npm download requests

README 的累计数值从 npm 注册表记录的首次发布时间开始，统计至 npm `last-day` 返回的最后可用日，覆盖该包全部公开版本。统计日采用 UTC，不把尚未提供数据的日期补为零。请求量可能包含重复安装、自动化与测试访问，不等于独立用户或成功安装数。

The displayed lifetime total starts on the registry's first-publication date and ends on the official API's last available day. It covers all public package versions. Dates use UTC. Missing days are not silently filled with zero; requests are not unique users or successful installations.

来源：[发布元数据](https://registry.npmjs.org/dsh-agent-compare) · [最后可用日](https://api.npmjs.org/downloads/point/last-day/dsh-agent-compare) · [npm API 定义](https://github.com/npm/registry/blob/main/docs/download-counts.md)。完整逐日来源及范围保留在[公开快照](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/measurements/npm-total.json)，README 只展示累计总数。

[刷新任务](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/npm-total.yml)每天北京时间 **19:00**（UTC **11:00**）检查一次。只有数值、统计截止日或源数据发生变化时才保存更新。接口失败、缺日或统计互相矛盾时，刷新任务失败并保留上次成功发布的总数，不把错误显示为零。每次范围请求不超过 365 天，避免把 npm 的单次范围上限误当成生命周期上限。

The refresh runs once daily at **19:00 Asia/Shanghai (11:00 UTC)**, saves meaningful changes only and retains the last published total on source errors. Daily ranges are fetched in chunks of at most 365 days so the API's per-request range limit does not become a rolling lifetime limit. The snapshot and SVGs are committed together.

手动核验：

```bash
node --test test/npm-total-downloads.node.mjs
node scripts/npm-total-downloads.mjs
node scripts/npm-total-downloads.mjs --check
```

`--render-only` 使用已保存快照离线生成图片；`--check` 离线检查图片与快照的一致性。上述过程不登录 npm，也不发布新包。


# Download statistics and maintenance update — 2026-11-13

[中文](download-statistics-2026-11-13.md)

AgentCompare remains under active maintenance. **2.0.0** is the current public stable package; subsequent source fixes and npm releases are tracked separately. The daily decline remains visible in the original chart. This note explains its dates, metric and verified maintenance activity.

## Which day does the decline cover?

| npm statistical day (UTC) | Download requests |
| --- | ---: |
| 2026-11-10 | 9,779 |
| 2026-11-11 | 156 |

The decrease between these days is approximately **98.4%**. November 11 UTC covers **November 11 at 08:00 through November 12 at 08:00 Asia/Shanghai, with the end excluded**. The statistical day and the chart refresh date are separate. The [daily range](https://api.npmjs.org/downloads/range/2026-11-10:2026-11-11/dsh-agent-compare), [November 11 point](https://api.npmjs.org/downloads/point/2026-11-11/dsh-agent-compare) and [saved chart data](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/07f50ed4dd158da6e3e0247d10b9ec19e70b3089/data/growth.json) agree on these values.

At this check, npm's `last-day` still returned November 11. An explicit range through November 12 returned zero for that later day, but a date beyond the last available day must not be presented as a completed zero-download day. Charts should stop at the API's available cutoff; the lag is not fixed at two days. **Both checked endpoints report 156 for November 11; this note does not dismiss that point as incomplete reporting.** [Official npm API definitions](https://github.com/npm/registry/blob/main/docs/download-counts.md)

## What do requests measure?

Download requests may include repeated installations, automation and test traffic. They do not directly measure unique users, active users or successful installations. The public daily API does not provide this project's request-source breakdown, so the chart alone cannot establish the cause of the peak or decline, or an equivalent change in user numbers. [Sources and definitions](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/main/docs/growth.md)

## Maintenance and publication

Maintenance merged on November 11 UTC includes:

- [Restoring the original blue interface and improving reading details (#162)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/162).
- [Keeping mode buttons stable while the conversation preview loads (#166)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/166).
- [Improving signed Ubuntu archive selection for browser checks (#164)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/pull/164).

npm records the 2.0.0 publication at **2026-11-10 12:22:39 UTC**. On November 13, `latest` still resolved to 2.0.0 and a HEAD request to its tarball endpoint returned HTTP 200. These establish the publication time and availability at this check, not continuous historical uptime. [npm publication metadata](https://registry.npmjs.org/dsh-agent-compare)

The maintenance and publication records do not establish a coordinated marketplace delisting or a suspension of npm downloads. No supporting operational record was found, so neither is presented as a confirmed cause of the decline. Marketplace versions, images and statistics can be cached independently; listing status and installation verification also require separate checks.

The original chart is retained. Subsequent data will be checked using the same definitions. Check times, original responses, the display cutoff and publication records are preserved in the [public evidence snapshot](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/measurements/npm-downloads-2026-11-13.json).

[Back to README](../README.en.md#project-growth)


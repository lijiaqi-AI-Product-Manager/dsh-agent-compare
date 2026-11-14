# 插件目录与安装

[English](distribution.en.md)

AgentCompare 的仓库名和 npm 包名均为 `dsh-agent-compare`。插件以标准 `dsh.bundle.patch` 配置层分发；Web 客户端入口通过 `dsh.client` 加载。市场可以使用 npm 包或带有预构建 `lib/` 的 GitHub 源码安装，无需额外安装另一个市场作为运行依赖。

## 安装入口

官方桌面版在应用内的「插件 → 添加插件」中安装。Web 版使用自己管理的 profile，命令见 [README](../README.md#安装)。桌面版的 profile 由应用管理，安装到独立的 Web profile 不会让插件出现在桌面版里。

搜索时可使用 `AgentCompare`、`dsh-agent-compare`、`A|B`、双版本比较、真实预览、盲选和审查采用。包内保留中英文说明与 `dsh`、`dsh-plugin`、`deepseek-harness` 等相关关键词。

## 宿主兼容范围

`engines.dsh` 为 `>=0.2.1-rc.3 <0.3.0-0`。DSH 的 `@deepseek-ai/dsh-app-boot` 使用 `includePrerelease: true` 校验；因此 0.2.2 的 alpha／rc 参与匹配，不能用 npm semver 的默认选项推断安装失败。上界的 `-0` 明确排除 0.3.0 的预发布版本。

版本范围表示宿主是否允许加载，不等同于已完成产品验收。必需的 Windows／Linux／macOS 原生运行检查分别固定使用 DSH 0.2.1-rc.5 与 0.2.2-rc.1；另有独立、允许失败的 `next host canary` 跟踪 next 通道。每次输出实际解析的宿主版本，并直接调用该宿主的兼容性判断函数测试边界。Canary 失败必须单独调查，不能当作通过；它不代表外部模型或最终桌面壳已验收。最新状态见 [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)。

## 目录来源

以下是各入口公布的收录机制，核对日期为 2026-11-04。它们是独立社区服务；收录和推荐状态以相应服务为准。

| 入口 | 对接方式 |
|---|---|
| [Awesome DSH Plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md) | 单个 YAML 条目，由维护者审核；自动关联指回本仓库的 npm 包。 |
| [dsh-market](https://github.com/dsh-market/dsh-market#submit-your-plugin) | 使用 Awesome DSH Plugin 的目录。 |
| [开放插件市场](https://github.com/polang233/dsh-plugin-index/blob/main/.github/CONTRIBUTING.md) | 通过收录 Issue 提交；版本审查标签与增长标签按其公开规则生成。 |
| [1024 Store](https://github.com/imsai-sh/awesome-deepseek-harness-plugins/blob/main/CONTRIBUTING.md) | 单个 JSON 条目；可安装条目需要有效的已发布 npm bundle。 |
| [DSH Plugins Marketplace](https://github.com/bradeGithub/DSH-Plugins-Marketplace/blob/main/STANDARD.md) | 采集 `dsh-plugin` 话题，并识别 bundle 和安装入口。 |
| [DSH Market · dsh.market](https://github.com/2BingLing/dsh-market/blob/master/CONTRIBUTING.md) | 话题采集或提交 Issue；作者可补充自己的功能说明。 |
| [dsh-recommend](https://github.com/zp-home/dsh-recommend/blob/main/.github/ISSUE_TEMPLATE/submit-plugin.yml) | 话题采集；「精选认证」需要单独申请，由维护者批准。 |
| [DSH Get](https://github.com/bobby-sheng/dshget-data) | 聚合多个公开目录和 GitHub 话题；支持缺失条目与信息更正 Issue。 |
| [DSH Plugin Registry](https://dshplugin.app/submit) | 提交公开仓库地址进入审核。 |
| [Harness Registry · dshdesk](https://github.com/majiayu000/dsh-plugin-registry/blob/main/docs/registry-governance.md) | 话题自动发现与 manifest 检查，支持通过收录 Issue 申请审核。 |
| [DSH Plugin Hub](https://dshpluginhub.ai/en/docs/plugin-not-found) | npm 自动发现，可提交包名加速；认领和编辑需要账号授权。 |
| [DeepseekPlugin](https://deepseekplugin.org/en/docs/submit-plugin) | 提交公开仓库 URL，识别通过后发布；读取仓库说明和安装命令。 |
| [dshmarketplace.dev](https://github.com/DshMarketPlace/dshmarketplace#contributing) | 网页提交仓库和用途说明，人工审核后收录。 |
| [DSH Learn](https://dshlearn.com/submit) | 资源投稿表单需要公开仓库、解决的问题与维护者联系信息。 |
| [dsh.fish](https://dsh.fish/docs/publish/bundle) | 提交 npm bundle 或源码，读取真实 manifest。 |
| [dsh.pub](https://dsh.pub/zh/submit/) | 使用目录的提交入口，固定公开来源。 |

DSH 原生「发现」读取第三方提供的插件索引，各索引决定自己的版本、分类和标签。索引收录无需修改插件的执行接口。参见 [DSH 插件索引文档](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.md)。

## 市场图片

- 图标：[`assets/icon.png`](../assets/icon.png)，512 × 512 PNG；矢量源文件为 [`assets/icon.svg`](../assets/icon.svg)。
- 有序图库：仓库根目录 [`screenshots.json`](../screenshots.json)，提供 8 个新的 GitHub HTTPS 图片地址；前两张为产品主图和实际比较界面。截图清单与 README 插图是不同入口，更新 README 不会自动扩充市场图库。
- [完整图库](storefront-gallery.md)包含两张浅蓝功能示意图和六张实际界面：四版页面、主对话、设置、保存与撤销、英文回答和历史。
- [图库来源](../assets/readme/gallery-2.0/manifest.json)记录图片种类、尺寸和校验值；[原始录制来源](media/screenshots/manifest.json)独立保留。

界面使用固定候选，展示真实应用执行、回答、选择、保存与保留的记录；本地路径已隐藏。2.1.0 界面在 DSH 0.2.2-rc.1、Edge 157 的独立 Web profile 中拍摄，95 个运行文件与录制所用源码逐字节一致，没有操作用户桌面 profile，也没有新增外部模型请求。功能示意不当作实际截图，录制结果不当作模型质量或耗时承诺。图片放在仓库专用目录，不增加 npm 运行包体积。

目录各自决定抓取和缓存周期。只有公开条目回读到新版图片、版本与文案，才算该平台同步完成。Star 与 npm 下载量分别来自 GitHub 和 npm；README 使用动态徽章，目录卡片使用自己的统计字段，缺失值应为“未知”而非零，下载请求不等于独立用户。

## 数据与权限

任务和相关项目上下文交给用户选择的 DSH 模型；网络目的地和凭据由宿主的模型配置决定。安装依赖会访问目标项目包管理器及锁文件指定的来源。预览在本机回环地址启动。插件没有独立的遥测或自动上传功能。

记录、补丁、截图和日志保存在本地，可能包含项目内容。工作副本按归属证明清理；采用恢复目录会保留用于恢复的原始文件。导出和分享由用户主动执行，发布前应查看内容。执行边界来自宿主，界面展示实际生效的限制。

## 维护

更改源码后运行 `npm run build` 并一起提交 `lib/`。运行 `npm run check:distribution` 检查 manifest、图片和来源映射；CI 用 `npm run check:prebuilt` 防止源码与预构建入口不同步。更改截图后更新截图 manifest；更改文件路径时一起更新 `screenshots.json`。

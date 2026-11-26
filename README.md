[![鲸挑细选：同一想法的四种番茄钟设计，红色番茄版本 C 已选中。功能示意。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp)](#demo)

<div align="center">

<a id="agentcompare"></a>
<a id="agentcompare-中文指南"></a>
<a id="鲸挑细选--agent-compare-dsh-agent-compare"></a>

# 鲸挑细选 · Agent Compare

[![GitHub Star 数 · 500](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/github-stars.svg)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers)
[![npm 累计下载请求 · 335,762](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-highlight.svg)](https://www.npmjs.com/package/dsh-agent-compare)
[![DSH插件市场下载榜 · 工作流与自动化第 1 名](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dsh-market-workflow-download.svg)](https://dshmarket.com/zh/categories/workflow/)

[![dsh.so · 周下载榜 #5](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dshso-weekly-download-rank.svg)](https://www.dsh.so/artifact/dsh-agent-compare/)
[![dsh.so · 周 Star 增长榜 #19](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dshso-weekly-stars.svg)](https://www.dsh.so/artifact/dsh-agent-compare/)

[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=3657f5&style=flat&labelColor=0b1b4f&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)
[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=0b1b4f&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5 and 0.2.2-rc.1](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5%20%2F%200.2.2--rc.1-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<sub><a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md">统计口径与榜单来源</a></sub>

**中文** · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · [日本語](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ja.md) · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · [Deutsch](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.de.md)

**大肥鱼赛马：让同一想法，长出更多实现方案！**

**鲸挑细选 · Agent Compare** 是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的比较插件，安装名为 `dsh-agent-compare`。在主对话里，把同一需求交给 2–4 个版本，比较回答、文件或可运行网页，再选出更符合你想法的一版。支持 **DSH Desktop + Web**，产品界面可切换中文和 English。

<p align="center"><a href="#demo">看 45 秒演示</a> · <a href="#install">安装到 Desktop / Web</a> · <a href="#support">查兼容范围</a></p>

<a id="demo"></a>
<a id="看一场完整的大肥鱼赛马"></a>

</div>

## 先看一次完整比较

[![真实宿主固定候选演示：蓝鲸与步骤、四版页面、选择理由和保存后继续。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/1edf6ec2d1be76a45ef3827795be7ceaafc982c9/assets/readme/comparison-quicklook.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

真实 DSH 宿主中的固定候选演示：从蓝鲸工作、展开步骤，到体验页面、选择 C 并说明理由，再保存结果、继续主对话。视频剪去等待，其余按原速播放。

[完整视频 · 45 秒](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [录制条件与结果](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md) · [完整 GIF](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-preview.gif)

下面的截图与动图来自真实 DSH 宿主中的固定候选。它们展示实际界面与操作流程；模型生成质量、耗时和 UI 演示分开说明。

[![真实界面：四版可操作页面及各自的回复和步骤。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)

四版页面可以直接操作，回复与页面同等呈现；展开「过程」还能看到思考与工具调用。

<details>
<summary>四步比较流程</summary>

[![设置 2–4 版与风格、并行处理、体验选择、审查后继续。功能示意。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)

设定版本与风格 → 并行完成 → 体验并选择 → 审查后继续。流程图为功能示意。

</details>

<a id="install"></a>

## 安装

### DSH Desktop

1. 在应用的 **插件 → 添加插件** 中安装 `dsh-agent-compare`。
2. 在 **插件 → 已安装** 确认「鲸挑细选」已启用，再完全退出并重新打开 DSH。
3. 在主对话输入框左下角点 **A|B**，选好版本与风格后直接发送需求。

### 自行运行的 DSH Web

以下命令用于自行运行的 DSH Web profile。桌面版的 `desktop` profile 由应用管理，请使用应用的插件页面。

安装 npm 包到默认 Web profile（公开发布状态见顶部 npm 徽章）：

```bash
dsh plugin --profile web add dsh-agent-compare
```

如使用其他自行运行的 profile，请将 `web` 换成实际名称。

**更新后请完整重启。** 桌面版需要完全退出 DSH 后重新打开；Web 版重启对应的 DSH 服务后刷新页面。只刷新界面可能仍在使用旧后台；版本不一致时界面会提示重启。

<details>
<summary>从源码构建并安装</summary>

也可以从源码构建并安装：

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
```

```bash
cd dsh-agent-compare
npm ci
npm pack
```

```bash
dsh plugin --profile web add ./dsh-agent-compare-3.3.1.tgz
```

</details>

<a id="use"></a>

## 开始第一次比较

重启 DSH 后，在**主对话输入框左下角点 A|B**：

1. 输入框上方展开设置条，选择比较方式：「同一模型 · 不同风格」（默认，复用当前模型）或「不同模型 · 同一风格」（每版选一个已配置的模型，共用一种风格）。
2. 选择版本数（2、3 或 4）和盲选或公开对比；同一模型时为每一版选一种风格，或写一句话自定义。版本越多，用量越多，设置条会提示。
3. 选择每版生成上限（5–120 分钟），以及各版能看到的「主对话上下文」：不带、最近几轮（默认 3 轮）或手动勾选。设置条会显示各版将收到的完整内容。设置保存在当前对话，重新打开仍可读取。
4. 在原输入框里写需求并发送。无需填写指令或参数；模式切换只操作自己的命令标记，保留草稿、引用与附件。暂不支持的附件提交会由宿主拒绝并保留原稿。
5. 同一条对话里出现 A|B 卡片，按结果展示**回答、文件或可运行网页**；有实时页面时可直接点击和输入。新会话尚未显示聊天时间线时，同一份记录直接显示在输入框上方。默认适应窗口、直接交互，也可切换统一桌面／手机视口，或专注某一版（在卡片里按 1–4，按 0 回到全部）。3–4 版时可以「排除」暂时不考虑的版本，剩下的并排放大。「大窗口查看」用于放大检查。
6. 选择一版或「都不满意」。盲选在选择后揭晓模型和风格，公开对比一开始就显示。项目改动通过验收后，可查看差异并点「审查并采用」；先核对目标与结果，再单独确认写入。非 Git 目录可保存到新文件夹，纯回答无需写入文件。点「继续主对话」返回原输入框，选择和恢复记录仍保留。

设置条中的「试跑内置示例」可选择基础的搜索与清空，或完整的组合筛选与手机适配；选择会记住。它直接新建独立仓库并在本对话中启动，不修改已有草稿，结果只采用到示例仓库。各版分别使用真实模型并消耗用量，较小范围不保证固定耗时。[示例范围与耗时说明](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/first-use.md)。

右上角的**比较记录**与**使用教程**在新建和已有对话中均可打开。历史保留需求、检查、选择、采用与撤销记录；预览停止后可查看验收截图。

安装环境造成失败时，卡片会区分连接、访问权限、磁盘、运行环境、锁文件和超时，给出处理建议。修正环境后点「重新验收 A/B」即可复用已封存代码和原验收定义，不重复生成；上次失败、检查与用量继续保留。锁文件不一致需要修正后开始新的比较，不能靠反复安装或放宽条件通过。

[运行记录、重启与恢复](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/runs-and-recovery.md) · [支持范围](#兼容范围) · [自定义验收](#repository-acceptance-agent-comparejson)

比较结果、你的选择、采用与撤销都会写入这条对话的记忆。之后可以直接问「刚才比较的结果怎么样」，或者在采用的版本上继续改。揭晓后还没采用时可以改选另一版；都不可用时可以「再比较一次」。详见[主对话记忆与上下文](docs/conversation-memory.md)。

[Windows 进程兼容设置](docs/windows-process-compat.md)提供自动与关闭选项，保留原有宿主约束，并在揭晓后显示实际观察到的钩子。

<a id="ui"></a>
<a id="gallery"></a>

## 界面与体验

手机上，先选比较方式、版本数和盲选方式，核对项目与将带入的对话，再直接输入需求。「更多设置」里可以改风格、时长或试跑示例。回看旧比较时，展开设置会先收起旧结果；再展开结果，网页输入和需求草稿都会保留。

在矮窗口里，设置区可以单独滚动，输入框和发送按钮仍在首屏。横屏高度很小时，点「展开设置」即可调整选项。

手动输入 `/ab` 时，如果需求里也包含选项名，把 `--` 放在原文前。例如，`/ab --versions 2 -- 请解释 --example 的用法` 会生成两版说明。

在宽屏并排比较实时网页时，点「对齐网页」，两版页面会从同一高度开始。再点一次就能恢复原排版，网页里已经输入的内容会保留。

在手机上用风格小样搭配各版，在桌面上展开过程，看每版最近做了什么。盲选后才揭晓模型和风格。采用前可以按文件查看带行号的改动。

<details>
<summary>查看 3.3.0 实际界面</summary>

![手机上的比较设置和对话输入框](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/composer-mobile.webp)

![桌面审阅中的文件列表和逐行差异](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/patch-review.webp)

![深色模式下的四步使用指南](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/guide-dark.webp)

</details>

- **蓝色液态玻璃。** 设置栏、候选卡和审阅区用不同层次的蓝色玻璃区分。系统开启减少动效时，选择和揭晓会直接切换。
- **大肥鱼陪你等。** 每版一条 DeepSeek 蓝鲸，随进度注入蓝色的水，两道光沿轮廓奔跑；头上不时冒出想法，戳一下会回话，连戳会转圈、晕头、溅水花。
- **从最近一步看起。** 生成中的卡片顶部显示最新动作。展开「过程」可读到已记录的思考、工具调用和耗时。
- **回复与成品同等显示。** 只回答就只显示回答；做了网页时回复和页面并排，专注某一版时回复在左、页面在右。
- **A–D 各有标记。** 钴蓝、天蓝、紫罗兰和青色分别对应 A、B、C、D，字母也始终可见。
- **一眼看出在跑。** 运行中的比较有两颗彗星绕边框奔跑；页面一启动就能直接点、直接输入。
- **桌面、浏览器和手机宽度都能用**，中英文界面随时切换。

步骤内容以模型和宿主实际提供的信息为准；长记录保留首尾，过长文本会标明截断，盲选期间遮盖风格词。鲸鱼水位表示处理阶段，不是质量评分或精确进度百分比。

[![真实界面动图：蓝鲸注水、想法气泡、连续点击互动与实时步骤。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/whale-closeup.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/whale-closeup.webp)

<p align="center"><sub>大肥鱼特写：固定候选，脚本模型每步等 9 秒，方便看清；有剪辑，其余原速。</sub></p>

[![真实界面：回复与选中页面并排，保存结果并记录选择理由。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/05-saved-result.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/05-saved-result.png)

专注一版时，回复与页面并排；选定理由、保存或审查采用之后，继续原来的主对话。

<details>
<summary>更多真实界面：回答、设置、English 与手机宽度</summary>

[![真实界面：在项目里打招呼，得到四种回答，没有修改或构建项目。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)

[![真实界面：设置版本、风格和主对话上下文。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)

[![真实英文界面：三版回答并排，B 被选中并记录理由。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp)

<p align="center"><a href="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp" width="260" alt="真实 390 像素英文界面：回答结果与继续主对话入口。"></a></p>

</details>

[更多真实界面：回答、设置、English 与手机宽度](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/storefront-gallery.md)

<a id="tasks"></a>
<a id="适合什么任务"></a>

## 适合什么任务

| 你想完成 | 你会比较 |
|---|---|
| 回答、分析或文案 | 不同表达和思路；排好版并排阅读，一键复制。 |
| 脚本、文档或其它文件 | 各版写出的文件与回复；选择后保存到新文件夹。 |
| 网页与界面改动 | 可运行时直接操作各版页面，查看共同验收，再审查采用。 |

<details>
<summary>展开模型、风格与任务选择说明</summary>

界面和交互类任务：好坏要靠人体验，测试只能判断「有没有做到」。比如搜索和筛选、表单流程、落地页、仪表盘布局、组件重设计。
答案唯一的修 bug 或重构，用单个 Agent 加测试更合适。

两种比较方式，都可以选 2–4 版，盲选或公开对比：

| 方式 | 各版相同的 | 各版不同的 |
|---|---|---|
| 同一模型 · 不同风格（默认） | 模型、需求、验收 | 风格（默认 2 版为稳妥 + 大胆，3 版加极简，4 版再加活力） |
| 不同模型 · 同一风格 | 需求、验收、风格（默认均衡） | 模型（从你在 DSH 里已配置的模型中各选一个，不能重复） |

<a id="styles"></a>

八种风格分成三组，每一种都必须完成需求里的所有要求：

| 分组 | 风格 | 做网页或改项目时 | 回答问题或写文件时 |
|---|---|---|---|
| 改动幅度 | 稳妥 | 沿用现有组件和写法，改动最小 | 常规、直接 |
| | 大胆 | 重新思考布局与交互 | 换个角度，更有创意 |
| 视觉气质 | 极简 | 元素少、留白多，一眼看懂 | 只讲要点 |
| | 精致 | 专业质感，层级清楚，状态完整 | 结构化、周全 |
| | 活力 | 色彩、动效与个性 | 语气亲切，多用例子 |
| 优先目标 | 易用 | 新手友好，可访问，手机优先 | 一步一步讲清楚 |
| | 严谨 | 校验、边界情况与测试 | 说明假设，覆盖边界 |
| | 轻快 | 代码少、加载快、不加依赖 | 越短越好 |

自定义风格是一句话描述（最多 120 字），会作为风格说明交给各版，不能改变需求或规则。同一种风格可以重复选，相当于同一要求多跑几次。

盲选时，开始时会把所选风格随机分配到 A–D，选完才揭晓；公开对比按设置的顺序对应 A–D，比较时直接显示。

</details>

<a id="support"></a>

## 支持范围与使用须知

| 宿主与范围 | 覆盖证据 |
| --- | --- |
| Windows · DSH 0.2.2-rc.2 / rc.3 · Node 26.13.0 · 2026-11-18 | Windows 上用 3.2.0 的宿主测试验证安装、命令检查与 Vite 预览。 |
| Edge 157 · 390 / 1440 px | [查看新版实际界面（Edge，示例对话）](#ui) |


- 实时页面需要可运行的网页项目；纯回答和文件也能比较。普通文件夹、Git 仓库与子目录的差别见项目类型说明。
- 每版独立消耗模型用量，实际耗时与费用因模型和任务而异；并行不保证更便宜或更快。
- 采用前先审查，保留撤销与恢复记录。工作副本不是完整虚拟机，文件写入约束由 DSH 提供；读取与网络不隔离，Windows 会显示实际约束范围。
- 非 Git 目录默认从空白副本生成，不会读取已有文件；要修改已有内容，请先在设置条里启用 Git。结果保存到当前目录的新子文件夹。

[项目类型与普通文件夹](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/workspaces-and-projects.md) · [包管理器执行矩阵](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/package-managers.md) · [完整兼容与 Safari 边界](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility)

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [投稿与收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

<a id="details"></a>

## 深入了解：验收、恢复与高级设置

<a id="what-it-does-for-you"></a>

### 它替你做掉的那部分

自己多开几个会话也能让模型写几版，真正麻烦的是后面这些，鲸挑细选把它们变成一步：

- 每一版都从**同一基线**出发，包括你还没提交的改动，而你的 index 和文件一点不动；
- 每个候选分别申请以自己副本为根的宿主写入约束，并披露宿主实际提供的约束范围；
- 各版使用独立的依赖文件、验收与预览环境，并行处理；符合下述 npm 预装条件且清单不变时，可获得私有预装结果的独立副本；
- 用**同一套、事先固定并绑定内容**的验收比较，候选改了验收脚本或测试就不算通过；
- 选完以后合回项目时，先确认它和你这期间的修改能一起工作；待写入前发现目标发生变化，就停止采用。

<a id="how-it-works"></a>

### 工作流程

1. **基线**：用私有临时 index 给工作区拍快照（含未提交和未跟踪文件，不含被忽略的文件），不改你的 index 和文件。
2. **验收绑定**：从基线确定验收命令（`typecheck` / `lint` / `test` / `build` 脚本 + 页面验收），并记录这些脚本的内容、验收相关文件（`tsconfig*`、`vite`/`vitest` 配置、lint 配置、已有测试文件、`.agent-compare.json`）的内容哈希、锁文件和运行时。仓库根目录的 `.agent-compare.json` 可以加上逐步交互验收（见下文）。
3. **隔离副本**：为每个候选建一个不带分支的 `git worktree`，放在插件目录（`~/.dsh/agent-compare/w/<run>/<candidate>`），并在副本的 git 管理目录里写入归属标记。
4. **候选会话**：每个候选是一个独立的 DSH 会话，会话目录就是它的副本。开始前以此目录申请 `workspace-write` 约束，审批策略固定为「从不」。具体约束由宿主执行，包含下文列出的平台限制。每个候选有生成时间上限（界面可选 5 / 15 / 30 / 60 / 90 / 120 分钟，默认 30）。到时还没说完成，就停止它，照样封存并验收它已写的改动。生成期间，卡片上的「过程」实时列出它的思考、工具调用和中间说的话，并提示多久没有新动作。它的这一轮结束、且没有排队的消息，就算完成，不等其他插件在会话里的后台工作。
5. **封存**：生成结束后会话被关闭，改动被冻结为一个提交和一份完整的二进制补丁（SHA-256），永远排除 `node_modules`。
6. **验证**：确认副本内容与封存版本一致 → 按锁文件**冻结安装**（失败就失败，不会退回非冻结安装）→ 跑验收命令（最多三条同时运行）→ 用 `vite preview` 运行**构建产物** → 在独立的无头浏览器上下文里跑页面验收（可加载、无控制台错误、逐步交互、桌面和手机截图）→ 再确认验收没有在副本里留下未封存的改动。构建没通过时只提供开发模式预览，并标明「仅供观察」。页面一启动就能在卡片里操作，验收在后台继续。
   - npm 项目有锁文件、根目录没有安装脚本、也没有本地包时，各版生成期间就在这次比较的私有目录（`~/.dsh/agent-compare/d/<run>`）里按基线清单冻结安装一次。依赖清单（`package.json`、锁文件、`.npmrc`）与基线逐字节相同的版本，复制一份属于自己的结果，不再重新安装；其余情况照常安装。各版验收结束后删除这个目录。
   - 上述构建产物流程以 Vite 项目为例；其他 Node 项目使用适用的脚本，纯静态网页无需安装和构建，回答与文件可按内容比较，不把未执行的检查写成通过。
7. **结论**：根据已记录的检查、验收定义和内容一致性决定能否采用。失败、超时、验收文件变更或未封存改动会阻止直接采用；明确的页面行为验收没有运行也会阻止。仅基础页面加载检查未运行时保留警告，不算已经验证；依赖变更和缺少锁文件也会提示。
8. **选择**：2–4 张卡片按结果展示回答、文件或实时页面；有页面时使用独立 iframe。盲选时只标 A–D，风格在开始时随机分配，选完揭晓风格、实际模型及可用的用量；公开对比一开始就显示。适用时也会显示「程序验收倾向」与「你的选择」是否一致。
9. **采用**（只对通过验收的版本开放）：
   - 计算采用后项目应有的完整内容：你当前的工作区 + 候选改动的文件。候选改过的文件如果你在基线后也改过，直接阻止，一个字节都不写。
   - 如果你在这期间改过其他文件，先在**当前项目的副本里预演**这个组合并跑完整验收；不通过就阻止，不写入。
   - 预演结束后、每个文件写入或删除前，重新核验工作区、HEAD 和暂存内容，包含写入日志保存后的变化。发现变化就停止；只对之前已尝试写入的路径执行回退，保留之后的用户编辑。
   - 写入前先持久化恢复记录（采用前快照、预期内容、HEAD 和暂存区指纹），并持有仓库级锁。
   - 按仓库自己的换行和过滤设置预备候选文件，先保留实际原始文件，再以不会覆盖现有路径的链接交接；交接瞬间的新编辑或新文件会阻止写回，双方内容均保留。随后核对项目**与预演通过的内容完全一致**、HEAD 和暂存区未变。不提交，不改 index。
   - 写入失败自动恢复；宿主中断后，重新打开时会进入「需要处理」，可以恢复到采用前或保留当前文件。
   - 之后也可以撤销（前提是你没再改过这些文件，否则会列出这些文件、不覆盖）。
   - 未通过验收的版本只能「另存为分支」（含一个提交，不切换、不改当前文件）供你查看。
10. **继续**：采用成功后会回收副本和预览进程，面板直接给出「继续这份成果」：在刚采用的结果上输入下一项需求，再比较一次。历史记录单独浏览。

<a id="isolation-and-safety-what-is-and-is-not-guaranteed"></a>

### 隔离与安全：保证什么、不保证什么

封存与验收从原仓库核对副本的 Git 管理目录、双向链接和归属标记，再显式绑定 Git 目录与工作区执行。指针被改写、链接替换、过大或缺失时，拒绝继续封存和重新打开预览；清理会保留归属不明的副本并说明原因。终端遗留的 Git 仓库、index 和配置选择变量不会重定向这些操作，内部显式创建的私有 index 仍可使用。这些检查保护插件的 Git 生命周期操作；项目进程的约束仍由宿主沙箱提供。

| 方面 | 做法 | 边界 |
|---|---|---|
| 候选写文件 | 候选会话的目录就是它的副本，由 DSH 沙箱在执行前限制 | DSH 官方把 Windows 沙箱标为 partial；平台临时目录可能可写 |
| 项目命令 | 安装、检查、初次预览和重新预览都使用宿主的 `workspace-write` 约束；子进程环境使用宿主的规范清理接口 | 没有约束就停止，不会退回无约束执行。宿主报告部分约束时保留记录并提示；不提供文件读取或网络隔离 |
| 你的项目 | 生成期间检查项目是否和基线不同，并在面板中提示 | 只报告观察到的变化，不推断是谁修改；采用时检查是否重叠 |
| 并发编辑 | 核验工作区与原始文件指纹；先保留原始文件，再以不覆盖现有路径的链接交接。撤销和恢复也保留冲突内容 | 仓库锁不锁定外部编辑器；交接逐文件完成，涉及文件的编辑与目录重排请等操作结束。不是对同权限进程的安全沙箱 |
| 验收 | 绑定脚本内容、配置和测试文件的哈希；验收前后核对副本内容 | 自由文本需求中无法自动验证的部分只能靠你体验，不会被宣称已验证 |
| 依赖 | 有锁文件时使用冻结安装，或复制清单一致的私有冻结安装结果；候选的依赖文件独立 | 没有锁文件的项目只能非冻结安装，会明确提示；预装复制失败退回该版正常安装，不放宽锁文件检查 |
| 进程 | 预览进程只在命令行能证明是本插件启动的那个时才会被结束；预览写入同样使用宿主约束 | 网络访问和进程可见性**不隔离** |
| 浏览器状态 | 每次启动预览分配新的随机 `.localhost` 域名，进程仍只绑定 `127.0.0.1`；宿主直接连接回环探测，并要求 HTTP 成功状态 | 嵌入 Cookie 受浏览器策略限制，登录、外部后端和共享数据库暂不支持；外部标签页可能使用不同存储。重开预览会重置页面状态，比较记录和截图仍保留 |
| 嵌入导航 | 预览允许脚本和表单，不允许跳转比较窗口的顶层页面 | 不提供完整的恶意代码沙箱；页面与网络请求仍受浏览器自身策略管理 |
| 清理 | 只删除「已注册为该仓库 worktree + 归属标记匹配」的目录 | 不能证明归属的目录会保留并列出 |
| 原始内容保留 | 项目内自忽略的 `.agent-compare-transfer-*` 目录保留原始文件和交接日志，结果中可查看位置；预览清理不会删除它 | 直接写回限普通文件、10,000 个路径及合计 128 MiB 的原始与候选内容；不支持硬链接的文件系统、符号链接及特殊文件可另存分支。未完成恢复前请保留目录 |
| 旧版记录 | 0.1 版本留下的记录只读显示 | 不会对其中记录的路径或进程做任何操作 |

DSH 宿主没有提供会话创建接口（`ctx.agents.create`）时，会退回 0.1 的子 Agent 方式（`isolation: shared-root`）：副本放在仓库内的 `.agents/worktrees`，越界写入只能事后发现。面板和运行记录都会标明当前用的是哪种。

当前 Windows 宿主限制受限进程内部创建捕获输出的命名管道。npm 安装脚本改用前台输出，不改变项目的脚本许可；esbuild 版本检查及 Vite 的可选 `net use` 探测通过私有临时文件捕获输出，esbuild 服务使用宿主公开的匿名管道接口，子进程继承同一个受限令牌。其他需要嵌套命名管道的工具仍可能失败，不会降低权限要求重试。此边界不包含文件读取和网络访问隔离。

<a id="configuration-optional"></a>

### 配置（可选）

在 profile 的 `cordis.patch.yml` 里追加一条以插件 id 为目标的配置：

```yaml
- id: agent-compare
  name: dsh-agent-compare
  config:
    generationMinutes: 20
```

| 键 | 默认值 | 说明 |
|---|---|---|
| `generationMinutes` | `30` | 每个候选的生成时间预算 |
| `maxActiveRuns` | `1` | 同时生成的比较轮数 |
| `isolation` | `own-root` | `shared-root` 为实验性的旧方式 |
| `home` | `~/.dsh/agent-compare` | 记录、补丁、截图和副本的位置 |

<a id="repository-acceptance-agent-comparejson"></a>

### 仓库自定义验收：`.agent-compare.json`

放在仓库根目录、并提交（验收读取的是基线里的版本，候选改它不算数）：

```json
{
  "scripts": ["test:e2e"],
  "browser": {
    "path": "/",
    "steps": [
      { "label": "初始 8 个商品", "expectCount": "[data-testid=product-card]", "min": 8, "max": 8 },
      { "fill": "input[type=search]", "text": "lamp" },
      { "expectCount": "[data-testid=product-card]", "min": 1, "max": 1 },
      { "click": "button:has-text(\"清空\")" },
      { "viewport": { "width": 390, "height": 844 } },
      { "expectVisible": "input[type=search]" }
    ]
  }
}
```

步骤类型：`fill`、`click`、`press`、`expectVisible`、`expectCount`、`expectText`、`viewport`；选择器是 Playwright 选择器。完整示例见 [examples/vite-react-demo/.agent-compare.json](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json)。

配置会在生成前严格校验。未知字段、不存在的脚本、非法步骤和跨来源页面路径会直接报错。自动绑定根目录 JS/TS 辅助程序、`scripts/`、`tools/`、`config/`、已知配置和已有测试；新增验证配置及 package scripts（包括生命周期钩子）的变化也会使候选不可直接采用。其它位置的验证数据或辅助文件可在基线配置中通过 `"protectedFiles": ["custom/fixture.json"]` 指定，必须是已存在的具体仓库相对路径。

绑定范围不会推断任意程序动态读取的全部文件。程序验收说明已配置检查的结果；需求中的其它质量标准仍需实际体验和代码审查。

<a id="compatibility"></a>

### 兼容范围

| 项目 | 状态 |
|---|---|
| DSH 0.2.1-rc.3 桌面版，Windows 11 | 历史兼容案例：真实模型完成生成、验收、盲选和采用；候选会话申请各自副本的写入边界，shell 命令已运行 |
| DSH 0.2.1-rc.5，Windows 11 Web UI | 生产版指令、真实子会话、预览、采用、历史恢复及采用说明进入主对话下一次请求已通过；使用本地脚本化适配器 |
| Linux，Ubuntu CI，DSH 0.2.1-rc.5 | 核心回归和真实宿主进程约束、环境清理、冻结安装、构建、预览重开、取消检查已通过；未测外部模型完整交付 |
| DSH next 通道 | 独立 Windows／Linux／macOS 原生运行 canary，记录实际版本；状态见 [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)，不等同于完整模型交付验收 |
| macOS | 当前源码增加原生完整回归、Chromium 界面、真实 DSH 与包管理器检查；Safari 实时比较另见 [#115](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/115)，不能用 Chromium 结果代替 |
| 1.2.0 验收基线 | Windows／Linux／macOS 固定 DSH 0.2.1-rc.5 与 0.2.2-rc.1；Playwright 1.65.0、Vite 8.3.6、pnpm 12.18.0，具体通过项与限制见执行矩阵及本次 CI |
| Node | 26.13.0 为主开发基线；22／24 维护线的最新补丁版也纳入 CI 兼容检查 |
| 项目类型 | 回答、文件与网页；普通文件夹、仓库子目录、Vite、非 Vite Node 项目和静态网页。按内容比较不代表执行了任意语言的测试。包管理器的完整通过项与已知限制见[执行矩阵](docs/package-managers.md) |

<a id="verified-maintained-through-current-ci-and-the-cases-below"></a>

### 已验证（持续更新，以当前 CI 和所列案例为准）

以下案例保留各自的源码与工具版本。1.2.0 的测试脚本使用上方基线，历史运行数字不作为新版重新测量的结果。

最新结果见 [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)。可复现的原生运行检查还在 Windows 上实测了 DSH 0.2.1-rc.5、Node 26.13 和 Vite 8.3.5：相邻文件写入被拒绝、子进程环境被清理、冻结安装、类型检查和构建通过、预览两次启动、取消后停止写入。Windows 如实报告部分约束。

用单独的依赖目录安装官方当前宿主后，可以重复这项检查：

```bash
npm install --prefix .runtime-checks/host-sdk --ignore-scripts --no-audit --no-fund @deepseek-ai/dsh@latest
npm run test:runtime
```

测试宿主依赖目录被忽略，也不会打入插件包。本项使用受控示例，不请求模型。

- 自动化回归（数量和结果以当前 CI 为准），包含真实 git、冻结 npm 安装、构建与预览进程的集成测试（临时路径带空格），以及单元测试和宿主接口契约测试。已建立的回归包括：
  - 候选改写测试脚本：检查「通过」，但结论为不可采用，写入工作区被拒绝，只能另存为分支；
  - 检查失败、构建失败、改依赖不更新锁文件（冻结安装失败，不会退回非冻结安装）、生成超时；
  - 采用写入的内容与验收一致，HEAD 和暂存区不变，预览进程和副本随后被回收；
  - 你在基线后改了其他文件：预演通过则采用并保留你的修改；预演发现组合失败则阻止，一个字节都不写；
  - 与你后来的修改重叠：阻止；
  - 预演或写入日志保存期间的新编辑、并发 HEAD/暂存区变化：写入前阻止；替换、删除或新增路径出现变化时保留用户文件，只回退本次已尝试写入的路径；解决重叠后可重试采用和撤销；
  - 采用中途中断：重启后进入「需要处理」，可以恢复到采用前；
  - 同一仓库的第二个采用在仓库锁被占用时被拒绝；
  - 清理拒绝删除未注册或归属标记不符的目录；
  - 基于过期记录的保存被拒绝；旧版记录只读，不会据此结束进程；
  - 并发启动提前占用名额，初次保存失败可重试，编号冲突保留已有历史；退出时等待准备、候选和采用操作收尾；
  - 全部对话和当前对话分别筛选，65 条实际文件记录均可通过分页找到，读取不修改原始文件；
  - 只有命令行能证明归属的进程才会被结束；
  - 候选会话的创建参数（会话目录 = 副本、沙箱 workspace-write、审批 never）、开始前就收到的停止、真实 token 用量的汇总。
- `node scripts/smoke.mjs`：脚本代替模型，用内置案例真实运行 React 19.3.1、Vite 8.3.5 与 Playwright Chromium 156.0.8078.4。完整实现的一版通过 12/12 步验收；漏做「清空」按钮的一版只通过 9/12 步，被判为不可采用。基线建立后再次编辑笔记文件，采用必须先预演组合结果，并保留更新后的笔记。`--escape B` 时，候选写到副本外的文件被检测出来。
- DSH 0.2.1-rc.5 隔离环境：生产版指令读取界面选择的五分钟上限，创建两个真实候选会话，运行应用并完成审查及采用。刷新并返回普通对话后，本地脚本化适配器在真实主会话请求中读到了采用说明。新建／已有对话的入口均正常，没有页面异常。本项没有请求外部模型。
- 开发与示例依赖审计均为零已知漏洞。`npm run test:coverage` 单独报告后端覆盖率；浏览器和原生宿主集成检查属于其他验证层，不计入这个百分比。
- 浏览器断言覆盖输入框设置、设置持久化、多条记录的独立操作、两个可交互预览、空白会话导航与重新打开、代码审查、采用确认、返回输入框的焦点、响应式状态及弹窗键盘操作。历史导航包含 72 条样例的分页、搜索、慢响应、旧服务端提示、错误重试和需处理记录筛选。浅色／深色界面状态通过 WCAG 2 A/AA 和 2.1 AA 自动规则检查。此项使用明确标记的示例记录。

- 真实模型（DSH 0.2.1-rc.3 桌面版，deepseek-flash，内置案例）：两个候选会话的头部记录 `cwd` 分别是各自的副本，`sandbox/mode` 为 `workspace-write`、`approval/policy` 为 `never`；候选里的 `pwsh` 正常执行（0.1 的 `SetNamedSecurityInfoW` 错误不再出现）；token 用量来自会话日志。两个候选都在 30 分钟上限内没有说完成——其中一个已写完全部改动，事后对它的副本跑共同验收：冻结安装、类型检查、构建和 12/12 步页面验收全部通过。0.2.0-alpha.2 因此改为到时照样验收已写的改动。

- 真实模型完整一轮（DSH 0.2.1-rc.3 桌面版，deepseek-flash，同一模型两种策略，60 分钟上限）：两版各用约 42 分钟生成，token 用量约 264 万和 294 万；两版都通过类型检查、构建和页面验收；选择 B 后采用到工作区，写入 `src/App.tsx` 和 `src/styles.css`，未提交、index 和 HEAD 未改动。
- 对话内运行（DSH 0.2.1-rc.3 运行时，测试 profile）：`/ab` 出现在指令菜单；输入框的 A|B 按钮把草稿变成 `/ab …`，发送后按指令执行；会话日志里记录 `command/run`（`ab` 及参数）和 `command/done`（含运行编号）；生成结束时，一条说明结果的消息写入该对话，供模型下一步读取；输入框按钮、指令卡片、工具卡片、标题栏按钮的注册全部被宿主接受。
- 打包安装后的界面检查（DSH 0.2.1-rc.3 Web UI，隔离 profile）：原输入框的图形化提交、两份真实 Vite 预览中的搜索与清空、选择、采用审查及工作区写入、结果说明写入持久会话并进入下一步消息队列、刷新后恢复已采用记录，以及退出比较模式后继续普通对话。本项使用固定的脚本化候选，没有请求模型。

<a id="not-verified-yet"></a>

### 尚未验证（不要当成已支持）

- 更新后桌面壳的最终显示效果，以及最新版宿主中由外部模型完成「采用后接着提下一项需求」的完整体验。采用说明进入请求上下文已通过本地脚本化适配器检查。
- 历史 Windows 案例记录到较长工具调用和轮间等待，一轮比较可能超过 30 分钟。各阶段开销尚未定位，不能据此归因为某个插件或服务；最新版仍需要真实外部模型的性能测量。
- 原生 Safari 的完整平台组合与各浏览器的隐私模式。自动化 WebKit 检查不能代替原生 Safari 验收；当前 Safari 平台结果与限制见 #115。已验证的候选状态分离仍受嵌入 Cookie 和外部标签页的浏览器策略管理，不构成完整浏览器安全边界。
- 两个模型模式下各家 provider 的实际表现。

<a id="known-limitations"></a>

### 已知限制

- 回答和文件按内容比较。实时预览和页面验收需要可运行的网页项目；其它语言的测试只在基线的 package 脚本里运行时才会执行。
- 非 Git 目录里，各版从空白目录开始，不会读入已有文件。要修改已有文件，请先在设置条里「在此目录启用 Git」；用户主目录、磁盘根目录、系统目录，以及超过 5,000 个文件或 300 MB 的目录不能启用。
- 每版分别消耗模型用量，并占用独立副本、依赖和可能的预览资源；符合条件的 npm 项目可复用预装结果的独立副本。总用量由模型、任务和版本数共同决定，不能简单等同于单版的固定倍数；依赖较重的项目也更占磁盘和内存。
- 1.3.0 及更早的版本读到 3–4 版的比较记录时，会把它列为「需处理」，不会据此操作；升级后可正常查看。
- npm 12 的安装脚本策略可能拦截依赖脚本；需要原生安装步骤的项目须先按项目自身策略允许相关脚本。
- 单次比较的结果不代表模型或风格的整体优劣。

<a id="development"></a>

### 开发

使用 Node 26.13.0（`.nvmrc`）与 npm 12.2.2。编译和测试基线为 TypeScript 7、React 19.3、Vitest 5；分发的客户端复用 DSH 提供的 React 运行时。

```bash
npm ci && npm run typecheck && npm test
```

```bash
npx playwright-core install --only-shell chromium
npm run test:ui
npm run test:coverage
npm run smoke
```

```bash
node scripts/preview-ui.mjs
```

贡献方式见 [CONTRIBUTING.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md)，版本变化见 [CHANGELOG.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md)。

<a id="whats-new"></a>

## 版本更新

**3.3.1** · 程序化查询比较状态时可读取尚未生成结果的候选。输入框忙碌时，使用教程会保留草稿并提示重试。

**3.3.0** · 新增风格小样、候选阶段表情、逐行改动审阅和按日期分组的历史。

**3.2.1** · 网页文字验收会等候最多 5 秒，让点击后的反馈有时间显示。积压的比较结果按更新时间先后写回原对话，每个对话步骤最多 5 条。

**3.2.0** · 手机设置改为分层展示，桌面可切换实时网页对齐。八种语言的指南都可从演示直接转到安装与第一次比较。

<details>
<summary>展开 3.1.1 与较早版本的变化</summary>

**3.1.1：** 中文兼容地址同步完整指南；发布前检查 npm 从实际安装包选取的说明正文，避免官网只出现章节目录。此补丁不改变比较和采用行为。


**3.1.0 新增：**
- **实时查看步骤，结束后也能回看。** 每版一开始工作，卡片上就有「过程」按钮，按顺序展示模型与宿主提供的思考、工具调用和中间回复；运行中，最新三步还会在鲸鱼下方实时滚动。长记录保留最初 40 条与最近 280 条，省略或截断会明确标注；盲选时点明风格的词显示为 ▒▒。
- **回复直接显示。** 只回答的版本只显示回答；做了网页或文件的版本，回复和成品同等显示：并排时回复在页面上方，专注某一版时回复在左、页面在右。一版结束，回复立刻出现，不必等页面。
- **网页直接显示。** 静态网页由插件自己提供，不再依赖单独的进程（桌面版曾在它响应前将其终止）；预览就绪即可操作，HTML 文件结果也可在沙盒页面中查看，并一键切换源码。
- **更快看到成品。** 一版的处理回合结束且没有后续排队消息后就开始确认完成，无需等待其他插件放开整条会话；在记录的测试宿主中约需 0.35–0.6 秒，旧后台的桌面案例为 41–44 秒。符合条件的 npm 项目可在生成期间冻结预装，清单未变的版本获得独立副本；其余版本按各自条件正常安装；检查命令并行执行，页面一启动就能操作。在固定候选的录制环境中，四版 Vite 页面从发送到全部可用约 24–30 秒；这些数字不代表所有模型和机器的耗时。
- **等待也有趣。** 每版显示 DeepSeek 的蓝色鲸鱼标志：开始是浅蓝的轮廓，随进度注入蓝色的水，越接近完成越满，两道光沿轮廓奔跑；头上不时冒出想法气泡（在做什么、灵感，或者邀你戳一戳）；每走一步喷一下水，鲸鱼会朝鼠标转身，连戳会跳起、转圈、晕头、溅水花，每次都有新台词。运行中的比较有两颗彗星绕着边框奔跑（较旧内核也有兼容路径，开启减弱动态效果时保持静止），背景是缓慢流动、彼此交融的蓝色光。
- **A–D 四种蓝。** 版本标签改为四种不同的蓝色。
- **更新后提醒重启。** DSH 会立刻换上插件的新界面，但后台仍是启动时加载的版本；两者不一致时，AgentCompare 会提醒你完全退出并重新打开 DSH，而不是悄悄缺少过程和回复。
- **有了中文名。** 正式中文名「鲸挑细选」，昵称「大肥鱼赛马」。
- **同时包含 2.1.0（未单独发布）的改进：** 支持直接比较问候与问答回复，无需每次生成网页；更亮更通透的液态玻璃、更轻的按钮、会滑动的控件；浅色和深色下，所测 21 个界面状态逐字核对，所有文字对比度不低于 4.5:1。

**2.0.0 新增：**
- **全新蓝色液态玻璃界面。** 极光与星尘背景、玻璃面板、会滑动的玻璃选择器、液体进度球；选中时光粒迸发，揭晓时光束扫过。深色模式、减弱动效与高对比模式都已适配。
- **说出为什么选。** 选完点几个理由（布局、配色与质感、交互手感……）或补一句话；主对话接着修改时会保留这些优点。
- **快速组合。** 一键设好版本数和风格：经典对照、三种视觉、三种取舍、四向探索。
- **2–4 版，按风格比较。** 八种预设或一句话自定义；也可让不同模型使用同一风格。
- **盲选或公开对比。** 逐版体验，暂时排除后可恢复，用 1–4 专注、0 回到全部。
- **回答、文件、网页都可看。** Markdown 排版，复制回答、代码、文件内容和保存路径；明确标记你的选择。
- **留在主对话。** 比较、选择、采用与撤销写入当前对话记忆；继续交流时可接着修改。
- **Desktop + Web，中英双语。** 沿用已配置模型；有改动时先审查，再确认采用，并保留撤销与恢复入口。

1.3.0 起，普通文件夹、项目子目录、非 Vite 的 Node 项目、静态网页都能比较，回答和文件也能比较。范围与限制见[更新记录](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md#200)。

</details>

<details>
<summary>名字的由来</summary>

**鲸挑细选**，取「精挑细选」的谐音：一个需求，让 2–4 条 DeepSeek 蓝鲸同时开工，跑完再挑最好的那版。昵称 **「大肥鱼赛马」**：网友管 DeepSeek 的蓝鲸叫「大肥鱼」，这里就是几条大肥鱼在同一条赛道上比，谁做得好，你说了算。

</details>

<a id="license"></a>

## 许可证

MIT

<!-- project-growth:start -->

## 项目增长

**维护公告：** 据项目维护方确认，11 月 11 日（UTC）因版本维护、优化与已知问题修复，临时从大部分插件市场下架，当日下载请求量受到分发渠道收缩影响。 [维护与市场分发说明](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/maintenance-update-2026-11-11.md).

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-light.svg" width="960" alt="AgentCompare · Total npm download requests since first publication">
</picture>
</a>

以下为本包首次发布以来、全部公开版本的累计 npm 下载请求。统计截止日标在图中；请求量可能包含重复与自动化访问。

[累计统计口径与自动刷新](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md)

Star 徽章读取 GitHub，缓存约 5 分钟。npm 累计数每天北京时间 19:00 刷新；实际执行可能因排队延迟。

<!-- project-growth:end -->

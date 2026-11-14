[![AgentCompare 2.0：在主对话里比较 2–4 版回答、文件与网页。Desktop + Web，中英双语，选择后继续对话 / Compare 2–4 answers, files and live pages in the main conversation. Styles, blind or open comparison, reasons for the pick, reviewed adoption and conversation memory, in a blue liquid-glass interface. Product illustration.](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp)](#install)

# AgentCompare

[![GitHub stars](https://img.shields.io/github/stars/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=GitHub%20Stars&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers)
[![npm download/下载量](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-badge.svg)](https://www.npmjs.com/package/dsh-agent-compare)

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=3657f5&style=flat&labelColor=0b1b4f&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=0b1b4f&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · **日本語** · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · [Deutsch](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.de.md)

**同じ依頼を、動く 2〜4 の実装へ。スタイルを選び、ブラインドか公開で比べて採用。**

**DSH 桌面端 + 浏览器 / Desktop + Web**

<p align="center"><a href="#install">安装 / Install</a> · <a href="#demo">真实演示 / Recorded demo</a></p>

> **2.0.0 · 正式版。** DSH Desktop と Web、中国語・英語の画面に対応。どのフォルダーからでも、メイン会話内で回答・ファイル・Web ページを比較できます。設定済みモデルを再利用します。

**2.0.0 の新機能：** 一度に **2〜4 バージョン**を比較できます。各バージョンに**スタイル**を指定できます（変更の幅：堅実・大胆／見た目：ミニマル・洗練・活発／優先：使いやすさ・厳密・軽快、または一行の自由記述）。**ブラインド**（選択後に公開）と**公開比較**（最初から表示）を選べます。3〜4 バージョンでは不要な版を**外して**残りを並べて比べられ、カード内で 1〜4 キーを押すとその版に集中できます。
- **青いリキッドグラスの新しい UI。** オーロラと星屑の背景、ガラスのパネル、選択肢の間を滑るガラスのレンズ、液体の進捗表示。選んだ瞬間に光の粒がはじけ、公開時には光が走ります。ダークモード、視差効果を減らす設定、ハイコントラストに対応。
- **選んだ理由を伝える。** 選択後に理由（レイアウト、配色と質感、操作感など）を選ぶか一言添えると、主会話での後続の修正がその長所を保ちます。
- **クイックセット。** バージョン数とスタイルをワンタップで設定：定番の対比、3 つの見た目、3 つの優先、4 方向の探索。
- **2〜4 版をスタイルで比較。** 8 種のプリセットか一行のカスタム指定。異なるモデルで同じスタイルも使えます。
- **ブラインドか公開比較。** 各版を試し、一時除外して復元。1〜4 で集中表示、0 で全版に戻れます。
- **回答・ファイル・実行ページ。** Markdown を読み、回答・コード・内容・保存先をコピー。選んだ版が明確に表示されます。
- **主会話で続ける。** 比較・選択・採用・取り消しが現在の会話メモリに残り、そのまま修正を続けられます。
- **Desktop + Web、中国語・英語 UI。** 設定済みモデルを再利用。変更を確認してから採用し、取り消し・復元も行えます。

AgentCompare は [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）のプラグインです。一つの課題から独立した 2〜4 の実装を作り、依存関係のインストール、ビルド、共通の検証を実行します。実際のページを操作して、いずれかを選ぶか「どれも選ばない」を選択できます。ブラインド比較では、選択後にモデルとスタイルが公開されます。採用前には、現在のプロジェクトと組み合わせた状態を検証します。

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [Plugin directories and installation](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [Listing status / 收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

[![设定 2–4 版与风格，并行实跑，体验后选择并说明理由，审查并继续主对话 / Set up, run, choose and say why, review and continue. Answers, files, live pages and conversation memory. Product illustration.](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)

<p align="center"><sub>功能示意 / Product illustrations · <a href="#demo">查看真实演示 / Watch the recorded workflow</a></sub></p>

<a id="gallery"></a>

## 最新の画面を見る

実際の DSH で固定候補を比較した画面です。主画像とフロー図は機能のイメージです。

<details>
<summary>Open four interface views / 展开实际界面</summary>

![四版页面直接操作 / Four independently interactive pages; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)

![主对话内比较、选择与继续 / Compare, choose and continue in the conversation; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)

![版本、风格与上下文 / Versions, styles and context; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)

![英文回答并排比较 / Compare English answers; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/06-english-answers.png)

</details>

[全8枚の画像と撮影条件](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/storefront-gallery.md)

<a id="demo"></a>

## 操作の流れを見る

[![4 つのポモドーロページを同時に実行し、2 つを外して C を選び、スタイルを公開する固定候補の例](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/docs/media/comparison-preview.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

実際の DSH ホストで録画した固定候補の実演です（2.0.0 リリース候補のソース、画面は中国語）。通常のフォルダーで 4 つのバージョンがそれぞれポモドーロのページを作り、4 つのライブページをそのまま操作できます。2 つを外して残りを並べ、選択後に各スタイルを公開し、新しいフォルダーに保存して会話を続けます。待機部分は省略し、それ以外は等速です。ローカルパスは非表示です。

選択後に理由（レイアウト、よりシンプル）を 2 つ選ぶと、主会話の次のリクエストに伝わります。

[動画全編（13秒）](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [条件と結果](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<details>
<summary>English answers · 390 px</summary>

<p align="center"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp" width="840" alt="Three open English answers from the Three looks quick set: B is the pick, with Layout and More complete as its reasons; controlled candidates in a real DSH host."> <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp" width="260" alt="390-pixel English answer result in the blue glass interface, with the chosen version and a visible Continue conversation action; controlled candidates in a real DSH host."></p>

</details>

<a id="install"></a>

## インストール

画面言語は簡体字中国語と英語です。DSH Desktop と Web で切り替えられます。

以下のコマンドは自分で起動する DSH Web 用です。デスクトップ版の `desktop` プロファイルはアプリが管理するため、アプリのプラグイン画面を利用してください。

Node 26.13.0 と npm 12.2.2 が開発基準です。公式の最新 DSH パッケージ 0.2.1-rc.5 で動作確認しています。既存の DSH プロファイル名を確認してください。

npm パッケージを既定の Web プロファイルに追加します。公開状態は上部の npm バッジで確認できます。

```bash
dsh plugin --profile web add dsh-agent-compare@2.0.0
```

別の自己管理プロファイルを使う場合は、`web` を実際の名前に置き換えてください。

ソースからビルドして導入することもできます。

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
cd dsh-agent-compare
npm ci
npm pack
```

`<your-profile>` を実際に使っているプロファイル名に置き換えます。

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-2.0.0.tgz
```

DSH を再起動します。同じ記録を使う古いプラグインの実行は、更新前に終了してください。旧版と新版による同時変更はサポートしません。

## 最初の比較

1. 会話の入力欄左下にある **A|B** をクリックします。設定は入力欄の上に表示されます。
2. 既定は「同じモデル、二つの戦略」です。現在のモデル設定を再利用するため、二つ目のモデル用アカウントは不要です。「二つのモデル」を選ぶ場合も、DSH に設定済みのモデルから選択します。
3. 各実装の生成上限を画面で選びます。5～120 分、既定は 30 分です。依頼文だけを通常の入力欄に書いて送信します。オプションの手入力は不要です。
4. 会話内のカードで進捗と二つの実行ページを確認します。デスクトップ／スマートフォン表示、A または B への集中表示、拡大画面を利用できます。
5. `选 A`、`选 B`、`都不满意` で選択します。選択後に実際のモデルまたは戦略、検証結果、取得できた使用量が表示されます。
6. 採用する場合は `审查并采用` から対象リポジトリと事前確認を読み、別の確認操作で反映します。`继续主对话` で通常の会話へ戻れます。

`试跑内置示例` は別のサンプル商店リポジトリを作成します。あなたのプロジェクトには触れず、採用先もそのサンプルです。右上の `比较记录` と `使用教程` は、新規会話と既存会話の両方から利用できます。

## 向いている課題

検索・絞り込み、フォーム、ランディングページ、ダッシュボード、コンポーネントの再設計など、操作して品質を比較したい課題に向いています。答えが明確な不具合修正や機械的なリファクタリングは、単一のエージェントとテストのほうが適しています。

同じモデルでは「既存構造を活かす」と「操作方法を見直す」という二つの戦略を使います。二つのモデルでは同じ依頼と指示を使います。いずれも同じコード基準点と共通の検証を利用します。一度の比較は、モデル全体の順位を意味しません。

## 検証とコードの状態

Git リポジトリでは、コミットがまだなくても、未コミット・未追跡の内容を除外対象を除いて専用 index でスナップショット化します。Git 管理外のフォルダーでは、二つの実装はプラグイン専用の空の作業領域から始まり、選んだ結果はそのフォルダー内の新しいサブフォルダーに保存できます。元の HEAD と index を変更せず、各実装は個別の worktree とセッションを使います。差分はハッシュ付きのバイナリパッチとして保存されます。

基準点の `typecheck`、`lint`、`test`、`build` と、設定されたページ検証を両方に適用します。ロックファイルがあれば固定インストールを行い、失敗時に非固定インストールへ切り替えません。検証スクリプトや設定を変更して自分だけを合格にすることは、直接採用の根拠になりません。

根にある [`.agent-compare.json` の実例](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json)で、入力、クリック、表示件数、文字列、画面幅などを共通条件として追加できます。定義は生成前に検証・固定されます。明示したページ受け入れ条件が未実行なら直接採用できません。基本的なページ読み込み確認だけが実行できなかった場合は、未検証の警告が表示されます。ビルド成功、ページ表示、要件達成、個人の好みは別の結果です。

## 採用・取り消し・復旧

採用では現在のプロジェクトと選択した差分を組み合わせます。変更箇所が重複する場合は停止します。他のファイルを編集していた場合は、一時コピーで組み合わせを再検証します。書き込み前には HEAD、index、対象内容を再確認し、復旧記録を保存します。

作業ツリーへの採用は、自動コミット、push、ブランチ切り替えを行いません。バイナリ、新規作成、削除も差分に含まれます。検証を満たさない実装は、確認用ブランチとして保存できます。取り消しや中断からの復旧では、その後の編集を検出すると競合として残します。

リポジトリロックはプラグイン同士を調整するもので、外部エディターをロックしません。実際の書き込み中は編集を一時停止してください。

## 履歴と実行環境

履歴は全会話を既定表示し、現在の会話、検索、30 件単位のページ送りに対応します。結果・選択・採用の説明は会話へ届けられ、会話が利用できない場合は再試行されます。長いログをすべて主会話へ入れません。破損した記録や旧形式は理由付きの読み取り専用として保持します。

再起動後は停止したプレビューと保存済みスクリーンショットを区別します。コピーが残っていればプレビューを再開できます。スクリーンショットは静的記録であり、実行中のページではありません。各起動には新しい `.localhost` アドレスを使い、実装間の Cookie とオリジンストレージを分けます。再開時にページ内の一時状態はリセットされますが、比較記録と画像は残ります。

worktree は完全な安全サンドボックスではありません。DSH の書き込み制約を使い、Windows の制約は **partial** として表示します。読み取りとネットワークは隔離しません。埋め込みページの Cookie はブラウザーの制限を受け、外部タブでは保存領域が異なる場合があります。ログイン、外部バックエンド、共有データベースは現在の対象外です。

## 時間・費用・確認済みの範囲

二つの実装にはそれぞれ生成コストがかかり、並列化が必ず安く、速くなるとは限りません。一方または両方を停止できます。上限時には、すでに書いた変更を検証します。使用量が返らない場合は「不明」であり、ゼロとは表示しません。

Windows・Linux・macOS のネイティブ検証を実行します。npm・pnpm・Yarn の検証済み構成と Windows／PnP の制約は[互換性一覧](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility)に分けて記載しています。ネイティブ Safari は別の検証対象です。固定応答によるテストは外部モデルの生成品質や所要時間の測定ではありません。

## フィードバックと開発

[Issue](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues)には DSH／プラグインの版、OS、再現手順、期待と実際の結果を記載してください。認証情報、非公開コード、完全なローカルパスは公開しないでください。[貢献ガイド](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md)と[変更履歴](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md)も確認できます。

```bash
npm ci
npm run typecheck
npm test
npm run test:ui
```

## ライセンス

[MIT](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)。比較結果が役立った場合は、リポジトリへの Star や再現可能な事例で支援できます。Star や共有は任意です。

<!-- project-growth:start -->

## プロジェクトの推移

**メンテナンスのお知らせ：** 運営者によると、11 月 11 日（UTC）の保守・改善・修正に伴い、多くのプラグイン市場から一時的に公開を取り下げ、当日の配布とリクエストが減少しました。 [保守と配布のお知らせ（英語）](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/maintenance-update-2026-11-11.en.md).

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-light.svg" width="960" alt="AgentCompare · Total npm download requests since first publication">
</picture>
</a>

初回公開から全公開バージョンを対象とした npm 累計ダウンロードリクエストです。集計終了日は画像に記載。重複・自動アクセスを含む場合があります。

[累計の定義と自動更新](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md)

<!-- project-growth:end -->

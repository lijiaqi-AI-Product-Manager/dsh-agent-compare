[![鲸挑细选：同じアイデアから生まれた4種類のタイマー。赤いトマトの C を選択。機能イメージ。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp)](#demo)

<div align="center">

<a id="agentcompare"></a>
<a id="agent-compare-dsh-agent-compare--鲸挑细选"></a>

# AgentCompare · 鲸挑细选

[![GitHub スター数 · 535](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/github-stars.svg)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers)
[![npm の累計ダウンロードリクエスト数 · 378,029](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-highlight.svg)](https://www.npmjs.com/package/dsh-agent-compare)
[![DSH Market · ワークフロー DL 1位](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dsh-market-workflow-download.svg)](https://dshmarket.com/categories/workflow/)

[![dsh.so · 週間 DL 5位](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dshso-weekly-download-rank.svg)](https://www.dsh.so/artifact/dsh-agent-compare/)
[![dsh.so · 週間 Star 増加 19位](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/dshso-weekly-stars.svg)](https://www.dsh.so/artifact/dsh-agent-compare/)

[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=3657f5&style=flat&labelColor=0b1b4f&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)
[![Tested on DSH 0.2.1-rc.5 and 0.2.2-rc.1](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5%20%2F%200.2.2--rc.1-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<sub><a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md">集計方法とランキングの出典</a></sub>

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · **日本語** · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · [Deutsch](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.de.md)

**ひとつのアイデアから、もっと多彩な実現方法へ！**

**鲸挑细选 · AgentCompare** は [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）用の比較プラグインです。インストール名は `dsh-agent-compare`。主会話で一度依頼し、2〜4 通りの回答・ファイル・実行可能なページを比べて、自分の考えに合うものを選べます。**DSH Desktop + Web** に対応し、製品 UI は中国語と英語を切り替えられます。

<p align="center"><a href="#demo">45秒のデモを見る</a> · <a href="#install">Desktop / Web にインストール</a> · <a href="#support">対応環境を確認</a></p>

<a id="demo"></a>
<a id="大肥鱼赛马を最初から最後まで見る"></a>

</div>

## 比較の流れをデモで見る

[![実ホストの固定候補：クジラと手順、4ページ、理由付きの選択、保存と会話の続行。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/1edf6ec2d1be76a45ef3827795be7ceaafc982c9/assets/readme/comparison-quicklook.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

実際の DSH ホストで、固定候補を使って録画しています。クジラとリアルタイムの手順、ページ操作、理由を添えた C の選択、保存と主会話への復帰を示します。待ち時間を編集し、残りは等速です。

[動画全体 · 45 秒](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [録画条件と結果](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md) · [完全版 GIF](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-preview.gif)

以下は、固定候補を実際の DSH ホストで動かした画面と動画です。実際の操作を示しており、外部モデルの品質や速度の測定とは区別しています。

[![実画面：4つの操作可能なページと各回答・手順。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)

4 つのページを直接操作でき、回答もページと同じように表示されます。「Steps」からホストが提供する思考やツール呼び出しを確認できます。

<details>
<summary>比較の4ステップ</summary>

[![2〜4版とスタイルを設定し、実行、体験と選択、確認して続行。機能イメージ。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)

版とスタイルを設定 → 並列実行 → 体験して選択 → 確認して続行。下図は機能イメージです。

</details>

<a id="install"></a>

## インストール

### DSH Desktop

1. アプリの **Plugins → Add plugin** で `dsh-agent-compare` をインストールします。
2. **Plugins → Installed** で AgentCompare が有効になっていることを確認し、DSH を完全に終了してから開き直します。
3. 主会話の入力欄左下にある **A|B** を押し、版数とスタイルを選んで依頼を送ります。

### 自分で実行する DSH Web

画面言語は簡体字中国語と英語です。DSH Desktop と Web で切り替えられます。

以下のコマンドは自分で起動する DSH Web 用です。デスクトップ版の `desktop` プロファイルはアプリが管理するため、アプリのプラグイン画面を利用してください。

Node 26.13.0 と npm 12.2.2 が開発基準です。DSH パッケージ 0.2.1-rc.5 / 0.2.2-rc.1 で動作確認しています。既存の DSH プロファイル名を確認してください。

npm パッケージを既定の Web プロファイルに追加します。公開状態は上部の npm バッジで確認できます。

```bash
dsh plugin --profile web add dsh-agent-compare
```

別の自己管理プロファイルを使う場合は、`web` を実際の名前に置き換えてください。

**更新後は完全に再起動してください。** DSH Desktop を完全に終了してから開き直します。Web では対象の DSH サービスを再起動し、ページを再読み込みしてください。画面の再読み込みだけでは古いバックエンドが残ることがあり、バージョンの不一致は画面で通知されます。

<details>
<summary>ソースからビルドしてインストール</summary>

ソースからビルドして導入することもできます。

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
cd dsh-agent-compare
npm ci
npm pack
```

次のコマンドはアーカイブを Web プロファイル `web` にインストールします。

```bash
dsh plugin --profile web add ./dsh-agent-compare-3.3.1.tgz
```

</details>

DSH を再起動します。同じ記録を使う古いプラグインの実行は、更新前に終了してください。旧版と新版による同時変更はサポートしません。

<a id="use"></a>
<a id="最初の比較"></a>

## 最初の比較

1. 入力欄左下の **A|B** をクリックすると、入力欄の上に比較設定が開きます。
2. 2〜4 バージョンを選びます。既定は同じモデルで異なるスタイル。現在のモデルを再利用し、各バージョンのスタイルや一行の独自指示を設定できます。異なるモデルを使う場合も、DSH に設定済みのものから選びます。
3. ブラインド／公開比較、各バージョンの生成上限（5〜120 分）、共有する会話の文脈を選び、いつもの入力欄から依頼を送ります。
4. カードで進行状況と、回答・ファイル・ページの結果を確認します。実行中のページは操作でき、デスクトップ／スマホ幅、1〜4 キーでの集中表示、0 キーでの全体表示に切り替えられます。3〜4 版では不要な版を一時的に外せます。
5. 採用したい版を「Choose A」などで選ぶか、「None of these」でどれも選ばないことができます。ブラインド比較は選択後にモデルとスタイルを公開します。公開比較では最初から見えます。
6. プロジェクトの変更は「Review and adopt」で検証結果と差分を確認し、別の確認操作で反映します。Git 外のフォルダーでは新しいフォルダーに保存できます。回答だけならファイル反映は不要です。「Continue conversation」で主会話に戻り、選択の記録を引き継ぎます。

`试跑内置示例` は別のサンプル商店リポジトリを作成します。あなたのプロジェクトには触れず、採用先もそのサンプルです。右上の `比较记录` と `使用教程` は、新規会話と既存会話の両方から利用できます。

会話の文脈は、共有なし・最近のやり取り・手動選択から選べます。既定は最近 3 往復で、送る抜粋を事前に確認できます。長すぎる内容は上限で切り詰め、画面に明示します。全版へ同じ抜粋を渡し、選択理由と結果は元の会話に引き継ぎます。

<a id="ui"></a>
<a id="gallery"></a>

## 画面と体験

スマートフォンでは比較方法、版数、ブラインド比較の有無を選び、プロジェクトと各版に渡す会話を確認して、そのままメインの入力欄に依頼を書けます。スタイル、制限時間、サンプルは「More settings」から変更できます。以前の比較に戻って設定を開くと結果は折りたたまれます。再び開いたときもページの入力内容と依頼の下書きが残ります。

高さの低いウィンドウでは設定欄だけをスクロールでき、入力欄と送信ボタンは画面内に残ります。横長の小さな画面では「Expand settings」で設定を開きます。

依頼文に `/ab` のオプション名を含めるには、本文の前に `--` を置きます。たとえば `/ab --versions 2 -- オプション --example の使い方を説明して` と入力すると、2通りの説明が生成されます。

横並びのライブページは、広い画面で「Align pages」を押すと同じ高さから表示されます。もう一度押すと元の配置に戻り、ページに入力した内容も残ります。

スマートフォンでは見本を見ながら各案のスタイルを選べます。デスクトップでは手順を開くと各案の直近の作業が分かります。ブラインド比較でモデルとスタイルが明かされるのは選択後です。適用前にファイルごとの変更を行番号付きで確認できます。

<details>
<summary>3.3.0 の画面を見る</summary>

![スマートフォンの比較設定と会話入力欄](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/composer-mobile.webp)

![デスクトップのファイル一覧と行ごとの差分](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/patch-review.webp)

![ダークモードの4ステップガイド](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/ui-3.3/guide-dark.webp)

</details>

- **青いリキッドガラス。** 設定、候補、レビューを濃淡の異なる面で区別します。モーションを減らす設定では、選択と結果の表示がすぐに切り替わります。
- **太っちょ魚が付き添います。** バージョンごとに DeepSeek の青いクジラが 1 頭。進むにつれて青い水が満ち、2 つの光が輪郭を走ります。頭の上に考えごとが浮かび、つつくと返事をし、続けてつつくと回ったり、ふらついたり、水しぶきを上げたりします。
- **直近の作業から確認。** 生成中のカード上部に最新の作業が表示されます。手順を開くと、記録された思考、ツール呼び出し、所要時間を確認できます。
- **返信と成果物を同じ重みで。** 回答だけなら回答だけ、ページがあれば返信と並べて表示し、1 つに絞ると返信が左、ページが右に並びます。
- **A〜D を見分けやすく。** A はコバルト、B は空色、C は紫、D は青緑。どの色にも文字を併記します。
- **動いているのがひと目でわかる。** 実行中の比較の周りを 2 つの彗星が走り、ページは起動した瞬間から操作できます。
- **デスクトップ・ブラウザー・スマホ幅**に対応し、中国語と英語の画面を切り替えられます。

ステップに表示されるのは、モデルとホストが提供した情報です。長い記録は先頭と末尾を保持し、省略を明示します。ブラインド選択前はスタイル名を伏せます。クジラの水位は処理段階を表し、品質評価や正確な進捗率ではありません。

[![実画面の動画：水で満たされるクジラ、吹き出し、連続クリック、リアルタイムの手順。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/whale-closeup.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/whale-closeup.webp)

<p align="center"><sub>クジラのクローズアップ：固定候補。見やすいよう台本モデルは各ステップで 9 秒待ちます。編集あり、それ以外は等速。</sub></p>

[![実画面：選んだページの横に回答を表示し、理由付きで保存。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/05-saved-result.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/05-saved-result.png)

一つに集中すると回答とページが横に並びます。選んだ理由を残し、保存または変更内容を確認して、同じ主会話へ戻れます。

<details>
<summary>その他の実画面：回答、設定、英語 UI、スマートフォン幅</summary>

[![実画面：プロジェクトでの挨拶に4通りの回答。変更もビルドもしない。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)

[![実画面：版数、スタイル、会話コンテキストの設定。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)

[![実際の英語 UI：3つの回答を並べ、B と理由を選択。](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp)

<p align="center"><a href="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp" width="260" alt="390ピクセル幅の実際の英語 UI：回答と会話を続ける操作。"></a></p>

</details>

[その他の実画面：回答、設定、英語 UI、スマートフォン幅](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/storefront-gallery.md)

<a id="tasks"></a>
<a id="向いている課題"></a>

## 向いている課題

| やりたいこと | 比べられるもの |
|---|---|
| 回答・分析・文章 | 切り口や表現を整形表示で並べて読み、ワンクリックでコピー。 |
| スクリプト・文書・その他のファイル | 各版のファイルと回答。選んだ結果を新しいフォルダーへ保存。 |
| ページや UI の変更 | 動くページを操作し、共通検証を確認してから採用。 |

<details>
<summary>モデル・スタイル・課題選択の詳細</summary>

検索・絞り込み、フォーム、ランディングページ、ダッシュボード、コンポーネントの再設計など、操作して品質を比較したい課題に向いています。答えが明確な不具合修正や機械的なリファクタリングは、単一のエージェントとテストのほうが適しています。

同じモデルでは 2〜4 版にそれぞれ異なるスタイルを指定します。8 種のプリセットか一行の独自指示を選べます。異なるモデルでは、DSH に設定済みの 2〜4 モデルに同じ依頼・スタイル・検証条件を与えます。Git プロジェクトでは同じコード基準点から始め、Git 管理外では空のコピーから始めます。一度の選択はモデル全体の順位を意味しません。

</details>

<a id="support"></a>

## 対応範囲と利用上の制限

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=0b1b4f&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)

| ホストと対象 | 検証内容 |
| --- | --- |
| Windows · DSH 0.2.2-rc.2 / rc.3 · Node 26.13.0 · 2026-11-18 | 3.2.0 の Windows ホストテストで依存関係のインストール、コマンド検証、Vite プレビューを確認しました。 |
| Edge 157 · 390 / 1440 px | [サンプル会話を使った Edge の実画面](#ui) |

- ライブページには実行可能な Web プロジェクトが必要です。回答やファイルも比較でき、通常フォルダー・リポジトリ・サブフォルダーの違いはプロジェクトガイドに記載しています。
- 版ごとにモデルの使用量が発生します。時間と費用は課題とモデルによって変わり、並列化が必ず速く、安くなるとは限りません。
- 採用前に確認し、取り消し・復旧記録を残します。作業コピーは完全な仮想マシンではありません。書き込み境界は DSH が提供し、読み取りとネットワークは隔離せず、Windows では実際の制約範囲を表示します。
- Git 管理外では空のコピーから生成し、既存ファイルは読みません。既存内容を変更する場合は、設定欄で先に Git を有効にしてください。結果は新しいサブフォルダーへ保存します。

[プロジェクトと通常フォルダー](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/workspaces-and-projects.md) · [パッケージ管理の検証一覧](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/package-managers.md) · [互換性と Safari の制限](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility)

[掲載ディレクトリと導入](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [掲載申請・審査状況](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

<a id="details"></a>

## 詳しく知る：検証・復旧・高度な設定

### 検証とコードの状態

Git リポジトリでは、コミットがまだなくても、未コミット・未追跡の内容を除外対象を除いて専用 index でスナップショット化します。Git 管理外のフォルダーでは、各バージョンはプラグイン専用の空の作業領域から始まり、選んだ結果はそのフォルダー内の新しいサブフォルダーに保存できます。元の HEAD と index を変更せず、各実装は個別の worktree とセッションを使います。差分はハッシュ付きのバイナリパッチとして保存されます。

基準点の `typecheck`、`lint`、`test`、`build` と、設定されたページ検証をすべてのバージョンに適用します。ロックファイルがあれば固定インストールを行い、失敗時に非固定インストールへ切り替えません。検証スクリプトや設定を変更して自分だけを合格にすることは、直接採用の根拠になりません。

根にある [`.agent-compare.json` の実例](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json)で、入力、クリック、表示件数、文字列、画面幅などを共通条件として追加できます。定義は生成前に検証・固定されます。明示したページ受け入れ条件が未実行なら直接採用できません。基本的なページ読み込み確認だけが実行できなかった場合は、未検証の警告が表示されます。ビルド成功、ページ表示、要件達成、個人の好みは別の結果です。

依存関係の先行インストールは、npm のロックファイルがあり、別のパッケージ管理設定・ルートのインストールスクリプト・ローカル依存がないプロジェクトが対象です。マニフェストが基準点と一致する版にだけ独立したコピーを渡します。対象外・マニフェスト変更・コピー失敗時は、その版で通常のインストールを行い、ロックファイルの検証を緩めません。

### 採用・取り消し・復旧

採用では現在のプロジェクトと選択した差分を組み合わせます。変更箇所が重複する場合は停止します。他のファイルを編集していた場合は、一時コピーで組み合わせを再検証します。書き込み前には HEAD、index、対象内容を再確認し、復旧記録を保存します。

作業ツリーへの採用は、自動コミット、push、ブランチ切り替えを行いません。バイナリ、新規作成、削除も差分に含まれます。検証を満たさない実装は、確認用ブランチとして保存できます。取り消しや中断からの復旧では、その後の編集を検出すると競合として残します。

リポジトリロックはプラグイン同士を調整するもので、外部エディターをロックしません。実際の書き込み中は編集を一時停止してください。

### 履歴と実行環境

履歴は全会話を既定表示し、現在の会話、検索、30 件単位のページ送りに対応します。結果・選択・採用の説明は会話へ届けられ、会話が利用できない場合は再試行されます。長いログをすべて主会話へ入れません。破損した記録や旧形式は理由付きの読み取り専用として保持します。

再起動後は停止したプレビューと保存済みスクリーンショットを区別します。コピーが残っていればプレビューを再開できます。スクリーンショットは静的記録であり、実行中のページではありません。各起動には新しい `.localhost` アドレスを使い、実装間の Cookie とオリジンストレージを分けます。再開時にページ内の一時状態はリセットされますが、比較記録と画像は残ります。

worktree は完全な安全サンドボックスではありません。DSH の書き込み制約を使い、Windows の制約は **partial** として表示します。読み取りとネットワークは隔離しません。埋め込みページの Cookie はブラウザーの制限を受け、外部タブでは保存領域が異なる場合があります。ログイン、外部バックエンド、共有データベースは現在の対象外です。

### 時間・費用・確認済みの範囲

各バージョンに生成コストがかかり、並列化が必ず安く、速くなるとは限りません。各バージョンまたは比較全体を停止できます。上限時には、すでに書いた変更を検証します。使用量が返らない場合は「不明」であり、ゼロとは表示しません。

Windows・Linux・macOS のネイティブ検証を実行します。npm・pnpm・Yarn の検証済み構成と Windows／PnP の制約は[互換性一覧](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility)に分けて記載しています。ネイティブ Safari は別の検証対象です。固定応答によるテストは外部モデルの生成品質や所要時間の測定ではありません。

### フィードバックと開発

[Issue](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues)には DSH／プラグインの版、OS、再現手順、期待と実際の結果を記載してください。認証情報、非公開コード、完全なローカルパスは公開しないでください。[貢献ガイド](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md)と[変更履歴](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md)も確認できます。

```bash
npm ci
npm run typecheck
npm test
npm run test:ui
```

<a id="whats-new"></a>

## 更新内容

**3.3.1** · 候補の結果を待っている間も、ツールから比較状況を取得できます。入力欄が使用中のときは、下書きとガイドを開いたまま再試行できます。

**3.3.0** · スタイル見本、段階別の表情、行単位の変更確認、日付別の履歴を追加しました。

**3.2.1** · ページの文字検証は、操作後の表示を最大5秒待ちます。未反映の比較結果は更新の古い順に、会話の1ステップにつき最大5件ずつ元の会話に反映されます。

**3.2.0** · スマートフォンの設定を整理し、広い画面にライブページの位置合わせを追加しました。8言語すべてのガイドで、デモからインストールと最初の比較へ進めます。

<details>
<summary>3.1.1 と過去の版の変更</summary>

**3.1.1：** 中国語の互換 URL に完全なガイドを同期します。公開前に npm が実際のアーカイブから選ぶ README を検証し、章一覧だけが紹介ページになるのを防ぎます。比較・採用の動作は変わりません。


**3.1.0 の新機能：**
- **すべてのステップを、実行中も終わった後も。** バージョンが作業を始めると、カードに「Steps」ボタンが現れます。開くと作業が順に並びます。所要時間つきの思考、ツール呼び出し（ファイルの読み取り・編集・コマンド実行など。開くと入力と出力を確認できます）、途中で書いた言葉です。作業中は最新の 3 ステップがクジラの下でリアルタイムに流れ、終わった後もすべてのステップをワンクリックで見返せます。ブラインド比較ではスタイルを示す語が ▒▒ になります。
- **返信をそのまま表示。** 回答だけのバージョンは回答だけを表示します。ページやファイルを作ったバージョンは、返信を成果物と同じ重みで表示します。並べて比較するときはページの上に、1 つに絞ったときはページの左に表示します。返信はバージョンが終わった時点で、ページより先に表示されます。
- **ページをそのまま表示。** 静的なページはプラグイン自身が配信するため、書き終えた時点で操作でき、デスクトップアプリに止められる別プロセスもありません。それでも配信できない場合は、HTML の成果物をそのままページとして表示し、ソースはワンクリックで切り替えられます。
- **成果物がより早く。** 各版のターンが終わり、待機中のメッセージがなくなると完了の確認を始め、ほかのプラグインによるセッションの解放を待ちません。記録したテスト宿主では 0.35〜0.6 秒、旧バックエンドのデスクトップ事例では 41〜44 秒でした。条件を満たす npm プロジェクトでは生成中に固定インストールを行い、依存関係を変えていない各版へ独立したコピーを渡します。検証は並列で進み、ページは起動後すぐ操作できます。固定候補の録画では Vite の 4 ページが送信から約 24〜30 秒ですべて利用可能になりました。外部モデルの速度・品質の評価や、他の環境の所要時間の保証ではありません。
- **待ち時間も楽しく。** 作業中の各バージョンには DeepSeek の青いクジラのロゴが表示され、最初は淡い色で、進むにつれて青い水が満ち、2 つの光が輪郭を走ります。ときどき頭の上に考えごとの吹き出しが浮かびます（今していること、ひらめき、つついてという誘い）。ステップごとに潮を吹いてポインターのほうを向き、続けてつつくと跳ねたり、回ったり、ふらついたり、水しぶきを上げたりして、そのたびに新しいセリフを言います。実行中の比較の周りでは 2 つの彗星が枠を走り（古いエンジン向けの代替経路があり、動きを減らす設定では静止します）、背景ではゆっくり流れる青い光が溶け合います。
- **A〜D は 4 つの青。** バージョンのラベルは 4 種類の異なる青になりました。
- **DSH の再起動をお知らせ。** DSH はプラグインの画面をすぐ入れ替えますが、バックエンドは起動時に読み込んだものを使い続けます。両者が食い違うと、AgentCompare は黙ってステップや返信を欠くのではなく、DSH を完全に終了して開き直すよう案内します。
- **中国語名がつきました。** 正式名は「鲸挑细选」、愛称は「大肥鱼赛马」です。
- **単独では公開しなかった 2.1.0 の改善も含みます：** あいさつや質問への回答を、ページ生成なしでも直接比較できます。より明るく透明感のあるリキッドグラス、軽いボタン、スライドする操作部品。ライトとダークの両方で、検証した 21 の画面状態で文字がコントラスト比 4.5:1 以上です。

**2.0.0 の新機能：** 一度に **2〜4 バージョン**を比較できます。各バージョンに**スタイル**を指定できます（変更の幅：堅実・大胆／見た目：ミニマル・洗練・活発／優先：使いやすさ・厳密・軽快、または一行の自由記述）。**ブラインド**（選択後に公開）と**公開比較**（最初から表示）を選べます。3〜4 バージョンでは不要な版を**外して**残りを並べて比べられ、カード内で 1〜4 キーを押すとその版に集中できます。
- **青いリキッドグラスの新しい UI。** オーロラと星屑の背景、ガラスのパネル、選択肢の間を滑るガラスのレンズ、液体の進捗表示。選んだ瞬間に光の粒がはじけ、公開時には光が走ります。ダークモード、視差効果を減らす設定、ハイコントラストに対応。
- **選んだ理由を伝える。** 選択後に理由（レイアウト、配色と質感、操作感など）を選ぶか一言添えると、主会話での後続の修正がその長所を保ちます。
- **クイックセット。** バージョン数とスタイルをワンタップで設定：定番の対比、3 つの見た目、3 つの優先、4 方向の探索。
- **2〜4 版をスタイルで比較。** 8 種のプリセットか一行のカスタム指定。異なるモデルで同じスタイルも使えます。
- **ブラインドか公開比較。** 各版を試し、一時除外して復元。1〜4 で集中表示、0 で全版に戻れます。
- **回答・ファイル・実行ページ。** Markdown を読み、回答・コード・内容・保存先をコピー。選んだ版が明確に表示されます。
- **主会話で続ける。** 比較・選択・採用・取り消しが現在の会話メモリに残り、そのまま修正を続けられます。
- **Desktop + Web、中国語・英語 UI。** 設定済みモデルを再利用。変更を確認してから採用し、取り消し・復元も行えます。

</details>

<details>
<summary>名前について</summary>

中国語名は **鲸挑细选**（ジン・ティアオ・シー・シュエン）。「精挑细选（えりすぐる）」のもじりで、鲸はクジラ。同じ依頼に 2〜4 頭の DeepSeek のクジラが同時に取り組み、いちばん良い版を選びます。愛称は **大肥鱼赛马**（「太っちょ魚のレース」）。中国のネットでは DeepSeek のクジラを「太っちょ魚」と呼びます。同じコースを何匹かが走り、勝者はあなたが決めます。

</details>

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

Star バッジは GitHub の値を約 5 分キャッシュします。npm の累計リクエスト数は毎日中国時間 19:00 に更新し、実行が遅れる場合があります。

<!-- project-growth:end -->

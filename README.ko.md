[![AgentCompare 2.0：在主对话里比较 2–4 版回答、文件与网页。Desktop + Web，中英双语，选择后继续对话 / Compare 2–4 answers, files and live pages in the main conversation. Styles, blind or open comparison, reasons for the pick, reviewed adoption and conversation memory, in a blue liquid-glass interface. Product illustration.](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp)](#install)

# AgentCompare

[![GitHub stars](https://img.shields.io/github/stars/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=GitHub%20Stars&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers)
[![npm total download requests](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-badge.svg)](https://www.npmjs.com/package/dsh-agent-compare)

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=3657f5&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=3657f5&style=flat&labelColor=0b1b4f&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=0b1b4f&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-4d6bfe?style=flat&labelColor=0b1b4f)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · [日本語](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ja.md) · **한국어** · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · [Deutsch](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.de.md)

**하나의 요구, 실제로 실행되는 2~4개 구현. 스타일을 고르고 블라인드나 공개로 비교한 뒤 적용하세요.**

**DSH 桌面端 + 浏览器 / Desktop + Web**

<p align="center"><a href="#install">安装 / Install</a> · <a href="#demo">真实演示 / Recorded demo</a></p>

> **2.1.0 · 정식 버전.** DSH Desktop과 Web, 중국어·영어 인터페이스를 지원합니다. 어느 폴더에서든 기본 대화 안에서 답변, 파일 또는 웹 페이지를 비교하고 설정된 모델을 재사용합니다.

**2.1.0의 새로운 기능:**
- **인사나 질문에는 답변이 돌아옵니다.** 결과의 종류는 폴더가 아니라 요청 내용이 정합니다. 빌드할 수 있는 프로젝트 안에서 인사하거나 질문하면 각 버전이 자기 스타일로 답하고, 페이지를 만들지 않고 나란히 비교합니다. 프로젝트 변경을 요청하면 이전처럼 구현합니다.
- **더 밝고 투명한 리퀴드 글래스.** 파란색을 전체적으로 밝게 했습니다. 작업 공간은 유리보다 한 단계 깊고 위에서 부드러운 빛이 내려옵니다. 유리는 얇은 것, 두꺼운 것, 거의 불투명한 것의 세 단계이며, 가장자리에는 밝은 테두리와 옅은 시안·라일락 굴절이 들어갑니다. 뒤를 흐리게 하는 것은 떠 있는 작업 막대와 설정 막대뿐입니다.
- **가벼워진 버튼과 글자.** 채운 파란색은 주요 동작, 선택된 항목, 버전 글자에만 씁니다. 나머지 버튼은 옅은 파란 유리에 파란 글자이며, 파란 글자는 더 이상 굵지 않습니다.
- **미끄러지는 컨트롤.** 기록의 「Needs attention only」 필터는 슬라이드 스위치입니다. 세그먼트 전환은 홈 안에 놓이고, 선택해도 옆 항목이 움직이지 않습니다. 체크박스와 선택 상자는 같은 유리 스타일을 씁니다.
- **모든 글자가 잘 보입니다.** 라이트와 다크 테마 각각 19개 화면 상태에서 글자 단위로 실측했으며, 모든 글자의 대비는 4.5:1 이상입니다. 나란히 놓인 버전은 높이가 같습니다.

**2.0.0의 새로운 기능:** 한 번에 **2~4개 버전**을 비교합니다. 버전마다 **스타일**을 고를 수 있습니다(변경 폭: 안정·대담 / 분위기: 미니멀·세련·활기 / 우선순위: 친절·엄밀·가벼움, 또는 한 줄 직접 입력). **블라인드**(선택 후 공개)와 **공개 비교**(처음부터 표시) 중에서 선택합니다. 3~4개 버전일 때는 제외할 버전을 **빼두고** 나머지를 나란히 비교할 수 있으며, 카드에서 1~4 키로 한 버전에 집중할 수 있습니다.
- **새 블루 리퀴드 글래스 인터페이스.** 오로라와 별빛 배경, 유리 패널, 선택지 사이를 미끄러지는 유리 렌즈, 액체 진행 표시. 선택하는 순간 빛 입자가 터지고 공개할 때 빛이 지나갑니다. 다크 모드, 동작 줄이기, 고대비 모드를 지원합니다.
- **선택한 이유 남기기.** 선택 후 이유(레이아웃, 색감과 질감, 사용감 등)를 고르거나 한 줄을 덧붙이면 주 대화의 후속 수정이 그 장점을 유지합니다.
- **빠른 조합.** 버전 수와 스타일을 한 번에 설정합니다: 기본 대비, 세 가지 룩, 세 가지 우선순위, 네 방향 탐색.
- **스타일별 2–4개 버전.** 8개 프리셋이나 한 줄 사용자 지정 스타일을 선택하고, 서로 다른 모델에 같은 스타일을 적용할 수 있습니다.
- **블라인드 또는 공개 비교.** 각 버전을 사용해 보고 제외·복원합니다. 1–4로 집중 보기, 0으로 전체 보기가 가능합니다.
- **답변·파일·실행 페이지.** Markdown을 읽고 답변, 코드, 파일 내용, 저장 경로를 복사합니다. 선택한 버전이 명확히 표시됩니다.
- **주 대화에서 계속.** 비교, 선택, 적용과 실행 취소가 현재 대화 기억에 남아 이어서 수정할 수 있습니다.
- **Desktop + Web, 중국어·영어 UI.** 설정된 모델을 재사용하고 변경을 검토한 뒤 적용합니다. 실행 취소와 복구도 지원합니다.

AgentCompare는 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)(DSH) 플러그인입니다. 하나의 작업으로 독립된 2~4개 구현을 만들고 의존성 설치, 빌드, 공통 검사를 실행합니다. 실제 페이지를 사용해 본 뒤 하나를 고르거나 모두 선택하지 않을 수 있습니다. 블라인드 비교에서는 선택한 뒤에 모델과 스타일이 공개됩니다. 적용 전에는 현재 프로젝트와 합친 상태를 검증합니다.

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [Plugin directories and installation](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [Listing status / 收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

[![设定 2–4 版与风格，并行实跑，体验后选择并说明理由，审查并继续主对话 / Set up, run, choose and say why, review and continue. Answers, files, live pages and conversation memory. Product illustration.](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)

<p align="center"><sub>功能示意 / Product illustrations · <a href="#demo">查看真实演示 / Watch the recorded workflow</a></sub></p>

<a id="gallery"></a>

## 최신 화면 살펴보기

고정 후보를 사용한 실제 DSH 화면입니다. 대표 이미지와 흐름도는 기능 설명용입니다.

<details>
<summary>Open four interface views / 展开实际界面</summary>

![四版页面直接操作 / Four independently interactive pages; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)

![打招呼得到四种回答 / A greeting answered four ways; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)

![版本、风格与上下文 / Versions, styles and context; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)

![英文回答并排比较 / Compare English answers; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/06-english-answers.png)

</details>

[이미지 8장과 촬영 조건](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/storefront-gallery.md)

<a id="demo"></a>

## 전체 흐름 보기

[![4개의 뽀모도로 페이지를 동시에 실행하고 2개를 뺀 뒤 C를 골라 스타일을 공개하는 고정 후보 예시](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/docs/media/comparison-preview.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

실제 DSH 호스트에서 녹화한 고정 후보 시연입니다(2.1.0 릴리스 후보 소스, 화면은 중국어). 일반 폴더에서 4개 버전이 각각 뽀모도로 페이지를 만들고, 4개의 라이브 페이지를 바로 사용할 수 있습니다. 2개를 빼고 나머지를 나란히 비교한 뒤, 선택하면 각 스타일이 공개되고, 새 폴더에 저장한 다음 대화를 이어 갑니다. 대기 구간만 편집했고 나머지는 원래 속도입니다. 로컬 경로는 숨겼습니다.

선택한 뒤 이유 두 가지(레이아웃, 더 간결함)를 고르면 주 대화의 다음 요청에 전달됩니다.

[전체 영상(28초)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [조건과 결과](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<details>
<summary>English answers · 390 px</summary>

<p align="center"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp" width="840" alt="Three open English answers from the Three looks quick set: B is the pick, with Layout and More complete as its reasons; controlled candidates in a real DSH host."> <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp" width="260" alt="390-pixel English answer result in the blue glass interface, with the chosen version and a visible Continue conversation action; controlled candidates in a real DSH host."></p>

</details>

<a id="install"></a>

## 설치

인터페이스 언어는 중국어 간체와 영어입니다. DSH Desktop과 Web에서 전환할 수 있습니다.

아래 명령은 직접 실행하는 DSH Web 프로필용입니다. 데스크톱의 `desktop` 프로필은 앱이 관리하므로 앱의 플러그인 페이지를 사용하세요.

개발 기준은 Node 26.13.0, npm 12.2.2입니다. 공식 최신 DSH 패키지 0.2.1-rc.5로 검증합니다. 이미 사용하는 DSH 프로필을 확인하세요.

npm 패키지를 기본 Web 프로필에 추가합니다. 공개 상태는 위의 npm 배지에서 확인하세요.

```bash
dsh plugin --profile web add dsh-agent-compare@2.1.0
```

다른 자체 관리 프로필을 쓰면 `web`을 실제 이름으로 바꾸세요.

소스에서 빌드하여 설치할 수도 있습니다.

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
cd dsh-agent-compare
npm ci
npm pack
```

`<your-profile>`을 실제 프로필 이름으로 바꿉니다.

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-2.1.0.tgz
```

DSH를 다시 시작합니다. 업데이트 전에는 같은 기록을 사용하는 이전 인스턴스의 작업을 끝내고 닫으세요. 서로 다른 플러그인 버전의 동시 변경은 지원하지 않습니다.

## 첫 비교

1. 대화 입력창 왼쪽 아래의 **A|B**를 누릅니다. 설정은 기존 입력창 위에 열립니다.
2. 기본값은 같은 모델과 두 전략입니다. 현재 DSH 모델을 재사용하므로 두 번째 계정이 필요 없습니다. 두 모델 모드도 이미 설정한 모델 중에서 고릅니다.
3. 화면에서 각 구현의 생성 한도를 고릅니다. 5~120분이며 기본값은 30분입니다. 입력창에는 요구사항만 작성해 전송합니다. 옵션을 직접 입력할 필요가 없습니다.
4. 대화 카드에서 진행 상태와 두 실행 페이지를 확인합니다. 데스크톱·휴대전화 크기, A/B 집중 보기, 큰 창을 사용할 수 있습니다.
5. `选 A`, `选 B`, `都不满意`로 선택합니다. 그 뒤 실제 모델 또는 전략, 검증 결과, 제공된 사용량이 표시됩니다.
6. `审查并采用`로 대상 저장소와 사전 검사를 확인합니다. 별도의 확인 버튼을 눌러야 파일을 적용합니다. `继续主对话`는 비교 모드를 끝내고 원래 입력창으로 돌아갑니다.

`试跑内置示例`는 별도 예제 상점 저장소에서 실행합니다. 기존 프로젝트를 건드리지 않으며 적용 대상도 예제입니다. 오른쪽 위의 `比较记录`와 `使用教程`는 새 대화와 기존 대화 모두에서 사용할 수 있습니다.

## 적합한 작업과 비교 조건

검색·필터, 폼 흐름, 랜딩 페이지, 대시보드, 컴포넌트 재설계처럼 직접 사용하며 품질을 판단하는 작업에 적합합니다. 정답이 명확한 버그 수정이나 기계적인 리팩터링은 단일 에이전트와 테스트가 더 적절합니다.

같은 모델 모드는 기존 구조를 재사용하는 전략과 상호작용을 다시 설계하는 전략을 비교합니다. 두 모델 모드는 모델만 바꾸고 요구·지시·검증을 맞춥니다. 두 구현은 동일한 코드 기준점에서 시작합니다. 한 번의 선택은 모델 전체의 순위를 뜻하지 않습니다.

## 실행과 공통 검증

Git 저장소에서는 커밋이 아직 없어도, 무시된 파일을 제외한 미커밋·미추적 변경까지 전용 index로 스냅샷을 만듭니다. Git 밖의 폴더에서는 두 구현이 플러그인 전용 빈 작업 공간에서 시작하며, 선택한 결과를 그 폴더의 새 하위 폴더에 저장할 수 있습니다. 원본 HEAD와 index는 유지하며, 각 구현은 별도 worktree와 세션을 사용합니다. 변경은 해시가 포함된 바이너리 패치로 보존합니다.

기준점의 `typecheck`, `lint`, `test`, `build`와 설정한 페이지 검증을 양쪽에 적용합니다. 잠금 파일이 있으면 고정 설치를 수행하고 실패했다고 느슨한 설치로 재시도하지 않습니다. 후보가 검증 스크립트나 설정을 바꿔 통과한 결과는 직접 적용의 근거가 되지 않습니다.

저장소 루트의 [`.agent-compare.json` 예제](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json)로 입력·클릭·개수·문자열·화면 크기 검사를 추가할 수 있습니다. 정의는 생성 전에 검증하고 기준점에 묶습니다. 명시적 페이지 인수 검사가 실행되지 않으면 직접 적용할 수 없습니다. 기본 페이지 로드 검사만 실행하지 못한 경우에는 미검증 경고를 표시합니다. HTTP 응답, 빌드 통과, 기능 충족, 사용자의 선호는 각각 다른 사실입니다.

## 적용·취소·복구

적용 시 현재 작업 트리와 선택한 변경을 결합합니다. 변경 경로가 겹치면 중단하고, 다른 파일의 변경이 있으면 임시 사본에서 조합을 다시 검증합니다. 쓰기 전에 HEAD, index와 대상 내용을 재확인하며 복구 기록을 저장합니다.

작업 트리 적용은 자동 커밋·push·브랜치 전환을 하지 않습니다. 새 파일, 삭제, 바이너리도 변경에 포함합니다. 검증을 충족하지 못한 후보는 확인용 브랜치로 저장할 수 있습니다. 적용 후 편집은 취소·복구 과정에서 충돌로 남기고 덮어쓰지 않도록 검사합니다.

저장소 잠금은 플러그인 작업끼리 조정하며 외부 편집기를 잠그지 않습니다. 실제 쓰기 단계에서는 편집을 잠시 멈추세요.

## 기록과 브라우저 상태

기록은 기본적으로 모든 대화를 표시하며 현재 대화 필터, 작업·저장소·실행 번호 검색, 30개씩 페이지 이동을 제공합니다. 결과·선택·적용 설명은 같은 대화로 전달하며 일시적으로 불가능하면 재시도합니다. 긴 로그 전체를 주 대화에 반복 삽입하지 않습니다. 손상되거나 오래된 기록은 이유와 함께 읽기 전용으로 보관합니다.

재시작 뒤에는 멈춘 미리보기와 보존된 검증 이미지를 구분합니다. 사본이 남아 있으면 다시 실행할 수 있습니다. 이미지는 정적 기록이며 실행 중인 앱이 아닙니다. 미리보기마다 새 `.localhost` 주소를 사용해 후보 사이의 Cookie와 오리진 저장소를 분리합니다. 재실행하면 페이지 내부의 임시 상태는 초기화되지만 비교 기록과 이미지는 남습니다.

## 지원 범위와 격리 한계

worktree는 완전한 보안 샌드박스가 아닙니다. DSH의 파일 쓰기 경계를 사용하며 Windows에서는 **partial**로 보고합니다. 파일 읽기와 네트워크는 격리하지 않습니다. 포함된 페이지의 Cookie는 브라우저 정책을 따르고 외부 탭에서는 저장소 맥락이 달라질 수 있습니다. 로그인, 외부 백엔드, 공유 데이터베이스는 현재 범위 밖입니다.

Windows, Linux, macOS에서 네이티브 검증을 실행합니다. npm, pnpm, Yarn의 검증된 구성과 Windows/PnP 제한은 [호환성 표](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility)에 구분합니다. 네이티브 Safari는 별도로 검증하며, 고정 응답 테스트는 외부 모델의 품질이나 처리 시간 측정이 아닙니다.

## 비용과 확인된 근거

두 후보는 각각 생성 비용이 들며 병렬 실행이 항상 더 빠르거나 저렴하지는 않습니다. 한 후보 또는 전체 작업을 중지할 수 있습니다. 시간 한도가 끝나면 이미 작성한 변경을 검증합니다. 사용량이 제공되지 않으면 0이 아니라 알 수 없음으로 표시합니다.

[CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)는 Windows/Linux, Node, 브라우저 검사를 제공합니다. 최신 DSH의 일부 실제 세션·도구·앱 실행 검사는 고정 응답의 로컬 어댑터를 사용합니다. 이는 외부 모델의 생성 품질 증명이 아닙니다. 문서의 실제 모델 사례는 DSH 0.2.1-rc.3 환경의 기록입니다. 단일 사례를 일반적인 모델 순위나 성능 약속으로 사용하지 않습니다.

## 기여와 라이선스

[Issue](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues)에는 버전, OS, 재현 단계, 기대와 실제 결과를 적어 주세요. 자격 증명·비공개 코드·전체 로컬 경로는 공개하지 마세요. [기여 안내](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md)와 [변경 기록](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md)을 참고할 수 있습니다.

```bash
npm ci
npm run typecheck
npm test
npm run test:ui
```

[MIT](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE). 유용한 결과를 얻었다면 Star나 재현 가능한 사례로 도울 수 있습니다. 공유와 Star는 선택 사항입니다.

<!-- project-growth:start -->

## 프로젝트 성장

**유지보수 안내:** 운영자에 따르면 11월 11일(UTC) 유지보수·개선·수정을 위해 대부분의 플러그인 마켓에서 일시적으로 내려 배포와 당일 요청이 줄었습니다. [유지보수 및 배포 안내(영문)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/maintenance-update-2026-11-11.en.md).

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-light.svg" width="960" alt="AgentCompare · Total npm download requests since first publication">
</picture>
</a>

최초 게시일부터 모든 공개 버전의 npm 다운로드 요청을 누적합니다. 집계 종료일은 카드에 표시하며 반복·자동 요청이 포함될 수 있습니다.

[누적 집계 기준 및 자동 갱신](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md)

<!-- project-growth:end -->

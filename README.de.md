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

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · [日本語](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ja.md) · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · **Deutsch**

**Eine Aufgabe. Zwei bis vier laufende Implementierungen. Stile wählen, blind oder offen vergleichen, dann übernehmen.**

**DSH 桌面端 + 浏览器 / Desktop + Web**

<p align="center"><a href="#install">安装 / Install</a> · <a href="#demo">真实演示 / Recorded demo</a></p>

> **2.1.0 · Stabile Version.** DSH Desktop und Web, mit chinesischer und englischer Oberfläche. Antworten, Dateien oder Webseiten aus jedem Ordner im Hauptgespräch vergleichen und konfigurierte Modelle weiterverwenden.

**Neu in 2.1.0:**
- **Ein Gruß oder eine Frage bekommt Antworten.** Die Anfrage bestimmt die Art des Ergebnisses, nicht der Ordner: Wer in einem baubaren Projekt grüßt oder eine Frage stellt, erhält von jeder Version eine Antwort im eigenen Stil zum Vergleich nebeneinander, statt einer gebauten Seite; eine Bitte um Änderungen am Projekt wird weiterhin umgesetzt.
- **Helleres, klareres Flüssigglas.** Das Blau ist heller; die Arbeitsfläche liegt eine Stufe tiefer als das Glas, mit weichem Licht von oben. Glas gibt es in drei Stärken (dünn, dick und fast deckend), mit hellem Rand und einem Hauch Cyan und Flieder an den Kanten; nur die schwebende Aktionsleiste und die Einstellungsleiste zeichnen weich, was hinter ihnen liegt.
- **Leichtere Schaltflächen und Schrift.** Volles Blau bleibt der Hauptaktion, der gewählten Option und den Versionsbuchstaben vorbehalten; andere Schaltflächen sind blassblaues Glas mit blauer Schrift in normaler Stärke.
- **Gleitende Bedienelemente.** Der Verlaufsfilter „Needs attention only“ ist ein Schiebeschalter; Segmentschalter sitzen in einer Rille, und die Wahl einer Option verschiebt ihre Nachbarn nicht mehr. Kontrollkästchen und Auswahllisten teilen sich einen Glasstil.
- **Überall lesbar.** Kontrast Glyphe für Glyphe in 19 Zuständen der Oberfläche je Thema gemessen: jeder Text erreicht mindestens 4.5:1. Nebeneinander stehende Versionen sind gleich hoch.

**Neu in 2.0.0:** Vergleiche **2, 3 oder 4 Versionen** gleichzeitig. Jede Version kann einen **Stil** erhalten (Umfang: konservativ, mutig; Wirkung: minimal, ausgefeilt, lebendig; Priorität: zugänglich, gründlich, schlank; oder eine eigene Zeile). Vergleiche **blind** (Stile nach der Wahl aufgedeckt) oder **offen** (Stile von Anfang an sichtbar). Bei drei oder vier Versionen legst du verworfene Versionen **beiseite**, damit die übrigen nebeneinander stehen; in der Karte fokussieren die Tasten 1–4 eine Version.
- **Neue Oberfläche in blauem Flüssigglas.** Aurora und Sternenstaub hinter Glasflächen, eine Glaslinse, die zwischen Optionen gleitet, und flüssiger Fortschritt; ein Lichtfunke bei der Wahl und ein Lichtstreif beim Aufdecken. Dunkelmodus, reduzierte Bewegung und hoher Kontrast werden unterstützt.
- **Sagen, warum sie gewinnt.** Nach der Wahl ein paar Gründe antippen (Layout, Farbe und Material, Bediengefühl …) oder eine Zeile ergänzen; spätere Änderungen im Hauptgespräch behalten diese Stärken bei.
- **Schnellsets.** Ein Tipp setzt Anzahl und Stile der Versionen: Klassisches Paar, Drei Looks, Drei Prioritäten, Vier Richtungen.
- **2–4 Versionen mit Stilen.** Acht Vorlagen oder eine eigene Zeile; verschiedene Modelle können denselben Stil verwenden.
- **Blind oder offen vergleichen.** Versionen ausprobieren, zurückstellen und wiederherstellen; 1–4 fokussiert eine Version, 0 zeigt alle.
- **Antworten, Dateien und laufende Seiten.** Markdown lesen und Antworten, Code, Dateiinhalte oder Pfade kopieren. Die eigene Wahl ist klar markiert.
- **Im Hauptgespräch weiterarbeiten.** Vergleiche, Auswahl, Übernahme und Rücknahme bleiben im Gedächtnis des aktuellen Gesprächs.
- **Desktop + Web, Oberfläche auf Chinesisch und Englisch.** Vorhandene Modelle nutzen und Änderungen vor der Übernahme prüfen; Rücknahme und Wiederherstellung bleiben verfügbar.

AgentCompare ist ein Plugin für [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), kurz DSH. Zwei bis vier Agenten bearbeiten dieselbe Aufgabe in getrennten Projektkopien. Das Plugin installiert Abhängigkeiten, baut jede Anwendung, startet sie und führt gemeinsame Prüfungen aus. Du bedienst die Seiten, bevor du eine oder keine auswählst; bei einem blinden Vergleich werden Modell und Stil erst nach der Wahl aufgedeckt. Vor der Übernahme wird die Kombination mit deinem aktuellen Projekt geprüft.

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [Plugin directories and installation](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [Listing status / 收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

[![设定 2–4 版与风格，并行实跑，体验后选择并说明理由，审查并继续主对话 / Set up, run, choose and say why, review and continue. Answers, files, live pages and conversation memory. Product illustration.](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp)

<p align="center"><sub>功能示意 / Product illustrations · <a href="#demo">查看真实演示 / Watch the recorded workflow</a></sub></p>

<a id="gallery"></a>

## Die aktuelle Oberfläche

Echte DSH-Aufnahmen mit kontrollierten Kandidaten. Titelbild und Ablaufgrafik sind Produktillustrationen.

<details>
<summary>Open four interface views / 展开实际界面</summary>

![四版页面直接操作 / Four independently interactive pages; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/02-live-comparison.png)

![打招呼得到四种回答 / A greeting answered four ways; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/03-main-conversation.png)

![版本、风格与上下文 / Versions, styles and context; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/04-comparison-settings.png)

![英文回答并排比较 / Compare English answers; controlled candidates in a real DSH host](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/gallery-2.0/06-english-answers.png)

</details>

[Alle 8 Bilder und Aufnahmebedingungen](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/storefront-gallery.md)

<a id="demo"></a>

## Den gesamten Ablauf ansehen

[![Beispiel mit festen Kandidaten: vier laufende Pomodoro-Seiten, zwei beiseitegelegt, C gewählt und die Stile aufgedeckt](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/docs/media/comparison-preview.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

Aufzeichnung mit festen Kandidaten in einem echten DSH-Host, aus dem Quellstand des 2.1.0-Kandidaten und mit chinesischer Oberfläche. Vier Versionen bauen in einem gewöhnlichen Ordner je eine Pomodoro-Seite, und alle vier laufenden Seiten lassen sich bedienen. Zwei werden beiseitegelegt, die übrigen stehen nebeneinander, die Wahl deckt jeden Stil auf, und das Ergebnis wird in einem neuen Ordner gespeichert, bevor das Gespräch weitergeht. Das Video lässt Wartezeiten aus und zeigt den Rest in normaler Geschwindigkeit. Lokale Pfade sind ausgeblendet.

Nach der Wahl werden zwei Gründe (Layout, einfacher) angetippt; sie erreichen die nächste Anfrage im Hauptgespräch.

[Vollständiges Video (28 Sekunden)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [Bedingungen und Ergebnisse](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<details>
<summary>English answers · 390 px</summary>

<p align="center"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/13-english-answers.webp" width="840" alt="Three open English answers from the Three looks quick set: B is the pick, with Layout and More complete as its reasons; controlled candidates in a real DSH host."> <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/14-phone-answer.webp" width="260" alt="390-pixel English answer result in the blue glass interface, with the chosen version and a visible Continue conversation action; controlled candidates in a real DSH host."></p>

</details>

<a id="install"></a>

## Installation

Oberflächensprachen: vereinfachtes Chinesisch und Englisch, in DSH Desktop und Web umschaltbar.

Die folgenden Befehle gelten für ein selbst verwaltetes DSH-Web-Profil. Das Profil `desktop` wird von der Desktop-App verwaltet; verwenden Sie deren Plugin-Seite.

Entwicklungsgrundlage sind Node 26.13.0 und npm 12.2.2. Die aktuellen Prüfungen verwenden das offizielle DSH-Paket 0.2.1-rc.5. Ermittle den Namen deines vorhandenen DSH-Profils.

Installiere das npm-Paket im voreingestellten Web-Profil. Das npm-Badge zeigt den Veröffentlichungsstatus:

```bash
dsh plugin --profile web add dsh-agent-compare@2.1.0
```

Für ein anderes selbst verwaltetes Profil ersetzt du `web` durch dessen tatsächlichen Namen.

Alternativ aus dem Quellcode bauen und installieren:

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
cd dsh-agent-compare
npm ci
npm pack
```

Ersetze `<your-profile>` durch den tatsächlichen Profilnamen:

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-2.1.0.tgz
```

Starte DSH neu. Beende vor einem Update aktive Vergleiche und schließe ältere Instanzen, die dieselben Aufzeichnungen verwenden. Gleichzeitige Änderungen durch unterschiedliche Plugin-Versionen werden nicht unterstützt.

## Der erste Vergleich

1. Klicke links unten im Gesprächseingabefeld auf **A|B**. Die Einstellungen erscheinen über dem vorhandenen Feld.
2. Standardmäßig wird das aktuelle Modell mit zwei Strategien wiederverwendet. Ein zweites Konto ist nicht erforderlich. Im Modus mit zwei Modellen wählst du aus den bereits in DSH eingerichteten Modellen.
3. Wähle die Generierungsgrenze pro Vorschlag in der Oberfläche: 5–120 Minuten, standardmäßig 30. Schreibe nur die Anforderung und sende sie ab. Es sind keine Parameter einzutippen.
4. Die Gesprächskarte zeigt Fortschritt und zwei interaktive Anwendungen. Desktop- und Mobilansicht, Fokus auf A oder B und eine größere Ansicht stehen bereit.
5. Mit `选 A`, `选 B` oder `都不满意` wählst du A, B oder keine. Erst danach werden die tatsächliche Strategie beziehungsweise das Modell, Prüfungen und gemeldeter Verbrauch aufgedeckt.
6. `审查并采用` öffnet die Prüfung des Ziel-Repositorys und der Voraussetzungen. Erst eine gesonderte Bestätigung schreibt Dateien. `继续主对话` beendet den Vergleichsmodus und setzt den Fokus zurück ins ursprüngliche Eingabefeld.

`试跑内置示例` erstellt einen separaten Beispielshop und verändert dein Projekt nicht. Eine Übernahme betrifft ebenfalls dieses Beispiel. `比较记录` öffnet den Verlauf, `使用教程` die Anleitung. Beide Einstiege sind in neuen und bestehenden Gesprächen vorhanden.

## Welche Aufgaben lohnen sich?

Suche und Filter, Formulare, Landingpages, Dashboards und Komponentenumbauten: Aufgaben, bei denen die Benutzung zur Qualitätsentscheidung beiträgt. Für einen Fehler mit klarer Lösung oder ein mechanisches Refactoring ist ein einzelner Agent mit Tests oft passender.

Beim gleichen Modell erhält eine Strategie mehr Bestehendes, während die andere die Interaktion neu gestaltet. Bei zwei Modellen bleiben Aufgabe, Anweisungen und Prüfungen gleich. Beide beginnen mit demselben Codezustand. Eine einzelne Wahl ist kein allgemeines Modellranking.

## Ausführung und gemeinsame Prüfungen

In einem Git-Repository, auch ohne Commit, erfasst ein privater Index uncommittete Änderungen und nicht verfolgte Dateien, mit den vorgesehenen Ausschlüssen. In einem Ordner außerhalb von Git beginnen beide Versionen in einem leeren, privaten Arbeitsbereich; die gewählte Version lässt sich in einem neuen Unterordner speichern. Ursprünglicher HEAD und Index bleiben erhalten. Jede Implementierung verwendet einen eigenen Worktree und eine eigene Sitzung; die Änderung wird als binärer Patch mit Hash gespeichert.

Die Prüfungen stammen aus dem Ausgangszustand: `typecheck`, `lint`, `test`, `build` sowie konfigurierte Seitenprüfungen. Bei vorhandenem Lockfile wird unveränderlich installiert; ein Fehlschlag löst keinen ungebundenen Neuversuch aus. Veränderte Tests oder Prüfkonfigurationen zählen nicht als gültiger Nachweis für die direkte Übernahme.

Eine [`.agent-compare.json` im Projektstamm](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/examples/vite-react-demo/.agent-compare.json) kann gemeinsame Eingaben, Klicks, Texte, Sichtbarkeit, Elementanzahl und Bildschirmgrößen festlegen. Die Definition wird vor der Generierung validiert. Eine nicht ausgeführte explizite Seitenabnahme verhindert die direkte Übernahme. Fehlt lediglich die einfache Ladeprüfung, wird eine Warnung angezeigt. HTTP-Erreichbarkeit, erfolgreicher Build, erfüllte Funktion und persönliche Präferenz sind unterschiedliche Ergebnisse.

## Übernahme, Rücknahme und Wiederherstellung

Die Übernahme kombiniert den aktuellen Arbeitsbaum mit den vom Vorschlag geänderten Pfaden. Erkannte Überschneidungen stoppen den Vorgang. Änderungen an anderen Dateien werden zusammen mit dem Vorschlag in einer temporären Kopie geprüft. Inhalt, HEAD und Index werden vor dem Schreiben erneut kontrolliert; ein Wiederherstellungsjournal wird gespeichert.

Eine Übernahme in den Arbeitsbaum erzeugt keinen automatischen Commit, führt keinen Push aus und wechselt keinen Branch. Neue, gelöschte und binäre Dateien sind enthalten. Ein Vorschlag, der die Kriterien nicht erfüllt, kann als Prüfbranch gespeichert werden. Bei Rücknahme oder Wiederherstellung bleiben erkannte spätere Bearbeitungen als Konflikte zur Prüfung erhalten.

Die Repository-Sperre koordiniert Plugin-Vorgänge, sperrt jedoch keine externen Editoren. Pausiere Änderungen während der kurzen Schreibphase.

## Verlauf und Seitenzustand

Der Verlauf zeigt standardmäßig alle Gespräche, mit Filter für das aktuelle Gespräch, Suche nach Aufgabe, Repository oder Kennung und 30 Einträgen pro Seite. Ergebnis, Wahl und Übernahme bleiben gespeichert. Hinweise werden an dasselbe Gespräch zugestellt und bei vorübergehender Nichtverfügbarkeit erneut versucht. Lange Protokolle werden nicht vollständig in den Hauptkontext eingefügt.

Alte oder beschädigte Aufzeichnungen bleiben mit Begründung schreibgeschützt erhalten. Nach einem Neustart werden gespeicherte Prüfbilder von laufenden Anwendungen unterschieden. Ist die Kopie noch vorhanden, kann die Vorschau neu gestartet werden. Jeder Start erhält eine neue `.localhost`-Adresse, damit Cookies und Origin-Speicher nicht zwischen den Vorschlägen geteilt werden. Temporärer Seitenzustand wird zurückgesetzt; Vergleichsaufzeichnungen und Bilder bleiben erhalten.

## Kompatibilität und Grenzen

Ein Worktree ist keine vollständige Sicherheitsgrenze. Das Plugin nutzt die DSH-Schreibrichtlinie; unter Windows wird sie als **partial** gemeldet. Dateilesen und Netzwerk sind nicht isoliert. Eingebettete Cookies folgen den Browserrichtlinien; ein externer Tab kann einen anderen Speicherkontext verwenden. Anmeldung, externe Backends und gemeinsam genutzte Datenbanken liegen außerhalb des aktuellen Umfangs.

Native Prüfungen decken Windows, Linux und macOS ab. Die [Kompatibilitätsmatrix](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md#compatibility) nennt geprüfte Kombinationen von npm, pnpm und Yarn sowie die Grenzen unter Windows/PnP. Natives Safari wird getrennt geprüft; kontrollierte Testantworten messen weder Qualität noch Laufzeit externer Modelle.

## Laufzeit, Kosten und Nachweise

Beide Vorschläge verbrauchen Generierung. Parallele Ausführung garantiert weder geringere Kosten noch kürzere Dauer. Du kannst einen Vorschlag oder beide stoppen. Nach Ablauf der Grenze werden bereits geschriebene Änderungen geprüft. Nicht gemeldeter Verbrauch wird als unbekannt und niemals als null dargestellt.

Die [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml) prüft Windows/Linux, Node und den Browser. Ein Teil der aktuellen Integrationstests nutzt echte Sitzungen, Werkzeuge und Anwendungen mit einem lokalen Adapter mit festen Antworten. Das belegt die Ausführung, nicht die Qualität eines externen Modells. Historische Fälle mit echten Modellen stammen aus DSH 0.2.1-rc.3; sie sind weder Modellranking noch allgemeines Leistungsversprechen.

## Mitwirken und Lizenz

Gib in einem [Issue](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues) Versionen, Betriebssystem, Schritte sowie erwartetes und beobachtetes Ergebnis an. Veröffentliche keine Zugangsdaten, privaten Quelltexte oder vollständigen lokalen Pfade. Weitere Hinweise stehen in [CONTRIBUTING.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CONTRIBUTING.md) und [CHANGELOG.md](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/CHANGELOG.md).

```bash
npm ci
npm run typecheck
npm test
npm run test:ui
```

Lizenz: [MIT](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE). Wenn ein brauchbares Ergebnis entsteht, kannst du das Projekt mit einem Star oder einem reproduzierbaren Beispiel unterstützen. Teilen und Stars sind freiwillig.

<!-- project-growth:start -->

## Projektentwicklung

**Wartungshinweis:** Laut Projektverantwortlichem wurden am 11. November UTC für Wartung, Verbesserungen und Korrekturen die Einträge in den meisten Plugin-Märkten vorübergehend zurückgezogen. Dadurch gingen Vertrieb und Anfragen an diesem Tag zurück. [Wartungs- und Vertriebshinweis (Englisch)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/maintenance-update-2026-11-11.en.md).

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/statistics/npm-total-light.svg" width="960" alt="AgentCompare · Total npm download requests since first publication">
</picture>
</a>

Kumulierte npm-Downloadanfragen seit der ersten Veröffentlichung, über alle öffentlichen Versionen. Die Karte nennt den Datenstand; wiederholte und automatisierte Zugriffe können enthalten sein.

[Gesamtzählung und automatische Aktualisierung](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/npm-total-downloads.md)

<!-- project-growth:end -->

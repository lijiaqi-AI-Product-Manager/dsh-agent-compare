<p align="center">
  <a href="#install"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/hero-bilingual.webp" width="1200" alt="AgentCompare：同一需求，两版真跑。支持 DSH 桌面端与浏览器 / One task. Two live builds. DSH Desktop + Web."></a>
</p>

# AgentCompare

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=0f766e&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![npm version](https://img.shields.io/npm/v/dsh-agent-compare?label=npm&color=0f766e&style=flat&labelColor=334155&logo=npm&logoColor=white)](https://www.npmjs.com/package/dsh-agent-compare)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=334155&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5-2563eb?style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/LICENSE)

[中文](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.md) · [English](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.en.md) · [日本語](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ja.md) · [한국어](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.ko.md) · [Español](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.es.md) · [Português (Brasil)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.pt-BR.md) · [Français](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/README.fr.md) · **Deutsch**

**Eine Aufgabe. Zwei laufende Implementierungen. Ausprobieren, auswählen, danach die Strategie sehen.**

**DSH 桌面端 + 浏览器 / Desktop + Web**

<p align="center"><a href="#install">安装 / Install</a> · <a href="#demo">真实演示 / Recorded demo</a></p>

> **1.1.0 · Stabile Version.** Lokale Vite-Projekte im Stamm eines Git-Repositorys. Verwendet das aktuelle DSH-Modell.

AgentCompare ist ein Plugin für [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), kurz DSH. Zwei Agenten bearbeiten dieselbe Frontend-Aufgabe in getrennten Projektkopien. Das Plugin installiert Abhängigkeiten, baut beide Anwendungen, startet sie und führt gemeinsame Prüfungen aus. Du bedienst die Seiten, bevor du A, B oder keine auswählst. Vor der Übernahme wird die Kombination mit deinem aktuellen Projekt geprüft.

[插件目录与安装](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.md) · [Plugin directories and installation](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/distribution.en.md) · [Listing status / 收录状态](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues/4)

<p align="center">
  <a href="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp"><img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/assets/readme/comparison-workflow.webp" width="1200" alt="真跑，才好选；看清，再采用。同一任务独立运行，审查选中候选后确认写回 / Run it. Then choose. Review. Then adopt. Run separately and inspect the selected candidate before applying."></a>
</p>

<p align="center"><sub>功能示意 / Product illustrations · <a href="#demo">查看真实演示 / Watch the recorded workflow</a></sub></p>

<a id="demo"></a>

## Den gesamten Ablauf ansehen

[![Beispiel mit festen Kandidaten: ausprobieren, prüfen, auswählen und übernehmen](https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/main/docs/media/comparison-preview.gif)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4)

Aufzeichnung mit festen Kandidaten aus dem veröffentlichten Paket 1.1.0 und chinesischer Oberfläche. Anwendungen, gemeinsame Prüfungen, Übernahme und Rücknahme werden tatsächlich ausgeführt. Das Video lässt Wartezeiten aus; das GIF zeigt die Bedienung mit 0,5-facher Geschwindigkeit. Lokale Pfade sind ausgeblendet.

[Vollständiges Video (29 Sekunden)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/media/comparison-workflow.mp4) · [Bedingungen und Ergebnisse](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/docs/demo.md)

<a id="install"></a>

## Installation

Die Oberfläche von 1.0 ist nur auf vereinfachtem Chinesisch verfügbar. DSH Desktop und Web werden unterstützt; die Dokumentationssprachen sind davon unabhängig.

Die folgenden Befehle gelten für ein selbst verwaltetes DSH-Web-Profil. Das Profil `desktop` wird von der Desktop-App verwaltet; verwenden Sie deren Plugin-Seite.

Entwicklungsgrundlage sind Node 26.13.0 und npm 12.2.1. Die aktuellen Prüfungen verwenden das offizielle DSH-Paket 0.2.1-rc.5. Ermittle den Namen deines vorhandenen DSH-Profils.

Installiere das npm-Paket im voreingestellten Web-Profil. Das npm-Badge zeigt den Veröffentlichungsstatus:

```bash
dsh plugin --profile web add dsh-agent-compare@1.1.0
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
dsh plugin --profile <your-profile> add ./dsh-agent-compare-1.1.0.tgz
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

Das Repository benötigt mindestens einen Commit. Ein privater Index erfasst uncommittete Änderungen und nicht verfolgte Dateien, mit den vorgesehenen Ausschlüssen. Ursprünglicher HEAD und Index bleiben erhalten. Jede Implementierung verwendet einen eigenen Worktree und eine eigene Sitzung; die Änderung wird als binärer Patch mit Hash gespeichert.

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

Der Star-Verlauf wird täglich aktualisiert. Aktualisierungsdaten verwenden UTC; Star-Daten folgen den GitHub-Aggregaten. Zusätzlich werden tägliche npm-Downloadanfragen angezeigt.

<a href="https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/stargazers">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/stars-light.svg" width="960" alt="AgentCompare · GitHub-Star-Verlauf">
</picture>
</a>

<a href="https://www.npmjs.com/package/dsh-agent-compare">
<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-dark.svg">
  <img src="https://raw.githubusercontent.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/main/assets/growth/dsh-agent-compare/downloads-light.svg" width="960" alt="AgentCompare · Tägliche Downloadanfragen">
</picture>
</a>

Downloadanfragen umfassen wiederholte und automatisierte Zugriffe und entsprechen nicht eindeutigen oder aktiven Nutzern.

[Datenquellen und Kennzahlendefinitionen](https://github.com/lijiaqi-AI-Product-Manager/lijiaqi-AI-Product-Manager/blob/main/docs/growth.md)

<!-- project-growth:end -->

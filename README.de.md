# AgentCompare

[![Source version](https://img.shields.io/github/package-json/v/lijiaqi-AI-Product-Manager/dsh-agent-compare?label=source&color=0f766e&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![npm: not published](https://img.shields.io/badge/npm-not%20published-64748b?style=flat&labelColor=334155&logo=npm&logoColor=white)](#installation)
[![CI](https://img.shields.io/github/actions/workflow/status/lijiaqi-AI-Product-Manager/dsh-agent-compare/ci.yml?branch=main&label=CI&logo=github&logoColor=white&style=flat&labelColor=334155)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml)
[![Node.js ^22.22.2 || ^24.15.0 || >=26.0.0](https://img.shields.io/badge/Node.js-22%20%2F%2024%20%2F%2026%2B-238636?style=flat&labelColor=334155&logo=nodedotjs&logoColor=white)](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/blob/main/package.json)
[![Tested on DSH 0.2.1-rc.5](https://img.shields.io/badge/DSH%20tested-0.2.1--rc.5-2563eb?style=flat&labelColor=334155)](docs/demo.md)
[![License: MIT](https://img.shields.io/badge/license-MIT-2563eb?style=flat&labelColor=334155)](LICENSE)

[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · [Português (Brasil)](README.pt-BR.md) · [Français](README.fr.md) · **Deutsch**

**Eine Aufgabe. Zwei laufende Implementierungen. Ausprobieren, auswählen, danach die Strategie sehen.**

> **0.2.0-alpha.17, noch nicht auf npm veröffentlicht.** Derzeit erfolgt die Installation aus dem Quellcode. Der anfängliche Umfang sind lokale Vite-Projekte im Stammverzeichnis eines Git-Repositorys.

AgentCompare ist ein Plugin für [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), kurz DSH. Zwei Agenten bearbeiten dieselbe Frontend-Aufgabe in getrennten Projektkopien. Das Plugin installiert Abhängigkeiten, baut beide Anwendungen, startet sie und führt gemeinsame Prüfungen aus. Du bedienst die Seiten, bevor du A, B oder keine auswählst. Vor der Übernahme wird die Kombination mit deinem aktuellen Projekt geprüft.

## Den gesamten Ablauf ansehen

[![Beispiel mit festen Kandidaten: ausprobieren, prüfen, auswählen und übernehmen](docs/media/comparison-preview.gif)](docs/media/comparison-workflow.mp4)

Beispiel mit festen Kandidaten und chinesischer Oberfläche. Anwendungen, gemeinsame Prüfungen und Übernahme werden tatsächlich ausgeführt; Wartezeiten sind gekürzt und lokale Pfade ausgeblendet.

[Vollständiges Video (28 Sekunden)](docs/media/comparison-workflow.mp4) · [Bedingungen und Ergebnisse](docs/demo.md)

## Installation

Die folgenden Befehle gelten für ein selbst verwaltetes DSH-Web-Profil. Das Profil `desktop` wird von der Desktop-App verwaltet; verwenden Sie deren Plugin-Seite.

Entwicklungsgrundlage sind Node 26.13.0 und npm 12.2.1. Die aktuellen Prüfungen verwenden das offizielle DSH-Paket 0.2.1-rc.5. Ermittle den Namen deines vorhandenen DSH-Profils.

```bash
git clone https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare.git
cd dsh-agent-compare
npm ci
npm pack
```

Ersetze `<your-profile>` durch den tatsächlichen Profilnamen:

```bash
dsh plugin --profile <your-profile> add ./dsh-agent-compare-0.2.0-alpha.17.tgz
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

Eine [`.agent-compare.json` im Projektstamm](examples/vite-react-demo/.agent-compare.json) kann gemeinsame Eingaben, Klicks, Texte, Sichtbarkeit, Elementanzahl und Bildschirmgrößen festlegen. Die Definition wird vor der Generierung validiert. Eine nicht ausgeführte explizite Seitenabnahme verhindert die direkte Übernahme. Fehlt lediglich die einfache Ladeprüfung, wird eine Warnung angezeigt. HTTP-Erreichbarkeit, erfolgreicher Build, erfüllte Funktion und persönliche Präferenz sind unterschiedliche Ergebnisse.

## Übernahme, Rücknahme und Wiederherstellung

Die Übernahme kombiniert den aktuellen Arbeitsbaum mit den vom Vorschlag geänderten Pfaden. Erkannte Überschneidungen stoppen den Vorgang. Änderungen an anderen Dateien werden zusammen mit dem Vorschlag in einer temporären Kopie geprüft. Inhalt, HEAD und Index werden vor dem Schreiben erneut kontrolliert; ein Wiederherstellungsjournal wird gespeichert.

Eine Übernahme in den Arbeitsbaum erzeugt keinen automatischen Commit, führt keinen Push aus und wechselt keinen Branch. Neue, gelöschte und binäre Dateien sind enthalten. Ein Vorschlag, der die Kriterien nicht erfüllt, kann als Prüfbranch gespeichert werden. Bei Rücknahme oder Wiederherstellung bleiben erkannte spätere Bearbeitungen als Konflikte zur Prüfung erhalten.

Die Repository-Sperre koordiniert Plugin-Vorgänge, sperrt jedoch keine externen Editoren. Pausiere Änderungen während der kurzen Schreibphase.

## Verlauf und Seitenzustand

Der Verlauf zeigt standardmäßig alle Gespräche, mit Filter für das aktuelle Gespräch, Suche nach Aufgabe, Repository oder Kennung und 30 Einträgen pro Seite. Ergebnis, Wahl und Übernahme bleiben gespeichert. Hinweise werden an dasselbe Gespräch zugestellt und bei vorübergehender Nichtverfügbarkeit erneut versucht. Lange Protokolle werden nicht vollständig in den Hauptkontext eingefügt.

Alte oder beschädigte Aufzeichnungen bleiben mit Begründung schreibgeschützt erhalten. Nach einem Neustart werden gespeicherte Prüfbilder von laufenden Anwendungen unterschieden. Ist die Kopie noch vorhanden, kann die Vorschau neu gestartet werden. Jeder Start erhält eine neue `.localhost`-Adresse, damit Cookies und Origin-Speicher nicht zwischen den Vorschlägen geteilt werden. Temporärer Seitenzustand wird zurückgesetzt; Vergleichsaufzeichnungen und Bilder bleiben erhalten.

## Kompatibilität und Grenzen

Ein Worktree ist keine vollständige Sicherheitsgrenze. Das Plugin nutzt die DSH-Schreibrichtlinie; unter Windows wird sie als **partial** gemeldet. Dateilesen und Netzwerk sind nicht isoliert. Eingebettete Cookies folgen den Browserrichtlinien; ein externer Tab kann einen anderen Speicherkontext verwenden. Anmeldung, externe Backends und gemeinsam genutzte Datenbanken liegen außerhalb des aktuellen Umfangs.

Installation und Prüfungen mit npm wurden ausgeführt. macOS und der vollständige Ablauf mit pnpm/yarn sind noch nicht verifiziert. Auch Kombinationen verschiedener Modellanbieter und aktuelle Leistungswerte eines vollständigen Ablaufs mit externem Modell benötigen weitere Prüfung. Siehe die [ausführliche Kompatibilitätsmatrix](README.en.md#compatibility).

## Laufzeit, Kosten und Nachweise

Beide Vorschläge verbrauchen Generierung. Parallele Ausführung garantiert weder geringere Kosten noch kürzere Dauer. Du kannst einen Vorschlag oder beide stoppen. Nach Ablauf der Grenze werden bereits geschriebene Änderungen geprüft. Nicht gemeldeter Verbrauch wird als unbekannt und niemals als null dargestellt.

Die [CI](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/actions/workflows/ci.yml) prüft Windows/Linux, Node und den Browser. Ein Teil der aktuellen Integrationstests nutzt echte Sitzungen, Werkzeuge und Anwendungen mit einem lokalen Adapter mit festen Antworten. Das belegt die Ausführung, nicht die Qualität eines externen Modells. Historische Fälle mit echten Modellen stammen aus DSH 0.2.1-rc.3; sie sind weder Modellranking noch allgemeines Leistungsversprechen.

## Mitwirken und Lizenz

Gib in einem [Issue](https://github.com/lijiaqi-AI-Product-Manager/dsh-agent-compare/issues) Versionen, Betriebssystem, Schritte sowie erwartetes und beobachtetes Ergebnis an. Veröffentliche keine Zugangsdaten, privaten Quelltexte oder vollständigen lokalen Pfade. Weitere Hinweise stehen in [CONTRIBUTING.md](CONTRIBUTING.md) und [CHANGELOG.md](CHANGELOG.md).

```bash
npm ci
npm run typecheck
npm test
npm run test:ui
```

Lizenz: [MIT](LICENSE). Wenn ein brauchbares Ergebnis entsteht, kannst du das Projekt mit einem Star oder einem reproduzierbaren Beispiel unterstützen. Teilen und Stars sind freiwillig.

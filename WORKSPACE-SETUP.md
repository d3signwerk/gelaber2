# Gelaber2 Projekt-Setup

Dieses Dokument beschreibt die wichtigsten Schritte, um das Projekt `gelaber2` auf einem anderen PC weiterzuentwickeln.

## Voraussetzungen

- Node.js installiert (empfohlen: aktuelle LTS-Version, z. B. 18.x oder neuer)
- npm ist installiert und verfügbar
- Git ist installiert, falls das Repository geklont werden soll

## Repository klonen

```bash
git clone <repo-url> gelaber2
cd gelaber2
```

> Ersetze `<repo-url>` durch die URL des Git-Repositorys.

## Abhängigkeiten installieren

Im Projektordner ausführen:

```bash
npm install
```

## Projekt starten

Entwicklungsserver starten:

```bash
npm run dev
```

Danach die im Terminal angezeigte URL im Browser öffnen. Standardmäßig ist das meist `http://localhost:5173`.

## Build für Produktion

```bash
npm run build
```

## Vorschau des Builds

```bash
npm run preview
```

## Wichtige Projektdateien

- `package.json` – Projektabhängigkeiten und NPM-Skripte
- `vite.config.js` – Vite-Konfiguration
- `tailwind.config.js` – Tailwind CSS-Konfiguration
- `postcss.config.js` – PostCSS-Konfiguration
- `src/main.jsx` – Einstiegspunkt für die React-App
- `src/App.jsx` – Hauptkomponente
- `src/components/TextPlayer.jsx` – Text-to-Speech-Komponente
- `src/services/` – externe Service-Wrapper wie Firebase, ElevenLabs und Mistral
- `src/i18n/` – Übersetzungsdateien und i18n-Setup

## Besonderheiten

- Die Anwendung verwendet React mit Vite und Tailwind CSS.
- Text-to-Speech läuft über die Web Speech API in `src/components/TextPlayer.jsx`.
- Übersetzungen werden über `react-i18next` verwaltet. Unterstützte Sprachen: Deutsch (`de`), Englisch (`en`), Türkisch (`tr`), Russisch (`ru`), Arabisch (`ar`), Persisch (`fa`). Alle Sprachdateien liegen in `src/i18n/` und werden in `src/i18n/i18n.js` registriert.
- Firebase wird in `src/services/firebase.js` eingebunden.

### Stimmenauswahl (Web Speech API)

`TextPlayer` verwendet den Modul-Helper `getVoices()` (außerhalb der Komponente), um Stimmen asynchron zu laden – notwendig, weil Chromium-Browser die Stimmen erst nach dem `voiceschanged`-Event bereitstellen.

Die Stimmenauswahl ist vollständig in `speakText(text, lang)` gekapselt:
1. `cancel()` + 150 ms Delay, damit der Browser den laufenden Sprechvorgang vollständig abbricht
2. Exakte Übereinstimmung `voice.lang === lang` (z. B. `de-DE`)
3. Teilübereinstimmung `voice.lang.startsWith('de')` als Fallback
4. `null` → Browser-Default, falls keine Stimme gefunden

Die Funktion ist ein sauberes `async`-Pattern (kein `new Promise(async ...)` Anti-Pattern): Async-Vorbereitung zuerst (`cancel`, `getVoices`), dann ein einziges `return new Promise(...)` für das eigentliche Sprechen.

**Hinweis:** `PatientView.jsx` übergibt noch den ElevenLabs-`voiceId`-Prop an `TextPlayer`, der dort aber nicht mehr destrukturiert wird und von React stillschweigend ignoriert wird. ElevenLabs-TTS läuft separat über `src/services/elevenlabs.js`.

## Tipps für Weiterarbeit

- Achte beim Arbeiten an `TextPlayer.jsx` auf `speechSynthesis`-Zustand und Browserautoplay-Restriktionen.
- Wenn Änderungen am Build nötig sind, nutze `npm run build` und `npm run preview`.
- Bei Problemen mit Abhängigkeiten ggf. `npm ci` verwenden, um eine saubere Installation mit `package-lock.json` zu erzwingen.

## Optional

Falls Du auf einem anderen PC arbeitest, kannst Du diesen Ordner als ZIP exportieren oder per Git klonen, um die gesamte Struktur und die Dokumentation mitzunehmen.

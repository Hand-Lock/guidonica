# 0104. Engine Entry Point

- **Status**: Accepted
- **Date**: 2026-10-15
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0058](0058-music-font-audit-and-bravura-subset.md), [0059](0059-localization-and-national-note-naming.md), [0067](0067-contribution-licensing-dco-and-trademark-policy.md), [0078](0078-release-channels-calver-changelog-whats-new.md), [0103](0103-embeddable-engine-seams.md)

## Context & Problem Statement

ADR 0103 opened the engine's inputs: a seedable generator, drawing at an explicit beat, audio
into any `BaseAudioContext`, sized and SVG rendering. The paid builds of ADR 0067 consume that
engine as a dependency of a separate, private repository, pinned to a release tag of this one.
Three things kept the engine from being imported on its own:

- **Build constants at load time.** `__APP_CHANNEL__` and the other `__APP_*` constants exist only
  through this repository's `vite.config.ts` (ADR 0078). `src/storage.ts` reads
  `__APP_CHANNEL__` when the module loads (`STORAGE_KEY`, `LEGACY_KEYS`), so importing
  `DEFAULT_APP_SETTINGS` from it elsewhere throws a `ReferenceError`.
- **The UI language inside the buffer.** `src/scroller/buffer.ts` imported `noteLabels` from
  `src/i18n/index.ts`. That pulled in the locale runtime, which reads `__APP_CHANNEL__` and the
  DOM, and it tied the drawn labels to the app's current UI language. An embedder needs to name the
  language itself.
- **No defined surface.** An embedder would deep-import `src/...` paths that can move at any
  time, with nothing in this repository noticing.

## Decision

### 1. One barrel, `src/engine.ts`

`src/engine.ts` only re-exports; it holds no logic. It exports:

| Area | Exports |
| --- | --- |
| Generation | `MusicGenerator`, `mulberry32`, `Random` |
| Notation | `MeasureRenderer` (canvas and SVG), `MUSIC_FONT_FAMILY`, `isMusicFontReady`, `waitForMusicFonts` |
| Scroller | `MeasureBuffer`, `labelResolver`, `LabelResolver`, `ScrollerView`, `FixedViewport` |
| Audio | `MetronomeEngine`, `BeatInfo` (`ScrollerView` still takes a metronome), `clickTrack`, `scheduleClicks`, `clickAccent`, `Click`, `ClickTrackOptions`, `createMixer`, `Mixer`, `createDroneVoice`, `droneFrequency`, `DroneVoice` |
| Settings, meters, types | everything in `src/notation/types.ts` (`AppSettings`, `DEFAULT_APP_SETTINGS`, `NoteNames`, `METER`, `secondsPerBeat`, `getBeatsPerMeasure`, `CANVAS_PALETTE`, …) |
| Presets | everything in `src/presets.ts` (`LEVEL_PRESETS`, `buildPresetSettings`, …) |

### 2. The `exports` map

`package.json` gains:

```json
"exports": {
  "./engine": "./src/engine.ts",
  "./locales/*": "./src/i18n/locales/*.ts"
}
```

The package stays `private: true`: a git dependency is installed straight from the tag
(`"guidonica": "github:Hand-Lock/guidonica#v<version>"`), never from a registry. The sources ship
as TypeScript and the embedder's bundler compiles them.

An `exports` map also closes every path it does not list, so `guidonica/src/...` deep imports stop
resolving. That is why the locales get their own entry instead of a documented deep path: each
`src/i18n/locales/<lang>.ts` is pure data (its imports are type-only), and an embedder passes its
`noteNames` to `labelResolver`. Nothing in this repository imports the package by its own name, so
the map does not change how Vite or Vitest resolve anything here.

### 3. App modules the engine never reaches

The engine's import graph, type-only imports included because the embedder's `tsc` follows them,
must never reach:

| Module | Why |
| --- | --- |
| `main.ts`, `summary.ts` | App bootstrap and DOM wiring |
| `state.ts`, `storage.ts` | localStorage and the channel's key namespace (`__APP_CHANNEL__`) |
| `i18n/index.ts` | The UI language, `document`, `__APP_CHANNEL__` |
| `whatsNew.ts`, `share.ts` | Release notes (`__APP_VERSION__`), the location fragment |
| `utils/serviceWorker.ts` | Registration for this site only |
| `env.d.ts` | Declares the build constants, which an embedder does not define |

No reachable file may contain an `__APP_` identifier, and the engine reaches nothing under
`src/i18n/` at all. The locales' graphs meet the same rules.

### 4. Defaults beside their type

`DEFAULT_APP_SETTINGS` moves from `src/storage.ts` to `src/notation/types.ts`, next to
`AppSettings` and `DEFAULT_TUPLET_OPTIONS`, which are its only dependencies. `storage.ts`
re-exports the same object, so `main.ts` and the tests that import it from storage are unchanged.
Its `language: 'en'` stays a placeholder: the app replaces it with the detected language on load.

### 5. The label table is injected

```ts
type LabelResolver = (mode: SolfegeLabelMode) => readonly string[] | null;
new MeasureBuffer(generator, renderer, labels: LabelResolver);
```

The argument is required, like ADR 0103's required internal sources, so no caller can silently
lose its labels. The app passes `noteLabels` from `src/i18n`, which reads the current UI language
on every render, so labels still follow a language switch. An embedder passes a fixed language:

```ts
import { MeasureBuffer, labelResolver } from 'guidonica/engine';
import it from 'guidonica/locales/it';
new MeasureBuffer(generator, renderer, labelResolver(it.noteNames));
```

`NoteNames` (`{ syllables, letters }`, both `readonly string[]`) is the shape every locale's
`noteNames` already has; the engine names it without importing the `Messages` type, whose module
lives under `src/i18n/`. `src/notation/preview.ts` keeps calling `noteLabels` directly: the intro
thumbnails are app UI, not engine.

### 6. What an embedder provides

- A bundler that understands Vite's `?url` asset imports: `src/notation/fonts.ts` imports the
  music font's woff2 that way and references `vite/client` types. In practice, Vite.
- `moduleResolution: "bundler"` (or `node16`/`nodenext`) so the `exports` map applies, and
  `strict` TypeScript like this repository.
- `vexflow` comes in as this package's own dependency; the engine imports only `vexflow/core`
  (ADR 0058).

## Verification

`tests/engine.test.ts`:

- The `exports` map points at existing files for `./engine` and each locale.
- The barrel is re-exports only.
- A static walk of the import graph from `src/engine.ts`, and from each locale, never reaches the
  modules above, never meets `__APP_` and, for the engine, nothing under `src/i18n/`. Vitest gets
  the build constants through `vite.config.ts`, so loading the module in a test cannot prove their
  absence; the graph walk is the guarantee.
- `labelResolver` returns `null`, the syllables or the letters of every locale.
- A round trip through the barrel alone: a seeded generator, a buffer with German letters, a
  `ScrollerView` on a fixed viewport, `renderAt(0)`. The frame blits measures, every drawn label is
  a German letter, and the same seed draws the same measures.

## Consequences

**Positive:**
- The engine loads without this repository's build configuration, storage or UI language.
- One documented surface: an embedder imports `guidonica/engine` and `guidonica/locales/*`, and
  everything else is private to this repository.
- The boundary is tested here, so an app-only import into an engine module fails this repository's
  CI before any release reaches an embedder.

**Negative:**
- The barrel is public API. Renaming or removing anything it exports, or changing an exported
  signature, breaks embedders on their next tag bump; such changes get an `Internal` changelog
  bullet that says so.
- `export *` of `types.ts` and `presets.ts` makes their whole content public, a wider surface than
  an embedder may need. It keeps the barrel free of a hand-kept list that would drift.
- Embedders must bundle with Vite (or a `?url`-compatible bundler) until the font import changes.

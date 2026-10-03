# 0050. Procedural Notation Previews in the Onboarding Intro

- **Status**: Accepted; amended by [0051](0051-intro-preview-representation-presets.md), [0052](0052-intro-preview-signature-check.md)
- **Date**: 2026-10-03
- **Author**: Claude & lauseta

## Context & Problem Statement

- The first-visit intro (ADR 0049) asked "What's your level?" and "Which clef do you read?" with text-only cards. A newcomer has to imagine what "sixteenths & triplets" or "C clef on the fourth line" look like.
- Each level card should show a musical example, and each clef card should show its clef glyph.
- Constraints: no image assets, no new dependencies, generator untouched (AGENTS.md §1, §3.5), app zoom and memory discipline unaffected.

## Decision & Implementation

### 1. `src/notation/preview.ts`: thumbnails composited from the real renderer

- A module-private `MeasureRenderer` with its own zoom and DPR, set per call. The app renderer, and with it the user's zoom, is never touched.
- **`renderLevelPreview(target, settings)`**
  - A fresh `MusicGenerator` calls `generateMeasure(i, settings, startBeat)` bar after bar until a 640 CSS px strip is full (at most 12 bars). Barline ties and `tieIn` therefore behave exactly as in the scroller.
  - Each bar is rasterized by `renderMeasure(data, theme, solfegeLabelMode)` and blitted with `drawImage` at its running x, the same blitting model the scroller uses. Five staff lines (`CANVAS_PALETTE[theme].staff`) and the `renderPinnedClef` header sit underneath.
  - Geometry, in measure-canvas units at `STRIP_SCALE = 0.42`:
    - vertical crop y 12 → 196 (77 CSS px), which leaves room for 3 ledger lines, beams, tuplet brackets and solfège labels;
    - the header advances 88 units;
    - the first bar's left barline is clipped (3 units), because a strip opens without one.
- **`renderClefIcon(target, clef, theme)`**: the clef alone on a 56 × 92-unit staff fragment at `ICON_SCALE = 0.5` (28 × 46 CSS px). Because the staff is drawn, alto and tenor read apart: the C clef is centred on line 3 in one and line 4 in the other.
  - `MeasureRenderer.renderPinnedClef` now takes `timeSignature: TimeSignature | null` and skips `addTimeSignature` for null. The scroller call site is unchanged.
- **`releasePreview(canvas)`**: zeroes a canvas's backing store. Every intermediate header and bar canvas is released straight after it is blitted, following the buffer's eviction discipline.

### 2. Wiring (`src/main.ts`)

- `buildIntroOptions` items take an optional `preview: 'strip' | 'icon'` and append a decorative `<canvas aria-hidden="true">`. The card text already describes each option.
  - Clef cards wrap their text in `.intro-option-text`, so the icon leads the row.
  - Canvases are kept in `introLevelPreviews` / `introClefIcons` maps.
- `renderIntroPreviews()`: each level strip uses `{ ...globalState.settings, ...buildPresetSettings(level, introClef) }`, which is the preset's exact Ω in the chosen clef, with the current theme (since ADR 0051: `buildPreviewSettings`, a narrowed representation of it).
- **Triggers**:
  - `openIntro()` renders after `fontInitPromise` resolves. On a first visit the intro opens before Bravura has loaded, and an early render would bake tofu into the bitmaps.
  - Every open draws new examples.
  - "Back" re-renders the strips only when the clef changed since they were drawn (`introPreviewClef`).
- **Release**: the dialog's `close` handler releases every preview canvas. It skips this when the intro has already been reopened, because `close` is dispatched as a task.
- No `AudioContext` is created or resumed (AGENTS.md §3.3).

### 3. CSS (`src/style.css`, intro block)

- `.intro-option-preview`:
  - `width: 100%`, fixed height, `object-fit: cover; object-position: left center`. The 640 px strip is cropped on the right, not scaled, so notation is the same size on every card at any width.
  - A right-edge `mask-image` fade, as the scroller fades its margins.
- `.intro-options-clefs .intro-option` switches to a centred row (icon, then text). Its LED is centred vertically, like the settings chips.
- The canvases are transparent over the acrylic card. Ink and staff colours come from `CANVAS_PALETTE` for the resolved theme.

## Consequences

- **Ergodicity untouched**: the generator code is unchanged. A strip is a plain sample from it, with no resampling. Originally it sampled the preset's exact Ω, so an example could be sparse (a Virtuoso strip could show a whole note); ADR 0051 now narrows each strip to a published representation Ω ⊆ preset Ω. The examples change on every open.
- **Linear spacing shows**: beat width grows with the finest subdivision, so denser levels fit fewer beats into the same pixels. This is the scroller's real proportional layout.
- **Cost**: about 0.9 kB gzipped JS and 0.1 kB CSS, with no assets or dependencies. Nine small canvases exist only while the intro is open.
- **Maintenance**: the CSS heights mirror `STRIP_*` / `ICON_*` constants in `preview.ts` (commented at both ends). Retuning the scale or crop means editing both.

# 0113. High Contrast

- **Status**: Accepted
- **Date**: 2026-10-21
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0002](0002-light-theme-standardization.md), [0016](0016-default-woodblock-metronome-and-auto-theme.md), [0085](0085-shareable-exercise-links.md), [0091](0091-jank-free-beat-and-measure-frames.md), [0103](0103-embeddable-engine-seams.md), [0104](0104-engine-entry-point.md), [0107](0107-nightly-icon.md)

## Context & Problem Statement

The Liquid Glass look (translucent panels, `backdrop-filter` blur, gradients, glows, slate-grey
staff lines `#64748b`) is pleasant but weak for low-vision readers, in bright rooms and on
projectors. Operating systems expose an "Increase contrast" preference (`prefers-contrast: more`)
and Windows contrast themes (`forced-colors: active`); the app ignored both.

A high-contrast mode has to reach two very different surfaces: the notation, which is VexFlow
rasterized once per measure onto offscreen canvases (ADR 0091) and coloured from
`CANVAS_PALETTE`, and the chrome, which is CSS driven by custom-property tokens.

## Decision & Implementation

1. **A per-user setting, orthogonal to the theme.** `AppSettings.contrast: ContrastMode`, with
   `CONTRAST_MODES = ['auto', 'standard', 'high']` and default `'auto'`, validated by `pickEnum` in
   `src/storage.ts`. It is a select under Settings → Display, next to Theme: Auto (OS), Standard,
   High. It combines with Light/Dark, giving a high-contrast light and a high-contrast dark mode.
   Like the theme it belongs to the reader, so exercise links (ADR 0085) never encode it.

2. **OS detection.** One cached `MediaQueryList` on
   `(prefers-contrast: more), (forced-colors: active)`, the same pattern as `isSystemDark()`
   (cheap enough to poll per frame, ADR 0091). `isSystemHighContrast()`, `resolveContrast(mode)`
   (true for `high`, or `auto` with the query matching) and `subscribeSystemContrast(cb)` live in
   `src/notation/types.ts`; `subscribeSystemTheme` and it share one `subscribeQuery` helper with the
   Safari < 14 `addListener` fallback. `main.ts` re-applies on a system change while the mode is
   `auto`.

3. **Two more canvas palettes.** `CanvasTheme = ResolvedTheme | 'light-high' | 'dark-high'`, and
   `CANVAS_PALETTE: Record<CanvasTheme, CanvasPalette>`. `CanvasPalette` gains `staffWidth`
   (1 standard, 1.5 high), used for the staff lines in the scroller, the page view's closing
   barline and the intro thumbnails.

   | | bg | staff, ink, tuplet | solfège labels | playhead | band α |
   |---|---|---|---|---|---|
   | `light-high` | `#ffffff` | `#000000` | `#00513f` | `#b0002a` | 0.12 |
   | `dark-high` | `#000000` | `#ffffff` | `#00ffcc` | `#ff6b85` | 0.18 |

   Every ink colour meets WCAG AAA (≥ 7:1) against its background; labels keep the Olo hue so they
   stay distinct from noteheads. `canvasTheme(theme, contrast = 'standard')` resolves the key
   (`` `${resolveTheme(theme)}-high` `` when contrast resolves high), and `canvasPalette(theme)`
   looks it up. Every caller that used `CANVAS_PALETTE[resolveTheme(settings.theme)]` (buffer,
   scroller, page view, previews, intro icons) now passes `canvasTheme(settings.theme,
   settings.contrast)`. The pinned-clef and system-header caches are keyed by `CanvasTheme`, so a
   contrast change invalidates them without extra code; `main.ts` re-renders the buffer and the
   intro previews, the same path as a theme change.

4. **Engine API stays additive (ADRs 0103, 0104).** `MeasureRenderer` methods widen
   `theme: ThemeMode` to `ThemeMode | CanvasTheme`, and `canvasTheme`'s contrast parameter defaults
   to `'standard'`. An embedder passing `'auto' | 'light' | 'dark'` gets exactly the previous
   output; the new names are reachable through `guidonica/engine`'s `export *`.

5. **Chrome: token overrides, then a few targeted rules.** `<html data-contrast="high">` is set
   only when contrast resolves high, by the inline boot script before first paint (no standard
   flash on reload) and by `main.ts` afterwards. `src/style.css` has two token blocks,
   `[data-contrast='high']` and `[data-contrast='high'][data-theme='dark']`, placed after the
   nightly blocks so they win at equal specificity: black/white text, opaque glass, `--glass-blur:
   none`, no background gradient, full-contrast borders, flat gel and amber fills, a two-ring focus
   ring (`0 0 0 2px bg, 0 0 0 5px ink`), glows replaced by `0 0 transparent` (valid inside the
   comma-separated shadow lists where `none` would not be), and `--canvas-bg`/`--playhead-color`
   matching the canvas palettes. The dark block restates every token of the light block, and
   `[data-channel='nightly'][data-contrast='high']` (light and dark) gives nightly a
   high-contrast violet accent (`#3a2a9c` / `#c7bfff`), so the channel stays recognisable
   (ADR 0107). What tokens cannot reach gets a short rule section: 2px borders on panels, buttons,
   selects, chips and wells; an opaque bar and dock without the sheen; no `text-shadow` on the
   playing button; no blur behind dialogs; focus mode dims the bar and zoom pill to 0.75 instead
   of 0.4 (`--focus-dim`), so their text keeps ≥ 7:1.

6. **Forced colors.** Under `@media (forced-colors: active)` the system colours paint the chrome.
   Only the beat LEDs, checkbox dots and range inputs opt out (`forced-color-adjust: none`) and are
   repainted with `Canvas`, `CanvasText` and `Highlight`, because forced colours would erase their
   gradient fills and leave them invisible. The selected tab and checked chips get a `Highlight`
   border. The canvas follows the high-contrast palettes, since the query also resolves Auto high.

## Consequences

- High contrast is the one documented exception to the glass materials of the Design Manifesto.
- A new canvas colour needs a value in all four palettes; `tests/canvasPalette.test.ts` checks the
  palettes, the CSS tokens that mirror them, the 7:1 ratios, the dark blocks restating their light
  blocks, and the nightly high-contrast accent.
- The run-guidonica driver gained `--contrast auto|standard|high` and
  `--os-contrast more|forced` to screenshot the modes.
- Playwright's Chromium emulates `forced-colors` with its own palette; a real Windows contrast
  theme should still be checked by hand.

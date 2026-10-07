# 0045. Aero-Guidonica 2: Material Hierarchy & Responsive Redesign

- **Status**: Accepted; amended by [0054](0054-responsive-header-fit-audit.md), [0097](0097-stage-first-shell.md)
- **Date**: 2026-10-02
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A design audit of the app against `docs/DESIGN_MANIFESTO.md` found problems in six areas.

- **No hierarchy**:
  - Brand, transport, tempo, LEDs and utilities had equal weight, and every surface used the same half-split gel gloss.
  - The live BPM, the most important value, appeared only as an 11px label.
  - The desktop drawer was one flex-wrapped row of about 18 unordered controls.
  - The header's `::before` sheen cut a hard 49/50% line through the open drawer.
- **Manifesto violations**:
  - Touch targets of 24–33px, where the manifesto requires ≥ 36px.
  - White text on the bright Olo gel (≈ 2.3:1) and on the amber *Playing* gel (≈ 2.1:1).
  - `font-weight: 600` with no 600 face loaded.
  - `transition: all` used throughout.
- **Cross-platform drift**: emoji icons (ℹ️ 🌓 ⚙️ 🔊 ▶ ⏸ ↺ ♬ ✕) render differently on Windows, Android, Linux and Apple.
- **Canvas palette drift**:
  - The canvas playhead was `#dc2626`, while CSS used `#e11d48`/`#f43f5e`.
  - In dark mode, the stationary staff was `#475569`, but VexFlow ledger lines and barlines were `#94a3b8`.
  - Solfège labels used the system font.
- **Mobile bugs**:
  - `100vh` ran under the browser bars, and there were no safe-area insets.
  - The 13px number input triggered iOS focus-zoom.
  - Hover states stuck after taps.
  - The 350px tuplets popover was clipped inside the drawer's scroll box.
  - The scroller listened only to `window.resize`, so opening the in-flow mobile drawer shrank the wrapper without resizing the canvas backing store.
- **Redundancy**:
  - Three About entry points.
  - Two complete zoom UIs (drawer slider/steppers plus canvas pill).
  - A dead duplicated `prefers-color-scheme` dark block (about 80 lines).
  - Music SVG paths duplicated between chips and tuplet headers.
  - No favicon (a 404 on every load) and no `theme-color`.

## Decision & Implementation

### 1. Material hierarchy (manifesto §3)
Each surface uses exactly one of four materials, so that importance is signalled by material:

| Tier | Material | Used for |
|------|----------|----------|
| 1 | **Gel** | Play/Pause, lit LEDs, slider beads, tuplet counter, checked tuplet cells |
| 2 | **Acrylic** | Buttons, chips, selects, keycaps |
| 3 | **Glass** | Header, overlay sheet, popover, zoom pill, modal, footer |
| 4 | **Well** | Section cards, BPM readout, LED capsule, tracks |

The half-split sheen is gone; only the hero gel keeps a gloss cap (`::before`).

The header glass is painted on `.control-panel::before` (`z-index: -1`). Otherwise the header would become a backdrop root, and the nested mobile sheet could not blur the canvas.

### 2. Tokens & contrast (`src/style.css`, full rewrite)
- Shared `:root` tokens:
  - fonts;
  - radii 6/10/14/999;
  - `--hit` 36px, rising to 44px under `(pointer: coarse)`;
  - `--chip` 30px, rising to 40px;
  - `--thumb` 18px, rising to 22px;
  - `--field-font` 13px, rising to 16px.
- Two theme blocks. The `prefers-color-scheme` duplicate is deleted, because the head script always sets `data-theme`.
- **Ink-on-gel rule**:

  | Gel | Ink | Contrast |
  |-----|-----|----------|
  | Light hero, deepened to `#17a387 → #00826a → #006e58` | white | 4.8:1 at mid-body |
  | Dark hero, bright Olo | `#00261e` | ≥ 8:1 |
  | Amber *Playing* | `#3a1d00` | ≥ 7:1 |

  Muted text is `#4b5d75` (6.7:1) in light mode and `#94a3b8` (7:1) in dark mode.
- Weights are limited to 400/500/700. The Google Fonts URL is trimmed to the faces actually used.
- Every transition names its properties explicitly. Every `:hover` is inside `@media (hover: hover)`. `prefers-reduced-motion` disables animations and transitions.

### 3. Vector icon sprite (`index.html`)
- One hidden `<svg class="sprite">` holds the `<symbol>`s.
- **UI icons** (`i-play|pause|reset|info|sun|moon|auto|gear|speaker|muted|close|chevron|tuplet`): 16-unit grid, stroke 1.75, `currentColor`.
- **Music glyphs** (`g-quarter … g-playhead`): their original viewBoxes, with the fills stripped so they inherit `currentColor`.
- `<use>` scales "meet" into its box, so each `.icon-*` class sets an explicit em width and height derived from the glyph's aspect ratio.
- Icon state is pure CSS:
  - play ↔ pause via `.playing`;
  - the theme icon via `#btn-theme-toggle[data-mode]`;
  - speaker ↔ muted via `.btn-mute.muted` plus `aria-pressed`.
- The fullscreen SVG stays inline and unchanged (ADR 0034, `fullscreen.test.ts`).
- The head gains:
  - an inline SVG favicon (an Olo notehead on `#00261e`);
  - light and dark `theme-color` metas;
  - `viewport-fit=cover`.

### 4. Header & tempo
- The header is laid out with grid areas:

  | Width | Rows |
  |-------|------|
  | > 960px | `brand transport tempo beats utils` |
  | ≤ 960px | `brand . utils` / `transport tempo beats` |
  | ≤ 600px | `brand utils` / `transport beats` / `tempo tempo` |

  At ≤ 600px the Play button stretches, and the Reset and Settings labels collapse to icons.
- `#bpm-display` is removed. The BPM is shown as a recessed LCD well: `#tempo-number` in Ubuntu Mono 22px with a "BPM" unit.
- Above the well, `#tempo-term` shows the Italian marking from the new pure function `tempoMarking(bpm)` in `types.ts`. Bands use upper-exclusive bounds:

  | BPM | Marking |
  |-----|---------|
  | < 40 | Grave |
  | 40–59 | Largo |
  | 60–65 | Larghetto |
  | 66–75 | Adagio |
  | 76–107 | Andante |
  | 108–119 | Moderato |
  | 120–155 | Allegro |
  | 156–175 | Vivace |
  | 176–199 | Presto |
  | ≥ 200 | Prestissimo |

- The header GitHub icon is removed. The repository link stays in the footer and in the About modal, which preserves AGPL §13 source availability.

### 5. Sectioned settings & responsive drawer
- `#controls-drawer > .drawer-inner` holds four `<section class="settings-section">` well cards, each with an Alegreya-italic `<h2 class="section-title">`:
  - **Staff**: clef, ledger lines, meter, 6/8 pulse.
  - **Rhythm**: note values, tuplets, rests, ties.
  - **Melody**: intervals.
  - **Practice**: labels, count-in, playhead, click, volume, theme.
- Every input id, `data-tuplet`/`data-value` attribute and `<label class="checkbox-item"><input><span>` pattern is preserved. The `main.ts` change handlers are untouched.
- **Chips**:
  - The input is clipped to 1px and stays focusable.
  - The span is an acrylic pill with a 7px LED tell.
  - `:checked` gives it an Olo tint and a lit LED; `:focus-visible` draws the ring on the span.
- **Desktop (> 961px)**:
  - The drawer is in-flow: a 4-column card grid (2 columns at 961–1279px), open by default and collapsible.
  - `main.ts` opens it from `matchMedia('(min-width: 961px)')` and follows that query's `change` events.
- **≤ 960px**:
  - The drawer is an absolutely positioned glass sheet under the header (`top: 100%`, `max-height: calc(100dvh − header)`, internal scroll, `overscroll-behavior: contain`).
  - It is shown through `opacity`/`transform`/`visibility` transitions.
  - The canvas no longer reflows, and a `pointerdown` on the canvas closes the sheet.
  - The tuplets popover becomes a static, full-width in-flow accordion, so it can no longer be clipped. The footer is hidden.
- The drawer zoom group (`#zoom-slider`, `#zoom-display`, `#btn-zoom-*`) and the drawer About button are removed. The canvas pill, the `+`/`-`/`0` keys and pinch-zoom remain; the pill's Auto label gets an `.active` state.

### 6. Canvas palette unification (`types.ts`, `scroller.ts`, `renderer.ts`, `fonts.ts`)
- `CANVAS_PALETTE: Record<ResolvedTheme, CanvasPalette>` replaces the scroller's local `PALETTE` and the renderer's inline colour ternaries.

  | | background | staff/ledger | ink | tuplet | solfège | playhead |
  |---|---|---|---|---|---|---|
  | Light | `#ffffff` | `#64748b` | `#000000` | `#334155` | `#007a62` | `#e11d48` |
  | Dark | `#0f172a` | `#64748b` | `#f8fafc` | `#cbd5e1` | `#00ffcc` | `#f43f5e` |

- `drawPlayhead` builds its gradient from `playheadRgb`.
- Solfège labels use `700 …px "Alegreya Sans"`. `waitForMusicFonts` also awaits `document.fonts.load('700 12px "Alegreya Sans"')`, and resolves harmlessly when offline.

### 7. Scroller resize via `ResizeObserver`
- `CanvasScroller` observes the canvas's parent with a `ResizeObserver` (falling back to `window.resize` where it is unavailable).
- A separate `window.resize` listener re-runs `handleResize` only when `devicePixelRatio` changes, for browser zoom and moves between monitors.
- `destroy()` disconnects both.
- The rAF loop and the audio clock are untouched.
- Collapsing the desktop drawer now grows the canvas immediately; verified 555 → 790 CSS px at 1440×900.

### 8. Layout safety
- `#app` uses `height: 100vh; height: 100dvh`.
- The header, footer, sheet and zoom pill pad with `env(safe-area-inset-*)`.
- Form controls use 16px text on coarse pointers.
- `.canvas-wrapper::after` paints a static 32px right-edge fade to `--canvas-bg`, with zero per-frame cost.

## Consequences

- **No feature removed**:
  - All settings, shortcuts, zoom paths, About entry points (header and footer), the count-in badge geometry and the beat-indicator, brand-badge and fullscreen test invariants are preserved.
  - Headless Chromium smoke runs confirmed:
    - Space play/pause and the icon swap;
    - Arrow-key tempo changes and the tempo term;
    - the 3-mode theme cycle;
    - mute;
    - enforcement of at least one interval and one subdivision;
    - per-meter disabling of tuplet cells;
    - the zoom keys and pill;
    - both About entry points;
    - no horizontal overflow at 1440×900, 1024×768, 390×844 and 844×390 in both themes.
- **Tests**:
  - `tests/tempoMarking.test.ts` checks every band boundary and coverage of 30–240 BPM.
  - `tests/canvasPalette.test.ts` asserts:
    - one staff and ledger colour;
    - the CSS `--playhead-color` and `--canvas-bg` equal `CANVAS_PALETTE`;
    - each rgb triplet matches its hex value.
- **Size**:

  | | Before | After |
  |---|---|---|
  | `style.css` source | 44.5 kB | 37.5 kB |
  | CSS, minified + gzipped | ≈ 6.0 kB | ≈ 6.5 kB |
  | `index.html`, gzipped | 8.2 kB | 8.8 kB |

  The minified CSS grows because of the new chip, section, tuplet-check and overlay-sheet components. `index.html` grows by the sprite, net of the de-duplicated music paths. No dependencies or image assets were added.
- **Rules for future UI work** (manifesto §5–§6):
  - New UI must pick one material tier.
  - New settings must join one of the four sections.
  - Icons must come from the sprite; no emoji.
  - New canvas colours belong in `CANVAS_PALETTE`.

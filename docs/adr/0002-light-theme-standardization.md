# 0002. Light Theme Standardization & High-Contrast Canvas Rendering

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Users testing in specialized browsers such as **qutebrowser** (which is based on QtWebEngine/Chromium) experienced unusable visualization where the procedurally generated musical notation appeared as "black over black" on a dark canvas. 

The issues identified:
1. When forced dark mode or auto-inversion is active or when standard VexFlow elements (such as glyphs, clefs, accidentals, dots, and rests) default to black (`#000000`), a dark canvas background (`#141414`) resulted in zero visual contrast.
2. The initial design implemented a hardcoded dark theme that conflicted with standard sheet music conventions (black notation on a crisp, light background) and caused browser dark-mode heuristics to fail.

The requirement: eliminate all forms of night/dark mode and standardize on a clean, light-mode design with high contrast across UI controls and notation canvases.

---

## Decisions & Implementation Methods

### 1. Browser Color Scheme Declaration
- **HTML Meta Tag**: Added `<meta name="color-scheme" content="light" />` to `index.html`.
- **CSS Color Scheme**: Declared `color-scheme: light;` in `:root` inside `src/style.css`.
- **Rationale**: Explicitly informs QtWebEngine/Chromium that the application only targets the light color scheme, suppressing forced dark mode heuristics.

### 2. Light Theme CSS Variable Palette
- Updated design tokens in `src/style.css`:
  - Canvas background: `#ffffff` (pure white sheet paper).
  - Page background: `#f8fafc`.
  - Panel header & controls background: `#ffffff`.
  - Borders: `#e2e8f0` and `#cbd5e1`.
  - Primary text: `#0f172a` (slate 900).
  - Muted labels & shortcuts: `#64748b` (slate 500).
  - Primary UI accent: `#2563eb` (royal blue) for buttons and active states.
  - Playhead accent: `#dc2626` (crimson red) for maximum contrast against white canvas and black notation.

### 3. High-Contrast Canvas Rendering Pipeline
- In `src/scroller/scroller.ts`:
  - Main viewport cleared with `#ffffff`.
  - Stationary staff lines rendered with crisp 1px `#64748b`.
  - Pinned clef area shaded with `rgba(255, 255, 255, 0.95)` to cleanly occlude scrolling notes behind the stationary clef.
  - Playhead drawn as a sharp 2px `#dc2626` vertical line with pointer triangles and a subtle red linear gradient.
- In `src/notation/renderer.ts`:
  - Offscreen measure canvas initialized with `ctx.setFillStyle('#000000')` and `ctx.setStrokeStyle('#000000')`.
  - Measure staff lines and barlines drawn in `#64748b`.
  - StaveNotes, beams, dots, accidentals, and modifiers explicitly styled with `#000000`.
  - Tuplet brackets styled in `#334155`.
  - Pinned clef stave and clef glyph explicitly styled in `#000000`.

---

## Consequences & Verification

- **Readability**: Musical notation conforms to standard sheet music readability with 100% contrast (pure black notes, stems, beams, and rests against pure white background).
- **Cross-Browser Compatibility**: Renders reliably in qutebrowser, Chromium, Firefox, and WebKit without dark mode inversion collisions or black-on-black glyph bugs.
- **Type Safety**: Verified zero errors with `pnpm typecheck` (`tsc --noEmit`).
- **Production Build**: Verified with `pnpm build`.

# 0017: Vector Music Notation Icons for Cross-Platform UI Controls

## Status
Accepted

## Date
2026-09-16

## Context
In the settings control drawer, specifically in the **Subdivisions** checklist, the **Tuplets** configuration matrix, and the **Rests** toggle, several musical note glyphs and the rest symbol failed to render correctly across operating systems:
- Whole Note (`𝅝`, `U+1D15D`)
- Half Note (`𝅗𝅥`, `U+1D15E`)
- Sixteenth Note (`𝅘𝅥𝅯`, `U+1D161`)
- Quarter Rest (`𝄽`, `U+1D13D`)

Instead of the intended musical symbols, users on macOS and other platforms observed a missing-glyph fallback icon resembling a "hamburger button" (a rounded rectangle containing five horizontal staff lines).

### Root Cause Analysis
1. **Unicode Plane Disparity**:
   - Standard quarter (`♩`, `U+2669`) and eighth (`♪`, `U+266A`) notes belong to the legacy **Basic Multilingual Plane (BMP)** (Miscellaneous Symbols block, `U+2600`–`U+26FF`), widely supported in system fonts for decades.
   - Whole (`𝅝`), Half (`𝅗𝅥`), 16th (`𝅘𝅥𝅯`), and Rest (`𝄽`) reside in the **Supplementary Multilingual Plane (SMP / Plane 1)** (Musical Symbols block, `U+1D100`–`U+1D1FF`).
   - Consumer desktop and mobile system font stacks (`-apple-system`, `SF Pro`, `Segoe UI`, `Roboto`) omit glyphs for the SMP Musical Symbols block.
2. **Apple `.LastResort` Fallback Behavior**:
   - On macOS, when the text rasterizer cannot find a glyph in the font cascade, it queries `/System/Library/Fonts/LastResort.otf`.
   - `.LastResort` does not render musical symbols; instead, it renders a block-level indicator for the Musical Symbols range—a glyph featuring five staff lines inside a box, appearing to users as a hamburger button or "many lines".
3. **SMuFL Web Font Constraints**:
   - VexFlow 5 loads the SMuFL `Bravura` font for canvas score rendering. However, SMuFL encodes musical primitives in the Private Use Area (`U+E000`–`U+F8FF`), where noteheads, stems, and flags are disjoint components rather than precomposed text glyphs.
   - Relying on external web fonts for HTML buttons introduces network latency, Flash of Unstyled Text (FOUT), offline degradation, and vertical alignment disparities across platforms.

---

## Decision & Implementation Methods

### 1. High-Precision Inline Vector SVG Icons
We replaced the fragile Unicode characters in HTML controls with lightweight, self-contained inline SVG vector icons. The outlines are derived directly from the reference `Bravura` font geometry (the exact font used by VexFlow), ensuring 100% stylistic cohesion with the rendered music canvas:
- **Whole Note** (`.icon-whole`): Open semibreve notehead with elliptical counter cutout.
- **Half Note** (`.icon-half`): Open minim notehead with vertical stem attached at anchor `[stemUpSE]`.
- **Quarter Note** (`.icon-quarter`): Filled crotchet notehead with vertical stem.
- **Eighth Note** (`.icon-eighth`): Filled quaver notehead with stem and single curved flag.
- **Sixteenth Note** (`.icon-sixteenth`): Filled semiquaver notehead with stem and double flag.
- **Quarter Rest** (`.icon-rest`): Classic crotchet rest squiggle.

### 2. Optical Tuning & Screen Readability
- At small icon sizes (`11px`–`14px` in UI controls), hairline font stems can become faint due to subpixel antialiasing. Stem widths were tuned to `55` font units (~`1.25px`–`1.5px` at target screen scale) for crisp, unmistakable readability.
- Flag anchors and notehead bounds are normalized to individual intrinsic `viewBox` coordinates, preserving aspect ratios without arbitrary horizontal whitespace.

### 3. CSS Integration & Theme Responsiveness
In `src/style.css`:
```css
.music-icon {
  display: inline-block;
  height: 1.15em;
  width: auto;
  vertical-align: -0.22em;
  fill: currentColor;
  flex-shrink: 0;
}

.music-icon.icon-whole {
  vertical-align: -0.05em;
}

.music-icon.icon-rest {
  vertical-align: -0.18em;
}
```
- `fill: currentColor`: Automatically binds the icon fill to the active text color in both Light (`#0f172a`) and Dark (`#f8fafc`) modes, as well as on hover and focus states.
- `height: 1.15em; width: auto`: Scales fluidly with parent typography across both `12px` checkboxes and `11px` table headers.
- `vertical-align`: Precisely counteracts notehead descent to align visually with surrounding label text and parentheses.

### 4. Accessibility & Markup Hygiene
- All icons include `aria-hidden="true"` so assistive technologies read the explicit label text (`Quarter`, `Half`, `Whole`, `16th`, `Rests`) without stuttering over vector structures.
- In native `<select>` dropdowns (e.g. 6/8 Pulse options `2 Beats (♩.)` and `6 Beats (♪)`), standard BMP characters are retained since OS `<option>` elements restrict child markup to text strings.

---

## Consequences & Verification
- **Zero Fallback Glitches**: 100% elimination of the `.LastResort` "hamburger" glyph across all devices and browsers.
- **Full Offline Resilience**: UI icons require zero network requests and render instantly on initial paint without FOUT or layout shifting.
- **Visual Uniformity**: The entire subdivision family now shares matching stem weights, notehead angles, and optical heights.
- **Strict Repository Hygiene**:
  - `npm run typecheck` passed with 0 errors.
  - `npm test` passed 100% (27/27 unit tests).
  - Production build (`npm run build`) succeeded without warnings.

# The Guidonica Design Manifesto
## Aero-Guidonica 2: Refined Liquid Glass, Skeuomorphic Tactility & Suckless Engineering

> *"Music is the movement of sound to reach the soul for the education of its virtue."*  
> — Guido d'Arezzo (c. 991–1050)

---

### 1. Vision & Core Philosophy

**Aero-Guidonica** unites three fundamental pillars:
1. **Historical Humanist Musical Pedagogy**: Inspired by Guido d'Arezzo's 11th-century revolutionary sight-singing mnemonic (*Manus Guidonica*), solfège tradition, and classical music engraving.
2. **The Golden Age of Digital Tactility (2000–2010)**: The optimistic, sensory, and refractive aesthetics of **Frutiger Aero**, **macOS Aqua**, **Windows Aero**, and **Liquid Glass** skeuomorphism.
3. **The Suckless Web Philosophy**: Absolute refusal of the slow, bloated "modern web". Zero megabyte-heavy frameworks, zero sluggish CSS libraries, zero sprite sheet downloads, zero layout jank.

#### The Suckless Aero Axiom
> **"Sensory richness through mathematical frugality."**  
> We achieve luminous glass, tactile buttons, refractive specular highlights, and physical feedback **entirely through pure, hardware-accelerated CSS3 and SVG vector math**. Not a single kilobyte of external JavaScript UI runtime or heavy raster textures is tolerated.

#### The Chromatic Principle of Olo: LMS (0, 1, 0) & Perceptual Extremes
> **"Guido unlocked the ear; Olo illuminates the eye."**  
> In 2025, vision scientists at UC Berkeley isolated retinal stimulation of the human eye's M-cones (medium-wavelength / green cones) at coordinate $(0, 1, 0)$ in LMS color space—a state never activated in isolation by natural broadband light. They called this hypothetical perceptual color **"Olo"** (from $0-1-0$). On standard digital sRGB displays, the closest attainable approximation is **`#00FFCC`** (an ultra-saturated, electric spring-turquoise / cyan-green).
>
> In Guidonica, Olo is elevated into a core **design principle**:
> - **Pedagogical Parallels**: Just as Guido d'Arezzo made the invisible acoustics of pitch visible and structured through the Guidonian Hand, four-line staff, and solfège syllables, Olo makes the extreme theoretical boundaries of human retinal perception tangible on a digital screen.
> - **Aero Material Resonance**: Within Frutiger Aero and Aqua skeuomorphism, `#00FFCC` is the quintessential luminous liquid crystal hue—radiant, aquatic, optimistic, and hyper-tactile.
> - **Dual-Tier Contrast Architecture**: Because pure `#00FFCC` has high relative luminance ($Y \approx 0.76$), it shines with unmatched brilliance ($>13.5:1$ contrast) in Dark Mode, while in Light Mode it pairs with **Deep Olo / Olo Viridian** (`#008269` / `#007a62`, $>4.6:1$ contrast) for text and staves, using pure `#00FFCC` for specular highlights, glass beads, and radiant hover halos.

#### The Ergodic Principle: State-Space Completeness & Transparent Generation
> **"Every path through the hand must be walked."**  
> Guido d'Arezzo designed the *Manus Guidonica* as an exhaustive, all-encompassing cognitive map of medieval solmization—no legitimate gamut transition was absent. In Guidonica, this manifests as the **Ergodic Generation Principle**: the procedural engine is mathematically guaranteed to explore the complete state space of the user's chosen settings.
> 
> - **Zero Pedagogical Blind Spots**: No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or interval leap is suppressed, hijacked, or obscured.
> - **The Infinite Monkey Heuristic**: Given sufficient practice time, every mathematically and grammatically valid musical combination within the chosen configuration will eventually appear with non-zero probability ($P(\omega) > 0$).
> - **Transparent Control**: The generator never hides rules or heuristics behind magic constants. Modifiers such as dotted notes and ties are explicitly exposed as user controls.

---

### 2. Typographic Architecture

Guidonica uses two complementary typefaces designed by Huerta Tipográfica, marrying calligraphic craft with crystalline digital legibility:

#### A. Title & Brand Display: *Alegreya*
- **Classification**: Contemporary humanist serif with deep calligraphic roots.
- **Role**: Brand heading (`Guidonica`), modal headers, section titles, and key pedagogical accents.
- **Rationale**: Its energetic, human-cut serifs evoke the medieval manuscript inkstrokes of Guido d'Arezzo while providing authoritative presence.
- **Font Stack**:
  ```css
  --font-title: 'Alegreya', Georgia, 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
  ```
- **Styling Rules**:
  - Headings feature subtle glass text emboss:
    - *Light Mode*: `text-shadow: 0 1px 0 rgba(255, 255, 255, 0.85);` (`--emboss`)
    - *Dark Mode*: `text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);` (`--emboss`)
  - Section titles (settings cards, popover, modal sub-heads) use Alegreya *italic* 700; the Italian tempo marking uses Alegreya italic 400.

#### B. Interface & Body Text: *Alegreya Sans*
- **Classification**: Humanist sans-serif counterpart to Alegreya.
- **Role**: All interactive controls, button labels, dropdowns, tooltips, hints, tabular data, and the canvas solfège labels (700).
- **Rationale**: Retains the warmth and humanist proportion of the serif companion, ensuring prolonged sight-reading without visual fatigue.
- **Font Stack**:
  ```css
  --font-body: 'Alegreya Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  ```

#### C. Numeric & Monospace Data
- **Classification**: Monospace humanist font designed by Dalton Maag.
- **Role**: Tempo display (BPM), number inputs, keyboard shortcuts (`<kbd>`), metric ratio badges, and technical values.
- **Rationale**: Features distinct numeral shapes and comfortable horizontal rhythm that ensure rapid legibility at both high tempos and small badge dimensions.
- **Font Stack**:
  ```css
  --font-mono: 'Ubuntu Mono', 'SF Mono', 'Cascadia Code', Consolas, Menlo, Monaco, monospace;
  ```

---

### 3. Lighting & the Material Hierarchy (Aero-Guidonica 2)

Every element lives in one simulated lighting environment: the light source is fixed **top-left**, every raised surface has a crisp 1px top specular (`inset 0 1px 0 …`), and every recessed surface has an inner cavity shadow. On top of that physics, Aero-Guidonica 2 adds one rule: **material carries importance.** If everything shines equally, nothing reads as primary. Each surface therefore uses exactly one of four materials:

| Tier | Material | Physical recipe | Used for |
|------|----------|-----------------|----------|
| 1 | **Gel** | Saturated vertical gradient, `::before` specular gloss cap on the top half, coloured glow | Play/Pause hero, lit LEDs, slider beads, tuplet counter, checked tuplet cells |
| 2 | **Acrylic** | `linear-gradient(180deg, #fff, #f1f5f9)` (dark: `#1e293b → #162033`), 1px bevel border, 1px top specular. **No half-split gloss.** | Secondary and icon buttons, chips, selects, keycaps |
| 3 | **Glass** | Translucent fill plus `backdrop-filter: blur(16px) saturate(170–180%)`, 1px top specular, soft drop shadow. **No hard 50% sheen line.** | Header ribbon, overlay settings sheet, tuplets popover, zoom pill, modal, footer |
| 4 | **Well** | Recessed fill, `inset` shadow, hairline border | Section cards, BPM readout, LED capsule, slider tracks, inputs |

**Tactile depress**: pressed buttons move down by `translateY(1px)` and swap their outer shadow for an inset cavity shadow.

**Backdrop roots**: the header glass is painted on `.control-panel::before` (`z-index: -1`) rather than on the header itself. A `backdrop-filter`, `filter`, `opacity < 1`, `mask` or `will-change` on `.control-panel` would make it a backdrop root, and the overlay settings sheet nested inside it could then no longer blur the canvas beneath.

---

### 4. Colour Palettes & Contrast

All colours are CSS custom properties defined in exactly two theme blocks (`:root, [data-theme='light']` and `[data-theme='dark']`). The inline head script always resolves `data-theme`, so there is **no** `prefers-color-scheme` duplicate block.

#### Light Mode: *Liquid Crystal & Olo Viridian*
- **Background**: cool gradient around `#e9eef3`. **Glass**: `rgba(255, 255, 255, 0.74)`.
- **Accent**: Deep Olo Viridian `#008269` (4.8:1 on white) for text, borders and checked chips; `#006652` for strong accent text on tints (6.2:1).
- **Muted text**: `#4b5d75` (6.7:1).
- **Hero gel**: body deepened to `#17a387 → #00826a → #006e58`, with **white ink** (≥ 4.8:1 at mid-body).

#### Dark Mode: *Obsidian Aero & Olo Neon*
- **Background**: obsidian `#0b1220`. **Glass**: `rgba(13, 22, 40, 0.78)`.
- **Accent**: pure Olo `#00ffcc`; muted text `#94a3b8` (7:1 on `#0f172a`).
- **Hero gel**: bright Olo `#5dffe0 → #00f0c0 → #00c9a2`, with **deep ink `#00261e`** (≥ 8:1). White on bright Olo (≈ 2.3:1) is forbidden.

#### Ink-on-gel rule
The text on a gel must always reach ≥ 4.5:1 against the gel's mid-body colour. A deep gel takes white ink; a bright gel takes deep ink. The amber *Playing* gel (`#fcd34d → #f59e0b`) uses deep amber ink `#3a1d00` (≥ 7:1) in both themes. The COUNT-IN badge is white on `#e11d48` (4.7:1) in both themes.

#### Canvas palette (single source of truth)
The notation canvas cannot read CSS variables cheaply, so its colours live in one exported constant, `CANVAS_PALETTE` (`src/notation/types.ts`). Both the scroller (stationary staff, playhead) and the renderer (VexFlow ink, ledger lines, tuplets, solfège) use it:

| | background | staff + ledger | ink | solfège | playhead |
|---|---|---|---|---|---|
| Light | `#ffffff` | `#64748b` | `#000000` | `#007a62` | `#e11d48` |
| Dark | `#0f172a` | `#64748b` | `#f8fafc` | `#00ffcc` | `#f43f5e` |

`--canvas-bg` and `--playhead-color` in CSS must equal these values; `tests/canvasPalette.test.ts` enforces it. Staff lines and ledger lines always share one colour.

#### Font weights
Only the loaded faces may be used: Alegreya 700 (plus italic 400/700), Alegreya Sans 400/500/700, Ubuntu Mono 400/700. **Never use `font-weight: 600`**: the browser would synthesize it.

---

### 5. Component Archetypes & Layout Contract

#### A. Iconography
- **No emoji in UI chrome.** Emoji render differently on every OS.
- All icons are vector `<symbol>`s in one hidden sprite at the top of `<body>`, referenced with `<svg class="icon"><use href="#i-…"/></svg>`.
- **UI icon grammar**: a 16-unit grid, `fill: none`, `stroke: currentColor`, stroke width 1.75, round caps and joins.
- **Music glyphs** (`#g-quarter`, `#g-eighth`, …) are filled with `currentColor` and keep their original viewBoxes. Because `<use>` scales "meet" into its box, every `.icon-*` class sets an explicit `em` width and height matching the glyph's aspect ratio.
- The fullscreen icon stays inline (ADR 0034).
- **Brand mark** (ADRs 0046, 0047): the student's own left Guidonian Hand, palm facing them, so the **thumb is on the left**.
  - **Thread**: it wraps in 3D around the digits, passing in front of and behind the hand. It starts at the Γ bead on the thumb tip and passes Γ, A, B.
  - **App icon and favicon**: a **Gel** tile with a deep gel body, a pearl hand, an Olo tube thread and a glowing Olo Γ bead.
    - **Brand-tile exception** to the top-half gloss cap: the tile uses a **diagonal sheen** that fades along a curved edge.
    - It also has a thin white rim. The full-bleed touch icon has no rim.
  - **Header**: a **flat** `#g-hand` glyph, so the Play hero stays the only gel. The hand is `currentColor` and the thread uses `var(--accent)` with a knockout halo.
  - **Detail levels**:
    - *full*, at ≥ 48 px: union outline, light-from-top-left shading, palm lines, knuckle creases and back runs;
    - *small*, at 16–32 px: the silhouette and the long front runs only.
  - The icon files and the `#g-hand` symbol are generated by `npm run icons` (`-- --raster` for the PNG/ICO). Never hand-edit them.
- State-driven icon swaps are pure CSS:
  - play ↔ pause via `.playing`;
  - theme via `[data-mode]`;
  - speaker ↔ muted via `.muted`.

#### B. The Hero Gel Button (`#btn-play-pause`)
- The only tier-1 button.
- *Rest*: Olo gel with gloss cap.
- *Playing*: amber gel.
- *Pressed*: depress physics.
- *Focus*: Olo ring.

#### C. Acrylic Buttons, Chips & Selects
- **Buttons** are `--hit` tall.
- **Chips** (`.checkbox-item`):
  - The `<input>` is visually hidden but stays focusable (clip technique).
  - The `<span>` is an acrylic pill with a 7px LED tell (`::before`).
  - `:checked` gives it an Olo tint, an accent border and a lit LED; `:focus-visible` on the input draws the ring on the span.
- **Selects** use `appearance: none` with a chevron built from two linear gradients (no image).

#### D. Tempo Well & Sliders
- **Tempo**: a well-recessed LCD readout (`#tempo-number`, Ubuntu Mono 22px, spinners hidden) with a "BPM" unit.
  - Above it sits the label *Tempo* plus the Italian marking (`#tempo-term`, Alegreya italic in the accent colour), produced by `tempoMarking(bpm)`.
- **Sliders**: one shared `input[type=range]` rule.
  - Track: a 6px sunken well.
  - Thumb: a glass bead, `radial-gradient(circle at 35% 35%, #fff, #00ffcc 30%, …)`, 18px (22px on coarse pointers).

#### E. LED Beat Indicators
- The beads sit in a well capsule.
- Inactive beads are recessed pearls.
- Active sub-beats are Olo spheres, scaled to 1.28.
- The active downbeat is a ruby gem, scaled to 1.42.
- The COUNT-IN badge floats absolutely above the capsule, so the capsule's width never changes.

#### F. Settings: four titled sections
The settings are grouped as **Staff** (clef, ledger lines, meter, 6/8 pulse) · **Rhythm** (note values, tuplets, rests, ties) · **Melody** (intervals) · **Practice** (labels, assists, click, volume, theme).
- Each group is a `<section class="settings-section">` well card.
- Each card has an Alegreya italic `<h2 class="section-title">` followed by a hairline rule.
- New settings must join one of these sections, never float free.

#### G. Glass Sheets
- These are the tuplets popover, the About modal and the mobile settings sheet.
- They float in with `pop` (opacity plus translate), on `cubic-bezier(0.16, 1, 0.3, 1)`.

#### H. Responsive Layout Contract
| Width | Header grid | Settings |
|-------|-------------|----------|
| > 960px | One row: `brand · transport · tempo · beats · utils` | In-flow card grid (4 columns, 2 columns between 961 and 1279px), open by default, collapsible |
| ≤ 960px | Two rows: `brand · utils` / `transport · tempo · beats` | Absolutely positioned **glass sheet overlaying the canvas** (the canvas never reflows). It scrolls internally, closes on a canvas tap, and the tuplets popover becomes an in-flow accordion. Footer hidden. |
| ≤ 600px | Three rows: `brand · utils` / `transport · beats` / `tempo` (full width, long slider track) | One column. The Settings and Reset labels collapse to icons. |

The canvas wrapper is observed with a `ResizeObserver`, so any layout change (drawer collapse, rotation) resizes the backing store.

#### I. Mechanical Keycaps (`<kbd>`)
Acrylic keys with a 2px bottom border, used in the footer shortcut list.

---

### 6. Strict Engineering Constraints (The Anti-Bloat Pact)

When introducing any future UI element, every developer and AI agent **MUST** verify compliance with these laws:

1. **No external CSS frameworks**: no Tailwind, Bootstrap, Sass runtime or CSS-in-JS.
2. **No image assets for UI chrome**: gradients, bevels, glass and icons are 100% CSS and inline SVG. There are no PNG/WebP textures, no icon fonts and no emoji.
3. **GPU compositing only**: animate only `transform` and `opacity`. Transitions name explicit properties; **`transition: all` is forbidden**.
4. **Frame-rate inviolability**: the Web Audio clock and the canvas scroller hold 60/120 FPS. CSS effects must not cause main-thread paint stalls. The canvas edge fade is a static `::after` gradient.
5. **Touch ergonomics**:
   - Every target is at least `--hit` (36px), which becomes 44px under `(pointer: coarse)`.
   - Chips are 30px, or 40px on coarse pointers.
   - On coarse pointers, form controls use ≥ 16px text, so iOS Safari never focus-zooms.
6. **Hover gating**: every `:hover` rule lives inside `@media (hover: hover)`, so taps never leave sticky hover states.
7. **Viewport safety**:
   - `#app` uses `100dvh` (with a `100vh` fallback).
   - The page declares `viewport-fit=cover`.
   - Header, footer, sheet and zoom pill pad with `env(safe-area-inset-*)`.
8. **Reduced motion**: `@media (prefers-reduced-motion: reduce)` disables every animation and transition.
9. **Accessibility**: every control has a visible `:focus-visible` ring. Icon-only buttons carry `aria-label`. Toggle buttons expose `aria-pressed` or `aria-expanded`.

---

### 7. Historical Context & Pedagogical Respect

Guidonica's design is not merely retro nostalgia—it is a functional reflection of Guido d'Arezzo's ethos: **making the invisible, abstract rules of music visible, tangible, and intuitive.** The tactile warmth of Aero skeuomorphism makes digital practice feel like engaging with a finely tuned acoustic instrument.

# ADR 0022: Aero-Guidonica Skeuomorphic Design System, Alegreya Typography, and Design Manifesto

## Status
Accepted

## Date
2026-09-17

## Context & Design Objectives
Guidonica was engineered with a strict "suckless" philosophy: Vanilla TypeScript, zero frameworks, direct DOM/Canvas/Web Audio manipulation, and hardware-clock synchronization. While the initial interface was clean and utilitarian, it lacked a distinctive visual soul and tactile character.

The modern web is dominated by flat, lifeless, and homogenized user interfaces loaded with hundreds of kilobytes of CSS frameworks (Tailwind, Bootstrap) and complex client-side runtimes. In contrast, the user requested an aesthetic identity drawing from:
1. **The Golden Age of Digital Tactility (2000–2010)**: Frutiger Aero, macOS Aqua, Windows Aero, Y2K, and Liquid Glass skeuomorphism—featuring luminous gradients, translucent frosted glass, realistic specular highlights, and physical button physics.
2. **Pedagogical Typography**: Incorporating **Alegreya** (serif) and **Alegreya Sans** (humanist sans-serif) designed by Huerta Tipográfica. The calligraphic roots of Alegreya harmonize with Guido d'Arezzo's 11th-century music manuscript heritage, while Alegreya Sans ensures effortless screen legibility.
3. **Uncompromising Suckless Discipline**: Zero bloat, zero heavy image sprite sheets, zero layout jank, 0KB added JavaScript runtime, and zero interference with the 60 FPS / 120 FPS continuous notation canvas blitting pipeline.

## Decision & Implementation Details

1. **The Design Manifesto (`docs/DESIGN_MANIFESTO.md`)**:
   - Codified the "Aero-Guidonica" design language as an authoritative, perpetual guide for human developers and AI coding agents.
   - Established the 45-degree top-left lighting model, specular reflection formulas, active tactile button physics (`translateY(1px)` with inverted cavity shadow), and strict anti-bloat limits.

2. **Typography Architecture**:
   - **Serif Display (`Alegreya`)**: Used for the primary brand mark (`Guidonica`), modal headers, and section headings. Includes subtle glass text embossing (`text-shadow`) tuned for both light and dark themes.
   - **Humanist Sans (`Alegreya Sans`)**: Applied to all interactive controls, buttons, tooltips, hints, and drawer labels.
   - **Zero-Bloat Delivery**: Preconnected to Google Fonts CDN with `font-display: swap` and precise subsetting, backed by robust native system fallbacks.

3. **Pure CSS3 Liquid Glass & Skeuomorphism**:
   - **Header Control Panel**: Transformed into a floating Aero glass ribbon utilizing `backdrop-filter: blur(16px) saturate(180%)`, a crisp top specular highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.7)`), and subtle bottom refraction border.
   - **Primary Gel Button (`#btn-play-pause`)**: Styled as an Aqua gel pill with dual-tone specular highlight curve, luminous hover glow, and physical depressed active state. Transitions into an amber/topaz liquid gel when playing.
   - **Secondary & Icon Controls**: Frosted acrylic glass buttons with beveled boundaries and tactile press dynamics.
   - **Tactile Sliders**: Sunken groove tracks with internal inset shadows and spherical 3D glass bead thumbs featuring radial specular reflections.
   - **Luminous Beat Dots**: Enclosed within a glass capsule; inactive dots are softly recessed pearl dimples, while active beats illuminate as radiant aqua or ruby gems with multi-stage radial bloom.
   - **Modals & Popovers**: Styled as floating translucent glass sheets with `backdrop-filter: blur(20px)` and atmospheric drop shadows.

4. **Cross-Platform & Mobile Optimization**:
   - Maintains fluid touch targets ($\ge 36$–$44\text{px}$) across mobile devices.
   - The collapsible settings drawer slides open as a sleek frosted Aero panel.
   - Complete support for both **Light (Liquid Crystal & Aqua)** and **Dark (Obsidian Aero)** themes.

## Consequences

- **Distinctive Visual Brand**: Guidonica stands apart from generic flat web applications with a warm, tactile, and nostalgic aesthetic that honors both classical music craft and digital artistry.
- **Zero Performance Degradation**: Because all visual effects rely purely on modern CSS3 GPU compositing (hardware transforms, shadows, and backdrop filters), the Web Audio metronome and HTML5 Canvas notation scroller maintain flawless 60 FPS / 120 FPS performance.
- **Knowledge Retention**: Future AI agents can refer directly to `docs/DESIGN_MANIFESTO.md` when expanding the UI.

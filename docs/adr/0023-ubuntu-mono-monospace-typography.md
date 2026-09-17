# ADR 0023: Ubuntu Mono Monospace Typography and Numeric System

## Status
Accepted

## Date
2026-09-18

## Context & Problem Statement
Guidonica utilizes procedural music notation generation synchronized with a real-time hardware audio clock. The interface presents critical numerical and technical indicators:
1. **Live Tempo (BPM)**: The metronome frequency indicator (`#bpm-display` and `#tempo-number`), which users adjust frequently during practice sessions.
2. **Keyboard Shortcut Badges (`<kbd>`)**: Visual cues for quick keyboard navigation (e.g. `[Space]`, `[R]`, `[↑]/[↓]`).
3. **Metric Ratio & Technical Badges**: Tuplet matrix indicators (`3:2`, `5:4`, etc.) and system stats.

Previously, `--font-mono` defaulted purely to platform-specific system monospace stacks (`SF Mono` on macOS, `Cascadia Code` on Windows, `Consolas`, `Menlo`, `Monaco`). While functional, character proportions, digit glyph styling, and tabular alignment differed significantly across operating systems. The user requested adopting **Ubuntu Mono** as the project's standard monospace typeface.

## Decision & Implementation Details

1. **Adoption of Ubuntu Mono**:
   - Selected **Ubuntu Mono** (designed by Dalton Maag) for all technical, numeric, and keyboard-command interface components.
   - Ubuntu Mono features distinctive, highly legible numeral shapes (such as clear open counters, slashed/dotted zero distinctions, and strong horizontal rhythm) that remain readable at glance value during rapid sight-reading playback.

2. **Zero-Overhead Consolidated Delivery**:
   - Rather than creating an additional network request, `Ubuntu Mono` (weights 400 and 700, normal and italic) was incorporated directly into the pre-existing Google Fonts stylesheet link in `index.html`:
     ```html
     <link
       href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,700;1,400;1,700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Ubuntu+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap"
       rel="stylesheet"
     />
     ```
   - Bundling families into a single request preserves HTTP connection efficiency, avoids additional DNS/TLS handshakes, and leverages `display=swap` for zero FOIT (Flash of Invisible Text).

3. **Multi-Tier CSS Fallback Stack**:
   - Configured `--font-mono` in `src/style.css` across all color schemes (`:root, [data-theme='light']`, `[data-theme='dark']`, and `@media (prefers-color-scheme: dark)`):
     ```css
     --font-mono: 'Ubuntu Mono', 'SF Mono', 'Cascadia Code', Consolas, Menlo, Monaco, monospace;
     ```
   - If offline or during initial web font download, the browser instantly falls back to native high-quality monospace fonts (`SF Mono` on macOS, `Cascadia Code` on modern Windows, `Consolas` on older Windows, or Linux system monospace).

4. **Tabular Numerals & Element Rules**:
   - Added `code, kbd, pre, samp { font-family: var(--font-mono); }` for semantic elements.
   - Explicitly assigned `font-family: var(--font-mono); font-variant-numeric: tabular-nums;` to `#bpm-display` and `#tempo-number` so tempo changes do not induce horizontal layout jitter.

5. **Design System Alignment**:
   - Updated `docs/DESIGN_MANIFESTO.md` Section 2.C (*Numeric & Monospace Data*) to document Ubuntu Mono, its classification, role, and rationale.

## Consequences

- **Typographic Cohesion**: Monospace readouts, keyboard shortcuts, and BPM inputs now present a uniform, distinctive visual character across macOS, Linux, and Windows.
- **Resilient Fallback**: Offline operation and network delays cause zero rendering failures or layout disruption.
- **Zero Framework Overhead**: The change adds zero JavaScript weight and preserves sub-millisecond per-frame CPU performance for the 60/120 FPS notation canvas loop.

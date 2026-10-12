# 0099. iOS Landscape: Text Autosizing Off, Focus-Mode Fade on a Glass Strip

- **Status**: Accepted (amends [0097](0097-stage-first-shell.md))
- **Date**: 2026-10-12
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Two bugs in the stage-first shell (ADR 0097) showed up on an iPhone 13 mini in landscape.

1. **Clipped settings tab labels.** The labels in the inspector's tab strip were cut off until one tab was tapped. This happened in every language, and also when the page was loaded straight into landscape.
   - **Cause.** Neither the stylesheet nor `index.html` set `-webkit-text-size-adjust`, so Mobile Safari kept its default `auto`. That **inflates text in landscape only**, and it does so lazily, after the boxes are laid out. `.inspector-tab span` has `overflow: hidden` (German "Notensystem" needs it to wrap), so the enlarged glyphs were clipped to a box sized for the uninflated text. Tapping a tab changes `aria-selected`, which restyles the tabs and lays them out again at the inflated size, so the labels then looked right.
   - Desktop WebKit never autosizes, so headless WebKit cannot show the bug.
2. **A hard grey slab in focus mode.** While playing, the bar's half of the bottom row (from the hand to ⋯) turned grey with a sharp edge next to the fully lit dock.
   - **Cause.** In the short layout (`@media (max-height: 500px)`) the bar and the dock share one bottom row. Focus mode set `opacity: 0.4` on the whole `.app-bar`, including its `::before` glass layer, so a rectangle of glass faded into the page background beside the dock. In portrait the bar is a full-width strip of its own, so the same fade reads as intended.

## Decision

### 1. Text autosizing off

The `html, body` base rule sets `-webkit-text-size-adjust: 100%; text-size-adjust: 100%;`.

- `100%` rather than `none`, because `none` blocks text scaling with pinch-zoom on some Safari versions.
- The design manifesto fixes the type scale, so the inflation is never wanted anywhere.

### 2. Short layout: one glass strip, with the bar's contents fading along a gradient

Everything below lives in the `@media (max-height: 500px)` block, so the portrait and wide layouts are unchanged.

- **Row glass.** `#app::before` is an explicitly placed grid item, `grid-row: 2; grid-column: 1 / -1; z-index: 19`. It carries the glass gradient, the inset highlight, the `backdrop-filter` and the single `border-top` of the row, under the dock (z 20) and the bar (z 30). The bar's and dock's own `::before` layers get `content: none`, and both drop their `border-top`. Every other `#app` child has a named grid area or is a `<dialog>`, so the pseudo-item does not disturb auto-placement.
- **Gradient fade.** A registered custom property drives a mask on the bar:

  ```css
  @property --bar-fade { syntax: '<number>'; inherits: false; initial-value: 1; }

  .app-bar {
    transition: --bar-fade var(--slow) var(--ease);
    mask-image: linear-gradient(90deg, #000, rgb(0 0 0 / var(--bar-fade)) 120px);
  }
  #app[data-playback='playing'] .app-bar:not(:focus-within) { opacity: 1; --bar-fade: 0.4; }
  ```

  - The mask is always on in this layout and fully opaque at `--bar-fade: 1`. Stopping playback therefore fades the contents back in instead of snapping.
  - While playing, the alpha ramps from 1 at the bar's left edge to 0.4 at 120 px. The hand sits at about 85 %, the first button at about 50 % and the rest at 40 %. There is no slab, because the glass belongs to `#app`.
  - Hover (`(hover: hover)`) sets `--bar-fade: 1`, and `:focus-within` keeps it at 1, as before.
  - Engines without `@property` (Firefox 115, the ADR 0096 baseline) cannot interpolate the custom property, so they step between the two values. The result still looks fine.
- **The zoom pill** keeps the uniform `opacity: 0.4` fade of ADR 0097.

### 3. The ⋯ menu escapes the mask

A mask clips everything outside the bar's border box, and in this layout the ⋯ menu opens upwards, outside that box. `showAppMenu(menu, toggle, isOpen)` (`src/main.ts`, called by `setMenuOpen`) toggles `#app.menu-open`. The rule `#app.menu-open .app-bar { mask-image: none; }` drops the mask while the menu is open.

This also fixes an older bug: on touch screens the open menu was drawn at 40 % opacity while playing, because a tap does not focus the toggle and so `:focus-within` never matched.

## Consequences

- Text keeps its designed size in every orientation on iOS. Inflated text can no longer overflow a box laid out at the smaller size.
- In the short layout, focus mode dims the bar's controls but never its glass, and the fade reads as a soft gradient from the hand. Portrait and wide layouts are untouched.
- `tests/responsiveLayout.test.ts` checks the `text-size-adjust` declarations, the `#app::before` strip, the `content: none` overrides, the `--bar-fade` mask and its menu exception, and that `showAppMenu` toggles `#app.menu-open`.
- Autosizing cannot be emulated on desktop, so the tab-label fix is confirmed on a device.

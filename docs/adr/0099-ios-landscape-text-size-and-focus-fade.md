# 0099. iOS Landscape: Text Autosizing Off, Focus-Mode Fade on a Glass Strip

- **Status**: Accepted (amends [0097](0097-stage-first-shell.md))
- **Date**: 2026-10-12
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Two bugs in the stage-first shell (ADR 0097) showed up on an iPhone 13 mini in landscape.

1. **Clipped settings tab labels.** The labels in the inspector's tab strip were cut off until one tab was tapped. This happened in every language, and also when the page was loaded straight into landscape.
   - **Cause.** A paint-clip bug in iOS WebKit. `.inspector-tab span` had `overflow: hidden` (added so German "Notensystem" would wrap), and iOS painted each label through a stale, almost empty clip rectangle. Screenshots from the device (Italian, dark theme) show it:
     - On first open, every tab showed only its icon. The selected "Pentagramma" tab showed a 2–3 px sliver, the tops of the ascenders in "Penta-".
     - The icons sat at the same height before and after a tap, so the layout already reserved the labels' full height (two lines for "Penta-gramma"). The text was laid out, but painted through the wrong clip.
     - Tapping Ritmo repaired only "Penta-gramma" and "Ritmo", the two tabs whose `aria-selected` colour changed. Melodia, Suono and Schermo stayed blank.
     - The only inspector text that failed was the text with its own `overflow: hidden`. The panel's other text and the bar's button labels, which have no such clip, painted fine.
   - `overflow: hidden` also makes the span a scroll container, which drops its flex `min-height: auto` to 0 in the tab's column flexbox, so the span could be squeezed below its text height too.
   - A first diagnosis blamed Mobile Safari's landscape text autosizing (`-webkit-text-size-adjust: auto`). Turning it off did not fix the labels; it stays off as hardening (decision 2).
   - Desktop WebKit does not reproduce the stale clip, so headless WebKit cannot show the bug.
2. **A hard grey slab in focus mode.** While playing, the bar's half of the bottom row (from the hand to ⋯) turned grey with a sharp edge next to the fully lit dock.
   - **Cause.** In the short layout (`@media (max-height: 500px)`) the bar and the dock share one bottom row. Focus mode set `opacity: 0.4` on the whole `.app-bar`, including its `::before` glass layer, so a rectangle of glass faded into the page background beside the dock. In portrait the bar is a full-width strip of its own, so the same fade reads as intended.

## Decision

### 1. Tab labels without a clip

```css
.inspector-tab span {
  flex-shrink: 0;            /* never squeezed below its text */
  max-width: 100%;
  overflow-wrap: anywhere;   /* breaks an unhyphenatable word inside the tab, and counts in min-content */
  hyphens: auto;
  text-align: center;
}
```

- No `overflow: hidden`, so there is no per-span clip to go stale. A comment in the stylesheet names this ADR so the clip is not added back.
- Wrapping does not need the clip. ADR 0097 asks for labels that wrap with `hyphens: auto` rather than ellipsize. `overflow-wrap` does the line breaking and `max-width: 100%` keeps the span inside the tab.
- `anywhere` rather than `break-word`, so a word that cannot be hyphenated still wraps inside the span instead of overflowing it.

### 2. Text autosizing off (hardening)

The `html, body` base rule sets `-webkit-text-size-adjust: 100%; text-size-adjust: 100%;`. It did not cause the clipped labels and is kept as hardening.

- `100%` rather than `none`, because `none` blocks text scaling with pinch-zoom on some Safari versions.
- The design manifesto fixes the type scale, so the inflation is never wanted anywhere.

### 3. Short layout: one glass strip, with the bar's contents fading along a gradient

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

### 4. The ⋯ menu escapes the mask

A mask clips everything outside the bar's border box, and in this layout the ⋯ menu opens upwards, outside that box. `showAppMenu(menu, toggle, isOpen)` (`src/main.ts`, called by `setMenuOpen`) toggles `#app.menu-open`. The rule `#app.menu-open .app-bar { mask-image: none; }` drops the mask while the menu is open.

This also fixes an older bug: on touch screens the open menu was drawn at 40 % opacity while playing, because a tap does not focus the toggle and so `:focus-within` never matched.

## Consequences

- The tab labels paint in full on first open, since no clip of their own can go stale. Text also keeps its designed size in every orientation on iOS.
- In the short layout, focus mode dims the bar's controls but never its glass, and the fade reads as a soft gradient from the hand. Portrait and wide layouts are untouched.
- `tests/responsiveLayout.test.ts` checks the `text-size-adjust` declarations, that `.inspector-tab span` has no `overflow` and has `flex-shrink: 0` and `overflow-wrap: anywhere`, the `#app::before` strip, the `content: none` overrides, the `--bar-fade` mask and its menu exception, and that `showAppMenu` toggles `#app.menu-open`.
- The stale clip does not occur on desktop engines, so the tab-label fix is confirmed on a device.

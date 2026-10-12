# 0100. No Double-Tap Zoom: `touch-action: manipulation` on the Root

- **Status**: Accepted
- **Date**: 2026-10-12
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

On phones, two quick taps (on the tempo −/+ buttons, the transport or the stage) made Mobile Safari and Chrome zoom the whole page. The app is a fixed, non-scrolling shell (`html, body { overflow: hidden }`), so that zoom is never useful: it leaves the UI enlarged and off-centre until the user pinches back out. Tapping +/− repeatedly to step the tempo is a normal gesture, so the bug was easy to hit. The app has no `dblclick` handlers that rely on double tap.

## Decision

The `html, body` base rule in `src/style.css` sets:

```css
/* No double-tap page zoom; pinch zoom stays for accessibility (ADR 0100) */
touch-action: manipulation;
```

- **Root coverage.** The browser computes an element's effective `touch-action` as the intersection of its own value with every ancestor's, so the root value covers every button, chip, slider and the canvas without per-element rules.
- **`manipulation`** allows panning and pinch-zoom and drops only double-tap zoom. Browsers that delay taps by ~300 ms to wait for a second tap also drop that delay, so the transport and tempo buttons respond sooner.
- **Existing rules still work.** `input[type='range'] { touch-action: pan-y }` intersects with `manipulation` to `pan-y`. The notation pinch-zoom (`bindCanvasPinchZoom`, `src/main.ts`) still calls `preventDefault` on two-finger touches, so pinching the staff zooms the notation, not the page.
- **Rejected: `user-scalable=no` / `maximum-scale=1`** in the viewport meta. iOS Safari ignores both since iOS 10, so they would not fix the bug there, and on Android they block pinch-zoom, which low-vision users rely on (WCAG 1.4.4).

`tests/responsiveLayout.test.ts` checks that the declaration stays in the base rule.

## Consequences

- Double tap no longer zooms the page on iOS or Android; pinch-zoom of the page stays available for accessibility.
- Taps fire without the double-tap wait where a browser still had one.
- A future feature that needs a double-tap gesture must handle it in script (two `pointerup` events within a short window), not through `dblclick` zoom semantics.
- A headless browser cannot reproduce the gesture, so the fix is confirmed by computed style in tests and by hand on a phone.

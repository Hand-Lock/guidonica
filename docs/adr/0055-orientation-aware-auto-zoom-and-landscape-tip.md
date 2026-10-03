# 0055. Orientation-Aware Auto Zoom & Portrait Landscape Tip

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & lauseta
- **Amends**: [0054](0054-responsive-header-fit-audit.md)

## Context & Problem Statement

1. **Auto zoom went stale after rotation.** `main.ts` listened to `window` `resize` and called
   `syncAutoZoom()`, which reads `scroller.getViewportWidth()`. That width is a cache refreshed
   only by the scroller's `ResizeObserver` (`handleResize` → `updateDimensions`). In the HTML
   event loop, `window` `resize` fires *before* layout and ResizeObserver delivers *after* layout
   in the same frame. On rotation, auto zoom was computed from the **previous orientation's
   width**; `applyZoom` then deduped and nothing re-ran once the cache caught up. A second tap
   on the zoom pill "fixed" it. Every resize had the race; rotation just made it visible.
2. **Portrait phones show little music.** In portrait the staff gets ~320–430px, auto zoom drops
   and only part of a measure is visible ahead of the playhead.

## Decisions & Implementation

### A. The scroller's measured size drives auto zoom

- `ScrollerView.onResize(callback)` (same pattern as `onFrame`) registers a hook that
  `handleResize` invokes after `updateDimensions()` and any dpr re-render, before `renderFrame()`.
  `handleResize` already covers the wrapper `ResizeObserver` (rotation, drawer collapse,
  fullscreen, URL-bar changes), dpr changes and the no-ResizeObserver fallback.
- `main.ts` drops its `window` `resize` listener and registers
  `scroller.onResize(() => zoomMode === 'auto' && syncAutoZoom())`.
- `applyZoom` already ignores repeated values, leaves manual zoom untouched and re-rasterizes via
  `rerenderBuffer()`. No timers, no `orientationchange` listener, no extra layout reads.

### B. CSS-only portrait detection, persistent dismissal

- `<aside id="orientation-notice">` in the stage, with a new `i-rotate` sprite icon and a dismiss
  button (`btn-pill-action`).
- Hidden by default; shown by
  `@media (orientation: portrait) and (pointer: coarse) and (max-width: 600px)` on
  `.orientation-notice:not([hidden])`. Only the ≤600px touch tier of ADR 0054: narrow desktop
  windows (fine pointer) and portrait tablets never see it. Rotating hides it with no JS.
- Liquid Glass tokens of the zoom pill (`--glass-*`, `--accent` icon). Absolutely positioned at
  the top of the stage (`top: calc(12px + env(safe-area-inset-top))`, centered via
  `left/right + margin-inline: auto + width: fit-content`), so it never resizes the stage and
  never affects auto zoom. Fade/slide-in `notice-in` (`--slow`, `--ease`), disabled by the global
  `prefers-reduced-motion` block.
- `storage.ts`: `ORIENTATION_TIP_KEY = 'guidonica_orientation_tip_v1'`,
  `isOrientationTipDismissed()` / `dismissOrientationTip()` (try/catch like `isOnboarded`).
  `main.ts` sets `hidden` at init when dismissed; the button click `stopPropagation()`s (so the
  drawer stays put), sets `hidden` and persists the flag.

## Consequences

- Auto zoom updates on the first frame after any stage size change, from the real size.
- Zero per-frame cost and no orientation listeners; the tip is purely declarative until dismissed.
- Regression coverage in `tests/orientation.test.ts`: the `onResize` hook sees the new width,
  `main.ts` has no window-resize auto-zoom listener, the media query exists, and the dismissal
  flag round-trips and survives a throwing `localStorage`.

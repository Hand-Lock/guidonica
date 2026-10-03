# 0056. Notch-Safe Notation Stage

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md)

## Context & Problem Statement

`index.html` sets `viewport-fit=cover`, so on notched iPhones in landscape the page extends under
the sensor housing. The header, footer, zoom pill and orientation tip already pad with
`env(safe-area-inset-*)`, but `.canvas-wrapper` did not: `#scroller-canvas` sat at `left: 0` and
the pinned clef (drawn at canvas x≈0) disappeared under the notch.

## Decisions & Implementation

No device detection. iOS reports the notch through `env(safe-area-inset-left/right)` (≈47px per
side on an iPhone 13 mini in landscape, symmetric; 0 in portrait, on desktop and on phones without
a notch). The notation is simply placed inside that safe area.

1. **Stage padding** (`src/style.css`): `.canvas-wrapper` gets
   `padding: 0 env(safe-area-inset-right) 0 env(safe-area-inset-left)`. Its `--canvas-bg` paper
   stays full-bleed under the notch; only the content box shrinks.
2. **Canvas offset**: absolutely positioned children are placed against the padding box, so
   `#scroller-canvas` uses `left: env(safe-area-inset-left)` explicitly.
3. **Right-edge fade**: `.canvas-wrapper::after` uses `right: env(safe-area-inset-right)` so the
   fade sits on the canvas's real right edge and the notch strip shows plain paper.
4. **Content-box measurement** (`ScrollerView.updateDimensions`): the stage size is
   `getBoundingClientRect()` minus the computed `padding{Left,Right}` (and `padding{Top,Bottom}`
   for generality). This runs only on resize / dpr change, never per frame. The no-parent
   fallback is unchanged.

Playhead (22% / `MIN_PLAYHEAD_X`), stave centering and `getViewportWidth()` follow the safe
width with no other changes. Auto zoom recomputes through the existing ADR 0055 path
(wrapper `ResizeObserver` → `handleResize` → `onResize` → `syncAutoZoom()`). The observer watches
the content box by default, so an inset change alone also triggers it.

## Consequences

- The clef and the notes clear the notch in both landscape orientations on notched iPhones.
- Auto zoom in landscape on those devices is slightly lower than before (the stage is ≈94px
  narrower), which is the honest usable width.
- Zero effect where the insets are 0: desktop, portrait, Android and non-notched phones keep
  the identical layout and zoom.
- Zero new listeners, zero device sniffing, zero per-frame cost; one `getComputedStyle` read per
  resize.
- Tests: `tests/orientation.test.ts` asserts the content-box width (W − 94 with 47px padding)
  reaches `onResize`, and that the stylesheet carries the three inset rules.

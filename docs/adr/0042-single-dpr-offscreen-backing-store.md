# 0042. Single-dpr Offscreen Backing Store (drop VexFlow `resize()`)

- **Status**: Accepted (supersedes in part the Retina pipeline of [ADR 0013](0013-production-readiness-and-high-dpi-retina-pipeline.md); resolves the follow-up in [ADR 0041](0041-solfege-labels-notehead-anchored.md))
- **Date**: 2026-09-25
- **Author**: Claude & lauseta

## Context & Problem Statement

`renderMeasure()` and `renderPinnedClef()` size their offscreen canvas by hand to `w·dpr·zoom × MEASURE_CANVAS_HEIGHT·dpr·zoom` and apply `ctx.scale(dpr·zoom)`. Both also called `renderer.resize(canvas.width, canvas.height)` first.

VexFlow 5's `CanvasContext.resize(w, h, dpr?)` reads `globalThis.devicePixelRatio` when no `dpr` is passed. It then sets `canvas.width = w·dpr` and calls `scale(dpr)`. Our already-dpr-scaled size was multiplied by dpr a second time, so every measure and pinned-header canvas was rasterized at **dpr²·zoom**:

| dpr | backing pixels vs. needed |
|-----|---------------------------|
| 1   | 1×                        |
| 2   | 4×                        |
| 3   | 9×                        |

The picture still looked right because the scroller blits with `canvas.width/height` as the source rect (`scroller.ts` `drawImage`), which downsamples the oversized canvas into the logical `m.width × MEASURE_CANVAS_HEIGHT·zoom` destination. The cost was hidden: 4× memory, rasterization, and blit bandwidth per ring-buffer measure on Retina.

## Decision & Implementation

1. **Skip VexFlow's `resize()`.** Both `renderer.resize(...)` calls are deleted. The canvas is sized by hand, and `ctx.scale(dpr·zoom, dpr·zoom)` is the only transform. `Renderer.resize(w, h)` cannot forward a `dpr` override, and the abstract `RenderContext.resize` typing takes only two arguments, so deleting the call is cleaner than a cast. `resize()` also sets `canvas.style.width/height`, which does nothing on a detached offscreen canvas.
2. **Labels unchanged.** `drawSolfegeLabels()` still inherits the context transform (ADR 0041) and never calls `setTransform`. The inherited matrix is now exactly `dpr·zoom`.
3. **Size invariant.** At any dpr and zoom:
   - measure: `canvas.width = floor(data.width·dpr·zoom)`, `canvas.height = floor(MEASURE_CANVAS_HEIGHT·dpr·zoom)`
   - pinned header: `canvas.width = floor(PINNED_HEADER_WIDTH·dpr·zoom)`, same height.

## Consequences

- At dpr = 2, backing-store pixels, memory, and per-frame blit bandwidth for measure and header canvases drop 4× (9× at dpr = 3). Rasterization stays at native device resolution, so notes, labels, and blits look the same.
- The scroller needs no change. Its source rect is still `canvas.width/height`, which is now a 1:1 device-pixel copy instead of a downsample.
- Regression tests: `tests/zoom.test.ts` stubs `devicePixelRatio = 2` and asserts the size invariant for both canvases at several zooms. `tests/solfege.test.ts` asserts that the device scale of the note drawing is exactly `dpr·zoom = 2`. Both fail on the old code (2× too large).
- Any future VexFlow renderer setup must not call `resize()` without an explicit `dpr = 1`.

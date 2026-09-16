# 0014: Solfège Label Context Transform & Vertical Clearance Architecture

## Status
Accepted

## Date
2026-09-16

## Context
When Solfège syllable (`Do`, `Re`, `Mi`...) and Letter note name (`C`, `D`, `E`...) overlays were enabled on high-density displays (such as macOS Retina screens with `window.devicePixelRatio = 2`), the labels were invisible or only a tiny glimpse of letter tops appeared for high notes. Users perceived this as a "white overlay" overwriting the labels.

Investigation revealed two compound root causes:
1. **Double Context Scaling**:
   In `MeasureRenderer.renderMeasure()`, VexFlow's Canvas renderer initializes the canvas context with `ctx.scale(dpr, dpr)`, modifying the underlying `CanvasRenderingContext2D` transformation matrix. When drawing pedagogical labels, `rawCtx = canvas.getContext('2d')` was accessed and subsequently had `rawCtx.scale(dpr, dpr)` called on it. Because `rawCtx` is the exact same underlying context object, the scale accumulated to $\text{dpr}^2$ ($4\times$ on Retina). At $4\times$, drawing coordinates were pushed far past the bottom and right edges of the offscreen canvas.
2. **Measure Canvas Height & Vertical Clearance Bounds**:
   With `MEASURE_CANVAS_HEIGHT = 180`, the canvas bottom was only 60px below the bottom stave line ($Y = 120$). Low notes (such as E3/G1 with 3 lower ledger lines at $Y = 155$) required labels at $Y \ge 175$, dangerously close to the 180px boundary, causing descenders and text clipping. Below the blitted measure canvas, the viewport canvas rendered its solid background color (`#ffffff` in light mode), visually truncating anything outside the measure boundary.

## Decision & Implementation Methods

1. **Explicit Device Pixel Transform via `setTransform()`**:
   - Replaced redundant relative `scale(dpr, dpr)` with an absolute matrix reset:
     ```ts
     rawCtx.save();
     rawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
     ```
   - This guarantees that coordinate arguments passed to `fillText(label, noteLinearX, labelY)` represent logical (CSS) pixels, which the hardware accurately scales to device resolution without cumulative multiplier bugs.

2. **Expansion of `MEASURE_CANVAS_HEIGHT` to 220px**:
   - Increased `MEASURE_CANVAS_HEIGHT` from 180px to 220px in `src/notation/types.ts`.
   - Because `measureDrawY = staveTopY - STAVE_TOP_LINE_Y` ($80\text{px}$ above line 0), expanding canvas height increases the margin below the bottom staff line from 60px to 100px.
   - Staff lines, note stems, ledger lines, and stationary staff alignment remain identical with zero vertical drift.
   - Updated `ScrollerView.updateDimensions()` to enforce `viewportHeight >= 220px` and `.canvas-wrapper` CSS to `min-height: 240px`.

3. **Uniform Baseline with Dynamic Lower Ledger Clearance**:
   - Pedagogical labels are positioned along a consistent baseline $Y = 148$ (below line 4 at 120 and clear of down-stems terminating at $Y \le 135$).
   - For lower ledger notes ($C4$ down to $E3$), labels smoothly step down using `Math.max(148, noteY + 20)` with an upper bound of `MEASURE_CANVAS_HEIGHT - 12` ($208\text{px}$), leaving over 40px of clearance from the bottom edge.

## Consequences
- Solfège syllables and Letter note names render with razor-sharp Retina clarity across all devices (`dpr = 1`, `dpr = 2`, fractional DPRs).
- Labels form a calm, readable horizontal baseline that does not jitter vertically for standard notes.
- Low notes with up to 3 ledger lines render without clipping or overlap.
- Automated tests in `tests/solfege.test.ts` verify diatonic mappings and clearance bounds.

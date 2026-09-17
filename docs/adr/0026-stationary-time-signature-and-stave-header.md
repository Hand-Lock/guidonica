# 26. Stationary Selected Time Signature & Left Stave Header

Date: 2026-09-18

## Status
Accepted

## Context
In Guidonica's sight-reading and solfège practice interface, procedural music notation continuously streams horizontally from right to left across a fixed red playhead. A stationary clef glyph has historically been pinned to the left margin, providing continuous grounding so musicians instantly know their pitch reference frame.

However, metric grounding is equally vital: sight-readers need to know the active time signature at a glance without having to look away from the musical stave to inspect the UI header controls or settings drawer. The objective was to anchor the currently selected time signature (`4/4`, `3/4`, `2/4`, or `6/8`) directly after the stationary clef in classical stacked-numeral fraction style on the same stationary layer, preserving:
1. Uncompromising suckless, zero-bloat architecture.
2. Microsecond-accurate audio-visual clock synchronization linked to `AudioContext.currentTime`.
3. High-DPI Retina sharpness ($1:1$ physical pixel mapping) across all in-app zoom levels ($0.5\times$ to $1.5\times$).
4. GPU-accelerated single-blit offscreen canvas caching (< 1% CPU utilization).

## Decisions

### 1. Unified Pinned Header Offscreen Rasterization
Rather than maintaining separate offscreen canvases or disparate drawing routines for clefs and time signatures, `MeasureRenderer` generates a single unified offscreen canvas representing the stationary stave header:
- Clef modifier (`stave.addClef(clef)`) and time signature modifier (`stave.addTimeSignature(timeSignature)`) are attached to an offscreen VexFlow `Stave` configured with hidden lines (`setConfigForLines([{ visible: false }, ...]`), ensuring standard SMuFL relative positioning while allowing the scroller's continuous stationary staff lines to show through seamlessly.
- Numeric time signatures (`4/4`, `3/4`, `2/4`, `6/8`) are rasterized in classical engraving style: numerator stacked over denominator (centered on staff lines 1 and 3 respectively) using Bravura SMuFL glyphs (`0xE080`..`0xE089`) without horizontal fraction bars.
- Stave and modifier styles adapt dynamically to the active display theme (`#000000` in light mode, `#f8fafc` in dark mode).

### 2. Geometry & Metric Clearance
The pinned header geometry was formalized with typed layout constants in `src/notation/types.ts`:
- `PINNED_HEADER_WIDTH = 115`: Width of the offscreen canvas accommodating clef and stacked numerals.
- `PINNED_HEADER_OFFSET_X = 20`: Left indent from the viewport edge.
- `PINNED_HEADER_MASK_WIDTH = 135`: Solid opaque background mask shielding the stationary glyphs from scrolled measures.
- `PINNED_HEADER_FADE_WIDTH = 40`: Linear gradient fade transition from opaque to transparent.
- `PINNED_HEADER_TOTAL_MARGIN = 175`: Combined margin (`MASK_WIDTH + FADE_WIDTH`).
- `PLAYHEAD_MIN_CLEARANCE = 30`: Clearance buffer between the fade margin and the fixed playhead.
- `MIN_PLAYHEAD_X = 205`: Minimum playhead X coordinate at $1.0\times$ zoom (`TOTAL_MARGIN + PLAYHEAD_MIN_CLEARANCE`).

At $1.0\times$ zoom on standard viewports ($\ge 1000\text{ px}$), the playhead sits at $22\%$ of viewport width ($220\text{ px} \ge 205\text{ px}$). On narrow mobile viewports, the playhead maintains an invariant $30\text{ px}$ clearance beyond the time signature fade.

### 3. Reactive Caching & Instant Invalidation
In `ScrollerView`, the pinned header canvas is cached across render frames:
```typescript
if (
  !this.pinnedClefCanvas ||
  this.cachedClef !== clef ||
  this.cachedTimeSignature !== timeSignature ||
  this.cachedClefTheme !== theme
) {
  this.pinnedClefCanvas = this.renderer.renderPinnedClef(clef, timeSignature, theme);
  this.cachedClef = clef;
  this.cachedTimeSignature = timeSignature;
  this.cachedClefTheme = theme;
}
```
When the user switches time signatures via the UI dropdown, `main.ts` updates settings and triggers `resetSession()`, which invokes `scroller.invalidatePinnedClef()`. The offscreen canvas is re-rendered once on the next animation frame, maintaining < 1% CPU utilization during ongoing playback.

### 4. Zero-Drift Coordinate Transformation
Playhead note crossing remains mathematically coupled to hardware audio clock beats regardless of the expanded header width or in-app zoom factor:
$$\text{measureScreenX} = \text{playheadX} - (\text{NOTE\_START\_OFFSET} \times Z) + (m.\text{startBeat} - \text{currentGlobalBeat}) \times (m.\text{beatWidth} \times Z)$$
$$\text{noteLocalX} = (\text{NOTE\_START\_OFFSET} + b_j \times m.\text{beatWidth}) \times Z$$
$$\text{screenX} = \text{measureScreenX} + \text{noteLocalX} \equiv \text{playheadX} \quad \text{when } \text{currentGlobalBeat} = m.\text{startBeat} + b_j$$

## Consequences
- Sight-readers have continuous visual confirmation of both clef and time signature directly on the stave at all times.
- Changing time signatures instantly updates both the audio metronome and the visual stave header in perfect synchrony.
- Zero external libraries or runtime dependencies added; pure SMuFL and Canvas 2D rasterization.
- Full backwards compatibility retained with existing `renderPinnedClef` signatures and zoom tests.

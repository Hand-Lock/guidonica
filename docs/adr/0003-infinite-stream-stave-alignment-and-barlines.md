# 0003. Infinite Streaming Buffer, Stave Alignment & Barline Rendering

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Testing revealed three critical visual and procedural defects in the notation scroller:
1. **Stream stalled after a few measures**: Playback was not truly infinite; notation stopped generating and disappeared once the initial 16-beat buffer scrolled past the playhead.
2. **Double pentagram (two overlapping staves)**: The viewport displayed two distinct 5-line musical staves vertically shifted by 40px ("as if there was one in the wallpaper that is static and one from the scrolling pentagram"). The notes scrolled on the lower staff while the upper stationary staff remained empty.
3. **Missing measure / bar lines**: No vertical barlines were visible anywhere along the scrolling notation tape to delineate measure boundaries.

---

## Decisions & Implementation Methods

### 1. Infinite Streaming Buffer Regeneration via Settings Provider
- **Root Cause**: In `ScrollerView.startLoop()`, the `requestAnimationFrame` loop invoked `this.renderFrame()` with zero arguments (`settings === undefined`). Consequently, the buffer lookahead check `if (settings)` evaluated to `false` on every frame during active playback. Only the initial 16 beats pre-buffered at application startup were ever rendered.
- **Decision**: Equip `ScrollerView` with a reactive `getSettings: () => AppSettings` provider callback passed upon construction (`() => globalState.settings`).
- **Implementation**:
  - In `ScrollerView.renderFrame(overrideSettings?: AppSettings)`: resolves `const settings = overrideSettings ?? this.getSettings()`.
  - Every animation frame now reliably evaluates:
    $$\text{lookaheadBeats} = \frac{W_{\text{viewport}} - X_{\text{playhead}}}{W_{\text{beat}}} + 6$$
    $$\text{buffer.ensureAhead}(\text{currentGlobalBeat}, \text{lookaheadBeats}, \text{settings}, \text{dpr})$$
    $$\text{buffer.evictBefore}(\text{minVisibleBeat})$$
  - Measures are continuously generated ahead and offscreen measures past the left margin are evicted from the ring-buffer, guaranteeing infinite practice sessions with constant heap size.

### 2. Elimination of Duplicate Pentagrams & Sub-Pixel Stave Alignment
- **Root Cause**:
  1. VexFlow's `Stave(0, STAVE_CANVAS_Y, ...)` reserves internal vertical headroom: line 0 is calculated at `y = STAVE_CANVAS_Y + spaceAboveStaffLn * spacing = 40 + 4 * 10 = 80px`. The scroller previously computed measure blit Y as `measureDrawY = staveTopY - STAVE_CANVAS_Y` (offset of 40px instead of 80px), shifting the VexFlow measures 40px lower than the viewport's stationary staff lines.
  2. Passing `{ lineConfig: [{ visible: false }] }` into `new Stave()` was unconditionally overwritten by VexFlow's internal `this.resetLines()` constructor call, which forced all 5 stave lines to `visible: true` on each offscreen measure canvas and pinned clef canvas.
- **Decision & Implementation**:
  - Defined `STAVE_TOP_LINE_Y = 80` in `src/notation/types.ts`.
  - Updated `ScrollerView.updateDimensions()`:
    $$\text{measureDrawY} = \text{staveTopY} - \text{STAVE\_TOP\_LINE\_Y}$$
    This aligns VexFlow's Line 0 ($y = 80$) exactly with the stationary staff's Line 0 ($\text{staveTopY}$).
  - In `MeasureRenderer.renderMeasure()` and `renderPinnedClef()`, explicitly invoked `stave.setConfigForLines()` after construction with `{ visible: false }` across all 5 lines.
  - The offscreen measure canvases now only draw noteheads, stems, ledger lines, accidentals, and barlines. The single stationary staff rendered on the main scroller canvas acts as the authoritative continuous pentagram.

### 3. Crisp Measure Barline Rendering
- **Root Cause**: In `MeasureRenderer`, `new Stave()` was configured with `leftBar: false, rightBar: true`. In VexFlow, `rightBar` is positioned at $x = \text{measureWidth}$ (e.g. 480px). Because the offscreen canvas is bounded to $[0, \text{measureWidth})$, drawing a 1px bar at $x = 480$ fell outside the canvas buffer and was clipped. With `leftBar: false`, both the start and end of every measure lacked visible barlines.
- **Decision & Implementation**:
  - Configured each measure stave with `leftBar: true, rightBar: false`.
  - Stave modifiers are styled explicitly: `stave.getModifiers().forEach(mod => mod.setStyle({ fillStyle: '#475569', strokeStyle: '#475569' }))`.
  - VexFlow's `Barline` modifier draws a vertical bar at measure local coordinate $x = 0$ spanning from $y = 80$ (Line 0) to $y = 121$ (Line 4).
  - When blitted at $\text{measureScreenX}$, each measure contributes exactly one crisp, slate-600 vertical line at its boundary, connecting the top and bottom stationary staff lines.

---

## Consequences & Verification

- **Infinite Streaming**: Verified notation generates continuously without stalling across all tempos and meters.
- **Single Stationary Staff**: Verified notes, ledger lines, and the pinned clef land directly on the 5 stationary staff lines with zero duplicate lines or vertical offsets.
- **Measure Boundaries**: Verified every measure start displays a distinct barline separating rhythmic groupings.
- **Type Safety**: Verified zero errors with `npm run typecheck` (`tsc --noEmit`).
- **Production Build**: Verified zero errors with `npm run build`.

# 0005. Dynamic Subdivision Beat Width & Stave Padding Compensation

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

When users enabled 16th notes with multiple consecutive subdivisions, notes near the end of a measure overshot the fixed measure width (480px in 4/4 time). As a result:
1. Notes on the 4th beat exceeded the offscreen canvas boundary and were clipped.
2. The remaining note fragments were overwritten by the subsequent measure's canvas and barline, rendering late 16th notes partially or completely invisible.
3. Beat 0 and subsequent notes crossed the stationary playhead with a noticeable spatial lag relative to the audible metronome click.

---

## Architectural Evaluation: Approach A vs. Approach B

Two candidate solutions were considered:

### Approach B: Dynamic Measure Sizing with Variable Scroll Velocity
- Each measure adjusts its width dynamically based on its internal note count.
- The scrolling engine accelerates or decelerates frame-by-frame across measure boundaries to maintain constant metric time (BPM).
- **Drawbacks**:
  1. **Disorienting Sight-Reading Experience**: Variable scrolling speed causes visual "rubber-banding" and jerkiness. The musician's eye cannot build reliable spatial-temporal anticipation if notation continuously speeds up during runs and slows down during long notes.
  2. **Viewport Incoherence**: Since multiple measures are visible on screen simultaneously (e.g. 2 to 4 measures on desktop), having different speeds for adjacent measures requires non-rigid tape stretching or visual warping.
  3. **Violation of `SPEC.md`**: Breaks the fundamental metric linearity rule ($W_{\text{beat}}$ constant, velocity $v$ constant for a given tempo).

### Approach A: Sizing Measure and Beat Width Beforehand (Selected)
- The metric beat width ($W_{\text{beat}}$) and measure width ($W_{\text{measure}} = \text{beatsPerMeasure} \times W_{\text{beat}}$) are calculated beforehand based on the highest enabled subdivision.
- **Benefits**:
  1. **Uniform Scrolling Velocity**: Scrolling speed ($v = \frac{\text{BPM}}{60} \times W_{\text{beat}}$) remains strictly constant and smooth throughout the session.
  2. **Predictable Spatial Proportions**: Visual distance strictly equals rhythmic duration. A 16th note is always half the spatial width of an 8th note, reinforcing natural sight-reading intuition.
  3. **Generous Breathing Room**: Measures automatically expand when high-density subdivisions are active, ensuring noteheads, stems, beams, and barlines never collide or overshoot.

---

## Root Cause Analysis

Investigation revealed two compounding root causes:

### 1. Insufficient End-of-Measure Margin with Fixed $W_{\text{beat}} = 120\text{px}$
- In a 4/4 measure at $W_{\text{beat}} = 120\text{px}$, note spacing for 16th notes is $\Delta x = 0.25 \times 120 = 30\text{px}$.
- With left barline padding $S = 24\text{px}$, the last 16th note (beat offset 3.75) had local coordinate:
  $$x = 24 + 3.75 \times 120 = 474\text{px}$$
- The measure canvas ended at $W_{\text{measure}} = 4 \times 120 = 480\text{px}$, leaving a right margin of only $480 - 474 = 6\text{px}$.
- Because a standard VexFlow notehead is 13–14px wide and an up-stem is positioned at $+10.5\text{px}$, the notehead and stem extended to $x = 485\text{px}$, crossing 5px beyond the barline and offscreen canvas buffer.

### 2. Uncompensated VexFlow Internal Stave Padding
- In VexFlow 5, `staveNote.getAbsoluteX()` does not equal `tickContext.getX()`. Instead, it adds the stave's start offset and internal padding:
  $$\text{getAbsoluteX}() = \text{tickContext.getX}() + \text{stave.getNoteStartX}() + \text{Metrics.get}('Stave.padding', 0)$$
- For a measure stave with `leftBar: true`, `stave.getNoteStartX()` is $5\text{px}$ and `Stave.padding` is $12\text{px}$ (total $17\text{px}$).
- Passing `targetLinearX` directly into `tickContext.setX(targetLinearX)` resulted in noteheads being rendered at $x = \text{targetLinearX} + 17\text{px}$:
  - Beat 0 was drawn at $x = 24 + 17 = 41\text{px}$ (causing a 17px lag past the playhead on the metronome click).
  - Beat 3.75 was drawn at $x = 474 + 17 = 491\text{px}$, overshooting the 480px canvas by $11\text{px}$ and being truncated completely.

---

## Decisions & Implementation Methods

### 1. Subdivision-Aware Beat Width Calculator (`computeBeatWidth`)
- Added `computeBeatWidth(subdivisions, timeSignature)` in `src/notation/types.ts`:
  - **Simple Meters (4/4, 3/4, 2/4)**:
    - `sixteenth` enabled: $W_{\text{beat}} = 220\text{px}$ (yielding $55\text{px}$ per 16th note, $W_{\text{measure}} = 880\text{px}$ in 4/4).
    - `triplets` enabled: $W_{\text{beat}} = 165\text{px}$ (yielding $55\text{px}$ per triplet note).
    - `eighth` enabled: $W_{\text{beat}} = 130\text{px}$ (yielding $65\text{px}$ per 8th note).
    - `quarter` / `half` / `whole`: $W_{\text{beat}} = 110\text{px}$ (yielding $110\text{px}$ per quarter note).
  - **Compound Meter (6/8)**:
    - `sixteenth` enabled: $W_{\text{beat}} = 110\text{px}$ ($55\text{px}$ per 16th note, $110\text{px}$ per 8th note, $W_{\text{measure}} = 660\text{px}$).
    - `eighth` only: $W_{\text{beat}} = 80\text{px}$ ($80\text{px}$ per 8th note, $W_{\text{measure}} = 480\text{px}$).

### 2. Balanced Barline Padding Geometry
- Set `NOTE_START_OFFSET = 26` (padding from left barline to beat 0).
- Across all meters and subdivisions, the right margin from the last possible note to the measure end is:
  $$\text{margin}_{\text{right}} = \Delta t_{\text{min}} \times W_{\text{beat}} - \text{NOTE\_START\_OFFSET} = 55\text{px} - 26\text{px} = 29\text{px}$$
- The distance between the last note of measure $m$ and beat 0 of measure $m+1$ is identically:
  $$\text{gap} = 29\text{px} + 26\text{px} = 55\text{px} = \Delta x_{\text{step}}$$
- The barline sits cleanly between the two notes with $29\text{px}$ of left clearance and $26\text{px}$ of right clearance, guaranteeing zero clipping and zero visual interference.

### 3. VexFlow Stave Padding Compensation
- In `MeasureRenderer.renderMeasure()`:
  ```typescript
  const stavePadding = (stave.getNoteStartX ? stave.getNoteStartX() : 0) + Metrics.get('Stave.padding', 0);
  const beatWidth = data.beatWidth;

  for (let i = 0; i < staveNotes.length; i++) {
    const noteData = data.notes[i];
    const targetLinearX = NOTE_START_OFFSET + noteData.beatOffset * beatWidth;
    staveNotes[i].getTickContext().setX(targetLinearX - stavePadding);
  }
  ```
- Result: `staveNote.getAbsoluteX()` strictly equals `targetLinearX`. Beat 0 aligns with the playhead at the exact microsecond of the audio pulse.

### 4. Dynamic Measure Data & Scroller Integration
- Added `beatWidth: number` to `MeasureData`.
- `ScrollerView.renderFrame()` reads `activeBeatWidth = computeBeatWidth(settings.subdivisions, settings.timeSignature)` for ring-buffer lookahead and evictions, and uses `m.data.beatWidth` for measure blitting.
- `MusicGenerator.partitionCompoundGroup()` was extended to support 16th-note subdivisions in 6/8 meter.

### 5. Glitch-Free Tempo Re-anchoring
- In `MetronomeEngine.setTempo()`, re-anchored `measureZeroStartTime` via `ctx.currentTime - currentBeat * secondsPerBeat` so changing tempo mid-session preserves continuous fractional beat progress without positional jumping.

---

## Consequences & Verification

- **Zero Clipping**: Verified across all meters (4/4, 3/4, 2/4, 6/8) and subdivision combinations that right margin is $\ge 29.0\text{px}$ with zero notes overshooting the measure canvas.
- **Microsecond Audio-Visual Sync**: Beat 0 noteheads cross the playhead line at the exact moment of the downbeat click (`note0X = 26px`, aligning with `measureScreenX = playheadX - 26px`).
- **Constant Velocity**: Playback moves with unwavering, steady motion at any tempo.
- **Clean Typecheck & Production Build**: Passed `npm run typecheck` (`tsc --noEmit`) and `npm run build` with zero errors.

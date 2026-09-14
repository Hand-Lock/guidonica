# 0004. Beaming Geometry, Stave Attachment & Stem Extension Alignment

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Users observed visual defects in rendered music notation across beamed notes:
1. **Stem Height Rigidity & Alignment Mismatch**: The stems of beamed notes did not adapt their heights to the beam angle, remaining at a fixed 35px height. As a result, stems frequently overshot (protruded beyond) or undershot (failed to reach) the beam lines.
2. **Artificial Beam Flatness**: Beamed groups, especially noticeable in 16th notes and melodic runs, were rendered completely horizontal (slope = 0) regardless of the pitch interval or melodic contour between notes.
3. **Compound Meter Grouping**: In 6/8 time, beams defaulted to 2/8 (two eighth notes) rather than the standard compound dotted-quarter (three eighth notes) beam groupings.

---

## Root Cause Analysis

In VexFlow 5, a `StaveNote` computes its vertical notehead metrics, line positions, and stem extents relative to its associated `Stave` via `staveNote.setStave(stave)`:
- `note.getStemExtents().topY` calculates the tip of the stem based on `this.yTop` / `this.yBottom`.
- Without a stave attached, `_noteHeads` have no stave context and default their Y bounds to 0 (`topY = -35, baseY = 0` for all notes).

In `MeasureRenderer.renderMeasure()`:
1. `StaveNote` instances were created without setting `stave`.
2. `Beam.generateBeams()` was called without passing meter-aware beam groups (`groups`), defaulting to `[new Fraction(2, 8)]`.
3. Spatial linearity was enforced by updating note X coordinates via `staveNotes[i].getTickContext().setX(targetLinearX)`.
4. `beam.postFormat()` was invoked:
   - `calculateSlope()` sampled `getStemSlope(firstNote, lastNote)`. Because neither note had a stave attached, `firstNote.topY == lastNote.topY == -35`, giving an initial slope of identically 0.
   - The slope solver evaluated costs and settled on `slope = 0` (flat horizontal).
   - `applyStemExtensions()` compared each note's `stemTipY` (-35) with the slope projection (-35), resulting in zero difference and setting `stemExtension = 0` for all notes.
   - VexFlow marked `beam.postFormatted = true`.
5. Only later, during `voice.draw(ctx, stave)`, did `voice` iterate through tickables and invoke `tickable.setStave(stave)`.
6. At that point, noteheads were finally shifted to their true staff line Y coordinates (e.g. 130 for C4, 110 for G4). However:
   - The stem extensions remained frozen at 0 (fixed 35px height).
   - `beam.draw()` did not recompute because `beam.postFormatted` was already `true`.
   - `beam.drawBeamLines()` drew a flat beam at the first note's stem tip, leaving subsequent notes detached or overshooting the beam line.

---

## Decisions & Implementation Methods

### 1. Early Stave Attachment in Note Creation
- **Decision**: Attach the `Stave` instance immediately upon `StaveNote` construction in `createStaveNote(noteData, clef, stave)`.
- **Implementation**:
  ```typescript
  const staveNote = new StaveNote({
    keys: noteData.keys,
    duration: durationString,
    clef,
    autoStem: true,
  });
  staveNote.setStave(stave);
  ```
- **Rationale**: Noteheads immediately receive their correct Y positions and stem bounds before any beaming or formatting decisions are evaluated.

### 2. Meter-Aware Beam Groups
- **Decision**: Pass `Beam.getDefaultBeamGroups(data.timeSignature)` to `Beam.generateBeams()`.
- **Implementation**:
  ```typescript
  const beams = Beam.generateBeams(staveNotes, {
    groups: Beam.getDefaultBeamGroups(data.timeSignature),
    beamRests: false,
  });
  ```
- **Rationale**: Correctly groups beats according to the active meter (e.g., groups of 3 eighths in 6/8 compound meter, groups of 1 quarter in 2/4, 3/4, and 4/4 simple meters).

### 3. Voice Stave Association & Clean Post-Format Invalidation
- **Decision**: Explicitly assign the stave to the voice (`voice.setStave(stave)`) and reset `beam.postFormatted = false` prior to `beam.postFormat()`.
- **Implementation**:
  ```typescript
  voice.setStave(stave);
  // ... reposition noteheads to targetLinearX ...
  for (const beam of beams) {
    beam.postFormatted = false;
    beam.postFormat();
  }
  ```
- **Rationale**: Guarantees that `beam.postFormat()` executes after final spatial linear X coordinates and stave Y positions are established, accurately deriving beam slope and dynamic stem extensions.

---

## Consequences & Verification

- **Stem-to-Beam Precision**: Every stem tip intersects the beam line with sub-pixel precision (`diff = 0.000px`).
- **Dynamic Stem Heights**: Stems now scale proportionally according to melodic contour and beam slope (e.g. 47.5px, 45px, 42.5px, 35px in an ascending sixteenth-note passage).
- **Musical Slopes**: Ascending and descending 16th and 8th note passages display natural, aesthetically pleasing beam slants instead of being locked into artificial horizontal lines.
- **Verification**: Verified via test suite across ascending, descending, zig-zag, high-pitch down-stem, and 6/8 compound meter passages with zero regression.

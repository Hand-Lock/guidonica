# 0011. Tuplet Beam Stem Direction Unification & Contiguous Non-Tuplet Grouping

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

When rendering beamed tuplets (such as 1/8-note or 1/16-note triplets, duplets, quadruplets, quintuplets, etc.) that span a wide pitch range across the middle stave line, an engraving defect was observed:
- One or more notes in the tuplet appeared with their stems protruding in reverse from the bottom of the beam, while the remaining notes extended upward into the beam (or vice versa: one stem pointing up while the others pointed down).
- This defect occurred exclusively with beamed tuplets and never with non-tuplet notes.

---

## Root Cause Analysis

1. **StaveNote Initial Auto-Stemming**:
   In `MeasureRenderer.createStaveNote()`, each note is constructed with `autoStem: true`. VexFlow assigns an individual stem direction to each note independently based on that note's single pitch relative to the middle staff line:
   - Notes below the middle line receive `Stem.UP` (`+1`).
   - Notes on or above the middle line receive `Stem.DOWN` (`-1`).

2. **Omission of `autoStem` in `new Beam(notes)`**:
   In `MeasureRenderer.renderMeasure()`, tuplet beams were constructed as:
   ```typescript
   const tupletBeam = new Beam(entry.notes);
   ```
   In VexFlow 5, `Beam`'s constructor is typed as `constructor(notes: StemmableNote[], autoStem?: boolean)` where `autoStem` defaults to `false`.
   - When `autoStem` is `false`, `Beam` adopts the stem direction of only the first note (`this._stemDirection = notes[0].getStemDirection()`), but does **not** recalculate a unified stem direction for the group, and does **not** invoke `note.setStemDirection()` on the constituent notes.
   - Consequently, in a wide-interval triplet such as `[C4, E4, A5]`, notes retain their disparate individual stem directions (`[+1, +1, -1]`).
   - When `beam.drawStems(ctx)` renders stems, note 0 and note 1 have stems pointing up towards the beam, while note 2's stem is drawn pointing downwards away from its notehead. `applyStemExtensions()` additionally applies cross-stem extensions, making note 2 look as if it comes out of the bottom of the beam while others connect from the top.

3. **Contrast with Non-Tuplet Beams**:
   Non-tuplet notes are processed using `Beam.generateBeams()`, whose internal `formatStems()` subroutine always evaluates `calculateStemDirection(group)` and explicitly invokes `applyStemDirection(group, stemDirection)` to harmonize all notes to the exact same stem direction.

4. **Intervening Tuplet Run Separation**:
   Filtering `nonTupletNotes = staveNotes.filter(n => !tupletNotesSet.has(n))` previously passed a flattened array to `Beam.generateBeams()`. If an isolated eighth note preceded a tuplet and another followed it, `Beam.generateBeams` could treat them as adjacent and beam them across the tuplet.

---

## Decisions & Implementation Methods

### 1. Enable `autoStem` on Tuplet Beams
- **Decision**: Pass `true` as the second argument to `new Beam(entry.notes, true)` for all beamable tuplet groups.
- **Implementation**:
  ```typescript
  if (isBeamable && entry.notes.length > 1) {
    const tupletBeam = new Beam(entry.notes, true);
    beams.push(tupletBeam);
  }
  ```
- **Rationale**: Passing `autoStem = true` triggers VexFlow's `calculateStemDirection(notes)` on the entire tuplet group. If the aggregate pitch contour is below the center line, all stems in the tuplet are set to `Stem.UP` (`+1`); if above or equal, all stems are set to `Stem.DOWN` (`-1`). All stems uniformly point into the beam line.

### 2. Construct Beams Prior to Tuplet Indicators
- **Decision**: Instantiate `Beam` objects before constructing `Tuplet` objects.
- **Rationale**: Ensures that notehead stem directions and `note.hasBeam()` states are completely finalized and unified before VexFlow constructs tuplet brackets and calculates vertical text bounding offsets.

### 3. Chunk Non-Tuplet Notes by Contiguous Metric Runs
- **Decision**: Segment `staveNotes` into contiguous runs of non-tuplet notes before invoking `Beam.generateBeams()`.
- **Implementation**:
  ```typescript
  const nonTupletRuns: StaveNote[][] = [];
  let currentRun: StaveNote[] = [];
  for (const note of staveNotes) {
    if (!tupletNotesSet.has(note)) {
      currentRun.push(note);
    } else {
      if (currentRun.length > 0) {
        nonTupletRuns.push(currentRun);
        currentRun = [];
      }
    }
  }
  if (currentRun.length > 0) {
    nonTupletRuns.push(currentRun);
  }

  for (const run of nonTupletRuns) {
    const regularBeams = Beam.generateBeams(run, {
      groups: Beam.getDefaultBeamGroups(data.timeSignature),
      beamRests: false,
    });
    beams.push(...regularBeams);
  }
  ```
- **Rationale**: Prevents VexFlow from inadvertently beaming across intervening tuplet groups when non-tuplet eighth or sixteenth notes surround a tuplet.

---

## Consequences & Verification

- **Harmonized Tuplet Beams**: Notes within wide-interval tuplets (e.g. `[C4, E4, A5]`, `[A5, E4, C4]`, `[C4, C6, C4]`, octave leaps) now share 100% unified stem directions.
- **No Inverted or Cross-Stem Artifacts**: Stems no longer protrude in opposite directions from the beam line.
- **Zero Beam Leaks Across Tuplets**: Non-tuplet notes are grouped within their contiguous segments without spanning across tuplets.
- **Verification**:
  - Tested wide ascending (`[C4, E4, A5]`), descending (`[A5, E4, C4]`), high-range (`[A5, B5, C6]`), low-range (`[C4, D4, E4]`), and zig-zag contour tuplets in Treble and Bass clefs. All notes verified to have identical stem directions (`[1, 1, 1]` or `[-1, -1, -1]`).
  - Tested 1/16 quintuplets and septuplets spanning wide intervals with zero stem discrepancies.
  - Verified mixed measures containing both non-tuplet and tuplet notes; beams correctly isolate to their respective metric runs.
  - Typecheck (`tsc --noEmit`) and production build (`vite build`) pass cleanly with 0 errors.

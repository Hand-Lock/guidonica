# 0006. Multi-Interval Checkbox Selection & Clef-Dependent Pitch Pools (±3 Ledger Lines)

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Prior to this architectural revision, two pedagogical limitations existed in the notation and melodic generator:
1. **Mono-Interval Constraint**: Melodic interval selection was restricted to a single `<select>` dropdown (`'seconds' | 'thirds' | 'octaves' | 'any'`). Users could not combine arbitrary intervals (e.g., practicing 2nds and 3rds together, or combining 5ths with octaves). Selecting a single category often produced monotonous exercises without pedagogical flexibility.
2. **Constrained Clef Pitch Pools**: Clef pitch ranges were hardcoded to only 2 ledger lines above and below the staff (17 notes). Additionally, the relationship between each clef's natural register (e.g. Bass vs. Treble vs. Alto vs. Tenor) was not clearly reflected across the standard sight-reading curriculum, which expects sight-reading fluency spanning up to 3 ledger lines outside the staff.

---

## Decisions & Implementation Methods

### 1. Granular Interval Toggle List (`IntervalOptions`)
- Replaced the single dropdown with an `IntervalOptions` interface mirroring `SubdivisionOptions`:
  ```typescript
  export interface IntervalOptions {
    unison: boolean;  // 1st (0 diatonic steps / repeated note)
    second: boolean;  // 2nd (1 diatonic step / stepwise motion)
    third: boolean;   // 3rd (2 diatonic steps / triadic skip)
    fourth: boolean;  // 4th (3 diatonic steps)
    fifth: boolean;   // 5th (4 diatonic steps)
    sixth: boolean;   // 6th (5 diatonic steps)
    seventh: boolean; // 7th (6 diatonic steps)
    octave: boolean;  // 8ve (7 diatonic steps / octave leap)
    ninthPlus: boolean; // 9+ (8+ diatonic steps / compound intervals: 9ths, 10ths, 11ths, etc.)
  }
  ```
- **UI Architecture**:
  - Replaced `<select id="select-intervals">` with `<fieldset class="control-group intervals-group">` containing a 9-item checkbox grid (`.intervals-grid` in 5 columns × 2 rows).
  - Matches the visual styling and 2-row height of `.subdivisions-group`.
- **Default State**:
  - `second: true`, `third: true`, all others `false`. This immediately eliminates mono-interval exercises on initial load, generating authentic sight-reading melodies combining steps and skips.
- **Safe Fallback**:
  - If a user unchecks all interval checkboxes, the generator automatically defaults to `[1, 2]` (seconds and thirds) without crashing or throwing errors.

### 2. Melodic Random-Walk Algorithm with Exact Interval Preservation
- In `MusicGenerator.sampleNextPitch(clef, intervals)`:
  1. Active diatonic choices are collected from active checkboxes (`[0, 1, 2, 3, 4, 5, 6, 7, '9+']`).
  2. A repetition guard prevents excessive consecutive unisons (`consecutiveUnisons >= 2`) when moving intervals are enabled.
  3. For standard intervals (1 through 7 steps) and compound leaps (`'9+'` selecting $\ge 8$ diatonic steps, such as 9ths, 10ths, 11ths): direction (ascending vs. descending) is evaluated against the clef boundaries:
     $$\text{canGoUp} = (\text{currentIdx} + \text{step} < \text{rangeLen})$$
     $$\text{canGoDown} = (\text{currentIdx} - \text{step} \ge 0)$$
  4. Because every clef's note pool spans 23 diatonic notes, at least one direction is **always** valid from any position in the range ($\max(\text{currentIdx}, 22 - \text{currentIdx}) \ge 11 \ge 8$).
  5. If both directions are feasible, boundary bias is applied when approaching edges ($\ge \text{rangeLen} - 4$ biases 85% downward; $\le 4$ biases 85% upward).
  6. If only one direction fits, the generator strictly uses that direction. This eliminates clamp-wrapping distortion and guarantees that every generated interval step is 100% mathematically exact (an octave is always an octave, a 9+ is always $\ge 8$ steps).
  7. The first note of a session anchors on the clef's default tonic/anchor note (e.g. `c/4` in treble/alto/tenor, `c/3` in bass), establishing a tonal reference for the sight-reader.

### 3. Clef-Dependent Pitch Pools Spanning ±3 Ledger Lines
- Defined `ClefPitchConfig` and expanded `CLEF_PITCH_RANGES`:
  - **Treble Clef (G)**:
    - Range: `e/3` to `f/6` (23 notes).
    - 3 ledger lines below: `f/3` (line), `e/3` (space).
    - 3 ledger lines above: `e/6` (line), `f/6` (space).
    - Default anchor: `c/4` (Middle C). Center line: `b/4`.
  - **Bass Clef (F)**:
    - Range: `g/1` to `a/4` (23 notes).
    - 3 ledger lines below: `a/1` (line), `g/1` (space).
    - 3 ledger lines above: `g/4` (line), `a/4` (space).
    - Default anchor: `c/3`. Center line: `d/3`.
  - **Alto Clef (C3)**:
    - Range: `f/2` to `g/5` (23 notes).
    - 3 ledger lines below: `g/2` (line), `f/2` (space).
    - 3 ledger lines above: `f/5` (line), `g/5` (space).
    - Default anchor: `c/4`. Center line: `c/4`.
  - **Tenor Clef (C4)**:
    - Range: `d/2` to `e/5` (23 notes).
    - 3 ledger lines below: `e/2` (line), `d/2` (space).
    - 3 ledger lines above: `d/5` (line), `e/5` (space).
    - Default anchor: `c/4`. Center line: `a/3`.
- **UI Clef Range Hint**:
  - Added dynamic display `#clef-range-hint` beneath the Clef selector (`CLEF_RANGE_DISPLAY`), informing the user of the active range (e.g., `E3 – F6 (±3 ledger lines)`).

---

## Consequences & Verification

- **Multi-Interval Exercises**: Verified that selecting combinations such as 2nds + 3rds, 4ths + 5ths, or 5ths + octaves generates melodic lines strictly containing only the enabled intervals.
- **Full Clef Coverage**: Verified in automated unit tests that notes across all 4 clefs stay strictly within their 23-note pools without out-of-bounds errors or glyph clipping.
- **Visual Harmony**: The new `.intervals-group` matches the `.subdivisions-group` footprint and seamlessly integrates into the control header.
- **Type Safety & Build**: Clean compilation with `npm run typecheck` (`tsc --noEmit`) and `npm run build`. Zero runtime errors.

# 0044. User-Selectable Ledger Lines (Above / Below, 0–3)

- **Status**: Accepted
- **Date**: 2026-10-02
- **Author**: Claude & lauseta

## Context & Problem Statement

Every clef used a fixed 23-note pitch pool: the staff plus exactly 3 ledger lines on each side, stored as 8 hardcoded arrays in `CLEF_PITCH_RANGES`. Ledger lines are one of the main difficulty factors in sight-reading, but users couldn't control them. Users want to choose separately how many ledger lines appear **above** and **below** the staff (0–3 each). That way they can drill low bass-clef ledger lines alone, or stay on the staff while they learn.

Constraints:
- The default 3/3 must reproduce the previous range and walk exactly.
- The 0–3 cap fits the current 220 px measure canvas (`MEASURE_CANVAS_HEIGHT`), so the renderer and scroller don't change.
- Ergodicity (AGENTS.md): every in-range move allowed by the selected intervals must keep P > 0.

## Decision & Implementation

### 1. Setting & persistence
- `AppSettings.ledgerLines: LedgerLineOptions = { above, below }`, `MAX_LEDGER_LINES = 3` (`types.ts`).
- Default `{ above: 3, below: 3 }`. `pickLedgerLines` (`storage.ts`) rounds and clamps each count to `[0, 3]`. Stored settings without the field fall back to 3/3.

### 2. Pitch bounds as diatonic arithmetic (`generator.ts`)
- `toStep('e/4') = octave·7 + 'cdefgab'.indexOf(letter)`, with the inverse `toKey(step)`.
- `ClefPitchConfig` is now `{ bottomLine, defaultAnchor, restPitch }`. The bottom lines are: treble `e/4`, soprano `c/4`, mezzo `a/3`, alto `f/3`, tenor `d/3`, baritone-f/c `b/2`, bass `g/2`.
- *n* ledger lines on a side reach the **space beyond the n-th ledger line**:

  $$\text{low} = b - (2\cdot\text{below} + 1), \qquad \text{high} = b + 8 + (2\cdot\text{above} + 1)$$

  Pool size is $11 + 2(\text{above} + \text{below})$: 23 at 3/3, 11 at 0/0. Even at 0, the space just outside the staff (treble D4 / G5) stays reachable, because it needs no ledger line.
- Exports: `pitchBounds(clef, ledger)`, `pitchPool(clef, ledger)` (VexFlow keys, used by tests), and `clefRangeLabel(clef, ledger)` (e.g. `"E3 – F6"`, which replaces `CLEF_RANGE_DISPLAY`).

### 3. Generator state
- `lastPitchIndex: Map<Clef, number>` became a single absolute `lastStep: number | null`. A clef or ledger change already triggers `resetSession`, so the per-clef map added nothing, and an absolute step stays meaningful when the bounds change.
- The first note is `clamp(step(defaultAnchor), low, high)`. For example, treble with 0 below starts on D4 instead of middle C.
- `generateMeasure` computes the bounds once per measure and passes them to `sampleNextPitch`.

### 4. Feasibility filter & fallback (`sampleNextPitch`)
- Before the weighted pick, interval choices that fit in neither direction are dropped. A step *s* fits if `idx+s ≤ n−1` or `idx−s ≥ 0`. `9+` fits if `max(upRoom, downRoom) ≥ 8`. Unison always fits. The weights (unison damping $1/(1+u)$, 1 otherwise) renormalize over the remaining choices, so every in-range move keeps P > 0.
- If nothing selected fits, the pitch moves by the largest step that fits, toward the side with more room (a random side on a tie). This can only happen with a small pool and wide intervals only, e.g. octaves only at 0/0 from mid-staff. This replaces the old `9+` short-room fallback and the silent `Math.max/min` clamp, which could produce a mislabeled interval.
- At 3/3 the filter never removes anything: 23 > 2·7 + 1, and the larger room is always ≥ 11 for `9+`. The random-number consumption is unchanged, so the default walk is identical.

### 5. Boundary bias zone per side
The previous inward bias (85% toward the staff) used a fixed margin of 4 pool notes. Applied to an 11-note pool, it covered 8 of the 11 notes. In a seconds-only staff drill the staff's own bottom line E4 then had a stationary probability of 0.09%, and the top line F5 0.49%. The margin is now per side, $\min(4, 2n)$ for *n* ledger lines on that side:

| setting | low / high margin | seconds-only stationary %, edge → edge |
|---------|-------------------|-----------------------------------------|
| 3/3 | 4 / 4 (unchanged) | 0.00 … 6.76 … 0.02 |
| 1/1 | 2 / 2 | 0.15, 0.85, 5.5, 8–9 … 4.8, 0.83 |
| 0/0 | 0 / 0 | 5.45, 9–11 … 5.45 |

So the bias only acts inside the ledger-line zone, and a staff-only drill walks the staff uniformly.

### 6. UI
- Below the clef `<select>`: `Ledger ↑ [0–3] ↓ [0–3]` (`#select-ledger-above`, `#select-ledger-below`, static options, default 3). The row is `.ledger-select-row`, which reuses the control-group select glass at a compact 24 px height.
- `#clef-range-hint` shows only the computed range. `updateClefRangeHint()` runs on hydrate, on clef change and on ledger change. Ledger changes call `updateSettings({ ledgerLines })`, then `resetSession()`.

## Consequences

- No geometry change: the 0–3 cap is tied to the 220 px measure canvas. Going beyond 3 would need a taller canvas and scroller changes.
- The default 3/3 is identical to before. A test checks `pitchPool(clef, 3/3)` against the legacy 23-note bounds for all 8 clefs, and a scratchpad run compared the full arrays from the previous commit.
- Tests cover range labels, anchor clamping, and a matrix of 8 clefs × 16 ledger settings × {2nds, 8ves, 9+, all}. The matrix checks that every pitch is in bounds, that both edges are reached with all intervals on, and that every move is a selected interval that fits, or exactly the documented fallback.
- Reachability is over the reachable state space: octaves-only stays within the anchor's octave class (as before), and seconds-only rarely reaches the outermost notes at ±3 because of the inward bias (as before).

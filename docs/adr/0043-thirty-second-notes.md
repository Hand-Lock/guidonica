# 0043. Thirty-Second Notes & Dotted Sixteenths

- **Status**: Accepted (extends [ADR 0040](0040-engraving-grammar-for-ties-and-cross-barline-ties.md)); amended by [ADR 0064](0064-two-beat-sub-eighth-slots.md); rhythm sampler superseded by [ADR 0065](0065-grammar-driven-rhythm-sampler.md)
- **Date**: 2026-09-27
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

The rhythmic vocabulary stopped at the 16th note. Users want 32nd notes as a separate subdivision toggle. Two AGENTS.md rules apply to any new value:

1. **Ergodicity.** Every placement-legal figure built from the enabled values must have P > 0.
2. **Tie grammar completeness.** `ties.ts` must know every notehead the generator can emit. A tie is legal only when no single canonical notehead can express the merged sound, so an unknown value would let redundant ties through (for example `32~32` in place of `16`).

A 32nd vocabulary also brings the dotted 16th (`16d` = 16 + 32) when Dotted is on. 32nd-note tuplets (a 1/32 column in the tuplet matrix) are out of scope.

## Decision & Implementation

### 1. Setting
- `SubdivisionOptions.thirtySecond?: boolean` is optional, like `dotted`, so older literals and tests stay valid. A missing value means off.
- `DEFAULT_APP_SETTINGS.subdivisions.thirtySecond = false`. `pickBoolRecord` backfills keys from the defaults, so older saved settings migrate without extra code.
- UI: a `subdiv-thirty-second` checkbox sits after 16th. It counts as a base subdivision for the "keep at least one subdivision on" rule.
- Icon: the Bravura 16th outline (ADR 0017), plus a second copy of its flag pair shifted up by one flag spacing (205 font units), plus a stem extended by the same 205 units. The copy's lower flag lands on the original's upper flag, so together they form three flags. The viewBox is 205 units taller, and `.icon-thirty-second { height: 1.38em }` (1.15em × 1227/1022) keeps the notehead the same size as the 16th's.

### 2. Tie grammar (`ties.ts`)
The `8d`/`8` rule, one level down: sub-eighth values never cross their eighth. Units are metric beats, so values double in 6/8.

| value | simple meters | 6/8 |
|-------|---------------|-----|
| `NOTE_VALUES` | `16d` = .375, `32` = .125 | `16d` = .75, `32` = .25 |
| `16` | period .5 → [0, .125, .25] | period 1 → [0, .25, .5] |
| `16d` | period .5 → [0, .125] | period 1 → [0, .25] |
| `32` | period .125 → [0] | period .25 → [0] |

For content on the 16th grid, the new `16` row gives the same results as the old `.25 → [0]` row. It only adds the middle placement used by `32 16 32`. Ties such as `16~32` at the start of an eighth are now illegal, because `16d` spells them.

### 3. Generator (`generator.ts`)
There are two recursive helpers. `unit` is the beat span of one eighth: 0.5 in simple meters, 1 in 6/8.

- `partitionSixteenthSpan` returns `[16]` (if 16th is on) or `[32, 32]`, chosen uniformly.
- `partitionEighthSpan` returns `[8]` (if eighth is on), `[S, S]`, `[16d, 32]` or `[32, 16d]` (if sixteenth and dotted are on), or `[32, 16, 32]` (if sixteenth is on).

The helpers are wired in only when `thirtySecond` is on:
- `partitionMeasure`: `thirtySecond` counts toward `hasAnySubdiv`.
- `partitionSingleBeat` gets these candidates: two eighth spans; `8d S` and `S 8d` (if eighth and dotted are on); and `S 8 S` (if eighth is on). Together with the existing candidates, they reach every placement-legal 8/8d/16/16d/32 figure within a beat.
- `partitionCompoundGroup`:
  - New candidates `q` + eighth span and its mirror (if quarter is on). A tie can't produce these, because `8~8` at offset 0 of the group is a canonical `q`.
  - Candidate 6 also runs with 32nds alone. Each eighth may be an eighth span (the fallback when eighth and sixteenth are both off), and `8d` may be followed by `32 32` (if eighth and dotted are on).
- Rests follow the existing 0.12–0.15 per-note probabilities.

### 4. Spacing
`computeBeatWidth` gives each 32nd 45 px: 360 px per beat in simple meters and 180 px per eighth in 6/8. The 32nd branch comes before all tuplet branches because it is wider than every one of them (septuplet 16ths = 280). `computeOptimalZoom` picks up the new width automatically.

### 5. Renderer
No change. `createStaveNote` attaches dots for any duration ending in `d`, which now includes `16d`, and `Beam.generateBeams` draws the three-line 32nd beams.

## Consequences

- With 32nds on, bars are wide (4/4 = 1440 px at zoom 1), so auto-zoom shrinks the staff more. This is the cost of legible 32nd spacing.
- 32nd-only practice works: every figure is `32`s, beamed in eighth groups.
- Tests cover beat conservation, the 32nd-only vocabulary, reachability of `32`, `16d`, `32 16 32` and `8d 32 32` in 4/4 and 6/8, placement-table membership of every generated note with 32nds on, tie rendering of `16d`/`32`, and beat widths.
- Known pre-existing gap, not addressed here: simple-meter two-beat groups never emitted `qd` followed by sub-eighth values (for example `qd 16 16`), and ties couldn't produce them either. Resolved in [ADR 0064](0064-two-beat-sub-eighth-slots.md).

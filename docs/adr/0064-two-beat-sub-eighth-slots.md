# 0064. Sub-Eighth Half-Beat Slots in Two-Beat Groups

- **Status**: Accepted (amends [0043](0043-thirty-second-notes.md))
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

ADR 0043 recorded a known gap: in simple meters, `partitionTwoBeats` never emitted a `qd`
followed by sub-eighth values (for example `qd 16 16`), and ties could not produce them either.
Candidates 2 (`qd 8`), 3 (`8 qd`) and 4 (`8 q 8`) wrote a literal `'8'` in every half-beat slot
and were gated on `subdiv.eighth`. That left a whole family of figures with zero probability:

- `qd 16 16`, `16 16 qd`, `16 16 q 8`, `8 q 16 16`;
- with eighths off, `16 16 q 16 16`;
- with 32nds on, `qd` followed by any 32nd-bearing half beat (`qd 32 16 32`, `qd 16d 32`, …).

All of them are placement-legal (ties.ts: `qd` sits on offset 0 or 0.5 of a two-beat group, and
16, 16d and 32 never cross their eighth), so their absence broke the Ergodic Generation
Principle (AGENTS.md §1, §3.6).

## Decision & Implementation

1. A new private helper `partitionHalfBeat(subdiv, allowRests, isDotted)` fills one half beat
   (0.5 quarter beats) with any legal figure:
   - with `thirtySecond` on, it delegates to `partitionEighthSpan(…, 0.5)`, which already
     covers `8 | 16 16 | 16d 32 | 32 16d | 32 16 32 | 32-pairs`;
   - otherwise it picks uniformly among `8` (if `eighth`) and `16 16` (if `sixteenth`), with
     rest rates 0.15 and 0.12 as elsewhere.
2. Candidates 2, 3 and 4 of `partitionTwoBeats` use the helper for each half-beat slot.
3. They are gated on `halfBeat = eighth || sixteenth || thirtySecond`:
   - 2 and 3: `quarter && isDotted && halfBeat`;
   - 4: `quarter && halfBeat`.

The candidate count is unchanged, so configurations that already had eighths see the same
weights for each structure; the new figures only take a share of the slot-level choice.

The change reaches 2/4, 3/4 (structures 2+1 and 1+2) and 4/4 (2+2), which all call
`partitionTwoBeats`. 6/8 is untouched: `partitionCompoundGroup` already emits `q 16 16` and
`q` + `partitionEighthSpan`.

## Consequences

- Every figure listed above now has P > 0. Four reachability tests in
  `tests/generator.test.ts` cover `qd 16 16` (4/4), `16 16 qd` (2/4), `16 16 q 16 16` (3/4, eighths
  off) and `qd` + a 32nd-bearing half beat (4/4); all four fail against the previous generator. `tests/beamRender.test.ts` pins the beaming fix below.
- With eighths off but quarter, sixteenth and dotted on, candidates 2–4 now exist where they
  did not before, so `qd` and syncopated `q` appear in such configurations. This is intended:
  they were legal all along.
- Rendering exposed a VexFlow 5 bug, fixed in `renderer.ts`. `Beam.generateBeams` splits a beam
  group at unbeamable notes with `parseInt(note.getDuration()) < 8`, and that is `NaN` for letter
  codes (`'q'`). So `16 16 qd` and `16 16 q` grouped the quarter with the sixteenths, and the
  whole group was rejected: the sixteenths were drawn with flags. (`qd 16 16` worked because the
  `qd` filled its own group.) `createStaveNote` now spells durations numerically via
  `vexDuration` (`w h q` → `1 2 4`, keeping a `d` suffix), and the quarter-tuplet bracket check
  compares `getDuration()` against `'4'`. The generator's `'q'`/`'qd'` codes are unchanged.
  This was verified in headless Chromium: every `16 16` beams before and after `qd`/`q`, and whole
  notes, rests, dotted halves and quarter triplets render as before.

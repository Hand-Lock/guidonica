# 0065. Grammar-Driven Rhythm Sampler, Rest Spelling & Tuplet Merges

- **Status**: Accepted (supersedes the rhythm sampler of [0036](0036-ergodic-metric-tree-procedural-generation-and-dotted-rhythms.md), [0043](0043-thirty-second-notes.md) and [0064](0064-two-beat-sub-eighth-slots.md); amends [0006](0006-multi-interval-selection-and-clef-pitch-pools.md), [0010](0010-separate-tuplet-subdivision-matrix-menu.md), [0011](0011-tuplet-beam-stem-direction-unification.md), [0040](0040-engraving-grammar-for-ties-and-cross-barline-ties.md) and [0044](0044-user-selectable-ledger-lines.md))
- **Date**: 2026-10-04
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Rhythm came from hand-written metric-tree partitioners: `partitionTwoBeats`,
`partitionSingleBeat`, `partitionCompoundGroup`, `partitionEighthSpan` and, after ADR 0064,
`partitionHalfBeat`. Each one listed its candidate figures by hand. Every gap in those lists was a
legal figure with P = 0 (ADR 0064 fixed one family of them, `qd 16 16` and its relatives), and
every new value or meter meant another round of auditing the lists. Two separate tables already
said what is legal: `NOTEHEAD_PLACEMENTS` (where a notehead may start) and the tie grammar
(`isLegalInnerTie`). The partitioners repeated that knowledge, and could disagree with it.

Three related problems:

- **Rests** were drawn per slot by each partitioner, at different rates. A silent run could be
  spelled in ways a copyist would not use (a rest hiding a beat, a dotted rest in simple time),
  and adjacent rests were never combined.
- **Tuplets** were always n equal members, so `3[q 8]` (a quarter and an eighth under a triplet
  bracket) could not appear. Ties inside one group were forbidden outright, which also removed
  legal figures such as `5[q~qd]`.
- **Pitch**: the walk pushed 85% inward near the edges of the pool (ADR 0006, ADR 0044). The
  walk already only draws intervals that fit, so this bias was not needed to stay in range, and
  it made the edge notes rarer than the rest of the pool.

## Decision & Implementation

### 1. The 32nd grid

A bar is a row of grid points one 32nd apart: `unitsPerBeat` = 8 in simple meters (quarter
beats) and 4 in 6/8 (eighth beats), so `barUnits` = 32, 24, 16 and 24 for 4/4, 3/4, 2/4 and 6/8.
Every note value and every supported tuplet group spans a whole number of units.

### 2. The grammar (`rhythmGrammar`, generator.ts)

`enabledValues(subdiv)` lists the values in play: each enabled base value plus, with dotted on,
its dotted form (`hd`, `qd`, `8d`, `16d`). For each grid point `u`, `buildGrammar` collects:

- **note steps**: values whose notehead `placementOf(ts, u / unitsPerBeat, span)` accepts, as
  canonical or tolerated;
- **tuplet steps**: enabled cells whose `TUPLET_PLACEMENTS` grid contains `u` and whose group
  fits in the bar.

Two passes then prune and audit the steps:

- **Backward completability**: `completable[barUnits] = true`, and
  `completable[u] = ∃ step at u with completable[u + step.units]`. Only steps that land on a
  completable point are kept, so the sampler can never reach a dead end.
- **Forward "used" pass**: from `u = 0`, follow every kept step and record each value and cell
  that some complete bar contains.

### 3. The beat-unit fallback

The beat unit (`q`; `8` in 6/8) is added to the values, and the grammar rebuilt, only when:

- the enabled values cannot fill a bar (`completable[0]` is false: whole notes alone in 3/4,
  quarters alone in 6/8); or
- an enabled value or cell occurs in no complete bar, and adding the beat unit makes it occur
  (half + dotted in 4/4: `hd` needs a `q` beside it).

Nothing else is ever added. When nothing at all is selected, quarters are used. `w` in 4/4,
`h` in 4/4 and `8` in 2/4 fill their bars alone and stay alone.

### 4. Uniform step choice (`composeRhythm`)

At each grid point the sampler draws uniformly among the note steps and one aggregate "tuplet"
option. The tuplet option, if drawn, then picks one tuplet step uniformly. Every step that
remains in the grammar lies on some complete bar, so each legal bar
ω = (s₁, …, s_k) has

  P(ω) = ∏ 1 / (|notes(uᵢ)| + [tuplets(uᵢ) ≠ ∅]) · (1 / |tuplets(uᵢ)| for tuplet steps) > 0.

Grouping the tuplets into one option keeps plain figures from being drowned when many tuplet
cells are enabled. The grammar is a pure function of `(ts, values, cells)` and is memoized under
that key; the memo is cleared when it reaches 64 entries (`GRAMMAR_MEMO_LIMIT`), which is far
more than one session uses.

### 5. Tuplet placement table (`TUPLET_PLACEMENTS`, types.ts)

This is the tuplet counterpart of `NOTEHEAD_PLACEMENTS`. Its keys are exactly
`TUPLET_SUPPORT[ts]`, and `tupletSpan(ts, name, value)` gives a group's span in metric beats.

| Meter | Cells | Span | Starts |
|---|---|---|---|
| simple | `triplet:1/16` | half a beat | every half beat |
| simple | `triplet:1/8`, `quintuplet/sextuplet/septuplet:1/16` | one beat | every beat |
| simple | `triplet:1/4`, `quintuplet/sextuplet/septuplet:1/8` | two beats | beat 1 (and 3 in 4/4); in 3/4, beat 1 or 2 |
| 4/4 | `quintuplet/sextuplet/septuplet:1/4` | the bar | 0 |
| 3/4 | `duplet:1/4`, `quadruplet:1/4`, `quadruplet:1/8` | the bar | 0 |
| 6/8 | `triplet:1/16` | one eighth | every eighth |
| 6/8 | `duplet/quadruplet:1/16` | half a dotted beat | every 1.5 eighths |
| 6/8 | `duplet/quadruplet:1/8` | one dotted beat | 0 or 3 |
| 6/8 | `duplet/quadruplet:1/4` | the bar | 0 |

### 6. Tuplet members (`makeTupletItems`)

A group of n units is first split into members. Each inner boundary independently merges its two
neighbours with `TUPLET_MERGE_PROBABILITY` = 0.2. A draw is repeated until:

- every member is one notehead in `TUPLET_MEMBERS` (1, 2, 3, 4 or 6 units: `8 q qd h hd` for
  eighth tuplets);
- each member longer than one unit has its value enabled (so dotted members need dotted on);
- there are at least two members.

With rests on, each member of 1, 2 or 4 units is silent with `SILENCE_PROBABILITY` = 0.15. The
draw is repeated if every member is silent. Adjacent silent members are combined into the longest
undotted enabled rest, so no tuplet rest is ever dotted. The renderer takes the ratio from
`tupletNumNotes`/`tupletNotesOccupied`, not from the number of members. `tupletBracketed` and
`tupletRatioed` are removed from `NoteData`.

### 7. Ties inside a tuplet group (`isLegalInnerTie`, ties.ts)

A tie inside one group is legal only when the merged length, in tuplet units
(`PartitionItem.tupletUnit`), is not in `TUPLET_NOTEHEAD_UNITS` = {1, 2, 3, 4, 6}. A single member
could not express such a length. The chain rule checks every suffix of the chain, as it does
outside tuplets. Examples in a quintuplet of eighths:

- `8~8` (= `q`), `q~8` (= `qd`) and `q~q` (= `h`) are illegal;
- `q~qd` (5 units) is legal.

Tuplet time still never merges with plain time, so a tie across the edge of a group stays legal.

### 8. Rest spelling (`REST_PLACEMENTS`, `spellRest`, `consolidateRests`, ties.ts)

Plain notes are silenced with `SILENCE_PROBABILITY`. Each run of adjacent plain rests is then
re-spelled as one silence by `spellRest`, using a rest table that never hides a beat:

| Meter | Rest | Starts |
|---|---|---|
| 4/4 | h | either half of the bar |
| simple | q, 8, 16, 32 | multiples of their own span |
| 6/8 | qd, q | a group start (0 or 3) |
| 6/8 | 8, 16, 32 | multiples of their own span |

No rest is dotted except the whole-group `qd` in 6/8. `spellRest` is greedy: at each point it
uses the longest legal rest that fits, preferring the enabled values. A value outside them is
used only where no enabled rest is legal: a silent syncopated `q` with only quarters on becomes
`8r 8r`. So a level without half notes shows no half rest.

**A silence over the whole bar is always one whole rest**, in every meter and whatever the
enabled values (the bar-rest convention). The generator places it on the fourth line (two steps
above the other rests), and the renderer centres it in the bar.

### 9. Beams and brackets (renderer.ts)

Inside a tuplet, each run of two or more adjacent sounding notes of eighth length or shorter gets
its own beam (`autoStem`). A rest or a longer member breaks the run. The bracket is drawn unless
a single beam joins every member of the group; then the beam already shows the group. So
`3[8 8 8]` has no bracket, and `6[16 16 r 16 16 16]` and `3[q 8]` do.

### 10. Symmetric pitch walk (`sampleNextPitch`)

The 85% inward bias is removed. When an interval fits both up and down, the direction is a fair
coin. The walk stays in range because only intervals that fit are drawn (and the documented
fallback covers a tiny pool), so no bias is needed. The edge notes are now as reachable as the
middle of the pool.

## Consequences

- The partitioners and their hand-written candidate lists are gone (generator.ts is about 480
  lines shorter). Legality is defined in one place, the placement tables. A new value or meter only
  needs table entries; the grammar derives the rest.
- Every legal bar has P > 0 by construction, not by audit. Tests check that every subdivision set
  (all 128) and every lone tuplet cell fills its bar with no dead end in every meter, that the
  fallback is added only when needed, and that `hd` is reachable with half + dotted in 4/4.
- Figure frequencies change. The sampler is uniform per step, not per figure, so bars with many
  short notes are not favoured the way the old candidate weights favoured some structures.
- Rests read like a copyist's: placed on the beat grid, combined, undotted outside 6/8, and a
  whole rest for a silent bar. `tests/ties.test.ts` pins the table, the greedy spelling and the
  generated output.
- Tuplets gain merged members (`3[q 8]`, `5[q 8 8 8]`, …), silent members (never all of them)
  and legal inner ties. `tests/tupletRender.test.ts` covers the beam runs, the bracket rule and the
  centred bar rest.
- With seconds only, up and down moves are now about 50/50 everywhere both fit (tested). The edge
  notes of a ±3 pool appear more often than under ADR 0044's margin.

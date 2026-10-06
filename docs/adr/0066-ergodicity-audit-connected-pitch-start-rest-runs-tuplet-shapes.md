# 0066. Ergodicity Audit: Connected Pitch Start, Rest Runs & Uniform Tuplet Shapes

- **Status**: Accepted (amends [0065](0065-grammar-driven-rhythm-sampler.md) §6, §8 and §10, [0006](0006-multi-interval-selection-and-clef-pitch-pools.md) item 7 and the fallback of [0044](0044-user-selectable-ledger-lines.md)); amended by [0070](0070-note-selection-and-level-progression.md) (connected start)
- **Date**: 2026-10-04
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

The Ergodic Generation Principle (AGENTS.md) requires every valid figure within a parameter
configuration Ω to have P > 0. A figure with P > 0 can still be useless for practice if its
expected waiting time is longer than any session. Every generation parameter (clef, ledger lines,
meter, subdivisions, dotted, tuplets, rests, ties, intervals) was audited against both criteria
with exact dynamic programming over the rhythm grammar and Monte Carlo runs of the real
generator (50 000 bars per configuration, waiting times at each preset's tempo).

### Audit results

| Parameter | Verdict |
|---|---|
| Rhythm grammar (4 meters × 128 subdivision sets × every tuplet cell) | **OK.** Every legal bar has P > 0 by construction (ADR 0065 backward/forward passes), and every lone tuplet cell is reachable with every base set. The rarest (grid point, step) in the virtuoso preset is about 7.6e-3 per bar (~6 min). |
| Ties (inner, chains, in tuplets, across barlines) | **OK.** Each legal boundary is tied independently with p = 0.25. |
| Clef / ledger lines | **OK.** The pool bounds are correct. With all intervals, edge notes come up about half as often as the middle (max/min frequency 1.9): the stationary distribution of a walk that reflects at the edges. Every note keeps P > 0, so this stays as is. |
| **Pitch, disconnected interval sets** | **Violation.** The walk always started on the clef anchor. When the selected moves do not connect the pool, it stayed in the anchor's component forever: thirds only reached 11 of 23 notes (lines only, never spaces), fourths 7, fifths 6, octaves 3, unison 1 (always C). The `activeChoices.length === 0` fallback also wrote an unselected interval (a 6th with octaves only at 0/0). |
| **Rests** | **Excessive rarity.** Silence was drawn independently per note (0.15), so a k-item silence cost 0.15^k. Full-bar rest in 3/4 with eighths and sixteenths: 0 in 50 000 bars (~0.15⁹, about 1.6 years of practice). |
| **Tuplet member shapes** | **Excessive rarity.** Members came from independent 0.2 merges, so shapes with several merges decayed geometrically: in the virtuoso preset a whole-note tuplet member took ~2 h 16 min, a whole-member rest ~9 h, the quintuplet `[w q]` ~12 h. |
| **Dotted values without their shorter partner** | **Dormant but valid.** No bar can contain `8d` without 16 or 32, `16d` without 32, or (4/4, 2/4) `qd` without 8, 16 or 32. Elementary and Intermediate never show `8d`, Advanced never shows `16d`. P > 0 holds vacuously (no legal bar contains them), but the UI did not say so. Decision: keep the strict alphabet and document it. |
| Accidentals (listed in SPEC Ω) | Not implemented: the app is diatonic only, so this axis of Ω is a single point. |

## Decision & Implementation

### 1. Connected pitch start (`startIndex`, generator.ts)

The interval toggles become moves through `selectedIntervals` (nothing selected still falls back
to seconds and thirds). `movesFrom(i, choices, n)` lists the pool indices one selected move away,
and a pitch is **live** if that list is non-empty (unison counts).

`startIndex` clamps the anchor into the pool as before and runs a BFS over `movesFrom` from it:

- if the anchor is live and its component holds every live pitch, the session starts on the
  anchor. This keeps ADR 0006's tonal reference for every connected set (every preset and every
  intro preview, checked for all clefs);
- otherwise the start is a uniformly random live pitch. Each component (with thirds only, the
  lines or the spaces) and each melody inside it has P > 0 per session, so P(ω) > 0 holds over
  the practice, not just over one walk.

**No dead ends.** If a move of s steps takes i to j = i + s, then j − s = i ≥ 0, so the same
move fits back from j (and symmetrically for i − s). A `9+` leap of s ≥ 8 leaves room s ≥ 8 behind
it, so `9+` still fits. By induction, a walk that starts live stays live: some selected interval
always fits, and every written interval is one the user selected. The old "largest step toward
more room" fallback is removed. A guard that redraws a live start remains for a pool or interval
change without a reset. It cannot be reached: clef, ledger, interval, subdivision, rest and tie
changes all go through `resetSession` → `buffer.reset()` → `resetPitch()`.

### 2. Two-state rest runs (`drawSilent`, generator.ts)

Silence is now a Markov chain over plain notes and tuplet members with state `lastSilent`:

$$P(\text{silent} \mid \text{sounding}) = p_s = 0.1 \;(\texttt{SILENCE\_PROBABILITY}), \qquad P(\text{silent} \mid \text{silent}) = p_c = 0.5 \;(\texttt{SILENCE\_CONTINUE\_PROBABILITY})$$

A k-item silence costs $p_s \cdot p_c^{k-1}$ instead of $0.15^k$. The stationary rest share is
$p_s / (p_s + 1 - p_c) = 1/6$, close to the old 0.15. The state carries across tuplet members and
barlines (bars are composed in order, lookahead included) and is reset by `resetPitch()`. A
tuplet member of 3 or 6 units (dotted) can never be silent, so it counts as sounding. The "never
all silent" redraw of a tuplet group restarts the chain from its state before the group. Rest
spelling (`spellRest`, `consolidateRests`) is unchanged.

### 3. Uniform tuplet shapes (`tupletCompositions`, `drawTupletMembers`)

`TUPLET_MERGE_PROBABILITY` and the merge-and-reject loop are removed. `tupletCompositions(n,
value, values)` enumerates every composition of n into at least two members, each one enabled
notehead (`tupletMember(...) !== null`). Since n ≤ 7 there are at most 2⁶ = 64. They are grouped
by member count and memoized by cell value and allowed member lengths. A group draws its member
count m uniformly among the feasible counts M, then one composition with m members uniformly:

$$P(c) = \frac{1}{|M| \cdot |C_m|}$$

A triplet is `[1 1 1]` ½ and `[2 1]` / `[1 2]` ¼ each. The rarest quintuplet-of-quarters shape
is 1/24 per group (was ~0.7%), and the rarest septuplet-of-eighths shape is 1/120. The figure of
equal notes keeps the largest single share. Rest handling of members is unchanged.

### 4. Strict dotted alphabet, documented

No behaviour change. The `dottedTitle` tooltip in every locale (and the English `title` in
`index.html`) now says that `8d` needs 16ths or 32nds and `16d` needs 32nds. The `enabledValues`
comment states the full rule. `tests/generator.test.ts` pins the exact dormant list for all
4 meters × 128 subdivision sets: `w` outside 4/4, `h` in 6/8, `hd` in 2/4, `qd` in 4/4 and 2/4
without 8/16/32, `8d` without 16/32, `16d` without 32.

## Measurements

Same script before and after, 50 000 bars per row, waiting times at the preset's tempo:

| Metric | Before | After |
|---|---|---|
| Pitches reached across 300 sessions, treble ±3 (thirds / fourths / fifths / octaves / unison only) | 11 / 7 / 6 / 3 / 1 of 23 | 23 / 23 / 23 / 23 / 23 of 23 |
| Full-bar rest, 3/4 eighths + sixteenths | 0 | 1.2e-3 per bar (~28 min) |
| Full-bar rest per bar: elementary / intermediate / advanced / virtuoso | 2.8e-2 / 2.5e-2 / 1.8e-2 / 1.4e-2 | 5.7e-2 / 4.0e-2 / 3.0e-2 / 2.0e-2 |
| Silent share of the time, virtuoso | 14.7% | 15.6% |
| Virtuoso: bar with a whole-note tuplet member | 3.2e-4 (~2 h 16 min) | 4.0e-3 (~11 min) |
| Virtuoso: bar with a whole tuplet rest | 8.0e-5 (~9 h) | 1.4e-3 (~32 min) |
| Virtuoso: bar with quintuplet `[w q]` | 6.0e-5 (~12 h) | 5.4e-4 (~81 min) |

Within one session, a disconnected interval set still stays in one component: a melody of
thirds only can never move from a line to a space. That is the nature of the constraint, not a
gap. Ergodicity holds over sessions.

## Consequences

- Every interval subset (all 512) writes only selected intervals; a test walks all of them on
  three pools, with session resets. Thirds, fourths, fifths, octaves and unison alone start on
  every live pitch over 2000 resets. Connected sets still start on the anchor.
- Rests come in runs: long silences and silent bars now appear within a session in every level,
  at about the same overall rest density.
- Tuplet shapes are spread evenly over member counts, so multi-merge shapes (`5[w q]`,
  `7[qd h]`) appear in minutes, not hours.
- The intro preview test now excludes the bar rest, which is the whole-rest glyph in every meter
  and not a whole-note value. The tie-chain reachability test runs 10 000 bars: an inner chain
  is about one bar in a thousand, and at 2000 bars the test already failed about 1 run in 7
  before this change.

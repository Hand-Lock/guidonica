# 0070. Note Selection Toggles & Reworked Level Progression

- **Status**: Accepted (amends [0006](0006-multi-interval-selection-and-clef-pitch-pools.md), [0049](0049-level-presets-onboarding-intro.md), [0051](0051-intro-preview-representation-presets.md), [0052](0052-intro-preview-signature-check.md) and the connected start of [0066](0066-ergodicity-audit-connected-pitch-start-rest-runs-tuplet-shapes.md))
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A user asked to read only some notes (for example only C and G), which helps early beginners
who are still learning where each note sits on the staff. Until now the pitch pool was every
diatonic step between the clef's ledger-line bounds, and the only melodic control was the set of
interval classes.

The feature must respect the project rules: the generator stays ergodic over the user's settings
Ω, no hidden heuristic may suppress a valid melody, every string is localized and no dependency is
added. A second request reworks the level progression so that only Beginner restricts the notes,
while the other levels advance tempo, intervals and note values more evenly.

## Decision & Implementation

### 1. Notes are pitch classes

`PitchClassOptions` (`src/notation/types.ts`) holds seven booleans `c … b`, indexed like
`LETTERS`. A selected class applies in every octave of the clef and ledger-line range. The range
already chooses the octaves, so per-pitch toggles (up to 23 chips) would add bloat without adding
reach. A chromatic extension can add keys later.

`AppSettings.pitchClasses` defaults to all seven on. `storage.ts` validates it with
`pickBoolRecord`, and a record with every note off loads as all on, matching the UI rule that the
last checked chip cannot be cleared.

### 2. Walk over a sorted step array

The walk used to move over contiguous pool indices. It now moves over a sorted array of absolute
diatonic steps (`step = 7·octave + letter index`):

- `pitchSteps(clef, ledger, classes?)` returns the ascending steps within `pitchBounds` whose letter
  is selected. If no class is selected (or `classes` is omitted) it returns every step.
  `pitchPool` maps the result to VexFlow keys, so existing callers keep working.
- `targetsOf(idx, choice, steps)` lists the pool indices reachable by one interval class, up and
  down, nearest first. A fixed class `k` (unison … octave, `k = 0 … 7`) targets the pitches exactly
  `k` steps away; `9+` targets every pitch at least 8 steps away. `movesFrom` and `livePitches`
  build on it.
- `sampleNextPitch` keeps only the effective classes that have a target from the current pitch,
  then runs the unchanged unison-damped weighted pick (ADR 0066). A fixed step flips a fair coin
  only when both directions have a target. `9+` picks a direction that has targets, then a target
  uniformly within it.

`steps` and the effective intervals are computed once per measure (at most 23 pitches, a
negligible cost). Ties and rests are untouched.

**Bit-identical output when every note is on.** With a full pool, `steps[i + k] = steps[i] + k`,
so a fixed class has at most one target per side and the old room test (`i + k ≤ n − 1`,
`i − k ≥ 0`) matches "a target exists". The `Math.random()` calls happen in the same order with
the same arguments. This was verified against the previous generator with a seeded
`Math.random`: 73 interval masks × 8 clefs × 3 ledger pools × 30 bars, with rests and ties on, gave
identical output. All existing generator tests pass unmodified.

### 3. Effective intervals and the fallback

`effectiveIntervals(intervals, steps)` is exported as the single source of truth for both the
generator and the UI:

- **realizable**: the classes that some pair of pool pitches spans (fixed `k ≤ 7`), plus `9+` when
  the pool spans at least 8 steps. Unison always counts.
- **choices**: the selected classes (nothing selected means 2nds and 3rds, as before) that are
  realizable.
- **fallback**: if the user selected a moving class but none of them is realizable, every
  realizable moving class is added. This extends the existing "nothing selected → 2nds & 3rds"
  rule instead of inventing a hidden substitute. A unison-only selection stays unison-only: it is a
  legitimate Ω point. A one-pitch pool falls back to `[0]`.
- **dormant**: every class that cannot occur with the selected notes, whether selected or not.

*Why the fallback stays connected.* In fallback, `choices` holds every realizable moving class.
For any two pool pitches at distance `d`: if `d ≤ 7`, then `d` is realizable, so it is an edge; if
`d ≥ 8`, then `9+` is realizable, so it is also an edge. The fallback graph is therefore complete,
and every pool pitch is reachable from any start.

*Why the walk has no dead ends.* Every move is reversible. A move by `k` from `s` to `s ± k`
between two selected pitches is a move by `k` back. A `9+` leap of at least 8 steps leaves a `9+`
leap back. So from a live start, some effective class always has a target, and every written
interval is an effective one.

### 4. Nearest-anchor start

The clef anchor becomes the pool pitch nearest the clamped clef anchor, taking the lower one on a
tie. With a full pool this is exactly the old clamp. The rest of ADR 0066's connected-start rule is
unchanged: the session starts on the anchor when its component of the move graph holds every live
pitch, and otherwise on a uniformly random live pitch.

**Ergodicity statement.** Ω gains a Notes axis:
Ω = (Clef, TimeSig, Subdivisions, Dotted, Ties, Intervals, Notes, Accidentals). Every melody whose
pitches lie in the selected classes and whose moves are effective intervals has P > 0.

### 5. UI

- **Notes chips.** A Notes fieldset sits before Intervals in the Melody section: seven
  `checkbox-item` chips (`#note-c` … `#note-b`) in the existing `checkbox-grid` style, with a
  localized tooltip. The chip text comes from `pitchClassNames(mode)` (`src/i18n/index.ts`) and
  follows the Labels setting. With Labels = None it uses the national convention: letters for
  scientific and Helmholtz locales (en, de, with German H), and syllables for franco-belgian
  locales (it, fr, es). A change keeps at least one chip checked, saves, refreshes the range hint
  and resets the session.
- **Availability.** `updateMelodyAvailability()` calls `effectiveIntervals` on every clef, ledger,
  notes, interval or settings change:
  - Each dormant interval chip gets the `is-dormant` class (reduced opacity and a dashed border,
    with no new assets) and the tooltip suffix `intervalDormant`. It stays clickable.
  - The `#intervals-fallback-hint` line is shown while the fallback is active.
- **Range hint.** The range hint shows the lowest and highest selected pitch.

New locale keys, present in all five locales: `pitchClasses`, `pitchClassesTitle`,
`intervalDormant` and `intervalsFallback`.

### 6. Level progression

| Level | Tempo | Notes | Intervals | Rhythm |
|---|---|---|---|---|
| Beginner | 50 → 60 | C D E G A | unison, 2nd, 3rd | unchanged |
| Elementary | 60 → 70 | all | unison … 4th + 5th + 8ve | unchanged |
| Intermediate | 72 → 80 | all | unison … 8ve | + 16ths |
| Advanced | 80 → 90 | all, 9+ included | all | + 32nds |
| Virtuoso | 92 → 120 | all | all | unchanged |

- **Beginner** uses the do-pentatonic. Its widest gap is a minor 3rd (E → G, A → C), so 2nds and
  3rds connect it in every clef and octave. The nearest anchor's component therefore holds every
  live pitch, and the session keeps the clef-anchor start (ADR 0006/0066). Tests check this in
  8 clefs × 16 ledger settings.
- `PresetSettings` gains `pitchClasses`, so `matchLevel` compares the notes as well. A filtered
  setup that matches no preset shows Custom (ADR 0053).
- **Level descriptions** are rewritten in every locale to name the new novelties.

**Intro previews.** Previews still only switch toggles off (ADR 0051), and their signature checks
(ADR 0052) follow the new novelties:

- **Intermediate** omits whole notes to eighths, so its card shows 16ths beside eighth triplets.
  Its check requires both.
- **Advanced** keeps its omissions and now requires non-tuplet 32nds over the window.
- **Virtuoso** keeps 32nds, because dropping them would change `computeBeatWidth` (360 → 280). Its
  check now requires a tuplet plus enough 32nd or 1/16-tuplet beats.

The measured lowest acceptance rates are 0.48 (Intermediate), 0.40 (Advanced) and 0.43
(Virtuoso), all above the 25 % floor in `tests/presets.test.ts`.

## Consequences

- Beginners can drill a few notes at a time. The walk, the start rule and the UI read the same
  `effectiveIntervals`, so the interval chips never lie about what can be written.
- With all notes on, the output is bit-identical to before, so saved settings and existing tests
  are unaffected.
- The fallback replaces an impossible selection with the realizable intervals and says so through
  the hint. It never silently narrows a selection that could occur.
- Pitch classes can be extended with chromatic keys when accidentals arrive, without changing the
  walk.

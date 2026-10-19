# 0111. Notation Rule Seams

- **Status**: Accepted (extends [0104](0104-engine-entry-point.md) §1)
- **Date**: 2026-10-19
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0065](0065-grammar-driven-rhythm-sampler.md), [0070](0070-note-selection-and-level-progression.md), [0076](0076-compound-triple-and-quadruple-meters.md), [0090](0090-half-note-beat-meters.md), [0103](0103-embeddable-engine-seams.md)

## Context & Problem Statement

`guidonica/engine` (ADR 0104) lets an embedder generate, draw and play exercises, but not ask what
a setting allows. An embedder that writes or checks notes of its own (an editor, a validator, an
exercise built beside a generated one) needs the same answers the generator uses:

- which note values a subdivision setting enables, dotted values included (ADR 0065);
- which pitches a clef, its ledger lines and the selected note names allow (ADR 0070);
- how many metric beats a value spans in a meter: a `q` is one beat in 4/4 and two in 6/8
  (ADR 0076, 0090);
- where one notehead of a span may start in a bar, the Gould placement table.

The rules live in `src/notation/generator.ts` and `src/notation/ties.ts`, behind the `exports`
map. Without a seam an embedder would copy the clef ranges, ledger rules and placement tables, and
the copy would drift the first time a meter or a rule changed here.

## Decision

`src/engine.ts` re-exports four existing functions and one type, unchanged:

| Export | From | Answers |
| --- | --- | --- |
| `enabledValues(subdivisions)` | `notation/generator.ts` | The value alphabet, longest first |
| `pitchPool(clef, ledgerLines, pitchClasses?)` | `notation/generator.ts` | The ascending pitch pool as VexFlow keys |
| `noteSpan(ts, duration)` | `notation/ties.ts` | Metric beats of a value, or null if the meter has no such value |
| `placementOf(ts, offset, span)` | `notation/ties.ts` | `'canonical'`, `'tolerated'` or null for one notehead |
| `PlacementKind` (type) | `notation/ties.ts` | The result of `placementOf` |

They are pure functions of their arguments: no state, no DOM, no build constants. `ties.ts` imports
only types and `METER`, so the entry point's import graph gains no module the embedder cannot load.
The barrel still holds no logic, and the app keeps importing the modules directly.

## Verification

`tests/engine.test.ts` (*Notation rule seams*):

- the entry point exports the generator's own function objects, not copies;
- every sounding non-tuplet note of 32 seeded bars (rests and ties on) has a value in
  `enabledValues`, a pitch in `pitchPool`, a `noteSpan` equal to its `beatDuration` and a non-null
  `placementOf`; every rest's span matches too;
- spans and placements in 4/4 and 6/8: `q` spans 1 and 2 beats, `h` on beat 2 of 4/4 is tolerated,
  a `q` across the middle or the barline has no placement.

## Consequences

- Additive: no existing export or behaviour changes, so the free app is untouched.
- The four functions become public API (ADR 0104): renaming one, or changing its parameters or
  result, is a breaking change and is called out as such in the changelog.
- New rules reach embedders through these functions when they bump their pin, without a copy to
  update.

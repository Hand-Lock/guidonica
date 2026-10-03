# 0051. Representation Presets for the Intro Level Previews

- **Status**: Accepted; amended by [0052](0052-intro-preview-signature-check.md)
- **Date**: 2026-10-03
- **Author**: Claude & lauseta
- **Amends**: [0050](0050-intro-notation-previews.md)

## Context & Problem Statement

- ADR 0050 draws each level card from the level's **exact** preset. At the scroller's real linear spacing, a card window only holds about 1–3 beats:

  | Level | Beat width | Px per beat at `STRIP_SCALE` 0.42 |
  |---|---|---|
  | Beginner | 110 | ≈ 46 |
  | Virtuoso | 360 | ≈ 151 |

- Coarse figures fill that window easily: a whole note, an h/hd, a bar of quarter-value tuplets, repeated notes. A Virtuoso card could show a single whole note, and an Advanced card could look easier than Intermediate.
- The card should show what the level is *about*, without misrepresenting what the level produces and without touching the generator (AGENTS.md §1, §3.5).

## Decision & Implementation

### 1. A representation only switches toggles off

Each preset carries a `preview: PreviewOmissions` entry (`src/presets.ts`):

```ts
export interface PreviewOmissions {
  subdivisions?: readonly Exclude<keyof SubdivisionOptions, 'dotted'>[];
  intervals?: readonly (keyof IntervalOptions)[];
  tupletValues?: readonly TupletValue[]; // drops every tuplet cell of these note values
  rests?: false; // literal false: can only switch rests off
}
```

`buildPreviewSettings(level, clef)` starts from `buildPresetSettings(level, clef)` (deep clone, tuplets limited to the meter) and sets every listed toggle to `false`. Nothing can be switched on; the literal type `false` on `rests` enforces this at compile time. As a result **Ω_preview ⊆ Ω_preset**, and any figure a card shows is one the level can actually produce.

`buildPresetSettings` and `matchLevel` are unchanged, so applying a level still loads the full preset.

### 2. Five rules

1. **Drop the floor, keep the ceiling.**
   - Drop whole notes everywhere, half notes from Elementary up, and quarter notes from Intermediate up.
   - Elementary keeps the quarter because its dotted and syncopated figures (qd 8, 8 qd, 8 q 8) need it.
   - Virtuoso also drops plain eighths and quarter-value tuplets.
   - Keep what is new at each level: dots, rests, ties, tuplets, 16ths, 32nds, wide leaps.
2. **Keep the beat-width setter.** The value that sets `computeBeatWidth` is never omitted, so a strip keeps the scroller's real spacing.
3. **Interval band.** Never unison. Each card shows its level's widest intervals, overlapping the neighbouring level by one step:
   - Beginner 2nd–3rd, Elementary 3rd–4th, Intermediate 4th–5th, Advanced 6th–8ve, Virtuoso 8ve–9th+.
   - `sampleNextPitch` filters by feasibility, so narrow bands cannot dead-end.
4. **Rests only on the Elementary card.** Rests are its headline feature. At every other level a rest is empty space in a 1–3 beat window.
5. **Unchanged:** ties, ledger-line range and solfège mode (part of each level's identity), plus tempo, count-in and meter (no effect on the picture).

### 3. Representation table

Each row is the full preset minus the omissions.

| Level | Note values kept | Tuplets kept | Intervals kept | Rests | Ties | Beat width | What the card should show |
|---|---|---|---|---|---|---|---|
| Beginner | h, q | — | 2nd, 3rd | — (off in preset) | — | 110 | q h q / h h with Do-Re-Mi labels |
| Elementary | q, 8, dotted | — | 3rd, 4th | ✓ | — | 130 | qd 8, 8 qd, 8 q 8, eighth pairs, rests |
| Intermediate | 8 (w, h, q dropped; dots then have nothing to attach to) | triplet 1/8 | 4th, 5th | — | ✓ | 165 | eighth pairs and eighth triplets (≈ ½ of beats), ties |
| Advanced | 8, 16, dotted (w, h, q dropped) | triplet 1/8 (1/4 dropped, ADR 0052) | 6th, 7th, 8ve | — | ✓ | 220 | 8d 16, 16 8d, 16×4, 8 16 16…, eighth triplets, wide leaps |
| Virtuoso | 16, 32, dotted (w, h, q, 8 dropped) | every 1/16 cell (1/4 and 1/8 dropped, ADR 0052) | 8ve, 9th+ | — | ✓ | 360 | 16/32 figures, 16d 32, 5-, 6- and 7-tuplets of 16ths, compound leaps |

> ADR 0052 dropped the quarter triplet from Advanced and the eighth-value tuplets from Virtuoso, and added a per-level signature check on each card's visible window. The generator checks below describe this ADR's first version.

Checks against `src/notation/generator.ts`:
- **Intermediate** without q/h: `partitionTwoBeats` offers only 1+1. `partitionSingleBeat` then offers {8 8, triplet ⅛}.
- **Advanced:** `partitionTwoBeats` offers {triplet ¼, 1+1, 1+1} (1+1 is double-weighted). `partitionSingleBeat` offers 8 figures with 16ths plus triplet ⅛.
- **Virtuoso** without 8:
  - `partitionEighthSpan` still has the {16 / 32 32} pairs, 16d 32, 32 16d and 32 16 32;
  - `partitionSingleBeat` keeps 16×4, the 32nd figures and the ⅛ and 1/16 tuplets.
- **Beat width** matches the full preset for every level (110 / 130 / 165 / 220 / 360).
- **Fallback:** no representation empties the subdivisions or the intervals, so the generator's fallbacks ("nothing selected → quarter", "no interval → 2nd/3rd") never fire and cannot break the subset rule.

### 4. Wiring

`renderIntroLevelPreviews()` (`src/main.ts`) passes `buildPreviewSettings(level, introClef)` to `renderLevelPreview`. `preview.ts` and the CSS are unchanged.

### 5. Tests (`tests/presets.test.ts`)

- For every level × intro clef:
  - booleans true in the preview are true in the preset (this covers `rests`);
  - every other field is equal;
  - `computeBeatWidth` is equal;
  - at least one note value or tuplet and one interval stay on.
- 300 generated preview bars per level never contain an omitted non-tuplet value:

  | Level | Forbidden |
  |---|---|
  | Beginner | `w` |
  | Elementary | `w`, `h`, `hd` |
  | Intermediate, Advanced | `w`, `h`, `hd`, `q`, `qd` |
  | Virtuoso | `w`, `h`, `hd`, `q`, `qd`, `8`, `8d` |

  Virtuoso never draws a `q` tuplet (ADR 0052 extends this to Advanced, and to `8` tuplets on Virtuoso).
- 300 preview bars per level contain no rest, except Elementary, which produces at least one.
- Between consecutive sounding notes (skipping `tieEnd` notes), the diatonic distance lies inside the level's kept band. Pitches are parsed from the `keys` as letter index + 7 × octave.
- `matchLevel` still round-trips the full preset and does not match a preview patch.

### 6. Revision (same day)

The first version kept quarters from Elementary to Advanced, kept rests on every card from Elementary up, and dropped only unison (plus the 2nd from Advanced up). The user reviewed the cards and asked for:
- rests only on Elementary;
- sharper contrast between levels;
- quarter notes off from Intermediate up, so complex rhythms show up more often.

Elementary keeps q for its dotted figures. Rules 1, 3 and 4 and the table above reflect this revision; the subset rule, the beat-width rule and the untouched generator are as first decided.

## Consequences

- **Ergodicity intact**: the generator is untouched and remains ergodic over whatever Ω it is given. Only the preview's *input* is narrowed, the narrowing is published in the table above, and every preview figure is reachable in the real level.
- **Deliberately biased examples**: the cards are representative examples, not unbiased samples of the level. This replaces the "no cherry-picking" stance of ADR 0050. The bias is a fixed, documented sub-configuration. (ADR 0052 later added a published, level-specific filter on whole strips; see there.)
- **Still random**: within the representation, strips are plain samples and change on every open. A strip can still be sparse (e.g. a quarter triplet on an Advanced card), just much less often.
- **Cost**: about 0.1 kB gzipped JS.
- **Maintenance**: any new preset needs a `preview` entry (the field is required by the type). Keep rule 2: re-check `computeBeatWidth` equality (the test enforces it) whenever the presets or the beat-width table change.

# 0051. Representation Presets for the Intro Level Previews

- **Status**: Accepted
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
}
```

`buildPreviewSettings(level, clef)` starts from `buildPresetSettings(level, clef)` (deep clone, tuplets limited to the meter) and sets every listed toggle to `false`. Nothing can be switched on. As a result **Ω_preview ⊆ Ω_preset**, and any figure a card shows is one the level can actually produce.

`buildPresetSettings` and `matchLevel` are unchanged, so applying a level still loads the full preset.

### 2. Four rules

1. **Drop the floor, keep the ceiling.** Remove values that every easier level already has, and values a short window cannot show well:
   - whole notes everywhere, since the window is about one bar;
   - half notes from Elementary up;
   - quarter-note values (plain and in tuplets) for Virtuoso.

   Keep what is new at each level: dots, rests, ties, tuplets, 16ths, 32nds, wide leaps.
2. **Keep the beat-width setter.** The value that sets `computeBeatWidth` is never omitted, so a strip keeps the scroller's real spacing.
3. **Motion over stasis.** Drop unison at every level. From Advanced up, also drop the 2nd, because every easier level already shows steps.
4. **Unchanged:** rests, ties, ledger-line range and solfège mode (part of each level's identity), plus tempo, count-in and meter (no effect on the picture).

### 3. Representation table

| Level | Note values kept | Tuplets kept | Intervals kept | Rests / ties / labels | What the card should show |
|---|---|---|---|---|---|
| Beginner | h, q (whole dropped) | — | 2nd, 3rd | off / off / solfège | q h q and h h bars, stepwise and skipping, with Do-Re-Mi labels |
| Elementary | q, 8, dotted (whole and half dropped) | — | 2nd–4th | on / off / — | qd 8, 8 q 8, eighth pairs, an occasional rest |
| Intermediate | q, 8, dotted (whole and half dropped) | triplet 1/8 | 2nd–5th | on / on / — | eighth triplets and ties |
| Advanced | q, 8, 16, dotted (whole and half dropped) | triplet 1/4, triplet 1/8 | 3rd–8ve | on / on / — | 16th figures, quarter and eighth triplets, wide leaps |
| Virtuoso | 8, 16, 32, dotted (whole, half and quarter dropped) | every 1/8 and 1/16 cell (1/4 cells dropped) | 3rd–9th+ | on / on / — | 32nd figures, 5-, 6- and 7-tuplets of 16ths, compound leaps |

Checks against `src/notation/generator.ts`:
- Virtuoso without `half`: `partitionFourFourMeasure` always takes the 2+2 path.
- Virtuoso without `quarter`: `partitionSingleBeat` still has eight or more candidates.
- Beat width matches the full preset for every level (110 / 130 / 165 / 220 / 360).
- No representation empties the subdivisions or the intervals, so the generator's "nothing selected → quarter" fallback can never fire and break the subset rule.

### 4. Wiring

`renderIntroLevelPreviews()` (`src/main.ts`) passes `buildPreviewSettings(level, introClef)` to `renderLevelPreview`. `preview.ts` and the CSS are unchanged.

### 5. Tests (`tests/presets.test.ts`)

- For every level × intro clef:
  - booleans true in the preview are true in the preset;
  - every other field is equal;
  - `computeBeatWidth` is equal;
  - at least one note value or tuplet and one interval stay on.
- 300 generated preview bars per level never contain an omitted value: no `w`; no `h`/`hd` from Elementary up; no `q` (plain or tuplet) for Virtuoso.
- `matchLevel` still round-trips the full preset and does not match a preview patch.

## Consequences

- **Ergodicity intact**: the generator is untouched and remains ergodic over whatever Ω it is given. Only the preview's *input* is narrowed, the narrowing is published in the table above, and every preview figure is reachable in the real level.
- **Deliberately biased examples**: the cards are representative examples, not unbiased samples of the level. This replaces the "no cherry-picking" stance of ADR 0050. The bias is a fixed, documented sub-configuration, not resampling or filtering of output.
- **Still random**: within the representation, strips are plain samples and change on every open. A strip can still be sparse (e.g. qd 8 on an Advanced card), just much less often.
- **Cost**: about 0.1 kB gzipped JS.
- **Maintenance**: any new preset needs a `preview` entry (the field is required by the type). Keep rule 2: re-check `computeBeatWidth` equality (the test enforces it) whenever the presets or the beat-width table change.

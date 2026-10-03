# 0052. Signature Check for the Intro Level Previews

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0050](0050-intro-notation-previews.md), [0051](0051-intro-preview-representation-presets.md)

## Context & Problem Statement

After the ADR 0051 revision, some level cards still looked out of balance. Tracing `src/notation/generator.ts` shows two structural biases in the representations, plus luck of the draw:

- **Virtuoso.** In 4/4 without `half`, `partitionTwoBeats` draws every 2-beat span from {5-, 6-, 7-tuplet of eighths, 1+1, 1+1}. So **60% of half-bars are eighth-value tuplets**. At 360 px per beat their notes sit far apart, and the card can show little more than a "7" bracket.
- **Advanced.** 2-beat spans are drawn from {quarter triplet, 1+1, 1+1}. So **⅓ of half-bars are three quarter-triplet notes**, which can look easier than Intermediate.
- **Luck.** A card shows only about 1–3.5 beats (measured below). Elementary can roll two rests in a row, because the generator rests about 15% of its notes. Any card can also roll a plain stretch, such as Advanced `8 8 | 8 8`.

## Decision & Implementation

### 1. Representations drop the sparse tuplet cells (`src/presets.ts`)

These use the existing `tupletValues` omission, so Ω_preview ⊆ Ω_preset still holds:

| Level | `tupletValues` omitted | Tuplets kept | What changes |
|---|---|---|---|
| Advanced | `1/4` | triplet ⅛ | 2-beat spans are 1+1 only. A beat is drawn from {8 8, 8d 16, 16 8d, 16×4, 8 16 16, 16 16 8, 16 8 16, triplet ⅛}. |
| Virtuoso | `1/4`, `1/8` | every 1/16 cell | A beat is drawn from {16×4, the 32nd eighth-span pairs, 5/6/7:4 sixteenths, 16th triplet pair}. |

The beat-width setter is untouched (16ths give 220 and 32nds give 360), so ADR 0051 rule 2 still holds.

### 2. Each level has a published signature

`LevelPreset` gains a required `check: PreviewCheck`, which is one comment plus one expression. It is evaluated on the **visible window**: the notes a card actually shows.

```ts
export interface PreviewWindow { notes: readonly NoteData[]; beats: readonly number[]; length: number }
export type PreviewCheck = (window: PreviewWindow) => boolean;
```

Helpers (local to `presets.ts`):
- `base(n)` is the duration without the rest suffix `r`.
- `count(w, pred)` counts the matching notes.
- `beatsWith(w, pred)` counts the distinct `Math.floor(beat)` values among matching notes.
- `need(w) = clamp(floor(w.length), 0, 2)` is the number of beats a figure must cover: every whole visible beat, at most two.

| Level | Check (all of) | What it guarantees |
|---|---|---|
| Beginner | some `h` | q h q / h h motion, not only quarters |
| Elementary | ≤ 1 rest; and some `qd`, or a plain `q` with plain `8`s on both sides | the dotted or syncopated figure, never rest clutter |
| Intermediate | some tuplet note (triplet ⅛) | eighth triplets beside eighth pairs |
| Advanced | `beatsWith(non-tuplet 16) ≥ need` | 16th figures on the visible beats |
| Virtuoso | `beatsWith(32, or tuplet 16) ≥ need` | 32nds or fast tuplets on the visible beats, not just 16×4 |

`previewWindow(measures, visibleBeats)` and `acceptsPreview(level, window)` are pure exports of `presets.ts`, so Vitest can test them without VexFlow. `preview.ts` imports from `presets.ts`, and `presets.ts` imports only `notation/types`, so there is no cycle.

### 3. Window geometry (`src/notation/preview.ts`)

Spacing is linear: `measureWidth = beatsPerMeasure · W_beat`, and a note sits at `NOTE_START_OFFSET + beatOffset · W_beat` within its bar. A note at strip beat `b` is therefore drawn at

```
x(b) = STRIP_START_X + (NOTE_START_OFFSET + b · W_beat) · STRIP_SCALE,   STRIP_START_X = (88 − 3) · 0.42
```

The CSS mask fades the card from 80% of its width (`STRIP_FADE_START = 0.8`, mirroring `mask-image` in `style.css`), so

```
visibleBeats = (min(clientWidth || 640, 640) · 0.8 − STRIP_START_X − 26 · 0.42) / (W_beat · 0.42)
```

Measured card widths (Chromium) and the resulting windows in beats:

| Viewport | Card width | Beginner | Elementary | Intermediate | Advanced | Virtuoso |
|---|---|---|---|---|---|---|
| 800 px | 229 px (Virtuoso 510 px) | 2.95 | 2.50 | 1.97 | 1.48 | 2.39 |
| 380 px | 258 px | 3.46 | 2.93 | 2.31 | 1.73 | 1.05 |

### 4. Re-roll, then draw once

- `generateStrip(settings)` builds the bars as data only. It uses a fresh `MusicGenerator` and adds bars while `x < 640`, advancing `x` by `data.width · STRIP_SCALE`, which equals the rendered width.
- `renderLevelPreview(target, settings, accept?)` tries up to `MAX_PREVIEW_ATTEMPTS = 32` strips and keeps the first whose window passes `accept`. Only that strip reaches VexFlow, so the rejected attempts cost generation time only.
- If none passes, it draws the 32nd attempt anyway: a valid sample, just a less telling one. Without `accept` it draws the first strip, as before.
- `main.ts` passes `(w) => acceptsPreview(level, w)`.
- The `btn-intro-back` handler now shows the level step **before** re-rendering. A hidden card reports `clientWidth` 0, which would make the window fall back to the full 640 px strip. `openIntro` already showed the step first.

### 5. Tests (`tests/presets.test.ts`)

- **Tuplets:** 300 preview bars contain tuplets, but never a `q` tuplet (Advanced) or a `q`/`8` tuplet (Virtuoso).
- **Check semantics:** for each level, hand-built windows are accepted or rejected as expected. For example:
  - Elementary rejects `qr qd 8r` (two rests) and `8 8 q q`;
  - Advanced rejects `8 8 8 8` and 16ths on a single beat;
  - Virtuoso rejects plain 16ths, and 32nds on a single beat.
- **`previewWindow`:** keeps exactly the notes whose strip beat lies before the visible length.
- **Acceptance rate:** 300 windows over fresh 3-bar strips per level and length must pass at ≥ 25%. Then `(1 − 0.25)^32 < 1e-4`, so the fallback is practically never drawn.
  - Lengths are 1.3, 2 and 4 beats, plus 1 beat for Advanced and Virtuoso, the only cards that get that narrow.
  - Measured rates (2000 trials):

    | Length | Beginner | Elementary | Intermediate | Advanced | Virtuoso |
    |---|---|---|---|---|---|
    | 1.3 | 66% | 40% | 73% | 88% | 96% |
    | 2 | 66% | 56% | 75% | 61% | 71% |
    | 4 | 78% | 77% | 94% | 94% | 99% |

- The subset, beat-width, forbidden-value, rest and interval-band tests of ADR 0051 are unchanged and pass over the raw preview bars.

## Consequences

- **The cards are now filtered samples.** This replaces the "not resampling or filtering of output" line of ADR 0051. The filter is published (the table above), level-specific, and only discards whole strips; it never edits a note. Every card is still a real generator sample from Ω_preview ⊆ Ω_preset.
- **Ergodicity intact:** the generator is untouched. "Start practising" still applies the full preset (`buildPresetSettings`, `matchLevel` unchanged), so the user's practice stream keeps every figure, including quarter triplets, eighth-value 5/6/7-tuplets and rests in any arrangement.
- **Cost:** about 0.45 kB gzipped JS (22.38 → 22.83 kB). Rejected attempts are data-only and take microseconds. The average is under 3 attempts per card (worst rate 40%), and the cap is 32.
- **Maintenance:**
  - A new preset needs both a `preview` and a `check` (the type requires both), plus an entry in the acceptance-rate test.
  - If the generator's partition weights change, re-run the rate test. A rate below 25% means the check asks for something the representation rarely produces.
  - Keep `STRIP_FADE_START` in sync with the `mask-image` stop in `style.css`.

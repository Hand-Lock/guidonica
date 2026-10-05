# 0076. Compound Triple and Quadruple Meters (9/8, 12/8)

- **Status**: Accepted (amends [0054](0054-responsive-header-fit-audit.md), [0065](0065-grammar-driven-rhythm-sampler.md), [0071](0071-intro-meter-step.md), [0072](0072-three-level-beat-accent-hierarchy.md))
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

6/8 was the only compound meter, and about a dozen places tested `ts === '6/8'`. Adding 9/8 and
12/8 had to keep the generator ergodic: every valid figure in Ω has P > 0, no redundant ties, no
hidden substitutions (AGENTS.md §1, §3.6).

The new tables follow two analogies, one level up (the dotted-quarter beat):
**9/8 ≈ 3/4** and **12/8 ≈ 4/4**.

## Decision & Implementation

### 1. One compound predicate (`src/notation/types.ts`)

```ts
export const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'] as const;
// METER: '9/8': { 9, 8, 0.5 }, '12/8': { 12, 8, 0.5 }
export function isCompound(ts: TimeSignature): boolean { return METER[ts].beatValue === 8; }
```

Every former `ts === '6/8'` reads `isCompound(ts)`: `tupletShape`, `tupletSpan`,
`computeBeatWidth` (per-eighth widths unchanged), the generator's grid, the preset tuplet swap,
the metronome pulse, the Pulse select and the LEDs.

### 2. Grid (`src/notation/generator.ts`)

`unitsPerBeat = isCompound ? 4 : 8`, so the 32nd grid has 24, 36 and 48 units per bar in 6/8,
9/8 and 12/8. The beat-unit fallback is the eighth in every compound meter.

### 3. Notehead values and placements (`src/notation/ties.ts`)

Compound meters share one value table that adds the dotted whole:

```
COMPOUND_NOTE_VALUES = {12:'wd', 8:'w', 6:'hd', 4:'h', 3:'qd', 2:'q',
                        1.5:'8d', 1:'8', .75:'16d', .5:'16', .25:'32'}   (eighths)
```

`wd` is the standard 12/8 whole-bar note. Without it, the bar-long sound would be the redundant
tie `hd~hd`. `enabledValues` adds `wd` when Whole and Dotted are on. Only 12/8 can place it, and
`rhythmGrammar` adopts a widened alphabet only when it makes an unused value usable, so the other
meters' grammars are byte-identical.

The beat-level placements (qd down to 32) are one shared `COMPOUND_BEAT_PLACEMENTS`. Each meter
adds its own long values:

| Meter | Extra placements | Analog |
|---|---|---|
| 6/8 | `hd {6,[0]}` | unchanged |
| 9/8 | `hd {9,[0,3]}` | 3/4 `h` on beat 1 or 2: `hd qd` and `qd hd` |
| 12/8 | `wd {12,[0]}`, `hd {6,[0], tolerated:[3]}` | 4/4 `w`, and `h` with the tolerated `q h q` |

`h` and `w` have no placement in any compound meter, so those sounds are always tied. The tie
rule (`isLegalInnerTie`: legal iff no canonical single notehead expresses the merged sound)
needs no new code:

- 12/8 `qd~qd` is illegal at 0 and 6 (`hd` covers it) and legal at 3 (`hd@3` is only tolerated).
- 9/8 `qd~qd` is illegal at 0 and 3. 9/8 `hd~qd` across the bar is legal (no 9-eighth note).

### 4. Rests

A shared `COMPOUND_METER_RESTS` (the former 6/8 set: qd, q, 8, 16, 32). 12/8 adds a dotted-half
rest `hd {6,[0]}` on either half, like the 4/4 half rest. 9/8 has none, like 3/4. A two-beat
9/8 silence spells `qd qd`; a bar-long silence stays the whole rest in every meter.

### 5. Tuplets

One `COMPOUND_METER_TUPLETS` set (duplet and quadruplet ¼/⅛/1/16, triplet 1/16) and
`compoundMeterTupletPlacements(twoBeat)`: ⅛ cells `{3,[0]}`, 1/16 duplet and quadruplet
`{1.5,[0]}`, triplet 1/16 on every eighth. The two-beat ¼ cells sit at `{6,[0]}` in 6/8 and
12/8 (beats 1 and 3, like 4/4) and at `{9,[0,3]}` in 9/8 (beat 1 or 2, like 3/4).

### 6. Accents and click (amends 0072)

`SECONDARY_BEAT` becomes `SECONDARY_BEATS: Record<TimeSignature, readonly number[]>`: every
dotted-quarter beat after the downbeat is secondary.

| Meter | Secondary eighths |
|---|---|
| 6/8 | 4 |
| 9/8 | 4, 7 |
| 12/8 | 4, 7, 10 |

`Pulse68Mode` / `pulse68` become `CompoundPulseMode` / `compoundPulse`. In dotted-quarter pulse
the metronome clicks only when `(beatNumber - 1) % 3 === 0`. `storage.ts` reads
`compoundPulse ?? pulse68`, so saved 6/8 settings carry over. The select is now
`#select-compound-pulse` ("Pulse": "Dotted quarter (♩.)" / "Eighth (♪)").

### 7. LEDs grouped in threes

In every compound meter, 6/8 included, `#beat-dots` gets `.compound`. The LED that starts each
dotted-quarter beat keeps 13px; the two eighths after it are `.sub` dots of 5px. Dots in a group
sit 2px apart, with 6px between groups:

```
12/8: 4×13 + 8×5 + 8×2 + 3×6 = 126px   (9/8: 93px, 6/8: 60px; former 6/8: 118px)
```

Sizes were tuned by measuring the ribbon with Playwright in every locale, mouse and touch. At
5px the dots still read as LEDs, and only this size keeps the header within ADR 0054.

### 8. Header fit (amends 0054)

The 12/8 well is 8px wider than the former 6/8 one. Two changes keep every tier within budget:

- The compact band widens from 961–1140 to **961–1150px**, because the full ribbon now needs
  1143px (touch, 12/8, English). The non-English 1141–1439 rule becomes 1151–1439.
- In the compact band the LED well's side padding drops from 12px to 6px. Without it, Italian
  ("SOLFEGGIO" badge) overflowed by 9px at 961px with touch.

Measured worst cases with these values:

| Case | Tempo | Floor |
|---|---|---|
| 961px, touch, 12/8, Italian | 163px | 160px |
| 1151px, touch, 12/8, German | 186px | 160px |
| 1280px, touch, 12/8, English | 223px | 220px |

Phones (320–600) and tablets (601–960) have no overflow; their tempo track is `minmax(0, 1fr)`.

### 9. Intro and UI (amends 0071)

`INTRO_METERS` lists six cards. The 28px meter icon fits "12/8" without widening the crop. In
phone portrait the six cards fit without scrolling. In phone landscape the dialog body scrolls
99px, less than the level step's 448px. Each locale names 9/8 "compound triple" and 12/8
"compound quadruple", in the wording it uses for 6/8. `dottedTitle` names `wd` (12/8 only).

## Consequences

- One predicate and shared compound tables. A fourth compound meter would need only a `METER`
  row, a `SECONDARY_BEATS` row and its long-value placements.
- Ergodicity holds: tests sample 9/8 `hd qd`, `qd hd`, `q 8`, `8 q`, `qd qd qd` and 12/8
  `wd`, `hd hd`, `qd hd qd`, `qd qd qd qd`, tied `qd~qd@3`. The dormant-value oracle now reads:
  `w` outside 4/4, `h` in compound meters, `wd` outside 12/8.
- VexFlow's default beam groups already split 9/8 and 12/8 into 3/8 groups, and
  `vexDuration('wd')` is `'1d'`; the renderer is unchanged.
- The header has only 3px of spare tempo at its worst cases. A wider brand badge, a longer
  label or a new header control must be measured against this ADR's table.

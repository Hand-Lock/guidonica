# 0090. Half-Note Beat Meters: 4/2, 3/2, 2/2, 6/4, 9/4, 12/4

- **Status**: Accepted (amends [0054](0054-responsive-header-fit-audit.md), [0065](0065-grammar-driven-rhythm-sampler.md), [0071](0071-intro-meter-step.md), [0072](0072-three-level-beat-accent-hierarchy.md), [0076](0076-compound-triple-and-quadruple-meters.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A user asked for time signatures whose beat is the **half note**, to train for early music. Guidonica offered 4/4, 3/4, 2/4 (quarter beat) and 6/8, 9/8, 12/8 (dotted-quarter beat, ADR 0076).

### What the literature uses

- **Mensural notation** had four basic mensurations, and their modern transcriptions are half-note meters. *Tempus imperfectum* (C) becomes **2/2**, *tempus perfectum* (○) **3/2**, C with prolation dot **6/4**, ○ with dot **9/4** (Wikipedia, *Prolation*). The slashed C (¢, *alla breve*, "on the breve") moved the tactus to a longer note. It survives as cut time, two half-note beats. From 1600 to 1900 its tempo meaning varied, and ¢ also marked 4/2 (Bach, WTC II, Fugue in E, BWV 878; Wikipedia, *Alla breve*).
- **4/2** is the meter of modern editions of Renaissance polyphony, with breve-long bars, and of much hymnody. **3/2** is the usual triple meter of the same repertoire and of Baroque sarabandes and courantes. **2/2** is everywhere.
- **6/4, 9/4, 12/4** are the compound meters with a dotted-half beat. 6/4 and 9/4 are common from the Baroque on. 12/4 is rarer but in the literature, for example in Bach and in Romantic slow movements (mymusictheory.com on 12/4).
- **Rests** (clementstheory.com; Gould, *Behind Bars*; musescore.org node 323707): a beat of silence is a half rest in 2/2 and 3/2, and a whole rest covers half of a 4/2 bar. The **breve rest** is the whole-bar rest **only in 4/2**, the one meter whose bar is exactly a breve. Every other meter, 3/2 and 12/4 included, keeps the whole rest.
- **Beaming** (Gould): eighths are beamed by half-note beat (in fours), and sixteenths per half beat, with secondary beams broken at the quarter.

## Decision

### 1. A toggle, not six more cards

Every half-note meter is a meter Guidonica already had, written one note value longer: 4/4 becomes 4/2, 3/4 3/2, 2/4 2/2, 6/8 6/4, 9/8 9/4 and 12/8 12/4. The metric type (duple, triple, quadruple; simple or compound) is unchanged. Only the beat's note value changes. So the choice is two independent questions: *what kind of meter* and *what beat value*. That means one **Half-note beat** switch rather than twelve list entries.

- **Storage stays one string.** `AppSettings.timeSignature` holds the actual meter (`'6/4'`). The toggle's state is derived from it (`isHalfNoteMeter`) and is never stored, so settings, presets and share links (`meter=6-4`) need no new field.
- `HALF_NOTE_COUNTERPART` (`types.ts`) maps the six base meters to their counterparts. `withHalfNoteBeat(ts, half)` converts in either direction.
- **Settings → Staff**: the time-signature select keeps six options. A `Half-note beat 𝅗𝅥` chip sits beside it in a `.ledger-select-row`. Toggling it swaps every option's value and label (`syncMeterControls`) and keeps the selected position, so 6/8 becomes 6/4.
- **Intro meter step**: the same six cards and a toggle chip under them. The chip relabels the cards and redraws their icons, and the level previews follow (`introTimeSignature()`). `INTRO_METERS` lists only the six base meters, and `openIntro` maps a half-note setting back to its card with the chip on.
- A new **tip** (`halfNote`, ADR 0087) points to the chip while the meter is not a half-note one.

### 2. Meter model: a quarter metric beat, grouped (`beatGroup`)

ADR 0076 modelled 6/8 as **eighth metric beats grouped in threes**. Half-note meters are **quarter metric beats grouped in twos**, and 6/4 is quarters grouped in threes. `MeterConfig` gains `beatGroup: 1 | 2 | 3`, the metric beats per felt beat:

| Meter | beatsPerMeasure | beatValue | factor | beatGroup | Secondary beats |
|---|---|---|---|---|---|
| 4/4, 3/4, 2/4 | 4, 3, 2 | 4 | 1 | 1 | 3 (4/4) |
| 6/8, 9/8, 12/8 | 6, 9, 12 | 8 | 0.5 | 3 | 4; 4, 7; 4, 7, 10 |
| 4/2, 3/2, 2/2 | 8, 6, 4 | 4 | 1 | 2 | 3, 5, 7; 3, 5; 3 |
| 12/4, 9/4, 6/4 | 12, 9, 6 | 4 | 1 | 3 | 4, 7, 10; 4, 7; 4 |

- `isCompound(ts)` is now `beatGroup === 3` (6/8 and 6/4 alike). `isGrouped(ts)` (`> 1`) covers every meter whose felt beat is longer than its metric beat. Code that really means "eighth metric beat" (the 32nd grid's `unitsPerBeat`, `computeBeatWidth`, the beat-unit fallback) tests `beatValue === 8`.
- Because the metric beat stays the quarter, the 32nd grid, beat widths, tape speed and `secondsPerBeatFactor` are untouched. **BPM stays ♩ BPM in every meter**, as in 6/8: the same BPM gives the same note speed in 4/4 and 2/2. The half-note click sounds at BPM/2.
- `SECONDARY_BEATS` gives every felt beat after the downbeat the medium accent, as ADR 0076 did for compound meters (ADR 0072's three levels).

### 3. Note values and placements (`ties.ts`): the existing tables, doubled

`SIMPLE_NOTE_VALUES` gains `6: 'wd'`, `8: 'b'` (breve) and `12: 'bd'` (dotted breve). No placement in 4/4, 3/4 or 2/4 admits them, so those grammars are byte-identical (the "widened alphabet only where usable" rule of ADR 0076). Each new meter's placement table is the table of its base meter with every value doubled. Only the subdivisions *inside* a quarter keep the shared quarter-meter rows (8d, 8, 16, 16d, 32), because a 6/4 quarter divides like any quarter.

| Meter | Long-value placements (quarters) | Image of |
|---|---|---|
| 2/2 | w:4→[0]; hd:4→[0,1]; h:4→[0,1,2]; qd:2→[0,.5]; q:2→[0,.5,1] | 2/4 h, qd, q, 8d, 8 (`q h q` canonical, as `8 q 8` in 2/4) |
| 3/2 | wd:6→[0]; w:6→[0,2]; hd:1→[0]; h:1→[0]; qd, q as in 2/2 | 3/4 hd, h, qd, q |
| 4/2 | b:8→[0]; wd:8→[0] (+tol. 2); w:4→[0] (+tol. 2); hd:4→[0,1]; h:4→[0,1,2]; qd, q as in 2/2 | 4/4 w, hd, h, qd, q |
| 6/4 | wd:6→[0]; hd:3→[0]; h:3→[0,1]; qd:3→[0,1]; q:1→[0] | 6/8 hd, qd, q, 8d, 8 |
| 9/4 | wd:9→[0,3]; rest as in 6/4 | 9/8 |
| 12/4 | bd:12→[0]; wd:6→[0] (+tol. 3); rest as in 6/4 | 12/8 wd, hd |

`isLegalInnerTie` needed no code. The doubled tables give the expected engraving: 2/2 `q~q` over the middle of the bar is redundant (`q h q`), 4/2 `h~h` over quarter 2 is legal (w there is only tolerated), and in 6/4 a four-quarter sound is always tied (`w`, like 6/8's `h`, has no placement).

**Rests** (`REST_PLACEMENTS`): 2/2 and 3/2 rest a half per beat (`h:2→[0]`) over the simple table. 4/2 adds a whole rest on either half of the bar. 6/4, 9/4 and 12/4 are 6/8's table one value up (`hd` and `h` at a beat start, `q`, `8`, `16`, `32` on their own span), and 12/4 adds a half-bar `wd` like 12/8's `hd`. `BAR_REST` becomes `barRest(ts)`: `'b'` in 4/2, `'w'` everywhere else.

**Rest pitch**: the vertical offset is chosen by glyph. `w` and `wd` hang from the fourth line, including 4/2's half-bar whole rest. `b` stands on the middle line and fills the space up to the fourth.

### 4. Generator (`generator.ts`)

- `enabledValues`: **the breve rides on the Whole chip** (and `bd` on Whole + Dotted), as `wd` already did (ADR 0076). Only 4/2 places `b`, only 12/4 `bd`. The Whole chip's tooltip (`wholeTitle`) says so, and `dottedTitle` names the dotted whole's meters.
- `unitsPerBeat = 32 / beatValue`. The beat-unit fallback is `q` in every quarter-beat meter.
- Ergodicity: each new grammar is the image of an existing, already-ergodic grammar under the doubling map, plus the unchanged inner-quarter rows. `tests/generator.test.ts` pins the reachable figures per meter (2/2: `w`, `h h`, `q h q`, `hd q`, `q hd`; 3/2: `wd`, `w h`, `h w`, `h h h`; 4/2: `b`, `w w`, `h w h`, `wd h`, `h h h h`; 6/4: `wd`, `hd hd`, `h q hd`, `q h hd`; 9/4: `wd hd`, `hd wd`, `hd hd hd`; 12/4: `bd`, `wd wd`, `hd wd hd`, `hd hd hd hd`). It also extends the dormant-value oracle: `b` outside 4/2, `bd` outside 12/4, `w` outside 4/4, 4/2, 3/2, 2/2, `wd` outside 12/8 and the quarter-beat meters that place it.

### 5. Renderer (`renderer.ts`)

- `vexDuration('b')` → `'1/2'`, VexFlow's breve. Its notehead (U+E0A0) and rest (U+E4E2) are already in the Guidonica Notation subset (ADR 0058), and `tests/musicFontCoverage.test.ts` now draws both.
- Beaming: VexFlow's default groups for `x/2` are `['1/2']` and for `x/4` compound `['3/4']`. Grouped quarter-beat meters also pass `secondaryBreaks: '4'`, so sixteenth beams break at the quarter (Gould).
- 2/2 is drawn with numerals, consistent with 4/4 never being drawn as C. The intro description and the settings tooltip name it *alla breve*, ¢.

### 6. Tuplets (`types.ts`)

- 2/2 and 4/2: 4/4's cells, with two-beat groups on each half-note beat (`simpleMeterTupletPlacements({ period: 2 })`) and the quintuplet, sextuplet and septuplet ¼ on each four-quarter span.
- 3/2: the same, with the ¼ long cells on half-note beat 1 or 2 (like 3/4's ⅛ ones), plus the **¼ quadruplet 4:6 across the bar**. The old `ts === '3/4'` special case became the `BAR_QUADRUPLET` table (`'3/4': '1/8'`, `'3/2': '1/4'`).
- 6/4, 9/4, 12/4: 6/8's cells one value up. The duplet and quadruplet ¼ cover a dotted-half beat, the duplet and quadruplet ⅛ cover a dotted-quarter half beat, the triplet ⅛ falls on each quarter and the triplet 1/16 on each eighth. Without the triplet 1/16, the Virtuoso preview found no accepted window in these meters.
- `tupletShape` now counts felt beats generically: `beats = inTimeOf · value · beatValue / beatGroup`, and `tupletSpan = beats · beatGroup`.
- **Deferred**: half-note tuplets (a `'1/2'` column: the 2/2 half-note triplet, the 6/4 half-note duplet). The column would change 4/4's state space too, so it needs its own ADR.

### 7. Pulse, click and LEDs

- `compoundPulse: 'dotted-quarter' | 'eighth'` generalises to **`pulse: PulseMode = 'beat' | 'division'`**. It applies to every grouped meter. `parsePulse` maps the old values, and `storage.ts` reads `pulse ?? compoundPulse ?? pulse68`. Share links keep decoding `pulse=dotted-quarter` and `pulse=eighth`.
- `#select-compound-pulse` becomes `#select-pulse` (label "Pulse"), shown when `isGrouped`. Its two options are labelled from the meter: "Half note" / "Quarter (♩)" in 2/2, 3/2 and 4/2, "Dotted half" / "Quarter (♩)" in 6/4, 9/4 and 12/4, and "Dotted quarter (♩.)" / "Eighth (♪)" in 6/8, 9/8 and 12/8.
- Metronome: a beat clicks when `pulse === 'division'` or `(beatNumber − 1) % beatGroup === 0`. The count-in follows the same rule.
- LEDs: `.beat-dots.compound` becomes `.beat-dots.grouped`, and every LED that does not start a felt beat is a small `.sub` dot. The widest row is still 12 LEDs (12/8 and 12/4, 126 px). 4/2's 8 LEDs are narrower, so ADR 0054's header budgets hold. This was checked at 961 px and 1151 px in German.

## Consequences

- Twelve meters behind six choices plus one switch. The menu, the intro and the header are no longer than before, and the six existing meters generate, sound and render exactly as before.
- ♩ BPM everywhere keeps one tempo scale and one tape speed. Users who think in half-note BPM double the number. The tooltip and the pulse labels make the beat explicit.
- `beatGroup` replaces the "compound means eighths" assumption. A future 3/8 or 3/1 needs only its row and tables.
- The breve and dotted breve exist only where a bar can hold them, so no other meter's grammar changed.
- Deferred: half-note tuplets, a ¢/C glyph option for 2/2 and 4/4, and longer bars (3/1, 2/1) or their maxima.

## Sources

- Wikipedia, *Prolation* (mensuration signs and their modern equivalents) and *Alla breve*.
- mymusictheory.com, time signatures (12/4 and the half-note meters at ABRSM Grade 2).
- clementstheory.com, rests (the breve rest in 4/2 only).
- musescore.org, forum node 323707 (breve rest as the 4/2 bar rest).
- Elaine Gould, *Behind Bars* (Faber, 2011): beaming by beat, rest grouping, bar rests.

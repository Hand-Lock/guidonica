# 0072. Three-Level Beat Accent Hierarchy in the Traffic Lights and Click

- **Status**: Accepted (amends [0030](0030-stacked-count-in-indicator-and-mobile-traffic-lights.md)); amended by [0076](0076-compound-triple-and-quadruple-meters.md), [0090](0090-half-note-beat-meters.md)
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

The beat LEDs (`#beat-dots`) had two lit states: a ruby gem for the downbeat and an Olo
turquoise sphere for every other beat. That fits 2/4 and 3/4, but not the meters whose bar has a
medium pulse in the middle:

- **6/8**: beat 4 starts the second dotted-quarter pulse. The click already accented it
  (`isCompoundSubaccent` in `src/audio/metronome.ts`), so the light and the click disagreed.
- **4/4**: beat 3 is the bar's medium accent, but neither the light nor the click showed it.

## Decision & Implementation

### 1. One accent table (`src/notation/types.ts`)

```ts
export type BeatAccent = 'primary' | 'secondary' | 'weak';
const SECONDARY_BEAT: Record<TimeSignature, number | null> = {
  '4/4': 3, '3/4': null, '2/4': null, '6/8': 4,
};
export function beatAccent(ts: TimeSignature, beatNumber: number): BeatAccent;
```

Beat 1 is `primary`, the meter's `SECONDARY_BEAT` is `secondary`, everything else is `weak`:

| Meter | Beats |
|---|---|
| 4/4 | p · w · **s** · w |
| 3/4 | p · w · w |
| 2/4 | p · w |
| 6/8 | p · w · w · **s** · w · w |

The click and the LEDs both read this function, so what you see always matches what you hear.

### 2. Click (`src/audio/metronome.ts`)

`scheduleClick(time, accent)` replaces the `isDownbeat` / `isCompoundSubaccent` booleans. The
three timbres are unchanged:

| Accent | Woodblock (sine sweep) | Electronic (triangle) |
|---|---|---|
| primary | 1600 → 800 Hz, gain 1.0 | 1300 Hz, gain 1.0 |
| secondary | 1350 → 675 Hz, gain 0.95 | 1050 Hz, gain 0.85 |
| weak | 1100 → 550 Hz, gain 0.9 | 800 Hz, gain 0.7 |

The only audible change is that 4/4 beat 3 now uses the medium click. The 6/8 dotted-quarter
pulse mode (`shouldClick`, beats 1 and 4 only) is unchanged.

`BeatInfo` gains `accent: BeatAccent`, filled by `getBeatInfo()` from the same function.
`isDownbeat` stays for `state.ts`.

### 3. LEDs (`src/main.ts`, `src/style.css`)

`highlightBeatDot(beatNumber, accent)` adds `active` plus `downbeat` (primary) or `secondary`
(secondary). The count-in bar uses the same accents.

The hierarchy reads like a traffic light, red → orange → green, and the size carries it too, so
the levels stay apart for colour-blind users:

| State | Token | Colour | Scale |
|---|---|---|---|
| weak | `--led-on` | Olo turquoise `#00ffcc` | 1.28 |
| secondary | `--led-mid` | orange `#f97316` | 1.35 |
| primary | `--led-down` | ruby `#f43f5e` | 1.42 |

`--led-mid` is a radial gem (`#ffffff → #fb923c → #f97316 → #c2410c`). The dark theme only
overrides `--led-mid-glow` with a slightly stronger halo, as it does for `--led-down-glow`.
Orange sits clearly between rose and turquoise and stays distinct from the amber *Playing* gel
(`#f59e0b`).

## Consequences

- The LEDs and the click now agree in every meter, including the count-in.
- 4/4 beat 3 sounds slightly higher than beats 2 and 4. Users who preferred a flat 4/4 click
  have no switch for it; the medium accent is the conventional reading of the meter.
- A new meter only needs one entry in `SECONDARY_BEAT` (the compiler requires it).
- Tests: `tests/metronome.test.ts` pins `beatAccent` for every meter, the `accent` in
  `getBeatInfo()` and the 1350 Hz click on 4/4 beat 3; `tests/beatIndicator.test.ts` pins the
  `.beat-dot.active.secondary` rule and the glow in both themes.

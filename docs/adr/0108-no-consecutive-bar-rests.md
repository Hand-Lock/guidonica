# 0108. No Back-to-Back Bar Rests

- **Status**: Accepted (amends [0066](0066-ergodicity-audit-connected-pitch-start-rest-runs-tuplet-shapes.md) §2)
- **Date**: 2026-10-16
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0065](0065-grammar-driven-rhythm-sampler.md), [0090](0090-half-note-beat-meters.md)

## Context & Problem Statement

ADR 0066 made silence a two-state chain (start $p_s = 0.1$, continue $p_c = 0.5$) carried across
barlines, so that a full-bar rest shows up within a session at all. A side effect: once a bar is
all silent, the chain is already in the silent state, so the next bar of $k$ items is silent too
with probability $p_c^k$. Measured with the real generator (100 000 bars per row, treble presets,
minutes at the preset tempo):

| Level / meter | Bar rest per bar | Runs of ≥ 2 bar rests | Longest |
|---|---|---|---|
| Elementary 2/4 | 9.0 % | 1.9e-2 per bar (~every 1.5 min) | 5+ bars |
| Elementary 3/4 | 7.1 % | ~every 3.7 min | 5+ |
| Elementary 4/4 | 5.8 % | ~every 7 min | 5+ |
| Intermediate 2/4 | 4.6 % | ~every 5 min | 5+ |
| Advanced / Virtuoso 4/4 | 2.0 % | ~every 30 min | 3–4 |

A second bar rest gives the reader nothing new: it is the same figure again, with the staff
empty for one more bar. A session could also open on a bar rest, which again is time with
nothing to read.

## Decision & Implementation

**A bar rest always follows a bar that contains a note.** Two all-silent bars are never adjacent,
and the first bar after a reset (session start, settings change) is never a bar rest. The longest
possible silence becomes trailing rests + one bar rest + leading rests, under 3 bars.

### 1. Rejection on the whole bar (`composeRhythm`, generator.ts)

`MusicGenerator` keeps `lastBarSilent`, `true` at construction and after `resetPitch()`.
`composeRhythm` saves the rest chain state, then draws the bar (`drawBar`: the ADR 0065 sampler
plus `consolidateRests`, unchanged) until the bar is not all silent or the previous bar was not
a bar rest, restoring the chain state before each redraw:

```ts
const chain = this.lastSilent;
let items: PartitionItem[];
do {
  this.lastSilent = chain;
  items = this.drawBar(settings);
} while (this.lastBarSilent && items.every((i) => i.isRest));
this.lastBarSilent = items.every((i) => i.isRest);
return settings.ties ? applyTies(items, settings.timeSignature, this.random) : items;
```

It is the same rejection pattern as the tuplet group that is never all silent (ADR 0066 §2):
the redraw starts from the chain state before the bar, so the result is the bar distribution
conditioned exactly on "not all silent". Every other bar keeps its relative probability.

- **Termination.** With rests on, the bar's first item sounds with $P \ge 1 - p_c = 0.5$, so the
  expected number of draws is at most 2. With rests off, no item is silent and the loop never
  repeats. A bar with a tuplet is never all silent (a group always sounds).
- **Order.** Bars are composed in order, ties lookahead included (`generateMeasure` composes
  bar $n+1$ right after bar $n$), so `lastBarSilent` always refers to the bar before. Ties run
  after the rejection; a tie never touches a rest, so they cannot change whether a bar is silent.
- **Tuplet ids.** A rejected draw still advances `tupletCounter`; ids stay unique, only not
  consecutive, which nothing relies on.

### 2. Why this keeps the Ergodic Principle

Ω is a set of figures. Every legal *bar* still has $P > 0$, the bar rest included, and so does
every rest run that ends or starts a bar around it (`… 𝄽 | 𝄼 | 𝄽 …`). The rule removes only the
exact repeat of an empty bar. That sequence holds no new figure, and printed music would write it
as a multi-bar rest, which this app never writes. ADR 0066 already judged the generator on
practice value as well as $P > 0$, and the rule is stated here and in SPEC §4.7, so it is not a
hidden heuristic.

### 3. Rejected alternatives

- **Lower $p_c$**: less silence everywhere, and runs still happen.
- **A cap of $N$ bars**: any $N \ge 2$ is still dead time.
- **A "bar rests" toggle**: one more control for something no one wants.
- **Multi-bar rest notation**: still dead time, and the rule would be needed anyway.

## Measurements

Same script, 100 000 bars per row, treble presets, before → after:

| Level | Meter | Bar rest per bar | Runs ≥ 2 | Silent share |
|---|---|---|---|---|
| Elementary | 4/4 | 5.96 % → 4.85 % | 863 → 0 | 16.7 % → 15.6 % |
| Elementary | 3/4 | 7.09 % → 5.66 % | 1182 → 0 | 16.6 % → 15.4 % |
| Elementary | 6/8 | 6.73 % → 5.27 % | 1076 → 0 | 16.9 % → 15.5 % |
| Elementary | 2/4 | 9.22 % → 6.83 % | 1815 → 0 | 16.9 % → 14.6 % |
| Intermediate | 4/4 | 3.05 % → 2.80 % | 265 → 0 | 15.9 % → 15.6 % |
| Intermediate | 3/4 | 3.67 % → 3.34 % | 372 → 0 | 15.9 % → 15.6 % |
| Intermediate | 6/8 | 3.02 % → 2.75 % | 260 → 0 | 15.2 % → 15.1 % |
| Intermediate | 2/4 | 4.73 % → 4.07 % | 559 → 0 | 15.7 % → 15.1 % |
| Advanced | 4/4 | 2.24 % → 1.97 % | 149 → 0 | 16.1 % → 15.8 % |
| Advanced | 3/4 | 2.50 % → 2.30 % | 173 → 0 | 15.9 % → 15.8 % |
| Advanced | 6/8 | 2.09 % → 2.00 % | 106 → 0 | 15.4 % → 15.3 % |
| Advanced | 2/4 | 3.31 % → 2.82 % | 296 → 0 | 15.9 % → 15.4 % |
| Virtuoso | 4/4 | 2.04 % → 1.86 % | 124 → 0 | 15.7 % → 15.5 % |
| Virtuoso | 3/4 | 2.39 % → 2.18 % | 178 → 0 | 15.6 % → 15.5 % |
| Virtuoso | 6/8 | 1.97 % → 1.94 % | 118 → 0 | 15.0 % → 15.1 % |
| Virtuoso | 2/4 | 2.90 % → 2.77 % | 247 → 0 | 15.4 % → 15.5 % |

Silent share is the fraction of beats under a rest; ADR 0066's stationary value is 1/6. Isolated bar
rests become more frequent (Elementary 2/4: 4 877 → 6 831 per 100 000 bars), since every former
run now ends after its first bar, while the total bar-rest rate falls by up to about a quarter.

## Consequences

- No exercise shows an empty staff for more than one bar, and none starts with one.
- The chain's transition rates ($p_s$, $p_c$) still hold item to item; only the bar right after a
  bar rest is conditioned. The ADR 0066 transition test passes unchanged.
- The silent share drops by about 2 points in the shortest bars (Elementary 2/4) and by
  under 0.7 points from Intermediate up.
- `tests/generator.test.ts` checks 20 000 bars of 2/4 quarters with rests for adjacent bar rests,
  and 2000 resets for a first bar that is a bar rest. "Reaches a full-bar rest in 3/4" keeps the
  bar rest reachable.

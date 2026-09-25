# 0040. Engraving Grammar for Ties and Cross-Barline Ties

- **Status**: Accepted (supersedes the tie section of [ADR 0039](0039-repository-audit-ergodicity-and-clock-unification.md))
- **Date**: 2026-09-25
- **Author**: Claude & lauseta

## Context & Problem Statement

ADR 0039 made ties a post-pass: `applyTies(items, gridUnit)` tied any two adjacent sounding, non-tuplet notes whose shared boundary fell on a beat, with p = 0.25. This had three problems:

1. **Redundant ties.** Many ties spelled a value that one note already expresses: `q~q` on beat 1 is `h`, `qd~8` on beat 1 is `h`, `h~h` is `w`, and `qd~qd` in 6/8 is `hd`. Real engraving never writes these.
2. **No ties across the barline**, the most common and most necessary tie in real music.
3. **Notes hiding the middle of the 4/4 bar.** The `1+2+1` branch wrote `qd` on beat 2, and `8 q 8` or `8 qd` across beats 2–3, as single notes. Gould's rule says these must be tied at the middle.

## Decisions & Implementation Methods

Ties become **notation, not decoration**: a tie appears only where no single well-placed notehead can express the sound. Whether a tie is legal never depends on the subdivision or dotted toggles.

### 1. Tie grammar module (`src/notation/ties.ts`)

- `NOTE_VALUES[ts]` maps a span in metric beats (quarters in simple meters, eighths in 6/8) to a VexFlow duration.
- `NOTEHEAD_PLACEMENTS[ts][value] = { period, offsets, tolerated? }` says where one notehead may start. A note must also fit inside the bar.

| Meter | Placements (value: period → offsets) |
|---|---|
| 4/4 | w:4→[0]; hd:4→[0] (+tolerated 1); h:2→[0] (+tolerated 1); qd:2→[0,.5]; q:2→[0,.5,1]; 8d:1→[0,.25]; 8:1→[0,.25,.5]; 16:.25→[0] |
| 2/4 | h:2→[0]; qd:2→[0,.5]; q:2→[0,.5,1]; 8d, 8, 16 as in 4/4 |
| 3/4 | hd:3→[0]; h:3→[0,1]; qd:.5→[0]; q:.5→[0]; 8d, 8, 16 as in 4/4 |
| 6/8 | hd:6→[0]; qd:3→[0]; q:3→[0,1]; 8d:3→[0,1]; 8:1→[0]; 16:.5→[0] (no h: a 4-eighth sound is always tied) |

- The tolerated entries are Gould's 4/4 exception: `q h q` and `q h.` may be single notes, and their tied spellings (`q q~q q`, `q q~h`), which show the middle, are also legal.
- `placementOf(ts, offset, span)` returns `'canonical' | 'tolerated' | null`, comparing with ε = 1e-9.
- **Legality** (`isLegalInnerTie`). A tie a⌒b inside the bar is legal iff:
  - a and b are both sounding and not in the same tuplet group; and
  - for every suffix cⱼ…a of the current chain (j = a alone included), the merge (offset(cⱼ), Σd + d_b) is **not canonical**. Suffixes that touch a tuplet note are skipped, since tuplet time never merges with other time. This combines the pair rule with **chain minimality**.
- Consequences of the table: ties never fall strictly inside a beat. Illegal: `q~q` on beat 1, `qd~8` on the beat, `h~h`, 6/8 `qd~qd`. Legal: `q~q` across beats 2→3 (`h@1` is only tolerated), `8 qd~8` across the middle (`h@.5` not placeable), `h~8` (2.5 beats), `16~8` across a beat, and 6/8 `8~8` across the dotted beat.
- `applyTies(items, ts)` walks adjacent pairs, tracks the chain start, and ties each legal pair independently with `TIE_PROBABILITY = 0.25`. Every legal tied spelling therefore has P > 0.
- `canTieAcrossBarline(a, b)`: both notes must sound; the barline makes the pair legal.
- `PartitionItem` is imported with `import type`, so there is no runtime cycle with `generator.ts`.

### 2. Generator

- **4/4 tree.** `1+2+1` keeps only `[single-beat, h, single-beat]`, and only when `half` is on; otherwise it falls back to `2+2`. `1 beat + hd` stays (tolerated `hd@1`). Every item the tree produces is canonical or tolerated; middle-straddling sounds are reached through `2+2` plus the middle tie. The 3/4, 2/4 and 6/8 trees already satisfied the table.
- **One-measure lookahead.** `generateMeasure` takes its rhythm from `lookahead ?? composeRhythm()`. With ties on, it also composes the next rhythm (internal ties applied), then ties the barline pair with p when `canTieAcrossBarline` holds. The decision sees both notes, so no rest is ever forced into a note.
- `lastSoundingPitch` (a field, not a local) lets a `tieEnd` on beat 1 keep the previous bar's pitch.
- `tail = { measureIndex, beatOffset, duration, beatWidth, width }` records the last note. When `notes[0].tieEnd`, the generator emits `MeasureData.tieIn` from it. If `measureIndex !== tail.measureIndex + 1` (the buffer skipped measures after a throttled tab), the pending `tieEnd` is stripped and no `tieIn` is emitted.
- `resetPitch()` clears `lookahead`, `tail` and `lastSoundingPitch`. Every musical settings change goes through `resetSession()`, which calls it.

### 3. Rendering (`src/notation/renderer.ts`)

- Inner ties are unchanged (`StaveTie` between notes i and i+1).
- A cross-barline tie is drawn **whole** by both measures, each in its own coordinates, with `StaveTie.renderTie`. Each canvas clips its half, and contiguous blitting joins them into one seamless arc over the barline.
  - Outgoing: firstX = `tieAnchorRightX(last)`, lastX = `data.width + NOTE_START_OFFSET`.
  - Incoming: firstX = `tieAnchorRightX(tieIn) − tieIn.measureWidth`, lastX = `NOTE_START_OFFSET`.
- `tieAnchorRightX(beatOffset, duration, beatWidth)` = linear x + notehead glyph width + dot right shift. The last two are measured once per duration on a detached `StaveNote` in a `ModifierContext` and memoized. Tests assert it equals `StaveNote.getTieRightX()` for every duration.
- Direction is pitch-based, `line >= 3 ? -1 : 1`, matching VexFlow's single-note auto stem. Both halves share pitch and clef, so the arcs match.
- `tieIn` is self-contained data, so `rerender()` (zoom, theme, solfège) and eviction never depend on a neighbouring measure.

## Consequences

- Ties now teach real engraving: every tie on screen is necessary, and the middle of the 4/4 bar and the 6/8 dotted beat are always visible.
- Ergodicity is defined over the legal tied grammar. With ties off, sounds such as `q qd 8` in 4/4 are no longer reachable, because their only correct spelling needs a tie.
- The generator now holds one composed-but-unrendered measure. It is cleared on every reset.
- Covered by `tests/ties.test.ts` (placement table, legality, chain minimality, vocabulary ⊆ table, necessity of every generated tie, barline consistency, reachability, reset and skip) and `tests/tieRender.test.ts` (rendering and seamless join).

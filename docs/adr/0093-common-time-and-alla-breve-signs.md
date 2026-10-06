# 0093. Common-Time and Alla Breve Signs

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

ADR 0090 added the half-note meters and drew 2/2 with numerals, "consistent with 4/4 never being drawn as C", deferring a sign option. Much of the repertoire a singer reads writes 4/4 as **C** (common time) and 2/2 as **¢** (alla breve, cut time): hymnals, Bach chorales, Renaissance editions, most of the classical literature. Reading the sign is part of reading the score.

The sign is a spelling, not a meter: C and 4/4 are the same bar, ¢ and 2/2 the same bar and the same half-note beat. Nothing the generator, the click or a link knows should change.

## Decision

### 1. Display only (`src/notation/types.ts`)

```ts
const METER_SIGNS = { '4/4': 'C', '2/2': 'C|' };
hasMeterSign(ts)               // 4/4 and 2/2
timeSignatureSpec(ts, signs)   // 'C' | 'C|' when signs is on and ts has one, else ts
```

`'C'` and `'C|'` are VexFlow 5's own time signature specs. They draw SMuFL `timeSigCommon` (U+E08A) and `timeSigCutCommon` (U+E08B), which ADR 0058's subset already holds, so the font did not change. `tests/musicFontCoverage.test.ts` draws both.

`METER`, the generator, the metronome, the beat lights and `TIME_SIGNATURES` never see the sign. The reachable state space Ω is unchanged, so ergodicity holds trivially.

### 2. Setting

| Setting | Values | Default | Travels in links |
|---|---|---|---|
| `meterSigns` | boolean | `false` | no |

It is a reading preference, like the theme or the labels, so `Exercise` (ADR 0085) leaves it out: the recipient sees the meter in their own spelling. The default stays numerals, so nothing changes for existing users.

### 3. Rendering

- `MeasureRenderer.renderPinnedClef(clef, ts, theme, meterSigns = false)` passes `timeSignatureSpec(ts, meterSigns)` to `stave.addTimeSignature`.
- `Scroller.drawPinnedClef` adds `meterSigns` to its header cache key, so toggling re-rasterizes the header once; the measures are untouched.
- The intro's level strips spread `globalState.settings` and so follow the setting. The intro's meter cards keep numerals: they offer a choice of meter, and C would hide that 4/4 is four quarters.

### 4. UI

Settings → Staff gains a checkbox, **C and ¢ signs**, in its own `control-group` under Meter. Like the Pulse group, `syncMeterControls` shows it only when `hasMeterSign(ts)`: in 4/4 and in 2/2, which is 2/4 with the Half-note beat switch on. The change handler stores the setting and repaints an idle frame. No CSS was added.

## Consequences

- One boolean and a three-line table; no new glyphs, no new bytes in the font.
- 4/2 is not given ¢ even though Bach used it so (ADR 0090, *Sources*): the modern reading of ¢ is two half-note beats, and the toggle stays a one-to-one spelling.
- Mensural signs (○, ⊙, C with a dot) would need glyphs outside the subset and are not proposed.
- **Tests**: `tests/pinnedHeader.test.ts` (the spec table, rasterizing both signs), `tests/musicFontCoverage.test.ts` (both glyphs in the subset), `tests/storage.test.ts` (default and validation) and `tests/share.test.ts` (left out of links).

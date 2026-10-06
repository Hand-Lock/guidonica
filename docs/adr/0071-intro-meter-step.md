# 0071. Time Signature Step in the Onboarding Intro

- **Status**: Accepted (amends [0049](0049-level-presets-onboarding-intro.md), [0050](0050-intro-notation-previews.md) and [0052](0052-intro-preview-signature-check.md)); amended by [0076](0076-compound-triple-and-quadruple-meters.md)
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

The intro (ADRs 0049, 0050) asked for the level, then the clef, and every preset was fixed to
4/4 (`PRESET_METER`). A new user who wanted 3/4, 2/4 or 6/8 had to find the Meter control in
Settings → Staff. The meter is as basic a reading choice as the clef, so the intro now asks
for it too.

Two constraints shaped the design:

- 6/8 supports no triplets (`TUPLET_SUPPORT`), and Intermediate and Advanced are defined by
  their triplets. Simply filtering them out would leave those levels without the tuplet figure
  they teach.
- The meter cards must not imply a form or character. 3/4 is not necessarily a waltz and 2/4
  not a march, so the cards describe the metre only.

## Decision & Implementation

### 1. A third step: Level → Clef → Meter

`index.html` adds `#intro-step-meter`, modelled on the clef step. The clef step's primary
button becomes Next (`#btn-intro-clef-next`); the meter step has Back (`#btn-intro-meter-back`)
and Start practising (`#btn-intro-start`). `showIntroStep` takes `'level' | 'clef' | 'meter'`.

The four cards come from `INTRO_METERS` (`src/presets.ts`, all of `TIME_SIGNATURES`). Each card
is named by the time signature itself (`4/4` …) and described by the locale's
`introMeters[ts]`: simple or compound, the beat count and the beat value
("Compound duple · two dotted-quarter beats of three eighths"). Every locale uses its own
theory terms (semplice quaternario, mesure composée à deux temps, zusammengesetzter
Zweiertakt, compás simple cuaternario …). The question is `introMeterQuestion`.

Reopening the intro from the header preselects the current level, clef and meter. Going back
to the level step redraws the strips when the clef **or** the meter differs from the ones they
were drawn in (`introPreviewClef`, `introPreviewMeter`).

### 2. Meter icons

`renderMeterIcon(canvas, ts, theme)` (`src/notation/preview.ts`) is the sibling of
`renderClefIcon`: both go through one `renderIcon` that draws a five-line staff fragment and
the pinned header glyph. `MeasureRenderer.renderPinnedClef` now accepts a null clef and then
skips `addClef`, so the header holds the time signature alone. Without a clef the glyph sits
at units 16–30 of the header canvas; `METER_ICON_CROP_X = −5` centres it in the same
56-unit window (28 × 46 px at `ICON_SCALE` 0.5) as the clef icons, so the text columns of
both steps line up. The icon canvas class is now `intro-option-icon` for both, and
`.intro-options-meters` shares the row layout and LED offset of `.intro-options-clefs`.

### 3. Presets take the meter

`PresetSettings` no longer contains `timeSignature`, and `PRESET_METER` is gone.

```ts
buildPresetSettings(level, clef, meter = '4/4')
```

1. Deep-clones the preset.
2. In 6/8, for each requested cell 6/8 cannot realise, switches on its counterpart from
   `COMPOUND_COUNTERPART`: `triplet:1/4 → duplet:1/4`, `triplet:1/8 → duplet:1/8`,
   `triplet:1/16 → duplet:1/16`. The duplet is the compound meter's counterpart of the triplet
   (2 in the time of 3 instead of 3 in the time of 2).
3. Passes the tuplets through `supportedTuplets(meter, …)`.
4. Returns `{ ...settings, timeSignature: meter, clef }`.

| Level | 4/4 · 3/4 · 2/4 | 6/8 |
|---|---|---|
| Intermediate | triplet ⅛ | duplet ⅛ |
| Advanced | triplet ¼, triplet ⅛ | duplet ¼, duplet ⅛ |
| Virtuoso | every cell the meter supports | every cell 6/8 supports |

This is a visible choice in the preset table, made before the settings reach the generator.
The generator is unchanged, and every preset is still an ordinary point of Ω whose cells the
user can see and change in the Tuplets popover, so ergodicity is untouched.

`buildPreviewSettings(level, clef, meter)` passes the meter through. `matchLevel(settings)`
builds each preset with `settings.clef` and `settings.timeSignature`: the meter is ignored like
the clef, and tuplets are compared with that meter's version of the preset. A 4/4
Intermediate switched to 6/8 in Settings keeps its (now disabled) eighth triplets and has no
duplets, so it reads Custom; picking Intermediate + 6/8 in the intro reads Intermediate.
`levelIndex` follows from `matchLevel`.

### 4. Signature checks in every meter (amends 0052)

- **Beginner** required a half note, which has no placement in 6/8 (a 4-eighth sound is
  always tied). Its signature is now "a sounding note longer than one metric beat":
  `beatDuration > 1`, i.e. h or w in simple meters and q or longer in 6/8.
- **Intermediate** required tuplets and 16ths in one window. A 6/8 eighth duplet spans a whole
  dotted-quarter group, and the narrowest card shows ≈ 2.96 eighths, so no window there can
  hold both. The check now also accepts a window whose visible notes are all tuplet members
  (a lone group filling a short window). In simple meters this only adds windows made of
  tuplets alone, which still show the level's new figure.
- Elementary, Advanced and Virtuoso pass unchanged.

`tests/presets.test.ts` runs the acceptance test (≥ 25 % of windows, so 32 attempts all fail
with probability < 10⁻⁴) in every meter. The 6/8 window lengths are in eighths and come from
the real card range (229–510 px at 80–180 px per eighth): Beginner and Elementary 4–10.8,
Intermediate 2.9–7.8, Advanced and Virtuoso 1.8–4.8.

## Consequences

- New users choose their meter up front, and the header meter, beat dots, 6/8 pulse row and
  tuplet availability follow through the existing `applyLevelPreset` → `hydrateUI` path.
- The level step comes before the meter, so its descriptions still say "triplets". In 6/8
  those become duplets. This is a known simplification: rewriting the level text per meter
  would need the meter before the level.
- Beginner in 6/8 has quarters and, through the grammar's beat-unit fallback (ADR 0065),
  eighths, because the half note has no 6/8 placement. Its strips are q and 8 figures.
- The tests now cover every preset × intro clef × meter for the preview subset, the
  supported-tuplet rule, the 6/8 counterparts and `matchLevel`.

# 0112. Labels After Playing

- **Status**: Accepted
- **Date**: 2026-10-21
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0087](0087-rotating-tips.md) (a new tip)
- **Relates to**: [0041](0041-solfege-labels-notehead-anchored.md), [0042](0042-single-dpr-offscreen-backing-store.md), [0091](0091-jank-free-beat-and-measure-frames.md), [0103](0103-embeddable-engine-seams.md), [0109](0109-squishy-view.md), [0110](0110-page-view.md)

## Context & Problem Statement

Note labels (syllables or letters, Settings → Display → Labels) are drawn into each measure's
cached canvas when the measure is rendered (`MeasureRenderer.renderMeasure`). They are therefore
either always visible or never. Always visible, they give the answer away before the note is sung;
never visible, the singer has no way to check afterwards.

The user asked for a third way: each label stays hidden until the playhead (steady and squishy
views) or the page cursor (page view) reaches its note, so after singing one can look back and
check. It is most useful in the page view, where played lines stay on screen (ADR 0110).

The constraint is ADR 0091: a frame only blits cached canvases. Drawing text per frame, or
re-rasterizing a measure as each note is reached, is ruled out.

## Decision & Implementation

1. **A per-user assist.** `AppSettings.labelsAfterPlaying: boolean`, default `false`, stored and
   validated in `src/storage.ts` like `showPlayhead`. It is a checkbox under Settings → Display →
   Assists, "Labels after playing", and works with whichever Labels table is chosen. It is not part
   of exercise links (ADR 0085) or level presets: like the playhead it belongs to the reader, not
   the exercise. While Labels is None the checkbox is dimmed (`is-dormant`, still clickable, as the
   interval chips of ADR 0070) and its tooltip says to choose Syllables or Letters first.

2. **Reveal rule: at the onset, strictly after it.** A label is shown once
   `startBeat + beatOffset < vb`, where `vb` is the visual beat the frame is drawn at. The comparison
   is strict: during the count-in the audio clock holds the visual beat at 0, and a `≤` would show
   the first label before its note sounds. A label appears the frame after its click, with the
   notehead on the playhead or under the cursor. Tie continuations have no label (unchanged), so a
   tied note's label appears at its first, articulated head.

3. **A separate label layer, pre-rasterized once.** With the option on, `renderMeasure(data, theme,
   labels, labelsAfterPlaying)` draws no labels on the note canvas. It creates a second canvas of the
   same pixel size, scales it by the same `dpr·zoom` the notes were drawn with (so labels keep
   ADR 0041 and 0042's alignment), and fills the same labels there with the same font and palette. Each label
   gets a box in measure units:

   - width: `measureText(text).width + 2·LABEL_BOX_PAD` (1 unit each side), centred on the label;
   - height: `SOLFEGE_FONT_PX + 4` = 15 units, centred on its y;
   - clamped to the canvas; `beat` is the note's `beatOffset`.

   `solfegeLabelPlacements` now carries `beat` on each `LabelPlacement`, which the SVG export and
   engine embedders can also read. The boxes are in note order, so their beats ascend.
   `RenderedMeasure.labelLayer = { canvas, labels }`; `LabelLayer` and `LabelBox` are exported from
   `src/notation/types.ts`, hence from `guidonica/engine`.

4. **Reveal by blits.** `ScrollerView.blitLabels(ctx, m, x, y, vb)` runs right after each bar's note
   blit, in the tape views at `measureDrawY` and in the page view at the line's top, under the
   line's `globalAlpha` so labels on played lines dim with them. It counts the revealed labels `n`
   (a linear scan over a handful of boxes) and:

   - draws nothing when `n = 0`;
   - draws the whole layer in one `drawImage` when every label is revealed;
   - otherwise draws one sub-rectangle per revealed label: source `box × (canvas.width / data.width)`,
     destination `(x, y) + box × (m.width / data.width)`.

   The two scales are exactly the whole-layer blit's linear map (canvas pixels to `m.width`), so a
   label does not shift by a sub-pixel when its bar turns from partly to fully played. Nothing is
   allocated per frame; the cost is at most one blit per label on the bar being played, and one per
   other bar. `renderAt` draws through the same path, so frame export reveals labels the same way.

5. **Ink unchanged.** The bar's ink (ADR 0110) still counts its labels while they are hidden, so the
   page's line spacing never changes when the option is toggled and nothing jumps as labels appear.

6. **Memory.** The buffer's `release(m)` zeroes both canvases on eviction, reset, view change and
   re-rendering (AGENTS §3.2). The layer doubles a labelled bar's backing store only while the option
   is on; with it off no layer exists.

7. **SVG export is unchanged**: `renderMeasureSvg` always draws the labels.

8. **Tip.** A feature tip `labelsAfter` opens Settings → Display and is eligible only while labels
   are on and the option is off, right after the `labels` tip in the rotation (ADR 0087).

Toggling the option or changing Labels re-rasterizes the kept bars (`rerenderBuffer`); the music
under the playhead is untouched.

## Consequences

- Reading and checking are separated: one sings from the notes alone and checks against the labels
  behind the playhead, in any view, most comfortably on the page.
- Frames stay blits only (ADR 0091); a frame draws at most a few extra small sub-rectangles.
- Labels that already overlap side by side (dense 32nds at a narrow zoom) have overlapping boxes, so
  revealing one can show a sliver of its unplayed neighbour early. Labels are spaced by their
  noteheads, so this needs labels that already collide when always shown.
- A label's box is a little larger than its glyphs, so a sub-rect may copy a few transparent pixels;
  it never copies note ink, which is on the other canvas.

## Tests

- `tests/solfege.test.ts`: with the option on, the note canvas gets no `fillText`, the layer gets one
  per label at the same device positions, boxes are sized and centred, beats ascend, and the ink is
  the always-on ink; with it off there is no layer.
- `tests/renderAt.test.ts`: in the steady and page views, nothing at the first onset, one sub-rect
  just after it at the expected source and destination, two after the second, one whole-layer blit
  once the bar is played.
- `tests/buffer.test.ts`: eviction and reset zero the label canvas; `rerender` passes the option.
- `tests/storage.test.ts`: default false, a stored true round-trips, junk falls back.
- `tests/tips.test.ts`: the tip's eligibility.

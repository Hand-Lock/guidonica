# 0057. Canvas-Bounded Beams & Tuplet Numbers

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & lauseta
- **Amends**: [0041](0041-solfege-labels-notehead-anchored.md) (§4, tuplet label clearance)

## Context & Problem Statement

A long beamed sextuplet of eighths in 4/4 (treble, contour `a4 f4 g5 f4 f3 a3`, notes ≈123 px apart)
was drawn with a beam falling steeply from the top-left corner of the measure canvas. Only the
bottom sliver of its tuplet "6" was visible, because the rest of the digit lay above the 220 px
canvas.

Measured with VexFlow 5.0.0 on that measure:

| | beam slope | highest stem tip | `tuplet.getYPosition()` |
|---|---|---|---|
| before | 0.150 | y = 3.1 | y = −6.9 (number off-canvas) |
| slant capped at 2 spaces | 0.029 | y = 32.8 | y = 22.8 |

**Root cause.** Our strictly linear spacing ([ADR 0001](0001-core-architecture-and-rendering-pipeline.md), [ADR 0005](0005-dynamic-subdivision-beat-width-and-stave-padding-compensation.md))
breaks two VexFlow assumptions:

1. **Beam slope is scored per pixel.** `Beam.calculateSlope` tries `slopeIterations` slopes in
   `[minSlope, maxSlope] = [−0.25, 0.25]` (dy/dx) and keeps the one that minimises
   `cost = slopeCost·|ideal − slope| + |Σ stem extension (px)|` with `slopeCost = 100`. On
   VexFlow's compact beams (≈50–150 px) the first term keeps the slope modest. Our tuplet beams
   span 600–800 px, so the summed extension in pixels outweighs the slope term and the beam
   follows the melody: 0.15 × 615 px = a 92 px rise, which is 9 staff spaces. Engraving practice
   limits beam slant to about 2 spaces. Long 16th and 32nd beams in non-tuplet runs are
   affected in the same way.
2. **The tuplet number ignores the canvas.** At `LOCATION_TOP` with stems up,
   `Tuplet.getYPosition()` sets the number one staff space above the *highest* stem tip, as a
   level line. Nothing clamps it to the canvas.

Even a correctly slanted beam can leave the canvas. With ±3 ledger lines (G6 down to E3 in
treble), `e3 e3 g6 e3 e3 e3` with stems up must clear G6: the stem tips reach y ≈ −2 and the
number sits at y ≈ −12.

## Decisions & Implementation

All changes are in `src/notation/renderer.ts`. The generator, its state space and ergodicity are
untouched. Canvas geometry (`MEASURE_CANVAS_HEIGHT`, `STAVE_CANVAS_Y`) is unchanged.

Constants: `NOTATION_CANVAS_MARGIN = 2`, `MAX_BEAM_RISE = 20` (2 × 10 px staff space),
`TUPLET_NUMBER_HEIGHT = 12`.

1. **Slant cap on every beam (`fitBeam`).** Before post-formatting, with
   `span = last.getStemX() − first.getStemX()`:
   `m = min(0.25, MAX_BEAM_RISE / span)`, `renderOptions.maxSlope = m`, `minSlope = −m`.
   Beams with span ≤ 80 px keep VexFlow's defaults. Longer beams can rise at most 2 spaces,
   whatever their length. VexFlow's cost function still chooses the slope inside that range.
2. **Flat fallback.** After post-formatting, every beamed stem tip
   (`getStemExtents().topY`, which is where the outer beam line sits; secondary beams stack
   inward) must lie in `[NOTATION_CANVAS_MARGIN, MEASURE_CANVAS_HEIGHT − NOTATION_CANVAS_MARGIN]`.
   If one does not, the stems are restored to their pre-beam extensions and the beam is
   redone with `renderOptions.flatBeams = true` (with `flatBeamOffset` reset).
   `calculateFlatSlope` seats a flat beam at the extreme note's minimum beamed stem length:
   for G6 that is y = 40 − (15 + 1.5·5·beams), which is ≥ 2.5 even for 32nds.
   *We do not set `maxSlope = minSlope = 0` instead: then `calculateSlope`'s increment is 0 and
   its search loop never ends.*
3. **Tuplet number side.** Once the beams are final, each tuplet's number box is checked using
   `tupletNumberBox(y, location)`, which mirrors `Tuplet.draw`. The digit is centered on
   `y − location·Tuplet.textYOffset` (VexFlow centers it by its ascent + descent), and the box
   extends `TUPLET_NUMBER_HEIGHT / 2` above and below that center. If the top of the box is
   above the margin, the tuplet moves to `LOCATION_BOTTOM`, on the notehead side. Engraving
   practice allows this when the beam side has no room. For stems up, the number then sits
   below the lowest notehead, at most y ≈ 184 for E3. The chosen side is kept in a
   `Map<Tuplet, number>` because `Tuplet.options` is protected.
4. **`TUPLET_NUMBER_HEIGHT`** comes from the Bravura font VexFlow bundles
   (`vexflow/build/esm/src/fonts/bravura.js`). The tuplet digit glyphs U+E880–E889 at the
   30 px tuplet font have an ink height of 11.2–11.5 px (measured with fontTools), so the
   constant is set to 12.
5. **Solfège labels follow the tuplet's side (amends ADR 0041 §4).** A label on the same side as
   its tuplet's number clears it: above the number (`min(y, tupletY − SOLFEGE_LABEL_OFFSET)`) for
   stem-down labels and a top tuplet, and below it (`max(y, tupletY + SOLFEGE_LABEL_OFFSET)`)
   for stem-up labels and a bottom tuplet. Labels are then clamped to the canvas as before.

## Tests

`tests/tupletRender.test.ts`. Spies on `Beam.prototype.draw` and `Tuplet.prototype.draw` record
the beams and tuplets as drawn.

- The reported sextuplet: beam rise ≤ `MAX_BEAM_RISE`, number above the beam and inside the canvas.
- `e3 e3 g6 e3 e3 e3` 16ths: flat beam with all tips inside the canvas, and the number moved to
  the bottom, inside the canvas.
- A property sweep over every supported tuplet cell × 4 meters × treble/bass, with ±3 ledger
  lines, all intervals, 16ths, 32nds, rests and ties (50 measures each): every beam's rise,
  every stem tip and every tuplet number box stays inside the canvas.

All three tests fail without the change: rises of 92, 67, 39, 31 and 34 px were measured.

## Consequences

- Long linear-spaced beams now slant at most 2 staff spaces, as in engraved music. Steep
  contours are carried by stem length, not by beam angle.
- Beams and tuplet numbers can no longer be clipped by the measure canvas, at any ledger-line
  or interval setting.
- In rare extreme figures the tuplet number appears below the noteheads instead of above the
  beam.
- `TUPLET_NUMBER_HEIGHT` is tied to Bravura's tuplet digits at VexFlow's default 30 px
  `Tuplet` font. If the music font or the `Tuplet.fontSize` metric changes, measure it again.

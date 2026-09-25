# 0041. Solfège Labels Anchored to Noteheads (dpr² Transform Fix)

- **Status**: Accepted (supersedes in part [ADR 0014](0014-solfege-label-transform-and-vertical-clearance.md))
- **Date**: 2026-09-25
- **Author**: Claude & lauseta

## Context & Problem Statement

On Retina displays, solfège and letter labels drifted further left the later a note sat in its measure. The drift reset at every barline, and the labels also sat too high.

**Root cause** (historical; the hidden dpr factor was removed in [ADR 0042](0042-single-dpr-offscreen-backing-store.md)). `renderMeasure()` sizes the canvas to `width·dpr·zoom` and then calls `renderer.resize(canvas.width, canvas.height)`. VexFlow's `CanvasContext.resize` multiplies the size by `devicePixelRatio` **again** and applies `scale(dpr)`. The `ctx.scale(dpr·zoom)` that follows means VexFlow draws at **dpr²·zoom**. The scroller blits the whole canvas into `m.width`, so the notes still look correct.

The label pass called `rawCtx.setTransform(dpr·zoom, …)`, which dropped VexFlow's hidden `dpr` factor. At dpr = 2, every label coordinate and the font size were halved: x → x/2, so the leftward drift grew with x and reset per measure canvas, and y → y/2, so labels rode up. ADR 0014 assumed the context carried only `dpr`, which was wrong.

Labels were also placed at the theoretical linear x (`NOTE_START_OFFSET + beatOffset·beatWidth`) on a fixed baseline under the staff, not on the notehead.

## Decision & Implementation

1. **Inherit the transform.** (Historical note: when written, this matrix carried VexFlow's hidden dpr factor. Since ADR 0042 it is exactly `dpr·zoom`.) `drawSolfegeLabels()` never resets the transform. It draws inside `save()/restore()` with the context's current matrix, the one VexFlow used for the notes. Label coordinates then share the logical space of `getAbsoluteX()` / `getYs()` at any dpr, zoom, or internal VexFlow scaling.
2. **Anchor on the real notehead.** `solfegeLabelAnchor(headBeginX, headEndX, headY, stemDir)` (exported, pure):
   - `x = (getNoteHeadBeginX() + getNoteHeadEndX()) / 2`
   - `y = getYs()[0] + SOLFEGE_LABEL_OFFSET · (stemDir === Stem.UP ? +1 : −1)`

   The label goes on the side opposite the stem: stem up → below, stem down → above. Stem direction is read **after** beams are built, because `Beam` can flip stems. Low notes are stem-up and high notes stem-down, so ledger-line notes get their label on the outer side, away from the staff.
3. **Constants.** `SOLFEGE_LABEL_OFFSET = 15` (half head 5 + gap ~4 + half text height ~6). The font is bold 11px, `textAlign = 'center'`, `textBaseline = 'middle'`.
4. **Tuplet clearance.** Tuplets sit at `LOCATION_TOP`. For a label above a tuplet note, `y = min(y, tuplet.getYPosition() − SOLFEGE_LABEL_OFFSET)`, so it clears the bracket and number. A `StaveNote → Tuplet` map is built from the drawn tuplets.
5. **Canvas clamp.** `y ∈ [8, MEASURE_CANVAS_HEIGHT − 8]`.
6. **Unchanged rules.** Rests and tie continuations (`tieEnd`) get no label, `keys[0]` is used, and the syllable tables and colors stay the same.

## Consequences

- Labels stay centered on their noteheads at every dpr and zoom. `tests/solfege.test.ts` renders at dpr = 2 and checks each label's device-space x against its notehead's device-space x. The old code fails that test by exactly a factor of 2.
- Labels inside the staff sit over staff lines, and an outgoing tie arc may touch a label's edge.
- **Follow-up: resolved in [ADR 0042](0042-single-dpr-offscreen-backing-store.md).** The dpr² backing store is gone. VexFlow's `resize()` is no longer called, so canvases are allocated at `dpr·zoom`.

# 0110. Page View: Multi-Line Staves with Vertical Scrolling

- **Status**: Accepted (a third view beside ADR 0109's steady and squishy tapes)
- **Date**: 2026-10-18 (amended the same day: reading line a third down, played lines dimmed, active-line band; amended 2026-10-21: the cursor stops at a line's closing barline)
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md), [0087](0087-rotating-tips.md), [0091](0091-jank-free-beat-and-measure-frames.md), [0103](0103-embeddable-engine-seams.md), [0104](0104-engine-entry-point.md), [0109](0109-squishy-view.md)

## Context & Problem Statement

Every view so far is a tape: one staff whose music slides sideways past a fixed playhead. On a
portrait phone the tape is narrow, so the reader sees about one bar ahead, and the app asks
to rotate the phone ("Best in landscape", ADR 0055).

Printed music solves the narrow page with lines (systems): the music wraps, and the reader's
eye moves along a still line and jumps to the next. A third view, **Page**, does the same.
A cursor moves along the current line in time with the clicks, and at each line break the
page eases up by one line so the next one takes the reading position. Notes no longer move
while they are read; the page moves only between lines, and every line holds still long
enough to read ahead into the lines below.

Kept invariants:

- the audio clock is the only time source: cursor x and page scroll are pure functions of
  `metronome.getVisualBeat()`, and a note is under the cursor on its click;
- frames only blit: VexFlow runs once per bar, one bar per idle callback (ADR 0091);
- memory is bounded by the stage area;
- the generator is untouched: same ergodicity, same random draws in every view;
- steady and squishy stay pixel-identical (their tests are unchanged).

## Decision & Implementation

### 1. A third view (`types.ts`)

`VIEW_MODES = ['steady', 'squishy', 'page']`. Page joins the swipe, `V` and Settings →
Display → View cycle of ADR 0109; it is one axis, not a separate layout toggle, because a
page always uses engraved spacing. The view is a personal preference, so share links do not
carry it (ADR 0085), and rotating the phone never switches it: changing the layout under a
reader mid-exercise is worse than one tap. The landscape notice instead gains a **Page
view** button, and is hidden while the view is Page by
`:root[data-view="page"] .orientation-notice { display: none }`; `main.ts` mirrors the view
on `<html data-view>` at boot and in `setView`.

### 2. Natural widths (`spacing.ts`)

Each bar is first laid out with ADR 0109's engraved knots at `PAGE_DENSITY = 0.7` of the
squishy space. A still page reads denser than a moving tape. `spacingBase(settings, ts,
density)` scales the linear cap and $s_{\min}$ by

$$\text{scale} = \max\!\Big(\rho,\ \min\big(1,\ \tfrac{44}{s_{\min}}\big)\Big),\qquad \rho = \texttt{PAGE\_DENSITY},$$

so the shortest note never gets less than `PAGE_MIN_NOTE_SPACE = 44` units. A bar's last
note sits $s_{\text{last}}$ before the knot at $26 + W$, and the next barline $26$ units
before that, so its head and flag keep about $s_{\text{last}} - 26 \ge 18$ units to the
barline. `spaceMeasure(…, 'page', …)` strips `lineStart` as well as `knots` and `tieIn`, so a
bar can be laid out again in any view. `typicalBarWidth(settings, view)` is memoised per view.

### 3. Lines: greedy breaking and justification (`scroller/page.ts`)

A line's bars share `lineAvailable(W_page, header) = W_page − 16 − header − 16` units:
the page width in units ($W_{\text{viewport}}/\text{zoom}$), less the left margin, the
clef header, and a right margin equal to the left one, as in print. Until 2026-10-21 the right
margin was $26 + 4$, room for the cursor's run-out past the closing barline; the cursor now
stops at the barline (§6), so nothing is left to make room for.

Bars are packed greedily: a bar joins the open line while `fitsLine(used, w, available)`,
i.e. $\text{used} + w \le \text{available}$ (the first bar always joins). A line is closed
when the next bar would overflow it, and is then **justified**: every bar is scaled by the
same factor

$$j = \frac{\text{available}}{\sum_i W_i},\qquad x_k' = 26 + (x_k - 26)\,j,\quad m_k' = m_k\,j,\quad W' = W\,j,$$

(`justifyMeasure`). A line fills its width exactly, like print. Because every bar in a line
shares $j$, a barline's two slopes, equal before (ADR 0109), stay equal, so the cursor's
speed is continuous across barlines inside a line. Lines only stretch: squeezing ($j<1$)
was tried and dropped, because at $j = 0.9$ a flagged last eighth reaches the next barline.
The one exception is a lone bar wider than the line (a large manual zoom), compressed to fit.
The notes are shared and never changed.

### 4. Engraving conventions (`renderer.ts`)

- Every line starts with a clef; the time signature appears only on the line holding bar 0.
  The top bar's meter chip always shows it.
- A line's first bar has `MeasureData.lineStart`, drawn without a left barline
  (`leftBar: !data.lineStart`). The scroller draws each line's closing barline.
- The header is drawn by `renderSystemHeader(clef, ts | null, theme, meterSigns)` with the
  pinned header's stave (`headerStave`, shared with `drawPinnedClef`). Its width,
  `systemHeaderWidth = getNoteStartX() − 10`, is memoised once the music font is ready.
- A tie across a line break draws as two halves, as in print. Inside a line a bar takes its
  `tieIn` from the justified bar before it; at a line start it keeps its natural `tieIn`,
  and the existing per-canvas clipping draws the incoming half after the clef.

### 5. Vertical spacing from the ink

`drawMeasure` returns the bar's ink extent, `RenderedMeasure.ink = {top, bottom}`:
noteheads ±10 units, stem tips (which carry the beams), and tuplet number boxes, widened by
the label placements, unioned with the staff [80, 120] and clamped to the canvas [0, 220].
A line's ink is the union over its bars, and the distance from one line's `y` to the next is

$$\Delta y = \max\big(100,\ \text{inkBottom}_r - \text{inkTop}_{r+1} + 12\big)$$

(`lineDistance`; `PAGE_MIN_STAFF_DISTANCE`, `PAGE_SYSTEM_GAP`). Lines are as tight as their
notes allow and never collide. That matters most in portrait, where height is the scarce
resource. A line's `y` is fixed once its last bar renders, always before it reaches the stage.

### 6. Motion: cursor and line turns

The cursor's x on its line (`cursorOffsetX`) is

$$x(v_b) = 16 + \text{header} + \sum_{\text{bars before}} W' + \text{beatX}(\text{bar},\ v_b - \text{start}),$$

times zoom. On the justified knots `beatX` is ADR 0109's monotone Hermite, so every note is
under the cursor on its click (`tests/renderAt.test.ts`).

**On a line's last bar the cursor stops at the closing barline** (amended 2026-10-21). A
bar's end knot $x_n = 26 + W'$ is where the *next* bar's first note sits, 26 units past the
barline at $W'$. Inside a line that is right: the cursor crosses the barline and reaches the
next note on its click. At a line end there is no next note on the line, so the cursor ran
past the barline into the right margin during the last note, and the played wash overshot the
band the same way, while the eye already reads the barline crossing as the break. Past the
last onset $o_L$ of the line's final bar, `lineEndX` replaces beatX with the cubic Hermite on
$[o_L, B]$ from $(x_L, m_L) = (x_{n-1}, m_{n-1})$ to $(W', \delta)$:

$$\delta = \frac{W' - x_L}{h},\quad h = B - o_L,\quad m_0 = \min(m_L,\ 2\sqrt2\,\delta),$$

$$X(t) = h_{00}(t)\,x_L + h_{10}(t)\,h\,m_0 + h_{01}(t)\,W' + h_{11}(t)\,h\,\delta,\qquad t = \frac{o - o_L}{h}.$$

So the cursor reaches the closing barline exactly on the next line's downbeat, where the turn
is already halfway. Keeping the start slope $m_L$ makes the speed C¹ at the last onset, and the
last note is still under the cursor on its click. With the end slope equal to the secant,
$\beta = 1$, the Hermite is monotone when $\alpha = m_L/\delta \le 2\sqrt2$ (inside
Fritsch–Carlson's radius-3 circle). For a last note of space $s$ after a note at least as long,
$\alpha \le js/(js - 26)$, and the worst case over note pairs, $s$ at its least
`PAGE_MIN_NOTE_SPACE` = 44, needs $j \ge 0.914$; lines only stretch ($j \ge 1$), so only a lone
bar compressed below its width can reach the clamp, which keeps it monotone at a small slope
step. When $W' \le x_L$ (a lone bar compressed far enough that its last note sits past the
barline) the cursor holds at $x_L$. Only the line's real final bar takes this segment, not the
last bar of a line still being rendered. A bar without knots (never on a page) caps beatX at
$W'$. It is a pure function of the beat and allocates nothing.

The scroll $Y(v_b)$ (`pageScrollY`) is the y shown at the stage top. Each line has a target
$\mathcal{T}(y) = \max(0,\ y - A)$, where $A$ is the reading anchor below. Outside turns
$Y = \mathcal{T}(y)$ of the active line; across a break at beat $b$ it eases from the previous
line's target with a smoothstep centred on the break:

$$Y = \mathcal{T}(y_{\text{prev}}) + \big(\mathcal{T}(y) - \mathcal{T}(y_{\text{prev}})\big)\,\sigma\!\Big(\frac{v_b - (b - T/2)}{T}\Big),\qquad \sigma(t) = 3t^2 - 2t^3,\quad T = \texttt{PAGE\_TURN\_BEATS} = 1.$$

$\sigma$ has zero slope at both ends, so the motion is C¹ and never jerks. The step happens
while the eye is already jumping lines. Each line stores `prevY`, so the curve never reads an
evicted line. With `prefers-reduced-motion` the page cuts at the barline instead
(`scroller.setReducedMotion`, default false so `renderAt` stays deterministic). `findSystem`
finds the active line by binary search.

**The reading line sits a third of the way down the stage** (amended 2026-10-18). Seeing
the bars just played helps, but read-ahead matters more for sight-reading, so the anchor is a
third rather than the centre, which would give half the stage to music already played. The
anchor places the active line's middle staff line (canvas y 100) at $H/3$:

$$A = \max\Big(0,\ \frac{H \cdot \texttt{PAGE\_ANCHOR}}{\text{zoom}} - 80 - 20\Big),\qquad \texttt{PAGE\_ANCHOR} = 1/3$$

(`pageAnchor`). Line ys are absolute from the first line ($y = 0$), so **the page starts at
its top, like a document**: while $y \le A$ the target is 0, the page holds still, and on
each turn the reading line moves down, as an eye does on print. Once it reaches the anchor
the page scrolls instead. The clamp is applied to each line's target, not to the eased
curve: $\max(0, \cdot)$ of the blend would have a slope jump in the middle of the turn where
the clamp releases, while a blend of clamped targets is still $\sigma$ between two
constants, C¹ with zero slope at both ends. After a view switch, a reset or a background-tab
skip the page starts again at its top.

Played lines stay on the page, dimmed: a finished line eases from full ink to
`PAGE_PLAYED_ALPHA` = 0.4 over the half beat after its break (`lineAlpha`,
$1 - 0.6\,\sigma(2(v_b - b)/T)$, applied with `globalAlpha`). Lines to come stay at full ink,
since they are what is read. A cached 24-unit top fade (`PAGE_FADE_HEIGHT`) softens the
stage edge only. On a 390 × 844 phone at 70% the stage shows about two or three played
lines above the reading line and six to come below it.

### 7. Assists

**A light band marks the active line, with the playhead on or off** (amended 2026-10-18).
It is a neutral slate tint, `rgba(staffRgb, bandAlpha)` with `bandAlpha` 0.07 in light and
0.10 in dark (`CANVAS_PALETTE`), from the left margin to the line's closing barline over the
cursor's vertical span (35 units above the staff top to 75 below). It is neutral, not red,
so it never reads as an error; red stays the cursor's and the played wash's colour. The band
is drawn under each line's ink with `globalAlpha` set to its weight (`lineFocus`), so nothing
is allocated per frame. Its weight is 1 on the active line; across a turn the departing line
gets $1 - \sigma$ and the arriving one $\sigma$, from the same helper as the scroll, so the
two never disagree and the weights sum to 1. Under reduced motion it moves at the barline.
It moves with the page, so it never jumps. With the dimmed lines above it, the reading line
is clear at a glance even before it reaches the anchor.

With the playhead on, the page also draws the cursor and a light wash over the part of the
current line already played. The cursor is a red line spanning the staff with the playhead's
triangles and glow; the glow gradient is cached and placed with `translate`. With the
playhead off neither is drawn. **The playhead stays optional**: forcing it on in the page
view would remove the internal-pulse exercise there. The band says which line is playing,
not where in it.

### 8. Buffer (`buffer.ts`)

The tape paths are unchanged. In page view `measures` holds the rendered bars of the
complete lines in `systems`, in order; a closed line's justified bars wait in `queued` until
each renders, and the bars after them wait in `open` at their natural width.

- `ensureRows(vb, rowsBelow, settings, maxMeasures)` renders a queued bar if there is one,
  otherwise generates the next bar (with the same one-bar-ahead `pending` as the tape), lays
  it out naturally and adds it to the open line, closing that line when the bar does not
  fit. Each render counts toward `maxMeasures`, so idle callbacks still render one bar each
  (ADR 0091). It stops once complete lines reach `rowsBelow` past the active one;
  `coversRows` asks the same question. `ensureAhead` delegates to it in page view.
- `evictRowsBefore(vb, rowsAbove)` keeps the active line and `rowsAbove` played lines
  before it, and releases the rest's canvases, as `evictFirst` does. The scroller passes
  `pageRowsAbove(A)` = $\lceil A/100 \rceil + 2$: the lines within the anchor at the least
  staff distance, one for the line a turn is leaving, and one because a line's ink reaches
  at most 68 units past the next line's `y` ($\text{inkTop} \le 80$ in `lineDistance`).
- `setPageWidth(w)` marks the layout dirty when the width changes by more than half a unit.
  The next `ensureRows` re-breaks every kept bar from the first one, keeping the first
  line's `y`, and renders them again (`relayoutPage`). `rerender` does the same, since ink
  changes with labels. Leaving the page view flattens the kept bars, rendered, queued and
  open, back onto the tape in order. `reset()` and the background-tab skip drop the page
  state.

### 9. Scroller (`scroller.ts`)

`draw()` branches to `drawPage()` in page view. `drawPage` fills the background, ensures
`ceil(H / (100·zoom)) + 1` rows (scheduling idle renders for one more), which the initial
phase needs while the page is at its top, evicts, and draws each line on the stage at
$(y - Y)\cdot\text{zoom}$: its band, then its staff lines (`drawStaffLines` now takes a y),
header, bars and closing barline at the line's alpha. It then draws the wash and cursor, then the top
fade. Header canvases are cached per clef, meter, meter signs and theme, and released with
the pinned clef on a zoom or DPR change. `renderEmptyFrame` draws empty lines while the font
loads. `updateDimensions` pushes `W_viewport/zoom` to the buffer.

### 10. Auto zoom

`fitPageZoom(W, H, bar, header)` takes the floor, in 10% steps, of

$$\min\Big(\frac{W}{16 + \text{header} + 2\,\overline{W}_{\text{page}} + 30},\ \frac{H}{4 \cdot 100}\Big),$$

two typical page bars per line and at least four lines down the stage, clamped to
[0.6, 1.0] (`PAGE_TARGET_BARS`, `PAGE_TARGET_LINES`, `PAGE_MIN_AUTO_ZOOM`). With the
default rhythm a 390 × 844 phone gets 70%, a staff space of 7 CSS px, and about 1.8 bars per
line. Bars of eighths (~300 units) sit alone on a line; at 60% they would pair, but the
staff would be too small to read at arm's length. In landscape the height binds (80% at
844 × 390); a desktop gets 100%.

### 11. Engine and copy

`src/engine.ts` exports `justifyMeasure`, `pageScrollY`, `pageAnchor`, `lineEndX` and `PageSystem`; the constants flow
through `types`. `lineEndX` is exported for embedders that draw their own cursor on a line's last bar,
so it ends at the closing barline as `ScrollerView`'s does (ADR 0104 §1). `MeasureBuffer` gains `setPageWidth`, `getSystems`, `ensureRows`, `coversRows` and
`evictRowsBefore`, and `ScrollerView` gains `setReducedMotion` and `getViewportHeight`. An embedder
draws a page through `ScrollerView`, which owns the cursor, the dimming and the band;
`cursorOffsetX`, `lineAlpha`, `lineFocus`, `findSystem` and `pageRowsAbove` stay internal.
`AppSettings.view` is a required field, and `CanvasPalette` gains the required `staffRgb` and
`bandAlpha`, so an embedder that builds either by hand adds them. Locales gain `viewPage` and `landscapePage`, and the `views` and `viewsKey`
tips name the page view.

## Consequences

- **Portrait gets a real reading layout**: on a phone, two or three played lines above the
  reading line and six to come, read ahead like print, with no rotation needed. In landscape
  (844 × 390) the anchor leaves room for about one played line, which is enough.
- **Memory is bounded by the stage area**, not its width: the active line, the played lines
  above it up to the anchor plus two, and the rows that fill the stage plus one. A
  three-hour session holds the same few lines.
- **Line widths move with the music.** A dense bar can take a line alone; at the default
  zoom the typical line holds two bars.
- **Relayout re-renders every kept bar.** A rotation, zoom or label change rasterizes about
  a dozen bars once, synchronously. That is acceptable for a user action; frames during
  play never re-break.
- **A lone overwide bar is compressed** ($j<1$), which can crowd its last note against the
  closing barline; it needs a manual zoom far above auto.
- **Ties across a line break** draw as two halves with the incoming arc's start estimated from
  the bar's natural predecessor, not the justified one at the end of the line above. The arc
  is clipped after the clef, so the difference is invisible.

## Tests

`tests/page.test.ts` (bars at `PAGE_DENSITY` of their squishy width; greedy breaking that never
overflows except a lone bar; closed lines filled exactly with continuous speed at each inner
barline; a lone overwide bar compressed; line starts and ties across a break; line distance from
the ink; the line playing at a beat; a scroll curve still between turns and C¹ across each break,
starting at the page top; reduced-motion cuts; played-line dimming; the active-line band; the
anchor a third down; and, in `MeasureBuffer`, the same music as the tape views, tiled justified
lines with stacked ys, the cursor on each onset, the cursor stopping at each closing barline (never past it, monotone, C¹ at the last onset, monotone on a compressed lone bar too), rows rendered one bar per step, eviction above
the active line, re-breaking for a new width, switching to and from the tape, and reset).
`renderAt.test.ts` (cursor and wash hidden with the playhead off, band kept), `zoom.test.ts` (two
bars across a phone line, 100% cap on a desktop), `orientation.test.ts` (the notice's Page view
button, hidden in page view), `storage.test.ts`, `tips.test.ts`.

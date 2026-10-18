# 0109. Squishy View: Per-Bar Width & Eased Scroll Speed

- **Status**: Accepted (adds a view beside SPEC §3 Metric Linearity, which stays the default)
- **Date**: 2026-10-18
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md), [0087](0087-rotating-tips.md), [0091](0091-jank-free-beat-and-measure-frames.md), [0103](0103-embeddable-engine-seams.md), [0104](0104-engine-entry-point.md)

## Context & Problem Statement

The staff has one layout: every bar is `beats × W_beat` wide, where
`W_beat = computeBeatWidth(subdivisions, ts, tuplets)` is the room the *densest enabled* value
needs (SPEC §3). With septuplets or 32nds on, a bar of two half notes is as wide as a bar of
the densest figure. Auto zoom fits that width, so on a phone the notation gets small even
though most bars hold nothing that dense.

The user asked for several **views** of the staff, switched by swiping sideways on the stage
like photo filters. The first new one, **Squishy**, makes each bar only as wide as its own
rhythm needs, and the scroll speed follows it. Two choices were agreed up front:

- the speed changes **eased over one felt beat**, never as a jump at a barline;
- squishy auto zoom fits the session's **typical** bar, not its widest.

Kept invariants: the audio clock is the only time source and a note still crosses the
playhead on its click; frames only blit; the ring buffer stays bounded; the generator is
untouched (same ergodicity, same random draws in both views); the steady view is
pixel-identical to before.

## Decision & Implementation

### 1. Views (`types.ts`)

`VIEW_MODES = ['steady', 'squishy']`, `ViewMode`, and the setting `view`, default `'steady'`.
`storage.ts` validates it with `pickEnum`. It is a personal display preference like zoom, so
exercise links (ADR 0085) do not carry it.

### 2. Body beat width (`spacing.ts`, `squishyBeatWidth`)

For a bar with notes $n_i$ of length $d_i$ metric beats:

$$w = \min\Big(W_{\text{lin}},\ \max_i \frac{W(n_i)}{\max(1, d_i)}\Big)$$

$W(n)$ is `computeBeatWidth` with only that note's base value on (a dot or a breve rides on
its base value), or for a tuplet member only its cell. The cell comes from the group: $k$
notes (`tupletNumNotes`) in the time of $m$ units (`tupletNotesOccupied`), the group lasting
$\sum d$ metric beats, so one unit is $\sum d / m$ metric beats, i.e. $\sum d / (m \cdot
\text{beatValue})$ of a whole: `'1/4' | '1/8' | '1/16'` (`tupletCell`). A note longer than a
beat spreads one beat's room over its length. `computeBeatWidth` is monotone over the enabled
options, so $w \le W_{\text{lin}}$; the cap only guards that. An empty bar gets $W_{\text{lin}}$.

### 3. Eased ramps (`beatX`, `spacingWidth`)

Speed must not jump where two bars of different body widths meet. The narrower side eases:
over its first felt beat a bar slows from the wider previous body width $e$ to its own $w$
(entry ramp), and over its last felt beat it speeds up to the wider next body width $x$ (exit
ramp). $r$ = `METER[ts].beatGroup` metric beats (1 in simple meters, 3 in compound, 2 in
half-note meters), $B$ = beats per bar, $o$ = offset in metric beats:

$$X(o) = 26 + w\,o + (e - w)\,E(o) + (x - w)\,F(o)$$

$$E(o) = \begin{cases} o - \frac{o^2}{2r} & o \le r \\ \frac{r}{2} & o > r \end{cases}
\qquad
F(o) = \begin{cases} 0 & o \le B - r \\ \frac{(o - B + r)^2}{2r} & o > B - r \end{cases}$$

$$\text{width} = wB + (e - w)\frac{r}{2} + (x - w)\frac{r}{2}$$

The velocity $X'(o)$ falls linearly from $e$ to $w$ and rises from $w$ to $x$, so at every
barline the exit speed of one bar equals the entry speed of the next (both are the wider body
width), and the position joins too ($X(B) = 26 + \text{width}$). A missing ramp drops its
term. $B \ge 2r$ in every meter, so the two ramps never overlap. Speeds stay between the two
body widths, never above $W_{\text{lin}}$. Without ramps `beatX` returns the old expression
`26 + o·w` exactly, which keeps steady pixel-identical. Offsets outside the bar extend the end
speeds, so the map is total and strictly increasing.

`spaceMeasure(data, prev, next, view, settings)` returns a new `MeasureData` with
`beatWidth`, `width` and the optional `entryBeatWidth` / `exitBeatWidth`; the notes are
shared, never copied. `prev` and `next` count only when they are the adjacent bars (index and
start beat). An incoming tie (`tieIn`) takes `prev`'s spacing, so both halves of a barline tie
still draw one curve. In steady it is `computeBeatWidth` and `beats × beatWidth`, as before.

### 4. Buffer (`buffer.ts`)

- **One bar of lookahead**: bar $n$'s exit ramp needs bar $n+1$'s notes, so the buffer
  generates $n+1$ before laying out $n$ and holds it as `pending`. The generator is still
  called once per bar, in order, so the music is identical in both views. `reset()` and the
  background-tab skip drop `pending`.
- **Coverage in pixels**: `ensureAhead` keeps its signature; its beat lookahead becomes tape
  pixels at $W_{\text{lin}}$ and it renders until the bars past the current beat cover them
  (`pixelsAhead`). A squishy beat is never wider than a linear one, so the stage is always
  covered and memory stays bounded by the screen area. `covers()` answers the idle check.
- **Eviction in pixels**: `evictLeftOf(beat, playheadX / zoom)` keeps bars back to the first
  whose right edge is on the stage, stopping at a gap in the tape. `evictBefore` stays for
  embedders.
- **View switch**: `rerender(settings)` lays the kept bars out again for a new view (each
  bar's next is the following kept bar, the last one's is `pending`), then re-rasters as
  before. The first kept bar has no laid-out predecessor, so it gets no entry ramp and its
  incoming tie keeps the old spacing until it scrolls off. It is behind the playhead.

### 5. Renderer and scroller

The renderer places each note at `beatX(data, ts, beatOffset)`; bar rests stay centred on
`data.width`. `tieAnchorRightX(offset, duration, spacing, ts)` takes a bar's spacing; the
number overload (a linear beat width) stays.

`draw()` / `renderAt(vb)` find the bar $k$ holding $vb$ and put its left barline at

$$x_k = \text{playheadX} - X_k(vb - \text{start}_k)\cdot\text{zoom}$$

so the tape point of $vb$ sits on the playhead whatever the spacing. The scroller walks left to
the first bar on the stage, then blits left to right, adding `width·zoom`, until the right
edge. In steady $X_k = 26 + (vb - \text{start}_k)\,w$, which is the old
`playheadX − 26·zoom + (start_k − vb)·w·zoom`. Nothing is allocated per frame. The clock is
unchanged: $vb$ still comes from `AudioContext.currentTime`, so on screen a beat takes the
same time and only covers a different distance.

### 6. Auto zoom

`fitZoom(viewportWidth, barWidth)` holds the old fit (`computeOptimalZoom` now calls it). In
squishy, auto zoom fits `typicalBarWidth(settings)`: the median width, ramps included, of 32
bars from a `MusicGenerator` seeded with `mulberry32(0x5eed)`, with pitch settings fixed to
the defaults. It depends only on meter, values, tuplets, rests and ties, and is memoised for
the last rhythm asked about.

### 7. Switching views

- **Swipe** on the stage canvas with one touch or pen pointer: it commits when $|dx| > 48$ px
  and $|dx| > 2|dy|$. Left goes to the next view, right to the previous, wrapping around. A
  second pointer makes it a pinch, which never switches. The canvas has
  `touch-action: pan-y` so a sideways drag reaches the page; pinch zoom still runs on touch
  events. It works playing or paused.
- **`V`** cycles the views (`Shift+V` backwards), listed in the shortcuts dialog.
- **Settings → Display → View**, a select beside Labels.
- **View pill**: after a swipe or `V`, a glass label with the view's name and page dots shows
  centred above the staff for 1.4 s. It is a Web Animation over `opacity` and `transform`
  only, so it never lays out the stage (ADR 0091). Its live region (`role="status"`)
  announces the name, and with reduced motion it fades without moving.
- **Tips** (ADR 0087): `views` teaches the swipe on touch screens, `viewsKey` the `V` key
  where only a keyboard is likely; both only while the view is steady.

### 8. Engine

`engine.ts` exports `beatX`, `spaceMeasure`, `spacingWidth`, `squishyBeatWidth`,
`tupletCell`, `typicalBarWidth` and `BeatSpacing`. The new `MeasureData` fields are optional,
so existing embedders are unaffected.

## Consequences

- **Speed varies with the music** in squishy: dense bars scroll faster, sparse bars slower, and
  the change takes one felt beat. Notes still land on the playhead on their clicks.
- **Gains depend on how rare the densest value is.** A bar is as wide as its densest note, so
  with sixteenths on, nearly every bar holds one and the typical bar equals the linear one;
  auto zoom then matches steady, and only sparser bars shrink. With septuplet sixteenths on
  the default rhythm, the typical 4/4 bar is 602 px against 1120 px, and auto zoom at 390 px
  goes from 30% to 50%. A per-beat width would squeeze more, but it is a different layout and
  is left to a later view.
- Steady output is unchanged; the existing frame-for-frame tests pass as they did.
- On a view switch, the bar already behind the playhead keeps its old incoming tie spacing
  until it leaves the stage.
- One extra bar of `MeasureData` (no canvas) is held ahead of the rendered ones.

## Tests

`tests/spacing.test.ts` (steady is bit-for-bit linear; squishy is never wider than linear;
position and velocity join at every barline in every meter; X strictly increases; half notes
are narrower than sixteenths; ramps only on the narrow side; tie spacing carries over; tuplet
cells; deterministic typical width). `buffer.test.ts` (same music in both views, matching
ramps, pixel coverage, re-layout on switch, pending dropped on reset, pixel eviction).
`renderAt.test.ts` (squishy tape on the playhead at every beat, bars edge to edge, a switch
mid-bar). `tieRender.test.ts` (ties on ramps), `zoom.test.ts`, `storage.test.ts`,
`tips.test.ts`.

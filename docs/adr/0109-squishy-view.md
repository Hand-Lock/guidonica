# 0109. Squishy View: Engraved Note Spacing & Continuous Scroll Speed

- **Status**: Accepted (adds a view beside SPEC §3 Metric Linearity, which stays the default)
- **Date**: 2026-10-18
- **Revised**: 2026-10-18, before release: the per-bar width (a bar as wide as its densest note, eased ramps between bars) was replaced by engraved per-note spacing. It kept time-linear spacing inside each bar, so a quarter beside sixteenths took a full sixteenth-beat of room, equal values took different room in different bars, and with sixteenths on nearly every bar held one, so the typical bar equalled the linear one and auto zoom equalled steady (80% in both at 844 × 390). It saved no room where the view exists to save it.
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md), [0087](0087-rotating-tips.md), [0091](0091-jank-free-beat-and-measure-frames.md), [0103](0103-embeddable-engine-seams.md), [0104](0104-engine-entry-point.md)

## Context & Problem Statement

The staff has one layout: every bar is `beats × W_beat` wide, where
`W_beat = computeBeatWidth(subdivisions, ts, tuplets)` is the room the *densest enabled* value
needs (SPEC §3). With septuplets or 32nds on, a bar of two half notes is as wide as a bar of
the densest figure. Auto zoom fits that width, so on a phone the notation gets small even
though most bars hold nothing that dense.

The user asked for several **views** of the staff, switched by swiping sideways on the stage
like photo filters. The first new one, **Squishy**, trades the steady scroll speed for
editorial width and spacing that saves room on small phones. Engraving practice (Gould,
*Behind Bars*; Ross, *The Art of Music Engraving*; Finale's spacing allotments; LilyPond's
spacing increment) lays music out by three rules:

1. **Each note gets space by its own duration, non-linearly**: each doubling of duration adds
   about ×√2 of space, not ×2. A half note gets about 1.4× a quarter's space.
2. **Equal durations get equal space** across the bars of a line.
3. **The shortest value gets the minimum comfortable space**, and longer values are scaled
   from it.

Two further choices were agreed up front:

- the speed is **continuous**: it may change at every note but never jumps, at a barline or
  anywhere else;
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

### 2. Engraved note space (`spacing.ts`, `noteSpace`, `shortestBeats`)

A note lasting $d$ metric beats (its `beatDuration`, exact for dots, tuplet members and tie
halves) gets

$$S(d) = \min\Big(s_{\min}\Big(\frac{d}{v_{\min}}\Big)^{p},\ W_{\text{lin}}\,d\Big), \qquad p = \texttt{SPACING\_EXPONENT} = 0.5$$

- $v_{\min}$ = `shortestBeats(settings, ts)`, the shortest duration the configuration can
  write, in metric beats: the minimum over the values of its rhythm grammar (`rhythmGrammar`,
  so the beat-unit fallback counts when the grammar adds it, and the quarter, or the eighth
  beat, when nothing is enabled) and one member of each supported tuplet cell,
  `tupletSpan(ts, name, value) / notes`.
- $W_{\text{lin}}$ = `computeBeatWidth(subdivisions, ts, tuplets)`, the steady beat width.
- $s_{\min} = W_{\text{lin}} \cdot \min(v_{\min}, 1)$: the steady view's clearance for that
  shortest value (16th 55 px, 8th 65, triplet 8th 55, septuplet 16th 40, 32nd 45), and never
  more than one linear beat when only long values are on (rule 3).

Each doubling multiplies the space by $2^{p} = \sqrt 2$ (rule 1), and $S$ depends on $d$ alone,
so equal durations get equal space in every bar (rule 2). For $d \ge v_{\min}$,
$S(d)/d = W_{\text{lin}}\min(v_{\min},1)/\sqrt{v_{\min}\,d} \le W_{\text{lin}}$, so no note is
wider per beat than in steady, and no bar wider than its steady width (coverage and memory
bounds hold); the `min` cap only binds below $v_{\min}$ (a rest
piece shorter than any written value), where it is the linear layout. A bar rest is one note
of length $B$. With sixteenths and triplet eighths on in 4/4, $s_{\min} = 55$ px:

| Value | 16th | triplet 8th | 8th | quarter | half | whole |
|---|---|---|---|---|---|---|
| Space (px) | 55 | 63.5 | 77.8 | 110 | 155.6 | 220 |

### 3. The speed curve (`beatX`, `SpacingKnots`)

A bar's **knots** are its note onsets $o_0 = 0 < o_1 < \dots < o_{n-1}$ plus the barline
$o_n = B$, at $x_i = 26 + \sum_{j<i} S(d_j)$; the bar's width is $\sum_j S(d_j)$. Between
knots, $X(o)$ is a **monotone cubic Hermite** with Fritsch–Butland slopes. With secants
$\delta_j = S(d_j)/d_j$ (px per beat):

- an interior knot takes $m_i = \dfrac{2\delta_{i-1}\delta_i}{\delta_{i-1} + \delta_i}$, the
  harmonic mean of its neighbouring secants;
- the bar's first knot uses the previous bar's last secant as $\delta_{-1}$, its barline knot
  the next bar's first secant as $\delta_n$. Both come from raw notes alone (the previous bar
  as laid out, the next as the buffer's `pending`), so the slope at bar $n$'s end is exactly
  the slope at bar $n+1$'s start and velocity is continuous across barlines;
- with no neighbour (the session's first bar, the first kept bar after a view switch) the end
  slope is one-sided, the bar's own end secant.

On a segment $[o_k, o_{k+1}]$, $h = o_{k+1} - o_k$, $t = (o - o_k)/h$:

$$X(o) = h_{00}(t)\,x_k + h_{10}(t)\,h\,m_k + h_{01}(t)\,x_{k+1} + h_{11}(t)\,h\,m_{k+1}$$

The harmonic mean is at most twice the smaller secant, inside the Fritsch–Carlson region
($m/\delta \le 3$), so $X$ is strictly increasing, and $X(o_i) = x_i$ exactly: every note
crosses the playhead on its click. Each note's mean speed, $\delta_j$, lies between the
longest note's $S(B)/B$ and $W_{\text{lin}}$. Inside a short note between long ones the cubic
briefly runs faster than its mean, since it must leave and reach slower neighbours at their
speed: measured over 200 bars per meter with sixteenths and triplet eighths on, the peak is
1.19–1.27 × $W_{\text{lin}}$. Bar widths, and so coverage, are unaffected. Offsets outside the
bar extend the end slopes, so the map is total.

`SpacingKnots = { offsets, xs, slopes }` (three `Float64Array`s) is built once at layout and
stored as `MeasureData.knots`. `beatX` finds the segment by binary search and evaluates the
cubic, allocating nothing; it runs every frame. Without knots it returns `26 + o·w` exactly,
which keeps steady pixel-identical.

`spaceMeasure(data, prev, next, view, settings)` returns a new `MeasureData` with `width`,
`knots` and `beatWidth` = width / B (the bar's mean, for the number overload of
`tieAnchorRightX` and for embedders); the notes are shared, never copied. `prev` and `next`
count only when they are the adjacent bars (index and start beat). An incoming tie (`tieIn`)
shares `prev`'s knots object by reference, so both halves of a barline tie still draw one
curve. In steady it is `computeBeatWidth` and `beats × beatWidth`, as before, with no knots.

### 4. Buffer (`buffer.ts`)

- **One bar of lookahead**: bar $n$'s barline slope needs bar $n+1$'s first note, so the buffer
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
  before. The first kept bar has no laid-out predecessor, so its entry slope is one-sided and
  its incoming tie keeps the old spacing until it scrolls off. It is behind the playhead.

### 5. Renderer and scroller

The renderer places each note at `beatX(data, beatOffset)`; bar rests stay centred on
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
squishy, auto zoom fits `typicalBarWidth(settings)`: the median width of 32
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

`engine.ts` exports `SPACING_EXPONENT`, `beatX`, `noteSpace`, `shortestBeats`,
`spaceMeasure`, `typicalBarWidth` and `BeatSpacing`; `SpacingKnots` comes with the types. The
new `MeasureData` field is optional, so existing embedders are unaffected.

## Consequences

- **Speed varies with every note** in squishy, within the range of the session's values: with
  sixteenths on in 4/4, a note's mean speed runs from 55 px per beat (a whole note) to 220
  (sixteenths), scaled by zoom, and the curve between them spans about 41–270. It never
  jumps: position and velocity are continuous everywhere, including barlines. Notes still land
  on the playhead on their clicks.
- **Real savings where the view is for.** Median bar width (32 seeded bars) and auto zoom,
  steady → squishy:

  | Rhythm | Linear bar | Typical squishy bar | Zoom at 390 px | Zoom at 844 px |
  |---|---|---|---|---|
  | 4/4 default | 520 | 314 | 60% → 90% | 100% → 100% |
  | 4/4 + 16ths | 880 | 464 | 40% → 70% | 80% → 100% |
  | 4/4 + 16ths + triplet 8ths | 880 | 455 | 40% → 70% | 80% → 100% |
  | 3/4 + 16ths | 660 | 367 | 50% → 80% | 100% → 100% |
  | 6/8 + 16ths | 660 | 400 | 50% → 70% | 100% → 100% |

- Equal values look equal wherever they fall, and long notes no longer leave the wide gaps of
  time-linear spacing, so the staff reads like printed music.
- Steady output is unchanged; the existing frame-for-frame tests pass as they did.
- On a view switch, the bar already behind the playhead keeps its old incoming tie spacing
  until it leaves the stage.
- One extra bar of `MeasureData` (no canvas) is held ahead of the rendered ones, and each
  squishy bar holds three small `Float64Array`s of knots.

## Tests

`tests/spacing.test.ts` (steady is bit-for-bit linear; √2 per doubling and the space table;
the shortest value at the steady clearance; `shortestBeats` per meter and tuplet cell; notes at
the sum of the spaces before them; equal durations equal in every bar; never wider per beat
than linear; position and velocity continuous at every barline and note, every meter; X
strictly increasing including extrapolation; one-sided ends; bar rests; shared tie knots;
deterministic typical width below the linear bar with sixteenths on). `buffer.test.ts` (same
music in both views, matching barline slopes, pixel coverage, re-layout on switch, pending
dropped on reset, pixel eviction). `renderAt.test.ts` (squishy tape on the playhead at every
beat, bars edge to edge, a switch mid-bar). `tieRender.test.ts` (ties on a knotted bar),
`zoom.test.ts` (squishy auto zoom above steady with sixteenths and triplets at 390 and 844 px),
`storage.test.ts`, `tips.test.ts`.

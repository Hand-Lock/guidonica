# 0103. Embeddable Engine Seams: Seeded Generation, Explicit-Time Drawing, Offline Audio, Sized Rendering

- **Status**: Accepted (2026-10-15; all four seams implemented)
- **Date**: 2026-10-15
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0065](0065-grammar-driven-rhythm-sampler.md), [0066](0066-ergodicity-audit-connected-pitch-start-rest-runs-tuplet-shapes.md), [0067](0067-contribution-licensing-dco-and-trademark-policy.md), [0070](0070-note-selection-and-level-progression.md), [0085](0085-shareable-exercise-links.md), [0089](0089-frame-locked-audio-clock.md), [0092](0092-drone.md), [0095](0095-output-soft-clipper.md)

## Context & Problem Statement

The engine can only be driven by the live app. Three inputs are fixed inside it:

- **Randomness**: the generator calls `Math.random()` directly, six times in
  `src/notation/generator.ts` (`pick`, rest runs, barline ties, the interval walk of ADR 0070,
  the step direction, tuplet placement) and once in `src/notation/ties.ts` (inner ties). A run
  cannot be repeated, so tests can check distributions but never an exact measure list.
- **Time**: the scroller reads its position from the metronome's audio clock inside the rAF loop
  (`Scroller.startLoop()` → `metronome.tick()` → `renderFrame()`, ADR 0089). A frame cannot be
  drawn for an arbitrary time.
- **Audio and size**: the click, drone (ADR 0092) and output stage (ADR 0095) are built on the
  realtime `AudioContext` and scheduled by the 25 ms timer, and the measure renderer takes its scale
  from the viewport and `window.devicePixelRatio`.

The paid builds that ADR 0067 describes, and deterministic tests, need to run the same engine
offline, reproducibly and at any size: render frame `n` of a fixed exercise, render its audio
faster than real time, draw a measure at print size. The paid features themselves stay out of this
repository (ADR 0067, AGENTS.md §3.7). This ADR only opens the engine's inputs, which the free
app's tests use too.

## Decision

Four seams. Each one is a parameter with a default equal to today's behaviour, so the free app runs
exactly as before and never passes anything new.

### 1. Seeded PRNG

- `src/notation/random.ts` exports `type Random = () => number` (uniform on `[0, 1)`) and
  `mulberry32(seed: number): Random`, a 32-bit generator of a few lines, enough for sampling and
  free of dependencies.
- `MusicGenerator` takes an optional `Random`, default `Math.random`, and passes it to every helper
  that draws (`pick`, the tie placement in `ties.ts`, tuplet member draws). Every `Math.random()`
  call in the generator path becomes `this.random()` or a `random` argument.
- **Draw order and probabilities are unchanged**: the same calls happen in the same order with the
  same thresholds and weights, only the source differs. The rhythm grammar (ADR 0065), the
  ergodicity guarantees (ADR 0066) and the interval walk (ADR 0070) are untouched, and every
  configuration keeps `P(ω) > 0` for every valid `ω` (AGENTS.md §1).
- **The free app stays unseeded.** It never constructs a seeded generator, and a shared link
  carries no seed (ADR 0085, SPEC: "the generator is never seeded"). Two students who open the same
  link still read different music. A reproducible sequence remains outside the free app.

**Implemented (2026-10-15).** The final signatures:

- `new MusicGenerator(random: Random = Math.random)`, kept as a private readonly field. The default
  is read at construction, so a page that patches `Math.random` before the generator exists (the
  banner captures of `scripts/build-banners.mjs`, ADR 0079) still drives it; `resetPitch()` keeps the
  source.
- Internal helpers take the source as a **required** argument, so no draw can silently fall back
  to `Math.random`: `pick(items, random)`, `startFrom(choices, clef, steps, random)`.
- Exported helpers take it as an **optional trailing** argument, default `Math.random`, so existing
  callers and tests are unchanged: `drawTupletMembers(n, value, values, random?)`,
  `startIndex(intervals, clef, steps, random?)` and `applyTies(items, ts, random?)` in `ties.ts`.
- Inside the class every draw goes through `this.random`: the rest chain, the barline tie, the
  interval weight, the step direction, the rhythm step, the tuplet group and member draws, the
  9+ leap, the start pitch and the inner ties. `src/main.ts` and `src/notation/preview.ts` still
  call `new MusicGenerator()`.
- `tests/random.test.ts` checks `mulberry32`, then, over every meter and clef at the defaults and
  with rests, ties, dotted values, every tuplet, every interval including 9+ and a pitch-class
  subset on: with `Math.random` mocked to throw, a seeded generator never calls it (no leak); the
  same seed repeats the measure list and another seed does not; and a seeded generator equals the
  default one with `Math.random` mocked to the same stream, so the draw order is unchanged. A
  one-off dump of 3 seeds × 192 configurations × 40 bars, before and after the refactor, was
  byte-identical.

### 2. Drawing at an explicit time

- The scroller splits "position at time `t` → blit the visible measures" from the loop that
  chooses `t`. `renderFrame()` keeps reading the frame-locked clock of ADR 0089; a new
  `renderAt(visualBeat)` (name settled at implementation) draws the same frame for a given beat.
- A caller can draw frame `n` at `t = n / fps` and convert it to a beat with the tempo. The pixel
  math is the one ADR 0089 already uses, with the clock source swapped: no second formula.
- Measure building stays as it is: idle-time rasterization (ADR 0091) for the live loop, and a
  synchronous fill when the stage would otherwise be uncovered, which an offline caller hits on
  every frame.

**Implemented (2026-10-15).** The final shape, in `src/scroller/scroller.ts`:

- The old `renderFrame` body is now `private draw(visualBeat, settings, live)`, unchanged except
  that the beat is an argument and two steps run only when `live`: queueing idle VexFlow work
  (ADR 0091) and the `onFrame` hook that drives the beat indicator.
- `renderFrame(settings?)` keeps its signature and is
  `draw(metronome.getVisualBeat(), settings ?? getSettings(), true)`, so the rAF loop, the resize
  path and `src/main.ts` make the same calls in the same order as before. The idle callback still
  reads `getVisualBeat()`: it only exists in the live loop.
- `renderAt(visualBeat, settings?)` is `draw(…, false)`: it never reads the metronome, never
  schedules idle work and never fires `onFrame`. The frame's own `ensureAhead(beat, edge + 1)`
  renders synchronously whatever the stage needs. Beats must not decrease between calls, because
  measures behind the playhead are evicted; `buffer.reset()` starts over.
- `secondsPerBeat(tempo, ts)` in `src/notation/types.ts`, `(60 / tempo) · METER[ts].secondsPerBeatFactor`,
  replaces the metronome's inline formula. An offline caller converts `t` with the same code the
  clock uses: `beat = max(0, t / secondsPerBeat(tempo, ts) - countInBeats)`, as `getVisualBeat` does.
- `tests/renderAt.test.ts` records every 2D context call. For 4/4, 6/8 and 3/2 at three zooms, two
  scrollers on seeded generators (seam 1) draw a rising beat sequence to 40 beats, one with
  `renderFrame()` on a stub clock, one with `renderAt(beat)` on a metronome that throws: the call
  lists are equal. `renderAt` never fires `onFrame` or `requestIdleCallback`, still covers the
  stage plus one beat, and keeps the buffer bounded. A measure drawn at its own `startBeat` lands
  at `playheadX - NOTE_START_OFFSET · zoom`. `secondsPerBeat` is checked per meter family.

### 3. Audio into any `BaseAudioContext`

- The click synthesis in `src/audio/metronome.ts`, the drone (`src/audio/drone.ts`) and the
  soft clipper (`src/audio/output.ts`) build their nodes into a `BaseAudioContext` they are given,
  instead of assuming the realtime context.
- The click voice gets a function that schedules a list of `{ time, accent }` clicks directly, with
  no timer. An `OfflineAudioContext` can then render a whole exercise in one call.
- The live path is unchanged: one realtime `AudioContext`, resumed only inside a user gesture
  (AGENTS.md §3.3), and the 25 ms scheduler queuing clicks 100 ms ahead of `currentTime`.

**Implemented (2026-10-15).** The drone and the soft clipper already took a `BaseAudioContext`;
what assumed the realtime context lived inside `MetronomeEngine` and moved out:

- `src/audio/click.ts`:
  - `clickAccent(ts, pulse, beatNumber): BeatAccent | null` is the scheduler's rule, moved
    verbatim: `null` unless `pulse === 'division'` or `(beatNumber - 1) % METER[ts].beatGroup === 0`,
    else `beatAccent(ts, beatNumber)`.
  - `scheduleClick(ctx, out, time, accent, profile)` is the former private method, unchanged
    except that it feeds `out` instead of the metronome's click gain: woodblock sweep or triangle,
    envelopes, `start`/`stop`, `onended` disposal. Scalar arguments, so the live scheduler
    allocates nothing per click. It never reads `ctx.currentTime`.
  - `scheduleClicks(ctx, out, clicks, profile)` loops it over `Click[] = { time, accent }[]`,
    with no timer.
  - `clickTrack({ tempo, timeSignature, pulse, countIn, beats, startTime = 0 })` is the
    scheduler's beat walk as a list. With `spb = secondsPerBeat(tempo, ts)` (seam 2) and
    `countInBeats = countIn ? beatsPerMeasure : 0`, beat `k < countInBeats + beats` is at
    `startTime + k·spb` and has beat number `(k − countInBeats if past the count-in) mod
    beatsPerMeasure + 1`; it is kept when `clickAccent` is non-null. Measure 0 starts at
    `startTime + countInBeats·spb`, matching seam 2's `beat = t / spb − countInBeats`. Times are
    multiplied, not accumulated as in the live loop, so long offline tracks carry no float drift.
- `createMixer(ctx): { click, drone }` in `src/audio/output.ts` builds the click gain, the drone
  gain and `createOutputStage(ctx)`, and connects both gains to it: today's graph, creation order
  and connections, shared by both paths (ADR 0095).
- `MetronomeEngine` keeps everything realtime: `unlock`/`resume` in gestures, latency, the
  frame-locked clock, interruptions, gain changes on pause and stop, and the 25 ms `setInterval`
  scheduler. `ensureAudioContext()` calls `createMixer`, and `scheduler()` calls
  `clickAccent` and `scheduleClick(this.ctx, this.masterGainNode, …)`: the same nodes, parameter
  calls and order as before. `metronome.ts` no longer creates an oscillator itself.

An offline render of a whole exercise:

```ts
const ctx = new OfflineAudioContext(2, Math.ceil((end + 1.2) * 48000), 48000);
const mix = createMixer(ctx);
mix.click.gain.value = volume;
mix.drone.gain.value = droneVolume;
const startTime = 0.05;
scheduleClicks(ctx, mix.click, clickTrack({ tempo, timeSignature, pulse, countIn, beats, startTime }), profile);
createDroneVoice(ctx, mix.drone, droneSound, droneNote, startTime, referencePitch).release(end);
const buffer = await ctx.startRendering();
```

Tests, `tests/click.test.ts`, on a recording mock context whose `currentTime` throws:
`clickAccent` equals the old inline rule for every meter and pulse (12/8 beat pulse clicks 1, 4,
7, 10; 4/2 clicks 1, 3, 5, 7); `clickTrack` gives 4/4 at 60 with count-in and 8 beats as 12 clicks
at 0…11 s, primary on 0, 4, 8, and 6/8 on the beat pulse every 1.5 s, with `startTime + k·spb`
exact; every click starts at its time, stops 30 ms (woodblock) or 40 ms (triangle) later, starts
at 1600/1350/1100 Hz or 1300/1050/800 Hz and ends in `out`; `createMixer` meets both gains in the
stage input before the shaper and `destination`. **Live = offline**: a `MetronomeEngine` on a mock
realtime context, started at `currentTime = 10` and driven by fake 25 ms timers for 24 s, queues
the same `(start time, start frequency, envelope level)` list as
`scheduleClicks(clickTrack({ …, startTime: 10.05 }))` up to its 100 ms horizon (times within
1e-9), for 4/4, 6/8 and 4/2 × both pulses × both profiles × count-in on and off, at 77 BPM so no
beat falls on a wake-up boundary. `tests/metronome.test.ts`, `tests/drone.test.ts` and
`tests/output.test.ts` pass unchanged.

Real render, by hand in Chromium 153 through run-guidonica on the dev server (happy-dom has no
`OfflineAudioContext`, and a Node Web Audio dependency is not worth one check): 4/4 at 120 with
count-in, 2 bars, `startTime` 0.1, 48 kHz mono, click and drone gains at 1. Onsets (first sample
with |x| > 1e-3 after ≥ 20 ms of silence) minus `round(time × 48000)`:

| Render | Clicks / onsets | Δ (samples) | Peak |
|---|---|---|---|
| woodblock | 12 / 12 | 1 on 11 clicks, 2 on one | 0.828 |
| triangle | 12 / 12 | 1 on 11 clicks, 2 on one | 0.853 |
| woodblock + shruti on C, full drone volume | 12 | | 0.979 |
| triangle + shruti on C, full drone volume | 12 | | 0.929 |

Every Δ is within one 128-sample render quantum (0 ≤ Δ < 128): the oscillator starts on the first
sample at or after its time, and a sine or triangle starts at zero phase, so its first sample under
the threshold adds one. The click at 1.1 s adds another: 1.1 × 48000 is a hair above 52800 in
floating point, so it starts on sample 52801. Peaks stay under full scale with the drone through the soft clipper.

### 4. Sized and SVG rendering

- The measure renderer takes its target height, scale and pixel ratio as parameters instead of
  reading the viewport and `window.devicePixelRatio`. The scroller passes the values it reads
  today.
- It can also render a measure through VexFlow's SVG backend (`Renderer.Backends.SVG`) next to the
  offscreen canvas, with the same layout code and the same subset music font (ADR 0058). The live
  app keeps blitting canvases (AGENTS.md §1).

**Implemented (2026-10-15).** In `src/notation/renderer.ts` and `src/scroller/scroller.ts`:

- **Constructor.** `new MeasureRenderer({ dpr?, zoom? } = {})`. `dpr` is clamped to ≥ 1 and not
  above; `window.devicePixelRatio` is read only when it is left out. `zoom` goes through the
  existing `setZoom` clamp. `setDpr`/`setZoom` are unchanged, and `src/main.ts` and
  `src/notation/preview.ts` still call `new MeasureRenderer()` and set the ratio themselves.
- **No target-height input** (changed from the plan above). All geometry is in
  `MEASURE_CANVAS_HEIGHT` (220) units, and a measure canvas is `220 · zoom · dpr` pixels tall, so
  a caller reaches any pixel height through `dpr` (e.g. `dpr = 1080 / 220` at zoom 1). A separate
  height would only be a third name for the same factor. `zoom` stays clamped to the app's
  0.3–1.5, since it also sets the on-screen size of the live stage.
- **Backend-free drawing.** `private drawMeasure(ctx: RenderContext, data, theme)` holds the old
  body, from `setFillStyle`/`setStrokeStyle` to the cross-barline ties, unchanged and in the same
  order; it returns the stave notes, tuplets and tuplet locations. `drawPinnedClef(ctx, …)` is
  the header's equivalent.
- **Labels.** The old `drawSolfegeLabels` is now the pure, exported
  `solfegeLabelPlacements(data, staveNotes, tupletByNote, tupletLocations, labels): { text, x, y }[]`,
  with the same anchor, tuplet clearance (ADR 0041, 0057) and margin clamp. `renderMeasure` keeps
  the old raw 2D block (`save`, `fillStyle`, `font`, `textAlign center`, `textBaseline middle`,
  one `fillText` per placement, `restore`) under the same `dpr · zoom` transform (ADR 0042).
- **SVG.** `renderMeasureSvg(data, theme, labels): RenderedMeasureSvg` (`{ data, svg, width,
  height }`, in `types.ts`) and `renderPinnedClefSvg(clef, ts, theme, meterSigns): SVGSVGElement`
  build an `SVGContext` on a detached `<div>`, `resize(width · zoom, 220 · zoom)` and set the
  viewBox to `0 0 width 220` directly (not through `scale(zoom)`, since `width · zoom / zoom` need
  not round-trip), then call the same draw function. Labels are `<text>` with
  `text-anchor="middle"`, `dominant-baseline="middle"`, Alegreya Sans 700 11 px and the palette's
  solfège colour, at coordinates rounded to 3 places like VexFlow's. `overflow="hidden"` clips a
  cross-barline tie half as the canvas edge does. The `<svg>` is detached before it is returned.
  The SVG path never reads the pixel ratio. VexFlow measures text on its own static canvas
  whatever the backend, so both lay out identically, and `vexflow/core` already contains
  `SVGContext`: the build's VexFlow chunk is unchanged (93.29 kB gzipped), the app chunk grows
  from 42.46 to 42.95 kB.
- **Fonts.** Glyphs are `<text>` in the inherited `font-family="Guidonica Notation"`. Inline in the
  page, they use the registered subset face (ADR 0058). A standalone `.svg` file has no access to
  it: an exporter must add an `@font-face` with the subset woff2 (and the text fonts for labels).
  Nothing new ships for that here.
- **Fixed scroller viewport.** `new ScrollerView(…, getSettings, { viewport?: { width, height,
  dpr } })`. With it, `updateDimensions()` takes the size and ratio from the option instead of the
  window and the parent's content box; the 300 × 220 minimums, the playhead, the staff geometry
  and `renderer.setDpr` are unchanged, and the constructor registers no ResizeObserver and no
  window listener. Without it, nothing changes. This makes seam 2's `renderAt` independent of the
  browser window, so seams 2 and 4 compose: frame `n` at any size.

Tests: `tests/svgRender.test.ts` renders seeded measures (seam 1) for 4/4, 6/8, 3/2 and 12/8 ×
treble and bass, with ties, dotted values, rests, every tuplet the meter allows and labels on.
The canvas `fillText` list (glyphs, tuplet digits and labels, in order) equals the SVG `<text>`
list within 1e-3; the SVG's `width`/`height` are `width · zoom`/`220 · zoom` with viewBox
`0 0 width 220` and hidden overflow; glyphs inherit the music font and labels are centred bold
Alegreya Sans; renderers at dpr 1 and 3 give the same SVG (ids aside); and the pinned header's
SVG draws the same glyphs as its canvas, with and without the C and ¢ signs. With
`window.devicePixelRatio` throwing, `{ dpr: 2, zoom: 1.5 }` sizes canvases to
`floor(width · 3) × floor(220 · 3)`, and `dpr = 1080 / 220` gives a 1080-pixel measure; without
options the window's ratio is used. In `tests/renderAt.test.ts`, a fixed 1920 × 1080 viewport
ignores a parent of 1000 × 500, puts the playhead at `round(1920 · 0.22)`, hands the renderer dpr 1
and registers no listener or observer; a fixed 640 × 360 at dpr 3 gives a 1920 × 1080 canvas; and
`renderAt` on a fixed 1000 × 500 viewport draws exactly the calls of a window-sized one, for three
meters and zooms. The other render suites pass unchanged.

A one-off dump of every 2D call and property write (labels on, dpr 2, zoom 1.2) over 3 seeds × 12
meters × 4 clefs × 8 bars, plus two pinned headers per combination, was byte-identical before and
after the refactor (1,065,481 calls). By hand in Chromium 153 through run-guidonica, the same seeded
4/4, 6/8 and 3/2 measures and headers drawn as canvas and as inline SVG were visually identical,
with every glyph in the music font, and the live app played, zoomed and paused with no console
errors.

## Implementation Order

Seams 1 → 4, one commit each with its tests, each recorded under `Internal` in `CHANGELOG.md`.
When the last one lands, this ADR becomes Accepted and records any detail that changed during
implementation.

## Verification

- **Seed**: the same seed gives an identical measure list (durations, pitches, ties, rests,
  tuplets) for every clef and meter; different seeds give different lists.
- **Ergodicity**: the distribution tests in the existing generator suites pass unchanged with the
  default source and with a seeded one.
- **Explicit time**: drawing at an explicit beat produces the same canvas as the live frame for the
  same position.
- **Offline audio**: an `OfflineAudioContext` render places each click onset at
  `round(time × sampleRate)` samples, within one render quantum, and the soft clipper keeps the
  peak under full scale.
- **Live app**: `pnpm typecheck && pnpm test`, and a run-guidonica pass shows playback, the drone
  and zoom unchanged.

## Consequences

**Positive:**
- Deterministic tests: an exact measure list can be pinned, and frames and audio can be compared
  against known outputs.
- The engine can be embedded by the paid builds of ADR 0067 as a dependency, without a fork that
  drifts from the free app.
- Clearer boundaries: the scroller's clock, the audio context and the render size become explicit
  inputs.

**Negative:**
- More parameters on the generator, scroller, renderer and audio constructors, and defaults that
  must stay equal to today's behaviour.
- A free fork can seed the generator too. That is fine: the engine is AGPL, and what stays outside
  the free app is the product built on it, not the PRNG.

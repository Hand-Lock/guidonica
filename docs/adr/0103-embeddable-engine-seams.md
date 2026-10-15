# 0103. Embeddable Engine Seams: Seeded Generation, Explicit-Time Drawing, Offline Audio, Sized Rendering

- **Status**: Proposed (seams 1–2 implemented 2026-10-15; becomes Accepted when all four are)
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

### 4. Sized and SVG rendering

- The measure renderer takes its target height, scale and pixel ratio as parameters instead of
  reading the viewport and `window.devicePixelRatio`. The scroller passes the values it reads
  today.
- It can also render a measure through VexFlow's SVG backend (`Renderer.Backends.SVG`) next to the
  offscreen canvas, with the same layout code and the same subset music font (ADR 0058). The live
  app keeps blitting canvases (AGENTS.md §1).

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

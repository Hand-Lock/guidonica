# 0091. Jank-Free Beat and Measure Frames

- **Status**: Accepted (follows [0089](0089-frame-locked-audio-clock.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

After [ADR 0089](0089-frame-locked-audio-clock.md) smoothed the audio clock's staircase, the staff still hitched slightly on every metronome click. The hitch grew with the tempo and the refresh rate. Guidonica must stay smooth up to 144 Hz, where a frame has a 6.9 ms budget.

A profile in headless Chromium at 200 BPM, 1440×900 @2x, with the frame-rate cap removed so that each frame interval equals its cost, gave:

| Frame | Mean cost |
|---|---|
| Ordinary frame | 0.75 ms |
| Frame with a beat change | 4.2 ms (max 16.6) |
| Frame that renders a new measure | 3.3–3.6 ms |

The trace showed two kinds of main-thread work inside the animation frame:

- **Beat frames.** `syncBeatIndicator` → `globalState.setBeat` → `syncUI` rewrote the Play button's `textContent` on every beat, even when the text was unchanged, which forced a full Layout (about 0.45 ms). The LEDs then switched `background` and a multi-layer `box-shadow` glow, with a `box-shadow` transition, so the header was repainted on every frame for about 80 ms after each beat: Paint 2 × 0.6 ms, plus PrePaint, Layerize and Commit. `highlightBeatDot` also ran two `querySelector` calls per beat.
- **Measure frames.** `ScrollerView.renderFrame` called `MeasureBuffer.ensureAhead` synchronously, so VexFlow layout and rasterization of a new measure ran inside the rAF callback. At high tempo that happens about once a second.

There were also per-frame allocations: `isSystemDark()` called `window.matchMedia(...)` on every frame through `resolveTheme`, and every frame built two `CanvasGradient`s and seven template strings.

## Decision

Every frame should only blit. Beats change compositor properties only, and VexFlow runs between frames.

### 1. Compositor-only beat LEDs (`src/style.css`, `src/main.ts`)

- **Static accent per LED.** `renderBeatDots(ts)` gives each LED its fixed accent class once, from `beatAccent(ts, i)`: `downbeat`, `secondary` or none. Accents depend only on position in the bar, so a beat only toggles `.active`.
- **The lit gem is a pre-painted `::after` layer.** The LED body (`.beat-dot`) is static: the unlit gradient and inset shadow, never transitioned. Its `::after` (`inset: 0`, `z-index: 1`) holds the lit gradient and glow for that LED's accent, with `opacity: 0` and `will-change: transform, opacity`. `.beat-dot.active::after` sets `opacity: 1` and the scale: 1.28 weak, 1.35 secondary, 1.42 downbeat. The gem lights at once, as the old background switch did. It scales in, and fades and shrinks out over 80 ms (`ease-out`). Glow and gradient are painted once into the layer. A beat changes only `opacity` and `transform`, so there is no Layout and no Paint.
- **One animated node per LED.** A variant that scaled the body and faded the `::after` separately cost 52 ms of `UpdateLayoutTree` in 9 s of playback, against 32 ms for the single animated `::after`. That is because Blink still recalculates style for running transitions on every frame, and each extra animated node adds to it.
- **`z-index: 1` on the gem** keeps the old stacking. Before, the lit LED was transformed, so it painted after its unpositioned siblings and its glow spilled over the next LEDs. Now every `.beat-dot` is `position: relative` and paints in DOM order, so without it the off LED after a lit one would show crisply through the glow. The value is static and never changes on a beat.
- **`highlightBeatDot(beatNumber)`** keeps the array of LEDs built by `renderBeatDots` and a reference to the lit one (`litBeatDot`). A beat is two `classList` calls, with no DOM queries. `resetBeatDots` clears the reference.
- **Idempotent `syncUI`.** It still runs on every `setBeat`, but writes the Play button's label only when the text differs (compared as text, so a language switch still updates it). It toggles `.playing` only when `playbackState` changes and the count-in badge only when `isCountIn` changes.

### 2. VexFlow out of the animation frame (`src/scroller/buffer.ts`, `src/scroller/scroller.ts`)

- **`ensureAhead(beat, lookahead, settings, maxMeasures = Infinity): boolean`** renders at most `maxMeasures` measures and returns whether the buffer still falls short of its target (false while the music font is not ready, so callers never spin). `getEndBeat()` exposes where the buffer ends. The background-tab skip logic is unchanged.
- **Two lookaheads in `renderFrame`**, with `E` = beats from the playhead to the right edge = `(viewportWidth − playheadX) / (beatWidth · zoom)`:
  - **In the frame** (`FRAME_LOOKAHEAD_BEATS` = 1): `ensureAhead(beat, E + 1)`. A measure appears on screen once `startBeat − beat ≤ E + NOTE_START_OFFSET / beatWidth`, and `NOTE_START_OFFSET` (26 px) is less than one beat, so `E + 1` covers the stage. In steady state this does nothing. It only renders when idle work fell behind, so the stage is never blank.
  - **Between frames** (`IDLE_LOOKAHEAD_BEATS` = 6, the old lookahead): if `getEndBeat() < beat + E + 6`, `scheduleIdleRender()`.
- **`scheduleIdleRender()`** keeps at most one pending callback. It uses `requestIdleCallback(cb, { timeout: 200 })`, or `setTimeout(cb, 0)` where it is missing (Safari). The callback reads the settings and `metronome.getVisualBeat()` afresh, renders one measure (`maxMeasures = 1`), and reschedules while the buffer is still short. `stopLoop()`, and so `destroy()`, cancel the pending callback.
- **Why a timeout is allowed here.** [`AGENTS.md`](../../AGENTS.md) §1 forbids timers as clocks. This fallback only decides *when* to do work. It never measures time, and every position still comes from `metronome.getVisualBeat()`. It follows the same rule as the metronome's 25 ms scheduler wake-up.
- `resetBuffer()` in `main.ts` (`ensureAhead(initialBeat, 16)` on start and reset) stays synchronous. It runs before motion begins.

### 3. No per-frame allocations (`src/notation/types.ts`, `src/scroller/scroller.ts`)

- `isSystemDark()` creates its `MediaQueryList` once and polls `.matches`, which stays live as the OS theme changes.
- `ScrollerView` caches the playhead glow and pinned-header fade gradients together with the palette they were built for. `updateDimensions()` (size, dpr, zoom, playhead x) and `invalidatePinnedClef()` (theme, solfège, reset) drop them, and so does a palette change. `CanvasGradient` coordinates are in user space and the `dpr` scale is applied when filling, so a cached gradient stays valid across frames.

## Consequences

Measurements are in headless Chromium at 200 BPM, 1440×900 @2x, capped at 60 Hz, over 9 s of playback, taken interleaved with the previous code (`git stash`) to cancel machine load:

| Main thread, per rAF task | Before | After |
|---|---|---|
| p99 | 5.0–6.2 ms | 3.2–3.7 ms |
| max | 5.9–7.5 ms | 3.7–4.4 ms |
| tasks over 4 ms | 31–32 | 0–1 |
| `FireAnimationFrame` max | 5.3 ms | 1.6–2.1 ms |
| Paint events | 292 | 30 (start-up only: the Play button turns amber) |
| Layout events | 60 | 2 |

- No beat frame lays out or paints. New measures render in idle callbacks of up to about 4 ms each, between frames.
- With the LEDs hidden, a beat frame costs the same as an ordinary one, so the state fan-out and `syncUI` are now free. What remains on a beat is starting the LED transitions: a style recalculation and a layer-tree update (about 1 ms in headless software rendering), plus about 0.15 ms of style ticking per frame while the 80 ms transitions run. Dropping the transitions would roughly halve it. They stay, because they are part of the LED look.
- Wall-clock frame intervals with the cap removed hardly moved in headless Chromium. Without a GPU that number is set by software raster and compositing, and idle callbacks can only run on their 200 ms timeout. The main-thread trace is the meaningful measure: it is what blocks the next frame on a real display.
- The look is unchanged. Screenshots of 4/4, 6/8 and 12/8 in light and dark themes, with a downbeat, a secondary and a weak beat lit, match the previous build, including the glow spilling over the next LEDs.
- Not covered: a compositor or GPU bottleneck on the user's machine, and Firefox's own transition and paint behaviour. Check with the browser's frame rendering stats if a hitch remains.

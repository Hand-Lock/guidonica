# 0089. Frame-Locked Audio Clock

- **Status**: Accepted (amends [0039](0039-repository-audit-ergodicity-and-clock-unification.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A user on a 144 Hz desktop with Firefox on Windows 10 reported very stuttery scrolling notation.

Every frame, the scroller read its position straight from the audio clock: `renderFrame()` → `metronome.getVisualBeat()` → `audibleTime()` = `AudioContext.currentTime − λ`. That clock is accurate, but it moves in steps:

- In Firefox, `AudioContext::CurrentTime()` returns `track->GetCurrentTime()`, the main thread's copy of the graph time. `MediaTrackGraphImpl::PrepareUpdatesToMainThreadState` refreshes it once per audio-graph iteration, that is once per audio-device callback (about 10 ms with WASAPI on Windows). The update reaches the main thread as a posted runnable, so its arrival is not aligned with vsync either.
- At 144 Hz a frame lasts 6.94 ms. Between two frames the clock moves 0 or 10 ms, and 20 ms when a runnable lands late. The notation stands still on some frames and jumps a double step on others: judder. It gets worse as the refresh rate rises and the callback period grows. Chrome on Windows shows the same 10 ms bursts. Macs with short CoreAudio buffers hide it, which is why it never showed up in development.
- `getOutputTimestamp()` does not help: in Firefox (`AudioContext.cpp`, `GetOutputTimestamp`) it pairs the same stepped `CurrentTime() − OutputLatency()` with a `performance.now()` taken at call time.

[ADR 0007](0007-comprehensive-system-audit-and-optimizations.md) removed the integer-pixel rounding judder. This is the remaining temporal judder, one level down.

## Decision

Keep the audio clock as the only source of position, but stop showing its staircase. The rAF timestamp interpolates between the audio clock's coarse ticks, and the result is continuously pulled back to the audio clock: a first-order phase-locked loop.

### `MetronomeEngine.tick(frameTimeMs)`

Called once per rAF frame by `Scroller.startLoop()`, before `renderFrame()`, with the rAF timestamp. It does nothing when stopped or paused.

```
raw = audibleTime()                       // currentTime − λ
if frameClock === null: frameClock = raw  // first frame after start/resume/stop
else:
  dt        = max(0, (frameTimeMs − lastFrameMs) / 1000)
  predicted = frameClock + dt
  err       = raw − predicted
  frameClock = |err| > SNAP ? raw
             : predicted + err · (1 − e^(−dt/τ))
lastFrameMs = frameTimeMs
```

- **τ = `CLOCK_SMOOTHING_SECONDS` = 0.1 s.** The correction factor `1 − e^(−dt/τ)` makes the loop independent of the frame rate: two 72 Hz frames pull exactly as much as one 36 Hz frame. τ is ten times the coarsest common callback period, so a single step is spread over many frames, and short enough that a real tempo or latency change settles in about 0.3 s.
- **Snap = `CLOCK_SNAP_SECONDS` = 0.25 s.** Above any plausible clock step: Firefox with `privacy.resistFingerprinting` clamps time to as much as 100 ms. Only a real discontinuity (a stalled and recovered device, a long frame gap) adopts the raw clock at once.
- **`clockTime()`** returns `frameClock ?? audibleTime()`. `getElapsedPlaybackSeconds()` reads it, so `getVisualBeat()`, `getBeatInfo()` (beat LEDs), the `pause()` snapshot and `setTempo()` all see the time already on screen. Pausing freezes on exactly the displayed frame. Without any `tick()` (tests, idle), the engine behaves exactly as before.
- **Re-anchoring.** `setTempo()` re-anchors `measureZeroStartTime` on `clockTime()`, so a tempo change is visually continuous. The anchor carries the momentary filter error (under one clock step) into the click grid, which is inaudible. `resume()` anchors on the raw `audibleTime()` and resets `frameClock`, so the first frame after it snaps to the raw clock, which is continuous by construction. `start()` and `stop()` reset `frameClock` too.
- **Audio is untouched.** `scheduler()` and `scheduleClick()` stay in raw context time.

### Why not alternatives

- **`getOutputTimestamp()`**: stepped in Firefox, as above.
- **Pure frame-time accumulation** (`position += dt`): drifts from the audio clock without bound and breaks the single-clock rule.
- **Linear regression over recent `(performance.now(), currentTime)` pairs**: more state for no gain, since both clocks run at the same rate to within about 100 ppm.

## Consequences

- Scrolling is smooth at any refresh rate and callback size. In a 144 Hz simulation over a 10 ms staircase, the raw per-frame advance swings between 0 and 10 ms while the filtered one stays within ±0.33 ms of the frame interval (0.03 px at 100 px/s).
- The error is bounded and does not drift: the displayed time stays within 0.5 ms of the staircase's mean. A clock-rate mismatch of 100 ppm leaves about 7 µs of steady error (`τ · 10⁻⁴`). The average lag behind the true audible time is the same as the staircase's mean today (half a callback period).
- The residual jitter is the staircase filtered by a first-order low-pass with a 1.6 Hz cutoff (`1 / 2πτ`): sub-pixel.
- The rAF timestamp becomes a second input, but only as an interpolator. Position is never accumulated independently of the audio clock. [`AGENTS.md`](../../AGENTS.md) §1 and [`SPEC.md`](../../SPEC.md) §5 state this.
- If stutter remains on a given machine, the next suspects are `privacy.resistFingerprinting` (100 ms steps, as long as τ, which the filter can only partly hide), the compositor, or synchronous measure rendering inside a frame (stutter once per bar).

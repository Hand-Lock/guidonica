# 0098. Low Power Mode Frame-Rate Notice

- **Status**: Accepted (follows [0089](0089-frame-locked-audio-clock.md) and [0091](0091-jank-free-beat-and-measure-frames.md))
- **Date**: 2026-10-12
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

On an iPhone with Low Power Mode on, the scrolling staff is not smooth.

- **Cause.** WebKit limits `requestAnimationFrame` to 30 fps in Low Power Mode. Since iOS 14 it does this on purpose by running the `DisplayRefreshMonitor` at 30 fps ([WebKit bug 215745](https://bugs.webkit.org/show_bug.cgi?id=215745), [WebKit bug 202269](https://bugs.webkit.org/show_bug.cgi?id=202269)). macOS Safari does the same in Low Power Mode, Chrome's battery saver also caps frames at 30 fps, and WebKit throttles a thermally stressed device the same way.
- **Why it shows.** The staff only moves when the rAF loop blits it (`ScrollerView.startLoop` → `renderFrame` → `drawImage`). At 30 fps every step is twice as long as at 60 fps, and the eye sees it.
- **Not our code.** The frame-locked clock filter (`MetronomeEngine.tick`, ADR 0089) scales its correction by `1 − e^(−dt/τ)`, so a 33 ms frame gets the same correction as two 16.7 ms frames: the position is equally accurate at 30 fps. The beat UI only changes compositor properties (ADR 0091). Each frame is still sub-millisecond.
- **No opt-out.** A page cannot ask to be exempt from the throttle. The only way around it would be to move the staff with a compositor-driven CSS transform, which would replace the canvas blitting design (AGENTS.md, ADR 0091) and is unproven under Low Power Mode. It was rejected.

So the app can only tell the user. It should do so without a user-agent check, only when the frame rate really is held to 30 fps, and never while running normally.

## Decision

### 1. `FrameRateMonitor` (`src/utils/frameRate.ts`)

A pure class that sees only rAF timestamps, so it is unit tested without a DOM.

- `reset()` clears the samples. `ScrollerView.startLoop()` calls it, so a pause or a count-in restart never counts as a long frame.
- `sample(now)` records `now − last` into a fixed ring of `WINDOW = 60` intervals (a `Float64Array`: no per-frame allocation). It skips:
  - every frame in the first `WARMUP_MS = 500` after a reset (start-up, the first synchronous measure render);
  - any interval over `MAX_GAP_MS = 100` (a tab switch, a stall).
- Once the ring is full it judges it every `CHECK_EVERY = 30` frames. The loop is **throttled** when at least `THROTTLED_SHARE = 75 %` of the 60 intervals lie in `[30, 37]` ms (27–33 Hz; a 30 fps frame is 33.3 ms).
- It returns `true` once per instance and never again.

Why a share and not a mean: a 60 Hz loop that drops frames mixes 16.7 and 33.3 ms intervals. Its mean can land near 33 ms when about half the frames are dropped, but its share in the band stays near 50 %. A held 30 fps loop puts nearly every interval in the band. A share above one half also puts the median in the band, so no separate median (and no sort) is needed.

The first verdict comes after 0.5 s + 60 × 33.3 ms ≈ 2.5 s of playback.

### 2. Scroller hook

`ScrollerView.onThrottled(cb)` follows `onFrame` and `onResize`. In the loop, after `renderFrame()`:

```ts
if (this.throttledCallback && this.frameRate.sample(now)) this.throttledCallback();
```

It costs one typed-array write per frame, none of it in `renderFrame`. `main.ts` (`bindPowerNotice`) unregisters the hook once it has fired, so even that stops.

### 3. The notice

`<aside id="power-notice" class="stage-notice power-notice" role="status" hidden>` in the stage, with a battery icon (`#i-battery`), a title and body (`powerTitle`, `powerBody`) and a dismiss button (`#btn-power-dismiss`, `powerDismissAria`). The English copy:

> **Smooth scrolling is limited** The staff is moving at 30 frames per second, usually because Low Power Mode or battery saver is on. Turn it off for smooth scrolling.

"Usually" keeps it true on the rarer causes (thermal throttling, a 30 Hz display). Each locale uses its OS's own term: Risparmio energetico, mode économie d'énergie, Stromsparmodus, modo de bajo consumo, plus a generic word for battery saver.

- It is placed **before** the other stage notices. `.power-notice:not([hidden]) ~ .stage-notice { display: none; }` hides the portrait landscape tip (ADR 0055) and the rotating tip (ADR 0087) while it shows, so notices never stack. They come back when it is dismissed. (Playback already hides the rotating tip, so in practice this concerns the landscape tip.)
- It shows at most once per visit and nothing is stored: if Low Power Mode is still on next time, the notice comes back.

### 4. Testing aid

The `run-guidonica` driver gains `--fps N`, an init script that delivers each rAF callback on the first vsync at least `1000/N − 4` ms after the last delivered frame. On headless Chromium's 60 Hz vsync, `--fps 30` gives 33.3 ms frames and shows the notice. Headless WebKit vsyncs at about 72 Hz, so the same cap gives 42 ms frames, outside the band, and the notice correctly stays hidden.

## Consequences

- **Positive**: users learn why the staff stutters and how to fix it, on every engine, with no UA sniffing and no stored state.
- **Positive**: zero cost in `renderFrame`. The monitor allocates once and stops sampling after it fires.
- **Trade-off**: it also fires on a real 30 Hz display or under thermal throttling. The message still describes what is happening and says "usually".
- **Trade-off**: a loop held to 24 or 40 fps by some other cap is not reported. Low Power Mode and battery saver use 30 fps, which is what the band targets.
- **Unverified on device** at the time of writing: the band matches WebKit's documented behaviour, and a real iPhone in Low Power Mode is the final check.

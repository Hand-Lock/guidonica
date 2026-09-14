# 0008. Pause and Resume State Synchronization & Beat Grid Phase Alignment

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Users reported that pausing playback and subsequently resuming caused the scroller to reset and restart from the beginning (beat 0) rather than resuming seamlessly from the paused beat position.

Investigation revealed four distinct underlying timing, state, and phase issues:

1. **Premature `isPaused` Flag Mutation in `MetronomeEngine.pause()`**:
   In `MetronomeEngine.pause()`, `this.isPaused = true` was assigned before calling `this.pausedElapsedSeconds = this.getElapsedPlaybackSeconds()`. Inside `getElapsedPlaybackSeconds()`, the guard `if (this.isPaused) return this.pausedElapsedSeconds;` immediately evaluated to `true`, returning the un-updated initial value `0`. Consequently, `this.pausedElapsedSeconds` was always overwritten with `0`. Upon calling `resume()`, `this.measureZeroStartTime = this.ctx.currentTime - this.pausedElapsedSeconds` evaluated to `this.ctx.currentTime - 0`, resetting the hardware clock reference back to beat 0.
2. **Audio-Visual Phase De-synchronization on Resumption**:
   In `resume()`, `this.nextBeatTime` was arbitrarily assigned to `this.ctx.currentTime + 0.02` and `this.scheduledBeatCount` was not recomputed. As a result, the next audio pulse clicked 20ms after unpausing regardless of where the playhead stood within the measure, causing the metronome audio clicks to fall out of phase with the notes crossing the playhead.
3. **Count-In Badge and Playback State Corruption**:
   When pausing during an active count-in, `togglePlayback` unconditionally resumed into `'playing'`, hiding the count-in indicator and desynchronizing the session state from the metronome's negative beat count.
4. **Tempo Rescaling Distortion While Paused**:
   When adjusting tempo while paused, `secondsPerBeat` changed while `pausedElapsedSeconds` remained fixed in wall-clock seconds. This caused `currentGlobalBeat = pausedElapsedSeconds / secondsPerBeat` to jump unpredictably upon tempo slider movement.

---

## Decisions & Implementation Methods

### 1. Direct Time Capture Before Flag Mutation (`src/audio/metronome.ts`)
`pausedElapsedSeconds` is now captured directly from the hardware audio clock before modifying `isPaused`:
```typescript
public pause(): void {
  if (!this.isRunning || this.isPaused || !this.ctx) return;
  this.pausedElapsedSeconds = this.ctx.currentTime - this.measureZeroStartTime;
  this.isPaused = true;
  ...
}
```

### 2. Beat-Grid Phase Alignment on Resumption (`src/audio/metronome.ts`)
Upon `resume()`, `measureZeroStartTime` is re-anchored to `this.ctx.currentTime - this.pausedElapsedSeconds`. The upcoming beat index on the discrete beat grid is computed mathematically with a 20ms lookahead guard:
$$k_{\text{next}} = \left\lceil \frac{\text{ctx.currentTime} + 0.02 - \text{measureZeroStartTime}}{\text{secondsPerBeat}} \right\rceil$$
$$\text{nextBeatTime} = \text{measureZeroStartTime} + k_{\text{next}} \times \text{secondsPerBeat}$$
$$\text{scheduledBeatCount} = \max(0, k_{\text{next}} + \text{countInBeatsTotal})$$
The scheduler is invoked immediately to schedule imminent pulses without waiting for the first 25ms timer tick.

### 3. Preserving Fractional Beat Position on Tempo Changes While Paused (`src/audio/metronome.ts`)
When changing tempo while paused, the fractional beat position is held constant by rescaling `pausedElapsedSeconds`:
```typescript
else if (this.isRunning && this.isPaused) {
  const currentBeat = this.getCurrentGlobalBeat();
  this.tempo = clamped;
  this.updateMeterParams();
  this.pausedElapsedSeconds = currentBeat * this.secondsPerBeat;
}
```

### 4. Count-In Continuity Across Pause (`src/state.ts` & `src/main.ts`)
- In `AppState.setPlaybackState()`, the `isCountIn` boolean preserves its state when transitioning into `'paused'`.
- In `MetronomeEngine`, an `isCountingIn()` query method was introduced (`this.hasCountIn && this.getCurrentGlobalBeat() < 0`).
- In `SolfegeScrollerApp.togglePlayback()`, resumption checks `this.metronome.isCountingIn()` to restore either `'counting-in'` or `'playing'`.

---

## Consequences & Verification

- **Seamless Resumption**: Playback resumes at the exact subpixel position where it was paused, both visually and acoustically.
- **Phase Coherence**: Metronome audio clicks remain microsecond-aligned with noteheads crossing the red playhead line.
- **Count-in Robustness**: Pausing during count-in preserves the "Count In" badge and completes the remaining count-in beats before transitioning to Measure 0.
- **Tempo Rescaling Integrity**: Modifying tempo while paused preserves the visual location of the tape and updates playback speed seamlessly upon unpausing.
- **Verification**: Verified with unit and simulation tests across multiple pause/resume cycles, count-in interruptions, and tempo adjustments. Verified with strict typechecking (`tsc --noEmit`) and clean Vite production builds.

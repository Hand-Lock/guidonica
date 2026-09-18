# 29. Stationary Count-In Wait-In-Place

Date: 2026-09-18

## Status
Accepted

## Context
In sight-reading practice, musicians need to mentally parse and anticipate the pitch, accidental, rhythmic duration, and solfège syllable of the initial note before producing it on their instrument or voice.

Prior to this decision (introduced in ADR 0007), Guidonica positioned Measure 0 one measure to the right of the playhead when count-in was enabled by having `MetronomeEngine.getCurrentGlobalBeat()` return `-beatsPerMeasure` (e.g. `-4` in 4/4 meter). This displayed a blank stave section across the playhead prior to starting. When the user pressed "Start", the score scrolled from right to left across the playhead for the duration of the count-in beats until Measure 0 arrived at beat 0.

Musicians found this behavior distracting and unhelpful:
1. The playhead pointed to empty staff lines instead of displaying the actual notation of the first measure.
2. The musician could not examine the first notehead while internalizing the count-in tempo clicks.
3. The scrolling motion during the count-in created unnecessary visual movement before musical performance had even begun.

The user requirement was to eliminate the leading blank measure entirely:
- The playhead must start directly at the true first measure (Measure 0) with the initial notehead aligned directly under the playhead guide.
- When count-in is enabled and "Start" is clicked, the score must **wait in place** at beat 0 while the metronome ticks the count-in beats.
- Audio clicks, beat dot indicators, and the "COUNT-IN" badge remain fully active and synchronized.
- On the exact microsecond count-in concludes and beat 1 arrives, the score begins smooth continuous scrolling to the left in lockstep with the hardware clock.
- The solution must strictly adhere to the project's suckless philosophy: zero framework bloat, single source of truth hardware audio clock (`AudioContext.currentTime`), zero auxiliary `setInterval`/`setTimeout` accumulators.

---

## Decisions

### 1. Dual Coordinate Model: Metric Time vs Visual Scroll Coordinate
We decoupled the internal metric audio timeline coordinate from the visual scroller displacement:

1. **Hardware Audio Clock Metric Beat (`getCurrentGlobalBeat()`)**:
   - In `MetronomeEngine`:
     $$B_{\text{global}}(t) = \frac{t - t_{\text{measureZero}}}{T_{\text{beat}}}$$
     where $t_{\text{measureZero}} = t_{\text{start}} + N_{\text{countIn}} \times T_{\text{beat}}$.
   - When running during count-in ($t < t_{\text{measureZero}}$), $B_{\text{global}}(t) \in [-N_{\text{countIn}}, 0)$.
   - When running during active playback ($t \ge t_{\text{measureZero}}$), $B_{\text{global}}(t) \ge 0$.
   - When stopped ($!this.isRunning$), $B_{\text{global}} = 0$.
   - Preserves continuous mathematical tempo re-anchoring, pause/resume elapsed time offsets, and downbeat detection without special cases.

2. **Visual Scroll Beat Coordinate (`getVisualBeat()`)**:
   - In `MetronomeEngine`:
     $$B_{\text{visual}}(t) = \max(0, B_{\text{global}}(t))$$
   - In the stopped state ($!this.isRunning$): $B_{\text{visual}} = 0$.
   - During count-in ($B_{\text{global}} < 0$): $B_{\text{visual}} = 0$.
   - During active playback ($B_{\text{global}} \ge 0$): $B_{\text{visual}} = B_{\text{global}}$.

### 2. Viewport Scroller Synchronization (`src/scroller/scroller.ts`)
The 60/120 FPS render loop in `ScrollerView.renderFrame()` samples the visual coordinate:
```typescript
const visualBeat = this.metronome.getVisualBeat();
```
Each rendered measure is blitted at:
$$X_{\text{screen}} = X_{\text{playhead}} - O_{\text{note}} \times Z + (B_{\text{start}} - B_{\text{visual}}) \times (W_{\text{beat}} \times Z)$$
where $O_{\text{note}} = 26\text{ px}$ is the note start offset inside each measure canvas.

Because the note on beat 0 of Measure 0 is drawn at local coordinate $X_{\text{local}} = O_{\text{note}} \times Z$:
$$X_{\text{note0}} = X_{\text{screen}} + X_{\text{local}} = X_{\text{playhead}} + (0 - 0) \times (W_{\text{beat}} \times Z) = X_{\text{playhead}}$$
The initial notehead rests precisely centered under the playhead guide line both while stopped and throughout the entire count-in.

At the exact microsecond $t = t_{\text{measureZero}}$:
1. The metronome scheduler emits the downbeat audio click for Measure 0.
2. The beat dispatch emits `isCountIn = false, isDownbeat = true, beatNumber = 1`.
3. `globalState` transitions from `'counting-in'` to `'playing'`, hiding the "COUNT-IN" badge.
4. $B_{\text{global}}$ crosses $0$ and becomes positive.
5. $B_{\text{visual}}$ smoothly follows $B_{\text{global}}$, starting GPU-accelerated subpixel scrolling to the left.

### 3. Stopped State Invariance
When stopped, $B_{\text{visual}} = 0$ regardless of whether `settings.countIn` is enabled or disabled. Toggling the count-in switch while stopped does not produce any visual jump, tape teleportation, or blank measure artifact.

---

## Consequences

### Positive
- **Optimal Sight-Reading Preparation**: Musicians immediately see the first measure and can prepare the initial note and rhythm while listening to the count-in pulses.
- **Zero Blank Stave Artifacts**: Eliminates the distracting empty space that previously occupied the playhead before playback.
- **Suckless Simplicity**: Implemented purely by clamping $B_{\text{visual}} = \max(0, B_{\text{global}})$ and resetting the stopped origin to 0. Zero new state flags, zero timers, zero visual drift.
- **Robust Pause/Resume**: Pausing during count-in preserves negative elapsed time and resumes stationary count-in smoothly until beat 1.

### Maintenance
- Unit tests in `tests/metronome.test.ts` verify both $B_{\text{global}}$ and $B_{\text{visual}}$ coordinates across stopped, counting-in, active playback, and tempo-change scenarios.

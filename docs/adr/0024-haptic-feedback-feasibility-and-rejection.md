# ADR 0024: Technical Feasibility Evaluation and Rejection of Web Haptic Motor Feedback

## Status
Decided (Rejected)

## Date
2026-09-18

## Context & Problem Statement
Guidonica is designed as a high-performance, client-only web application for sight-reading and solfège practice. The engine streams procedurally generated musical notation across a fixed playhead in synchronization with a synthesized metronome.

A feature inquiry was proposed to evaluate adding **tactile haptic feedback** on mobile and haptic-actuator-equipped devices:
1. **Metronome Synchronization**: Emitting tactile pulses in tandem with the metronome audio clicks, using differentiated intensities for downbeats (metric accents) versus standard beats.
2. **UI Navigation**: Producing tactile or clicky feedback during user interface manipulation, specifically when dragging or stepping the BPM tempo slider.

The project philosophy mandates that any new capability must be well-documented, lightweight, cross-platform, free from external dependencies or weird workarounds, and strictly aligned with Guidonica's **Suckless Engineering Philosophy** and **Single Source of Truth Hardware Clock** invariant.

---

## Technical Investigation & Decision Rationale

Following deep architectural analysis of the W3C Vibration API, browser engine implementations (WebKit vs. Chromium/Gecko), and physical actuator dynamics, **haptic motor feedback is formally rejected** for Guidonica.

The decision is governed by four fatal technical constraints:

### 1. Complete iOS / WebKit Incompatibility
- **0% Support on Apple Mobile Hardware**: Apple's WebKit engine does not implement the W3C Vibration API (`navigator.vibrate` is `undefined` across all browsers on iOS/iPadOS, as all iOS browsers are required to use WebKit).
- **Apple's Standards Stance**: WebKit officially lists the Vibration API as "Opposed" due to fingerprinting vulnerabilities, aggressive mobile advertising abuse, and unmetered battery drain.
- **Fragile Workarounds**: While iOS 17.4+ exhibits micro-haptics when interacting with a native `<input type="checkbox" switch>`, this behavior only triggers on direct synchronous touch gestures on the element. It cannot be dispatched programmatically via timers, audio clocks, or background intervals. Relying on undocumented DOM switch polyfills directly violates Guidonica's prohibition against weird workarounds.

### 2. Clock Desynchronization & The Auditory-Tactile "Flam" Artifact
Guidonica's primary architectural invariant ([`AGENTS.md`](../../AGENTS.md)) requires:
> *"Single Source of Truth Hardware Clock: Visual motion and synthesized metronome audio clicks are mathematically linked to the hardware audio clock (`AudioContext.currentTime`). Never introduce independent `setInterval`, `setTimeout`, or visual time accumulators. Visual-auditory drift is mathematically impossible; noteheads cross the playhead at the exact physical microsecond the speaker clicks."*

- **Thread Isolation**: Web Audio executes on the operating system's real-time audio thread (< 0.5 ms timing jitter). The Web platform provides **no audio-clock-scheduled haptics API**.
- **Main-Thread Timer Jitter**: Any call to `navigator.vibrate()` must be scheduled on the JavaScript main thread via `setTimeout` or `requestAnimationFrame`. On mobile devices subjected to garbage collection, touch events, or CPU power management, main-thread timers routinely drift by **10 ms to 40 ms**.
- **Actuator Physical Inertia**:
  - Eccentric Rotating Mass (ERM) motors have a physical rise time of **30 ms to 50 ms**.
  - Linear Resonant Actuators (LRA) have a rise time of **15 ms to 25 ms**.
- **The "Flam" Effect**: Human auditory-tactile perception detects temporal offsets exceeding 10 ms. Because the audio click fires instantaneously while the mechanical vibration lags by 30–70 ms, the user experiences a jarring double-hit ("flam") where the sound click is followed by a delayed physical buzz. In rhythmic sight-reading pedagogy, this latency is actively disorienting and detrimental to training.

### 3. Inability to Modulate Accent Strength
- The W3C Vibration API specification is strictly temporal:
  ```ts
  navigator.vibrate(pattern: number | number[]): boolean;
  ```
- It accepts duration in milliseconds, but **offers zero amplitude, force, sharpness, or frequency controls**.
- Differentiating downbeats (accents) from standard beats can only be approximated by lengthening the pulse (e.g., 35 ms vs. 15 ms). Rather than feeling crisp and accented, longer durations feel like sluggish, muddy mechanical rumbles.
- At typical practice tempos (100–200 BPM) or sixteenth-note subdivisions, consecutive vibrations blend into an uninterrupted, unmusical phone vibration that masks the metronome's metric structure.

### 4. Thermal Throttling & OS Rate-Limiting
- Continuous metronome operation at 120 BPM generates 120 motor activations per minute (7,200 per hour).
- Android OS internal frameworks (`VibratorService`) implement battery and thermal throttling limits. Under rapid, repetitive firing, the OS silently drops vibration calls, resulting in unpredictable skipped tactile pulses that confuse the user during practice.

---

## Architectural Comparison Matrix

| Dimension | Native Mobile App (Swift/Kotlin) | Web Application (`navigator.vibrate`) | Guidonica Architecture Standard |
| :--- | :--- | :--- | :--- |
| **Cross-Platform Availability** | 100% (CoreHaptics / Android Vibrator) | ~45% (Android only; **0% on iOS**) | 100% platform parity (ADR 0009, ADR 0017) |
| **Hardware Clock Sync** | Audio-clock synced hardware triggers | Main thread `setTimeout` only (> 30ms jitter) | Zero-drift audio clock (`AudioContext.currentTime`) |
| **Dynamic Accents** | Direct amplitude & sharpness control | Binary on/off (duration only) | Clear downbeat metric accents |
| **Pedagogical Integrity** | Cohesive sensory click (< 5ms) | Auditory-tactile flam artifact (30-70ms) | Microsecond-accurate auditory/visual sync |
| **Suckless Discipline** | Native system frameworks | Requires fragile hacks or polyfills | Zero bloat, zero weird workarounds |

---

## Consequences

- **Codebase Purity Preserved**: No non-standard, fragile, or platform-fragmented code is added to `src/audio/metronome.ts` or `src/main.ts`.
- **Knowledge Retention**: Future LLM agents and developers will understand why haptic feedback was evaluated and formally rejected, avoiding redundant re-implementation attempts unless a native Web Audio haptics specification is standardized and adopted by WebKit.
- **Future Alternative**: If tactile-like feedback is desired for UI controls (e.g. BPM slider detents), it can be implemented via ultra-lightweight, zero-byte synthesized Web Audio micro-ticks, preserving 100% cross-platform parity and zero latency.

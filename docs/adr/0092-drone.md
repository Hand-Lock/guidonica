# 0092. Drone: a Steady Tonic to Sight-Sing Against

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A user asked for a drone (pedal tone): a steady Do to sing against. Singing against a held tonic trains intonation and the feel of each scale degree, and it is how Indian classical music (tanpura, shruti box) and much early-music practice teach pitch.

Guidonica writes white notes only (`PITCH_CLASSES` c…b, no accidentals), so a drone can be one of those seven pitch classes. Over white notes a drone on D gives Dorian, on A Aeolian, on G Mixolydian: modal practice comes free.

The drone must follow the project's audio rules: no samples, nothing outside native Web Audio nodes, timing only from `AudioContext.currentTime`, no new timers, no per-frame work, and every node freed after use.

## Decision

### 1. Settings and sharing

| Setting | Values | Default | Travels in links |
|---|---|---|---|
| `droneNote` | `'off'` or `c` … `b` (`DRONE_NOTES`) | `'off'` | yes, `drone=<off\|c…b>` |
| `droneSound` | `tanpura`, `shruti`, `pad` (`DRONE_SOUNDS`) | `shruti` | no |
| `droneVolume` | 0 … 1 | 0.6 | no |

- **Tonic only**, no fifth: with a fifth, the fourth degree against it would sound "wrong" although it is a note the exercise writes. With the tonic alone, all seven notes are consonant or purposeful dissonances.
- The note is part of the exercise (a teacher sends "sing this in D Dorian"); timbre and volume are personal, like the click sound and volume. `decodeExercise` reads `drone` with `pick(…, DRONE_NOTES) ?? base.droneNote`, so links from before this ADR keep the recipient's choice. The change is additive, so the link `VERSION` stays `'1'`.
- The shruti box is the default timbre: sustained, it is the steadiest reference.

### 2. Pitch (`src/audio/drone.ts`)

The tonic sits in octave 3, 12-TET with A4 = 440 Hz:

$$f = 440 \cdot 2^{(m - 69)/12}, \qquad m = 48 + [0, 2, 4, 5, 7, 9, 11]_i$$

so C3 ≈ 130.81 Hz … B3 ≈ 246.94 Hz, under every voice and clef. Phone speakers barely reproduce these fundamentals, so every timbre is harmonic-rich and the ear restores the missing fundamental.

### 3. Voices

`createDroneVoice(ctx: BaseAudioContext, out, sound, pc, at): DroneVoice` with `schedule(until)` and `release(at)`. `BaseAudioContext` lets tests and offline renders use `OfflineAudioContext`.

Every voice ends in one envelope gain: attack `setTargetAtTime(level, at, τ_attack)`, release `setTargetAtTime(0, max(at, t), 0.1)`. Chained targets need no `cancelAndHoldAtTime` (missing in Firefox), and the `max` keeps a release issued before the attack from being overridden by it. Sources stop 1 s (10 τ, about −87 dB) after the release starts; `onended` disconnects every node.

Harmonic waves (`PeriodicWave`, a_n = 1/n^p) are built once per context and cached in a `WeakMap`.

| Timbre | Graph | Attack τ |
|---|---|---|
| **Pad** | two `sawtooth` at f, detuned ±7 cents (beating ≈ 1 Hz at C3) → lowpass 1 kHz, Q 0.5; a 0.1 Hz LFO swings the cutoff ±250 Hz | 0.4 s |
| **Shruti box** | two reeds from one wave (16 harmonics, p = 1.1) at f and 2f + 3 cents (the harmonium's octave coupler and its slow beating), the upper at 0.6 → lowpass 2.2 kHz → bellows gain (1 ± 0.12 at 0.22 Hz) → envelope, so the swell never leaks through a release | 0.25 s |
| **Tanpura** | the 5‑8‑8‑1 cycle made tonic-only: strings [f, f, f, f/2], gaps [0.9, 0.9, 0.9, 2.4] s. Each pluck: jawari wave oscillator (32 harmonics, p = 0.7) → `peaking` filter (+14 dB, Q 5) sweeping exponentially 12f → 3f over 3 s, like the jawari's grazing contact sweeping a band of harmonics → gain with a 10 ms attack and τ = 1.4 s decay; it stops at t + 8 s | 0.02 s |

`schedule(until)` queues tanpura plucks up to the scheduler horizon; plucks overlap, so the tanpura never falls silent (in a render its quietest 100 ms window is 12.5 dB below its loudest, against 4–6 dB for the sustained timbres). Live plucks are kept in a `Map` to their stop time, so `release` can shorten, never lengthen, them.

Levels (`LEVEL`) equalize the three to −16 dBFS RMS in a 10 s offline render on C, within 0.2 dB on B as well; the tanpura's onsets peak at 0.83–0.96.

### 4. Engine (`src/audio/metronome.ts`)

- `ensureAudioContext()` creates `droneBus → destination`, a sibling of the click's master gain. Its gain is `isMuted ? 0 : droneVolume`, glided with `setTargetAtTime(…, 0.02)` by `setDroneVolume` and `setMuted` so sliders never zip and mute never pops. The click volume stays separate; Mute silences both.
- `start()` builds the voice at the first click's time, so the drone sounds through the count-in and the singer hears the tonic before the first note. `pause()`, `stop()` and `destroy()` release it at `currentTime` (a 0.1 s fade, while the clicks keep their instant mute). `resume()` builds a fresh voice.
- `scheduler()`, already woken every 25 ms, also calls `droneVoice.schedule(currentTime + 0.1)`: no new timer.
- `setDroneNote` and `setDroneSound` return when nothing changed; while playing they crossfade (old release, new attack at `currentTime`). Tempo and meter changes leave the drone alone. An OS interruption pauses playback and so releases the drone.

### 5. UI

Settings → Practice gains, after Volume: **Drone** (Off + seven notes, named by `pitchClassNames` like the Notes chips, so Labels and language rename them), **Drone sound** and **Drone volume**, built from the existing `control-group`, `select` and `volume-group` markup; no CSS was added. A rotating tip (ADR 0087) points to the drone while it is off.

## Consequences

- **Bundle**: the app chunk grows 1.78 kB gzipped (38.85 → 40.63 kB), each lazy locale about 0.19 kB; CSS is unchanged.
- **CPU**: sustained timbres are 3 oscillators and 4–5 other nodes; the tanpura keeps about six plucks of three nodes alive. All of it runs on the audio thread; the main thread only queues a pluck every 0.9–2.4 s.
- **Memory**: nothing is retained after a release; voices disconnect themselves once their sources end.
- **Clipping**: drone and click sum at the destination; with both volumes at 1 a click coinciding with a tanpura onset can briefly exceed full scale. At the defaults (0.8 and 0.6) the drone peaks near 0.3–0.58.
- **Accidentals**: should the generator ever write sharps and flats, `DRONE_NOTES` can grow with them; the frequency table is the only other place to change.
- **Tests**: `tests/drone.test.ts` checks the frequencies, each graph's lifecycle, the tanpura cycle and the engine wiring on a recording mock context; `tests/storage.test.ts`, `tests/share.test.ts` and `tests/tips.test.ts` cover the settings, the link and the tip.

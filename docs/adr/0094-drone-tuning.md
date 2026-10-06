# 0094. Drone Tuning: Baroque, Classical and Renaissance Pitch

- **Status**: Accepted (amends [0092](0092-drone.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

ADR 0092 tuned the drone to A4 = 440 Hz. Singers who rehearse with period instruments sing at other pitches: Baroque ensembles at 415 Hz, Classical-era ones at 430 Hz, many orchestras at 442 Hz, and some Renaissance and 17th-century German repertoire (cornetts, *Chorton* organs) at 466 Hz. Against a 440 drone, a choir that tunes to a 415 harpsichord trains the wrong reference, almost a semitone off.

The drone is the only pitched sound Guidonica makes, so its A4 is the only thing that needs to change. The notation is untouched: a 415 drone on D is still D.

## Decision

### 1. Setting and sharing

| Setting | Values | Default | Travels in links |
|---|---|---|---|
| `referencePitch` | `415`, `430`, `440`, `442`, `466` (`REFERENCE_PITCHES`) | `440` | yes, `a4=<hz>` |

- A fixed list rather than a free number: every value names a practice a teacher can point to, the select stays short, and storage and links validate by membership (`REFERENCE_PITCHES.find`), so `441`, `'415'` and junk fall back.
- The tuning belongs with the drone note in a link: "sing this in D Dorian at 415" is one exercise. `decodeExercise` reads `a4` against the list and otherwise keeps `base.referencePitch`, so links from before this ADR leave the recipient's tuning alone. The change is additive and the link `VERSION` stays `'1'`.

### 2. Pitch (`src/audio/drone.ts`)

$$f = a_4 \cdot 2^{(m - 69)/12}, \qquad m = 48 + [0, 2, 4, 5, 7, 9, 11]_i$$

`droneFrequency(pc, a4 = 440)` and `createDroneVoice(…, at, a4 = 440)` take the reference; every partial and detune of both timbres scales with `f`, so the voices need no other change. At 415 Hz A3 = 207.5 Hz and C3 ≈ 123.38 Hz; at 466 Hz A3 = 233 Hz.

### 3. Engine (`src/audio/metronome.ts`)

`setReferencePitch(hz)` returns when nothing changed, else calls `restartDrone()`: while playing, the old voice releases and the new one attacks at `currentTime`, the same crossfade as a note change. It is audio-clock only; no timer is added. `main.ts` passes the stored value at boot, before the first gesture, which only sets a field.

### 4. UI

Settings → Practice gains **Drone tuning** after Drone sound, a `select` of five options: "A = 415 Hz (Baroque)", "A = 430 Hz (Classical)", "A = 440 Hz", "A = 442 Hz", "A = 466 Hz (Renaissance)". The note name comes from `pitchClassNames`, like the drone note options, so Labels and the language rename it (La = 415 Hz (Barocco) in Italian). The era names are locale keys (`tuningBaroque`, `tuningClassical`, `tuningRenaissance`); `updatePitchClassLabels` builds the option text. No CSS was added.

## Consequences

- One number threaded through two functions; the click is unpitched and unaffected.
- The list can grow (432, 435 for 19th-century French *diapason normal*) by adding to `REFERENCE_PITCHES` and, if wanted, an era key.
- Equal temperament stays: historical temperaments (meantone, Werckmeister) would matter only for a drone with more than one note, and Guidonica's drone is the tonic alone.
- **Tests**: `tests/drone.test.ts` (frequencies at every reference, a voice built at 430, the engine crossfading a change while playing and ignoring repeats), `tests/share.test.ts` (round trip, a link without `a4` keeps the recipient's, junk falls back) and `tests/storage.test.ts` (default and validation).

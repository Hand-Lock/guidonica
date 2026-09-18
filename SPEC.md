# Guidonica: Product Specification

## 1. Executive Summary & Pedagogical Purpose
**Guidonica** is a high-performance, client-only web application designed for deliberate sight-reading and solfège practice. Named in homage to **Guido d'Arezzo** and the historic **Manus Guidonica** (Guidonian Hand)—the world's first spatial visual-mnemonic sight-singing method—Guidonica transforms musical notation reading into an infinite-scrolling flow state: procedurally generated sheet music continuously moves across a stationary playhead in lockstep with a synthesized audio metronome.

### Pedagogical Philosophy
- **No Evaluation Friction**: The software acts as an unyielding, rhythmic pacing tool. It deliberately omits microphone pitch detection, scoring, or gamified leaderboards. The musician self-monitors their vocalized solfège (rhythmic syllables or pitched singing) against the audible pulse and oncoming notation.
- **Anticipatory Reading**: Traditional static sight-reading suffers from "page-turn panic" and erratic eye movements. Continuous horizontal scrolling trains the musician's eye to read ahead of the playhead, recognizing upcoming interval patterns, melodic shapes, and rhythmic groupings before vocalizing them.
- **Progressive Difficulty**: Users can isolate individual musical variables—clef, meter, rhythmic subdivisions, and melodic intervals—to target specific cognitive bottlenecks.

### The Suckless Engineering Axioms
Guidonica rejects modern web bloat in favor of mathematical simplicity, client-side sovereignty, and mechanical sympathy:
1. **Zero Framework Bloat (Vanilla TypeScript)**: Direct DOM APIs and native canvas contexts; no React/Vue/Svelte virtual DOM overhead (~13.6 kB gzipped JS).
2. **Single Authoritative Hardware Clock (`AudioContext.currentTime`)**: Synchronizes audio synthesis and the visual scroller to eliminate visual-auditory drift mathematically.
3. **GPU Measure Blitting Pipeline**: Offscreen VexFlow measure caching rendered once; the 60/120 FPS animation loop purely executes `ctx.drawImage()`, keeping CPU usage < 1%.
4. **Bounded Ring-Buffer Memory Discipline**: Only 4 to 6 measures kept in memory; expired canvases are immediately dereferenced for leak-free infinite sessions.
5. **Sample-Free Audio Synthesis**: Metronome clicks synthesized live via Web Audio oscillators; 0 bytes of audio sample files over the wire.
6. **Pure CSS3 Liquid Glass UI**: 100% vector and CSS3-powered Frutiger Aero / Aqua styling; zero CSS framework runtimes (~5.4 kB gzipped CSS).

---

## 2. Core User-Configurable Parameters

The user must have full control over the generation engine prior to and during a session:

1. **Tempo (BPM)**:
   - Range: 30 to 240 BPM.
   - Increments: 1 BPM (slider + precision numeric input + keyboard shortcuts).
2. **Time Signature**:
   - Common meters: `2/4`, `3/4`, `4/4`, `6/8`.
   - The generator ensures each measure strictly satisfies the metric beat count and beaming conventions of the selected meter.
3. **Clef**:
   - Selectable: Treble (G clef), Bass (F clef), Alto (C clef on line 3), Tenor (C clef on line 4).
   - Pitches are strictly constrained to the comfortable reading range of the chosen clef (standard staff lines plus up to 2 ledger lines above/below).
4. **Subdivisions & Rhythmic Vocabulary**:
   - Granular toggles allowing any combination of:
     - Whole notes (`1`)
     - Half notes (`1/2`)
     - Quarter notes (`1/4`)
     - Eighth notes (`1/8`)
     - Sixteenth notes (`1/16`)
     - Triplets (eighth-note tuplets `3:2`)
   - Rest toggle: Option to enable/disable rhythmic rests (quarter rests, eighth rests).
5. **Melodic Intervals & Pitch Transitions**:
   - Selectable transition constraints:
     - *Stepwise only (Seconds)*: Scales, adjacent notes ($\pm 1$ diatonic step).
     - *Thirds / Triadic skips*: Allows leaps up to diatonic thirds/fourths.
     - *Octave leaps*: Allows wide jumps and octave displacement.
     - *Any interval*: Unrestricted random walk within clef range.
   - Tonality: Natural notes (diatonic C Major / A Minor) as the clean default baseline, with optional chromatic accidental toggles.
6. **Count-In / Lead-In**:
   - 1-measure metronome lead-in with visual beat indicators where the score waits in place at the true first measure (Measure 0) under the playhead, allowing the musician to prepare and internalize tempo before tape scrolling begins on beat 1.

---

## 3. Kinetic & Visual Mechanics (The Scroller)

### Layout & Orientation
- **Stationary Staff Lines**: The five staff lines span horizontally across the display and do not move.
- **Pinned Clef & Key Signature**: The active clef is permanently displayed at the left margin, establishing reference coordinates without scrolling out of view.
- **Fixed Vertical Playhead**: A crisp vertical guide line (cursor) is positioned at a fixed horizontal coordinate (e.g., 20%–25% from the left edge of the viewport).
- **Moving Notation Tape**: Barlines, notes, accidentals, and beams scroll smoothly from right to left toward the playhead.

### Metric Linearity (Fundamental Spacing Rule)
Unlike traditional engraved sheet music—where measure widths flex dynamically based on note density—a scrolling sight-reading tool requires **strict spatial linearity**:
- Every beat occupies an identical pixel width ($W_{\text{beat}}$).
- A measure's pixel width is directly proportional to its time signature beat count:
  $$W_{\text{measure}} = \text{beatsPerMeasure} \times W_{\text{beat}}$$
- Scrolling velocity ($v$) is constant for a given tempo:
  $$v = \frac{\text{BPM}}{60} \times W_{\text{beat}} \quad (\text{pixels per second})$$
- Note heads cross the playhead line at the exact microsecond the metronome pulse sounds. This maintains an unwavering visual-auditory link.

### Rendering Architecture: The Measure Blitting Pipeline
To maintain a stable 60 FPS / 120 FPS on all hardware without CPU throttling:
- **Offscreen Measure Caching**: Measures are procedurally generated in chunks ahead of the viewport. Each measure is formatted and rendered once onto an offscreen canvas surface using VexFlow.
- **Fast Blitting**: The main display canvas does not execute complex VexFlow layout or glyph calculations during animation frames. It only blits visible offscreen measure canvases using `CanvasRenderingContext2D.drawImage()`.
- **Ring Buffer**: Measures that scroll offscreen past the left margin are discarded. New measures are generated and appended on the right when the buffer drops below 3 future measures.

---

## 4. Procedural Music Generation Engine

### Rhythmic Generator (Metric Tree Partitioning)
1. The generator allocates a measure based on the selected time signature (e.g., `4/4` = 4 quarter beats).
2. Each metric beat is recursively partitioned into allowed subdivisions according to the user's active checkboxes.
3. Rhythms conform to standard metric grouping:
   - Beams do not obscure the metric half-bar in `4/4`.
   - Notes are beamed together per beat or beat-group (e.g., dotted quarters in `6/8`).
   - If rests are enabled, rests are placed according to standard notation rules (no unreadable syncopated rests across metric boundaries).

### Melodic Generator (Constrained Random Walk)
1. **Initial Pitch**: Begins on a stable anchor note (e.g., the tonic or middle line of the chosen clef).
2. **Successive Pitches**:
   - The next pitch is sampled from the allowed interval set relative to the current pitch.
   - Direction (ascending vs. descending) is randomized with boundary bias: if the pitch approaches the edge of the allowed range (e.g., $\ge 2$ ledger lines), the direction probability biases back toward the center of the staff.
   - Scale degrees map cleanly to standard VexFlow pitch keys (e.g., `c/4`, `d/4`, `e/4`).

---

## 5. Audio & Metronome Synchronization

### Drift-Free Clock Architecture
- The audio engine is built directly on the browser's native **Web Audio API**.
- `AudioContext.currentTime` serves as the authoritative, hardware-synchronized clock for both audio scheduling and visual scroll offsets.
- Formula for scroll offset at any frame:
  $$\text{elapsedSeconds} = \text{AudioContext.currentTime} - t_{\text{start}}$$
  $$\text{scrollX} = \text{elapsedSeconds} \times v$$
- Because the animation loop calculates position directly from `AudioContext.currentTime`, visual jitter and audio drift are mathematically eliminated, even under CPU load spikes or background tab throttling.

### Metronome Synthesis
- Synthesized clicks using native `OscillatorNode` and exponential `GainNode` envelopes (zero external audio file dependencies).
- Distinct timbres:
  - **Beat 1 (Downbeat)**: Higher frequency accent pulse (e.g., 1200 Hz).
  - **Subsequent Beats**: Lower frequency pulse (e.g., 800 Hz).

---

## 6. User Interface & Experience

### Visual Aesthetic
- Minimalist, distraction-free aesthetic matching the suckless ethos.
- High-contrast, dark-mode default with clean music notation and a distinct accent color for the playhead and active UI states.
- Clean typography for status and settings.

### Control Panel
- Compact header or collapsible drawer containing:
  - Play / Pause / Reset button
  - BPM slider + direct number input
  - Clef selector
  - Time signature selector
  - Subdivisions checklist
  - Intervals selector
- Live visual indicator for the active beat / count-in.

### Keyboard Controls
- `Space`: Toggle Play / Pause.
- `R` or `Escape`: Reset session to start.
- `ArrowUp` / `ArrowDown`: Increment / decrement tempo by 5 BPM.
- `Shift + ArrowUp` / `Shift + ArrowDown`: Increment / decrement tempo by 1 BPM.
- `+` / `=`: Zoom in (+10%).
- `-` / `_`: Zoom out (-10%).
- `0`: Auto-fit zoom to screen (Auto Zoom).

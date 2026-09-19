# Guidonica: Product Specification

## 1. Executive Summary & Pedagogical Purpose
**Guidonica** is a high-performance, client-only web application designed for deliberate sight-reading and solfège practice. Named in homage to **Guido d'Arezzo** and the historic **Manus Guidonica** (Guidonian Hand)—the world's first spatial visual-mnemonic sight-singing method—Guidonica transforms musical notation reading into an infinite-scrolling flow state: procedurally generated sheet music continuously moves across a stationary playhead in lockstep with a synthesized audio metronome.

### Pedagogical Philosophy
- **No Evaluation Friction**: The software acts as an unyielding, rhythmic pacing tool. It deliberately omits microphone pitch detection, scoring, or gamified leaderboards. The musician self-monitors their vocalized solfège (rhythmic syllables or pitched singing) against the audible pulse and oncoming notation.
- **Anticipatory Reading**: Traditional static sight-reading suffers from "page-turn panic" and erratic eye movements. Continuous horizontal scrolling trains the musician's eye to read ahead of the playhead, recognizing upcoming interval patterns, melodic shapes, and rhythmic groupings before vocalizing them.
- **Progressive Difficulty**: Users can isolate individual musical variables—clef, meter, rhythmic subdivisions, and melodic intervals—to target specific cognitive bottlenecks.
- **The Ergodic Principle (State-Space Completeness)**: Pedagogically, true sight-reading proficiency requires encountering every possible permutation of rhythmic figures and melodic intervals within the chosen scope. If software artificially favors cliches or suppresses valid figures (e.g., omitting quarter-eighth pairs in 6/8 or quarter-half pairs in 3/4), the musician develops cognitive blind spots. Guidonica treats the user's active settings as a bounded musical universe $\Omega$: given infinite time, the generator is mathematically guaranteed to generate every valid musical phrase in that universe ("the infinite monkey theorem" for sight-reading).

### The Suckless Engineering Axioms
Guidonica rejects modern web bloat in favor of mathematical simplicity, client-side sovereignty, and mechanical sympathy:
1. **Zero Framework Bloat (Vanilla TypeScript)**: Direct DOM APIs and native canvas contexts; no React/Vue/Svelte virtual DOM overhead (~13.6 kB gzipped JS).
2. **Single Authoritative Hardware Clock (`AudioContext.currentTime`)**: Synchronizes audio synthesis and the visual scroller to eliminate visual-auditory drift mathematically.
3. **GPU Measure Blitting Pipeline**: Offscreen VexFlow measure caching rendered once; the 60/120 FPS animation loop purely executes `ctx.drawImage()`, keeping CPU usage < 1%.
4. **Bounded Ring-Buffer Memory Discipline**: Only 4 to 6 measures kept in memory; expired canvases are immediately dereferenced for leak-free infinite sessions.
5. **Sample-Free Audio Synthesis**: Metronome clicks synthesized live via Web Audio oscillators; 0 bytes of audio sample files over the wire.
6. **Pure CSS3 Liquid Glass UI**: 100% vector and CSS3-powered Frutiger Aero / Aqua styling; zero CSS framework runtimes (~5.4 kB gzipped CSS).
7. **Ergodic State-Space Completeness**: Procedural algorithms never artificially censor or prune mathematically and grammatically valid permutations of the user's active settings ($P(\omega) > 0, \forall \omega \in \Omega$). All rhythm partitioning and pitch walks are strictly ergodic.

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
   - Complete **Setticlavio** system (8 historical vocal/instrumental clefs):
     - **Treble (G2)** (`treble`): G clef on line 2, range E3 – F6 (±3 ledger lines).
     - **Soprano (C1)** (`soprano`): C clef on line 1, range C3 – D6 (±3 ledger lines).
     - **Mezzo-Soprano (C2)** (`mezzo-soprano`): C clef on line 2, range A2 – B5 (±3 ledger lines).
     - **Alto (C3)** (`alto`): C clef on line 3, range F2 – G5 (±3 ledger lines).
     - **Tenor (C4)** (`tenor`): C clef on line 4, range D2 – E5 (±3 ledger lines).
     - **Baritone (F3)** (`baritone-f`): F clef on line 3, range B1 – C5 (±3 ledger lines).
     - **Baritone (C5)** (`baritone-c`): C clef on line 5, range B1 – C5 (±3 ledger lines).
     - **Bass (F4)** (`bass`): F clef on line 4, range G1 – A4 (±3 ledger lines).
   - Pitches are strictly constrained to the reading range of the chosen clef (standard staff lines plus up to 3 ledger lines above/below, spanning exactly 23 diatonic pitches).
4. **Subdivisions & Rhythmic Vocabulary**:
   - Granular toggles allowing any combination of:
     - Whole notes (`1`)
     - Half notes (`1/2`)
     - Quarter notes (`1/4`)
     - Eighth notes (`1/8`)
     - Sixteenth notes (`1/16`)
     - Triplets (eighth-note tuplets `3:2`)
   - **Dotted notes modifier**: Explicit toggle allowing dotted durations (`hd`, `qd`, `8d`) when combined with enabled base durations.
   - **Tied notes toggle**: Explicit toggle allowing cross-beat ties with pitch preservation.
   - **Rest toggle**: Option to enable/disable rhythmic rests (quarter rests, eighth rests).
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

### The Ergodic Principle (State-Space Completeness)
The central mathematical doctrine of Guidonica's procedural generator is **ergodicity** (the "infinite monkey theorem" for sight-reading).

#### Mathematical Formulation
Let the user's active session configuration define a discrete musical parameter space:
$$\Omega = (\text{Clef}, \text{TimeSignature}, \text{Subdivisions}, \text{Dotted}, \text{Ties}, \text{Intervals}, \text{Accidentals})$$

A generated measure $M = (r_1, p_1), (r_2, p_2), \dots, (r_k, p_k)$ consists of a sequence of durations $r_i$ and pitches $p_i$. Let $\mathcal{M}(\Omega)$ denote the set of all syntactically and grammatically valid measures conforming to $\Omega$. The generator is strictly ergodic:
$$\forall M \in \mathcal{M}(\Omega), \quad P(M \mid \Omega) > 0$$

Given an arbitrarily long practice session, the empirical distribution of generated figures converges to the uniform or stationary measure over $\mathcal{M}(\Omega)$. No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or melodic skip within the user's settings may have probability zero.

### Rhythmic Generator: Ergodic Metric Tree Partitioning
Rhythm generation decomposes each measure top-down through a metric tree structure based on meter and active subdivisions:

1. **Compound Meter Partitioning (6/8)**:
   - A 6/8 measure consists of 2 compound beats of 3 eighth notes each ($3+3 = 6$ eighths).
   - If dotted half (`hd`) is active with dotted enabled $\rightarrow$ full-measure dotted half ($3+3=6$).
   - Otherwise, each 3-eighth beat group is independently partitioned via candidate branch sampling:
     $$\mathcal{P}_{\text{compound}} = \{ [qd], [q, 8], [8, q], [8, 8, 8], [8, 16, 16], [16, 16, 8], [16, 16, 16, 16] \dots \}$$
   - Filtered against active subdivisions. Standard quarter notes (`q`, 2 eighths) combined with eighth notes (`8`, 1 eighth) have equal stochastic selection probability alongside dotted quarters (`qd`, 3 eighths).

2. **Simple Triple Meter Partitioning (3/4)**:
   - A 3/4 measure consists of 3 quarter beats ($1+1+1 = 3$).
   - Allowed macro-partitions:
     $$\mathcal{P}_{3/4} = \{ [hd], [h, q], [q, h], [1+1+1 \text{ beats}] \}$$
   - Any active combination (e.g. half + quarter notes) generates both $[h, q]$ and $[q, h]$ with non-zero probability. Dotted half $[hd]$ requires both `subdiv.half` and `subdiv.dotted`.

3. **Simple Quadruple & Duple Partitioning (4/4, 2/4)**:
   - In 4/4, partitions preserve the metric half-bar (beats 1-2 and beats 3-4):
     $$\mathcal{P}_{4/4} = \{ [w], [h, h], [qd, 8 \text{ across 2 beats}], [8, qd \text{ across 2 beats}], [1+1+1+1 \text{ beats}] \}$$
   - Two-beat groups evaluate $[h]$, $[qd, 8]$, $[8, qd]$, or independent 1-beat subdivisions.
   - One-beat units evaluate $[q]$, $[8d, 16]$, $[8, 8]$, or 16th-note groupings.

4. **Tied Notes Engine**:
   - When `settings.ties` is active, candidate rhythmic events spanning metric beat boundaries are linked via `tieStart` and `tieEnd` flags.
   - Ties strictly preserve pitch identity across noteheads ($p_{i+1} = p_i$) and are rendered via VexFlow `StaveTie`.

### Melodic Generator (Ergodic Markov Random Walk)
1. **Strongly Connected Pitch Digraph**:
   - The allowed pitches within the clef's range forms a finite state graph $V$.
   - Edges $E$ are defined by active interval constraints ($\pm 1$ step, skips, leaps).
   - Because the graph is undirected (or symmetric) and strongly connected, the Markov chain is irreducible and recurrent.
2. **Boundary Reflection Bias**:
   - As pitch approaches upper/lower ledger limits ($\ge 2$ ledger lines), transition weights bias inward to prevent clipping without truncating state reachability.
3. **Scale Degrees & Accidentals**:
   - Natural diatonic scales (C Major / A Minor) map cleanly to staff lines/spaces.
   - When chromatic accidentals are enabled, inflected pitches are sampled uniformly over the chromatic gamut.

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

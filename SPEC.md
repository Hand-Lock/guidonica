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
1. **Zero Framework Bloat (Vanilla TypeScript)**: Direct DOM APIs and native canvas contexts; no React/Vue/Svelte virtual DOM overhead (~125 kB gzipped JS, VexFlow included).
2. **Single Authoritative Hardware Clock (`AudioContext.currentTime`)**: Synchronizes audio synthesis and the visual scroller to eliminate visual-auditory drift mathematically.
3. **GPU Measure Blitting Pipeline**: Offscreen VexFlow measure caching rendered once; the 60/120 FPS animation loop purely executes `ctx.drawImage()`, keeping CPU usage < 1%.
4. **Bounded Ring-Buffer Memory Discipline**: Only 4 to 6 measures kept in memory; expired canvases are immediately dereferenced for leak-free infinite sessions.
5. **Sample-Free Audio Synthesis**: Metronome clicks synthesized live via Web Audio oscillators; 0 bytes of audio sample files over the wire.
6. **Pure CSS3 Liquid Glass UI**: 100% vector and CSS3-powered Frutiger Aero / Aqua styling; zero CSS framework runtimes (~7.9 kB gzipped CSS).
7. **Ergodic State-Space Completeness**: Procedural algorithms never artificially censor or prune mathematically and grammatically valid permutations of the user's active settings ($P(\omega) > 0, \forall \omega \in \Omega$). All rhythm partitioning and pitch walks are strictly ergodic.

---

## 2. Core User-Configurable Parameters

The user must have full control over the generation engine prior to and during a session:

1. **Tempo (BPM)**:
   - Range: 30 to 240 BPM.
   - Increments: 1 BPM (slider + precision numeric input + keyboard shortcuts).
2. **Time Signature**:
   - Common meters: `2/4`, `3/4`, `4/4` (simple) and `6/8`, `9/8`, `12/8` (compound, beat = ♩.). 9/8 reads like 3/4 and 12/8 like 4/4, one level up (ADR 0076).
   - **Compound pulse**: in 6/8, 9/8 and 12/8 the click sounds on every dotted-quarter beat (default) or on every eighth.
   - The generator ensures each measure strictly satisfies the metric beat count and beaming conventions of the selected meter.
3. **Clef**:
   - Complete **Setticlavio** system (8 historical vocal/instrumental clefs):
     - **Treble (G2)** (`treble`): G clef on line 2, range E3 – F6 at the default ±3 ledger lines.
     - **Soprano (C1)** (`soprano`): C clef on line 1, range C3 – D6 at the default ±3 ledger lines.
     - **Mezzo-Soprano (C2)** (`mezzo-soprano`): C clef on line 2, range A2 – B5 at the default ±3 ledger lines.
     - **Alto (C3)** (`alto`): C clef on line 3, range F2 – G5 at the default ±3 ledger lines.
     - **Tenor (C4)** (`tenor`): C clef on line 4, range D2 – E5 at the default ±3 ledger lines.
     - **Baritone (F3)** (`baritone-f`): F clef on line 3, range B1 – C5 at the default ±3 ledger lines.
     - **Baritone (C5)** (`baritone-c`): C clef on line 5, range B1 – C5 at the default ±3 ledger lines.
     - **Bass (F4)** (`bass`): F clef on line 4, range G1 – A4 at the default ±3 ledger lines.
   - **Ledger lines** (`ledgerLines: { above, below }`): two selectors next to the clef choose how many ledger lines appear above and below the staff, 0–3 each (default 3/3). $n$ ledger lines on a side reach the space beyond the $n$-th ledger line, so 0 still allows the space just outside the staff. The range hint under the clef shows the resulting bounds (e.g. `E3 – F6`).
   - Pitches are strictly constrained to the chosen range: the staff plus the selected ledger lines, $11 + 2(	ext{above} + 	ext{below})$ diatonic pitches (23 at the default ±3, 11 at 0/0). The 0–3 cap fits the fixed 220 px measure canvas.
4. **Subdivisions & Rhythmic Vocabulary**:
   - Granular toggles allowing any combination of:
     - Whole notes (`1`)
     - Half notes (`1/2`)
     - Quarter notes (`1/4`)
     - Eighth notes (`1/8`)
     - Sixteenth notes (`1/16`)
     - Thirty-second notes (`1/32`); no 32nd-note tuplets
     - Tuplets via a name × value matrix (duplet … septuplet × ¼, ⅛, 1/16). Only cells that make metric sense in the current meter are enabled (`TUPLET_SUPPORT` in `src/notation/types.ts`); the rest are greyed out and ignored by the generator:
       - **2/4, 3/4, 4/4**: triplet ¼/⅛/1/16; quintuplet, sextuplet, septuplet ⅛/1/16.
       - **3/4 only**: duplet ¼ (2:3 across the bar), quadruplet ¼ and ⅛ (4:3).
       - **4/4 only**: quintuplet, sextuplet, septuplet ¼ (across the whole bar).
       - **6/8, 9/8, 12/8**: duplet and quadruplet ¼ (across two compound beats: beat 1 in 6/8, beat 1 or 3 in 12/8, beat 1 or 2 in 9/8), ⅛ (per compound beat) and 1/16 (per half compound beat); triplet 1/16.
   - **Dotted notes modifier**: Explicit toggle allowing dotted durations (`hd`, `qd`, `8d`, `16d`) when combined with enabled base durations.
   - **Tied notes toggle**: Explicit toggle allowing ties with pitch preservation wherever engraving requires one: across beats no single notehead can span (e.g. the middle of a 4/4 bar, the dotted beat in 6/8), across tuplet boundaries, and across the barline (chains allowed). Redundant ties that a single note already expresses (`q~q` on beat 1 = `h`) never appear.
   - **Rest toggle**: Option to enable/disable rests, spelled on the beat grid (a silent bar is one whole rest).
5. **Melodic Intervals & Pitch Transitions**:
   - Selectable transition constraints:
     - *Stepwise only (Seconds)*: Scales, adjacent notes ($\pm 1$ diatonic step).
     - *Thirds / Triadic skips*: Allows leaps up to diatonic thirds/fourths.
     - *Octave leaps*: Allows wide jumps and octave displacement.
     - *Any interval*: Unrestricted random walk within clef range.
   - Tonality: Natural notes (diatonic C Major / A Minor) as the clean default baseline, with optional chromatic accidental toggles.
   - **Notes (pitch classes)**: seven toggles C … B, each applying in every octave of the clef and ledger-line range; at least one stays selected (default: all). Chip text follows the Labels setting (letters or syllables; with Labels off, the language's convention). Interval classes that no two selected notes can span are dimmed; if none of the selected moving intervals can occur, every interval that joins two selected notes is used and a hint says so (ADR 0070).
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
$$\Omega = (\text{Clef}, \text{TimeSignature}, \text{Subdivisions}, \text{Dotted}, \text{Ties}, \text{Intervals}, \text{Notes}, \text{Accidentals})$$

A generated measure $M = (r_1, p_1), (r_2, p_2), \dots, (r_k, p_k)$ consists of a sequence of durations $r_i$ and pitches $p_i$. Let $\mathcal{M}(\Omega)$ denote the set of all syntactically and grammatically valid measures conforming to $\Omega$. The generator is strictly ergodic:
$$\forall M \in \mathcal{M}(\Omega), \quad P(M \mid \Omega) > 0$$

Given an arbitrarily long practice session, the empirical distribution of generated figures converges to the uniform or stationary measure over $\mathcal{M}(\Omega)$. No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or melodic skip within the user's settings may have probability zero.

### Rhythmic Generator: Grammar-Driven Sampler (ADR 0065)
Rhythm is sampled left to right over a **32nd grid**: 8 units per quarter beat in simple meters, 4 per eighth in compound meters (a 4/4 bar is 32 units, 3/4 and 6/8 are 24, 2/4 is 16, 9/8 is 36, 12/8 is 48). The placement tables below are the only definition of legality; the sampler derives everything else from them.

1. **Values in play**: every enabled base value plus, with dotted on, its dotted form (`hd`, `qd`, `8d`, `16d`; whole adds `wd`, placeable only in 12/8). With nothing selected, quarters. The alphabet is strict (ADR 0066): a dotted value only completes a beat beside a shorter partner, so `8d` needs 16 or 32, `16d` needs 32, and `qd` in 4/4 and 2/4 needs 8, 16 or 32. Without its partner the value stays in the alphabet but no bar contains it (the dotted toggle's tooltip says so). Values longer than the bar or its legal placements (`w` outside 4/4, `h` in compound meters, `wd` outside 12/8, `hd` in 2/4) are likewise never written. `tests/generator.test.ts` pins this dormant list for all 4 × 128 subdivision sets.
2. **Grammar** (`rhythmGrammar`, memoized per meter/values/tuplet cells, at most 64 entries). At each grid point $u$ the candidate steps are:
   - every value whose notehead the placement table accepts at $u$ (canonical or tolerated) and that fits in the bar;
   - every enabled tuplet cell whose `TUPLET_PLACEMENTS` grid contains $u$ and whose group fits.

   A **backward pass** marks the completable points ($c[\text{bar}] = 1$, $c[u] = \exists$ step $s$ at $u$ with $c[u + |s|]$) and keeps only steps that land on one, so sampling never reaches a dead end. A **forward pass** records which values and cells occur in at least one complete bar.
3. **Beat-unit fallback**: the beat unit (`q`; `8` in compound meters) is added only if the enabled values cannot fill a bar (whole notes alone in 3/4, quarters alone in 6/8), or if it makes an enabled value or cell reachable that otherwise is not (`hd` in 4/4 with half and dotted only). Nothing else is ever added.
4. **Sampling** (`composeRhythm`): at each grid point, a uniform draw among the note steps plus one aggregate "tuplet" option, which then picks a tuplet step uniformly. Every kept step lies on a complete bar, so every legal bar has $P(M) = \prod_i 1/(|\text{notes}(u_i)| + [\text{tuplets}(u_i) \ne \emptyset]) \cdot \ldots > 0$, and many enabled tuplet cells do not crowd out plain figures.
5. **Tuplet placements** (`TUPLET_PLACEMENTS`, keys = `TUPLET_SUPPORT[ts]`, span = `tupletSpan()`): half-beat groups (`triplet:1/16`) on every half beat; one-beat groups on every beat; two-beat groups on beat 1 (and 3 in 4/4; in 3/4 beat 1 or 2); bar-long groups only at 0. In compound meters: `triplet:1/16` on every eighth, `duplet/quadruplet:1/16` every 1.5 eighths, `duplet/quadruplet:1/8` every 3 eighths, `duplet/quadruplet:1/4` at 0 (6/8), 0 or 6 (12/8), 0 or 3 (9/8).
6. **Tuplet members** (ADR 0066): a group of $n$ units is split into $m \ge 2$ members, each one enabled notehead of 1, 2, 3, 4 or 6 units (`3[q 8]`, `5[q 8 8 8]`, dotted members only with dotted on). `tupletCompositions` enumerates every such composition ($n \le 7$, so at most 64), grouped by $m$. The member count $m$ is uniform over the feasible counts, then the composition is uniform among those with $m$ parts: $P(c) = 1 / (|M| \cdot |C_m|)$. A triplet is `[1 1 1]` ½, `[2 1]` and `[1 2]` ¼ each; the rarest quintuplet-of-quarters shape is $1/24$ per group.
7. **Rests** (rests on): silence is a two-state chain over plain notes and 1-, 2- or 4-unit tuplet members, carried across tuplet groups and barlines (ADR 0066). An item is silent with $p_s = 0.1$ (`SILENCE_PROBABILITY`) after a sounding item and $p_c = 0.5$ (`SILENCE_CONTINUE_PROBABILITY`) after a silent one; a dotted tuplet member is always sounding. A $k$-item silence costs $p_s \cdot p_c^{k-1}$, not $p_s^k$, so long rests and silent bars stay within a practice session; the stationary rest share is $p_s / (p_s + 1 - p_c) = 1/6$. A group is never all rests (the chain is redrawn from its state before the group); adjacent silent members combine into the longest undotted rest. Each run of plain rests is re-spelled by `spellRest` from the **rest placement table** (`REST_PLACEMENTS`, metric beats):
   - 4/4: h on either half of the bar; q, 8, 16, 32 on multiples of their own span (also 3/4, 2/4).
   - 6/8, 9/8, 12/8: qd and q at a group start (every 3 eighths); 8, 16, 32 on multiples of their own span. 12/8 adds hd on either half of the bar (like the 4/4 half rest); 9/8 has none (like 3/4).
   - No rest is dotted except the compound-beat `qd` and the 12/8 half-bar `hd`. The spelling is greedy (longest legal rest first), preferring enabled values: with quarters only, a silent syncopated `q` is `8r 8r`, and no half rest appears when half notes are off.
   - **A silence over the whole bar is always one whole rest**, in every meter, hanging from the fourth line and centred in the bar.

8. **Tied Notes Engine**:
   - Ties are **notation, not decoration**: a tie appears only where no single well-placed notehead can express the sound. The grammar lives in `src/notation/ties.ts` and is independent of the subdivision/dotted toggles.
   - **Notehead placement table** (`NOTEHEAD_PLACEMENTS`, units = metric beats: quarters in simple meters, eighths in compound meters). Each value lists a period and the offsets where one notehead may start; a note must also fit in the bar. Placements are *canonical* or *tolerated*:
     - 4/4: w:4→[0]; hd:4→[0] (+tolerated 1); h:2→[0] (+tolerated 1); qd:2→[0,.5]; q:2→[0,.5,1]; 8d:1→[0,.25]; 8:1→[0,.25,.5]; 16:.5→[0,.125,.25]; 16d:.5→[0,.125]; 32:.125→[0].
     - 2/4: h:2→[0]; qd, q, 8d, 8, 16, 16d, 32 as in 4/4.
     - 3/4: hd:3→[0]; h:3→[0,1]; qd:.5→[0]; q:.5→[0]; 8d, 8, 16, 16d, 32 as in 4/4.
     - 6/8: hd:6→[0]; qd:3→[0]; q:3→[0,1]; 8d:3→[0,1]; 8:1→[0]; 16:1→[0,.25,.5]; 16d:1→[0,.25]; 32:.25→[0]. Sub-eighth values (16, 16d, 32) never cross their eighth; 16 on the middle 32nd is the `32 16 32` figure. `h` (4 eighths) has no placement, so that sound is always tied.
     - 9/8: hd:9→[0,3] (`hd qd` and `qd hd`, like 3/4 `h q` and `q h`); qd down to 32 as in 6/8.
     - 12/8: wd:12→[0]; hd:6→[0] (+tolerated 3, like 4/4 `q h q`); qd down to 32 as in 6/8. `h` and `w` have no placement in any compound meter.
   - The sampler writes only canonical or tolerated noteheads: the grammar draws its note steps from this table.
   - **Legality.** A tie $a \frown b$ is legal iff both are sounding (never rests) and either the boundary is the **barline**, or $a$/$b$ belong to different tuplet contexts (no notehead spans tuplet and non-tuplet time), or the merged span $(\text{offset}(a), d_a + d_b)$ is **not canonical** (not a note value, misplaced, or only tolerated). Inside one tuplet group, the merged length in tuplet units must not be 1, 2, 3, 4 or 6 (`TUPLET_NOTEHEAD_UNITS`), i.e. not one member notehead: in a quintuplet of eighths `8~8`, `q~8` and `q~q` never appear, `q~qd` (5 units) may. Consequently ties never fall strictly inside a beat, `q~q` on beat 1, `qd~8`, `h~h`, 6/8 and 9/8 `qd~qd` and 12/8 `qd~qd` on beat 1 or 3 never appear, while `q q~q q` and `8 qd~8` across the 4/4 middle 6/8 `8~8` across the dotted beat and 12/8 `qd~qd` across the middle do.
   - **Chain minimality.** When $b$ extends a chain $c_1 \frown \dots \frown a$ inside the bar, no suffix merge $(c_i \dots a) + b$ may be canonical, so every chain is the shortest spelling.
   - **Sampling.** `applyTies` ties every legal inner pair independently with $p_{\text{tie}} = 0.25$. The barline pair is decided with a one-measure rhythm lookahead (the next bar is composed early), tied with the same $p$ when both notes sound, and the tied note keeps the previous bar's pitch. A skipped measure index (background-tab catch-up) or a session reset drops the pending tie.
   - **Ergodicity** is defined over the legal tied grammar: every legal tied spelling, including chains across several barlines, ties into or out of tuplets and legal ties inside a group, has $P > 0$.
   - Ties strictly preserve pitch identity across noteheads ($p_{i+1} = p_i$). Inner ties use VexFlow `StaveTie`; a cross-barline tie is drawn whole by both measures in their own coordinates and each canvas clips its half, so contiguous blitting shows one continuous arc.

### Melodic Generator (Ergodic Markov Random Walk)
1. **Strongly Connected Pitch Digraph**:
   - The allowed pitches form a finite state graph $V$: the sorted diatonic steps within the clef's range whose pitch class is selected (all seven by default; ADR 0070).
   - Edges $E$ are defined by active interval constraints ($\pm 1$ step, skips, leaps).
   - Because the graph is undirected (or symmetric) and strongly connected, the Markov chain is irreducible and recurrent.
   - Repeated notes are damped, not capped: after $u$ consecutive unisons the unison weight is $1/(1+u)$ against 1 for every other interval class, so any run length stays reachable.
   - The `9+` interval class picks a direction that has a pool pitch at least 8 steps away, then any such pitch uniformly, so every leap up to the full clef range is reachable.
   - **Pitch bounds** are diatonic step arithmetic ($\text{step} = 7 \cdot \text{octave} + \text{letter index}$) from the clef's bottom staff line $b$: $\text{low} = b - (2 \cdot \text{below} + 1)$, $\text{high} = b + 8 + (2 \cdot \text{above} + 1)$.
   - **Effective intervals** (`effectiveIntervals`, ADR 0070): an interval class is *realizable* if some pair of pool pitches spans it (`9+`: the pool spans $\ge 8$ steps; unison always). The walk uses the selected realizable classes. If the user selected a moving class but none is realizable, every realizable moving class is used instead (the graph is then complete: any two pitches are $d \le 7$ or $d \ge 8$ apart). Unison only stays unison only; a one-pitch pool repeats its note. The UI dims the unrealizable chips and shows a hint while the fallback is active.
   - **Connected start** (`startIndex`, ADR 0066, 0070): a pitch is *live* if at least one effective interval has a target from it. The session's first note is the pool pitch nearest the clef's default anchor clamped into $[\text{low}, \text{high}]$ (the lower one on a tie) when the anchor is live and its component of the interval graph holds every live pitch (every connected set, so every preset). Otherwise (thirds only reach the lines or the spaces, fourths and fifths a few residues, unison never moves) it is a uniformly random live pitch, so every component and every melody inside it has $P > 0$ per session.
   - **Feasibility filter**: before the weighted pick, interval classes with no target from the current pitch are dropped (a step $s$ has a target if a pool pitch lies exactly $s$ steps above or below; `9+` if one lies $\ge 8$ steps away; unison always) and the weights renormalize, so every in-range move keeps $P > 0$ and no interval is mislabeled by clamping. At the default ±3 (23 notes) the filter never removes anything.
   - **No dead ends**: every move is reversible (a move by $s$ between two pool pitches is a move by $s$ back; a `9+` leap of $s \ge 8$ leaves a `9+` leap back), so from a live start some selected interval always fits and every written interval is a selected one. There is no fallback move.
2. **Symmetric Walk**:
   - When an interval has a target both up and down, the direction is a fair coin. The feasibility filter alone keeps the walk in range, so no inward bias is applied (ADR 0065). The walk reflects at the edges, so with all intervals the edge notes still come up about half as often as the middle (measured ratio 1.9); every note keeps $P > 0$ and this is left as is (ADR 0066).
3. **Scale Degrees & Accidentals**:
   - Natural diatonic scales (C Major / A Minor) map cleanly to staff lines/spaces.
   - When chromatic accidentals are enabled, inflected pitches are sampled uniformly over the chromatic gamut. *Not yet implemented: the app is diatonic only, so the Accidentals axis of $\Omega$ is a single point (ADR 0066).*

---

## 5. Audio & Metronome Synchronization

### Drift-Free Clock Architecture
- The audio engine is built directly on the browser's native **Web Audio API**.
- `AudioContext.currentTime` serves as the authoritative, hardware-synchronized clock for both audio scheduling and visual scroll offsets.
- Formula for scroll offset at any frame (output latency $\lambda$ = `outputLatency || baseLatency`, so notes cross the playhead when the click is *heard*):
  $$\text{elapsedSeconds} = \text{AudioContext.currentTime} - \lambda - t_{\text{start}}$$
  $$\text{scrollX} = \text{elapsedSeconds} \times v$$
- The beat indicator is derived from the same clock inside the single rAF loop (`getBeatInfo()`); there are no `setTimeout` visual clocks.
- Because the animation loop calculates position directly from `AudioContext.currentTime`, visual jitter and audio drift are mathematically eliminated, even under CPU load spikes or background tab throttling.

### Metronome Synthesis
- Synthesized clicks using native `OscillatorNode` and exponential `GainNode` envelopes (zero external audio file dependencies).
- Distinct timbres:
  - **Beat 1 (Downbeat)**: Higher frequency accent pulse (e.g., 1200 Hz).
  - **Secondary beat** (4/4 beat 3; 6/8 beat 4; 9/8 beats 4, 7; 12/8 beats 4, 7, 10): Medium accent pulse between the two (ADR 0072, 0076).
  - **Other Beats**: Lower frequency pulse (e.g., 800 Hz).
- The beat LEDs follow the same three levels: ruby downbeat, orange secondary beat, turquoise weak beats, each a little smaller than the one before (ADR 0072). In compound meters the LEDs read in threes: the one that starts each dotted-quarter beat is full size, the two eighths after it are small dots (ADR 0076).

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
  - Notes (pitch-class) toggles
  - Intervals selector
- Live visual indicator for the active beat / count-in.

### Onboarding & Level Presets
- On a first visit, the welcome step also shows the five languages as endonym chips (English · Italiano · Français · Deutsch · Español), preselected from the browser language; picking one re-translates the intro at once. Later visits omit the chips; the language stays changeable in Settings → Practice.
- On a first visit (no saved settings, no onboarding flag), a three-step intro asks **"What's your level?"** (Beginner · Elementary · Intermediate · Advanced · Virtuoso), then **"Which clef would you like to read?"** (Treble · Bass · Alto · Tenor), then **"Which time signature would you like to read?"** (4/4 · 3/4 · 2/4 · 6/8 · 9/8 · 12/8, each described in metric terms only, e.g. "Compound duple · two dotted-quarter beats of three eighths"; see ADR 0071).
- The answers load a preset of existing, user-visible settings: tempo, ledger lines, note values, dotted notes, rests, ties, tuplets, intervals, notes, labels and count-in, in the chosen meter. In compound meters, which have no triplets, Intermediate and Advanced use the duplets of the same value instead (ADR 0071). Beginner reads the do-pentatonic (C D E G A) at 60 BPM with 2nds and 3rds; Elementary (70 BPM) adds every note, 4ths, 5ths and octaves; Intermediate (80 BPM) every interval up to the octave and 16ths; Advanced (90 BPM) every leap and 32nds; Virtuoso (120 BPM) everything (ADR 0070). Theme, volume, zoom and sound are left unchanged.
- "Skip", Esc or a click outside keeps the defaults and never asks again. The header Level button reopens it at any time. Its five-bar meter lights up to the current level, or stays dim with the label "Custom" when the settings match no preset (see ADR 0053).
- Presets never alter the generator; every preset is an ordinary point of the configuration space Ω (see ADR 0049).
- Level cards show freshly generated examples from a narrowed, published sub-configuration of each preset (toggles only switched off, Ω_preview ⊆ Ω_preset), so each card shows the figures typical of its level (see ADR 0051).
- From the second visit on, one short tip per visit appears at the top of the stage, unless the intro, "What's new", a shared link or the landscape tip is showing. Most point to a feature the user's settings and device don't use yet; one in four asks to follow Guidonica or support it on Ko-fi. Start, the close button or the Tips chip in Settings → Practice hides it (see ADR 0087).

### Localization & National Note Naming
- The interface is available in English, Italian, French, German and Spanish (see ADR 0059). The default is the first supported browser language, else English; the choice is saved with the settings but is not part of any level preset.
- The language also sets the note-naming convention. Note labels are *None*, *Syllables* or *Letters*, spelled nationally:
  - English: Do Re Mi Fa Sol La Ti.
  - Italian and Spanish: … La Si.
  - French: Do Ré Mi …
  - German: Do Re Mi Fa So La Ti, and letters with H for B natural.
- The clef range hint uses each country's octave convention:
  - scientific "E3 – F6" in English;
  - Franco-Belgian "Mi2 – Fa5" (Do3 = middle C) in Italian, French and Spanish;
  - Helmholtz "e – f³" (c¹ = middle C) in German.
  - Its tooltip names middle C.
- Tempo terms (Grave … Prestissimo) and "BPM" stay untranslated, as universal musical vocabulary.
- Non-English pages stay hidden until their dictionary has loaded, so no English text flashes.

### Releases & Update Notes
- guidonica.it serves the latest tagged release; guidonica.it/nightly/ serves the latest commit, marked "Nightly", hidden from search engines, with its own settings, onboarding and offline cache (see ADR 0078). Versions are calendar-based, `YEAR.MONTH.MICRO`.
- After an update, a returning user sees a "What's new" dialog listing every release since their last visit, newest first, in the interface language. A first-time user never sees it, and a notes file that cannot load (offline) is simply retried on a later visit. About shows the running version, linking to its release (or, on nightly, its commit), and a "What's new" button with the full history.

### Keyboard Controls
- `Space`: Toggle Play / Pause.
- `R` or `Escape`: Reset session to start.
- `ArrowUp` / `ArrowDown`: Increment / decrement tempo by 5 BPM.
- `Shift + ArrowUp` / `Shift + ArrowDown`: Increment / decrement tempo by 1 BPM.
- `+` / `=`: Zoom in (+10%).
- `-` / `_`: Zoom out (-10%).
- `0`: Auto-fit zoom to screen (Auto Zoom).

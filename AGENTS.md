# Agent Guidelines & Repository Hygiene: Guidonica

## 1. Project Overview & Philosophy
**Guidonica** is a high-performance, client-only web tool for sight-reading and solfège practice, inspired by Guido d'Arezzo's historic *manus guidonica* pedagogy. It continuously streams procedurally generated music notation across a fixed playhead in synchronization with a synthesized metronome.

### Suckless Engineering Philosophy
The core software architecture is strictly governed by an uncompromising "suckless", ultra-lightweight, and zero-bloat engineering philosophy:
- **Zero Framework Bloat**: No React, Vue, Svelte, or Angular. Written in **Vanilla TypeScript** driving native DOM APIs, HTML5 Canvas, and Web Audio API directly. Zero virtual DOM reconciliation, zero runtime reactivity overhead, zero state management dependencies. Total application JS (excluding VexFlow) is ~13.6 kB gzipped.
- **Single Source of Truth Hardware Clock**: Visual motion and synthesized metronome audio clicks are mathematically linked to the hardware audio clock (`AudioContext.currentTime`). Never introduce independent `setInterval`, `setTimeout`, or visual time accumulators. Visual-auditory drift is mathematically impossible; noteheads cross the playhead at the exact physical microsecond the speaker clicks.
- **Hardware-Accelerated Measure Blitting**: VexFlow layout and font glyph rasterization execute **once** onto an offscreen canvas per measure. The 60/120 FPS animation loop (`requestAnimationFrame`) exclusively executes GPU-accelerated bit-block transfers (`ctx.drawImage()`). Zero per-frame layout, zero font parsing, sub-millisecond per-frame CPU time (< 1% CPU utilization).
- **Bounded Ring-Buffer & Zero-Leak Memory Discipline**: Only 4 to 6 measures exist in memory at any time. Measures scrolling past the left edge are immediately evicted and their offscreen canvases dereferenced. An infinite 3-hour practice session maintains the exact same memory footprint (~30–45 MB process memory) as a 5-second test.
- **Synthesized Audio (0-Byte Sample Downloads)**: Metronome clicks and woodblock timbres are synthesized live on the audio hardware using native Web Audio `OscillatorNode` (sine/triangle) and exponential `GainNode` envelopes. Zero audio files (MP3/WAV/OGG) downloaded over the network.
- **Pure Mathematical Generation**: Rhythms are partitioned via recursive metric tree subdivision based on exact rational time signature fractions. Pitches are generated via a discrete Markov random walk with boundary bias. Zero heavy music theory AI or rule engines.
- **The Ergodic Generation Principle (State-Space Completeness)**: The music generator is strictly ergodic (the "infinite monkey theorem" heuristic). For any user-selected parameter configuration $\Omega = (\text{Clef}, \text{TimeSig}, \text{Subdivisions}, \text{Dotted}, \text{Ties}, \text{Intervals}, \text{Accidentals})$, *every mathematically and grammatically valid permutation within $\Omega$ must possess a strictly non-zero generation probability ($P(\omega) > 0, \forall \omega \in \Omega$)*. No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or interval leap may be artificially suppressed, hijacked, or hardcoded out of existence. Generation rules must remain transparent, organized, and complete.
- **Pure CSS3 Liquid Glass & Zero CSS Frameworks**: The entire Frutiger Aero / Aqua / Liquid Glass visual design is constructed via pure, hardware-composited CSS3 (`backdrop-filter`, multi-stop linear/radial gradients, beveled shadows). Zero Tailwind runtime, zero CSS-in-JS libraries, zero sprite textures. Total CSS is ~5.4 kB gzipped.
- **Strict Typing, Zero Silent Errors**: TypeScript with `strict: true`. Avoid `any`. Catch duration arithmetic mismatches, null pointers, and VexFlow type incompatibilities at compile time. Instant build in < 800ms.

### Authoritative Specification
- Consult [`SPEC.md`](SPEC.md) in the project root for the complete functional specification, metric linearity formulas, and musical generation requirements.
- Consult [`docs/DESIGN_MANIFESTO.md`](docs/DESIGN_MANIFESTO.md) for the authoritative Aero-Guidonica visual styling and ergonomics manual.

---

## 2. Directory Structure & Architecture

```
guidonica/
├── AGENTS.md               # Strict developer & agent rules (this file)
├── SPEC.md                 # Product and pedagogical specification
├── package.json            # Minimal dependencies (vite, typescript, vexflow)
├── tsconfig.json           # Strict TypeScript configuration
├── vite.config.ts          # Minimal Vite configuration
├── index.html              # Minimal semantic HTML shell
├── docs/
│   ├── DESIGN_MANIFESTO.md # Aero-Guidonica design manifesto and visual rules
│   └── adr/                # Architectural Decision Records & implementation notes
│       ├── README.md       # ADR index and registration log
│       └── 0001-*.md       # Specific architectural & subsystem records
└── src/
    ├── main.ts             # Application bootstrapper and UI event wiring
    ├── state.ts            # Typed session state and parameter interfaces
    ├── style.css           # Clean light-mode styles and accent colors
    ├── audio/
    │   └── metronome.ts    # Web Audio oscillator synthesis & clock scheduler
    ├── notation/
    │   ├── generator.ts    # Procedural rhythm partitioner & pitch random-walk
    │   ├── renderer.ts     # VexFlow offscreen measure canvas builder
    │   ├── ties.ts         # Tie grammar: notehead placement table & tie legality
    │   └── types.ts        # Musical data types (Note, Measure, Clef, TimeSignature)
    └── scroller/
        ├── scroller.ts     # Viewport canvas manager, rAF loop, measure blitting
        └── buffer.ts       # Active measure ring-buffer & disposal pipeline
```

---

## 3. Strict Coding & Hygiene Rules

1. **Type Safety & Compile Checks**:
   - Always run `npm run typecheck` (`tsc --noEmit`) before committing code. All code must compile with zero errors and zero warnings.
   - Do not use `any` unless wrapping an un-typed third-party dynamic property. Create explicit interfaces and type unions (e.g., `type Clef = 'treble' | 'bass' | 'alto' | 'tenor';`).
   - Prefer type guards and explicit null checks over non-null assertions (`!`).

2. **Memory & Garbage Collection Discipline**:
   - In an infinite scroller, memory leaks quickly degrade performance.
   - Measures that scroll past the left edge of the viewport must be cleanly evicted from the measure ring-buffer.
   - Do not retain references to offscreen canvases that are no longer visible.

3. **Audio Safety & Lifecycle**:
   - Modern browsers require user interaction before resuming an `AudioContext`.
   - Never call `audioCtx.resume()` during module initialization. Only initialize or resume `AudioContext` inside a direct user gesture (e.g., clicking "Start" or pressing `Space`).

4. **Clean Code & Styling**:
   - 2 spaces for indentation.
   - No extraneous console logging in production modules (`console.log` should be removed before committing).
   - Strict adherence to the **Aero-Guidonica Design Manifesto** ([`docs/DESIGN_MANIFESTO.md`](docs/DESIGN_MANIFESTO.md)). All visual elements must follow the pure CSS3 Liquid Glass / Frutiger Aero / skeuomorphic tactile physics model without adding external CSS or JS dependencies.

5. **Procedural Ergodicity & Rule Transparency**:
   - Whenever modifying the procedural generator (`src/notation/generator.ts` or related files), you must preserve metric and melodic ergodicity.
   - Never introduce hardcoded duration substitutions, silent omissions of valid rhythms, or hidden heuristics that reduce the reachable state space.
   - All musical capabilities (e.g., dotted notes, ties, rests) must be transparently controllable by the user and mathematically reachable in the generator's partition tree.

---

## 4. Architectural Decision Records (ADRs) & Knowledge Continuity

1. **ADR Repository (`docs/adr/`)**:
   - Whenever a subsystem is designed, an architectural choice is made, or an implementation method is introduced/modified, the agent must document it in `docs/adr/` and register it in `docs/adr/README.md`.
   - Each ADR must specify: Status, Date, Context/Problem, Decisions & Implementation Methods (with math/code rationale), and Consequences.
2. **LLM Knowledge Retention**:
   - The ADRs serve as the persistent source of truth so future LLM agents know with certainty what has been developed, which algorithms are active, and why specific engineering decisions were made.

---

## 5. Git & Version Control Hygiene

1. **Mandatory Commit & Push Upon Task Completion**:
   - **Every time you finish a task requested by the user, you MUST create a git commit AND push it to remote (`git push origin main`).**
   - Pushing to `origin/main` automatically triggers the GitHub Actions CI/CD deployment pipeline (`.github/workflows/deploy.yml`), ensuring changes are immediately compiled, tested, and published live to GitHub Pages.
   - The commit message must be written by the agent following Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`).
   - Always execute macOS Keychain loading before pushing in background agent subshells:
     ```bash
     ssh-add --apple-load-keychain 2>&1 && git push origin main
     ```
   - Never leave uncommitted or unpushed changes at the end of a completed task unless explicitly instructed by the user.
2. **Repository Setup**:
   - Keep the repository self-contained and reproducible.
   - `.gitignore` must ignore `node_modules/`, `dist/`, `.DS_Store`, and temporary test artifacts.
3. **Cross-Machine Reproducibility**:
   - Any developer on another machine must be able to run:
     ```bash
     git clone <repo-url>
     cd guidonica
     pnpm install   # or npm install
     pnpm dev       # or npm run dev
     ```
   - No global binaries or environment variables should be assumed.
4. **macOS SSH Keychain Authentication**:
   - The user's SSH key passphrase is saved in macOS Keychain. When running `git push origin main` in background agent or non-interactive subshells, run `ssh-add --apple-load-keychain` first to ensure the identity is loaded without interactive prompts.
5. **Node.js & pnpm Runtime Requirement**:
   - `pnpm@11.8.0` requires **Node.js >= 22.13** (due to dependency on `node:sqlite`). All environments, `.nvmrc`, and CI runners must target Node 22+.

---

## 6. Development & Verification Workflow

- **Node.js Version**: Node 22+ (`node -v` >= 22.13.0)
- **Install Dependencies**: `pnpm install` (or `npm install`)
- **Start Dev Server**: `pnpm dev` (or `npm run dev`)
- **Typecheck**: `pnpm typecheck` (or `npm run typecheck`)
- **Production Build**: `pnpm build` (or `npm run build`)
- **Preview Build**: `pnpm preview` (or `npm run preview`)

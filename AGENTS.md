# Agent Guidelines & Repository Hygiene: Solfège Scroller

## 1. Project Overview & Philosophy
**Solfège Scroller** is a high-performance, client-only web tool for sight-reading and solfège practice. It continuously streams procedurally generated music notation across a fixed playhead in synchronization with a synthesized metronome.

### Suckless Engineering Philosophy
- **Zero Framework Bloat**: No React, Vue, Svelte, or Angular. This application is written in **Vanilla TypeScript** driving native DOM APIs, HTML5 Canvas, and Web Audio API directly. Virtual DOM diffing and framework runtime overhead degrade frame pacing and add unnecessary maintenance burden.
- **Strict Typing, Zero Silent Errors**: TypeScript with `strict: true`. Avoid `any`. Catch duration arithmetic mismatches, null pointers, and VexFlow type incompatibilities at compile time.
- **Single Source of Truth Clock**: The audio and visual engines are synchronized using the hardware clock (`AudioContext.currentTime`). Never introduce independent `setInterval` or `setTimeout` visual clocks.
- **Hardware-Accelerated Blitting**: VexFlow renders measures once to offscreen canvases. The animation loop (`requestAnimationFrame`) merely blits pre-rendered measure canvases to the viewport using GPU-accelerated `drawImage`. Never execute full VexFlow layout or font parsing per frame.

### Authoritative Specification
- Consult [`SPEC.md`](SPEC.md) in the project root for the complete functional specification, metric linearity formulas, and musical generation requirements.

---

## 2. Directory Structure & Architecture

```
solfege-scroller/
├── AGENTS.md               # Strict developer & agent rules (this file)
├── SPEC.md                 # Product and pedagogical specification
├── package.json            # Minimal dependencies (vite, typescript, vexflow)
├── tsconfig.json           # Strict TypeScript configuration
├── vite.config.ts          # Minimal Vite configuration
├── index.html              # Minimal semantic HTML shell
└── src/
    ├── main.ts             # Application bootstrapper and UI event wiring
    ├── state.ts            # Typed session state and parameter interfaces
    ├── audio/
    │   └── metronome.ts    # Web Audio oscillator synthesis & clock scheduler
    ├── notation/
    │   ├── generator.ts    # Procedural rhythm partitioner & pitch random-walk
    │   ├── renderer.ts     # VexFlow offscreen measure canvas builder
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
   - Minimalist, dark-mode CSS with high contrast for music notation readability and a distinct accent color for the playhead.

---

## 4. Git & Version Control Hygiene

1. **Repository Setup**:
   - Keep the repository self-contained and reproducible.
   - `.gitignore` must ignore `node_modules/`, `dist/`, `.DS_Store`, and temporary test artifacts.
2. **Commit Conventions**:
   - Use atomic, descriptive commits following Conventional Commits:
     - `feat:` new feature or generation algorithm
     - `fix:` bug fix or timing correction
     - `refactor:` code reorganization without functional change
     - `perf:` rendering or audio performance optimization
     - `docs:` documentation updates
3. **Cross-Machine Reproducibility**:
   - Any developer on another machine must be able to run:
     ```bash
     git clone <repo-url>
     cd solfege-scroller
     pnpm install   # or npm install
     pnpm dev       # or npm run dev
     ```
   - No global binaries or environment variables should be assumed.

---

## 5. Development & Verification Workflow

- **Install Dependencies**: `pnpm install` (or `npm install`)
- **Start Dev Server**: `pnpm dev` (or `npm run dev`)
- **Typecheck**: `pnpm typecheck` (or `npm run typecheck`)
- **Production Build**: `pnpm build` (or `npm run build`)
- **Preview Build**: `pnpm preview` (or `npm run preview`)

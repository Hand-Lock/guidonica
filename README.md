# Guidonica

> High-performance, client-only web tool for sight-reading and solfège practice. Continuously streams procedurally generated music notation across a fixed playhead in sample-accurate synchronization with a Web Audio synthesized metronome.

**Live Application**: [https://guidonica.it](https://guidonica.it) *(mirror: [hand-lock.github.io/guidonica](https://hand-lock.github.io/guidonica/))* &nbsp;|&nbsp; [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

---

## Heritage & Pedagogical Rationale

**Guidonica** takes its name from **Guido d'Arezzo** (c. 991 – after 1033), the medieval music theorist and monk who created the foundations of Western music pedagogy: modern staff notation, hexachordal solmization (*ut, re, mi, fa, sol, la*), and the **Manus Guidonica** (Guidonian Hand).

The *manus guidonica* was history's first spatial visual-mnemonic sight-singing interface: students mapped musical intervals and syllables directly to physical landmarks on the human hand to internalize real-time pitch recognition. **Guidonica** carries this philosophy into the modern web era, providing a zero-latency, continuous visual stream that trains the musician's eye to scan oncoming intervals and rhythm ahead of the playhead.

---

## The "Suckless" Engineering & Software Performance Philosophy

Guidonica is built on an uncompromising **suckless, ultra-optimized, and lightweight engineering philosophy**, refusing the bloated and sluggish practices of modern web development:

1. **Zero Framework Bloat (Vanilla TypeScript)**:
   - Built with **Vanilla TypeScript** driving native DOM APIs, HTML5 Canvas, and Web Audio directly.
   - No React, Vue, Svelte, Angular, or Virtual DOM diffing.
   - Zero state management libraries (no Redux, Zustand, Pinia).
   - Entire application JavaScript (excluding VexFlow) is only **~13.6 kB gzipped**.
2. **Single Hardware Clock Synchronization (`AudioContext.currentTime`)**:
   - Audio pulse synthesis and the visual scroller are strictly driven by the hardware audio clock (`AudioContext.currentTime`).
   - Zero `setInterval` or `setTimeout` visual drift.
   - Noteheads cross the playhead line at the exact physical microsecond the speaker driver clicks.
3. **Hardware-Accelerated Measure Blitting Pipeline**:
   - VexFlow renders each measure **once** onto an offscreen `HTMLCanvasElement`.
   - The 60/120 FPS animation loop (`requestAnimationFrame`) exclusively executes GPU-accelerated bit-block transfers (`ctx.drawImage()`).
   - Zero per-frame layout recalculations, zero font parsing per frame, sub-millisecond frame rendering (< 1% CPU utilization).
4. **Bounded Ring-Buffer & Zero-Leak Memory Discipline**:
   - Only **4 to 6 measures** exist in memory at any given moment.
   - Measures scrolling past the left edge are immediately evicted and dereferenced.
   - An infinite 3-hour practice session maintains the exact same memory footprint (~30–45 MB total process memory) as a 5-second test.
5. **Synthesized Audio (0-Byte Sample Downloads)**:
   - Metronome clicks and woodblock timbres are synthesized live on the audio hardware using Web Audio `OscillatorNode` and exponential `GainNode` envelopes.
   - Zero audio files (MP3/WAV/OGG) downloaded over the wire.
6. **Pure CSS3 Liquid Glass UI (Zero CSS Frameworks)**:
   - The Frutiger Aero / Aqua / Liquid Glass visual design is rendered with 100% pure, hardware-composited CSS3 (`backdrop-filter`, multi-stop gradients, beveled shadows).
   - Zero Tailwind runtime, zero CSS-in-JS runtimes, zero heavy sprite textures.
   - Total CSS stylesheet is only **~5.4 kB gzipped**.
7. **Retina & High-DPI Support**:
   - Automatically adapts to `window.devicePixelRatio` for razor-sharp engraving on MacBook Retina screens and high-resolution displays.

---

## Quickstart

### Prerequisites
- **Node.js**: `v18.0.0` or higher (recommended: Node 20 or 22 LTS). Check with `node -v`.
- **Package Manager**: `pnpm` (recommended) or `npm`.

### Installation & Local Run

```bash
# 1. Clone the repository
git clone https://github.com/Hand-Lock/guidonica.git
cd guidonica

# 2. Install dependencies
pnpm install
# (or with npm: npm install)

# 3. Start local development server
pnpm dev
# (or with npm: npm run dev)
```

Open your browser at **`http://localhost:3000`** (or the port displayed in your terminal).

---

## macOS & Apple Silicon (M1/M2/M3) Guide

Guidonica is fully cross-platform and tested for Apple Silicon on macOS:

1. **Native ARM64 Architecture**:
   `pnpm-lock.yaml` includes pre-resolved native `@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64` binaries, so `pnpm install` works instantly without Rosetta 2 emulation.
2. **Web Audio Gesture Unlock**:
   Modern macOS browsers (Safari, Chrome, Arc, Brave) enforce autoplay restrictions. The application cleanly instantiates and unlocks the `AudioContext` upon the first explicit user interaction (clicking **Start** or pressing the `Space` key).
3. **Retina Display Scaling**:
   On high-density displays (such as MacBook Retina screens), the canvas automatically detects `devicePixelRatio: 2` and scales the canvas viewport buffer, ensuring crisp note glyphs and subpixel-smooth scrolling.
4. **Typography & Font Fallbacks**:
   UI styling pairs Google Fonts (`Alegreya`, `Alegreya Sans`, `Ubuntu Mono`) with native system font stacks (`-apple-system`, `SF Pro`, `SF Mono`) for resilient, high-legibility cross-platform rendering.

---

## Available Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Starts the Vite development server on `http://localhost:3000`. |
| `pnpm typecheck` | Validates TypeScript types strictly (`tsc --noEmit`). |
| `pnpm test` | Runs the Vitest test suite. |
| `pnpm build` | Typechecks and compiles production bundle into `dist/`. |
| `pnpm preview` | Serves the production build locally for verification. |

---

## Keyboard Controls

| Key | Action |
| --- | ------ |
| `Space` | Toggle Start / Pause (or resumes from current position) |
| `R` or `Esc` | Reset playback to measure 1 and re-seed generator |
| `↑` (Arrow Up) | Increase tempo by 5 BPM |
| `↓` (Arrow Down) | Decrease tempo by 5 BPM |
| `Shift + ↑` | Increase tempo by 1 BPM |
| `Shift + ↓` | Decrease tempo by 1 BPM |
| `+` / `=` | Zoom in (+10%) |
| `-` / `_` | Zoom out (-10%) |
| `0` | Auto-fit zoom to screen (Auto Zoom) |

---

## Continuous Deployment & GitHub Pages

This project is configured for automated testing, building, and zero-downtime deployment to **GitHub Pages** via **GitHub Actions**.

### Automated Workflow
Every commit pushed to the `main` branch automatically triggers `.github/workflows/deploy.yml`:
1. **Validation**: Strictly typechecks TypeScript (`tsc --noEmit`) and runs all Vitest unit tests.
2. **Build**: Compiles production bundles with relative asset paths (`base: './'`) and isolates VexFlow into a cached vendor chunk.
3. **Deploy**: Uploads the production artifact and publishes it to GitHub Pages.

### Repository Configuration (GitHub)
1. **Repository Visibility**:
   - Navigate to `https://github.com/Hand-Lock/guidonica/settings`
   - Scroll to **Danger Zone** and set visibility to **Public** (required for free GitHub Pages).
2. **Enable GitHub Actions Pages**:
   - Navigate to `https://github.com/Hand-Lock/guidonica/settings/pages`
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.

### Custom Domain Setup
To attach a custom domain (e.g., `https://guidonica.org`):
1. Point your domain's DNS `CNAME` or `A` records to GitHub Pages.
2. In GitHub repository **Settings** > **Pages** > **Custom domain**, enter your domain and check **Enforce HTTPS**.
3. Because Vite uses relative pathing, the application transitions to your custom root domain without any code modifications.

---

## Architecture & Documentation

- [`SPEC.md`](SPEC.md): Full pedagogical and functional specifications, musical generation algorithms, metric linearity formulas, and UI controls.
- [`AGENTS.md`](AGENTS.md): Repository hygiene guidelines, coding standards, and agent rules.
- [`docs/adr/`](docs/adr/README.md): Architectural Decision Records documenting all major subsystems:
  - [ADR 0001: Core Architecture, Metric Linearity & Blitting Pipeline](docs/adr/0001-core-architecture-and-rendering-pipeline.md)
  - [ADR 0002: Light Theme Standardization & High-Contrast Canvas](docs/adr/0002-light-theme-standardization.md)
  - [ADR 0003: Infinite Streaming Buffer, Stave Alignment & Barlines](docs/adr/0003-infinite-stream-stave-alignment-and-barlines.md)
  - [ADR 0004: Beaming Geometry, Stave Attachment & Stem Extensions](docs/adr/0004-beaming-geometry-and-stave-attachment.md)
  - [ADR 0005: Dynamic Subdivision Beat Width & Padding Compensation](docs/adr/0005-dynamic-subdivision-beat-width-and-stave-padding-compensation.md)
  - [ADR 0006: Multi-Interval Selection & Clef Pitch Pools](docs/adr/0006-multi-interval-selection-and-clef-pitch-pools.md)
  - [ADR 0007: Comprehensive System Audit, Glitch Elimination & Optimizations](docs/adr/0007-comprehensive-system-audit-and-optimizations.md)
  - [ADR 0008: Pause and Resume State Synchronization & Phase Alignment](docs/adr/0008-pause-and-resume-state-synchronization.md)
  - [ADR 0009: Cross-Platform Portability and GitHub Synchronization](docs/adr/0009-cross-platform-portability-and-github-synchronization.md)
  - [ADR 0010: Separate Tuplet Subdivision Matrix Menu & Arbitrary n-Tuplet Engine](docs/adr/0010-separate-tuplet-subdivision-matrix-menu.md)
  - [ADR 0011: Tuplet Beam Stem Direction Unification & Contiguous Non-Tuplet Grouping](docs/adr/0011-tuplet-beam-stem-direction-unification.md)
  - [ADR 0012: Web Font Loading Synchronization & Pinned Clef Cache Invalidation](docs/adr/0012-web-font-synchronization-and-clef-invalidation.md)
  - [ADR 0013: Production Readiness, High-DPI Retina Pipeline & Audio Polish](docs/adr/0013-production-readiness-and-high-dpi-retina-pipeline.md)
  - [ADR 0014: Solfège Label Context Transform & Vertical Clearance Architecture](docs/adr/0014-solfege-label-transform-and-vertical-clearance.md)
  - [ADR 0015: Italian Solfège Syllables and Cross-Platform OS-Aligned Auto Night Mode](docs/adr/0015-italian-solfege-and-cross-platform-auto-night-mode.md)
  - [ADR 0016: Default Woodblock Metronome Profile and Auto OS Theme Mode](docs/adr/0016-default-woodblock-metronome-and-auto-theme.md)
  - [ADR 0017: Vector Music Notation Icons for Cross-Platform UI Controls](docs/adr/0017-vector-music-icons-cross-platform-ui.md)
  - [ADR 0018: Continuous Deployment to GitHub Pages via GitHub Actions & Custom Domain Readiness](docs/adr/0018-github-actions-pages-continuous-deployment.md)
  - [ADR 0019: Strict Copyleft Open-Source Licensing (GNU AGPLv3)](docs/adr/0019-licensing-strict-copyleft-agplv3.md)
  - [ADR 0020: In-App License and Repository Presentation Architecture](docs/adr/0020-in-app-license-and-repository-ui.md)
  - [ADR 0021: Project, Web-App, and Repository Rebranding to Guidonica](docs/adr/0021-project-rebranding-guidonica.md)

---

## License

This project is free and open-source software licensed under the **[GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)](LICENSE)**.

Copyright &copy; 2026 **A. C. Lo Cascio**.

### Copyleft Terms
- **Freedom & Reciprocity**: You are free to run, study, modify, and distribute this software.
- **Strict Copyleft (Section 13)**: If you modify this program and run it on a server or deploy it as a network/cloud service where users interact with it remotely, you **must** make the complete Corresponding Source code of your modified version available to all users under the terms of the AGPLv3.
- **Third-Party Acknowledgements**: This project incorporates [VexFlow](https://github.com/vexflow/vexflow), licensed under the [MIT License](https://github.com/vexflow/vexflow/blob/master/LICENSE.txt).

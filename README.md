# Solfège Scroller

> High-performance, client-only web tool for sight-reading and solfège practice. Continuously streams procedurally generated music notation across a fixed playhead in sample-accurate synchronization with a Web Audio synthesized metronome.

**Live Application**: [https://hand-lock.github.io/solfege-scroller/](https://hand-lock.github.io/solfege-scroller/) &nbsp;|&nbsp; [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)

---

## Highlights & Philosophy

- **Zero Framework Overhead**: Built with **Vanilla TypeScript** driving native DOM APIs, HTML5 Canvas, and the Web Audio API directly. No React, Vue, Svelte, or Virtual DOM diffing overhead.
- **Hardware-Accelerated Blitting**: VexFlow renders measures once to offscreen canvases. The animation loop (`requestAnimationFrame`) blits pre-rendered measure canvases to the viewport using GPU-accelerated `drawImage`.
- **Single Source of Truth Clock**: Visual motion and synthesized audio clicks are synchronized to the hardware audio clock (`AudioContext.currentTime`).
- **Dynamic Subdivision & Beaming**: Automatic beat width adjustment based on active subdivisions and meter, with correct stem extension and beam angle calculation.
- **Retina & High-DPI Support**: Automatically scales to `window.devicePixelRatio` for razor-sharp staff lines, notes, and playhead rendering on MacBook Retina screens and high-resolution displays.
- **Infinite Streaming Ring-Buffer**: Automatically pre-renders measures ahead and evicts scrolled measures behind to maintain stable 60/120 FPS with minimal memory footprint.

---

## Quickstart

### Prerequisites
- **Node.js**: `v18.0.0` or higher (recommended: Node 20 or 22 LTS). Check with `node -v`. (If you use a version manager like `nvm` or `fnm`, you can run `nvm use`, but it is not required if Node is already installed).
- **Package Manager**: `pnpm` (recommended) or `npm`.

### Installation & Local Run

```bash
# 1. Clone the repository
git clone https://github.com/Hand-Lock/solfege-scroller.git
cd solfege-scroller

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

Solfège Scroller is fully cross-platform and tested for Apple Silicon on macOS:

1. **Native ARM64 Architecture**:
   `pnpm-lock.yaml` includes pre-resolved native `@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64` binaries, so `pnpm install` works instantly without Rosetta 2 emulation.
2. **Web Audio Gesture Unlock**:
   Modern macOS browsers (Safari, Chrome, Arc, Brave) enforce autoplay restrictions. The application cleanly instantiates and unlocks the `AudioContext` upon the first explicit user interaction (clicking **Start** or pressing the `Space` key).
3. **Retina Display Scaling**:
   On high-density displays (such as the MacBook Air M1 built-in Retina screen), the canvas automatically detects `devicePixelRatio: 2` and scales the canvas viewport buffer, ensuring crisp note glyphs and subpixel-smooth scrolling.
4. **Native Typography**:
   UI styling leverages native Apple system font stacks (`-apple-system`, `SF Pro`, `SF Mono`) for seamless macOS look and feel.

---

## Available Scripts

| Command | Description |
| ------- | ----------- |
| `pnpm dev` | Starts the Vite development server on `http://localhost:3000`. |
| `pnpm typecheck` | Validates TypeScript types strictly (`tsc --noEmit`). |
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

---

## Continuous Deployment & GitHub Pages

This project is configured for automated testing, building, and zero-downtime deployment to **GitHub Pages** via **GitHub Actions**.

### Automated Workflow
Every commit pushed to the `main` branch automatically triggers `.github/workflows/deploy.yml`:
1. **Validation**: Strictly typechecks TypeScript (`tsc --noEmit`) and runs all Vitest unit tests.
2. **Build**: Compiles production bundles with relative asset paths (`base: './'`) and isolates VexFlow into a cached vendor chunk.
3. **Deploy**: Uploads the production artifact and publishes it to GitHub Pages.

### One-Time Repository Configuration (GitHub)
1. **Repository Visibility**:
   - Navigate to `https://github.com/Hand-Lock/solfege-scroller/settings`
   - Scroll to **Danger Zone** and set visibility to **Public** (required for free GitHub Pages).
2. **Enable GitHub Actions Pages**:
   - Navigate to `https://github.com/Hand-Lock/solfege-scroller/settings/pages`
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.

### Future Custom Domain Setup
To attach a custom domain (e.g., `https://solfegescroller.com`):
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
  - [ADR 0018: Continuous Deployment to GitHub Pages via GitHub Actions & Custom Domain Readiness](docs/adr/0018-github-actions-pages-continuous-deployment.md)
  - [ADR 0019: Strict Copyleft Open-Source Licensing (GNU AGPLv3)](docs/adr/0019-licensing-strict-copyleft-agplv3.md)

---

## License

This project is free and open-source software licensed under the **[GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)](LICENSE)**.

Copyright &copy; 2026 **A. C. Lo Cascio**.

### Copyleft Terms
- **Freedom & Reciprocity**: You are free to run, study, modify, and distribute this software.
- **Strict Copyleft (Section 13)**: If you modify this program and run it on a server or deploy it as a network/cloud service where users interact with it remotely, you **must** make the complete Corresponding Source code of your modified version available to all users under the terms of the AGPLv3.
- **Third-Party Acknowledgements**: This project incorporates [VexFlow](https://github.com/vexflow/vexflow), licensed under the [MIT License](https://github.com/vexflow/vexflow/blob/master/LICENSE.txt).


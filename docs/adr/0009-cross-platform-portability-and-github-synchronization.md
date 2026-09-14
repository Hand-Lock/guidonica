# ADR 0009: Cross-Platform Portability, macOS Apple Silicon Support & GitHub Synchronization

## Status
Accepted

## Date
2026-09-14

## Context
The project needs to be synchronized to GitHub so that developers can seamlessly clone the repository on different machines—specifically targeting Apple Silicon macOS (MacBook Air M1) as well as Linux environments—and immediately run, develop, and preview the application without platform friction, missing configuration, or timing/audio incompatibilities.

Key challenges across operating systems include:
1. **Binary Dependencies**: Vite and Rollup utilize platform-specific native binaries (e.g., `@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64` vs `@esbuild/linux-x64`).
2. **Node Version Consistency**: Different developer workstations may have varying local Node.js versions.
3. **OS-Specific Files**: macOS file systems automatically write metadata files (`.DS_Store`, AppleDouble `._*`, `.Spotlight-V100`, `.Trashes`) that pollute git repositories if not explicitly ignored.
4. **Web Audio Autoplay Policies**: Modern macOS WebKit (Safari) and Chromium browsers enforce strict autoplay restrictions requiring audio contexts to be created or resumed only following user gestures.
5. **Retina & High-DPI Displays**: MacBook Air M1 screens operate at 2x pixel density (`window.devicePixelRatio = 2`), requiring sharp canvas scaling without degrading offscreen blitting performance.

## Decisions & Implementation

1. **Lockfile & Cross-Platform Architecture Matrix**:
   - Ensured `pnpm-lock.yaml` retains architecture resolutions for Darwin ARM64 (`@esbuild/darwin-arm64` and `@rollup/rollup-darwin-arm64`) alongside Linux x64 binaries.
   - Defined `packageManager: "pnpm@11.8.0"` and `engines: { "node": ">=18.0.0" }` in `package.json` to enforce reproducible runtime behavior.
   - Added `.nvmrc` pinned to LTS Node (Node 20) for automated version switching via `nvm` or `fnm`.

2. **macOS Filesystem Hygiene**:
   - Expanded `.gitignore` to comprehensively ignore Apple-specific metadata:
     - `.DS_Store`
     - `.AppleDouble`
     - `.LSOverride`
     - `._*`
     - `.Spotlight-V100`
     - `.Trashes`
   - Included common IDE directories (`.vscode/`, `.idea/`) and package manager debug logs.

3. **Audio Context Safety for Safari & WebKit**:
   - Confirmed `MetronomeEngine` adheres to the lazy initialization pattern: `AudioContext` is only instantiated or resumed upon an explicit user gesture (Start button or `Space` key).
   - Maintained fallback support for `webkitAudioContext` in legacy WebKit implementations.

4. **Retina Display Scaling**:
   - Validated that `ScrollerView.updateDimensions()` queries `window.devicePixelRatio || 1`, dimensioning the physical canvas buffer by `viewportWidth * dpr` and scaling the rendering context by `(dpr, dpr)`, preserving 60/120 FPS high-refresh rate pacing on Apple Silicon ProMotion / 60Hz displays.

5. **Self-Contained Developer Experience**:
   - Authored a comprehensive `README.md` documenting zero-friction onboarding:
     ```bash
     git clone <repo-url>
     cd solfege-scroller
     pnpm install
     pnpm dev
     ```

## Consequences

- **Cross-Platform Reproducibility**: Cloning on an M1 MacBook Air requires only `pnpm install` and `pnpm dev`, running natively on ARM64 with zero manual build tweaks.
- **Repository Cleanliness**: Git history remains free of OS-specific temp files and compiled bundles.
- **Full Type Safety**: All TypeScript checks (`tsc --noEmit`) and Vite production builds run cleanly on both Linux and macOS.

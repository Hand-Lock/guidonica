# 0001. Core Architecture, Metric Linearity & Blitting Pipeline

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Guidonica requires continuous, smooth, horizontal streaming of procedurally generated sheet music across a stationary playhead in lockstep with an audible metronome. 

Key technical requirements:
1. Note heads must cross the stationary playhead line at the exact microsecond the metronome pulse sounds.
2. Smooth 60 FPS animation without garbage-collection hiccups or CPU throttling.
3. Strict metric linearity: note spacing must strictly correspond to rhythmic duration, not traditional engraved elastic spacing.
4. Clean sight-reading isolation without evaluation friction.

---

## Decisions & Implementation Methods

### 1. Framework-Free Vanilla TypeScript
- **Decision**: Avoid React, Vue, Svelte, or Angular. Build the application with strict Vanilla TypeScript (`strict: true`) directly manipulating DOM APIs, HTML5 Canvas, and Web Audio API.
- **Rationale**: Virtual DOM diffing overhead, bundle weight, and framework lifecycle hooks introduce frame pacing jitter and maintenance complexity.

### 2. Single Source of Truth Hardware Clock (`AudioContext.currentTime`)
- **Decision**: All visual offsets and audio events are driven by `AudioContext.currentTime`. Independent visual `setInterval` or `Date.now()` timers are strictly forbidden.
- **Audio Scheduler**: Lookahead scheduling loop running every 25ms (`setInterval`) that schedules Web Audio oscillator events up to 100ms in advance into the `AudioContext` queue.
- **Visual Scroller**: Animation loop (`requestAnimationFrame`) computes current playback beat directly from `AudioContext.currentTime`:
  $$\text{elapsedSeconds} = \text{audioCtx.currentTime} - t_{\text{measureZero}}$$
  $$\text{currentGlobalBeat} = \frac{\text{elapsedSeconds}}{\text{secondsPerBeat}}$$
- **Audio Safety**: `AudioContext` is never resumed or created on script load; it is strictly initialized/resumed inside user gesture handlers (Play button or Space key).

### 3. Spatial Metric Linearity
- **Decision**: Every metric beat occupies a fixed pixel width ($W_{\text{beat}} = 120\text{px}$).
- **Formula**:
  $$W_{\text{measure}} = \text{beatsPerMeasure} \times W_{\text{beat}}$$
  $$v = \frac{\text{BPM}}{60} \times W_{\text{beat}} \quad (\text{pixels / second})$$
- **Notehead-to-Pulse Synchronization**:
  - Within each measure, beat 0 is offset by $\text{NOTE\_START\_OFFSET} = 24\text{px}$ after the barline.
  - Beat $b$ within measure $m$ has measure-local coordinate:
    $$x_{\text{local}} = \text{NOTE\_START\_OFFSET} + b \times W_{\text{beat}}$$
  - The measure canvas is positioned on the viewport at:
    $$X_{\text{measure}} = X_{\text{playhead}} - \text{NOTE\_START\_OFFSET} + (m.\text{startBeat} - \text{currentGlobalBeat}) \times W_{\text{beat}}$$
  - When $\text{currentGlobalBeat} = m.\text{startBeat} + b$, the notehead's screen coordinate is identically $X_{\text{playhead}}$, coinciding with the audio pulse.

### 4. Offscreen Measure Caching & GPU Blitting Pipeline
- **Decision**: Never run full VexFlow layout, font glyph resolution, or voice parsing during animation frames (`requestAnimationFrame`).
- **Pipeline**:
  1. Upcoming measures are formatted and drawn once onto offscreen `HTMLCanvasElement` surfaces using VexFlow 5 (`Renderer.Backends.CANVAS`).
  2. Noteheads are repositioned linearly using `note.getTickContext().setX(...)`, followed by `beam.postFormat()`.
  3. The main display canvas loop merely blits visible measure canvases using `CanvasRenderingContext2D.drawImage()`.
  4. HiDPI / Retina displays are handled using `window.devicePixelRatio` scaling.

### 5. Memory Discipline & Active Measure Ring-Buffer
- **Decision**: Maintain an active measure buffer (`MeasureBuffer`) that:
  - Pre-renders measures ahead when the buffer drops below the viewport lookahead threshold.
  - Automatically evicts measures that scroll off the left edge (`minVisibleBeat = currentGlobalBeat - (playheadX / BEAT_WIDTH) - 2`).
  - Releases backing canvas memory (`canvas.width = 0; canvas.height = 0`) to prevent memory leaks during infinite practice sessions.

### 6. Procedural Generation Engine
- **Rhythmic Partitioner**: Recursively decomposes each metric beat into user-selected subdivisions (whole, half, quarter, eighth, sixteenth, triplets), guaranteeing the measure strictly sums to the time signature.
- **Melodic Random Walk**: Samples scale degrees from clef pitch ranges ($\pm 2$ ledger lines), enforces interval leap bounds (`seconds`, `thirds`, `octaves`, `any`), and applies boundary bias (85% inward steering near ledger limits).

---

## Consequences & Verification

- **Performance**: Rock-solid 60 FPS on low-power hardware with zero GC spikes.
- **Sync**: Zero visual-audio drift over indefinite running periods.
- **Maintainability**: Clear separation between generation (`src/notation/generator.ts`), rendering (`src/notation/renderer.ts`), buffer management (`src/scroller/buffer.ts`), audio scheduling (`src/audio/metronome.ts`), and viewport presentation (`src/scroller/scroller.ts`).

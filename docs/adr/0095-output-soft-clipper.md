# 0095. Output Headroom: a Zero-Latency Soft Clipper

- **Status**: Accepted (amends [0092](0092-drone.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Before the drone, the click was the only sound and it peaked at its accent gain (≤ 1.0) times the volume, so it never left full scale. ADR 0092 added the drone on its own bus, summed with the click at `ctx.destination`, and noted in its Consequences that a click over a drone peak can pass full scale with both volumes high: the click peaks near 1.0 and the drone near 0.5 × its volume. The browser then hard-clips the sum, and the corner adds a buzz of odd harmonics to every click.

The fix must keep the click exactly on the audio clock (AGENTS §1) and must not make anyone's practice quieter.

## Decision

### 1. One output stage (`src/audio/output.ts`)

```
masterGainNode ─┐
                ├─→ GainNode(0.5) → WaveShaperNode(oversample 'none') → destination
droneBus ───────┘
```

`createOutputStage(ctx)` builds it and returns the gain; `ensureAudioContext()` connects both buses to it instead of the destination. It is built once per context: no per-frame or per-click work.

### 2. The curve

A WaveShaper reads its curve over the input range [−1, 1] and holds the end values outside it. The 0.5 gain maps the signal u ∈ [−2, 2] onto that range, so the curve is written in terms of u:

$$y(u) = \begin{cases} u & |u| \le 0.9 \\ \operatorname{sgn}(u)\left(0.9 + 0.1 \tanh\dfrac{|u| - 0.9}{0.1}\right) & |u| > 0.9 \end{cases}$$

- Identity up to the knee (about −0.9 dBFS): everything Guidonica played before the drone, and the drone at its defaults, passes bit for bit apart from Float32 rounding.
- Value and slope (1) match at the knee, so a peak is rounded rather than cornered.
- Odd and monotonic, and |y| < 1 for every finite u (in Float32 the far end of the tail rounds to 1): the output never passes full scale. A sum up to twice full scale is shaped; beyond that it holds at the curve's end, which is still below 1.
- `softClipCurve()` samples 4097 points (odd, so u = 0 is a sample). The identity part is linear, so the shaper's linear interpolation reproduces it exactly. The array is computed once and shared.

### 3. Rejected

- **`DynamicsCompressorNode`**: it looks ahead about 6 ms, which delays the click behind the notehead crossing the playhead and breaks the single-clock rule. Its release also pumps the drone after every accent.
- **A static gain cut** (say ×0.6 on the sum): no clipping, but every user, most of whom never turn the drone on, would get a quieter click.
- **Oversampling the shaper** (`'2x'`, `'4x'`): it adds filter latency for a curve that is linear wherever the signal usually lives.

## Consequences

- Two nodes and about 16 KB of curve, once per session; latency unchanged.
- Peaks above −0.9 dBFS are slightly compressed. That only happens when click and drone sum past the knee, which is when hard clipping would have happened before.
- Mute, the volume sliders and the drone bus keep their own gains upstream of the stage; nothing in them changed.
- **Tests**: `tests/output.test.ts` (identity below the knee, odd, monotonic, ≤ 1, smooth at the knee) and `tests/drone.test.ts` (both buses meet in the stage, shaper wiring, `oversample 'none'`, the curve).

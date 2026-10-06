// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Output stage: a zero-latency soft clipper before the speakers (ADR 0095)
// Copyright (C) 2026 A. C. Lo Cascio

/** Signal level where the curve leaves the identity, about −0.9 dBFS. */
const KNEE = 0.9;
/** Input range the curve covers: |u| ≤ 2, twice full scale. */
const RANGE = 2;
/** Odd length, so u = 0 falls on a sample. */
const SAMPLES = 4097;

/**
 * The shaper curve over u ∈ [−RANGE, RANGE]: identity up to |u| = KNEE, then
 * KNEE + (1 − KNEE)·tanh((|u| − KNEE)/(1 − KNEE)), odd. Value and slope match at the knee,
 * and the output never passes full scale.
 */
export function softClipCurve(samples = SAMPLES): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(samples);
  const span = 1 - KNEE;
  for (let k = 0; k < samples; k++) {
    const u = -RANGE + (2 * RANGE * k) / (samples - 1);
    const a = Math.abs(u);
    const y = a <= KNEE ? a : KNEE + span * Math.tanh((a - KNEE) / span);
    curve[k] = Math.sign(u) * y;
  }
  return curve;
}

let cachedCurve: Float32Array<ArrayBuffer> | null = null;

/**
 * Builds `gain(1/RANGE) → WaveShaper → destination` and returns its input. The gain maps
 * u ∈ [−2, 2] onto the shaper's [−1, 1] index range, so levels below the knee leave unchanged.
 * A WaveShaper without oversampling adds no latency, unlike a DynamicsCompressor's lookahead.
 */
export function createOutputStage(ctx: BaseAudioContext): AudioNode {
  const input = ctx.createGain();
  input.gain.value = 1 / RANGE;
  const shaper = ctx.createWaveShaper();
  cachedCurve ??= softClipCurve();
  shaper.curve = cachedCurve;
  shaper.oversample = 'none';
  input.connect(shaper);
  shaper.connect(ctx.destination);
  return input;
}

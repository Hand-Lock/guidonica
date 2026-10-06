// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Drone: a steady tonic to sight-sing against (ADR 0092)
// Copyright (C) 2026 A. C. Lo Cascio

import { DroneSound, PITCH_CLASSES, PitchClass } from '../notation/types';

/** One sounding drone, timed on the audio clock. */
export interface DroneVoice {
  /** Fades out from `at` and frees every node once silent. Later calls are ignored. */
  release(at: number): void;
}

const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/**
 * The tonic in octave 3, 12-TET from `a4` (ADR 0094): at 440 Hz C3 ≈ 130.81 Hz … B3 ≈ 246.94 Hz,
 * at 415 Hz A3 = 207.5 Hz.
 */
export function droneFrequency(pc: PitchClass, a4 = 440): number {
  const midi = 48 + SEMITONES[PITCH_CLASSES.indexOf(pc)];
  return a4 * Math.pow(2, (midi - 69) / 12);
}

/** Output level per timbre, equalized to the same RMS in an offline render. */
const LEVEL: Record<DroneSound, number> = { shruti: 0.241, pad: 0.232 };
/** Attack time constant (s) per timbre. */
const ATTACK: Record<DroneSound, number> = { shruti: 0.25, pad: 0.4 };
const RELEASE_TAU = 0.1;
/** Sources stop this long after a release begins: 10 time constants, about −87 dB. */
const RELEASE_TAIL = 1;

const waves = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/** A wave with harmonics n = 1…count at amplitude 1/n^exponent, built once per context. */
function harmonicWave(ctx: BaseAudioContext, count: number, exponent: number): PeriodicWave {
  const key = `${count}:${exponent}`;
  let cache = waves.get(ctx);
  if (!cache) {
    cache = new Map();
    waves.set(ctx, cache);
  }
  let wave = cache.get(key);
  if (!wave) {
    const real = new Float32Array(count + 1);
    const imag = new Float32Array(count + 1);
    for (let n = 1; n <= count; n++) imag[n] = 1 / Math.pow(n, exponent);
    wave = ctx.createPeriodicWave(real, imag);
    cache.set(key, wave);
  }
  return wave;
}

function oscillator(ctx: BaseAudioContext, frequency: number, wave: 'sine' | 'sawtooth' | PeriodicWave): OscillatorNode {
  const osc = ctx.createOscillator();
  if (typeof wave === 'object') osc.setPeriodicWave(wave);
  else osc.type = wave;
  osc.frequency.value = frequency;
  return osc;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, q: number): BiquadFilterNode {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = q;
  return node;
}

/** A sine LFO swinging `target` by ±`depth` around its own value. */
function lfo(ctx: BaseAudioContext, rate: number, depth: number, target: AudioParam): [OscillatorNode, GainNode] {
  const osc = oscillator(ctx, rate, 'sine');
  const amount = ctx.createGain();
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  return [osc, amount];
}

/**
 * Builds a drone voice on `pc`, tuned from `a4`, that starts at `at` and feeds `out`. Every
 * timbre ends in one envelope gain, so attack and release are click-free `setTargetAtTime` curves.
 */
export function createDroneVoice(
  ctx: BaseAudioContext,
  out: AudioNode,
  sound: DroneSound,
  pc: PitchClass,
  at: number,
  a4 = 440
): DroneVoice {
  const f = droneFrequency(pc, a4);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.setTargetAtTime(LEVEL[sound], at, ATTACK[sound]);
  env.connect(out);

  const sources: OscillatorNode[] = [];
  const graph: AudioNode[] = [env];

  if (sound === 'pad') {
    // Two saws ±7 cents apart beat about once a second; a slow LFO on the cutoff breathes
    const lp = filter(ctx, 'lowpass', 1000, 0.5);
    const a = oscillator(ctx, f, 'sawtooth');
    const b = oscillator(ctx, f, 'sawtooth');
    a.detune.value = -7;
    b.detune.value = 7;
    a.connect(lp);
    b.connect(lp);
    lp.connect(env);
    const [wobble, depth] = lfo(ctx, 0.1, 250, lp.frequency);
    sources.push(a, b, wobble);
    graph.push(lp, depth);
  } else {
    // Two reeds, the upper one an octave up and 3 cents sharp, through a swelling bellows
    const reed = harmonicWave(ctx, 16, 1.1);
    const lp = filter(ctx, 'lowpass', 2200, 0.7);
    const bellows = ctx.createGain();
    const upper = ctx.createGain();
    upper.gain.value = 0.6;
    const low = oscillator(ctx, f, reed);
    const high = oscillator(ctx, 2 * f, reed);
    high.detune.value = 3;
    low.connect(lp);
    high.connect(upper).connect(lp);
    lp.connect(bellows).connect(env);
    const [swell, depth] = lfo(ctx, 0.22, 0.12, bellows.gain);
    sources.push(low, high, swell);
    graph.push(upper, lp, bellows, depth);
  }

  // Every node is freed together once all sources have stopped
  let live = sources.length;
  for (const src of sources) {
    src.onended = () => {
      if (--live > 0) return;
      for (const node of [...sources, ...graph]) node.disconnect();
    };
    src.start(at);
  }
  let released = false;

  return {
    release(when: number): void {
      if (released) return;
      released = true;
      // Never before the attack begins, or the attack would override the fade
      const t = Math.max(when, at);
      env.gain.setTargetAtTime(0, t, RELEASE_TAU);
      for (const src of sources) src.stop(t + RELEASE_TAIL);
    },
  };
}

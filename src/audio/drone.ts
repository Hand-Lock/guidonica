// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Drone: a steady tonic to sight-sing against (ADR 0092)
// Copyright (C) 2026 A. C. Lo Cascio

import { DroneSound, PITCH_CLASSES, PitchClass } from '../notation/types';

/** One sounding drone. Plucks and releases are timed on the audio clock, never by timers. */
export interface DroneVoice {
  /** Queues the plucks that start before `until` (the scheduler horizon); sustained timbres ignore it. */
  schedule(until: number): void;
  /** Fades out from `at` and frees every node once silent. Later calls are ignored. */
  release(at: number): void;
}

const SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/** The tonic in octave 3, 12-TET with A4 = 440 Hz: C3 ≈ 130.81 Hz … B3 ≈ 246.94 Hz. */
export function droneFrequency(pc: PitchClass): number {
  const midi = 48 + SEMITONES[PITCH_CLASSES.indexOf(pc)];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Output level per timbre, equalized to the same RMS in an offline render. */
const LEVEL: Record<DroneSound, number> = { tanpura: 0.565, shruti: 0.241, pad: 0.232 };
/** Attack time constant (s) per timbre. */
const ATTACK: Record<DroneSound, number> = { tanpura: 0.02, shruti: 0.25, pad: 0.4 };
const RELEASE_TAU = 0.1;
/** Sources stop this long after a release begins: 10 time constants, about −87 dB. */
const RELEASE_TAIL = 1;

/** Tanpura cycle, tonic only: three strings on the tonic, one an octave below, then a long rest. */
const TANPURA_RATIOS = [1, 1, 1, 0.5];
const TANPURA_GAPS = [0.9, 0.9, 0.9, 2.4];
const PLUCK_DECAY_TAU = 1.4;
const PLUCK_LENGTH = 8;

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
 * Builds a drone voice on `pc` that starts at `at` and feeds `out`. Every timbre ends in
 * one envelope gain, so attack and release are click-free `setTargetAtTime` curves.
 */
export function createDroneVoice(
  ctx: BaseAudioContext,
  out: AudioNode,
  sound: DroneSound,
  pc: PitchClass,
  at: number
): DroneVoice {
  const f = droneFrequency(pc);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, at);
  env.gain.setTargetAtTime(LEVEL[sound], at, ATTACK[sound]);
  env.connect(out);

  /** Sustained sources and every node they feed, freed together after the release. */
  const sources: OscillatorNode[] = [];
  const graph: AudioNode[] = [env];
  let released = false;

  const sustain = (oscillators: OscillatorNode[], nodes: AudioNode[]): void => {
    sources.push(...oscillators);
    graph.push(...oscillators, ...nodes);
  };

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
    sustain([a, b, wobble], [lp, depth]);
  } else if (sound === 'shruti') {
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
    sustain([low, high, swell], [upper, lp, bellows, depth]);
  }

  for (const src of sources) src.start(at);
  if (sources.length > 0) {
    let live = sources.length;
    const onEnded = (): void => {
      if (--live > 0) return;
      for (const node of graph) node.disconnect();
    };
    for (const src of sources) src.onended = onEnded;
  }

  // Tanpura plucks: each owns its oscillator, jawari filter and decay gain
  const plucks = new Map<OscillatorNode, number>(); // live pluck → its stop time
  let nextPluck = at;
  let pluckIndex = 0;

  const pluck = (t: number, freq: number): void => {
    const osc = oscillator(ctx, freq, harmonicWave(ctx, 32, 0.7));
    // The jawari's grazing contact: a resonant band sweeping down the harmonics
    const jawari = filter(ctx, 'peaking', 12 * freq, 5);
    jawari.gain.value = 14;
    jawari.frequency.setValueAtTime(12 * freq, t);
    jawari.frequency.exponentialRampToValueAtTime(3 * freq, t + 3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + 0.01);
    gain.gain.setTargetAtTime(0, t + 0.01, PLUCK_DECAY_TAU);
    osc.connect(jawari).connect(gain).connect(env);
    const end = t + PLUCK_LENGTH;
    osc.onended = () => {
      plucks.delete(osc);
      osc.disconnect();
      jawari.disconnect();
      gain.disconnect();
      if (released && plucks.size === 0) env.disconnect();
    };
    plucks.set(osc, end);
    osc.start(t);
    osc.stop(end);
  };

  return {
    schedule(until: number): void {
      if (sound !== 'tanpura' || released) return;
      while (nextPluck < until) {
        const i = pluckIndex % TANPURA_RATIOS.length;
        pluck(nextPluck, f * TANPURA_RATIOS[i]);
        nextPluck += TANPURA_GAPS[i];
        pluckIndex++;
      }
    },
    release(when: number): void {
      if (released) return;
      released = true;
      // Never before the attack begins, or the attack would override the fade
      const t = Math.max(when, at);
      env.gain.setTargetAtTime(0, t, RELEASE_TAU);
      const stopAt = t + RELEASE_TAIL;
      for (const src of sources) src.stop(stopAt);
      for (const [osc, end] of plucks) osc.stop(Math.min(end, stopAt));
      if (sound === 'tanpura' && plucks.size === 0) env.disconnect();
    },
  };
}

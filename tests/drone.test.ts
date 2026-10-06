import { describe, it, expect, afterEach } from 'vitest';
import { createDroneVoice, droneFrequency } from '../src/audio/drone';
import { MetronomeEngine } from '../src/audio/metronome';
import { DRONE_SOUNDS, PITCH_CLASSES } from '../src/notation/types';

type ParamCall = [string, ...number[]];

class MockParam {
  value = 0;
  calls: ParamCall[] = [];
  setValueAtTime(v: number, t: number): void {
    this.calls.push(['set', v, t]);
  }
  linearRampToValueAtTime(v: number, t: number): void {
    this.calls.push(['linear', v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    this.calls.push(['exp', v, t]);
  }
  setTargetAtTime(v: number, t: number, tau: number): void {
    this.calls.push(['target', v, t, tau]);
  }
  cancelScheduledValues(t: number): void {
    this.calls.push(['cancel', t]);
  }
}

class MockNode {
  outputs: unknown[] = [];
  disconnected = false;
  connect<T>(target: T): T {
    this.outputs.push(target);
    return target;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

class MockOscillator extends MockNode {
  type = 'sine';
  wave: unknown = null;
  frequency = new MockParam();
  detune = new MockParam();
  startTime: number | null = null;
  stopTime: number | null = null;
  onended: (() => void) | null = null;
  setPeriodicWave(wave: unknown): void {
    this.type = 'custom';
    this.wave = wave;
  }
  start(t: number): void {
    this.startTime = t;
  }
  stop(t: number): void {
    this.stopTime = t;
  }
}

class MockGain extends MockNode {
  gain = new MockParam();
}

class MockFilter extends MockNode {
  type = 'lowpass';
  frequency = new MockParam();
  Q = new MockParam();
  gain = new MockParam();
}

class MockContext {
  currentTime = 0;
  state = 'running';
  onstatechange: (() => void) | null = null;
  destination = new MockNode();
  oscillators: MockOscillator[] = [];
  gains: MockGain[] = [];
  filters: MockFilter[] = [];
  waves = 0;
  createOscillator(): MockOscillator {
    const node = new MockOscillator();
    this.oscillators.push(node);
    return node;
  }
  createGain(): MockGain {
    const node = new MockGain();
    this.gains.push(node);
    return node;
  }
  createBiquadFilter(): MockFilter {
    const node = new MockFilter();
    this.filters.push(node);
    return node;
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array): object {
    this.waves++;
    return { real, imag };
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

const asCtx = (ctx: MockContext): BaseAudioContext => ctx as unknown as BaseAudioContext;
const asNode = (node: MockNode): AudioNode => node as unknown as AudioNode;
const endAll = (ctx: MockContext): void => {
  for (const osc of ctx.oscillators) osc.onended?.();
};

describe('drone voice (ADR 0092)', () => {
  it('tunes the tonic in octave 3, A4 = 440 Hz', () => {
    expect(droneFrequency('c')).toBeCloseTo(130.81, 2);
    expect(droneFrequency('a')).toBe(220);
    expect(droneFrequency('b')).toBeCloseTo(246.94, 2);
    const freqs = PITCH_CLASSES.map(droneFrequency);
    expect(freqs).toEqual([...freqs].sort((x, y) => x - y));
  });

  for (const sound of DRONE_SOUNDS) {
    it(`builds the ${sound} on the tonic and frees every node after the release`, () => {
      const ctx = new MockContext();
      const out = new MockNode();
      const voice = createDroneVoice(asCtx(ctx), asNode(out), sound, 'c', 2);
      const env = ctx.gains[0];
      expect(env.outputs).toEqual([out]);
      expect(env.gain.calls[0]).toEqual(['set', 0, 2]);
      expect(env.gain.calls[1][0]).toBe('target');
      expect(ctx.oscillators.length).toBeGreaterThanOrEqual(3);
      for (const osc of ctx.oscillators) expect(osc.startTime).toBe(2);
      const tones = ctx.oscillators.filter((o) => o.frequency.value > 20).map((o) => o.frequency.value);
      for (const f of tones) expect([1, 2]).toContain(Math.round(f / droneFrequency('c')));

      voice.release(5);
      expect(env.gain.calls.at(-1)).toEqual(['target', 0, 5, 0.1]);
      for (const osc of ctx.oscillators) expect(osc.stopTime).toBe(6);
      voice.release(7); // Ignored
      for (const osc of ctx.oscillators) expect(osc.stopTime).toBe(6);

      expect(ctx.gains.some((g) => g.disconnected)).toBe(false);
      endAll(ctx);
      for (const node of [...ctx.oscillators, ...ctx.gains, ...ctx.filters]) expect(node.disconnected).toBe(true);
    });
  }

  it('never releases before the attack starts', () => {
    const ctx = new MockContext();
    const voice = createDroneVoice(asCtx(ctx), asNode(new MockNode()), 'pad', 'e', 3);
    voice.release(1);
    expect(ctx.gains[0].gain.calls.at(-1)).toEqual(['target', 0, 3, 0.1]);
  });

  it('builds each harmonic wave once per context', () => {
    const ctx = new MockContext();
    for (let i = 0; i < 3; i++) createDroneVoice(asCtx(ctx), asNode(new MockNode()), 'shruti', 'g', 0);
    expect(ctx.waves).toBe(1);
  });
});

describe('drone in the metronome engine (ADR 0092)', () => {
  let metronome: MetronomeEngine | null = null;
  let ctx: MockContext;
  const OriginalAudioContext = window.AudioContext;

  const setup = (): MetronomeEngine => {
    ctx = new MockContext();
    ctx.currentTime = 10;
    window.AudioContext = function () {
      return ctx as unknown as AudioContext;
    } as unknown as typeof AudioContext;
    metronome = new MetronomeEngine(60, '4/4');
    metronome.setDroneSound('pad');
    return metronome;
  };
  const saws = (): MockOscillator[] => ctx.oscillators.filter((o) => o.type === 'sawtooth');
  const droneBus = (): MockGain => ctx.gains[1];

  afterEach(() => {
    metronome?.destroy();
    metronome = null;
    window.AudioContext = OriginalAudioContext;
  });

  it('defaults to off with the shruti box at 0.6', () => {
    const m = new MetronomeEngine();
    expect(m.getDroneNote()).toBe('off');
    expect(m.getDroneSound()).toBe('shruti');
    expect(m.getDroneVolume()).toBe(0.6);
    expect(DRONE_SOUNDS).toContain(m.getDroneSound());
  });

  it('builds nothing while off', () => {
    const m = setup();
    m.start(true);
    expect(saws()).toHaveLength(0);
    expect(ctx.filters).toHaveLength(0);
  });

  it('sounds from the count-in, fades on pause, rebuilds on resume and fades on stop', () => {
    const m = setup();
    m.setDroneNote('c');
    expect(saws()).toHaveLength(0); // Nothing until playback starts
    m.start(true);
    expect(saws()).toHaveLength(2);
    expect(saws().every((o) => o.startTime === 10.05 && o.frequency.value === droneFrequency('c'))).toBe(true);

    ctx.currentTime = 12;
    m.pause();
    expect(saws().every((o) => o.stopTime === 13)).toBe(true);

    ctx.currentTime = 20;
    m.resume();
    const fresh = saws().slice(2);
    expect(fresh).toHaveLength(2);
    expect(fresh.every((o) => o.startTime === 20 && o.stopTime === null)).toBe(true);

    ctx.currentTime = 21;
    m.stop();
    expect(fresh.every((o) => o.stopTime === 22)).toBe(true);
  });

  it('crossfades note and sound changes while playing and ignores repeats', () => {
    const m = setup();
    m.setDroneNote('c');
    m.start(false);
    ctx.currentTime = 11;
    m.setDroneNote('c');
    expect(saws()).toHaveLength(2);
    m.setDroneNote('d');
    expect(saws().slice(0, 2).every((o) => o.stopTime === 12)).toBe(true);
    expect(saws().slice(2).every((o) => o.startTime === 11 && o.frequency.value === droneFrequency('d'))).toBe(true);

    m.setDroneSound('shruti');
    expect(saws().slice(2).every((o) => o.stopTime === 12)).toBe(true);
    expect(ctx.oscillators.filter((o) => o.type === 'custom' && o.startTime === 11)).toHaveLength(2);

    m.setDroneNote('off');
    expect(ctx.oscillators.every((o) => o.startTime === null || o.stopTime !== null)).toBe(true);
  });

  it('drives the drone bus from its volume and the shared mute', () => {
    const m = setup();
    m.setDroneVolume(0.3);
    m.unlock();
    expect(droneBus().outputs).toEqual([ctx.destination]);
    expect(droneBus().gain.value).toBe(0.3);

    m.setMuted(true);
    expect(droneBus().gain.calls.at(-1)).toEqual(['target', 0, 10, 0.02]);
    m.setDroneVolume(2);
    expect(m.getDroneVolume()).toBe(1);
    expect(droneBus().gain.calls.at(-1)).toEqual(['target', 0, 10, 0.02]);
    m.setMuted(false);
    expect(droneBus().gain.calls.at(-1)).toEqual(['target', 1, 10, 0.02]);
  });

  it('feeds the drone bus, not the click master gain', () => {
    const m = setup();
    m.setDroneNote('g');
    m.start(true);
    const filter = ctx.filters[0];
    const env = ctx.gains.find((g) => filter.outputs.includes(g));
    expect(env?.outputs).toEqual([droneBus()]);
  });
});

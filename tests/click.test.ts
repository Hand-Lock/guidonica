import { describe, it, expect, afterEach, vi } from 'vitest';
import { Click, clickAccent, clickTrack, scheduleClick, scheduleClicks } from '../src/audio/click';
import { MetronomeEngine } from '../src/audio/metronome';
import { createMixer } from '../src/audio/output';
import {
  BeatAccent,
  METER,
  PULSE_MODES,
  PulseMode,
  SoundProfile,
  TIME_SIGNATURES,
  TimeSignature,
  beatAccent,
} from '../src/notation/types';

type ParamCall = [string, number, number];

class MockParam {
  value = 0;
  calls: ParamCall[] = [];
  setValueAtTime(v: number, t: number): void {
    this.calls.push(['set', v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    this.calls.push(['exp', v, t]);
  }
  setTargetAtTime(v: number, t: number): void {
    this.calls.push(['target', v, t]);
  }
  cancelScheduledValues(t: number): void {
    this.calls.push(['cancel', t, t]);
  }
}

class MockNode {
  outputs: unknown[] = [];
  connect<T>(target: T): T {
    this.outputs.push(target);
    return target;
  }
  disconnect(): void {}
}

class MockOscillator extends MockNode {
  type = 'sine';
  frequency = new MockParam();
  startTime: number | null = null;
  stopTime: number | null = null;
  onended: (() => void) | null = null;
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

class MockShaper extends MockNode {
  curve: Float32Array | null = null;
  oversample = '4x';
}

/** Records every node and call; `currentTime` throws unless `live`, so offline code never reads it. */
class Recorder {
  now = 0;
  live = false;
  state = 'running';
  outputLatency = 0;
  baseLatency = 0;
  onstatechange: (() => void) | null = null;
  destination = new MockNode();
  oscillators: MockOscillator[] = [];
  gains: MockGain[] = [];
  shapers: MockShaper[] = [];
  get currentTime(): number {
    if (!this.live) throw new Error('currentTime read');
    return this.now;
  }
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
  createWaveShaper(): MockShaper {
    const node = new MockShaper();
    this.shapers.push(node);
    return node;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

const asCtx = (ctx: Recorder): BaseAudioContext => ctx as unknown as BaseAudioContext;
const asNode = (node: MockNode): AudioNode => node as unknown as AudioNode;

interface Heard {
  time: number;
  freq: number;
  level: number;
}

/** Each click as heard: start time, start frequency and peak level of its envelope. */
const heard = (ctx: Recorder): Heard[] =>
  ctx.oscillators.map((osc) => {
    const env = osc.outputs[0] as MockGain;
    return { time: osc.startTime ?? NaN, freq: osc.frequency.calls[0][1], level: env.gain.calls[0][1] };
  });

const PROFILES: SoundProfile[] = ['woodblock', 'triangle'];

describe('clickAccent (ADR 0103)', () => {
  /** The scheduler's rule before seam 3, kept here as the reference. */
  const oldRule = (ts: TimeSignature, pulse: PulseMode, n: number): BeatAccent | null =>
    pulse === 'division' || (n - 1) % METER[ts].beatGroup === 0 ? beatAccent(ts, n) : null;

  it('matches the scheduler rule for every meter and pulse', () => {
    for (const ts of TIME_SIGNATURES) {
      for (const pulse of PULSE_MODES) {
        for (let n = 1; n <= METER[ts].beatsPerMeasure; n++) {
          expect(clickAccent(ts, pulse, n)).toBe(oldRule(ts, pulse, n));
        }
      }
    }
  });

  it('clicks the felt beats on the beat pulse and every beat on the division', () => {
    const clicking = (ts: TimeSignature, pulse: PulseMode): number[] =>
      Array.from({ length: METER[ts].beatsPerMeasure }, (_, i) => i + 1).filter((n) => clickAccent(ts, pulse, n));
    expect(clicking('12/8', 'beat')).toEqual([1, 4, 7, 10]);
    expect(clicking('4/2', 'beat')).toEqual([1, 3, 5, 7]);
    expect(clicking('4/4', 'beat')).toEqual([1, 2, 3, 4]);
    expect(clicking('12/8', 'division')).toHaveLength(12);
  });
});

describe('clickTrack (ADR 0103)', () => {
  it('counts in one measure, then clicks every beat, accenting each downbeat', () => {
    const track = clickTrack({ tempo: 60, timeSignature: '4/4', pulse: 'beat', countIn: true, beats: 8 });
    expect(track.map((c) => c.time)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const primary = track.filter((c) => c.accent === 'primary').map((c) => c.time);
    expect(primary).toEqual([0, 4, 8]);
  });

  it('clicks only the felt beats of a compound meter', () => {
    const track = clickTrack({ tempo: 60, timeSignature: '6/8', pulse: 'beat', countIn: false, beats: 12 });
    expect(track.map((c) => c.time)).toEqual([0, 1.5, 3, 4.5]);
    expect(track.map((c) => c.accent)).toEqual(['primary', 'secondary', 'primary', 'secondary']);
  });

  it('offsets every time by startTime, multiplied rather than accumulated', () => {
    const o = { tempo: 77, timeSignature: '3/4', pulse: 'division', countIn: true, beats: 300 } as const;
    const spb = 60 / 77;
    const track = clickTrack({ ...o, startTime: 2.5 });
    expect(track).toHaveLength(303);
    track.forEach((c, k) => expect(c.time).toBe(2.5 + k * spb));
    expect(clickTrack(o).map((c) => c.accent)).toEqual(track.map((c) => c.accent));
  });
});

describe('scheduleClick (ADR 0103)', () => {
  const START: Record<SoundProfile, Record<BeatAccent, number>> = {
    woodblock: { primary: 1600, secondary: 1350, weak: 1100 },
    triangle: { primary: 1300, secondary: 1050, weak: 800 },
  };
  const LENGTH: Record<SoundProfile, number> = { woodblock: 0.03, triangle: 0.04 };

  for (const profile of PROFILES) {
    it(`builds a ${profile} click without the clock, ending in its output`, () => {
      const ctx = new Recorder();
      const out = new MockNode();
      const clicks: Click[] = [
        { time: 1, accent: 'primary' },
        { time: 2, accent: 'secondary' },
        { time: 3, accent: 'weak' },
      ];
      scheduleClicks(asCtx(ctx), asNode(out), clicks, profile);
      expect(ctx.oscillators).toHaveLength(3);
      ctx.oscillators.forEach((osc, i) => {
        const { time, accent } = clicks[i];
        expect(osc.type).toBe(profile === 'woodblock' ? 'sine' : 'triangle');
        expect(osc.startTime).toBe(time);
        expect(osc.stopTime).toBeCloseTo(time + LENGTH[profile], 12);
        expect(osc.frequency.calls[0]).toEqual(['set', START[profile][accent], time]);
        const env = osc.outputs[0] as MockGain;
        expect(env.outputs).toEqual([out]);
      });
      expect(out.outputs).toEqual([]);
    });
  }

  it('frees its nodes once the click ends', () => {
    const ctx = new Recorder();
    scheduleClick(asCtx(ctx), asNode(new MockNode()), 0, 'weak', 'woodblock');
    const osc = ctx.oscillators[0];
    expect(osc.onended).toBeTypeOf('function');
    expect(() => osc.onended?.()).not.toThrow();
  });
});

describe('createMixer (ADR 0103)', () => {
  it('meets the click and drone buses in one soft clipper before the destination', () => {
    const ctx = new Recorder();
    const mix = createMixer(asCtx(ctx));
    const [click, drone, input] = ctx.gains;
    expect(mix.click).toBe(click);
    expect(mix.drone).toBe(drone);
    expect(click.outputs).toEqual([input]);
    expect(drone.outputs).toEqual([input]);
    expect(input.outputs).toEqual([ctx.shapers[0]]);
    expect(ctx.shapers[0].outputs).toEqual([ctx.destination]);
    expect(ctx.shapers[0].oversample).toBe('none');
  });
});

describe('live metronome = offline click track (ADR 0103)', () => {
  let metronome: MetronomeEngine | null = null;
  const Original = window.AudioContext;

  afterEach(() => {
    metronome?.destroy();
    metronome = null;
    window.AudioContext = Original;
    vi.useRealTimers();
  });

  const METERS: TimeSignature[] = ['4/4', '6/8', '4/2'];
  const TEMPO = 77; // No beat lands on a scheduler wake-up boundary
  const STEPS = 960; // 24 s of 25 ms wake-ups

  for (const ts of METERS) {
    for (const pulse of PULSE_MODES) {
      for (const profile of PROFILES) {
        for (const countIn of [true, false]) {
          it(`${ts}, ${pulse} pulse, ${profile}, count-in ${countIn}`, () => {
            vi.useFakeTimers();
            const live = new Recorder();
            live.live = true;
            live.now = 10;
            window.AudioContext = function () {
              return live as unknown as AudioContext;
            } as unknown as typeof AudioContext;

            metronome = new MetronomeEngine(TEMPO, ts);
            metronome.setPulse(pulse);
            metronome.setSoundProfile(profile);
            metronome.start(countIn);
            for (let i = 0; i < STEPS; i++) {
              live.now += 0.025;
              vi.advanceTimersByTime(25);
            }
            // The scheduler queues every beat before now + 100 ms
            const horizon = live.now + 0.1;

            const offline = new Recorder();
            const track = clickTrack({ tempo: TEMPO, timeSignature: ts, pulse, countIn, beats: 200, startTime: 10.05 });
            scheduleClicks(asCtx(offline), asNode(new MockNode()), track.filter((c) => c.time < horizon), profile);

            const a = heard(live);
            const b = heard(offline);
            expect(a.length).toBeGreaterThan(8);
            expect(a).toHaveLength(b.length);
            a.forEach((click, i) => {
              expect(click.time).toBeCloseTo(b[i].time, 9);
              expect(click.freq).toBe(b[i].freq);
              expect(click.level).toBe(b[i].level);
            });
          });
        }
      }
    }
  }
});

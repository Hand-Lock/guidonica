import { describe, it, expect, afterEach } from 'vitest';
import { MetronomeEngine } from '../src/audio/metronome';
import { BeatAccent, METER, PulseMode, TimeSignature, beatAccent } from '../src/notation/types';

describe('MetronomeEngine', () => {
  let metronome: MetronomeEngine;

  afterEach(() => {
    if (metronome) {
      metronome.destroy();
    }
  });

  it('initializes with default tempo and parameters', () => {
    metronome = new MetronomeEngine(80, '4/4');
    expect(metronome.getIsRunning()).toBe(false);
    expect(metronome.getIsPaused()).toBe(false);
    expect(metronome.getVolume()).toBe(0.8);
    expect(metronome.getIsMuted()).toBe(false);
    expect(metronome.getSoundProfile()).toBe('woodblock');
    expect(metronome.getPulse()).toBe('beat');
  });

  it('clamps tempo to legal range (30-240 BPM)', () => {
    metronome = new MetronomeEngine(60, '4/4');

    metronome.setTempo(15);
    // At stopped state, tempo is clamped and beat rests at origin 0
    expect(metronome.getCurrentGlobalBeat()).toBe(0);
    expect(metronome.getVisualBeat()).toBe(0);

    metronome.setTempo(300);
    expect(metronome.getCurrentGlobalBeat()).toBe(0);
    expect(metronome.getVisualBeat()).toBe(0);
  });

  it('clamps volume to [0.0, 1.0] and handles mute toggles', () => {
    metronome = new MetronomeEngine(60, '4/4');

    metronome.setVolume(1.5);
    expect(metronome.getVolume()).toBe(1.0);

    metronome.setVolume(-0.2);
    expect(metronome.getVolume()).toBe(0.0);

    metronome.setVolume(0.65);
    expect(metronome.getVolume()).toBe(0.65);

    metronome.setMuted(true);
    expect(metronome.getIsMuted()).toBe(true);

    metronome.setMuted(false);
    expect(metronome.getIsMuted()).toBe(false);
  });

  it('switches sound profile and pulse mode cleanly', () => {
    metronome = new MetronomeEngine(60, '6/8');
    expect(metronome.getSoundProfile()).toBe('woodblock');

    metronome.setSoundProfile('triangle');
    expect(metronome.getSoundProfile()).toBe('triangle');

    metronome.setSoundProfile('woodblock');
    expect(metronome.getSoundProfile()).toBe('woodblock');

    metronome.setPulse('division');
    expect(metronome.getPulse()).toBe('division');
  });

  it('returns 0 for both global and visual beats when stopped', () => {
    metronome = new MetronomeEngine(60, '3/4');
    // In stationary count-in design, stopped state rests at Measure 0 beat 0
    expect(metronome.getCurrentGlobalBeat()).toBe(0);
    expect(metronome.getVisualBeat()).toBe(0);

    metronome.setTimeSignature('6/8');
    expect(metronome.getCurrentGlobalBeat()).toBe(0);
    expect(metronome.getVisualBeat()).toBe(0);
  });

  it('clamps negative count-in beats to 0 for getVisualBeat to wait in place', () => {
    // Mock AudioContext for Web Audio clock simulation
    const mockCtx = {
      currentTime: 10.0,
      state: 'running',
      destination: {},
      createGain: () => ({
        connect: () => {},
        disconnect: () => {},
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          cancelScheduledValues: () => {},
        },
      }),
      createOscillator: () => ({
        type: 'sine',
        connect: () => {},
        disconnect: () => {},
        frequency: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
        },
        start: () => {},
        stop: () => {},
      }),
      resume: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };

    const OriginalAudioContext = window.AudioContext;
    window.AudioContext = function () {
      return mockCtx as unknown as AudioContext;
    } as unknown as typeof AudioContext;

    try {
      metronome = new MetronomeEngine(60, '4/4');
      // Start metronome with count-in at simulated currentTime = 10.0s
      metronome.start(true);
      expect(metronome.getIsRunning()).toBe(true);

      // During count-in, global beat is negative while visual beat waits in place at 0
      expect(metronome.isCountingIn()).toBe(true);
      expect(metronome.getCurrentGlobalBeat()).toBeLessThan(0);
      expect(metronome.getVisualBeat()).toBe(0);

      // Advance clock into active playback (after count-in completes at measureZeroStartTime)
      // startTime = 10.0 + 0.05 = 10.05; countIn = 4 beats = 4.0s; measureZeroStartTime = 14.05s
      mockCtx.currentTime = 15.05; // 1 beat into Measure 0
      expect(metronome.isCountingIn()).toBe(false);
      expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(1.0, 3);
      expect(metronome.getVisualBeat()).toBeCloseTo(1.0, 3);

      metronome.stop();
      expect(metronome.getCurrentGlobalBeat()).toBe(0);
      expect(metronome.getVisualBeat()).toBe(0);
    } finally {
      window.AudioContext = OriginalAudioContext;
    }
  });

  it('dynamically switches audio session between ambient (idle/pause/stop) and playback (active practice)', () => {
    // Mock W3C AudioSession API
    const mockSession = {
      type: 'auto' as const,
    };
    Object.defineProperty(navigator, 'audioSession', {
      value: mockSession,
      configurable: true,
      writable: true,
    });

    metronome = new MetronomeEngine(60, '4/4');
    // Initial state must be ambient to respect silent mode and not hijack other media
    expect(mockSession.type).toBe('ambient');
    expect(metronome.getAudioSessionType()).toBe('ambient');

    // Start practice: must elevate to playback to cut through iOS silent switch
    metronome.start(false);
    expect(mockSession.type).toBe('playback');
    expect(metronome.getAudioSessionType()).toBe('playback');

    // Pause practice: must revert to ambient to respect silent mode for UI
    metronome.pause();
    expect(mockSession.type).toBe('ambient');
    expect(metronome.getAudioSessionType()).toBe('ambient');

    // Resume practice: re-elevate to playback
    metronome.resume();
    expect(mockSession.type).toBe('playback');
    expect(metronome.getAudioSessionType()).toBe('playback');

    // Stop practice: revert to ambient
    metronome.stop();
    expect(mockSession.type).toBe('ambient');
    expect(metronome.getAudioSessionType()).toBe('ambient');

    // Destroy: ensure session remains ambient
    metronome.destroy();
    expect(mockSession.type).toBe('ambient');

    // Clean up mock
    delete (navigator as { audioSession?: unknown }).audioSession;
  });

  it('safely handles environments where navigator.audioSession is absent', () => {
    delete (navigator as { audioSession?: unknown }).audioSession;
    metronome = new MetronomeEngine(60, '4/4');
    expect(metronome.getAudioSessionType()).toBeNull();

    expect(() => {
      metronome.start(false);
      metronome.pause();
      metronome.resume();
      metronome.stop();
      metronome.destroy();
    }).not.toThrow();
  });

  describe('hardware-clock beat info and latency compensation', () => {
    const makeCtx = (outputLatency = 0, clickFrequencies: number[] = []) => ({
      currentTime: 10.0,
      outputLatency,
      baseLatency: 0,
      state: 'running',
      destination: {},
      createGain: () => ({
        connect: () => {},
        disconnect: () => {},
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          cancelScheduledValues: () => {},
        },
      }),
      createOscillator: () => ({
        type: 'sine',
        connect: () => {},
        disconnect: () => {},
        frequency: {
          setValueAtTime: (value: number) => {
            clickFrequencies.push(value);
          },
          exponentialRampToValueAtTime: () => {},
        },
        start: () => {},
        stop: () => {},
      }),
      resume: () => Promise.resolve(),
      close: () => Promise.resolve(),
    });

    const withCtx = (ctx: ReturnType<typeof makeCtx>, fn: () => void): void => {
      const Original = window.AudioContext;
      window.AudioContext = function () {
        return ctx as unknown as AudioContext;
      } as unknown as typeof AudioContext;
      try {
        fn();
      } finally {
        window.AudioContext = Original;
      }
    };

    it('derives beat number and count-in state from the clock across the count-in boundary', () => {
      const ctx = makeCtx();
      withCtx(ctx, () => {
        metronome = new MetronomeEngine(60, '3/4');
        metronome.start(true);
        // startTime = 10.05, count-in = 3 beats → measure 0 at 13.05
        expect(metronome.getBeatInfo()).toBeNull(); // before the first click

        ctx.currentTime = 10.06;
        expect(metronome.getBeatInfo()).toMatchObject({ beatNumber: 1, isDownbeat: true, isCountIn: true });
        ctx.currentTime = 12.1;
        expect(metronome.getBeatInfo()).toMatchObject({ beatNumber: 3, isCountIn: true });
        ctx.currentTime = 13.1;
        expect(metronome.getBeatInfo()).toMatchObject({ beatIndex: 0, beatNumber: 1, isCountIn: false });
        ctx.currentTime = 17.1; // beat index 4 → second beat of measure 1
        expect(metronome.getBeatInfo()).toMatchObject({ beatIndex: 4, beatNumber: 2, isDownbeat: false });

        metronome.stop();
        expect(metronome.getBeatInfo()).toBeNull();
      });
    });

    it('delays visual time by the device output latency', () => {
      const ctx = makeCtx(0.2);
      withCtx(ctx, () => {
        metronome = new MetronomeEngine(60, '4/4');
        metronome.start(false);
        // measure 0 click scheduled at 10.05, heard at 10.25
        ctx.currentTime = 11.05;
        expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(0.8, 5);
      });
    });

    it('keeps the visual position continuous across pause and resume with latency', () => {
      const ctx = makeCtx(0.15);
      withCtx(ctx, () => {
        metronome = new MetronomeEngine(60, '4/4');
        metronome.start(false);
        ctx.currentTime = 12.0;
        const before = metronome.getCurrentGlobalBeat();
        metronome.pause();
        ctx.currentTime = 30.0;
        expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(before, 5);
        metronome.resume();
        expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(before, 5);
      });
    });

    describe('frame-locked clock (ADR 0089)', () => {
      const FRAME_MS = 1000 / 144;
      const STEP_S = 0.01; // Windows audio callback: the clock moves in 10 ms steps

      /** Drives the engine like a 144 Hz rAF loop over a clock that advances in steps. */
      const run = (
        ctx: ReturnType<typeof makeCtx>,
        frames: number,
        t0: { ms: number },
        onFrame?: (smoothed: number, raw: number) => void
      ): void => {
        for (let i = 0; i < frames; i++) {
          t0.ms += FRAME_MS;
          const trueTime = 10 + t0.ms / 1000;
          ctx.currentTime = Math.floor(trueTime / STEP_S) * STEP_S;
          metronome.tick(t0.ms);
          const smoothed = metronome.getVisualBeat();
          const raw = ctx.currentTime - 10.05; // 60 BPM: 1 s per beat, measure 0 at 10.05
          onFrame?.(smoothed, raw);
        }
      };

      it('turns the stepped audio clock into a steady per-frame advance', () => {
        const ctx = makeCtx();
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, '4/4');
          metronome.start(false);
          const t = { ms: 0 };
          run(ctx, 144, t); // warm-up: 1 s, ten time constants

          const smoothedSteps: number[] = [];
          const rawSteps: number[] = [];
          let prev: [number, number] | null = null;
          run(ctx, 288, t, (smoothed, raw) => {
            if (prev) {
              smoothedSteps.push(smoothed - prev[0]);
              rawSteps.push(raw - prev[1]);
            }
            prev = [smoothed, raw];
          });

          const frame = FRAME_MS / 1000;
          // The raw clock stands still on some frames and jumps a whole 10 ms step on others
          expect(rawSteps.some((d) => d === 0)).toBe(true);
          expect(Math.max(...rawSteps)).toBeCloseTo(STEP_S, 9);
          // The smoothed clock advances every frame by close to one frame interval
          for (const d of smoothedSteps) {
            expect(d).toBeGreaterThan(0.75 * frame);
            expect(d).toBeLessThan(1.25 * frame);
          }
        });
      });

      it('tracks the audio clock without drifting', () => {
        const ctx = makeCtx();
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, '4/4');
          metronome.start(false);
          const t = { ms: 0 };
          let worst = 0;
          let sumErr = 0;
          let n = 0;
          run(ctx, 144 * 60, t, (smoothed, raw) => {
            if (t.ms < 1000) return;
            worst = Math.max(worst, Math.abs(smoothed - raw));
            sumErr += smoothed - raw;
            n++;
          });
          // Never more than one clock step away; on average centred on the staircase
          expect(worst).toBeLessThan(STEP_S);
          expect(Math.abs(sumErr / n)).toBeLessThan(0.002);
        });
      });

      it('snaps to the audio clock after a jump larger than any clock step', () => {
        const ctx = makeCtx();
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, '4/4');
          metronome.start(false);
          const t = { ms: 0 };
          run(ctx, 144, t);
          ctx.currentTime += 0.5; // device stall recovered
          t.ms += FRAME_MS;
          metronome.tick(t.ms);
          expect(metronome.getVisualBeat()).toBeCloseTo(ctx.currentTime - 10.05, 6);
        });
      });

      it('freezes on the displayed beat when paused and resumes from it', () => {
        const ctx = makeCtx(0.04);
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, '4/4');
          metronome.start(false);
          const t = { ms: 0 };
          run(ctx, 300, t);
          const shown = metronome.getCurrentGlobalBeat();
          metronome.pause();
          ctx.currentTime += 7;
          expect(metronome.getCurrentGlobalBeat()).toBe(shown);
          metronome.resume();
          expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(shown, 9);
          t.ms += 7000 + FRAME_MS;
          metronome.tick(t.ms);
          expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(shown, 9);
        });
      });

      it('keeps the displayed beat continuous across a tempo change', () => {
        const ctx = makeCtx();
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, '4/4');
          metronome.start(false);
          const t = { ms: 0 };
          run(ctx, 300, t);
          const shown = metronome.getCurrentGlobalBeat();
          metronome.setTempo(120);
          expect(metronome.getCurrentGlobalBeat()).toBeCloseTo(shown, 9);
        });
      });
    });

    it('reports the secondary accent on beat 3 of a 4/4 bar', () => {
      const ctx = makeCtx();
      withCtx(ctx, () => {
        metronome = new MetronomeEngine(60, '4/4');
        metronome.start(false);
        // measure 0 starts at 10.05
        ctx.currentTime = 12.1;
        expect(metronome.getBeatInfo()).toMatchObject({ beatNumber: 3, accent: 'secondary', isDownbeat: false });
        ctx.currentTime = 13.1;
        expect(metronome.getBeatInfo()).toMatchObject({ beatNumber: 4, accent: 'weak' });
        ctx.currentTime = 14.1;
        expect(metronome.getBeatInfo()).toMatchObject({ beatNumber: 1, accent: 'primary', isDownbeat: true });
      });
    });

    it('clicks the medium woodblock (1350 Hz) on 4/4 beat 3', () => {
      const starts: number[] = [];
      const ctx = makeCtx(0, starts);
      withCtx(ctx, () => {
        metronome = new MetronomeEngine(60, '4/4');
        metronome.start(false);
        const tick = (metronome as unknown as { scheduler(): void }).scheduler.bind(metronome);
        for (let i = 1; i < 4; i++) {
          ctx.currentTime = 10 + i;
          tick();
        }
        expect(starts).toEqual([1600, 1100, 1350, 1100]);
      });
    });

    it('clicks only the felt beats of grouped meters unless the pulse is the division (ADRs 0076, 0090)', () => {
      const clicks = (ts: TimeSignature, pulse: PulseMode): number[] => {
        const starts: number[] = [];
        const ctx = makeCtx(0, starts);
        withCtx(ctx, () => {
          metronome = new MetronomeEngine(60, ts);
          metronome.setPulse(pulse);
          metronome.start(false);
          const tick = (metronome as unknown as { scheduler(): void }).scheduler.bind(metronome);
          // At 60 quarter BPM an eighth lasts 0.5 s and a quarter 1 s: tick once per metric beat
          const step = METER[ts].beatValue === 8 ? 0.5 : 1;
          for (let i = 1; i < METER[ts].beatsPerMeasure; i++) {
            ctx.currentTime = 10 + i * step;
            tick();
          }
          metronome.stop();
        });
        return starts;
      };
      expect(clicks('9/8', 'beat')).toEqual([1600, 1350, 1350]);
      expect(clicks('12/8', 'beat')).toEqual([1600, 1350, 1350, 1350]);
      expect(clicks('12/8', 'division')).toEqual([1600, 1100, 1100, 1350, 1100, 1100, 1350, 1100, 1100, 1350, 1100, 1100]);
      expect(clicks('2/2', 'beat')).toEqual([1600, 1350]);
      expect(clicks('2/2', 'division')).toEqual([1600, 1100, 1350, 1100]);
      expect(clicks('3/2', 'beat')).toEqual([1600, 1350, 1350]);
      expect(clicks('4/2', 'beat')).toEqual([1600, 1350, 1350, 1350]);
      expect(clicks('6/4', 'beat')).toEqual([1600, 1350]);
      expect(clicks('9/4', 'division')).toEqual([1600, 1100, 1100, 1350, 1100, 1100, 1350, 1100, 1100]);
      expect(clicks('4/4', 'beat')).toEqual([1600, 1100, 1350, 1100]);
    });
  });

  it('maps every meter to its beat accent hierarchy', () => {
    const expected: Record<TimeSignature, BeatAccent[]> = {
      '4/4': ['primary', 'weak', 'secondary', 'weak'],
      '3/4': ['primary', 'weak', 'weak'],
      '2/4': ['primary', 'weak'],
      '6/8': ['primary', 'weak', 'weak', 'secondary', 'weak', 'weak'],
      '9/8': ['primary', 'weak', 'weak', 'secondary', 'weak', 'weak', 'secondary', 'weak', 'weak'],
      '12/8': [
        'primary', 'weak', 'weak', 'secondary', 'weak', 'weak',
        'secondary', 'weak', 'weak', 'secondary', 'weak', 'weak',
      ],
      '4/2': ['primary', 'weak', 'secondary', 'weak', 'secondary', 'weak', 'secondary', 'weak'],
      '3/2': ['primary', 'weak', 'secondary', 'weak', 'secondary', 'weak'],
      '2/2': ['primary', 'weak', 'secondary', 'weak'],
      '12/4': [
        'primary', 'weak', 'weak', 'secondary', 'weak', 'weak',
        'secondary', 'weak', 'weak', 'secondary', 'weak', 'weak',
      ],
      '9/4': ['primary', 'weak', 'weak', 'secondary', 'weak', 'weak', 'secondary', 'weak', 'weak'],
      '6/4': ['primary', 'weak', 'weak', 'secondary', 'weak', 'weak'],
    };
    for (const [ts, accents] of Object.entries(expected) as [TimeSignature, BeatAccent[]][]) {
      expect(accents.map((_, i) => beatAccent(ts, i + 1))).toEqual(accents);
    }
  });
});

import { describe, it, expect, afterEach } from 'vitest';
import { MetronomeEngine } from '../src/audio/metronome';

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
    expect(metronome.getPulse68()).toBe('dotted-quarter');
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

  it('switches sound profile and 6/8 pulse mode cleanly', () => {
    metronome = new MetronomeEngine(60, '6/8');
    expect(metronome.getSoundProfile()).toBe('woodblock');

    metronome.setSoundProfile('triangle');
    expect(metronome.getSoundProfile()).toBe('triangle');

    metronome.setSoundProfile('woodblock');
    expect(metronome.getSoundProfile()).toBe('woodblock');

    metronome.setPulse68('eighth');
    expect(metronome.getPulse68()).toBe('eighth');
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
    const makeCtx = (outputLatency = 0) => ({
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
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
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
  });
});

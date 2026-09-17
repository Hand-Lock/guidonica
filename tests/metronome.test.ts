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
    // At stopped state, tempo is clamped
    expect(metronome.getCurrentGlobalBeat()).toBe(-4); // count-in default

    metronome.setTempo(300);
    expect(metronome.getCurrentGlobalBeat()).toBe(-4);
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

  it('computes negative count-in beats when stopped with count-in', () => {
    metronome = new MetronomeEngine(60, '3/4');
    // 3 beats per measure count-in
    expect(metronome.getCurrentGlobalBeat()).toBe(-3);

    metronome.setTimeSignature('6/8');
    expect(metronome.getCurrentGlobalBeat()).toBe(-6);
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
});

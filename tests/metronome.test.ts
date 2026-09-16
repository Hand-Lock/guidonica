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
});

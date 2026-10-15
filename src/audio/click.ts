// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Click voice, accents and click track into any BaseAudioContext (ADR 0103)
// Copyright (C) 2026 A. C. Lo Cascio

import {
  BeatAccent,
  METER,
  PulseMode,
  SoundProfile,
  TimeSignature,
  beatAccent,
  secondsPerBeat,
} from '../notation/types';

/** One metronome click, timed on the audio clock. */
export interface Click {
  time: number;
  accent: BeatAccent;
}

/**
 * The accent of metric beat `beatNumber` (1-based), or null when it does not click. Beat
 * pulse: only the metric beat that starts each felt beat clicks (1, 4, 7, 10 in 12/8;
 * 1, 3, 5, 7 in 4/2), as every beat does in ungrouped meters (ADR 0076, 0090).
 */
export function clickAccent(ts: TimeSignature, pulse: PulseMode, beatNumber: number): BeatAccent | null {
  if (pulse !== 'division' && (beatNumber - 1) % METER[ts].beatGroup !== 0) return null;
  return beatAccent(ts, beatNumber);
}

/**
 * Schedules one click at `time` into `out`. Never reads `ctx.currentTime`, so it works the
 * same on a realtime and an offline context; its nodes free themselves once it ends.
 */
export function scheduleClick(
  ctx: BaseAudioContext,
  out: AudioNode,
  time: number,
  accent: BeatAccent,
  profile: SoundProfile
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (profile === 'woodblock') {
    // Woodblock: sine wave with rapid downward pitch sweep
    osc.type = 'sine';
    let freqStart = 1100;
    let freqEnd = 550;
    let gainLevel = 0.9;

    if (accent === 'primary') {
      freqStart = 1600;
      freqEnd = 800;
      gainLevel = 1.0;
    } else if (accent === 'secondary') {
      freqStart = 1350;
      freqEnd = 675;
      gainLevel = 0.95;
    }

    osc.frequency.setValueAtTime(freqStart, time);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, time + 0.025);

    gain.gain.setValueAtTime(gainLevel, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);

    osc.connect(gain);
    gain.connect(out);

    osc.start(time);
    osc.stop(time + 0.03);
  } else {
    // Electronic triangle click
    osc.type = 'triangle';
    let freq = 800;
    let gainLevel = 0.7;

    if (accent === 'primary') {
      freq = 1300;
      gainLevel = 1.0;
    } else if (accent === 'secondary') {
      freq = 1050;
      gainLevel = 0.85;
    }

    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    // Smooth exponential decay over 35 milliseconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(out);

    osc.start(time);
    osc.stop(time + 0.04);
  }

  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      // Safe disposal
    }
  };
}

/** Schedules every click at once: an offline caller queues them all before `startRendering()`. */
export function scheduleClicks(
  ctx: BaseAudioContext,
  out: AudioNode,
  clicks: readonly Click[],
  profile: SoundProfile
): void {
  for (const click of clicks) scheduleClick(ctx, out, click.time, click.accent, profile);
}

export interface ClickTrackOptions {
  tempo: number;
  timeSignature: TimeSignature;
  pulse: PulseMode;
  /** One measure of clicks before measure 0, as in the app. */
  countIn: boolean;
  /** Metric beats after the count-in. */
  beats: number;
  /** Context time of the first beat (count-in included); default 0. */
  startTime?: number;
}

/**
 * The clicks the live scheduler would queue from `startTime`: measure 0 starts at
 * startTime + countInBeats·spb, as in seam 2's beat = t / spb − countInBeats. Each time is
 * startTime + k·spb, multiplied rather than accumulated, so long tracks carry no float drift.
 */
export function clickTrack(o: ClickTrackOptions): Click[] {
  const { tempo, timeSignature: ts, pulse, countIn, beats, startTime = 0 } = o;
  const spb = secondsPerBeat(tempo, ts);
  const { beatsPerMeasure } = METER[ts];
  const countInBeats = countIn ? beatsPerMeasure : 0;
  const clicks: Click[] = [];
  for (let k = 0; k < countInBeats + beats; k++) {
    const index = k < countInBeats ? k : k - countInBeats;
    const accent = clickAccent(ts, pulse, (index % beatsPerMeasure) + 1);
    if (accent) clicks.push({ time: startTime + k * spb, accent });
  }
  return clicks;
}

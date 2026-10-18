import { describe, it, expect } from 'vitest';
import {
  beatX,
  spaceMeasure,
  spacingWidth,
  squishyBeatWidth,
  tupletCell,
  typicalBarWidth,
} from '../src/notation/spacing';
import { MusicGenerator } from '../src/notation/generator';
import { mulberry32 } from '../src/notation/random';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  METER,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  TIME_SIGNATURES,
  TimeSignature,
  computeBeatWidth,
} from '../src/notation/types';

const note = (duration: string, beatOffset: number, beatDuration: number, extra: Partial<NoteData> = {}): NoteData => ({
  keys: ['c/4'],
  duration,
  isRest: false,
  beatOffset,
  beatDuration,
  ...extra,
});

const bar = (index: number, notes: NoteData[], ts: TimeSignature = '4/4'): MeasureData => ({
  index,
  notes,
  clef: 'treble',
  timeSignature: ts,
  beatsPerMeasure: METER[ts].beatsPerMeasure,
  beatValue: METER[ts].beatValue,
  beatWidth: 0,
  width: 0,
  startBeat: index * METER[ts].beatsPerMeasure,
});

const halves = (index: number) => bar(index, [note('h', 0, 2), note('h', 2, 2)]);
const sixteenths = (index: number) =>
  bar(index, Array.from({ length: 16 }, (_, i) => note('16', i / 4, 0.25)));

const busy = (): AppSettings => {
  const s: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
  s.subdivisions.sixteenth = true;
  s.subdivisions.thirtySecond = true;
  s.tuplets.triplet['1/8'] = true;
  s.tuplets.septuplet['1/16'] = true;
  return s;
};

const linear = (s: AppSettings, ts: TimeSignature = s.timeSignature) =>
  computeBeatWidth(s.subdivisions, ts, s.tuplets);

/** Lays generated bars out in a chain, as the buffer does. */
function chain(settings: AppSettings, count: number, seed = 3): MeasureData[] {
  const generator = new MusicGenerator(mulberry32(seed));
  const beats = METER[settings.timeSignature].beatsPerMeasure;
  const raw = Array.from({ length: count + 1 }, (_, i) => generator.generateMeasure(i, settings, i * beats));
  const out: MeasureData[] = [];
  for (let i = 0; i < count; i++) {
    out.push(spaceMeasure(raw[i], out[i - 1] ?? null, raw[i + 1], settings.view, settings));
  }
  return out;
}

describe('squishy spacing (ADR 0109)', () => {
  it('keeps the steady layout linear, bit for bit', () => {
    for (const w of [37.5, 60, 91.25]) {
      for (const o of [0, 0.25, 1, 2.75, 4]) {
        expect(beatX({ beatWidth: w }, '4/4', o)).toBe(NOTE_START_OFFSET + o * w);
      }
    }
    const s = busy();
    const laid = spaceMeasure(halves(0), null, halves(1), 'steady', s);
    expect(laid.beatWidth).toBe(linear(s));
    expect(laid.width).toBe(4 * linear(s));
  });

  it('makes a half-note bar narrower than a sixteenth bar, never wider than linear', () => {
    const s = busy();
    const slow = squishyBeatWidth(halves(0), s);
    const fast = squishyBeatWidth(sixteenths(0), s);
    expect(slow).toBeLessThan(fast);
    expect(fast).toBeLessThanOrEqual(linear(s));
    for (const ts of TIME_SIGNATURES) {
      s.timeSignature = ts;
      s.view = 'squishy';
      for (const d of chain(s, 12)) {
        expect(d.beatWidth).toBeLessThanOrEqual(linear(s, ts));
        expect(d.width).toBeLessThanOrEqual(d.beatsPerMeasure * linear(s, ts) + 1e-9);
      }
    }
  });

  it('eases speed across every barline: no jump in position or velocity', () => {
    const s = busy();
    for (const ts of TIME_SIGNATURES) {
      s.timeSignature = ts;
      s.view = 'squishy';
      const bars = chain(s, 16);
      const B = METER[ts].beatsPerMeasure;
      const h = 1e-6;
      for (let i = 1; i < bars.length; i++) {
        const a = bars[i - 1];
        const b = bars[i];
        // The bar's end lands on the next bar's barline
        expect(beatX(a, ts, B) - NOTE_START_OFFSET).toBeCloseTo(a.width, 9);
        const out = (beatX(a, ts, B) - beatX(a, ts, B - h)) / h;
        const into = (beatX(b, ts, h) - beatX(b, ts, 0)) / h;
        expect(out).toBeCloseTo(into, 3);
      }
    }
  });

  it('moves strictly forward through every bar', () => {
    const s = busy();
    s.view = 'squishy';
    for (const ts of ['4/4', '6/8', '3/2'] as TimeSignature[]) {
      s.timeSignature = ts;
      for (const d of chain(s, 12)) {
        let last = -Infinity;
        for (let o = -1; o <= d.beatsPerMeasure + 1; o += 1 / 32) {
          const x = beatX(d, ts, o);
          expect(x).toBeGreaterThan(last);
          last = x;
        }
      }
    }
  });

  it('ramps only on the narrower side, by half a felt beat of extra speed', () => {
    const s = busy();
    const slow = squishyBeatWidth(halves(0), s);
    const fast = squishyBeatWidth(sixteenths(0), s);
    const before = spaceMeasure(sixteenths(0), null, halves(1), 'squishy', s);
    expect(before.entryBeatWidth).toBeUndefined();
    expect(before.exitBeatWidth).toBeUndefined();
    const mid = spaceMeasure(halves(1), before, sixteenths(2), 'squishy', s);
    expect(mid.entryBeatWidth).toBe(fast);
    expect(mid.exitBeatWidth).toBe(fast);
    expect(mid.width).toBeCloseTo(4 * slow + (fast - slow), 9);
    expect(spacingWidth(mid, '4/4')).toBe(mid.width);
    // A bar that does not follow is not a neighbour
    const far = spaceMeasure(halves(5), before, null, 'squishy', s);
    expect(far.entryBeatWidth).toBeUndefined();
  });

  it('carries the previous bar spacing into an incoming tie', () => {
    const s = busy();
    const prev = spaceMeasure(sixteenths(0), null, halves(1), 'squishy', s);
    const tied = halves(1);
    tied.tieIn = { beatOffset: 3.75, duration: '16', beatWidth: 1, measureWidth: 1 };
    const laid = spaceMeasure(tied, prev, null, 'squishy', s);
    expect(laid.tieIn).toEqual({ beatOffset: 3.75, duration: '16', beatWidth: prev.beatWidth, measureWidth: prev.width });
    expect(laid.notes).toBe(tied.notes);
  });

  it('derives tuplet cells from their notes', () => {
    expect(tupletCell('4/4', 3, 2, 1)).toEqual({ name: 'triplet', value: '1/8' });
    expect(tupletCell('4/4', 3, 2, 2)).toEqual({ name: 'triplet', value: '1/4' });
    expect(tupletCell('4/4', 5, 4, 1)).toEqual({ name: 'quintuplet', value: '1/16' });
    expect(tupletCell('6/8', 2, 3, 3)).toEqual({ name: 'duplet', value: '1/8' });
    expect(tupletCell('6/8', 4, 3, 1.5)).toEqual({ name: 'quadruplet', value: '1/16' });
    expect(tupletCell('4/4', 3, 2, 0.3)).toBeNull();
    expect(tupletCell('4/4', 12, 2, 1)).toBeNull();

    const s = busy();
    const triplets = bar(0, [
      ...[0, 1, 2].map((i) => note('8', i / 3, 1 / 3, { isTuplet: true, tupletGroup: 1, tupletNumNotes: 3, tupletNotesOccupied: 2 })),
      note('q', 1, 1),
      note('h', 2, 2),
    ]);
    const onlyTriplets = computeBeatWidth(
      { whole: false, half: false, quarter: false, eighth: false, sixteenth: false, thirtySecond: false, dotted: false },
      '4/4',
      { ...structuredClone(DEFAULT_APP_SETTINGS.tuplets), triplet: { '1/4': false, '1/8': true, '1/16': false } }
    );
    expect(squishyBeatWidth(triplets, s)).toBe(Math.max(onlyTriplets, squishyBeatWidth(bar(0, [note('q', 0, 1)]), s)));
  });

  it('finds the same typical bar width every time, below the linear one', () => {
    const s = busy();
    const a = typicalBarWidth(s);
    expect(typicalBarWidth({ ...s, clef: 'bass', tempo: 200 })).toBe(a);
    const other = typicalBarWidth({ ...s, timeSignature: '3/4' });
    expect(typicalBarWidth(structuredClone(s))).toBe(a);
    expect(other).not.toBe(a);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(4 * linear(s));
  });
});

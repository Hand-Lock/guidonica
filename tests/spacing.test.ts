import { describe, it, expect } from 'vitest';
import {
  SPACING_EXPONENT,
  beatX,
  noteSpace,
  shortestBeats,
  spaceMeasure,
  typicalBarWidth,
} from '../src/notation/spacing';
import { MusicGenerator } from '../src/notation/generator';
import { mulberry32 } from '../src/notation/random';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  DEFAULT_TUPLET_OPTIONS,
  METER,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  SubdivisionOptions,
  TIME_SIGNATURES,
  TimeSignature,
  TupletOptions,
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

/** 16ths and triplet eighths on: the plan's reference session. */
const sixteenthsAndTriplets = (): AppSettings => {
  const s: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
  s.subdivisions.sixteenth = true;
  s.tuplets.triplet['1/8'] = true;
  return s;
};

const busy = (): AppSettings => {
  const s = sixteenthsAndTriplets();
  s.subdivisions.thirtySecond = true;
  s.tuplets.septuplet['1/16'] = true;
  return s;
};

const NONE: SubdivisionOptions = {
  whole: false,
  half: false,
  quarter: false,
  eighth: false,
  sixteenth: false,
  thirtySecond: false,
  dotted: false,
};

const only = (subdivisions: Partial<SubdivisionOptions>, cells: [keyof TupletOptions, '1/4' | '1/8' | '1/16'][] = []) => {
  const tuplets = structuredClone(DEFAULT_TUPLET_OPTIONS) as TupletOptions;
  for (const [name, value] of cells) tuplets[name][value] = true;
  return { subdivisions: { ...NONE, ...subdivisions }, tuplets };
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

/** Every meter, laid out squishy with the busy rhythm. */
function* squishyChains(count = 16): Generator<[TimeSignature, MeasureData[], AppSettings]> {
  for (const ts of TIME_SIGNATURES) {
    const s = busy();
    s.timeSignature = ts;
    s.view = 'squishy';
    yield [ts, chain(s, count), s];
  }
}

describe('squishy engraved spacing (ADR 0109)', () => {
  it('keeps the steady layout linear, bit for bit', () => {
    for (const w of [37.5, 60, 91.25]) {
      for (const o of [0, 0.25, 1, 2.75, 4]) {
        expect(beatX({ beatWidth: w }, o)).toBe(NOTE_START_OFFSET + o * w);
      }
    }
    const s = busy();
    const laid = spaceMeasure(halves(0), null, halves(1), 'steady', s);
    expect(laid.beatWidth).toBe(linear(s));
    expect(laid.width).toBe(4 * linear(s));
    expect(laid.knots).toBeUndefined();
  });

  it('gives each doubling of duration √2 more space, from the shortest value up', () => {
    expect(SPACING_EXPONENT).toBe(0.5);
    const s = sixteenthsAndTriplets();
    const table: [number, number][] = [
      [0.25, 55],
      [1 / 3, 63.51],
      [0.5, 77.78],
      [1, 110],
      [2, 155.56],
      [4, 220],
    ];
    for (const [d, px] of table) expect(noteSpace(d, s, '4/4')).toBeCloseTo(px, 2);
    for (let d = 0.25; d <= 4; d *= 2) {
      expect(noteSpace(2 * d, s, '4/4') / noteSpace(d, s, '4/4')).toBeCloseTo(Math.SQRT2, 12);
    }
  });

  it('starts the shortest value at the steady clearance of that value', () => {
    const cases: [ReturnType<typeof only>, TimeSignature, number][] = [
      [only({ quarter: true, sixteenth: true }), '4/4', 55],
      [only({ quarter: true, eighth: true }), '4/4', 65],
      [only({ quarter: true }, [['triplet', '1/8']]), '4/4', 55],
      [only({ quarter: true }, [['septuplet', '1/16']]), '4/4', 40],
      [only({ quarter: true, thirtySecond: true }), '4/4', 45],
      [only({ eighth: true, sixteenth: true }), '6/8', 55],
      // Long values only: never more than one linear beat as the base
      [only({ half: true }), '4/4', 110],
    ];
    for (const [s, ts, px] of cases) {
      expect(noteSpace(shortestBeats(s, ts), s, ts)).toBeCloseTo(px, 9);
    }
  });

  it('finds the shortest duration per meter, tuplet members included', () => {
    expect(shortestBeats(only({ quarter: true, sixteenth: true }), '4/4')).toBe(0.25);
    expect(shortestBeats(only({ eighth: true, sixteenth: true }), '6/8')).toBe(0.5);
    expect(shortestBeats(only({ quarter: true, thirtySecond: true }), '6/8')).toBe(0.25);
    expect(shortestBeats(only({ quarter: true }, [['triplet', '1/8']]), '4/4')).toBeCloseTo(1 / 3, 12);
    expect(shortestBeats(only({ quarter: true }, [['septuplet', '1/16']]), '4/4')).toBeCloseTo(1 / 7, 12);
    expect(shortestBeats(only({ eighth: true }, [['duplet', '1/8']]), '6/8')).toBe(1);
    expect(shortestBeats(only({}, [['duplet', '1/8']]), '6/8')).toBe(1.5);
    expect(shortestBeats(only({ half: true }), '4/4')).toBe(2);
    // Nothing enabled: the quarter (the eighth beat in 6/8), as in the rhythm grammar
    expect(shortestBeats(only({}), '4/4')).toBe(1);
    expect(shortestBeats(only({}), '6/8')).toBe(1);
    // A cell the meter does not support never counts
    expect(shortestBeats(only({ quarter: true }, [['septuplet', '1/16']]), '6/8')).toBe(1);
  });

  it('places every note at the sum of the spaces before it, the barline after the last', () => {
    for (const [ts, bars, s] of squishyChains(8)) {
      for (const d of bars) {
        let x = NOTE_START_OFFSET;
        for (const n of d.notes) {
          expect(beatX(d, n.beatOffset)).toBeCloseTo(x, 9);
          x += noteSpace(n.beatDuration, s, ts);
        }
        expect(d.width).toBeCloseTo(x - NOTE_START_OFFSET, 9);
        expect(beatX(d, d.beatsPerMeasure)).toBeCloseTo(NOTE_START_OFFSET + d.width, 9);
        expect(d.beatWidth).toBeCloseTo(d.width / d.beatsPerMeasure, 12);
      }
    }
  });

  it('gives equal durations equal space in every bar', () => {
    for (const [ts, bars] of squishyChains()) {
      const seen = new Map<number, number>();
      for (const d of bars) {
        const ends = [...d.notes.slice(1).map((n) => n.beatOffset), d.beatsPerMeasure];
        d.notes.forEach((n, i) => {
          const px = beatX(d, ends[i]) - beatX(d, n.beatOffset);
          const key = Math.round(n.beatDuration * 1e6);
          const known = seen.get(key);
          if (known === undefined) seen.set(key, px);
          else expect(px).toBeCloseTo(known, 9);
        });
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });

  it('is never wider per beat than the steady layout', () => {
    for (const [ts, bars, s] of squishyChains()) {
      for (const d of bars) {
        for (const n of d.notes) {
          expect(noteSpace(n.beatDuration, s, ts) / n.beatDuration).toBeLessThanOrEqual(linear(s, ts) + 1e-9);
        }
        expect(d.width).toBeLessThanOrEqual(d.beatsPerMeasure * linear(s, ts) + 1e-9);
      }
    }
    // Shorter than any written value (a rest piece): linear, never wider
    const s = sixteenthsAndTriplets();
    expect(noteSpace(0.125, s, '4/4')).toBe(0.125 * linear(s, '4/4'));
  });

  it('keeps position and velocity continuous across every barline', () => {
    const h = 1e-7;
    for (const [ts, bars] of squishyChains()) {
      const B = METER[ts].beatsPerMeasure;
      for (let i = 1; i < bars.length; i++) {
        const a = bars[i - 1];
        const b = bars[i];
        expect(beatX(a, B) - NOTE_START_OFFSET).toBeCloseTo(a.width, 9);
        // The two bars agree on the barline slope exactly
        expect(a.knots?.slopes[a.notes.length]).toBe(b.knots?.slopes[0]);
        const out = (beatX(a, B) - beatX(a, B - h)) / h;
        const into = (beatX(b, h) - beatX(b, 0)) / h;
        expect(Math.abs(out - into) / out).toBeLessThan(1e-3);
      }
    }
  });

  it('keeps velocity continuous at every note inside a bar', () => {
    const h = 1e-7;
    for (const [ts, bars] of squishyChains(6)) {
      for (const d of bars) {
        for (const n of d.notes.slice(1)) {
          const o = n.beatOffset;
          const left = (beatX(d, o) - beatX(d, o - h)) / h;
          const right = (beatX(d, o + h) - beatX(d, o)) / h;
          expect(Math.abs(left - right) / left).toBeLessThan(1e-3);
        }
      }
    }
  });

  it('moves strictly forward through every bar and beyond its ends', () => {
    for (const [ts, bars] of squishyChains(12)) {
      for (const d of bars) {
        let last = -Infinity;
        for (let o = -1; o <= d.beatsPerMeasure + 1; o += 1 / 96) {
          const x = beatX(d, o);
          expect(x).toBeGreaterThan(last);
          last = x;
        }
      }
    }
  });

  it('uses one-sided end slopes without a neighbour, and only the adjacent bar as one', () => {
    const s = sixteenthsAndTriplets();
    const alone = spaceMeasure(halves(1), null, null, 'squishy', s);
    const secant = noteSpace(2, s, '4/4') / 2;
    expect(alone.knots?.slopes[0]).toBeCloseTo(secant, 12);
    expect(alone.knots?.slopes[2]).toBeCloseTo(secant, 12);
    const before = spaceMeasure(sixteenths(0), null, halves(1), 'squishy', s);
    const mid = spaceMeasure(halves(1), before, sixteenths(2), 'squishy', s);
    const fast = noteSpace(0.25, s, '4/4') / 0.25;
    const joint = (2 * fast * secant) / (fast + secant);
    expect(before.knots?.slopes[16]).toBeCloseTo(joint, 12);
    expect(mid.knots?.slopes[0]).toBeCloseTo(joint, 12);
    expect(mid.knots?.slopes[2]).toBeCloseTo(joint, 12);
    // A bar that does not follow is not a neighbour
    const far = spaceMeasure(halves(5), before, null, 'squishy', s);
    expect(far.knots?.slopes[0]).toBeCloseTo(secant, 12);
  });

  it('spaces a bar rest as one note of the whole bar', () => {
    const s = sixteenthsAndTriplets();
    const rest = spaceMeasure(bar(0, [note('wr', 0, 4, { isRest: true })]), null, null, 'squishy', s);
    expect(rest.width).toBeCloseTo(noteSpace(4, s, '4/4'), 12);
  });

  it('shares the previous bar knots with an incoming tie', () => {
    const s = busy();
    const prev = spaceMeasure(sixteenths(0), null, halves(1), 'squishy', s);
    const tied = halves(1);
    tied.tieIn = { beatOffset: 3.75, duration: '16', beatWidth: 1, measureWidth: 1 };
    const laid = spaceMeasure(tied, prev, null, 'squishy', s);
    expect(laid.tieIn?.knots).toBe(prev.knots);
    expect(laid.tieIn).toMatchObject({ beatOffset: 3.75, duration: '16', beatWidth: prev.beatWidth, measureWidth: prev.width });
    expect(laid.notes).toBe(tied.notes);
  });

  it('finds the same typical bar width every time, below the linear bar with 16ths on', () => {
    const s = busy();
    const a = typicalBarWidth(s);
    expect(typicalBarWidth({ ...s, clef: 'bass', tempo: 200 })).toBe(a);
    const other = typicalBarWidth({ ...s, timeSignature: '3/4' });
    expect(typicalBarWidth(structuredClone(s))).toBe(a);
    expect(other).not.toBe(a);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(4 * linear(s));
    const t = sixteenthsAndTriplets();
    expect(typicalBarWidth(t)).toBeLessThan(0.8 * 4 * linear(t));
  });
});

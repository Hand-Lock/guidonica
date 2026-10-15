import { afterEach, describe, it, expect, vi } from 'vitest';
import { MusicGenerator } from '../src/notation/generator';
import { Random, mulberry32 } from '../src/notation/random';
import {
  AppSettings,
  CLEFS,
  IntervalOptions,
  MeasureData,
  TIME_SIGNATURES,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TupletOptions,
} from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';

const BARS = 24;

const ALL_TUPLETS = Object.fromEntries(
  TUPLET_NAMES.map((name) => [name, Object.fromEntries(TUPLET_VALUES.map((value) => [value, true]))])
) as TupletOptions;

const ALL_INTERVALS: IntervalOptions = {
  unison: true,
  second: true,
  third: true,
  fourth: true,
  fifth: true,
  sixth: true,
  seventh: true,
  octave: true,
  ninthPlus: true,
};

/** Every meter and clef, at the defaults and with every rhythm and interval option on over a pitch-class subset. */
const CONFIGS: AppSettings[] = TIME_SIGNATURES.flatMap((timeSignature) =>
  CLEFS.flatMap((clef): AppSettings[] => [
    { ...DEFAULT_APP_SETTINGS, timeSignature, clef },
    {
      ...DEFAULT_APP_SETTINGS,
      timeSignature,
      clef,
      rests: true,
      ties: true,
      tuplets: ALL_TUPLETS,
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: true,
        thirtySecond: true,
        dotted: true,
      },
      intervals: ALL_INTERVALS,
      pitchClasses: { c: true, d: false, e: true, f: false, g: true, a: true, b: false },
    },
  ])
);

function run(generator: MusicGenerator, settings: AppSettings): MeasureData[] {
  const measures: MeasureData[] = [];
  let startBeat = 0;
  for (let m = 0; m < BARS; m++) {
    const measure = generator.generateMeasure(m, settings, startBeat);
    measures.push(measure);
    startBeat += measure.beatsPerMeasure;
  }
  return measures;
}

function stream(random: Random, count: number): number[] {
  return Array.from({ length: count }, () => random());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mulberry32', () => {
  it('draws on [0, 1)', () => {
    for (const x of stream(mulberry32(7), 10000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('repeats a seed and separates seeds', () => {
    expect(stream(mulberry32(42), 100)).toEqual(stream(mulberry32(42), 100));
    expect(stream(mulberry32(42), 100)).not.toEqual(stream(mulberry32(43), 100));
  });
});

describe('seeded MusicGenerator (ADR 0103)', () => {
  it('draws only from the injected source', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random leaked past the injected source');
    });
    CONFIGS.forEach((settings, i) => {
      expect(() => run(new MusicGenerator(mulberry32(i)), settings)).not.toThrow();
    });
  });

  it('repeats the same music for the same seed, and not for another', () => {
    CONFIGS.forEach((settings, i) => {
      const a = run(new MusicGenerator(mulberry32(i)), settings);
      expect(run(new MusicGenerator(mulberry32(i)), settings)).toEqual(a);
      expect(run(new MusicGenerator(mulberry32(i + 1000)), settings)).not.toEqual(a);
    });
  });

  it('keeps the draw order of the default Math.random path', () => {
    CONFIGS.forEach((settings, i) => {
      const seeded = run(new MusicGenerator(mulberry32(i)), settings);
      vi.spyOn(Math, 'random').mockImplementation(mulberry32(i));
      expect(run(new MusicGenerator(), settings)).toEqual(seeded);
      vi.restoreAllMocks();
    });
  });
});

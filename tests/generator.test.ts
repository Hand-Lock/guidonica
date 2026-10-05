import { describe, it, expect } from 'vitest';
import {
  MusicGenerator,
  CLEF_PITCH_RANGES,
  SILENCE_CONTINUE_PROBABILITY,
  SILENCE_PROBABILITY,
  drawTupletMembers,
  effectiveIntervals,
  enabledValues,
  rhythmGrammar,
  pitchBounds,
  pitchPool,
  pitchSteps,
  startIndex,
  tupletCompositions,
} from '../src/notation/generator';
import { formatRange } from '../src/i18n';
import en from '../src/i18n/locales/en';
import {
  AppSettings,
  CLEFS,
  Clef,
  IntervalOptions,
  METER,
  MeasureData,
  PITCH_CLASSES,
  PitchClassOptions,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_PLACEMENTS,
  TUPLET_SUPPORT,
  TUPLET_VALUES,
  TIME_SIGNATURES,
  TimeSignature,
  TupletCell,
  TupletName,
  TupletValue,
  isCompound,
} from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';

const N = 2000;

const NO_INTERVALS: AppSettings['intervals'] = {
  unison: false,
  second: false,
  third: false,
  fourth: false,
  fifth: false,
  sixth: false,
  seventh: false,
  octave: false,
  ninthPlus: false,
};

const INTERVAL_KEYS = [
  'unison',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'octave',
  'ninthPlus',
] as const;

/** Every subset of the interval toggles; the empty one falls back to seconds and thirds. */
const ALL_INTERVAL_SETS: AppSettings['intervals'][] = Array.from({ length: 1 << INTERVAL_KEYS.length }, (_, mask) => {
  const intervals = { ...NO_INTERVALS };
  INTERVAL_KEYS.forEach((key, i) => (intervals[key] = Boolean(mask & (1 << i))));
  return intervals;
});

/** Diatonic steps an interval set allows, and whether leaps of a 9th or more are on. */
function allowedSteps(intervals: AppSettings['intervals']): { steps: number[]; ninth: boolean } {
  const steps = INTERVAL_KEYS.slice(0, 8).flatMap((key, s) => (intervals[key] ? [s] : []));
  if (steps.length === 0 && !intervals.ninthPlus) return { steps: [1, 2], ninth: false };
  return { steps, ninth: intervals.ninthPlus };
}

const QUARTERS: SubdivisionOptions = {
  whole: false,
  half: false,
  quarter: true,
  eighth: false,
  sixteenth: false,
  thirtySecond: false,
  dotted: false,
};

const EXPECTED_TUPLET_SHAPE: Record<TupletName, number> = {
  duplet: 2,
  triplet: 3,
  quadruplet: 4,
  quintuplet: 5,
  sextuplet: 6,
  septuplet: 7,
};
/** Values a member of each tuplet cell may take: 1, 2, 3, 4 or 6 tuplet units (ADR 0065). */
const TUPLET_MEMBER_VALUES: Record<TupletValue, readonly string[]> = {
  '1/4': ['q', 'h', 'hd', 'w'],
  '1/8': ['8', 'q', 'qd', 'h', 'hd'],
  '1/16': ['16', '8', '8d', 'q', 'qd'],
};

/** Tuplet groups of a measure, keyed by group id. */
function tupletGroups(m: MeasureData): MeasureData['notes'][] {
  const groups = new Map<number, MeasureData['notes']>();
  for (const n of m.notes) {
    if (!n.isTuplet || n.tupletGroup === undefined) continue;
    const group = groups.get(n.tupletGroup) ?? [];
    group.push(n);
    groups.set(n.tupletGroup, group);
  }
  return [...groups.values()];
}

/** Base value of a tuplet group: its span divided by the count it is "in the time of". */
function tupletValueOf(ts: TimeSignature, group: MeasureData['notes']): TupletValue | undefined {
  const span = group.reduce((sum, n) => sum + n.beatDuration, 0);
  const valueBeats = span / (group[0].tupletNotesOccupied ?? 1);
  const quarter = isCompound(ts) ? 2 : 1;
  return TUPLET_VALUES.find((v) => Math.abs(valueBeats - quarter / { '1/4': 1, '1/8': 2, '1/16': 4 }[v]) < 1e-9);
}

function generateMany(settings: AppSettings, count: number = N): MeasureData[] {
  const generator = new MusicGenerator();
  const measures: MeasureData[] = [];
  let startBeat = 0;
  for (let m = 0; m < count; m++) {
    const measure = generator.generateMeasure(m, settings, startBeat);
    measures.push(measure);
    startBeat += measure.beatsPerMeasure;
  }
  return measures;
}

describe('MusicGenerator', () => {
  const timeSignatures = TIME_SIGNATURES;
  const clefs: Clef[] = [
    'treble',
    'soprano',
    'mezzo-soprano',
    'alto',
    'tenor',
    'baritone-f',
    'baritone-c',
    'bass',
  ];

  it('strictly conserves metric beat totals across all meters', () => {
    const generator = new MusicGenerator();

    for (const ts of timeSignatures) {
      const { beatsPerMeasure } = METER[ts];

      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        timeSignature: ts,
        subdivisions: {
          whole: true,
          half: true,
          quarter: true,
          eighth: true,
          sixteenth: true,
        },
        rests: true,
      };

      for (let i = 0; i < 50; i++) {
        const measure = generator.generateMeasure(i, settings, i * beatsPerMeasure);
        const totalDuration = measure.notes.reduce((sum, n) => sum + n.beatDuration, 0);

        expect(Math.abs(totalDuration - beatsPerMeasure)).toBeLessThan(1e-6);
        expect(measure.notes.length).toBeGreaterThan(0);

        // Verify sequential offsets
        let expectedOffset = 0;
        for (const note of measure.notes) {
          expect(Math.abs(note.beatOffset - expectedOffset)).toBeLessThan(1e-6);
          expectedOffset += note.beatDuration;
        }
      }
    }
  });

  it('strictly constrains pitches within clef pitch ranges (+/- 3 ledger lines)', () => {
    for (const clef of clefs) {
      const generator = new MusicGenerator();
      const allowedPool = pitchPool(clef, DEFAULT_APP_SETTINGS.ledgerLines);

      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        clef,
        intervals: {
          unison: true,
          second: true,
          third: true,
          fourth: true,
          fifth: true,
          sixth: true,
          seventh: true,
          octave: true,
          ninthPlus: true,
        },
      };

      for (let m = 0; m < 30; m++) {
        const measure = generator.generateMeasure(m, settings, m * 4);
        for (const note of measure.notes) {
          if (!note.isRest) {
            expect(allowedPool).toContain(note.keys[0]);
          }
        }
      }
    }
  });

  it('down-weights repeated notes softly without capping them (ergodic unisons)', () => {
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      intervals: { ...NO_INTERVALS, unison: true, second: true },
      rests: false,
    };

    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let repeats = 0;
    let transitions = 0;
    let prevPitch: string | null = null;

    for (let m = 0; m < N; m++) {
      const measure = generator.generateMeasure(m, settings, m * 4);
      for (const note of measure.notes) {
        if (prevPitch !== null) {
          transitions++;
          if (note.keys[0] === prevPitch) {
            repeats++;
            currentConsecutive++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
          } else {
            currentConsecutive = 0;
          }
        }
        prevPitch = note.keys[0];
      }
    }

    // 4+ consecutive unisons are reachable, yet unisons stay below their uniform 1/2 share
    expect(maxConsecutive).toBeGreaterThanOrEqual(4);
    expect(repeats / transitions).toBeLessThan(0.45);
  });

  it('generates well-formed tuplets satisfying group constraints', () => {
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '4/4',
      subdivisions: {
        whole: false,
        half: false,
        quarter: false,
        eighth: false,
        sixteenth: false,
      },
      tuplets: {
        ...DEFAULT_APP_SETTINGS.tuplets,
        triplet: { ...DEFAULT_APP_SETTINGS.tuplets.triplet, '1/8': true },
      },
      rests: false,
    };

    const measure = generator.generateMeasure(0, settings, 0);
    const tupletNotes = measure.notes.filter((n) => n.isTuplet);

    expect(tupletNotes.length).toBeGreaterThan(0);
    for (const note of tupletNotes) {
      expect(note.tupletGroup).toBeDefined();
      expect(note.tupletNumNotes).toBe(3);
      expect(note.tupletNotesOccupied).toBe(2);
      expect(Math.abs(note.beatDuration - 1 / 3)).toBeLessThan(1e-6);
    }
  });

  it('in 6/8 meter, generates true quarter notes (2 eighth beats) and respects dotted toggle', () => {
    const generator = new MusicGenerator();

    // 1. Dotted notes DISABLED in 6/8: must generate quarter notes (q) and eighths (8), but NEVER qd!
    const settingsNoDotted: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '6/8',
      subdivisions: {
        whole: false,
        half: false,
        quarter: true,
        eighth: true,
        sixteenth: false,
        dotted: false,
      },
      rests: false,
    };

    let quarterNoteCountNoDotted = 0;
    let dottedQuarterCountNoDotted = 0;
    let eighthNoteCountNoDotted = 0;

    for (let m = 0; m < 50; m++) {
      const measure = generator.generateMeasure(m, settingsNoDotted, m * 6);
      for (const note of measure.notes) {
        if (note.duration === 'q') {
          quarterNoteCountNoDotted++;
          expect(note.beatDuration).toBe(2);
        }
        if (note.duration === 'qd') {
          dottedQuarterCountNoDotted++;
        }
        if (note.duration === '8') {
          eighthNoteCountNoDotted++;
          expect(note.beatDuration).toBe(1);
        }
      }
    }

    // Must generate quarter notes
    expect(quarterNoteCountNoDotted).toBeGreaterThan(0);
    expect(eighthNoteCountNoDotted).toBeGreaterThan(0);
    // Must NEVER generate dotted quarters when dotted is false
    expect(dottedQuarterCountNoDotted).toBe(0);

    // 2. Dotted notes ENABLED in 6/8: must generate both qd and q and 8
    const settingsWithDotted: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '6/8',
      subdivisions: {
        whole: false,
        half: false,
        quarter: true,
        eighth: true,
        sixteenth: false,
        dotted: true,
      },
      rests: false,
    };

    let quarterNoteCountWithDotted = 0;
    let dottedQuarterCountWithDotted = 0;

    for (let m = 0; m < 50; m++) {
      const measure = generator.generateMeasure(m, settingsWithDotted, m * 6);
      for (const note of measure.notes) {
        if (note.duration === 'q') quarterNoteCountWithDotted++;
        if (note.duration === 'qd') dottedQuarterCountWithDotted++;
      }
    }

    expect(quarterNoteCountWithDotted).toBeGreaterThan(0);
    expect(dottedQuarterCountWithDotted).toBeGreaterThan(0);
  });

  it('in 3/4 meter, generates both h+q and q+h, and strictly respects dotted toggle', () => {
    const generator = new MusicGenerator();

    // 1. Dotted notes DISABLED in 3/4: must NEVER generate dotted half notes (hd)
    const settingsNoDotted: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '3/4',
      subdivisions: {
        whole: false,
        half: true,
        quarter: true,
        eighth: false,
        sixteenth: false,
        dotted: false,
      },
      rests: false,
    };

    let dottedHalfCount = 0;
    let foundHalfThenQuarter = false;
    let foundQuarterThenHalf = false;

    for (let m = 0; m < 100; m++) {
      const measure = generator.generateMeasure(m, settingsNoDotted, m * 3);
      for (const note of measure.notes) {
        if (note.duration === 'hd') dottedHalfCount++;
      }

      if (measure.notes.length === 2) {
        if (measure.notes[0].duration === 'h' && measure.notes[1].duration === 'q') {
          foundHalfThenQuarter = true;
        }
        if (measure.notes[0].duration === 'q' && measure.notes[1].duration === 'h') {
          foundQuarterThenHalf = true;
        }
      }
    }

    expect(dottedHalfCount).toBe(0);
    expect(foundHalfThenQuarter).toBe(true);
    expect(foundQuarterThenHalf).toBe(true);

    // 2. Dotted notes ENABLED in 3/4: generates dotted half notes (hd)
    const settingsWithDotted: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '3/4',
      subdivisions: {
        whole: false,
        half: true,
        quarter: true,
        eighth: false,
        sixteenth: false,
        dotted: true,
      },
      rests: false,
    };

    let dottedHalfCountWithDotted = 0;
    for (let m = 0; m < 60; m++) {
      const measure = generator.generateMeasure(m, settingsWithDotted, m * 3);
      for (const note of measure.notes) {
        if (note.duration === 'hd') dottedHalfCountWithDotted++;
      }
    }

    expect(dottedHalfCountWithDotted).toBeGreaterThan(0);
  });

  it('in 4/4 meter, generates dotted quarter and dotted eighth notes when dotted is enabled', () => {
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '4/4',
      subdivisions: {
        whole: false,
        half: false,
        quarter: true,
        eighth: true,
        sixteenth: true,
        dotted: true,
      },
      rests: false,
    };

    let dottedQuarterCount = 0;
    let dottedEighthCount = 0;

    for (let m = 0; m < 60; m++) {
      const measure = generator.generateMeasure(m, settings, m * 4);
      for (const note of measure.notes) {
        if (note.duration === 'qd') dottedQuarterCount++;
        if (note.duration === '8d') dottedEighthCount++;
      }
    }

    expect(dottedQuarterCount).toBeGreaterThan(0);
    expect(dottedEighthCount).toBeGreaterThan(0);
  });

  it('preserves strict pitch identity across tied notes when ties are enabled', () => {
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '4/4',
      subdivisions: {
        whole: false,
        half: false,
        quarter: true,
        eighth: false,
        sixteenth: false,
        dotted: false,
      },
      ties: true,
      rests: false,
    };

    let tiedPairCount = 0;
    for (let m = 0; m < 50; m++) {
      const measure = generator.generateMeasure(m, settings, m * 4);
      for (let i = 0; i < measure.notes.length - 1; i++) {
        if (measure.notes[i].tieStart && measure.notes[i + 1].tieEnd) {
          tiedPairCount++;
          expect(measure.notes[i].keys[0]).toBe(measure.notes[i + 1].keys[0]);
        }
      }
    }

    expect(tiedPairCount).toBeGreaterThan(0);
  });

  it('configures all 8 Setticlavio clefs with exactly 23 diatonic pitches (±3 ledger lines)', () => {
    for (const clef of clefs) {
      const config = CLEF_PITCH_RANGES[clef];
      const pitches = pitchPool(clef, { above: 3, below: 3 });
      expect(pitches.length).toBe(23);
      // Rest pitch sits on the centre staff line, the midpoint of the ±3-ledger pool
      expect(pitches[11]).toBe(config.restPitch);
      expect(pitches).toContain(config.defaultAnchor);
    }
  });

  it('anchors the initial session note to defaultAnchor for every clef', () => {
    for (const clef of clefs) {
      const generator = new MusicGenerator();
      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        clef,
        rests: false,
      };
      const measure = generator.generateMeasure(0, settings, 0);
      expect(measure.notes[0].keys[0]).toBe(CLEF_PITCH_RANGES[clef].defaultAnchor);
    }
  });

  it('positions rests on the middle staff line across all 8 clefs', () => {
    const expectedCenterPitches: Record<Clef, string> = {
      treble: 'b/4',
      soprano: 'g/4',
      'mezzo-soprano': 'e/4',
      alto: 'c/4',
      tenor: 'a/3',
      'baritone-f': 'f/3',
      'baritone-c': 'f/3',
      bass: 'd/3',
    };

    for (const clef of clefs) {
      const generator = new MusicGenerator();
      const settings: AppSettings = {
        ...DEFAULT_APP_SETTINGS,
        clef,
        rests: true,
      };

      let foundRest = false;
      for (let m = 0; m < 100; m++) {
        const measure = generator.generateMeasure(m, settings, m * 4);
        for (const note of measure.notes) {
          if (note.isRest && note.duration !== 'w') {
            foundRest = true;
            expect(note.keys[0]).toBe(expectedCenterPitches[clef]);
          }
        }
      }
      expect(foundRest).toBe(true);
    }
  });

  describe('ergodic reachability (P > 0 for previously unreachable figures)', () => {
    const noTupletSubdiv = {
      whole: false,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: false,
      dotted: false,
    };

    it('reaches q h q in 4/4 (a 2-beat value starting on beat 2)', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '4/4',
        subdivisions: noTupletSubdiv,
        rests: false,
      });
      const found = measures.some(
        (m) => m.notes.map((n) => n.duration).join(' ') === 'q h q'
      );
      expect(found).toBe(true);
    });

    it('reaches 8 q 8 in 3/4 with half and dotted notes disabled', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '3/4',
        subdivisions: { ...noTupletSubdiv, half: false },
        rests: false,
      });
      const found = measures.some((m) =>
        m.notes.some(
          (n, i) =>
            n.duration === '8' &&
            m.notes[i + 1]?.duration === 'q' &&
            m.notes[i + 2]?.duration === '8' &&
            m.notes[i + 1].beatOffset % 1 === 0.5
        )
      );
      expect(found).toBe(true);
    });

    // ADR 0064: the half-beat slots of `qd 8`, `8 qd` and `8 q 8` take sub-eighth figures
    const figures = (m: MeasureData): string[] => m.notes.map((n) => n.duration);
    const findRun = (m: MeasureData, run: string[], at?: (offset: number) => boolean): boolean =>
      m.notes.some(
        (n, i) =>
          run.every((d, k) => m.notes[i + k]?.duration === d) && (at === undefined || at(n.beatOffset))
      );

    it('reaches qd 16 16 on a two-beat group in 4/4', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '4/4',
        subdivisions: { ...noTupletSubdiv, half: false, sixteenth: true, dotted: true },
        rests: false,
      });
      const found = measures.some((m) => findRun(m, ['qd', '16', '16'], (o) => o === 0 || o === 2));
      expect(found).toBe(true);
    });

    it('reaches 16 16 qd in 2/4', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '2/4',
        subdivisions: { ...noTupletSubdiv, half: false, sixteenth: true, dotted: true },
        rests: false,
      });
      const found = measures.some((m) => figures(m).join(' ') === '16 16 qd');
      expect(found).toBe(true);
    });

    it('reaches 16 16 q 16 16 in 3/4 with eighths off', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '3/4',
        subdivisions: { ...noTupletSubdiv, half: false, eighth: false, sixteenth: true },
        rests: false,
      });
      const found = measures.some((m) =>
        findRun(m, ['16', '16', 'q', '16', '16'], (o) => o % 1 === 0)
      );
      expect(found).toBe(true);
    });

    it('reaches qd followed by a 32nd-bearing half beat in 4/4', () => {
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '4/4',
        subdivisions: { ...noTupletSubdiv, half: false, sixteenth: true, thirtySecond: true, dotted: true },
        rests: false,
      });
      const found = measures.some((m) =>
        m.notes.some(
          (n, i) =>
            n.duration === 'qd' &&
            (n.beatOffset === 0 || n.beatOffset === 2) &&
            m.notes[i + 1]?.duration === '32'
        )
      );
      expect(found).toBe(true);
    });

    it('reaches leaps of 12+ diatonic steps with ninthPlus', () => {
      const pitches = pitchPool('treble', DEFAULT_APP_SETTINGS.ledgerLines);
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        clef: 'treble',
        intervals: { ...NO_INTERVALS, ninthPlus: true },
        rests: false,
      });
      const keys = measures.flatMap((m) => m.notes.map((n) => n.keys[0]));
      let maxLeap = 0;
      for (let i = 1; i < keys.length; i++) {
        const leap = Math.abs(pitches.indexOf(keys[i]) - pitches.indexOf(keys[i - 1]));
        expect(leap).toBeGreaterThanOrEqual(8);
        maxLeap = Math.max(maxLeap, leap);
      }
      expect(maxLeap).toBeGreaterThanOrEqual(12);
    });

    it('reaches tie chains (a~b~c), inside the bar and across barlines', () => {
      // An inner chain is about one bar in a thousand
      const measures = generateMany(
        {
          ...DEFAULT_APP_SETTINGS,
          timeSignature: '4/4',
          subdivisions: { ...noTupletSubdiv, dotted: true },
          ties: true,
          rests: false,
        },
        10000
      );
      const inner = measures.some((m) =>
        m.notes.some((n, i) => i > 0 && i < m.notes.length - 1 && n.tieStart && n.tieEnd)
      );
      const acrossBarline = measures.some((m) => m.notes.some((n) => n.tieStart && n.tieEnd));
      expect(inner).toBe(true);
      expect(acrossBarline).toBe(true);
    });
  });

  describe('per-meter tuplet table (TUPLET_SUPPORT)', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: true,
      sixteenth: false,
      dotted: true,
    };

    for (const ts of TIME_SIGNATURES) {
      for (const cell of TUPLET_SUPPORT[ts]) {
        it(`${ts}: ${cell} generates its tuplet and conserves beat totals`, () => {
          const [name, value] = cell.split(':') as [TupletName, TupletValue];
          const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
          tuplets[name][value] = true;
          const measures = generateMany(
            { ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions: subdiv, tuplets, ties: true },
            400
          );
          let found = false;
          let foundBase = false;
          for (const m of measures) {
            const total = m.notes.reduce((sum, n) => sum + n.beatDuration, 0);
            expect(total).toBeCloseTo(m.beatsPerMeasure, 9);
            for (const group of tupletGroups(m)) {
              expect(group.length).toBeGreaterThanOrEqual(2);
              expect(group.every((n) => n.isRest)).toBe(false);
              expect(tupletValueOf(ts, group)).toBe(value);
              for (const n of group) {
                expect(n.tupletNumNotes).toBe(EXPECTED_TUPLET_SHAPE[name]);
                expect(TUPLET_MEMBER_VALUES[value]).toContain(n.duration);
                if (n.duration === TUPLET_MEMBER_VALUES[value][0]) foundBase = true;
              }
              found = true;
            }
          }
          expect(found).toBe(true);
          expect(foundBase).toBe(true);
        });
      }
    }

    it('never generates tuplets unsupported by the current meter', () => {
      const allOn = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
      for (const name of TUPLET_NAMES) {
        for (const value of TUPLET_VALUES) allOn[name][value] = true;
      }
      for (const ts of TIME_SIGNATURES) {
        const measures = generateMany(
          { ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions: subdiv, tuplets: allOn },
          400
        );
        const shapeToName = Object.fromEntries(
          Object.entries(EXPECTED_TUPLET_SHAPE).map(([k, v]) => [v, k])
        ) as Record<number, TupletName>;
        for (const m of measures) {
          for (const group of tupletGroups(m)) {
            const numNotes = group[0].tupletNumNotes ?? 0;
            const cell = `${shapeToName[numNotes]}:${tupletValueOf(ts, group)}` as TupletCell;
            expect(TUPLET_SUPPORT[ts].has(cell)).toBe(true);
          }
        }
      }
    });
  });
});

describe('MusicGenerator 32nd notes', () => {
  const SUBDIV_32 = { whole: true, half: true, quarter: true, eighth: true, sixteenth: true, thirtySecond: true, dotted: true };
  const ONLY_32 = { whole: false, half: false, quarter: false, eighth: false, sixteenth: false, thirtySecond: true, dotted: true };
  const METERS = TIME_SIGNATURES;

  function generate(ts: TimeSignature, subdivisions: AppSettings['subdivisions'], count: number): MeasureData[] {
    const generator = new MusicGenerator();
    const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions, rests: true };
    return Array.from({ length: count }, (_, i) => generator.generateMeasure(i, settings, 0));
  }

  it('conserves metric beat totals with 32nds on', () => {
    for (const ts of METERS) {
      for (const m of generate(ts, SUBDIV_32, 300)) {
        const total = m.notes.reduce((sum, n) => sum + n.beatDuration, 0);
        expect(Math.abs(total - m.beatsPerMeasure)).toBeLessThan(1e-9);
      }
    }
  });

  it('32nd-only configuration produces only 32nds', () => {
    for (const ts of METERS) {
      const durations = new Set(generate(ts, ONLY_32, 200).flatMap((m) => m.notes.map((n) => n.duration)));
      expect([...durations]).toEqual(['32']);
    }
  });

  it('reaches 32, 16d, 32 16 32 and 8d 32 32 (P > 0)', () => {
    for (const ts of ['4/4', '6/8', '9/8', '12/8'] as TimeSignature[]) {
      // Beat span of one eighth note in this meter
      const unit = isCompound(ts) ? 1 : 0.5;
      const seen = { thirtySecond: false, dottedSixteenth: false, middleSixteenth: false, dottedEighth32: false };
      for (const m of generate(ts, SUBDIV_32, N)) {
        m.notes.forEach((n, i) => {
          const next = m.notes[i + 1];
          if (n.duration === '32') seen.thirtySecond = true;
          if (n.duration === '16d') seen.dottedSixteenth = true;
          // A 16 starting a 32nd into an eighth is only possible inside `32 16 32`
          if (n.duration === '16' && Math.abs((n.beatOffset % unit) - unit / 4) < 1e-9) seen.middleSixteenth = true;
          if (n.duration === '8d' && next?.duration === '32') seen.dottedEighth32 = true;
        });
      }
      expect(seen, ts).toEqual({ thirtySecond: true, dottedSixteenth: true, middleSixteenth: true, dottedEighth32: true });
    }
  });
});

describe('User-selectable ledger lines', () => {
  const ALL_CLEFS: readonly Clef[] = [
    'treble',
    'soprano',
    'mezzo-soprano',
    'alto',
    'tenor',
    'baritone-f',
    'baritone-c',
    'bass',
  ];

  // Pre-0044 hardcoded ±3-ledger pools (first and last of each 23-note array)
  const LEGACY_BOUNDS: Record<Clef, [string, string]> = {
    treble: ['e/3', 'f/6'],
    soprano: ['c/3', 'd/6'],
    'mezzo-soprano': ['a/2', 'b/5'],
    alto: ['f/2', 'g/5'],
    tenor: ['d/2', 'e/5'],
    'baritone-f': ['b/1', 'c/5'],
    'baritone-c': ['b/1', 'c/5'],
    bass: ['g/1', 'a/4'],
  };

  it('reproduces the legacy 23-note pools at 3/3 for every clef', () => {
    for (const clef of ALL_CLEFS) {
      const pool = pitchPool(clef, { above: 3, below: 3 });
      expect(pool.length).toBe(23);
      expect([pool[0], pool[22]]).toEqual(LEGACY_BOUNDS[clef]);
      const { low, high } = pitchBounds(clef, { above: 3, below: 3 });
      expect(high - low).toBe(22);
    }
    expect(pitchPool('treble', { above: 3, below: 3 }).slice(0, 8)).toEqual([
      'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4',
    ]);
  });

  it('derives range labels and pool sizes from the ledger counts', () => {
    const range = (clef: 'treble' | 'bass', above: number, below: number): string => {
      const { low, high } = pitchBounds(clef, { above, below });
      return formatRange(low, high, en);
    };
    expect(range('treble', 3, 3)).toBe('E3 – F6');
    expect(range('treble', 0, 0)).toBe('D4 – G5');
    expect(range('bass', 1, 2)).toBe('B1 – D4');
    expect(pitchPool('alto', { above: 0, below: 0 }).length).toBe(11);
  });

  it('clamps the session anchor into the pool', () => {
    const generator = new MusicGenerator();
    const measure = generator.generateMeasure(
      0,
      { ...DEFAULT_APP_SETTINGS, clef: 'treble', ledgerLines: { above: 3, below: 0 } },
      0
    );
    expect(measure.notes[0].keys[0]).toBe('d/4');
  });

  const INTERVAL_SETS: Record<string, AppSettings['intervals']> = {
    seconds: { ...NO_INTERVALS, second: true },
    octaves: { ...NO_INTERVALS, octave: true },
    ninthPlus: { ...NO_INTERVALS, ninthPlus: true },
    all: {
      unison: true,
      second: true,
      third: true,
      fourth: true,
      fifth: true,
      sixth: true,
      seventh: true,
      octave: true,
      ninthPlus: true,
    },
  };

  /** Pool indices of every note of `count` bars, a fresh session every `sessionBars` bars. */
  const walk = (settings: AppSettings, pool: string[], count: number, sessionBars = count): number[][] => {
    const generator = new MusicGenerator();
    const sessions: number[][] = [];
    for (let m = 0; m < count; m++) {
      if (m % sessionBars === 0) {
        generator.resetPitch();
        sessions.push([]);
      }
      for (const note of generator.generateMeasure(m, settings, m * 4).notes) {
        sessions[sessions.length - 1].push(pool.indexOf(note.keys[0]));
      }
    }
    return sessions;
  };

  /** Moves of a session that are not one selected interval (ADR 0066: no fallback move). */
  const badMoves = (intervals: AppSettings['intervals'], idxs: number[], label: string): string[] => {
    const { steps, ninth } = allowedSteps(intervals);
    const bad: string[] = [];
    for (let i = 1; i < idxs.length; i++) {
      const leap = Math.abs(idxs[i] - idxs[i - 1]);
      if (!steps.includes(leap) && !(ninth && leap >= 8)) bad.push(`${label}: ${idxs[i - 1]} -> ${idxs[i]}`);
    }
    return bad;
  };

  it('stays in bounds, reaches both edges and moves only by selected intervals', () => {
    const violations: string[] = [];
    for (const clef of ALL_CLEFS) {
      for (let above = 0; above <= 3; above++) {
        for (let below = 0; below <= 3; below++) {
          const ledgerLines = { above, below };
          const pool = pitchPool(clef, ledgerLines);
          for (const [name, intervals] of Object.entries(INTERVAL_SETS)) {
            const label = `${clef} ${above}/${below} ${name}`;
            const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals };
            const [idxs] = walk(settings, pool, 300);
            if (idxs.includes(-1)) violations.push(`${label}: out of bounds`);
            if (name === 'all' && !(idxs.includes(0) && idxs.includes(pool.length - 1))) {
              violations.push(`${label}: edge not reached`);
            }
            violations.push(...badMoves(intervals, idxs, label));
          }
        }
      }
    }
    expect(violations).toEqual([]);
  }, 20000);

  it('moves only by selected intervals for every interval subset (ADR 0066)', () => {
    const violations: string[] = [];
    const pools: [Clef, AppSettings['ledgerLines']][] = [
      ['treble', { above: 0, below: 0 }],
      ['alto', { above: 3, below: 3 }],
      ['bass', { above: 1, below: 2 }],
    ];
    for (const [clef, ledgerLines] of pools) {
      const pool = pitchPool(clef, ledgerLines);
      for (const [mask, intervals] of ALL_INTERVAL_SETS.entries()) {
        const label = `${clef} ${ledgerLines.above}/${ledgerLines.below} #${mask}`;
        const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals, subdivisions: QUARTERS };
        for (const idxs of walk(settings, pool, 40, 10)) {
          if (idxs.includes(-1)) violations.push(`${label}: out of bounds`);
          violations.push(...badMoves(intervals, idxs, label));
        }
      }
    }
    expect(violations).toEqual([]);
  }, 30000);

  it('starts disconnected interval sets on every live pitch of the pool (ADR 0066)', () => {
    const cases: [string, AppSettings['intervals'], AppSettings['ledgerLines']][] = [
      ['thirds', { ...NO_INTERVALS, third: true }, { above: 3, below: 3 }],
      ['fourths', { ...NO_INTERVALS, fourth: true }, { above: 3, below: 3 }],
      ['fifths', { ...NO_INTERVALS, fifth: true }, { above: 3, below: 3 }],
      ['octaves', { ...NO_INTERVALS, octave: true }, { above: 3, below: 3 }],
      ['octaves 0/0', { ...NO_INTERVALS, octave: true }, { above: 0, below: 0 }],
      ['unison', { ...NO_INTERVALS, unison: true }, { above: 3, below: 3 }],
    ];
    for (const [name, intervals, ledgerLines] of cases) {
      const pool = pitchPool('treble', ledgerLines);
      const { steps } = allowedSteps(intervals);
      const live = pool
        .map((_, i) => i)
        .filter((i) => steps.some((s) => i + s < pool.length || i - s >= 0));
      const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, ledgerLines, intervals, subdivisions: QUARTERS };
      const generator = new MusicGenerator();
      const starts = new Set<number>();
      for (let s = 0; s < N; s++) {
        generator.resetPitch();
        starts.add(pool.indexOf(generator.generateMeasure(0, settings, 0).notes[0].keys[0]));
      }
      // Octaves at 0/0: the middle of the 11-note pool has no octave, so it is never a start
      expect([...starts].sort((a, b) => a - b), name).toEqual(live);
    }
  });

  it('keeps the anchor start for connected interval sets (ADR 0066)', () => {
    const connected: AppSettings['intervals'][] = [
      { ...NO_INTERVALS, third: true, fourth: true },
      { ...NO_INTERVALS, second: true, octave: true },
      NO_INTERVALS, // Fallback: seconds and thirds
    ];
    for (const intervals of connected) {
      const generator = new MusicGenerator();
      for (let s = 0; s < 50; s++) {
        generator.resetPitch();
        const first = generator.generateMeasure(0, { ...DEFAULT_APP_SETTINGS, intervals }, 0).notes[0];
        expect(first.keys[0]).toBe(CLEF_PITCH_RANGES.treble.defaultAnchor);
      }
    }
  });
});

describe('Rhythm grammar (ADR 0065)', () => {
  const METERS = TIME_SIGNATURES;
  const NONE: SubdivisionOptions = {
    whole: false,
    half: false,
    quarter: false,
    eighth: false,
    sixteenth: false,
    thirtySecond: false,
    dotted: false,
  };
  const BASES = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirtySecond'] as const;

  it('keys TUPLET_PLACEMENTS by exactly the cells of TUPLET_SUPPORT', () => {
    for (const ts of METERS) {
      expect(new Set(Object.keys(TUPLET_PLACEMENTS[ts]))).toEqual(new Set(TUPLET_SUPPORT[ts]));
    }
  });

  it('fills every bar without dead ends, for every subdivision set and every lone tuplet cell', () => {
    const configs: [SubdivisionOptions, AppSettings['tuplets'] | undefined][] = [];
    for (let mask = 0; mask < 1 << (BASES.length + 1); mask++) {
      const subdiv: SubdivisionOptions = { ...NONE };
      BASES.forEach((base, i) => (subdiv[base] = Boolean(mask & (1 << i))));
      subdiv.dotted = Boolean(mask & (1 << BASES.length));
      configs.push([subdiv, undefined]);
    }
    for (const ts of METERS) {
      const lone = [...TUPLET_SUPPORT[ts]].map((cell) => {
        const [name, value] = cell.split(':') as [TupletName, TupletValue];
        const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
        tuplets[name][value] = true;
        return [NONE, tuplets] as [SubdivisionOptions, AppSettings['tuplets']];
      });
      for (const [subdiv, tuplets] of [...configs, ...lone]) {
        const g = rhythmGrammar(ts, subdiv, tuplets);
        const reached = new Array<boolean>(g.barUnits + 1).fill(false);
        reached[0] = true;
        for (let u = 0; u < g.barUnits; u++) {
          if (!reached[u]) continue;
          const steps = [...g.notes[u], ...g.tuplets[u]];
          expect(steps.length, `${ts} ${JSON.stringify(subdiv)} @${u}`).toBeGreaterThan(0);
          for (const step of steps) reached[u + step.units] = true;
        }
        expect(reached[g.barUnits]).toBe(true);
      }
    }
  });

  it('adds the beat unit only when the enabled values need it', () => {
    const values = (ts: TimeSignature, subdiv: Partial<SubdivisionOptions>): string[] =>
      [...rhythmGrammar(ts, { ...NONE, ...subdiv }).values].sort();
    // Not needed: the enabled values fill the bar and all occur
    expect(values('4/4', { whole: true })).toEqual(['w']);
    expect(values('4/4', { half: true })).toEqual(['h']);
    expect(values('2/4', { eighth: true })).toEqual(['8']);
    expect(values('4/4', { quarter: true })).toEqual(['q']);
    // Needed to fill the bar
    expect(values('3/4', { whole: true })).toEqual(['q', 'w']);
    expect(values('6/8', { quarter: true })).toEqual(['8', 'q']);
    // Needed to reach an enabled value: hd in 4/4
    expect(values('4/4', { half: true, dotted: true })).toEqual(['h', 'hd', 'q']);
    const g = rhythmGrammar('4/4', { ...NONE, half: true, dotted: true });
    expect(g.notes[0].map((s) => s.duration)).toContain('hd');
  });

  it('reaches the 9/8 and 12/8 figures of 3/4 and 4/4 one level up (ADR 0076)', () => {
    const rhythms = (ts: TimeSignature, subdivisions: SubdivisionOptions): Set<string> =>
      new Set(
        generateMany({ ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions, ties: false, rests: false }, 1500).map(
          (m) => m.notes.map((n) => n.duration).join(' ')
        )
      );
    const nine = rhythms('9/8', { ...NONE, half: true, quarter: true, eighth: true, dotted: true });
    for (const bar of ['hd qd', 'qd hd', 'q 8 qd qd', '8 q qd qd', 'qd qd qd']) {
      expect(nine.has(bar), `9/8 ${bar}`).toBe(true);
    }
    const twelve = rhythms('12/8', { ...NONE, whole: true, half: true, quarter: true, dotted: true });
    for (const bar of ['wd', 'hd hd', 'qd hd qd', 'qd qd qd qd', 'hd qd qd']) {
      expect(twelve.has(bar), `12/8 ${bar}`).toBe(true);
    }
  });

  it('reaches hd in 4/4 with only half and dotted enabled', () => {
    const measures = generateMany(
      { ...DEFAULT_APP_SETTINGS, subdivisions: { ...NONE, half: true, dotted: true } },
      300
    );
    expect(measures.some((m) => m.notes.some((n) => n.duration === 'hd'))).toBe(true);
  });

  it('pins the dormant values: enabled but in no complete bar (ADR 0066)', () => {
    // Too long for the bar, or a dotted value without its shorter partner (strict alphabet)
    const expected = (ts: TimeSignature, sub: SubdivisionOptions): string[] => {
      const shorter = sub.eighth || sub.sixteenth || sub.thirtySecond;
      return enabledValues(sub).filter(
        (v) =>
          (v === 'w' && ts !== '4/4') ||
          (v === 'h' && isCompound(ts)) ||
          (v === 'wd' && ts !== '12/8') ||
          (v === 'hd' && ts === '2/4') ||
          (v === 'qd' && (ts === '4/4' || ts === '2/4') && !shorter) ||
          (v === '8d' && !(sub.sixteenth || sub.thirtySecond)) ||
          (v === '16d' && !sub.thirtySecond)
      );
    };
    for (const ts of METERS) {
      for (let mask = 0; mask < 1 << (BASES.length + 1); mask++) {
        const sub: SubdivisionOptions = { ...NONE, dotted: Boolean(mask & (1 << BASES.length)) };
        BASES.forEach((base, i) => (sub[base] = Boolean(mask & (1 << i))));
        const g = rhythmGrammar(ts, sub);
        const reached = new Array<boolean>(g.barUnits + 1).fill(false);
        reached[0] = true;
        const used = new Set<string>();
        for (let u = 0; u < g.barUnits; u++) {
          if (!reached[u]) continue;
          for (const step of g.notes[u]) {
            used.add(step.duration);
            reached[u + step.units] = true;
          }
        }
        const dormant = enabledValues(sub).filter((v) => !used.has(v));
        expect(dormant, `${ts} ${JSON.stringify(sub)}`).toEqual(expected(ts, sub));
      }
    }
  });

  it('memoizes the grammar per configuration', () => {
    const subdiv = { ...NONE, quarter: true, eighth: true };
    expect(rhythmGrammar('3/4', subdiv)).toBe(rhythmGrammar('3/4', { ...subdiv }));
    expect(rhythmGrammar('3/4', subdiv)).not.toBe(rhythmGrammar('2/4', subdiv));
  });
});

describe('Generated tuplet members (ADR 0065)', () => {
  function settingsWith(cells: TupletCell[], rests: boolean): AppSettings {
    const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
    for (const cell of cells) {
      const [name, value] = cell.split(':') as [TupletName, TupletValue];
      tuplets[name][value] = true;
    }
    return {
      ...DEFAULT_APP_SETTINGS,
      subdivisions: { ...DEFAULT_APP_SETTINGS.subdivisions, sixteenth: true },
      tuplets,
      rests,
    };
  }

  it('merges adjacent units into one member: 3[q 8] and 3[8 q]', () => {
    const figures = new Set<string>();
    for (const m of generateMany(settingsWith(['triplet:1/8'], false), 1000)) {
      for (const group of tupletGroups(m)) figures.add(group.map((n) => n.duration).join(' '));
    }
    expect(figures).toContain('q 8');
    expect(figures).toContain('8 q');
    expect(figures).toContain('8 8 8');
  });

  it('never silences a whole group and never dots a silent member', () => {
    let silent = 0;
    const cells: TupletCell[] = ['triplet:1/8', 'sextuplet:1/8', 'quintuplet:1/16', 'sextuplet:1/16'];
    for (const m of generateMany(settingsWith(cells, true), 1500)) {
      for (const group of tupletGroups(m)) {
        expect(group.every((n) => n.isRest)).toBe(false);
        for (const n of group) {
          if (!n.isRest) continue;
          silent++;
          expect(n.duration.endsWith('d'), n.duration).toBe(false);
        }
      }
    }
    expect(silent).toBeGreaterThan(0);
  });
});

describe('Symmetric pitch walk (ADR 0065)', () => {
  it('steps up and down equally often wherever both directions fit', () => {
    const ledgerLines = { above: 3, below: 3 };
    const pool = pitchPool('treble', ledgerLines);
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      ledgerLines,
      subdivisions: { ...DEFAULT_APP_SETTINGS.subdivisions, whole: false, half: false, eighth: false, dotted: false },
      intervals: { ...NO_INTERVALS, second: true },
    };
    const idxs = generateMany(settings, 3000).flatMap((m) => m.notes.map((n) => pool.indexOf(n.keys[0])));
    let up = 0;
    let down = 0;
    for (let i = 1; i < idxs.length; i++) {
      const prev = idxs[i - 1];
      if (prev === 0 || prev === pool.length - 1) continue;
      if (idxs[i] > prev) up++;
      else down++;
    }
    expect(up / (up + down)).toBeGreaterThan(0.47);
    expect(up / (up + down)).toBeLessThan(0.53);
  });
});

describe('Rest runs (ADR 0066)', () => {
  /** Silent flag of every beat-unit slot of a quarters-only stream (a bar rest is 4 slots). */
  function silentSlots(settings: AppSettings, bars: number): boolean[] {
    return generateMany(settings, bars).flatMap((m) =>
      m.notes.flatMap((n) => Array.from({ length: Math.round(n.beatDuration) }, () => n.isRest))
    );
  }

  it('starts a rest with SILENCE_PROBABILITY and continues one with SILENCE_CONTINUE_PROBABILITY', () => {
    const slots = silentSlots({ ...DEFAULT_APP_SETTINGS, rests: true, subdivisions: QUARTERS }, 5000);
    let afterSound = 0;
    let soundToSilent = 0;
    let afterSilence = 0;
    let silentToSilent = 0;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i - 1]) {
        afterSilence++;
        if (slots[i]) silentToSilent++;
      } else {
        afterSound++;
        if (slots[i]) soundToSilent++;
      }
    }
    expect(Math.abs(soundToSilent / afterSound - SILENCE_PROBABILITY)).toBeLessThan(0.015);
    expect(Math.abs(silentToSilent / afterSilence - SILENCE_CONTINUE_PROBABILITY)).toBeLessThan(0.04);
  });

  it('reaches a full-bar rest in 3/4 with eighths and sixteenths', () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '3/4',
      rests: true,
      subdivisions: { ...QUARTERS, quarter: false, eighth: true, sixteenth: true },
    };
    const bars = generateMany(settings, 20000);
    expect(bars.some((m) => m.notes.length === 1 && m.notes[0].isRest)).toBe(true);
  }, 20000);
});

describe('Tuplet member shapes (ADR 0066)', () => {
  const ALL_VALUES: ReadonlySet<string> = new Set(
    enabledValues({ ...QUARTERS, whole: true, half: true, eighth: true, sixteenth: true, thirtySecond: true, dotted: true })
  );
  const MEMBER_UNITS: Record<TupletValue, readonly number[]> = {
    '1/4': [1, 2, 3, 4],
    '1/8': [1, 2, 3, 4, 6],
    '1/16': [1, 2, 3, 4, 6],
  };

  /** Brute force: every split of n units into ≥ 2 allowed member lengths. */
  function compositions(n: number, lengths: readonly number[]): string[] {
    const out: string[] = [];
    const extend = (prefix: number[], rest: number): void => {
      if (rest === 0) {
        if (prefix.length >= 2) out.push(prefix.join(' '));
        return;
      }
      for (const l of lengths) if (l <= rest) extend([...prefix, l], rest - l);
    };
    extend([], n);
    return out.sort();
  }

  it('enumerates every valid composition, grouped by member count', () => {
    for (const value of TUPLET_VALUES) {
      for (let n = 2; n <= 7; n++) {
        const grouped = tupletCompositions(n, value, ALL_VALUES);
        expect(grouped.flat().map((c) => c.join(' ')).sort()).toEqual(compositions(n, MEMBER_UNITS[value]));
        for (const group of grouped) expect(new Set(group.map((c) => c.length)).size).toBe(1);
      }
    }
    // Only enabled noteheads: with nothing but the unit, every member is one unit
    expect(tupletCompositions(5, '1/4', new Set())).toEqual([[[1, 1, 1, 1, 1]]]);
  });

  it('draws member counts uniformly and reaches every quintuplet and septuplet shape', () => {
    const cases: [number, TupletValue][] = [
      [5, '1/4'],
      [7, '1/8'],
    ];
    for (const [n, value] of cases) {
      const grouped = tupletCompositions(n, value, ALL_VALUES);
      const seen = new Set<string>();
      const counts = new Map<number, number>();
      const draws = 20000;
      for (let i = 0; i < draws; i++) {
        const members = drawTupletMembers(n, value, ALL_VALUES);
        expect(members.reduce((a, b) => a + b, 0)).toBe(n);
        seen.add(members.join(' '));
        counts.set(members.length, (counts.get(members.length) ?? 0) + 1);
      }
      expect([...seen].sort()).toEqual(compositions(n, MEMBER_UNITS[value]));
      for (const count of counts.values()) {
        expect(Math.abs(count / draws - 1 / grouped.length)).toBeLessThan(0.02);
      }
    }
  });
});

describe('Note selection (ADR 0070)', () => {
  const LETTERS = 'cdefgab';
  const stepOf = (key: string): number => {
    const [letter, octave] = key.split('/');
    return Number(octave) * 7 + LETTERS.indexOf(letter);
  };
  const intervalsOf = (...keys: (keyof IntervalOptions)[]): IntervalOptions =>
    Object.fromEntries(INTERVAL_KEYS.map((k) => [k, keys.includes(k)])) as unknown as IntervalOptions;
  const classesOf = (mask: number): PitchClassOptions =>
    Object.fromEntries(PITCH_CLASSES.map((pc, i) => [pc, Boolean(mask & (1 << i))])) as unknown as PitchClassOptions;
  const QUARTERS_ONLY: SubdivisionOptions = {
    whole: false, half: false, quarter: true, eighth: false, sixteenth: false, thirtySecond: false, dotted: false,
  };
  const POOLS: [Clef, AppSettings['ledgerLines']][] = [
    ['treble', { above: 0, below: 0 }],
    ['alto', { above: 3, below: 3 }],
    ['bass', { above: 1, below: 2 }],
  ];
  const INTERVAL_SETS: IntervalOptions[] = [
    intervalsOf('second', 'third'),
    intervalsOf('unison'),
    intervalsOf('fourth'),
    intervalsOf('fifth', 'octave'),
    intervalsOf('ninthPlus'),
    intervalsOf('unison', 'second'),
    intervalsOf(...INTERVAL_KEYS),
  ];
  /** Whether a diatonic distance is one move of an interval toggle. */
  const isMoveOf = (key: keyof IntervalOptions, d: number): boolean =>
    key === 'ninthPlus' ? d >= 8 : d === INTERVAL_KEYS.indexOf(key);

  /** Brute force: the interval toggles some pair of pool steps spans (unison always). */
  const realizable = (steps: number[]): Set<keyof IntervalOptions> => {
    const out = new Set<keyof IntervalOptions>(['unison']);
    for (let i = 0; i < steps.length; i++) {
      for (let j = i + 1; j < steps.length; j++) {
        for (const key of INTERVAL_KEYS) if (isMoveOf(key, steps[j] - steps[i])) out.add(key);
      }
    }
    return out;
  };

  /** Sounding pitches of `sessions` fresh sessions of `bars` quarter-note bars. */
  const sessionsOf = (settings: AppSettings, sessions: number, bars: number): string[][] => {
    const generator = new MusicGenerator();
    const out: string[][] = [];
    for (let s = 0; s < sessions; s++) {
      generator.resetPitch();
      const keys: string[] = [];
      for (let m = 0; m < bars; m++) {
        for (const note of generator.generateMeasure(m, settings, m * 4).notes) keys.push(note.keys[0]);
      }
      out.push(keys);
    }
    return out;
  };

  it('keeps every pitch in a selected class and every move an effective interval', () => {
    const violations: string[] = [];
    for (let mask = 1; mask < 128; mask++) {
      const pitchClasses = classesOf(mask);
      for (const [clef, ledgerLines] of POOLS) {
        const steps = pitchSteps(clef, ledgerLines, pitchClasses);
        const pool = new Set(steps);
        for (const intervals of INTERVAL_SETS) {
          const { choices } = effectiveIntervals(intervals, steps);
          const allowed = (d: number): boolean => choices.some((c) => (c === '9+' ? d >= 8 : d === c));
          const settings: AppSettings = {
            ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals, pitchClasses, subdivisions: QUARTERS_ONLY,
          };
          for (const keys of sessionsOf(settings, 2, 6)) {
            const label = `${clef} #${mask} ${JSON.stringify(intervals)}`;
            for (let i = 0; i < keys.length; i++) {
              const step = stepOf(keys[i]);
              if (!pool.has(step)) violations.push(`${label}: ${keys[i]} not in pool`);
              if (i > 0 && !allowed(Math.abs(step - stepOf(keys[i - 1])))) {
                violations.push(`${label}: ${keys[i - 1]} -> ${keys[i]}`);
              }
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  }, 60000);

  it('falls back exactly when no selected moving interval joins two selected notes', () => {
    for (let mask = 1; mask < 128; mask++) {
      for (const [clef, ledgerLines] of POOLS) {
        const steps = pitchSteps(clef, ledgerLines, classesOf(mask));
        const real = realizable(steps);
        for (let imask = 1; imask < 512; imask++) {
          const selected = INTERVAL_KEYS.filter((_, i) => imask & (1 << i));
          const intervals = intervalsOf(...selected);
          const moving = selected.filter((k) => k !== 'unison');
          const expectFallback = moving.length > 0 && !moving.some((k) => real.has(k));
          const { choices, dormant, fallback } = effectiveIntervals(intervals, steps);
          expect(fallback, `#${mask} ${selected}`).toBe(expectFallback);
          expect(dormant).toEqual(INTERVAL_KEYS.filter((k) => !real.has(k)));
          const expected = INTERVAL_KEYS.filter(
            (k) => real.has(k) && (selected.includes(k) || (expectFallback && k !== 'unison'))
          );
          const keys = choices.map((c) => INTERVAL_KEYS[c === '9+' ? 8 : c]);
          expect(keys, `#${mask} ${selected}`).toEqual(expected.length > 0 ? expected : ['unison']);
        }
      }
    }
  }, 30000);

  it('uses the selection unchanged when every note is on', () => {
    for (const clef of CLEFS) {
      const steps = pitchSteps(clef, { above: 0, below: 0 }, classesOf(127));
      expect(steps).toEqual(pitchSteps(clef, { above: 0, below: 0 }));
      for (const intervals of INTERVAL_SETS) {
        const { dormant, fallback } = effectiveIntervals(intervals, steps);
        expect(dormant).toEqual([]);
        expect(fallback).toBe(false);
      }
    }
  });

  it('never moves with unison only', () => {
    for (let mask = 1; mask < 128; mask += 3) {
      for (const [clef, ledgerLines] of POOLS) {
        const settings: AppSettings = {
          ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals: intervalsOf('unison'),
          pitchClasses: classesOf(mask), subdivisions: QUARTERS_ONLY,
        };
        for (const keys of sessionsOf(settings, 3, 4)) expect(new Set(keys).size).toBe(1);
      }
    }
  });

  it('reaches every pool pitch with C and G and the 2nd/3rd fallback', () => {
    const pitchClasses = { ...classesOf(0), c: true, g: true };
    const ledgerLines = { above: 3, below: 3 };
    const steps = pitchSteps('treble', ledgerLines, pitchClasses);
    const { dormant, fallback } = effectiveIntervals(intervalsOf('second', 'third'), steps);
    expect(fallback).toBe(true);
    expect(dormant).toEqual(expect.arrayContaining(['second', 'third']));
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS, ledgerLines, pitchClasses, intervals: intervalsOf('second', 'third'),
      subdivisions: QUARTERS_ONLY,
    };
    const seen = new Set(sessionsOf(settings, 1, 400)[0]);
    expect([...seen].sort()).toEqual(pitchPool('treble', ledgerLines, pitchClasses).sort());
  });

  it('starts the Beginner pentatonic on the clef anchor in every clef and ledger setting', () => {
    const pentatonic = { ...classesOf(127), f: false, b: false };
    const intervals = intervalsOf('unison', 'second', 'third');
    for (const clef of CLEFS) {
      for (let above = 0; above <= 3; above++) {
        for (let below = 0; below <= 3; below++) {
          const ledgerLines = { above, below };
          const steps = pitchSteps(clef, ledgerLines, pentatonic);
          // Widest gap a 3rd: 2nds and 3rds join every neighbour
          for (let i = 1; i < steps.length; i++) expect(steps[i] - steps[i - 1]).toBeLessThanOrEqual(2);
          const anchor = stepOf(CLEF_PITCH_RANGES[clef].defaultAnchor);
          const nearest = steps.reduce((best, s) => (Math.abs(s - anchor) < Math.abs(best - anchor) ? s : best));
          for (let s = 0; s < 10; s++) expect(steps[startIndex(intervals, clef, steps)]).toBe(nearest);
          const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals, pitchClasses: pentatonic };
          const first = new MusicGenerator().generateMeasure(0, settings, 0).notes[0];
          expect(stepOf(first.keys[0]), `${clef} ${above}/${below}`).toBe(nearest);
        }
      }
    }
  });

  it('treats no selected class as every note', () => {
    expect(pitchSteps('treble', { above: 1, below: 1 }, classesOf(0))).toEqual(
      pitchSteps('treble', { above: 1, below: 1 })
    );
  });
});

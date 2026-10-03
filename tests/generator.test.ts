import { describe, it, expect } from 'vitest';
import {
  MusicGenerator,
  CLEF_PITCH_RANGES,
  pitchBounds,
  pitchPool,
} from '../src/notation/generator';
import { formatRange } from '../src/i18n';
import en from '../src/i18n/locales/en';
import {
  AppSettings,
  Clef,
  MeasureData,
  TUPLET_NAMES,
  TUPLET_SUPPORT,
  TUPLET_VALUES,
  TimeSignature,
  TupletCell,
  TupletName,
  TupletValue,
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

const EXPECTED_TUPLET_SHAPE: Record<TupletName, number> = {
  duplet: 2,
  triplet: 3,
  quadruplet: 4,
  quintuplet: 5,
  sextuplet: 6,
  septuplet: 7,
};
const EXPECTED_TUPLET_DURATION: Record<TupletValue, string> = { '1/4': 'q', '1/8': '8', '1/16': '16' };

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
  const timeSignatures: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];
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
      const beatsPerMeasure = ts === '6/8' ? 6 : ts === '3/4' ? 3 : ts === '2/4' ? 2 : 4;

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
      for (let m = 0; m < 20; m++) {
        const measure = generator.generateMeasure(m, settings, m * 4);
        for (const note of measure.notes) {
          if (note.isRest) {
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
      const measures = generateMany({
        ...DEFAULT_APP_SETTINGS,
        timeSignature: '4/4',
        subdivisions: { ...noTupletSubdiv, dotted: true },
        ties: true,
        rests: false,
      });
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

    for (const ts of ['4/4', '3/4', '2/4', '6/8'] as const) {
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
          for (const m of measures) {
            const total = m.notes.reduce((sum, n) => sum + n.beatDuration, 0);
            expect(total).toBeCloseTo(m.beatsPerMeasure, 9);
            for (const n of m.notes) {
              if (!n.isTuplet) continue;
              expect(n.tupletNumNotes).toBe(EXPECTED_TUPLET_SHAPE[name]);
              expect(n.duration).toBe(EXPECTED_TUPLET_DURATION[value]);
              found = true;
            }
          }
          expect(found).toBe(true);
        });
      }
    }

    it('never generates tuplets unsupported by the current meter', () => {
      const allOn = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
      for (const name of TUPLET_NAMES) {
        for (const value of TUPLET_VALUES) allOn[name][value] = true;
      }
      for (const ts of ['4/4', '3/4', '2/4', '6/8'] as const) {
        const measures = generateMany(
          { ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions: subdiv, tuplets: allOn },
          400
        );
        const shapeToName = Object.fromEntries(
          Object.entries(EXPECTED_TUPLET_SHAPE).map(([k, v]) => [v, k])
        ) as Record<number, TupletName>;
        const durationToValue = Object.fromEntries(
          Object.entries(EXPECTED_TUPLET_DURATION).map(([k, v]) => [v, k])
        ) as Record<string, TupletValue>;
        for (const m of measures) {
          for (const n of m.notes) {
            if (!n.isTuplet || n.tupletNumNotes === undefined) continue;
            const cell: TupletCell = `${shapeToName[n.tupletNumNotes]}:${durationToValue[n.duration]}`;
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
  const METERS: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];

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
    for (const ts of ['4/4', '6/8'] as TimeSignature[]) {
      // Beat span of one eighth note in this meter
      const unit = ts === '6/8' ? 1 : 0.5;
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

  const selectedFits = (intervals: AppSettings['intervals'], up: number, down: number): number[] => {
    const steps: number[] = [];
    const flags = [
      intervals.unison,
      intervals.second,
      intervals.third,
      intervals.fourth,
      intervals.fifth,
      intervals.sixth,
      intervals.seventh,
      intervals.octave,
    ];
    flags.forEach((on, s) => {
      if (on && (s <= up || s <= down)) steps.push(s);
    });
    return steps;
  };

  it('stays in bounds, reaches both edges and moves only by selected intervals or the fallback', () => {
    const violations: string[] = [];
    for (const clef of ALL_CLEFS) {
      for (let above = 0; above <= 3; above++) {
        for (let below = 0; below <= 3; below++) {
          const ledgerLines = { above, below };
          const pool = pitchPool(clef, ledgerLines);
          for (const [name, intervals] of Object.entries(INTERVAL_SETS)) {
            const label = `${clef} ${above}/${below} ${name}`;
            const generator = new MusicGenerator();
            const settings: AppSettings = { ...DEFAULT_APP_SETTINGS, clef, ledgerLines, intervals };
            const idxs: number[] = [];
            for (let m = 0; m < 300; m++) {
              for (const note of generator.generateMeasure(m, settings, m * 4).notes) {
                idxs.push(pool.indexOf(note.keys[0]));
              }
            }
            if (idxs.includes(-1)) violations.push(`${label}: out of bounds`);
            if (name === 'all' && !(idxs.includes(0) && idxs.includes(pool.length - 1))) {
              violations.push(`${label}: edge not reached`);
            }
            for (let i = 1; i < idxs.length; i++) {
              const prev = idxs[i - 1];
              const up = pool.length - 1 - prev;
              const down = prev;
              const leap = Math.abs(idxs[i] - prev);
              const fitting = selectedFits(intervals, up, down);
              const ninthFits = intervals.ninthPlus && Math.max(up, down) >= 8;
              const ok =
                fitting.length === 0 && !ninthFits
                  ? leap === Math.max(up, down) // Documented fallback
                  : fitting.includes(leap) || (ninthFits && leap >= 8);
              if (!ok) violations.push(`${label}: ${prev} -> ${idxs[i]}`);
            }
          }
        }
      }
    }
    expect(violations).toEqual([]);
  }, 20000);
});

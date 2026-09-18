import { describe, it, expect } from 'vitest';
import { MusicGenerator, CLEF_PITCH_RANGES } from '../src/notation/generator';
import { AppSettings, Clef, TimeSignature } from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';

describe('MusicGenerator', () => {
  const timeSignatures: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];
  const clefs: Clef[] = ['treble', 'bass', 'alto', 'tenor'];

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
      const allowedPool = CLEF_PITCH_RANGES[clef].pitches;

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

  it('limits consecutive unisons to no more than 2 when other intervals are active', () => {
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      intervals: {
        unison: true,
        second: true,
        third: false,
        fourth: false,
        fifth: false,
        sixth: false,
        seventh: false,
        octave: false,
        ninthPlus: false,
      },
      rests: false,
    };

    let maxConsecutive = 0;
    let currentConsecutive = 0;
    let prevPitch: string | null = null;

    for (let m = 0; m < 50; m++) {
      const measure = generator.generateMeasure(m, settings, m * 4);
      for (const note of measure.notes) {
        if (prevPitch !== null && note.keys[0] === prevPitch) {
          currentConsecutive++;
          if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
          }
        } else {
          currentConsecutive = 0;
        }
        prevPitch = note.keys[0];
      }
    }

    expect(maxConsecutive).toBeLessThanOrEqual(2);
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
});

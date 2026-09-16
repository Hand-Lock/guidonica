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
});

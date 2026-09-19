import { describe, it, expect } from 'vitest';
import {
  ITALIAN_SOLFEGE_SYLLABLES,
  MEASURE_CANVAS_HEIGHT,
  NOTE_LETTER_NAMES,
  SOLFEGE_SYLLABLES,
  STAVE_TOP_LINE_Y,
} from '../src/notation/types';
import { CLEF_PITCH_RANGES } from '../src/notation/generator';

describe('Solfège and Note Label Geometry', () => {
  it('maps all 7 natural diatonic pitches to correct Anglo-American Solfège syllables (with Ti)', () => {
    expect(SOLFEGE_SYLLABLES['c']).toBe('Do');
    expect(SOLFEGE_SYLLABLES['d']).toBe('Re');
    expect(SOLFEGE_SYLLABLES['e']).toBe('Mi');
    expect(SOLFEGE_SYLLABLES['f']).toBe('Fa');
    expect(SOLFEGE_SYLLABLES['g']).toBe('Sol');
    expect(SOLFEGE_SYLLABLES['a']).toBe('La');
    expect(SOLFEGE_SYLLABLES['b']).toBe('Ti');
  });

  it('maps all 7 natural diatonic pitches to correct Italian Solfège syllables (with Si instead of Ti)', () => {
    expect(ITALIAN_SOLFEGE_SYLLABLES['c']).toBe('Do');
    expect(ITALIAN_SOLFEGE_SYLLABLES['d']).toBe('Re');
    expect(ITALIAN_SOLFEGE_SYLLABLES['e']).toBe('Mi');
    expect(ITALIAN_SOLFEGE_SYLLABLES['f']).toBe('Fa');
    expect(ITALIAN_SOLFEGE_SYLLABLES['g']).toBe('Sol');
    expect(ITALIAN_SOLFEGE_SYLLABLES['a']).toBe('La');
    expect(ITALIAN_SOLFEGE_SYLLABLES['b']).toBe('Si');
  });

  it('maps all 7 natural diatonic pitches to correct uppercase Letter names', () => {
    expect(NOTE_LETTER_NAMES['c']).toBe('C');
    expect(NOTE_LETTER_NAMES['d']).toBe('D');
    expect(NOTE_LETTER_NAMES['e']).toBe('E');
    expect(NOTE_LETTER_NAMES['f']).toBe('F');
    expect(NOTE_LETTER_NAMES['g']).toBe('G');
    expect(NOTE_LETTER_NAMES['a']).toBe('A');
    expect(NOTE_LETTER_NAMES['b']).toBe('B');
  });

  it('ensures MEASURE_CANVAS_HEIGHT is 220px to prevent clipping', () => {
    expect(MEASURE_CANVAS_HEIGHT).toBe(220);
    expect(STAVE_TOP_LINE_Y).toBe(80);
    // Staff lines span from Y=80 to Y=120
    const staveBottomLineY = STAVE_TOP_LINE_Y + 40;
    expect(staveBottomLineY).toBe(120);
    // Clearance below bottom stave line must be at least 80px
    expect(MEASURE_CANVAS_HEIGHT - staveBottomLineY).toBeGreaterThanOrEqual(80);
  });

  it('calculates label Y coordinates along uniform baseline with lower ledger line clearance', () => {
    const calculateLabelY = (noteY: number): number => {
      const baselineY = 148;
      return Math.min(MEASURE_CANVAS_HEIGHT - 12, Math.max(baselineY, noteY + 20));
    };

    // Standard notes in or above the staff (e.g. F6=45, C5=95, B4=100, E4=120)
    expect(calculateLabelY(45)).toBe(148);
    expect(calculateLabelY(95)).toBe(148);
    expect(calculateLabelY(100)).toBe(148);
    expect(calculateLabelY(120)).toBe(148);
    expect(calculateLabelY(125)).toBe(148); // D4

    // Lower ledger line notes gracefully step down
    expect(calculateLabelY(130)).toBe(150); // C4 (Middle C)
    expect(calculateLabelY(140)).toBe(160); // A3 (2 ledger lines)
    expect(calculateLabelY(155)).toBe(175); // E3 (3 ledger lines, lowest treble note)

    // Even the lowest possible note has generous margin before canvas bottom
    const lowestLabelY = calculateLabelY(155);
    expect(lowestLabelY).toBeLessThanOrEqual(MEASURE_CANVAS_HEIGHT - 12);
    expect(MEASURE_CANVAS_HEIGHT - lowestLabelY).toBeGreaterThanOrEqual(40);
  });

  it('verifies all pitches across all clefs have valid Solfège and Italian Solfège mappings', () => {
    const clefs = [
      'treble',
      'soprano',
      'mezzo-soprano',
      'alto',
      'tenor',
      'baritone-f',
      'baritone-c',
      'bass',
    ] as const;
    for (const clef of clefs) {
      const pitchList = CLEF_PITCH_RANGES[clef].pitches;
      expect(pitchList.length).toBeGreaterThan(0);
      for (const pitch of pitchList) {
        const letter = pitch.split('/')[0].toLowerCase();
        expect(SOLFEGE_SYLLABLES[letter]).toBeDefined();
        expect(ITALIAN_SOLFEGE_SYLLABLES[letter]).toBeDefined();
        expect(NOTE_LETTER_NAMES[letter]).toBeDefined();
      }
    }
  });
});

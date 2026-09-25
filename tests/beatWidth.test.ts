import { describe, it, expect } from 'vitest';
import { computeBeatWidth, DEFAULT_TUPLET_OPTIONS } from '../src/notation/types';

describe('computeBeatWidth', () => {
  it('computes baseline quarter beat width for simple meters', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: false,
      sixteenth: false,
    };
    expect(computeBeatWidth(subdiv, '4/4')).toBe(110);
    expect(computeBeatWidth(subdiv, '3/4')).toBe(110);
    expect(computeBeatWidth(subdiv, '2/4')).toBe(110);
  });

  it('widens beat width when eighth notes are active in simple meter', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: true,
      sixteenth: false,
    };
    expect(computeBeatWidth(subdiv, '4/4')).toBe(130);
  });

  it('widens beat width when sixteenth notes are active in simple meter', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: true,
      sixteenth: true,
    };
    expect(computeBeatWidth(subdiv, '4/4')).toBe(220);
  });

  it('widens beat width for 1/8 tuplets', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: true,
      sixteenth: false,
    };
    expect(computeBeatWidth(subdiv, '4/4')).toBe(130);

    const tuplets = {
      ...DEFAULT_TUPLET_OPTIONS,
      triplet: { ...DEFAULT_TUPLET_OPTIONS.triplet, '1/8': true },
    };
    expect(computeBeatWidth(subdiv, '4/4', tuplets)).toBe(165);
  });

  it('provides extra spacing for fast 1/16 quintuplets, sextuplets, and septuplets', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: true,
      eighth: false,
      sixteenth: false,
    };

    const quintuplets = {
      ...DEFAULT_TUPLET_OPTIONS,
      quintuplet: { ...DEFAULT_TUPLET_OPTIONS.quintuplet, '1/16': true },
    };
    expect(computeBeatWidth(subdiv, '4/4', quintuplets)).toBe(250);

    const septuplets = {
      ...DEFAULT_TUPLET_OPTIONS,
      septuplet: { ...DEFAULT_TUPLET_OPTIONS.septuplet, '1/16': true },
    };
    expect(computeBeatWidth(subdiv, '4/4', septuplets)).toBe(280);
  });

  it('computes compound meter (6/8) beat widths appropriately', () => {
    const subdiv = {
      whole: false,
      half: false,
      quarter: false,
      eighth: true,
      sixteenth: false,
    };
    expect(computeBeatWidth(subdiv, '6/8')).toBe(80);

    const subdiv16 = { ...subdiv, sixteenth: true };
    expect(computeBeatWidth(subdiv16, '6/8')).toBe(110);
  });
});

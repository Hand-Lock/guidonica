import { describe, it, expect } from 'vitest';
import { tempoMarking, MIN_TEMPO, MAX_TEMPO } from '../src/notation/types';

describe('tempoMarking', () => {
  it('maps each boundary to the expected Italian marking', () => {
    const cases: Array<[number, string]> = [
      [39, 'Grave'], [40, 'Largo'],
      [59, 'Largo'], [60, 'Larghetto'],
      [65, 'Larghetto'], [66, 'Adagio'],
      [75, 'Adagio'], [76, 'Andante'],
      [107, 'Andante'], [108, 'Moderato'],
      [119, 'Moderato'], [120, 'Allegro'],
      [155, 'Allegro'], [156, 'Vivace'],
      [175, 'Vivace'], [176, 'Presto'],
      [199, 'Presto'], [200, 'Prestissimo'],
    ];
    for (const [bpm, name] of cases) {
      expect(tempoMarking(bpm), `bpm ${bpm}`).toBe(name);
    }
  });

  it('names every tempo in the supported range', () => {
    const valid = new Set([
      'Grave', 'Largo', 'Larghetto', 'Adagio', 'Andante',
      'Moderato', 'Allegro', 'Vivace', 'Presto', 'Prestissimo',
    ]);
    for (let bpm = Math.min(30, MIN_TEMPO); bpm <= Math.max(240, MAX_TEMPO); bpm++) {
      expect(valid.has(tempoMarking(bpm)), `bpm ${bpm}`).toBe(true);
    }
  });
});

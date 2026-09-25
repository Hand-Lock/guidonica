import { describe, it, expect } from 'vitest';
import { MusicGenerator, PartitionItem } from '../src/notation/generator';
import { isLegalInnerTie, placementOf } from '../src/notation/ties';
import { AppSettings, METER, MeasureData, NoteData, TimeSignature } from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';

const N = 2000;
const METERS: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];

const SIMPLE_BEATS: Record<string, number> = {
  w: 4, hd: 3, h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25,
};
const COMPOUND_BEATS: Record<string, number> = {
  hd: 6, qd: 3, q: 2, '8d': 1.5, '8': 1, '16': 0.5,
};

/** Builds partition items from a spec like 'q q r8 t8 t8 t8' (r = rest, t = triplet group). */
function items(ts: TimeSignature, spec: string): { items: PartitionItem[]; offsets: number[] } {
  const table = ts === '6/8' ? COMPOUND_BEATS : SIMPLE_BEATS;
  const result: PartitionItem[] = [];
  const offsets: number[] = [];
  let offset = 0;
  for (const token of spec.split(' ')) {
    const isRest = token.startsWith('r');
    const isTuplet = token.startsWith('t');
    const duration = isRest || isTuplet ? token.slice(1) : token;
    const beatDuration = isTuplet ? (table[duration] * 2) / 3 : table[duration];
    result.push({
      duration,
      beatDuration,
      isRest,
      ...(isTuplet ? { isTuplet: true, tupletGroup: 1 } : {}),
    });
    offsets.push(offset);
    offset += beatDuration;
  }
  return { items: result, offsets };
}

function legal(ts: TimeSignature, spec: string, i: number, chainStart: number = i): boolean {
  const built = items(ts, spec);
  return isLegalInnerTie(built.items, built.offsets, i, chainStart, ts);
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

const ALL_SUBDIV = { whole: true, half: true, quarter: true, eighth: true, sixteenth: true, dotted: true };

function richSettings(ts: TimeSignature): AppSettings {
  const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
  tuplets.triplet['1/8'] = true;
  tuplets.duplet['1/8'] = true;
  return { ...DEFAULT_APP_SETTINGS, timeSignature: ts, subdivisions: ALL_SUBDIV, tuplets, ties: true, rests: true };
}

function tiedPair(m: MeasureData, pred: (a: NoteData, b: NoteData) => boolean): boolean {
  return m.notes.some((n, i) => {
    const next = m.notes[i + 1];
    return next !== undefined && Boolean(n.tieStart) && Boolean(next.tieEnd) && pred(n, next);
  });
}

describe('placementOf (notehead placement table)', () => {
  it('classifies canonical, tolerated and unplaceable spans', () => {
    expect(placementOf('4/4', 0, 2)).toBe('canonical');
    expect(placementOf('4/4', 1, 2)).toBe('tolerated');
    expect(placementOf('4/4', 0.5, 2)).toBe(null);
    expect(placementOf('4/4', 1, 3)).toBe('tolerated');
    expect(placementOf('4/4', 1, 1.5)).toBe(null);
    expect(placementOf('4/4', 1.5, 1)).toBe(null);
    expect(placementOf('4/4', 0, 2.5)).toBe(null);
    expect(placementOf('4/4', 3, 2)).toBe(null); // overflows the bar
    expect(placementOf('2/4', 1, 2)).toBe(null);
    expect(placementOf('3/4', 1, 2)).toBe('canonical');
    expect(placementOf('3/4', 1.5, 1)).toBe('canonical');
    expect(placementOf('6/8', 0, 4)).toBe(null); // h never placeable in 6/8
    expect(placementOf('6/8', 2, 2)).toBe(null);
    expect(placementOf('6/8', 3, 3)).toBe('canonical');
  });
});

describe('isLegalInnerTie (tie grammar)', () => {
  it('4/4: redundant ties are illegal, notational ties are legal', () => {
    expect(legal('4/4', 'q q q q', 0)).toBe(false); // q~q on beat 1 = h
    expect(legal('4/4', 'q q q q', 1)).toBe(true); // across the middle: h@1 only tolerated
    expect(legal('4/4', 'q q q q', 2)).toBe(false);
    expect(legal('4/4', 'qd 8 h', 0)).toBe(false); // = h
    expect(legal('4/4', '8 qd 8 qd', 1)).toBe(true); // h@.5 not placeable
    expect(legal('4/4', 'h h', 0)).toBe(false); // = w
    expect(legal('4/4', 'h 8 qd', 0)).toBe(true); // 2.5 beats is no value
    expect(legal('4/4', '8 16 16 8 8 h', 2)).toBe(true); // 16~8 across a beat
    expect(legal('4/4', '8 8 h h', 0)).toBe(false); // inside a beat
  });

  it('3/4, 2/4, 6/8', () => {
    expect(legal('3/4', 'q q q', 0)).toBe(false);
    expect(legal('3/4', 'q q q', 1)).toBe(false);
    expect(legal('3/4', 'h q', 0)).toBe(false); // = hd
    expect(legal('3/4', '8 8 q q', 0)).toBe(false);
    expect(legal('2/4', 'q q', 0)).toBe(false);
    expect(legal('2/4', '8 q 8', 0)).toBe(false);
    expect(legal('2/4', '8 q 8', 1)).toBe(false);
    expect(legal('6/8', 'qd qd', 0)).toBe(false);
    expect(legal('6/8', 'q 8 8 q', 1)).toBe(true); // 8~8 across the dotted beat
    expect(legal('6/8', 'q 8 qd', 0)).toBe(false); // = qd
    expect(legal('6/8', '8 8 8 qd', 0)).toBe(false);
  });

  it('never ties rests or inside one tuplet group; ties across tuplet boundaries', () => {
    expect(legal('4/4', 'q rq h', 0)).toBe(false);
    expect(legal('4/4', 't8 t8 t8 q h', 0)).toBe(false);
    expect(legal('4/4', 't8 t8 t8 q h', 2)).toBe(true);
    expect(legal('4/4', 'q t8 t8 t8 h', 0)).toBe(true);
  });

  it('enforces chain minimality', () => {
    // q@0 ~ qd@1 ~ 8@2.5 would be hd@0: the extension is illegal although qd+8 = h@1 alone is not
    expect(legal('4/4', 'q qd 8 q', 1, 1)).toBe(true);
    expect(legal('4/4', 'q qd 8 q', 1, 0)).toBe(false);
  });
});

describe('generated tie grammar', () => {
  it('vocabulary ⊆ placement table: every non-tuplet item is canonical or tolerated', () => {
    for (const ts of METERS) {
      for (const m of generateMany(richSettings(ts))) {
        for (const n of m.notes) {
          if (n.isTuplet) continue;
          expect(placementOf(ts, n.beatOffset, n.beatDuration), `${ts} ${n.duration}@${n.beatOffset}`).not.toBe(
            null
          );
        }
      }
    }
  });

  it('every internal tie is necessary (legal, minimal, pitch-preserving)', () => {
    for (const ts of METERS) {
      let tieCount = 0;
      for (const m of generateMany(richSettings(ts))) {
        let chainStart = 0;
        m.notes.forEach((a, i) => {
          if (!a.tieEnd) chainStart = i;
          const b = m.notes[i + 1];
          if (!a.tieStart || b === undefined) return;
          tieCount++;
          expect(b.tieEnd).toBe(true);
          expect(a.isRest || b.isRest).toBe(false);
          expect(Boolean(a.isTuplet && b.isTuplet && a.tupletGroup === b.tupletGroup)).toBe(false);
          expect(b.keys[0]).toBe(a.keys[0]);
          let span = b.beatDuration;
          for (let j = i; j >= chainStart; j--) {
            span += m.notes[j].beatDuration;
            if (m.notes.slice(j, i + 2).some((n) => n.isTuplet)) continue;
            expect(placementOf(ts, m.notes[j].beatOffset, span), `${ts} chain ${j}..${i + 1}`).not.toBe('canonical');
          }
        });
      }
      expect(tieCount).toBeGreaterThan(0);
    }
  });

  it('cross-barline ties are consistent and reachable', () => {
    for (const ts of METERS) {
      const measures = generateMany(richSettings(ts));
      let barlineTies = 0;
      for (let k = 0; k < measures.length - 1; k++) {
        const last = measures[k].notes[measures[k].notes.length - 1];
        const first = measures[k + 1].notes[0];
        expect(Boolean(last.tieStart)).toBe(Boolean(first.tieEnd));
        if (!last.tieStart) {
          expect(measures[k + 1].tieIn).toBeUndefined();
          continue;
        }
        barlineTies++;
        expect(last.isRest || first.isRest).toBe(false);
        expect(first.keys[0]).toBe(last.keys[0]);
        expect(measures[k + 1].tieIn).toEqual({
          beatOffset: last.beatOffset,
          duration: last.duration,
          beatWidth: measures[k].beatWidth,
          measureWidth: measures[k].width,
        });
      }
      expect(barlineTies).toBeGreaterThan(0);
    }
  });

  it('ties off: no tie flags and no tieIn', () => {
    for (const ts of METERS) {
      for (const m of generateMany({ ...richSettings(ts), ties: false }, 500)) {
        expect(m.tieIn).toBeUndefined();
        expect(m.notes.some((n) => n.tieStart || n.tieEnd)).toBe(false);
      }
    }
  });

  it('all subdivision/dotted toggles: tie legality is independent of the toggles', () => {
    const quarterOnly = { whole: false, half: false, quarter: true, eighth: false, sixteenth: false, dotted: false };
    for (const m of generateMany({ ...DEFAULT_APP_SETTINGS, subdivisions: quarterOnly, ties: true, rests: false })) {
      m.notes.forEach((n, i) => {
        // Quarter-only 4/4: internal ties only across the middle of the bar
        if (n.tieStart && i < m.notes.length - 1) expect(n.beatOffset).toBe(1);
      });
    }
  });
});

describe('tie reachability (P > 0)', () => {
  it('4/4: q q~q q', () => {
    const quarterOnly = { whole: false, half: false, quarter: true, eighth: false, sixteenth: false, dotted: false };
    const measures = generateMany({ ...DEFAULT_APP_SETTINGS, subdivisions: quarterOnly, ties: true, rests: false });
    expect(
      measures.some(
        (m) => m.notes.map((n) => n.duration).join(' ') === 'q q q q' && m.notes[1].tieStart && m.notes[2].tieEnd
      )
    ).toBe(true);
  });

  it('4/4: middle tie 8 qd~8', () => {
    const subdiv = { whole: false, half: true, quarter: true, eighth: true, sixteenth: false, dotted: true };
    const measures = generateMany({ ...DEFAULT_APP_SETTINGS, subdivisions: subdiv, ties: true, rests: false });
    expect(
      measures.some((m) =>
        tiedPair(m, (a, b) => a.duration === 'qd' && a.beatOffset === 0.5 && b.duration === '8' && b.beatOffset === 2)
      )
    ).toBe(true);
  });

  it('6/8: 8~8 across the dotted beat', () => {
    const subdiv = { whole: false, half: false, quarter: true, eighth: true, sixteenth: false, dotted: true };
    const measures = generateMany({
      ...DEFAULT_APP_SETTINGS,
      timeSignature: '6/8',
      subdivisions: subdiv,
      ties: true,
      rests: false,
    });
    expect(
      measures.some((m) =>
        tiedPair(m, (a, b) => a.duration === '8' && a.beatOffset === 2 && b.duration === '8' && b.beatOffset === 3)
      )
    ).toBe(true);
  });

  it('a tie touching a tuplet boundary', () => {
    const measures = generateMany(richSettings('4/4'));
    expect(measures.some((m) => tiedPair(m, (a, b) => Boolean(a.isTuplet) !== Boolean(b.isTuplet)))).toBe(true);
  });

  it('a chain across two barlines (…~|w~|…)', () => {
    const subdiv = { whole: true, half: false, quarter: true, eighth: false, sixteenth: false, dotted: false };
    const measures = generateMany({ ...DEFAULT_APP_SETTINGS, subdivisions: subdiv, ties: true, rests: false });
    expect(
      measures.some((m) => m.notes.length === 1 && m.notes[0].duration === 'w' && m.notes[0].tieEnd && m.notes[0].tieStart)
    ).toBe(true);
  });
});

describe('barline tie lifecycle', () => {
  const settings: AppSettings = { ...richSettings('4/4'), rests: false };
  const beats = METER['4/4'].beatsPerMeasure;

  it('resetPitch drops a pending incoming tie', () => {
    const generator = new MusicGenerator();
    let checked = 0;
    for (let m = 0; m < N && checked < 20; m++) {
      const measure = generator.generateMeasure(m, settings, m * beats);
      if (!measure.notes[measure.notes.length - 1].tieStart) continue;
      generator.resetPitch();
      const fresh = generator.generateMeasure(0, settings, 0);
      expect(fresh.notes[0].tieEnd).toBeFalsy();
      expect(fresh.tieIn).toBeUndefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a jumped measureIndex drops the pending tie', () => {
    const generator = new MusicGenerator();
    let index = 0;
    let checked = 0;
    for (let k = 0; k < N && checked < 20; k++) {
      const measure = generator.generateMeasure(index, settings, index * beats);
      if (measure.notes[measure.notes.length - 1].tieStart) {
        index += 5;
        const skipped = generator.generateMeasure(index, settings, index * beats);
        expect(skipped.notes[0].tieEnd).toBeFalsy();
        expect(skipped.tieIn).toBeUndefined();
        checked++;
      }
      index++;
    }
    expect(checked).toBeGreaterThan(0);
  });
});

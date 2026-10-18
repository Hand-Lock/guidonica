import { describe, it, expect, vi } from 'vitest';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  MeasureData,
  NOTE_START_OFFSET,
  PAGE_DENSITY,
  PAGE_LEFT_MARGIN,
  PAGE_MIN_STAFF_DISTANCE,
  PAGE_RIGHT_MARGIN,
  PAGE_SYSTEM_GAP,
  PAGE_TURN_BEATS,
  RenderedMeasure,
  getBeatsPerMeasure,
} from '../src/notation/types';
import { beatX, justifyMeasure, spaceMeasure, typicalBarWidth } from '../src/notation/spacing';
import {
  PageSystem,
  closeLine,
  cursorOffsetX,
  findSystem,
  fitsLine,
  lineAlpha,
  lineAvailable,
  lineDistance,
  pageScrollY,
} from '../src/scroller/page';
import { mulberry32 } from '../src/notation/random';

vi.mock('../src/notation/fonts', () => ({ isMusicFontReady: () => true }));

const HEADER = 40;
const METER_HEADER = 60;

const settingsFor = (view: AppSettings['view'], busy = false): AppSettings => {
  const s: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
  if (busy) {
    s.subdivisions.sixteenth = true;
    s.tuplets.triplet['1/8'] = true;
  }
  s.view = view;
  return s;
};

/** Natural page bars of a seeded generator, each laid out after the one before. */
const naturalBars = (count: number, s: AppSettings, seed = 7): MeasureData[] => {
  const generator = new MusicGenerator(mulberry32(seed));
  const raw: MeasureData[] = [];
  let beat = 0;
  for (let i = 0; i <= count; i++) {
    const m = generator.generateMeasure(i, s, beat);
    raw.push(m);
    beat += m.beatsPerMeasure;
  }
  const out: MeasureData[] = [];
  let prev: MeasureData | null = null;
  for (let i = 0; i < count; i++) {
    prev = spaceMeasure(raw[i], prev, raw[i + 1], 'page', s);
    out.push(prev);
  }
  return out;
};

/** A page buffer whose renderer reports each bar's ink and fixed header widths. */
const makePageBuffer = (seed = 7, ink: (d: MeasureData) => { top: number; bottom: number } = () => ({ top: 80, bottom: 120 })) => {
  const renderMeasure = vi.fn(
    (data: MeasureData): RenderedMeasure => ({
      data,
      canvas: document.createElement('canvas'),
      width: data.width,
      height: 1,
      ink: ink(data),
    })
  );
  const systemHeaderWidth = vi.fn((_clef: string, ts: string | null) => (ts ? METER_HEADER : HEADER));
  const generator = new MusicGenerator(mulberry32(seed));
  const buffer = new MeasureBuffer(
    generator,
    { renderMeasure, systemHeaderWidth } as unknown as MeasureRenderer,
    () => null
  );
  return { buffer, generator, renderMeasure };
};

const system = (startBeat: number, y: number, prevY: number): PageSystem => ({
  firstIndex: 0,
  count: 1,
  startBeat,
  endBeat: startBeat + 4,
  header: HEADER,
  meter: false,
  y,
  prevY,
  inkTop: 80,
  inkBottom: 120,
});

describe('Page line breaking and justification (ADR 0110)', () => {
  const s = settingsFor('page');
  const bars = naturalBars(24, s);

  it('lays a page bar out at PAGE_DENSITY of its squishy width', () => {
    expect(typicalBarWidth(s, 'page')).toBeCloseTo(typicalBarWidth(s, 'squishy') * PAGE_DENSITY, 6);
  });

  it('packs bars greedily without overflowing, except a lone bar', () => {
    const available = lineAvailable(560, HEADER);
    expect(available).toBe(560 - PAGE_LEFT_MARGIN - HEADER - PAGE_RIGHT_MARGIN);
    let used = 0;
    let lines = 0;
    for (const d of bars) {
      if (!fitsLine(used, d.width, available)) {
        lines++;
        used = 0;
      }
      if (used > 0) expect(used + d.width).toBeLessThanOrEqual(available);
      used += d.width;
    }
    expect(lines).toBeGreaterThan(3);
    expect(fitsLine(0, available * 3, available)).toBe(true);
    expect(fitsLine(1, available, available)).toBe(false);
  });

  it('fills a closed line exactly, with continuous speed at each barline inside it', () => {
    const available = 520;
    const line = closeLine(bars.slice(0, 2), available);
    expect(line[0].width + line[1].width).toBeCloseTo(available, 9);
    const j = available / (bars[0].width + bars[1].width);
    expect(j).toBeGreaterThan(1);
    line.forEach((d, i) => {
      expect(d.notes).toBe(bars[i].notes);
      expect(d.width).toBeCloseTo(bars[i].width * j, 9);
      const xs = d.knots?.xs;
      expect(xs).toBeDefined();
      if (!xs) return;
      expect(xs[0]).toBe(NOTE_START_OFFSET);
      expect(xs[xs.length - 1]).toBeCloseTo(NOTE_START_OFFSET + d.width, 9);
      for (let k = 1; k < xs.length; k++) expect(xs[k]).toBeGreaterThan(xs[k - 1]);
    });
    const [a, b] = line;
    expect(a.knots?.slopes[a.notes.length]).toBeCloseTo(b.knots?.slopes[0] ?? NaN, 9);
    // beatX runs monotone across the line, one bar into the next
    let last = -Infinity;
    for (const d of line) {
      for (let t = 0; t <= d.beatsPerMeasure; t += 0.125) {
        const x = beatX(d, d.timeSignature, t) + (d === b ? a.width : 0);
        expect(x).toBeGreaterThanOrEqual(last - 1e-9);
        last = x;
      }
    }
  });

  it('compresses a lone bar wider than the line', () => {
    const [d] = closeLine([bars[0]], bars[0].width / 2);
    expect(d.width).toBeCloseTo(bars[0].width / 2, 9);
  });

  it('marks only a line start, and takes a tie into a bar from the justified bar before it', () => {
    const [a, b] = closeLine(bars.slice(0, 2), 520);
    expect(a.lineStart).toBe(true);
    expect(b.lineStart).toBeUndefined();
    const tied = { ...bars[1], tieIn: { beatOffset: -0.5, duration: '8', beatWidth: 1, measureWidth: 1 } } as MeasureData;
    const inLine = justifyMeasure(tied, 1.2, a);
    expect(inLine.tieIn?.measureWidth).toBe(a.width);
    expect(inLine.tieIn?.knots).toBe(a.knots);
    // Across a break the bar keeps its own tieIn: its incoming arc is clipped after the clef
    const atStart = justifyMeasure(tied, 1.2, null);
    expect(atStart.tieIn).toEqual(tied.tieIn);
    // The tape views never see lineStart
    expect(spaceMeasure(a, null, null, 'squishy', s).lineStart).toBeUndefined();
  });
});

describe('Page line distance (ADR 0110)', () => {
  it('keeps the least staff distance and clears the ink of tall lines', () => {
    expect(lineDistance(120, 80)).toBe(PAGE_MIN_STAFF_DISTANCE);
    expect(lineDistance(170, 50)).toBe(170 - 50 + PAGE_SYSTEM_GAP);
    expect(lineDistance(170, 50) - 170 + 50).toBe(PAGE_SYSTEM_GAP);
  });
});

describe('Page scroll curve (ADR 0110)', () => {
  const systems = [system(0, 0, 0), system(4, 100, 0), system(8, 230, 100), system(16, 330, 230)];

  it('finds the line playing at a beat', () => {
    expect(findSystem([], 3)).toBe(-1);
    expect(findSystem(systems, -1)).toBe(0);
    expect(findSystem(systems, 0)).toBe(0);
    expect(findSystem(systems, 3.99)).toBe(0);
    expect(findSystem(systems, 4)).toBe(1);
    expect(findSystem(systems, 12)).toBe(2);
    expect(findSystem(systems, 99)).toBe(3);
  });

  it('holds still outside the turns and eases C¹ across each break', () => {
    const half = PAGE_TURN_BEATS / 2;
    expect(pageScrollY(systems, 1)).toBe(0);
    expect(pageScrollY(systems, 4 - half)).toBe(0);
    expect(pageScrollY(systems, 4)).toBeCloseTo(50, 9);
    expect(pageScrollY(systems, 4 + half)).toBe(100);
    expect(pageScrollY(systems, 12)).toBe(230);
    const h = 1e-4;
    for (let vb = 0; vb < 18; vb += 0.01) {
      const y = pageScrollY(systems, vb);
      const next = pageScrollY(systems, vb + h);
      // Continuous, monotone, and with a bounded slope: no jump anywhere
      expect(next).toBeGreaterThanOrEqual(y - 1e-9);
      expect(next - y).toBeLessThan(h * 1.5 * 130 / PAGE_TURN_BEATS + 1e-9);
    }
    // C¹: zero slope where each turn begins and ends
    for (const edge of [4 - half, 4 + half, 8 - half, 8 + half]) {
      expect(Math.abs(pageScrollY(systems, edge + h) - pageScrollY(systems, edge - h))).toBeLessThan(1e-4);
    }
  });

  it('cuts at the barline with reduced motion', () => {
    expect(pageScrollY(systems, 3.99, true)).toBe(0);
    expect(pageScrollY(systems, 4, true)).toBe(100);
    expect(pageScrollY(systems, 7.9, true)).toBe(100);
  });

  it('fades a finished line out over the half beat after its break', () => {
    expect(lineAlpha(systems, 0, 3.9)).toBe(1);
    expect(lineAlpha(systems, 0, 4)).toBe(1);
    expect(lineAlpha(systems, 0, 4 + PAGE_TURN_BEATS / 4)).toBeCloseTo(0.5, 9);
    expect(lineAlpha(systems, 0, 4 + PAGE_TURN_BEATS / 2)).toBe(0);
    expect(lineAlpha(systems, 3, 99)).toBe(1);
  });
});

describe('MeasureBuffer page view (ADR 0110)', () => {
  const pageWidth = 560;

  it('generates the same music as the tape views, in the generator order', () => {
    const s = settingsFor('page', true);
    const { buffer } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 6, s);
    const direct = new MusicGenerator(mulberry32(7));
    const beats = getBeatsPerMeasure(s.timeSignature);
    const bars = buffer.getMeasures();
    expect(bars.length).toBeGreaterThan(5);
    bars.forEach((m, i) => expect(m.data.notes).toEqual(direct.generateMeasure(i, s, i * beats).notes));
  });

  it('builds justified lines that tile the bars, with the meter only on bar 0 and stacked ys', () => {
    const s = settingsFor('page');
    const { buffer } = makePageBuffer(7, (d) => (d.index === 2 ? { top: 40, bottom: 170 } : { top: 80, bottom: 120 }));
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 5, s);
    const systems = buffer.getSystems();
    const bars = buffer.getMeasures();
    expect(systems.length).toBeGreaterThanOrEqual(6);
    let pos = 0;
    systems.forEach((sys, r) => {
      expect(sys.firstIndex).toBe(bars[pos].data.index);
      expect(sys.startBeat).toBe(bars[pos].data.startBeat);
      expect(sys.meter).toBe(r === 0);
      expect(sys.header).toBe(r === 0 ? METER_HEADER : HEADER);
      let width = 0;
      for (let i = pos; i < pos + sys.count; i++) {
        expect(bars[i].data.lineStart === true).toBe(i === pos);
        width += bars[i].data.width;
      }
      if (sys.count > 1) expect(width).toBeCloseTo(lineAvailable(pageWidth, sys.header), 6);
      const last = bars[pos + sys.count - 1].data;
      expect(sys.endBeat).toBe(last.startBeat + last.beatsPerMeasure);
      if (r > 0) {
        const above = systems[r - 1];
        expect(sys.prevY).toBe(above.y);
        expect(sys.y - above.y).toBe(lineDistance(above.inkBottom, sys.inkTop));
        expect(sys.startBeat).toBe(above.endBeat);
      }
      pos += sys.count;
    });
    expect(pos).toBe(bars.length);
    // The tall bar 2 pushes its line apart from its neighbours
    const tall = systems.findIndex((sys) => sys.firstIndex <= 2 && 2 < sys.firstIndex + sys.count);
    expect(systems[tall].inkBottom).toBe(170);
    expect(systems[tall + 1].y - systems[tall].y).toBe(170 - 80 + PAGE_SYSTEM_GAP);
  });

  it('puts the cursor on each note at its onset', () => {
    const s = settingsFor('page', true);
    const { buffer } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 4, s);
    const bars = buffer.getMeasures();
    let pos = 0;
    for (const sys of buffer.getSystems()) {
      let x = PAGE_LEFT_MARGIN + sys.header;
      for (let i = pos; i < pos + sys.count; i++) {
        const d = bars[i].data;
        for (const note of d.notes) {
          const vb = d.startBeat + note.beatOffset;
          const xs = d.knots?.xs;
          const k = d.notes.indexOf(note);
          expect(cursorOffsetX(sys, bars, pos, vb)).toBeCloseTo(x + (xs ? xs[k] : 0), 9);
        }
        x += d.width;
      }
      pos += sys.count;
    }
  });

  it('renders one bar per step under a measure limit and stops once the rows are covered', () => {
    const s = settingsFor('page');
    const { buffer, renderMeasure } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    let steps = 0;
    while (buffer.ensureRows(0, 3, s, 1)) {
      steps++;
      expect(renderMeasure).toHaveBeenCalledTimes(steps);
    }
    expect(buffer.coversRows(0, 3)).toBe(true);
    const rendered = renderMeasure.mock.calls.length;
    expect(buffer.ensureRows(0, 3, s, 1)).toBe(false);
    expect(renderMeasure).toHaveBeenCalledTimes(rendered);
  });

  it('keeps the active line and the one before it, evicting the rest', () => {
    const s = settingsFor('page');
    const { buffer } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 6, s);
    const systems = buffer.getSystems().slice();
    const vb = systems[4].startBeat + 0.5;
    buffer.evictRowsBefore(vb);
    expect(buffer.getSystems()[0]).toBe(systems[3]);
    expect(buffer.getMeasures()[0].data.index).toBe(systems[3].firstIndex);
    // Memory stays bounded: rows ahead of the line playing, plus the departing one
    buffer.ensureRows(vb, 6, s);
    expect(buffer.getSystems().length).toBeLessThanOrEqual(1 + 1 + 6 + 1);
  });

  it('re-breaks the kept bars for a new width, keeping notes and the first y', () => {
    const s = settingsFor('page');
    const { buffer, generator } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 4, s);
    const notes = buffer.getMeasures().map((m) => m.data.notes);
    const lines = buffer.getSystems().length;
    const generateSpy = vi.spyOn(generator, 'generateMeasure');
    buffer.setPageWidth(pageWidth * 2);
    buffer.ensureRows(0, 0, s);
    expect(buffer.getSystems().length).toBeLessThan(lines);
    expect(buffer.getSystems()[0].y).toBe(0);
    buffer.getMeasures().forEach((m, i) => expect(m.data.notes).toBe(notes[i]));
    // Re-breaking itself generates nothing; only rows still short draw new bars
    expect(generateSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('switches between the tape and the page without touching the notes', () => {
    const tape = settingsFor('squishy');
    const { buffer, generator } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureAhead(0, 24, tape);
    const notes = buffer.getMeasures().map((m) => m.data.notes);
    const generateSpy = vi.spyOn(generator, 'generateMeasure');

    buffer.rerender(settingsFor('page'));
    expect(generateSpy).not.toHaveBeenCalled();
    const paged = buffer.getMeasures().map((m) => m.data.notes);
    paged.forEach((n, i) => expect(n).toBe(notes[i]));
    expect(buffer.getSystems().length).toBeGreaterThan(0);

    buffer.rerender(tape);
    expect(generateSpy).not.toHaveBeenCalled();
    expect(buffer.getSystems()).toHaveLength(0);
    const back = buffer.getMeasures().map((m) => m.data);
    back.forEach((d, i) => {
      expect(d.notes).toBe(notes[i]);
      expect(d.lineStart).toBeUndefined();
    });
    expect(back.length).toBe(notes.length);
  });

  it('drops the page on reset', () => {
    const s = settingsFor('page');
    const { buffer } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 3, s);
    buffer.reset();
    expect(buffer.getSystems()).toHaveLength(0);
    expect(buffer.getMeasures()).toHaveLength(0);
    buffer.ensureRows(0, 1, s);
    expect(buffer.getMeasures()[0].data.index).toBe(0);
  });
});

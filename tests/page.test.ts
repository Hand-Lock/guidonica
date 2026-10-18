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
  PAGE_PLAYED_ALPHA,
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
  lineFocus,
  pageAnchor,
  pageRowsAbove,
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
        const x = beatX(d, t) + (d === b ? a.width : 0);
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
    expect(pageScrollY(systems, 1, 0)).toBe(0);
    expect(pageScrollY(systems, 4 - half, 0)).toBe(0);
    expect(pageScrollY(systems, 4, 0)).toBeCloseTo(50, 9);
    expect(pageScrollY(systems, 4 + half, 0)).toBe(100);
    expect(pageScrollY(systems, 12, 0)).toBe(230);
    const h = 1e-4;
    for (let vb = 0; vb < 18; vb += 0.01) {
      const y = pageScrollY(systems, vb, 0);
      const next = pageScrollY(systems, vb + h, 0);
      // Continuous, monotone, and with a bounded slope: no jump anywhere
      expect(next).toBeGreaterThanOrEqual(y - 1e-9);
      expect(next - y).toBeLessThan(h * 1.5 * 130 / PAGE_TURN_BEATS + 1e-9);
    }
    // C¹: zero slope where each turn begins and ends
    for (const edge of [4 - half, 4 + half, 8 - half, 8 + half]) {
      expect(Math.abs(pageScrollY(systems, edge + h, 0) - pageScrollY(systems, edge - h, 0))).toBeLessThan(1e-4);
    }
  });

  it('starts at the page top and scrolls once the reading line reaches the anchor', () => {
    const anchor = 150;
    // Lines at y ≤ anchor: the page holds at its top, the reading line moves down
    expect(pageScrollY(systems, 1, anchor)).toBe(0);
    expect(pageScrollY(systems, 5, anchor)).toBe(0);
    // Past the anchor, the page scrolls to y − anchor
    expect(pageScrollY(systems, 12, anchor)).toBe(230 - anchor);
    expect(pageScrollY(systems, 20, anchor)).toBe(330 - anchor);
    // The turn where the clamp releases (100 → 230) eases from 0, C¹ at both ends
    const h = 1e-4;
    const half = PAGE_TURN_BEATS / 2;
    expect(pageScrollY(systems, 8, anchor)).toBeCloseTo((230 - anchor) / 2, 9);
    for (const edge of [8 - half, 8 + half, 16 - half, 16 + half]) {
      expect(Math.abs(pageScrollY(systems, edge + h, anchor) - pageScrollY(systems, edge - h, anchor))).toBeLessThan(1e-4);
    }
    // Monotone with a slope no steeper than an unclamped turn: the clamp adds no kink
    let maxSlope = 0;
    for (let vb = 0; vb < 18; vb += 0.001) {
      const y = pageScrollY(systems, vb, anchor);
      const next = pageScrollY(systems, vb + h, anchor);
      expect(next).toBeGreaterThanOrEqual(y - 1e-9);
      maxSlope = Math.max(maxSlope, (next - y) / h);
    }
    expect(maxSlope).toBeLessThan(1.5 * 130 / PAGE_TURN_BEATS + 1e-3);
    // The derivative is continuous: neighbouring slopes differ by little everywhere
    let prevSlope = 0;
    for (let vb = 0; vb < 18; vb += 0.001) {
      const slope = (pageScrollY(systems, vb + h, anchor) - pageScrollY(systems, vb, anchor)) / h;
      expect(Math.abs(slope - prevSlope)).toBeLessThan(1);
      prevSlope = slope;
    }
  });

  it('cuts at the barline with reduced motion', () => {
    expect(pageScrollY(systems, 3.99, 0, true)).toBe(0);
    expect(pageScrollY(systems, 4, 0, true)).toBe(100);
    expect(pageScrollY(systems, 7.9, 0, true)).toBe(100);
    expect(pageScrollY(systems, 7.9, 150, true)).toBe(0);
    expect(pageScrollY(systems, 8, 150, true)).toBe(80);
  });

  it('dims a finished line to the played ink over the half beat after its break', () => {
    expect(lineAlpha(systems, 0, 3.9)).toBe(1);
    expect(lineAlpha(systems, 0, 4)).toBe(1);
    expect(lineAlpha(systems, 0, 4 + PAGE_TURN_BEATS / 4)).toBeCloseTo(1 - (1 - PAGE_PLAYED_ALPHA) / 2, 9);
    expect(lineAlpha(systems, 0, 4 + PAGE_TURN_BEATS / 2)).toBeCloseTo(PAGE_PLAYED_ALPHA, 9);
    expect(lineAlpha(systems, 0, 99)).toBeCloseTo(0.4, 9);
    expect(lineAlpha(systems, 3, 99)).toBe(1);
  });

  it('marks the active line with a band that cross-fades with the turn', () => {
    const half = PAGE_TURN_BEATS / 2;
    const focus = (vb: number, reduced = false): number[] => systems.map((_, i) => lineFocus(systems, i, vb, reduced));
    expect(focus(1)).toEqual([1, 0, 0, 0]);
    expect(focus(12)).toEqual([0, 0, 1, 0]);
    expect(focus(4 - half)).toEqual([1, 0, 0, 0]);
    expect(focus(4 + half)).toEqual([0, 1, 0, 0]);
    const mid = focus(4);
    expect(mid[0]).toBeCloseTo(0.5, 9);
    expect(mid[1]).toBeCloseTo(0.5, 9);
    // The weights sum to 1 and follow the scroll's ease exactly
    for (let vb = 0; vb < 18; vb += 0.01) {
      const f = focus(vb);
      expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      const k = f.findIndex((x) => x > 0 && x < 1);
      if (k > 0 && f[k - 1] > 0) {
        const sys = systems[k];
        const progress = (pageScrollY(systems, vb, 0) - sys.prevY) / (sys.y - sys.prevY);
        expect(f[k]).toBeCloseTo(progress, 9);
      }
    }
    // A step at the barline with reduced motion
    expect(focus(3.99, true)).toEqual([1, 0, 0, 0]);
    expect(focus(4, true)).toEqual([0, 1, 0, 0]);
  });

  it('anchors the reading line a third of the way down the stage', () => {
    // 620 px at 70%: the middle staff line (y + 100) lands at 620 / 3 px
    const a = pageAnchor(620, 0.7);
    expect((100 + a) * 0.7).toBeCloseTo(620 / 3, 9);
    expect(a).toBeCloseTo(620 / 3 / 0.7 - 100, 9);
    // A short stage never anchors above the page top
    expect(pageAnchor(200, 1)).toBe(0);
    expect(pageRowsAbove(0)).toBe(2);
    expect(pageRowsAbove(195)).toBe(4);
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

  it('keeps the active line and the rows above it, evicting the rest', () => {
    const s = settingsFor('page');
    const { buffer } = makePageBuffer();
    buffer.setPageWidth(pageWidth);
    buffer.ensureRows(0, 8, s);
    const systems = buffer.getSystems().slice();
    const vb = systems[6].startBeat + 0.5;
    buffer.evictRowsBefore(vb, 4);
    expect(buffer.getSystems()[0]).toBe(systems[2]);
    expect(buffer.getMeasures()[0].data.index).toBe(systems[2].firstIndex);
    buffer.evictRowsBefore(vb, 1);
    expect(buffer.getSystems()[0]).toBe(systems[5]);
    // Memory stays bounded: rows ahead of the line playing, plus those kept above
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

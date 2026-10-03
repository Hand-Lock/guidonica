import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { Beam, Tuplet } from 'vexflow/core';
import { MusicGenerator } from '../src/notation/generator';
import {
  MAX_BEAM_RISE,
  MeasureRenderer,
  NOTATION_CANVAS_MARGIN,
  tupletNumberBox,
} from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  IntervalOptions,
  MAX_LEDGER_LINES,
  MEASURE_CANVAS_HEIGHT,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  TUPLET_SUPPORT,
  TupletName,
  TupletValue,
} from '../src/notation/types';

describe('Renderer accepts every supported tuplet cell with ties', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => ({ width: 10 }),
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  for (const ts of ['4/4', '3/4', '2/4', '6/8'] as const) {
    it(`renders ${ts} measures for each supported tuplet cell`, () => {
      const renderer = new MeasureRenderer();
      for (const cell of TUPLET_SUPPORT[ts]) {
        const [name, value] = cell.split(':') as [TupletName, TupletValue];
        const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
        tuplets[name][value] = true;
        const settings: AppSettings = {
          ...structuredClone(DEFAULT_APP_SETTINGS),
          timeSignature: ts,
          tuplets,
          ties: true,
          solfegeLabelMode: 'solfege',
        };
        const generator = new MusicGenerator();
        for (let m = 0; m < 20; m++) {
          const data = generator.generateMeasure(m, settings, m * 6);
          const rendered = renderer.renderMeasure(data, 'light', 'solfege');
          expect(rendered.width).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('Long tuplet beams and numbers stay inside the measure canvas (ADR 0057)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let beamDraw: MockInstance<Beam['draw']>;
  let tupletDraw: MockInstance<Tuplet['draw']>;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => ({ width: 10 }),
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    beamDraw = vi.spyOn(Beam.prototype, 'draw');
    tupletDraw = vi.spyOn(Tuplet.prototype, 'draw');
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  const BEAT_WIDTH = 369; // Sextuplet eighths ~123 px apart, as in the reported screenshot

  /** A 4/4 bar: a two-beat tuplet group of `keys`, then two quarter-note b/4s. */
  function tupletMeasure(keys: string[], duration: '8' | '16'): MeasureData {
    const groupBeats = duration === '8' ? 2 : 1;
    const step = groupBeats / keys.length;
    const notes: NoteData[] = keys.map((key, i) => ({
      keys: [key],
      duration,
      isRest: false,
      isTuplet: true,
      tupletGroup: 0,
      tupletNumNotes: keys.length,
      tupletNotesOccupied: 4,
      beatOffset: i * step,
      beatDuration: step,
    }));
    for (let beat = groupBeats; beat < 4; beat++) {
      notes.push({ keys: ['b/4'], duration: 'q', isRest: false, beatOffset: beat, beatDuration: 1 });
    }
    return {
      index: 0,
      notes,
      clef: 'treble',
      timeSignature: '4/4',
      beatsPerMeasure: 4,
      beatValue: 4,
      beatWidth: BEAT_WIDTH,
      width: NOTE_START_OFFSET + 4 * BEAT_WIDTH,
      startBeat: 0,
    };
  }

  function drawnTuplets(): { location: number; box: { top: number; bottom: number } }[] {
    return (tupletDraw.mock.contexts as Tuplet[]).map((tuplet) => {
      const { location } = (tuplet as unknown as { options: { location: number } }).options;
      return { location, box: tupletNumberBox(tuplet.getYPosition(), location) };
    });
  }

  function expectBeamsInsideCanvas(): void {
    for (const beam of beamDraw.mock.contexts as Beam[]) {
      const notes = beam.getNotes();
      const span = notes[notes.length - 1].getStemX() - notes[0].getStemX();
      expect(Math.abs(beam.slope * span)).toBeLessThanOrEqual(MAX_BEAM_RISE + 1e-6);
      for (const note of notes) {
        const tipY = note.getStemExtents().topY;
        expect(tipY).toBeGreaterThanOrEqual(NOTATION_CANVAS_MARGIN);
        expect(tipY).toBeLessThanOrEqual(MEASURE_CANVAS_HEIGHT - NOTATION_CANVAS_MARGIN);
      }
    }
  }

  function expectTupletNumbersInsideCanvas(): void {
    for (const { box } of drawnTuplets()) {
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.bottom).toBeLessThanOrEqual(MEASURE_CANVAS_HEIGHT);
    }
  }

  it('caps the slant of the reported sextuplet beam and keeps its "6" above it, on canvas', () => {
    new MeasureRenderer().renderMeasure(tupletMeasure(['a/4', 'f/4', 'g/5', 'f/4', 'f/3', 'a/3'], '8'), 'light', 'solfege');
    expect(beamDraw).toHaveBeenCalledTimes(1);
    expectBeamsInsideCanvas();
    const [tuplet] = drawnTuplets();
    expect(tuplet.location).toBe(Tuplet.LOCATION_TOP);
    expectTupletNumbersInsideCanvas();
  });

  it('flattens a beam forced past the canvas top and moves its number below the noteheads', () => {
    new MeasureRenderer().renderMeasure(tupletMeasure(['e/3', 'e/3', 'g/6', 'e/3', 'e/3', 'e/3'], '16'), 'light', 'solfege');
    expect((beamDraw.mock.contexts as Beam[])[0].slope).toBe(0);
    expectBeamsInsideCanvas();
    const [tuplet] = drawnTuplets();
    expect(tuplet.location).toBe(Tuplet.LOCATION_BOTTOM);
    expectTupletNumbersInsideCanvas();
  });

  for (const ts of ['4/4', '3/4', '2/4', '6/8'] as const) {
    it(`keeps every beam and tuplet number of generated ${ts} measures on canvas`, () => {
      const renderer = new MeasureRenderer();
      for (const clef of ['treble', 'bass'] as const) {
        for (const cell of TUPLET_SUPPORT[ts]) {
          const [name, value] = cell.split(':') as [TupletName, TupletValue];
          const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
          tuplets[name][value] = true;
          const settings: AppSettings = {
            ...structuredClone(DEFAULT_APP_SETTINGS),
            timeSignature: ts,
            clef,
            ledgerLines: { above: MAX_LEDGER_LINES, below: MAX_LEDGER_LINES },
            subdivisions: { ...DEFAULT_APP_SETTINGS.subdivisions, sixteenth: true, thirtySecond: true },
            intervals: Object.fromEntries(
              Object.keys(DEFAULT_APP_SETTINGS.intervals).map((k) => [k, true])
            ) as unknown as IntervalOptions,
            tuplets,
            rests: true,
            ties: true,
          };
          const generator = new MusicGenerator();
          for (let m = 0; m < 50; m++) {
            beamDraw.mockClear();
            tupletDraw.mockClear();
            renderer.renderMeasure(generator.generateMeasure(m, settings, m * 6), 'light', 'solfege');
            expectBeamsInsideCanvas();
            expectTupletNumbersInsideCanvas();
          }
        }
      }
    });
  }
});

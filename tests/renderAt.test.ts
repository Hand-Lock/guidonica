import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FixedViewport, ScrollerView } from '../src/scroller/scroller';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import { mulberry32 } from '../src/notation/random';
import { beatX } from '../src/notation/spacing';
import type { MetronomeEngine } from '../src/audio/metronome';
import type { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  MeasureData,
  NOTE_START_OFFSET,
  PAGE_LEFT_MARGIN,
  RenderedMeasure,
  TimeSignature,
  computeBeatWidth,
  secondsPerBeat,
} from '../src/notation/types';

vi.mock('../src/notation/fonts', () => ({ isMusicFontReady: () => true }));

type Call = [string, ...unknown[]];

/** Source canvases by what they hold, so two scrollers' blits compare by content. */
const labels = new WeakMap<object, string>();
const recorders = new WeakMap<object, Call[]>();

function recordingContext(calls: Call[]): CanvasRenderingContext2D {
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      calls.push([name, ...args]);
    };
  return {
    save: record('save'),
    restore: record('restore'),
    scale: record('scale'),
    translate: record('translate'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
    fill: record('fill'),
    closePath: record('closePath'),
    drawImage: (source: object, ...rest: unknown[]): void => {
      calls.push(['drawImage', labels.get(source) ?? 'unknown', ...rest]);
    },
    createLinearGradient: () => ({ addColorStop: (): void => {} }),
  } as unknown as CanvasRenderingContext2D;
}

interface Stage {
  scroller: ScrollerView;
  buffer: MeasureBuffer;
  canvas: HTMLCanvasElement;
  calls: Call[];
  playheadX: number;
  /** Every pixel ratio the scroller handed the renderer. */
  dprs: number[];
}

function makeStage(
  settings: AppSettings,
  metronome: MetronomeEngine,
  seed: number,
  viewport?: FixedViewport
): Stage {
  const parent = document.createElement('main');
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  parent.getBoundingClientRect = () => ({ width: 1000, height: 500 }) as DOMRect;

  const dprs: number[] = [];
  const renderer = {
    renderMeasure: (data: MeasureData): RenderedMeasure => {
      const measureCanvas = document.createElement('canvas');
      labels.set(measureCanvas, `m${data.index}@${data.startBeat}:${JSON.stringify(data.notes)}`);
      // CSS width at the zoom, as the real renderer returns it
      return { data, canvas: measureCanvas, width: data.width * (settings.zoom || 1), height: 1 };
    },
    setDpr: (dpr: number) => {
      dprs.push(dpr);
    },
    renderPinnedClef: () => {
      const clef = document.createElement('canvas');
      labels.set(clef, 'clef');
      return clef;
    },
    systemHeaderWidth: (_clef: string, ts: string | null) => (ts ? 60 : 40),
    renderSystemHeader: (clef: string, ts: string | null) => {
      const header = document.createElement('canvas');
      labels.set(header, `header:${clef}:${ts}`);
      return { canvas: header, width: ts ? 60 : 40 };
    },
  } as unknown as MeasureRenderer;
  const buffer = new MeasureBuffer(new MusicGenerator(mulberry32(seed)), renderer, () => null);
  const scroller = new ScrollerView(canvas, buffer, metronome, renderer, () => settings, { viewport });
  const calls = recorders.get(canvas) ?? [];
  const playheadX = (scroller as unknown as { playheadX: number }).playheadX;
  return { scroller, buffer, canvas, calls, playheadX, dprs };
}

/** A rising, irregular beat sequence to about 40 beats. */
function beatSequence(): number[] {
  const steps = [0.37, 1.13, 0.5, 2.25, 0.01, 3, 0.875];
  const beats: number[] = [];
  for (let b = 0, i = 0; b < 40; b += steps[i++ % steps.length]) beats.push(b);
  return beats;
}

const throwingMetronome = {
  getVisualBeat: () => {
    throw new Error('renderAt must not read the metronome');
  },
} as unknown as MetronomeEngine;

const CASES: Array<{ timeSignature: TimeSignature; zoom: number }> = [
  { timeSignature: '4/4', zoom: 1 },
  { timeSignature: '6/8', zoom: 0.6 },
  { timeSignature: '3/2', zoom: 1.4 },
];

describe('Drawing a frame at an explicit beat (ADR 0103 seam 2)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const requestIdle = vi.fn();

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      const calls: Call[] = [];
      recorders.set(this, calls);
      return recordingContext(calls);
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    requestIdle.mockClear();
    vi.stubGlobal('requestIdleCallback', requestIdle);
    vi.stubGlobal('cancelIdleCallback', () => {});
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  it.each(CASES)('draws the same frames as the live loop ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom };
    let liveBeat = 0;
    const live = makeStage(settings, { getVisualBeat: () => liveBeat } as unknown as MetronomeEngine, 7);
    const offline = makeStage(settings, throwingMetronome, 7);

    for (const beat of beatSequence()) {
      liveBeat = beat;
      live.calls.length = 0;
      offline.calls.length = 0;
      live.scroller.renderFrame();
      offline.scroller.renderAt(beat);
      expect(offline.calls).toEqual(live.calls);
      expect(offline.calls.some((c) => c[0] === 'drawImage' && String(c[1]).startsWith('m'))).toBe(true);
    }
    live.scroller.destroy();
    offline.scroller.destroy();
  });

  it.each(CASES)('is self-contained and bounded ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom };
    const { scroller, buffer, playheadX } = makeStage(settings, throwingMetronome, 11);
    const onFrame = vi.fn();
    scroller.onFrame(onFrame);

    const beatWidth = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
    const pxPerBeat = beatWidth * scroller.getZoom();
    const edgeBeats = (scroller.getViewportWidth() - playheadX) / pxPerBeat;
    const behindBeats = playheadX / pxPerBeat + 2;

    for (const beat of beatSequence()) {
      scroller.renderAt(beat);
      expect(buffer.getEndBeat()).toBeGreaterThanOrEqual(beat + edgeBeats + 1);
      const measures = buffer.getMeasures();
      // Evicted behind the playhead: nothing ends before the left margin
      for (const m of measures) {
        expect(m.data.startBeat + m.data.beatsPerMeasure).toBeGreaterThanOrEqual(beat - behindBeats);
      }
      const bpm = measures[0].data.beatsPerMeasure;
      expect(measures.length).toBeLessThanOrEqual(Math.ceil((behindBeats + edgeBeats + 1) / bpm) + 2);
    }
    expect(onFrame).not.toHaveBeenCalled();
    expect(requestIdle).not.toHaveBeenCalled();
    scroller.destroy();
  });

  it("blits a measure at the note start offset when the beat is the measure's start", () => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), zoom: 0.8 };
    const { scroller, buffer, calls, playheadX } = makeStage(settings, throwingMetronome, 3);
    scroller.renderAt(0);
    const target = buffer.getMeasures()[1].data;
    calls.length = 0;
    scroller.renderAt(target.startBeat);
    const blit = calls.find((c) => c[0] === 'drawImage' && String(c[1]).startsWith(`m${target.index}@`));
    expect(blit?.[6]).toBeCloseTo(playheadX - NOTE_START_OFFSET * scroller.getZoom(), 9);
    scroller.destroy();
  });

  it.each(CASES)('keeps the squishy tape on the playhead at every beat, bars edge to edge ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom, view: 'squishy' };
    settings.subdivisions.sixteenth = true;
    settings.tuplets.triplet['1/8'] = timeSignature !== '6/8';
    const { scroller, buffer, calls, playheadX } = makeStage(settings, throwingMetronome, 17);
    const z = scroller.getZoom();
    const width = scroller.getViewportWidth();
    for (const beat of beatSequence()) {
      calls.length = 0;
      scroller.renderAt(beat);
      const blits = calls.filter((c) => c[0] === 'drawImage' && String(c[1]).startsWith('m'));
      const xs = new Map(blits.map((c) => [String(c[1]).split('@')[0], c[6] as number]));
      const measures = buffer.getMeasures();
      const here = measures.find((m) => m.data.startBeat <= beat && beat < m.data.startBeat + m.data.beatsPerMeasure);
      expect(here).toBeDefined();
      if (!here) continue;
      const d = here.data;
      // The tape point for this beat sits on the playhead, whatever the bar's spacing
      const x = xs.get(`m${d.index}`);
      expect(x).toBeDefined();
      expect((x ?? 0) + beatX(d, d.timeSignature, beat - d.startBeat) * z).toBeCloseTo(playheadX, 6);
      // Consecutive bars touch, and the drawn tape reaches the right edge
      const drawn = measures.filter((m) => xs.has(`m${m.data.index}`));
      for (let i = 1; i < drawn.length; i++) {
        const left = xs.get(`m${drawn[i - 1].data.index}`) ?? 0;
        expect(xs.get(`m${drawn[i].data.index}`)).toBeCloseTo(left + drawn[i - 1].data.width * z, 6);
      }
      const last = drawn[drawn.length - 1];
      expect((xs.get(`m${last.data.index}`) ?? 0) + last.data.width * z).toBeGreaterThanOrEqual(width);
      // Nothing kept lies wholly left of the stage
      const first = measures[0];
      const firstX = xs.get(`m${first.data.index}`);
      expect(firstX === undefined ? -Infinity : firstX + first.data.width * z).toBeGreaterThanOrEqual(0);
    }
    expect(requestIdle).not.toHaveBeenCalled();
    scroller.destroy();
  });

  it('keeps the note under the playhead when the view switches mid-bar', () => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), zoom: 1 };
    settings.subdivisions.sixteenth = true;
    const { scroller, buffer, calls, playheadX } = makeStage(settings, throwingMetronome, 23);
    const beat = 9.5;
    scroller.renderAt(beat);
    const before = new Map(buffer.getMeasures().map((m) => [m.data.index, m.data.notes]));
    settings.view = 'squishy';
    buffer.rerender(settings);
    calls.length = 0;
    scroller.renderAt(beat);
    for (const m of buffer.getMeasures()) {
      if (before.has(m.data.index)) expect(m.data.notes).toBe(before.get(m.data.index));
    }
    const d = buffer.getMeasures().find((m) => m.data.startBeat <= beat && beat < m.data.startBeat + 4)?.data;
    const blit = calls.find((c) => c[0] === 'drawImage' && String(c[1]).startsWith(`m${d?.index}@`));
    expect(d && (blit?.[6] as number) + beatX(d, '4/4', beat - d.startBeat)).toBeCloseTo(playheadX, 6);
    scroller.destroy();
  });

  it.each(CASES)('draws the same page frames as the live loop ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom, view: 'page' };
    let liveBeat = 0;
    const live = makeStage(settings, { getVisualBeat: () => liveBeat } as unknown as MetronomeEngine, 7);
    const offline = makeStage(settings, throwingMetronome, 7);
    for (const beat of beatSequence()) {
      liveBeat = beat;
      live.calls.length = 0;
      offline.calls.length = 0;
      live.scroller.renderFrame();
      offline.scroller.renderAt(beat);
      expect(offline.calls).toEqual(live.calls);
      expect(offline.calls.some((c) => c[0] === 'drawImage' && String(c[1]).startsWith('header:'))).toBe(true);
    }
    live.scroller.destroy();
    offline.scroller.destroy();
  });

  it.each(CASES)('puts the page cursor on each note at its click ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom, view: 'page' };
    settings.subdivisions.sixteenth = true;
    const { scroller, buffer, calls } = makeStage(settings, throwingMetronome, 19);
    const z = scroller.getZoom();
    scroller.renderAt(0);
    const systems = buffer.getSystems().slice(0, 3);
    const bars = buffer.getMeasures().slice();
    expect(systems.length).toBe(3);
    let pos = 0;
    for (const system of systems) {
      for (let i = pos; i < pos + system.count; i++) {
        const d = bars[i].data;
        for (const note of d.notes) {
          const beat = d.startBeat + note.beatOffset;
          calls.length = 0;
          scroller.renderAt(beat);
          // The bar's blit x plus beatX into it: the cursor sits on the notehead's x
          const blit = calls.find((c) => c[0] === 'drawImage' && String(c[1]).startsWith(`m${d.index}@`));
          expect(blit).toBeDefined();
          const noteX = (blit?.[6] as number) + beatX(d, d.timeSignature, note.beatOffset) * z;
          const cursor = calls.find((c) => c[0] === 'translate');
          expect(cursor?.[1] as number).toBeCloseTo(Math.round(noteX) + 0.5, 6);
          const offset = (PAGE_LEFT_MARGIN + system.header) * z;
          expect(noteX).toBeGreaterThanOrEqual(offset + NOTE_START_OFFSET * z - 1e-6);
        }
      }
      pos += system.count;
    }
    // Pure in the beat: drawn twice, a frame is identical
    calls.length = 0;
    scroller.renderAt(5.25);
    const first = calls.slice();
    calls.length = 0;
    scroller.renderAt(5.25);
    expect(calls).toEqual(first);
    expect(requestIdle).not.toHaveBeenCalled();
    scroller.destroy();
  });

  it('hides the page cursor and wash with the playhead off', () => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), view: 'page', showPlayhead: false };
    const { scroller, calls } = makeStage(settings, throwingMetronome, 3);
    scroller.renderAt(2.5);
    expect(calls.some((c) => c[0] === 'translate')).toBe(false);
    scroller.destroy();
  });

  it('keeps a fixed viewport whatever the window and parent measure (ADR 0103 seam 4)', () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    const observer = vi.fn();
    vi.stubGlobal('ResizeObserver', observer);
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), zoom: 1 };
    // The parent reports 1000 × 500, which the fixed viewport overrides
    const { scroller, canvas, playheadX, dprs } = makeStage(settings, throwingMetronome, 5, {
      width: 1920,
      height: 1080,
      dpr: 1,
    });
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(scroller.getViewportWidth()).toBe(1920);
    expect(playheadX).toBe(Math.round(1920 * 0.22));
    expect(dprs).toEqual([1]);
    expect(addListener).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();

    scroller.setZoom(0.5);
    expect(canvas.width).toBe(1920);
    expect(dprs).toEqual([1, 1]);
    scroller.destroy();
    addListener.mockRestore();
  });

  it('sizes the canvas by the fixed pixel ratio', () => {
    const settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
    const { scroller, canvas, dprs } = makeStage(settings, throwingMetronome, 5, { width: 640, height: 360, dpr: 3 });
    expect(canvas.width).toBe(1920);
    expect(canvas.height).toBe(1080);
    expect(canvas.style.width).toBe('640px');
    expect(dprs).toEqual([3]);
    scroller.destroy();
  });

  it.each(CASES)('draws the same frames at a fixed viewport as on a window of that size ($timeSignature, zoom $zoom)', ({ timeSignature, zoom }) => {
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature, zoom };
    const windowed = makeStage(settings, throwingMetronome, 13);
    const fixed = makeStage(settings, throwingMetronome, 13, { width: 1000, height: 500, dpr: window.devicePixelRatio || 1 });
    expect(fixed.playheadX).toBe(windowed.playheadX);
    for (const beat of beatSequence()) {
      windowed.calls.length = 0;
      fixed.calls.length = 0;
      windowed.scroller.renderAt(beat);
      fixed.scroller.renderAt(beat);
      expect(fixed.calls).toEqual(windowed.calls);
    }
    windowed.scroller.destroy();
    fixed.scroller.destroy();
  });

  it('converts tempo to seconds per beat with the meter factor', () => {
    expect(secondsPerBeat(60, '4/4')).toBe(1);
    expect(secondsPerBeat(120, '3/4')).toBe(0.5);
    expect(secondsPerBeat(60, '6/8')).toBe(0.5);
    expect(secondsPerBeat(90, '12/8')).toBeCloseTo(1 / 3, 12);
    expect(secondsPerBeat(60, '2/2')).toBe(1);
    expect(secondsPerBeat(60, '6/4')).toBe(1);
  });
});

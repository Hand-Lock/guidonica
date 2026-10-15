import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollerView } from '../src/scroller/scroller';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import { mulberry32 } from '../src/notation/random';
import type { MetronomeEngine } from '../src/audio/metronome';
import type { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  MeasureData,
  NOTE_START_OFFSET,
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
  calls: Call[];
  playheadX: number;
}

function makeStage(settings: AppSettings, metronome: MetronomeEngine, seed: number): Stage {
  const parent = document.createElement('main');
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  parent.getBoundingClientRect = () => ({ width: 1000, height: 500 }) as DOMRect;

  const renderer = {
    renderMeasure: (data: MeasureData): RenderedMeasure => {
      const measureCanvas = document.createElement('canvas');
      labels.set(measureCanvas, `m${data.index}@${data.startBeat}:${JSON.stringify(data.notes)}`);
      return { data, canvas: measureCanvas, width: data.width, height: 1 };
    },
    setDpr: () => {},
    renderPinnedClef: () => {
      const clef = document.createElement('canvas');
      labels.set(clef, 'clef');
      return clef;
    },
  } as unknown as MeasureRenderer;
  const buffer = new MeasureBuffer(new MusicGenerator(mulberry32(seed)), renderer);
  const scroller = new ScrollerView(canvas, buffer, metronome, renderer, () => settings);
  const calls = recorders.get(canvas) ?? [];
  const playheadX = (scroller as unknown as { playheadX: number }).playheadX;
  return { scroller, buffer, calls, playheadX };
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

  it('converts tempo to seconds per beat with the meter factor', () => {
    expect(secondsPerBeat(60, '4/4')).toBe(1);
    expect(secondsPerBeat(120, '3/4')).toBe(0.5);
    expect(secondsPerBeat(60, '6/8')).toBe(0.5);
    expect(secondsPerBeat(90, '12/8')).toBeCloseTo(1 / 3, 12);
    expect(secondsPerBeat(60, '2/2')).toBe(1);
    expect(secondsPerBeat(60, '6/4')).toBe(1);
  });
});

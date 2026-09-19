import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Clef,
  MEASURE_CANVAS_HEIGHT,
  MIN_PLAYHEAD_X,
  PINNED_HEADER_FADE_WIDTH,
  PINNED_HEADER_MASK_WIDTH,
  PINNED_HEADER_OFFSET_X,
  PINNED_HEADER_TOTAL_MARGIN,
  PINNED_HEADER_WIDTH,
  PLAYHEAD_MIN_CLEARANCE,
  TimeSignature,
} from '../src/notation/types';
import { MeasureRenderer } from '../src/notation/renderer';

describe('Stationary Clef and Time Signature Left Stave Header', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (contextId: string) {
      if (contextId === '2d') {
        return {
          scale: () => {},
          fillRect: () => {},
          clearRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          stroke: () => {},
          fill: () => {},
          closePath: () => {},
          save: () => {},
          restore: () => {},
          setTransform: () => {},
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          fillText: () => {},
          measureText: () => ({ width: 10 }),
          drawImage: () => {},
          createLinearGradient: () => ({ addColorStop: () => {} }),
          arc: () => {},
          bezierCurveTo: () => {},
          quadraticCurveTo: () => {},
          rect: () => {},
          setLineDash: () => {},
          getLineDash: () => [],
          canvas: this,
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    };
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('validates mathematical consistency of pinned header layout constants', () => {
    expect(PINNED_HEADER_TOTAL_MARGIN).toBe(PINNED_HEADER_MASK_WIDTH + PINNED_HEADER_FADE_WIDTH);
    expect(MIN_PLAYHEAD_X).toBe(PINNED_HEADER_TOTAL_MARGIN + PLAYHEAD_MIN_CLEARANCE);
    expect(PINNED_HEADER_MASK_WIDTH).toBeGreaterThan(PINNED_HEADER_OFFSET_X);
    expect(MIN_PLAYHEAD_X).toBeGreaterThan(PINNED_HEADER_TOTAL_MARGIN);
  });

  it('preserves backwards compatibility when renderPinnedClef is called without time signature', () => {
    const renderer = new MeasureRenderer();
    const canvasDefault = renderer.renderPinnedClef('treble', 'light');
    const canvasExplicit = renderer.renderPinnedClef('treble', '4/4', 'light');
    const canvasHeader = renderer.renderPinnedHeader('treble', '4/4', 'light');

    expect(canvasDefault.width).toBe(PINNED_HEADER_WIDTH);
    expect(canvasDefault.height).toBe(MEASURE_CANVAS_HEIGHT);
    expect(canvasExplicit.width).toBe(PINNED_HEADER_WIDTH);
    expect(canvasHeader.width).toBe(PINNED_HEADER_WIDTH);
  });

  it('correctly rasterizes all combinations of clefs and time signatures', () => {
    const renderer = new MeasureRenderer();
    const clefs: Clef[] = [
      'treble',
      'soprano',
      'mezzo-soprano',
      'alto',
      'tenor',
      'baritone-f',
      'baritone-c',
      'bass',
    ];
    const timeSignatures: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];

    for (const clef of clefs) {
      for (const ts of timeSignatures) {
        const lightCanvas = renderer.renderPinnedHeader(clef, ts, 'light');
        const darkCanvas = renderer.renderPinnedHeader(clef, ts, 'dark');

        expect(lightCanvas.width).toBe(PINNED_HEADER_WIDTH);
        expect(lightCanvas.height).toBe(MEASURE_CANVAS_HEIGHT);
        expect(darkCanvas.width).toBe(PINNED_HEADER_WIDTH);
        expect(darkCanvas.height).toBe(MEASURE_CANVAS_HEIGHT);
      }
    }
  });

  it('scales offscreen header canvas dimensions proportionally with zoom and DPR', () => {
    const renderer = new MeasureRenderer();
    renderer.setDpr(2);

    renderer.setZoom(1.0);
    const canvas100 = renderer.renderPinnedHeader('bass', '3/4', 'dark');
    expect(canvas100.width).toBe(PINNED_HEADER_WIDTH * 2 * 1.0);
    expect(canvas100.height).toBe(MEASURE_CANVAS_HEIGHT * 2 * 1.0);

    renderer.setZoom(0.5);
    const canvas50 = renderer.renderPinnedHeader('bass', '3/4', 'dark');
    expect(canvas50.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 2 * 0.5));
    expect(canvas50.height).toBe(Math.floor(MEASURE_CANVAS_HEIGHT * 2 * 0.5));

    renderer.setZoom(1.25);
    const canvas125 = renderer.renderPinnedHeader('alto', '6/8', 'light');
    expect(canvas125.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 2 * 1.25));
    expect(canvas125.height).toBe(Math.floor(MEASURE_CANVAS_HEIGHT * 2 * 1.25));
  });
});

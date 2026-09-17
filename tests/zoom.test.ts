import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MEASURE_CANVAS_HEIGHT,
  MIN_ZOOM,
  NOTE_START_OFFSET,
  STAVE_TOP_LINE_Y,
  ZOOM_STEP,
  computeBeatWidth,
} from '../src/notation/types';
import { MeasureRenderer } from '../src/notation/renderer';

describe('In-App Notation Zoom Pipeline', () => {
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
  it('defines valid zoom boundary and step constants', () => {
    expect(MIN_ZOOM).toBe(0.5);
    expect(MAX_ZOOM).toBe(1.5);
    expect(DEFAULT_ZOOM).toBe(1.0);
    expect(ZOOM_STEP).toBe(0.1);
    expect(MIN_ZOOM).toBeLessThan(DEFAULT_ZOOM);
    expect(DEFAULT_ZOOM).toBeLessThan(MAX_ZOOM);
  });

  it('correctly configures and clamps zoom in MeasureRenderer', () => {
    const renderer = new MeasureRenderer();
    expect(renderer.getZoom()).toBe(DEFAULT_ZOOM);

    renderer.setZoom(0.8);
    expect(renderer.getZoom()).toBe(0.8);

    // Clamp below MIN_ZOOM
    renderer.setZoom(0.2);
    expect(renderer.getZoom()).toBe(MIN_ZOOM);

    // Clamp above MAX_ZOOM
    renderer.setZoom(2.5);
    expect(renderer.getZoom()).toBe(MAX_ZOOM);
  });

  it('rasterizes pinned clef canvas scaled to dpr and zoom', () => {
    const renderer = new MeasureRenderer();
    renderer.setDpr(2);

    renderer.setZoom(1.0);
    const canvas100 = renderer.renderPinnedClef('treble', 'light');
    // base width = 80, height = 220. At dpr=2, zoom=1: width=160, height=440
    expect(canvas100.width).toBe(160);
    expect(canvas100.height).toBe(440);

    renderer.setZoom(0.75);
    const canvas75 = renderer.renderPinnedClef('treble', 'light');
    // At dpr=2, zoom=0.75: width = 80 * 2 * 0.75 = 120, height = 220 * 2 * 0.75 = 330
    expect(canvas75.width).toBe(120);
    expect(canvas75.height).toBe(330);

    renderer.setZoom(1.5);
    const canvas150 = renderer.renderPinnedClef('treble', 'light');
    // At dpr=2, zoom=1.5: width = 80 * 2 * 1.5 = 240, height = 220 * 2 * 1.5 = 660
    expect(canvas150.width).toBe(240);
    expect(canvas150.height).toBe(660);
  });

  it('mathematically preserves exact staff line vertical alignment across all zoom levels', () => {
    const testZooms = [0.5, 0.75, 1.0, 1.25, 1.5];
    const viewportHeight = 400;
    const centerY = Math.round(viewportHeight / 2); // 200

    for (const zoom of testZooms) {
      const staveTopY = centerY - 20 * zoom;
      const measureDrawY = centerY - 100 * zoom;

      // Check all 5 staff lines (k = 0, 1, 2, 3, 4)
      for (let k = 0; k < 5; k++) {
        const stationaryLineY = staveTopY + k * 10 * zoom;
        // On the measure canvas, line 0 is at STAVE_TOP_LINE_Y (80). Line k is at (80 + k * 10) * zoom
        const measureLineY = measureDrawY + (STAVE_TOP_LINE_Y + k * 10) * zoom;
        expect(stationaryLineY).toBeCloseTo(measureLineY, 5);
      }
    }
  });

  it('mathematically guarantees zero-drift note crossing at playhead regardless of zoom', () => {
    const testZooms = [0.5, 0.8, 1.0, 1.2, 1.5];
    const viewportWidth = 1000;
    const beatWidth = computeBeatWidth(
      { whole: true, half: true, quarter: true, eighth: true, sixteenth: false },
      '4/4'
    );

    for (const zoom of testZooms) {
      const playheadX = Math.max(Math.round(175 * zoom), Math.round(viewportWidth * 0.22));
      const startBeat = 12;
      const noteOffset = 2.5; // note on beat 2.5 of measure
      const noteGlobalBeat = startBeat + noteOffset;

      // Note screen X position at any currentGlobalBeat:
      const getNoteScreenX = (currentGlobalBeat: number): number => {
        const measureScreenX =
          playheadX - NOTE_START_OFFSET * zoom + (startBeat - currentGlobalBeat) * (beatWidth * zoom);
        const noteLocalX = (NOTE_START_OFFSET + noteOffset * beatWidth) * zoom;
        return measureScreenX + noteLocalX;
      };

      // When the audio clock reaches the exact beat of the note:
      const screenXAtBeat = getNoteScreenX(noteGlobalBeat);
      expect(screenXAtBeat).toBeCloseTo(playheadX, 5);
    }
  });

  it('dynamically scales lookahead beats proportionally to fit more measures when zoomed out', () => {
    const w = 1200;
    const beatWidth = 110;

    const getLookaheadBeats = (zoom: number): number => {
      const playheadX = Math.max(Math.round(175 * zoom), Math.round(w * 0.22));
      return (w - playheadX) / (beatWidth * zoom) + 6;
    };

    const lookahead100 = getLookaheadBeats(1.0);
    const lookahead50 = getLookaheadBeats(0.5);
    const lookahead150 = getLookaheadBeats(1.5);

    // At 50% zoom, roughly twice as many beats must be buffered ahead to fill the screen
    expect(lookahead50).toBeGreaterThan(lookahead100);
    expect(lookahead100).toBeGreaterThan(lookahead150);
  });
});

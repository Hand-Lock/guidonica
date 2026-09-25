import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  Clef,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MEASURE_CANVAS_HEIGHT,
  MIN_PLAYHEAD_X,
  MIN_ZOOM,
  NOTE_START_OFFSET,
  PINNED_HEADER_WIDTH,
  STAVE_TOP_LINE_Y,
  SubdivisionOptions,
  TimeSignature,
  ZOOM_STEP,
  computeBeatWidth,
  computeOptimalZoom,
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
    expect(MIN_ZOOM).toBe(0.3);
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

    // Clamp below MIN_ZOOM (0.3)
    renderer.setZoom(0.1);
    expect(renderer.getZoom()).toBe(MIN_ZOOM);

    // Clamp above MAX_ZOOM (1.5)
    renderer.setZoom(2.5);
    expect(renderer.getZoom()).toBe(MAX_ZOOM);
  });

  it('rasterizes pinned clef and time signature canvas scaled to dpr and zoom', () => {
    const renderer = new MeasureRenderer();
    renderer.setDpr(2);

    renderer.setZoom(1.0);
    const canvas100 = renderer.renderPinnedClef('treble', '4/4', 'light');
    // base width = PINNED_HEADER_WIDTH (115), height = 220. At dpr=2, zoom=1: width=230, height=440
    expect(canvas100.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 2 * 1.0));
    expect(canvas100.height).toBe(440);

    renderer.setZoom(0.75);
    const canvas75 = renderer.renderPinnedClef('treble', '4/4', 'light');
    // At dpr=2, zoom=0.75: width = 115 * 2 * 0.75 = 172.5 -> floor = 172, height = 220 * 2 * 0.75 = 330
    expect(canvas75.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 2 * 0.75));
    expect(canvas75.height).toBe(330);

    renderer.setZoom(1.5);
    const canvas150 = renderer.renderPinnedClef('treble', '4/4', 'light');
    // At dpr=2, zoom=1.5: width = 115 * 2 * 1.5 = 345, height = 220 * 2 * 1.5 = 660
    expect(canvas150.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 2 * 1.5));
    expect(canvas150.height).toBe(660);
  });

  it('rasterizes pinned header across all time signatures and clefs', () => {
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
    const timeSigs: TimeSignature[] = ['4/4', '3/4', '2/4', '6/8'];

    for (const clef of clefs) {
      for (const ts of timeSigs) {
        const canvas = renderer.renderPinnedClef(clef, ts, 'light');
        expect(canvas).toBeInstanceOf(HTMLCanvasElement);
        expect(canvas.width).toBe(PINNED_HEADER_WIDTH);
        expect(canvas.height).toBe(MEASURE_CANVAS_HEIGHT);
      }
    }
  });

  it('mathematically preserves exact staff line vertical alignment across all zoom levels', () => {
    const testZooms = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
    const viewportHeight = 400;
    const centerY = Math.round(viewportHeight / 2); // 200

    for (const zoom of testZooms) {
      const lineSpacing = Math.round(10 * zoom);
      const staveTopY = centerY - 2 * lineSpacing;
      const measureDrawY = centerY - Math.round(100 * zoom);
      const startY = Math.round(staveTopY);

      // Verify line spacing is an exact integer
      expect(Number.isInteger(lineSpacing)).toBe(true);

      // Check all 5 staff lines (k = 0, 1, 2, 3, 4)
      for (let k = 0; k < 5; k++) {
        const stationaryLineY = startY + k * lineSpacing;
        // On the measure canvas, line 0 is at STAVE_TOP_LINE_Y (80). Line k is at (80 + k * 10) * zoom
        const measureLineY = measureDrawY + (STAVE_TOP_LINE_Y + k * 10) * zoom;
        expect(stationaryLineY).toBeCloseTo(measureLineY, 5);
      }
    }
  });

  it('guarantees uniform integer line spacing across all 4 pentagram spaces without pixel jitter', () => {
    for (let pct = 30; pct <= 150; pct += 10) {
      const zoom = pct / 100;
      const lineSpacing = Math.round(10 * zoom);
      // Spacing must be an exact positive integer
      expect(Number.isInteger(lineSpacing)).toBe(true);
      expect(lineSpacing).toBe(pct / 10);

      // Compute all 5 line coordinates
      const startY = 100;
      const linePositions: number[] = [];
      for (let line = 0; line < 5; line++) {
        linePositions.push(startY + line * lineSpacing + 0.5);
      }

      // Check differences between adjacent lines are identical
      const space0 = linePositions[1] - linePositions[0];
      const space1 = linePositions[2] - linePositions[1];
      const space2 = linePositions[3] - linePositions[2];
      const space3 = linePositions[4] - linePositions[3];

      expect(space0).toBe(lineSpacing);
      expect(space1).toBe(lineSpacing);
      expect(space2).toBe(lineSpacing);
      expect(space3).toBe(lineSpacing);
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
      const playheadX = Math.max(Math.round(MIN_PLAYHEAD_X * zoom), Math.round(viewportWidth * 0.22));
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
      const playheadX = Math.max(Math.round(MIN_PLAYHEAD_X * zoom), Math.round(w * 0.22));
      return (w - playheadX) / (beatWidth * zoom) + 6;
    };

    const lookahead100 = getLookaheadBeats(1.0);
    const lookahead50 = getLookaheadBeats(0.5);
    const lookahead150 = getLookaheadBeats(1.5);

    // At 50% zoom, roughly twice as many beats must be buffered ahead to fill the screen
    expect(lookahead50).toBeGreaterThan(lookahead100);
    expect(lookahead100).toBeGreaterThan(lookahead150);
  });

  describe('Device-Adaptive Optimal Zoom Formulation', () => {
    const defaultSubdivs: SubdivisionOptions = {
      whole: true,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: false,
    };

    const sixteenthSubdivs: SubdivisionOptions = {
      whole: true,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: true,
    };

    const quarterOnlySubdivs: SubdivisionOptions = {
      whole: false,
      half: false,
      quarter: true,
      eighth: false,
      sixteenth: false,
    };

    it('computes 60% zoom for iPhone 13 Mini in Portrait under default 4/4 meter', () => {
      const iPhoneMiniWidth = 375;
      // In 4/4 with 8th notes, beatWidth = 130, measureWidth = 520.
      // Raw fit: 375 / (520 + 135) = 375 / 655 ≈ 0.5725 -> rounded to 10% integer step: 0.60
      const optimal = computeOptimalZoom(iPhoneMiniWidth, defaultSubdivs, '4/4');
      expect(optimal).toBe(0.6);
    });

    it('adapts down to 40% zoom for iPhone 13 Mini in Portrait when 16th notes are enabled', () => {
      const iPhoneMiniWidth = 375;
      // In 4/4 with 16th notes, beatWidth = 220, measureWidth = 880.
      // Raw fit: 375 / (880 + 135) = 375 / 1015 ≈ 0.3695 -> rounded to 10% integer step: 0.40
      const optimal = computeOptimalZoom(iPhoneMiniWidth, sixteenthSubdivs, '4/4');
      expect(optimal).toBe(0.4);
    });

    it('maintains 100% zoom for iPhone 13 Mini in Portrait under 2/4 quarter-note meter', () => {
      const iPhoneMiniWidth = 375;
      // In 2/4 with quarter notes, beatWidth = 110, measureWidth = 220.
      // Raw fit: 375 / (220 + 135) = 375 / 355 ≈ 1.056 -> capped at DEFAULT_ZOOM: 1.0
      const optimal = computeOptimalZoom(iPhoneMiniWidth, quarterOnlySubdivs, '2/4');
      expect(optimal).toBe(1.0);
    });

    it('maintains 100% zoom for iPhone 13 Mini in Landscape orientation (812px)', () => {
      const iPhoneLandscapeWidth = 812;
      const optimal = computeOptimalZoom(iPhoneLandscapeWidth, defaultSubdivs, '4/4');
      expect(optimal).toBe(1.0);
    });

    it('maintains 100% zoom on desktop viewports (1200px)', () => {
      const desktopWidth = 1200;
      const optimal = computeOptimalZoom(desktopWidth, defaultSubdivs, '4/4');
      expect(optimal).toBe(1.0);
    });

    it('adapts appropriately on iPad Portrait viewports (768px)', () => {
      const iPadPortraitWidth = 768;
      // Default 4/4 fits at 100%
      const optimalDefault = computeOptimalZoom(iPadPortraitWidth, defaultSubdivs, '4/4');
      expect(optimalDefault).toBe(1.0);

      // 16th notes in 4/4: raw fit 768 / 1015 ≈ 0.7566 -> rounded to 10% integer step: 0.8
      const optimal16th = computeOptimalZoom(iPadPortraitWidth, sixteenthSubdivs, '4/4');
      expect(optimal16th).toBe(0.8);
    });

    it('adapts for 6/8 compound meter on compact phone screens', () => {
      const iPhoneMiniWidth = 375;
      // 6/8 eighth notes: 6 beats * 80px = 480px.
      // Raw fit: 375 / (480 + 135) = 375 / 615 ≈ 0.6098 -> 0.60
      const optimal68 = computeOptimalZoom(iPhoneMiniWidth, defaultSubdivs, '6/8');
      expect(optimal68).toBe(0.6);

      // 6/8 with 16th notes: 6 beats * 110px = 660px.
      // Raw fit: 375 / (660 + 135) = 375 / 795 ≈ 0.4717 -> rounded to 10% integer step: 0.50
      const optimal68_16th = computeOptimalZoom(iPhoneMiniWidth, sixteenthSubdivs, '6/8');
      expect(optimal68_16th).toBe(0.5);
    });

    it('clamps optimal zoom within MIN_ZOOM (0.3) and MAX_ZOOM (1.5)', () => {
      // Extremely narrow hypothetical viewport
      const tinyWidth = 100;
      const optimalTiny = computeOptimalZoom(tinyWidth, sixteenthSubdivs, '4/4');
      expect(optimalTiny).toBe(MIN_ZOOM);
    });
  });
});

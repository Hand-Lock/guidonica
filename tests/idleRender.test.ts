import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ScrollerView } from '../src/scroller/scroller';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import type { MetronomeEngine } from '../src/audio/metronome';
import type { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { MeasureData, RenderedMeasure, computeBeatWidth } from '../src/notation/types';

vi.mock('../src/notation/fonts', () => ({ isMusicFontReady: () => true }));

describe('VexFlow rendering out of the animation frame (ADR 0091)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const idleCallbacks: Array<() => void> = [];
  const cancelIdle = vi.fn();

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      const noop = (): void => {};
      return {
        save: noop,
        restore: noop,
        scale: noop,
        fillRect: noop,
        beginPath: noop,
        moveTo: noop,
        lineTo: noop,
        stroke: noop,
        fill: noop,
        closePath: noop,
        drawImage: noop,
        createLinearGradient: () => ({ addColorStop: noop }),
      } as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    idleCallbacks.length = 0;
    cancelIdle.mockClear();
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => idleCallbacks.push(cb));
    vi.stubGlobal('cancelIdleCallback', cancelIdle);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
  });

  it('renders only up to the stage edge in the frame and the rest in idle callbacks', () => {
    const parent = document.createElement('main');
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    parent.getBoundingClientRect = () => ({ width: 1000, height: 500 }) as DOMRect;

    const renderMeasure = vi.fn(
      (data: MeasureData): RenderedMeasure => ({
        data,
        canvas: document.createElement('canvas'),
        width: data.width,
        height: 1,
      })
    );
    const renderer = {
      renderMeasure,
      setDpr: () => {},
      renderPinnedClef: () => document.createElement('canvas'),
    } as unknown as MeasureRenderer;
    const buffer = new MeasureBuffer(new MusicGenerator(), renderer);
    const metronome = { getVisualBeat: () => 0 } as unknown as MetronomeEngine;
    const settings = structuredClone(DEFAULT_APP_SETTINGS);
    const scroller = new ScrollerView(canvas, buffer, metronome, renderer, () => settings);

    const playheadX = (scroller as unknown as { playheadX: number }).playheadX;
    const beatWidth = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
    const edgeBeat = (scroller.getViewportWidth() - playheadX) / (beatWidth * scroller.getZoom());

    scroller.renderFrame();
    // The frame covers the stage plus one beat, no further
    expect(buffer.getEndBeat()).toBeGreaterThanOrEqual(edgeBeat + 1);
    expect(buffer.getEndBeat()).toBeLessThan(edgeBeat + 6);
    expect(idleCallbacks).toHaveLength(1);

    // Further frames never queue a second idle render
    scroller.renderFrame();
    expect(idleCallbacks).toHaveLength(1);

    // Each idle callback renders exactly one measure and reschedules while short
    let calls = 0;
    while (calls < idleCallbacks.length) {
      const before = renderMeasure.mock.calls.length;
      idleCallbacks[calls++]();
      expect(renderMeasure.mock.calls.length - before).toBe(1);
    }
    expect(buffer.getEndBeat()).toBeGreaterThanOrEqual(edgeBeat + 6);

    // Once full, frames schedule nothing; a pending render is cancelled by stopLoop
    scroller.renderFrame();
    expect(idleCallbacks).toHaveLength(calls);
    buffer.reset();
    scroller.renderFrame();
    expect(idleCallbacks).toHaveLength(calls + 1);
    scroller.stopLoop();
    expect(cancelIdle).toHaveBeenCalledTimes(1);
    scroller.destroy();
  });
});

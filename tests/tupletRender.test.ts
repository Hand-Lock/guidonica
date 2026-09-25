import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { AppSettings, TUPLET_SUPPORT, TupletName, TupletValue } from '../src/notation/types';

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

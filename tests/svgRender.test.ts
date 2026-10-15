import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { MUSIC_FONT_FAMILY } from '../src/notation/fonts';
import { MusicGenerator } from '../src/notation/generator';
import { mulberry32 } from '../src/notation/random';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  Clef,
  MEASURE_CANVAS_HEIGHT,
  MeasureData,
  PINNED_HEADER_WIDTH,
  TUPLET_SUPPORT,
  TimeSignature,
  TupletName,
  TupletValue,
} from '../src/notation/types';
import en from '../src/i18n/locales/en';

/** One drawn string: VexFlow glyphs and tuplet digits, or a solfège label. */
interface DrawnText {
  text: string;
  x: number;
  y: number;
}

const LABELS = en.noteNames.syllables;
/** Enough metrics for VexFlow to place every glyph (flags read the ascent). */
const TEXT_METRICS = { width: 10, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 4 };
const METERS: TimeSignature[] = ['4/4', '6/8', '3/2', '12/8'];
const CLEFS: Clef[] = ['treble', 'bass'];

/** Eight bars with every rhythm feature the meter allows: ties, dots, rests and its tuplets. */
function measures(timeSignature: TimeSignature, clef: Clef, seed: number): MeasureData[] {
  const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
  for (const cell of TUPLET_SUPPORT[timeSignature]) {
    const [name, value] = cell.split(':') as [TupletName, TupletValue];
    tuplets[name][value] = true;
  }
  const settings: AppSettings = {
    ...structuredClone(DEFAULT_APP_SETTINGS),
    clef,
    timeSignature,
    tuplets,
    rests: true,
    ties: true,
    subdivisions: {
      whole: true,
      half: true,
      quarter: true,
      eighth: true,
      sixteenth: true,
      thirtySecond: true,
      dotted: true,
    },
    solfegeLabelMode: 'syllables',
  };
  const generator = new MusicGenerator(mulberry32(seed));
  const bars: MeasureData[] = [];
  let startBeat = 0;
  for (let m = 0; m < 8; m++) {
    const data = generator.generateMeasure(m, settings, startBeat);
    startBeat += data.beatsPerMeasure;
    bars.push(data);
  }
  return bars;
}

/** The font family a node inherits: VexFlow sets the glyph family on the <svg> root. */
function inheritedFontFamily(node: Element): string {
  for (let el: Element | null = node; el; el = el.parentElement) {
    const family = el.getAttribute('font-family');
    if (family) return family;
  }
  return '';
}

/** Element ids count up across renders (vf-auto123), so outputs compare without them. */
function withoutIds(svg: SVGSVGElement): string {
  return svg.outerHTML.replace(/ id="vf-auto\d+"/g, '');
}

function svgTexts(svg: SVGSVGElement): DrawnText[] {
  return [...svg.querySelectorAll('text')].map((node) => ({
    text: node.textContent ?? '',
    x: Number(node.getAttribute('x')),
    y: Number(node.getAttribute('y')),
  }));
}

function expectSameTexts(svg: DrawnText[], canvas: DrawnText[]): void {
  expect(svg.map((t) => t.text)).toEqual(canvas.map((t) => t.text));
  svg.forEach((t, i) => {
    // VexFlow's SVGContext rounds coordinates to 3 places
    expect(Math.abs(t.x - canvas[i].x)).toBeLessThanOrEqual(1e-3);
    expect(Math.abs(t.y - canvas[i].y)).toBeLessThanOrEqual(1e-3);
  });
}

describe('SVG measure rendering (ADR 0103 seam 4)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let drawn: DrawnText[] = [];

  beforeEach(() => {
    drawn = [];
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => TEXT_METRICS,
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
          fillText: (text: string, x: number, y: number) => {
            // An unlabeled tie fills an empty string, which paints nothing; SVG skips it
            if (text) drawn.push({ text, x, y });
          },
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  let tupletDigits = 0;
  afterAll(() => {
    // The cases cover tuplet numbers, not only notes and rests
    expect(tupletDigits).toBeGreaterThan(0);
  });

  for (const ts of METERS) {
    for (const clef of CLEFS) {
      it(`lays out every glyph and label as the canvas does (${ts}, ${clef})`, () => {
        const renderer = new MeasureRenderer({ dpr: 2, zoom: 1.2 });
        let labelCount = 0;
        for (const data of measures(ts, clef, 5)) {
          drawn = [];
          renderer.renderMeasure(data, 'light', LABELS);
          const canvasTexts = drawn;
          const rendered = renderer.renderMeasureSvg(data, 'light', LABELS);
          expect(canvasTexts.length).toBeGreaterThan(0);
          expectSameTexts(svgTexts(rendered.svg), canvasTexts);

          const { svg } = rendered;
          expect(rendered.data).toBe(data);
          expect(rendered.width).toBeCloseTo(data.width * 1.2, 9);
          expect(rendered.height).toBeCloseTo(MEASURE_CANVAS_HEIGHT * 1.2, 9);
          expect(Number(svg.getAttribute('width'))).toBeCloseTo(data.width * 1.2, 9);
          expect(Number(svg.getAttribute('height'))).toBeCloseTo(MEASURE_CANVAS_HEIGHT * 1.2, 9);
          expect(svg.getAttribute('viewBox')).toBe(`0 0 ${data.width} ${MEASURE_CANVAS_HEIGHT}`);
          expect(svg.getAttribute('overflow')).toBe('hidden');
          expect(svg.parentNode).toBeNull();

          for (const node of svg.querySelectorAll('text')) {
            if (node.getAttribute('text-anchor') === 'middle') {
              labelCount++;
              expect(LABELS).toContain(node.textContent);
              expect(node.getAttribute('dominant-baseline')).toBe('middle');
              expect(node.getAttribute('font-family')).toContain('Alegreya Sans');
              expect(node.getAttribute('font-weight')).toBe('700');
              expect(node.getAttribute('font-size')).toBe('11px');
            } else {
              expect(inheritedFontFamily(node)).toContain(MUSIC_FONT_FAMILY);
              for (const ch of node.textContent ?? '') {
                const code = ch.codePointAt(0) ?? 0;
                if (code >= 0xe880 && code <= 0xe889) tupletDigits++;
              }
            }
          }
        }
        expect(labelCount).toBeGreaterThan(0);
      });
    }
  }

  it('does not depend on the pixel ratio', () => {
    for (const data of measures('6/8', 'treble', 9)) {
      const low = new MeasureRenderer({ dpr: 1, zoom: 0.8 }).renderMeasureSvg(data, 'dark', LABELS);
      const high = new MeasureRenderer({ dpr: 3, zoom: 0.8 }).renderMeasureSvg(data, 'dark', LABELS);
      expect(withoutIds(high.svg)).toBe(withoutIds(low.svg));
    }
  });

  it('draws the pinned header as the canvas does, with and without meter signs', () => {
    const renderer = new MeasureRenderer({ zoom: 0.7 });
    for (const meterSigns of [false, true]) {
      for (const [clef, ts] of [['treble', '4/4'], ['alto', '2/2'], ['bass', null], [null, '12/8']] as const) {
        drawn = [];
        renderer.renderPinnedClef(clef, ts, 'light', meterSigns);
        const canvasTexts = drawn;
        const svg = renderer.renderPinnedClefSvg(clef, ts, 'light', meterSigns);
        expect(canvasTexts.length).toBeGreaterThan(0);
        expectSameTexts(svgTexts(svg), canvasTexts);
        expect(svg.getAttribute('viewBox')).toBe(`0 0 ${PINNED_HEADER_WIDTH} ${MEASURE_CANVAS_HEIGHT}`);
        expect(Number(svg.getAttribute('width'))).toBeCloseTo(PINNED_HEADER_WIDTH * 0.7, 9);
      }
    }
  });
});

describe('Sized measure renderer (ADR 0103 seam 4)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => TEXT_METRICS,
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    // Drop the instance override: the prototype's getter shows through again
    delete (window as unknown as Record<string, unknown>).devicePixelRatio;
  });

  function stubDevicePixelRatio(get: () => number): void {
    Object.defineProperty(window, 'devicePixelRatio', { get, configurable: true });
  }

  it('sizes canvases from an explicit pixel ratio without reading the window', () => {
    stubDevicePixelRatio(() => {
      throw new Error('the renderer must not read window.devicePixelRatio');
    });
    const renderer = new MeasureRenderer({ dpr: 2, zoom: 1.5 });
    expect(renderer.getDpr()).toBe(2);
    expect(renderer.getZoom()).toBe(1.5);
    const data = measures('4/4', 'treble', 3)[0];
    const { canvas } = renderer.renderMeasure(data, 'light', LABELS);
    expect(canvas.width).toBe(Math.floor(data.width * 3));
    expect(canvas.height).toBe(Math.floor(MEASURE_CANVAS_HEIGHT * 3));
    const header = renderer.renderPinnedClef('treble', '4/4', 'light');
    expect(header.width).toBe(Math.floor(PINNED_HEADER_WIDTH * 3));
  });

  it('reaches any pixel height through dpr, while zoom stays clamped', () => {
    const renderer = new MeasureRenderer({ dpr: 1080 / MEASURE_CANVAS_HEIGHT, zoom: 9 });
    expect(renderer.getZoom()).toBe(1.5);
    const tall = new MeasureRenderer({ dpr: 1080 / MEASURE_CANVAS_HEIGHT, zoom: 1 });
    const { canvas } = tall.renderMeasure(measures('3/2', 'bass', 4)[0], 'light');
    expect(canvas.height).toBe(1080);
  });

  it("defaults to the window's pixel ratio", () => {
    stubDevicePixelRatio(() => 2.5);
    expect(new MeasureRenderer().getDpr()).toBe(2.5);
    stubDevicePixelRatio(() => 0.5);
    expect(new MeasureRenderer().getDpr()).toBe(1);
    expect(new MeasureRenderer().getZoom()).toBe(1);
  });
});

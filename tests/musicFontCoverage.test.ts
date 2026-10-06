import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MUSIC_FONT_FAMILY } from '../src/notation/fonts';
import subsetCodepoints from '../src/notation/fonts/guidonica-notation.codepoints.json';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  AppSettings,
  CLEFS,
  TIME_SIGNATURES,
  TUPLET_SUPPORT,
  TupletName,
  TupletValue,
} from '../src/notation/types';
import en from '../src/i18n/locales/en';

/**
 * Every glyph VexFlow draws must exist in the Guidonica Notation subset (ADR 0058):
 * a missing codepoint falls back to a system font and rasterizes as tofu. When a new
 * feature draws a new SMuFL glyph, widen RANGES in scripts/build-music-font.py.
 */
describe('Music font subset covers every glyph the renderer draws', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const subset = new Set(subsetCodepoints.map((hex) => parseInt(hex, 16)));
  const drawn = new Set<number>();

  beforeEach(() => {
    drawn.clear();
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      const state: Record<string | symbol, unknown> = {
        canvas: this,
        font: '10px sans-serif',
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        measureText: () => ({ width: 10 }),
        createLinearGradient: () => ({ addColorStop: noop }),
        getLineDash: () => [],
        fillText: (text: string) => {
          if (!String(state.font).includes(MUSIC_FONT_FAMILY)) return;
          for (const ch of text) drawn.add(ch.codePointAt(0) ?? 0);
        },
      };
      return new Proxy(state, {
        get: (target, key) => (key in target ? target[key] : noop),
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      }) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  function missing(): string[] {
    return [...drawn].filter((c) => !subset.has(c)).map((c) => `U+${c.toString(16).toUpperCase()}`);
  }

  it('pinned headers: every clef with and without each time signature', () => {
    const renderer = new MeasureRenderer();
    for (const clef of CLEFS) {
      renderer.renderPinnedClef(clef, null, 'light');
      for (const ts of TIME_SIGNATURES) renderer.renderPinnedClef(clef, ts, 'light');
    }
    expect(drawn.size).toBeGreaterThan(0);
    expect(missing()).toEqual([]);
  });

  it('pinned headers: the C and ¢ signs (ADR 0093)', () => {
    const renderer = new MeasureRenderer();
    renderer.renderPinnedClef('treble', '4/4', 'light', true);
    renderer.renderPinnedClef('treble', '2/2', 'light', true);
    expect([...drawn]).toEqual(expect.arrayContaining([0xe08a, 0xe08b]));
    expect(missing()).toEqual([]);
  });

  for (const ts of TIME_SIGNATURES) {
    it(`${ts} stream: all subdivisions, dotted, rests, ties and tuplets on every clef`, () => {
      const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
      for (const cell of TUPLET_SUPPORT[ts]) {
        const [name, value] = cell.split(':') as [TupletName, TupletValue];
        tuplets[name][value] = true;
      }
      const intervals = structuredClone(DEFAULT_APP_SETTINGS.intervals);
      for (const key of Object.keys(intervals) as (keyof typeof intervals)[]) intervals[key] = true;
      const renderer = new MeasureRenderer();
      for (const clef of CLEFS) {
        const settings: AppSettings = {
          ...structuredClone(DEFAULT_APP_SETTINGS),
          clef,
          timeSignature: ts,
          subdivisions: {
            whole: true,
            half: true,
            quarter: true,
            eighth: true,
            sixteenth: true,
            thirtySecond: true,
            dotted: true,
          },
          tuplets,
          intervals,
          rests: true,
          ties: true,
          solfegeLabelMode: 'syllables',
        };
        const generator = new MusicGenerator();
        for (let m = 0; m < 12; m++) {
          renderer.renderMeasure(generator.generateMeasure(m, settings, m * 6), 'light', en.noteNames.syllables);
        }
      }
      expect(drawn.size).toBeGreaterThan(0);
      expect(missing()).toEqual([]);
    });
  }

  it('4/2 breve notehead and breve bar rest (ADR 0090)', () => {
    const renderer = new MeasureRenderer();
    const generator = new MusicGenerator();
    const settings: AppSettings = {
      ...structuredClone(DEFAULT_APP_SETTINGS),
      timeSignature: '4/2',
      subdivisions: { ...DEFAULT_APP_SETTINGS.subdivisions, whole: true, half: false, quarter: false, eighth: false, dotted: false },
      rests: true,
      ties: false,
    };
    const BREVE = 0xe0a0;
    const BREVE_REST = 0xe4e2;
    for (let m = 0; m < 400 && !(drawn.has(BREVE) && drawn.has(BREVE_REST)); m++) {
      renderer.renderMeasure(generator.generateMeasure(m, settings, m * 8), 'light', en.noteNames.syllables);
    }
    expect(drawn.has(BREVE)).toBe(true);
    expect(drawn.has(BREVE_REST)).toBe(true);
    expect(missing()).toEqual([]);
  });
});

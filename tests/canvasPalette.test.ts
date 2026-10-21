import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CANVAS_PALETTE, CanvasTheme, canvasPalette, canvasTheme } from '../src/notation/types';

const CANVAS_THEMES: readonly CanvasTheme[] = ['light', 'dark', 'light-high', 'dark-high'];

/** WCAG 2 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('Canvas palette (single source of truth)', () => {
  const css = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8');

  // Extracts a custom property from the first rule whose selector contains `selector`.
  const cssVar = (selector: string, name: string): string | null => {
    const start = css.indexOf(selector);
    if (start < 0) return null;
    const block = css.slice(start, css.indexOf('}', start));
    const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
    return m ? m[1].trim().toLowerCase() : null;
  };

  it('draws staff lines and VexFlow ledger lines in one colour in both themes', () => {
    expect(CANVAS_PALETTE.light.staff).toBe('#64748b');
    expect(CANVAS_PALETTE.dark.staff).toBe('#64748b');
  });

  it('matches the CSS playhead and canvas tokens per theme', () => {
    expect(cssVar("[data-theme='light']", '--playhead-color')).toBe(CANVAS_PALETTE.light.playhead);
    expect(cssVar("[data-theme='dark']", '--playhead-color')).toBe(CANVAS_PALETTE.dark.playhead);
    expect(cssVar("[data-theme='light']", '--canvas-bg')).toBe(CANVAS_PALETTE.light.background);
    expect(cssVar("[data-theme='dark']", '--canvas-bg')).toBe(CANVAS_PALETTE.dark.background);
  });

  it('keeps the rgb triplets in sync with their hex colours', () => {
    const hexToRgb = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
    for (const theme of CANVAS_THEMES) {
      const p = CANVAS_PALETTE[theme];
      expect(p.playheadRgb).toBe(hexToRgb(p.playhead));
      expect(p.backgroundRgb).toBe(hexToRgb(p.background));
      expect(p.staffRgb).toBe(hexToRgb(p.staff));
    }
  });

  describe('high contrast (ADR 0113)', () => {
    it('matches the high-contrast CSS playhead and canvas tokens', () => {
      const light = "[data-contrast='high'] {";
      const dark = "[data-contrast='high'][data-theme='dark'] {";
      expect(cssVar(light, '--playhead-color')).toBe(CANVAS_PALETTE['light-high'].playhead);
      expect(cssVar(dark, '--playhead-color')).toBe(CANVAS_PALETTE['dark-high'].playhead);
      expect(cssVar(light, '--canvas-bg')).toBe(CANVAS_PALETTE['light-high'].background);
      expect(cssVar(dark, '--canvas-bg')).toBe(CANVAS_PALETTE['dark-high'].background);
    });

    it('holds ink, staff, labels and playhead at WCAG AAA (7:1) or better', () => {
      for (const theme of ['light-high', 'dark-high'] as const) {
        const p = CANVAS_PALETTE[theme];
        for (const color of [p.ink, p.staff, p.tuplet, p.solfege, p.playhead]) {
          expect(contrast(color, p.background), `${theme} ${color}`).toBeGreaterThanOrEqual(7);
        }
        expect(p.staffWidth).toBeGreaterThan(CANVAS_PALETTE.light.staffWidth);
        // Labels stay a colour apart from the noteheads
        expect(p.solfege).not.toBe(p.ink);
      }
    });

    it('resolves a theme and contrast to its palette key', () => {
      expect(canvasTheme('light', 'high')).toBe('light-high');
      expect(canvasTheme('dark', 'high')).toBe('dark-high');
      expect(canvasTheme('dark', 'standard')).toBe('dark');
      // Embedders that predate the setting keep the standard palette
      expect(canvasTheme('light')).toBe('light');
      expect(canvasPalette('dark-high')).toBe(CANVAS_PALETTE['dark-high']);
      expect(canvasPalette('light')).toBe(CANVAS_PALETTE.light);
    });

    it('restates every light high-contrast token in the dark block', () => {
      const block = (selector: string): string => {
        const start = css.indexOf(`${selector} {`);
        expect(start).toBeGreaterThan(-1);
        return css.slice(start, css.indexOf('}', start));
      };
      const names = (body: string) => [...body.matchAll(/(--[\w-]+):/g)].map((m) => m[1]);
      for (const [light, dark] of [
        ["[data-contrast='high']", "[data-contrast='high'][data-theme='dark']"],
        ["[data-channel='nightly'][data-contrast='high']", "[data-channel='nightly'][data-contrast='high'][data-theme='dark']"],
      ]) {
        expect(names(block(dark))).toEqual(expect.arrayContaining(names(block(light))));
      }
      // The dark block also overrides everything the nightly dark block sets (ADR 0107)
      expect(names(block("[data-contrast='high'][data-theme='dark']"))).toEqual(
        expect.arrayContaining(names(block("[data-channel='nightly'][data-theme='dark']")))
      );
      // Nightly keeps a violet accent in high contrast
      for (const body of [block("[data-channel='nightly'][data-contrast='high']"), block("[data-channel='nightly'][data-contrast='high'][data-theme='dark']")]) {
        expect(body.toLowerCase()).not.toContain('#00ffcc');
        expect(body.toLowerCase()).not.toContain('#00513f');
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CANVAS_PALETTE } from '../src/notation/types';

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
    for (const theme of ['light', 'dark'] as const) {
      const p = CANVAS_PALETTE[theme];
      expect(p.playheadRgb).toBe(hexToRgb(p.playhead));
      expect(p.backgroundRgb).toBe(hexToRgb(p.background));
    }
  });
});

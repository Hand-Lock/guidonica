import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildGlyphSymbol, buildTileSvg, handGeometry } from '../scripts/build-icons.mjs';

describe('Guidonian Hand brand mark', () => {
  const root = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');

  it('keeps the sprite #g-hand symbol in sync with the generator (run `npm run icons`)', () => {
    const symbol = indexHtml.match(/<symbol id="g-hand"[\s\S]*?<\/symbol>/);
    expect(symbol).not.toBeNull();
    expect(symbol?.[0]).toBe(buildGlyphSymbol());
  });

  it('keeps public/favicon.svg in sync with the generator', () => {
    const svg = fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8');
    expect(svg).toBe(`${buildTileSvg({ detail: 'small' })}\n`);
  });

  it('places a decorative hand mark before the brand title', () => {
    const brand = indexHtml.match(/<div class="brand">([\s\S]*?)<\/div>/);
    expect(brand).not.toBeNull();
    expect(brand?.[1]).toMatch(/^\s*<svg class="brand-mark" aria-hidden="true"><use href="#g-hand"\/><\/svg>\s*<h1>Guidonica<\/h1>/);
  });

  it('strokes the glyph spiral in the theme accent', () => {
    expect(buildGlyphSymbol()).toContain('stroke:var(--accent)');
  });

  it('links the ICO, SVG and Apple touch icons with relative paths', () => {
    expect(indexHtml).toContain('<link rel="icon" href="favicon.ico" sizes="32x32" />');
    expect(indexHtml).toContain('<link rel="icon" href="favicon.svg" type="image/svg+xml" />');
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="apple-touch-icon.png" />');
    expect(indexHtml).not.toContain('rel="icon" href="data:');
  });

  it('ships a valid PNG-in-ICO favicon and a 180×180 touch icon', () => {
    const ico = fs.readFileSync(path.join(root, 'public/favicon.ico'));
    expect(ico.readUInt16LE(0)).toBe(0); // reserved
    expect(ico.readUInt16LE(2)).toBe(1); // type: icon
    expect(ico.readUInt16LE(4)).toBe(1); // one image
    expect(ico[6]).toBe(32);
    expect(ico[7]).toBe(32);
    expect(ico.readUInt32LE(14)).toBe(ico.length - 22);
    expect(ico.readUInt32LE(18)).toBe(22);
    expect(ico.subarray(22, 30).toString('hex')).toBe('89504e470d0a1a0a');

    const touch = fs.readFileSync(path.join(root, 'public/apple-touch-icon.png'));
    expect(touch.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(touch.readUInt32BE(16)).toBe(180);
    expect(touch.readUInt32BE(20)).toBe(180);
  });

  it('walks all 19 on-hand gamut positions in historical order', () => {
    const names = handGeometry().gamut.map((s) => s.name);
    expect(names).toEqual(['Γ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'aa', 'bb', 'cc', 'dd']);
  });
});

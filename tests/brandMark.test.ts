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

  it('keeps public-nightly/favicon.svg in sync with the generator (ADR 0107)', () => {
    const svg = fs.readFileSync(path.join(root, 'public-nightly/favicon.svg'), 'utf-8');
    expect(svg).toBe(`${buildTileSvg({ detail: 'small', channel: 'nightly' })}\n`);
    expect(svg).not.toBe(fs.readFileSync(path.join(root, 'public/favicon.svg'), 'utf-8'));
  });

  it('overrides only public/ files in public-nightly/, every manifest icon included (ADR 0107)', () => {
    const nightly = fs.readdirSync(path.join(root, 'public-nightly'));
    for (const file of nightly) expect(fs.existsSync(path.join(root, 'public', file))).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf-8')) as {
      icons: { src: string; sizes: string }[];
    };
    for (const icon of manifest.icons) {
      const png = fs.readFileSync(path.join(root, 'public-nightly', icon.src));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    expect(nightly).toEqual(expect.arrayContaining(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png']));
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

  it('keeps the README logo docs/brand/guidonica-mark.svg in sync with the generator', () => {
    const svg = fs.readFileSync(path.join(root, 'docs/brand/guidonica-mark.svg'), 'utf-8');
    expect(svg).toBe(`${buildTileSvg({ detail: 'full', bleed: false, size: 256 })}\n`);
  });

  it('links the web app manifest with a relative path', () => {
    expect(indexHtml).toContain('<link rel="manifest" href="manifest.webmanifest" />');
  });

  it('ships a manifest whose icons exist as PNGs of their declared sizes, one maskable', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.webmanifest'), 'utf-8')) as {
      start_url: string;
      scope: string;
      icons: { src: string; sizes: string; type: string; purpose: string }[];
    };
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(icon.src).not.toMatch(/^\/|:/);
      expect(icon.type).toBe('image/png');
      const png = fs.readFileSync(path.join(root, 'public', icon.src));
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('keeps the 19 on-hand gamut positions in historical order', () => {
    const names = handGeometry().gamut.map((s) => s.name);
    expect(names).toEqual(['Γ', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'aa', 'bb', 'cc', 'dd']);
  });

  it('threads the thumb stations it claims, in order, on the palm side', () => {
    const { gamut, thread } = handGeometry();
    expect(thread.stations).toEqual(['Γ', 'A', 'B']);
    let from = 0;
    for (const name of thread.stations) {
      const station = gamut.find((s) => s.name === name);
      expect(station).toBeDefined();
      const hit = thread.points.findIndex((p, i) => i >= from && station !== undefined &&
        p.every((v, j) => Math.abs(v - station.front[j]) < 0.01));
      expect(hit).toBeGreaterThanOrEqual(from);
      from = hit + 1;
    }
  });

  it('wraps the thread in 3D: front runs over the hand, back runs beneath it', () => {
    const runs = handGeometry().thread.runs;
    expect(runs.some((r) => r.front)).toBe(true);
    expect(runs.some((r) => !r.front)).toBe(true);
  });

  it('gives nightly a violet value for every accent token in both themes (ADR 0107)', () => {
    const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf-8');
    const block = (selector: string): string => {
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf('}', start));
    };
    const names = (body: string) => new Set([...body.matchAll(/(--[\w-]+):/g)].map((m) => m[1]));
    const accent = [
      '--accent', '--accent-strong', '--accent-tint', '--focus-ring',
      '--gel-bg', '--gel-hover', '--gel-border', '--gel-ink-shadow', '--gel-glow',
      '--bead', '--bead-border', '--bead-shadow', '--led-on', '--led-on-glow', '--led-on-halo',
    ];
    const light = block("[data-channel='nightly']");
    const dark = block("[data-channel='nightly'][data-theme='dark']");
    expect([...names(light)]).toEqual(expect.arrayContaining(accent));
    // The dark block restates every light override, or the light value would win in dark mode
    expect([...names(dark)]).toEqual(expect.arrayContaining([...names(light), '--gel-ink']));
    for (const body of [light, dark]) {
      expect(body.toLowerCase()).not.toContain('#00ffcc');
      expect(body).not.toContain('0, 255, 204');
    }
  });
});

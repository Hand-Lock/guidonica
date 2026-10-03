import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf-8');

describe('HTML shell: no third-party requests (ADR 0060)', () => {
  it('loads no stylesheet, script, font or preconnect from another origin', () => {
    const external = [...indexHtml.matchAll(/<(link|script)\b[^>]*\b(?:href|src)="(https?:)?\/\/[^"]+"[^>]*>/g)]
      .map((m) => m[0])
      .filter((tag) => !/rel="canonical"/.test(tag));
    expect(external).toEqual([]);
    expect(indexHtml).not.toMatch(/googleapis|gstatic/);
  });

  it('serves every text font face from src/fonts', () => {
    const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      const file = /url\('\.\/(fonts\/[^']+\.woff2)'\)/.exec(face)?.[1];
      expect(file, face).toBeDefined();
      expect(fs.existsSync(path.join(root, 'src', file ?? '')), file).toBe(true);
    }
    for (const family of ['Alegreya', 'Alegreya Sans', 'Ubuntu Mono']) {
      expect(faces.some((f) => f.includes(`font-family: '${family}'`)), family).toBe(true);
    }
  });
});

describe('HTML shell: social preview card (ADR 0061)', () => {
  const meta = (attr: 'property' | 'name', key: string): string | undefined =>
    new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`).exec(indexHtml)?.[1];

  it('declares Open Graph and Twitter card tags with an absolute 1200x630 image', () => {
    expect(meta('property', 'og:url')).toBe('https://guidonica.it/');
    expect(meta('property', 'og:image')).toBe('https://guidonica.it/og-image.png');
    expect(meta('property', 'og:image:width')).toBe('1200');
    expect(meta('property', 'og:image:height')).toBe('630');
    expect(meta('name', 'twitter:card')).toBe('summary_large_image');
    expect(meta('property', 'og:title')).toBeTruthy();
    expect(meta('property', 'og:description')).toBe(meta('name', 'description'));
    expect(indexHtml).toContain('<link rel="canonical" href="https://guidonica.it/" />');
  });

  it('ships the card image at 1200x630', () => {
    const png = fs.readFileSync(path.join(root, 'public/og-image.png'));
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
});

describe('crawler files (ADR 0062)', () => {
  const robots = fs.readFileSync(path.join(root, 'public/robots.txt'), 'utf-8');
  const sitemap = fs.readFileSync(path.join(root, 'public/sitemap.xml'), 'utf-8');

  it('allows all crawlers and points to the sitemap on the canonical host', () => {
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(/^Sitemap: (.+)$/m.exec(robots)?.[1]).toBe('https://guidonica.it/sitemap.xml');
  });

  it('lists only canonical-host URLs, including the shell canonical link', () => {
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) expect(loc.startsWith('https://guidonica.it/'), loc).toBe(true);
    const canonical = /<link rel="canonical" href="([^"]+)"/.exec(indexHtml)?.[1];
    expect(locs).toContain(canonical);
  });
});

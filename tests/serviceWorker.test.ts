import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { cachePrefix, route, staleCaches } from '../src/sw';
import { buildChannel, nightlyHtml, nightlyManifest, precacheList, swVersion } from '../vite.config';

const ROOT = path.resolve(__dirname, '..');

const SCOPE = 'https://guidonica.it/';

/** A Request stand-in: browsers refuse to construct one with mode 'navigate'. */
function req(url: string, method = 'GET', mode: RequestMode = 'cors'): Request {
  return { url, method, mode } as Request;
}

describe('service worker routing (ADR 0063)', () => {
  it('bypasses cross-origin requests', () => {
    expect(route(req('https://example.com/x.js'), SCOPE)).toBe('bypass');
  });

  it('bypasses non-GET requests', () => {
    expect(route(req(`${SCOPE}api`, 'POST'), SCOPE)).toBe('bypass');
  });

  it('serves navigations from the shell route', () => {
    expect(route(req(SCOPE, 'GET', 'navigate'), SCOPE)).toBe('shell');
  });

  it('serves same-origin subresources from the asset route', () => {
    expect(route(req(`${SCOPE}assets/index-abc123.js`), SCOPE)).toBe('asset');
    expect(route(req(`${SCOPE}icon-192.png`, 'GET', 'no-cors'), SCOPE)).toBe('asset');
  });
});

describe('precache list (ADR 0063)', () => {
  const list = precacheList(
    ['index.html', 'assets/index-abc.js', 'assets/vexflow-def.js', 'assets/index-123.css'],
    ['favicon.svg', 'icon-192.png', 'manifest.webmanifest', 'og-image.png', 'CNAME', 'robots.txt', 'sitemap.xml', '.DS_Store', '.well-known'],
  );

  it('starts with the shell and includes hashed assets and icons', () => {
    expect(list[0]).toBe('./');
    expect(list).toEqual(
      expect.arrayContaining(['assets/index-abc.js', 'assets/vexflow-def.js', 'assets/index-123.css', 'favicon.svg', 'icon-192.png', 'manifest.webmanifest']),
    );
  });

  it('excludes index.html, crawler, share and hosting files, and dotfiles such as .well-known (ADR 0068)', () => {
    for (const name of ['index.html', 'og-image.png', 'CNAME', 'robots.txt', 'sitemap.xml', '.DS_Store', '.well-known']) {
      expect(list).not.toContain(name);
    }
  });

  it('uses relative URLs only', () => {
    for (const url of list) expect(url.startsWith('/')).toBe(false);
  });
});

describe('service worker version (ADR 0063)', () => {
  const entries = [
    { name: 'index.html', content: '<!doctype html>' },
    { name: 'assets/a.js', content: 'a' },
    { name: 'icon.png', content: new Uint8Array([1, 2, 3]) },
  ];

  it('is a deterministic 12-character hex string', () => {
    expect(swVersion(entries)).toMatch(/^[0-9a-f]{12}$/);
    expect(swVersion(entries)).toBe(swVersion(entries));
  });

  it('does not depend on input order', () => {
    expect(swVersion([...entries].reverse())).toBe(swVersion(entries));
  });

  it('changes when any content or name changes', () => {
    const base = swVersion(entries);
    expect(swVersion([...entries.slice(0, 2), { name: 'icon.png', content: new Uint8Array([1, 2, 4]) }])).not.toBe(base);
    expect(swVersion([...entries.slice(1), { name: 'index.htm', content: '<!doctype html>' }])).not.toBe(base);
  });
});

describe('release channels (ADR 0078)', () => {
  it('lets the nightly worker own /nightly/: the release worker bypasses it', () => {
    expect(route(req(`${SCOPE}nightly/`, 'GET', 'navigate'), SCOPE)).toBe('bypass');
    expect(route(req(`${SCOPE}nightly/assets/index-abc.js`), SCOPE)).toBe('bypass');
    expect(route(req(`${SCOPE}nightlyish.js`), SCOPE)).toBe('asset');
  });

  it('serves its own scope as the nightly worker', () => {
    const scope = `${SCOPE}nightly/`;
    expect(route(req(scope, 'GET', 'navigate'), scope, 'nightly')).toBe('shell');
    expect(route(req(`${scope}assets/index-abc.js`), scope, 'nightly')).toBe('asset');
  });

  it('keeps each channel to its own cache prefix', () => {
    expect(cachePrefix('release')).toBe('guidonica-');
    expect(cachePrefix('nightly')).toBe('guidonica-nightly-');
  });

  it("never deletes the other channel's caches", () => {
    const names = ['guidonica-aaa', 'guidonica-bbb', 'guidonica-nightly-ccc', 'guidonica-nightly-ddd', 'other-cache'];
    expect(staleCaches(names, 'guidonica-bbb', 'release')).toEqual(['guidonica-aaa']);
    expect(staleCaches(names, 'guidonica-nightly-ddd', 'nightly')).toEqual(['guidonica-nightly-ccc']);
  });

  it('reads the channel from GUIDONICA_CHANNEL, release by default', () => {
    expect(buildChannel(undefined)).toBe('release');
    expect(buildChannel('')).toBe('release');
    expect(buildChannel('release')).toBe('release');
    expect(buildChannel('nightly')).toBe('nightly');
    expect(() => buildChannel('beta')).toThrow();
  });

  it('marks the nightly shell noindex, renames it and reads only the nightly settings', () => {
    const html = nightlyHtml(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8'));
    expect(html).toContain('<title>Guidonica Nightly</title>');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain('rel="canonical"');
    expect(html).toContain("localStorage.getItem('guidonica_nightly_settings_v1')");
    expect(html).not.toContain("'guidonica_settings_v1'");
    expect(html).not.toContain('solfege_scroller_settings');
  });

  it('names the nightly manifest apart so both channels can be installed', () => {
    const manifest = JSON.parse(nightlyManifest(fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf-8')));
    expect(manifest.name).toBe('Guidonica Nightly');
    expect(manifest.short_name).toBe('Guidonica Nightly');
  });

  it('keeps crawlers off the nightly channel', () => {
    expect(fs.readFileSync(path.join(ROOT, 'public/robots.txt'), 'utf-8')).toMatch(/^Disallow: \/nightly\/$/m);
  });
});

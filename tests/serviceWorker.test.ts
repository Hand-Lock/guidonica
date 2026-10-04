import { describe, it, expect } from 'vitest';
import { route } from '../src/sw';
import { precacheList, swVersion } from '../vite.config';

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

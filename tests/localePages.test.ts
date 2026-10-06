import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import en from '../src/i18n/locales/en';
import { detectLanguage } from '../src/i18n';
import { LANDING, landingUrl } from '../src/i18n/landing';
import { DEFAULT_APP_SETTINGS, STORAGE_KEY, loadStoredSettings } from '../src/storage';
import { LANGUAGES, Language } from '../src/notation/types';
import { localePage, nightlyHtml } from '../vite.config';

const ROOT = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
// The built shell's asset URLs, as Vite writes them with base './'
const builtHtml = indexHtml.replace(
  '<link rel="stylesheet" href="/src/style.css" />',
  '<link rel="stylesheet" crossorigin href="./assets/index-abc.css">',
);

const OTHER = LANGUAGES.filter((l): l is Exclude<Language, 'en'> => l !== 'en');
const pages: [Language, string][] = [['en', builtHtml], ...OTHER.map((l): [Language, string] => [l, localePage(builtHtml, l, false)])];

const attr = (html: string, re: RegExp): string | undefined => re.exec(html)?.[1];
const meta = (html: string, key: string): string | undefined =>
  attr(html, new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`));
const hreflang = (html: string): string[] =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map((m) => `${m[1]} ${m[2]}`).sort();
const unescape = (text: string | undefined): string | undefined => text?.replace(/&amp;/g, '&');

describe('language landing pages (ADR 0086)', () => {
  it('every page lists the same hreflang set: each language at its landing URL, plus x-default', () => {
    const expected = [...LANGUAGES.map((l) => `${l} ${landingUrl(l)}`), `x-default ${landingUrl('en')}`].sort();
    for (const [lang, html] of pages) expect(hreflang(html), lang).toEqual(expected);
  });

  it('each page is canonical at its own landing URL, listed in the hreflang set and the sitemap', () => {
    const sitemap = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf-8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const [lang, html] of pages) {
      const url = landingUrl(lang);
      expect(attr(html, /<link rel="canonical" href="([^"]+)"/), lang).toBe(url);
      expect(meta(html, 'og:url'), lang).toBe(url);
      expect(hreflang(html), lang).toContain(`${lang} ${url}`);
      expect(locs, lang).toContain(url);
    }
    expect(locs).toHaveLength(LANGUAGES.length);
  });

  it("matches the root shell's English metadata to the landing table", () => {
    expect(unescape(attr(indexHtml, /<title>([^<]*)<\/title>/))).toBe(en.docTitle);
    expect(meta(indexHtml, 'description')).toBe(LANDING.en.description);
    expect(meta(indexHtml, 'og:image:alt')).toBe(LANDING.en.imageAlt);
    expect(meta(indexHtml, 'og:locale')).toBe(LANDING.en.ogLocale);
  });

  it.each(OTHER)('translates the %s page head and declares its language', async (lang) => {
    const html = localePage(builtHtml, lang, false);
    const m = (await import(`../src/i18n/locales/${lang}.ts`)).default;
    expect(html).toContain(`<html lang="${lang}" data-page-lang="${lang}">`);
    expect(unescape(attr(html, /<title>([^<]*)<\/title>/))).toBe(m.docTitle);
    for (const key of ['og:title', 'twitter:title']) expect(unescape(meta(html, key)), key).toBe(m.docTitle);
    for (const key of ['description', 'og:description', 'twitter:description']) {
      expect(meta(html, key), key).toBe(LANDING[lang].description);
    }
    for (const key of ['og:image:alt', 'twitter:image:alt']) expect(meta(html, key), key).toBe(LANDING[lang].imageAlt);
    const locales = [...html.matchAll(/<meta property="og:locale(?::alternate)?" content="([^"]+)"/g)].map((x) => x[1]);
    expect(locales[0]).toBe(LANDING[lang].ogLocale);
    expect([...locales].sort()).toEqual(LANGUAGES.map((l) => LANDING[l].ogLocale).sort());
    expect(html).toContain(m.aboutTaglineHtml);
  });

  it('resolves relative URLs from the subdirectory and leaves the rest alone', () => {
    const html = localePage(builtHtml, 'it', false);
    expect(html).toContain('href="../favicon.svg"');
    expect(html).toContain('href="../manifest.webmanifest"');
    expect(html).toContain('href="../assets/index-abc.css"');
    expect(html).toContain('<use href="#i-share"/>');
    expect(html).toContain('href="https://github.com/Hand-Lock/guidonica"');
    expect(html).toContain('src="/src/main.ts"');
    expect(html).not.toMatch(/\s(?:href|src)="(?!\.\.\/|#|\/|[a-z]+:)/);
  });

  it('keeps nightly pages untitled, uncanonical and out of the hreflang graph', () => {
    const html = localePage(nightlyHtml(builtHtml), 'fr', true);
    expect(html).toContain('<title>Guidonica Nightly</title>');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).not.toContain('rel="canonical"');
    expect(hreflang(html)).toEqual([]);
    expect(html).toContain('data-page-lang="fr"');
  });
});

describe('language from the landing page (ADR 0086)', () => {
  afterEach(() => {
    delete document.documentElement.dataset.pageLang;
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('prefers the page language to the browser language', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'], language: 'fr-FR' });
    expect(detectLanguage()).toBe('fr');
    document.documentElement.dataset.pageLang = 'de';
    expect(detectLanguage()).toBe('de');
    document.documentElement.dataset.pageLang = 'xx';
    expect(detectLanguage()).toBe('fr');
  });

  it('keeps a stored language over the page language', () => {
    document.documentElement.dataset.pageLang = 'es';
    expect(loadStoredSettings().language).toBe('es');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_APP_SETTINGS, language: 'it' }));
    expect(loadStoredSettings().language).toBe('it');
  });
});

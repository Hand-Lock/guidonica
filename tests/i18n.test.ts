import { describe, it, expect, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import en, { Messages } from '../src/i18n/locales/en';
import itMessages from '../src/i18n/locales/it';
import fr from '../src/i18n/locales/fr';
import de from '../src/i18n/locales/de';
import es from '../src/i18n/locales/es';
import {
  ENDONYMS,
  SUPPORTED_LANGUAGES,
  applyDom,
  detectLanguage,
  formatPitch,
  formatRange,
  getLanguage,
  getText,
  loadLocale,
  noteLabels,
  t,
} from '../src/i18n';
import { pitchBounds } from '../src/notation/generator';
import { DEFAULT_APP_SETTINGS, STORAGE_KEY, loadStoredSettings } from '../src/storage';
import { LEVEL_PRESETS, levelIndex } from '../src/presets';

const LOCALES: Record<string, Messages> = { en, it: itMessages, fr, de, es };

const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
// Body only: the head's <link> tags would make happy-dom fetch assets
const body = indexHtml.match(/<body[\s\S]*<\/body>/)?.[0] ?? '';
const parseBody = (): Document =>
  new DOMParser().parseFromString(body.replace(/<script[\s\S]*?<\/script>/g, ''), 'text/html');

/** Serializes HTML through a div so entities, quoting and whitespace compare equal. */
function normalizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.innerHTML.replace(/\s+/g, ' ').trim();
}

describe('index.html ↔ en dictionary parity (ADR 0059)', () => {
  const doc = parseBody();
  const textKey = (key: string): string => {
    const value = (en as Record<string, unknown>)[key];
    expect(typeof value, `en.${key} must be a string`).toBe('string');
    return value as string;
  };

  it('every data-i18n text equals the English dictionary', () => {
    const nodes = [...doc.querySelectorAll<HTMLElement>('[data-i18n]')];
    expect(nodes.length).toBeGreaterThan(80);
    for (const el of nodes) {
      const key = el.dataset.i18n ?? '';
      expect(getText(el), key).toBe(textKey(key));
    }
  });

  it('every data-i18n-html block equals the English dictionary', () => {
    const nodes = [...doc.querySelectorAll<HTMLElement>('[data-i18n-html]')];
    expect(nodes.length).toBe(4);
    for (const el of nodes) {
      const key = el.dataset.i18nHtml ?? '';
      expect(normalizeHtml(el.innerHTML), key).toBe(normalizeHtml(textKey(key)));
    }
  });

  it.each([
    ['data-i18n-title', 'title'],
    ['data-i18n-aria-label', 'aria-label'],
    ['data-i18n-placeholder', 'placeholder'],
  ])('every %s equals the English dictionary', (data, attr) => {
    for (const el of doc.querySelectorAll(`[${data}]`)) {
      const key = el.getAttribute(data) ?? '';
      expect(el.getAttribute(attr), key).toBe(textKey(key));
    }
  });

  it('offers every language in Settings, each tagged with its own lang', () => {
    const options = [...doc.querySelectorAll<HTMLOptionElement>('#select-language option')];
    expect(options.map((o) => o.value)).toEqual([...SUPPORTED_LANGUAGES]);
    for (const o of options) {
      expect(o.lang).toBe(o.value);
      expect(o.textContent?.trim()).toBe(ENDONYMS[o.value as keyof typeof ENDONYMS]);
    }
  });

  it('labels select offers language-neutral modes', () => {
    const values = [...doc.querySelectorAll<HTMLOptionElement>('#select-solfege-mode option')].map((o) => o.value);
    expect(values).toEqual(['none', 'syllables', 'letters']);
  });
});

describe('Locale dictionaries', () => {
  const walk = (value: unknown, at: string, out: string[]): void => {
    if (typeof value === 'string') {
      if (!value.trim()) out.push(at);
    } else if (Array.isArray(value) || (value && typeof value === 'object')) {
      for (const [k, v] of Object.entries(value)) walk(v, `${at}.${k}`, out);
    }
  };

  it.each(Object.entries(LOCALES))('%s has every key of en and no empty string', (_lang, messages) => {
    expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
    const empty: string[] = [];
    walk(messages, '', empty);
    expect(empty).toEqual([]);
  });

  it.each(Object.entries(LOCALES))('%s interpolates every message function', (_lang, m) => {
    expect(m.zoomAuto(80)).toContain('80');
    expect(m.zoomManual(125)).toContain('125');
    expect(m.levelAria('X')).toContain('X');
    expect(m.themeButtonTitle('A', 'B')).toMatch(/A[\s\S]*B/);
    expect(m.tupletCell('N', 3, 'v', 2)).toMatch(/N[\s\S]*3[\s\S]*v[\s\S]*2/);
    expect(m.tupletBeats(0.5)).toContain('½');
    expect(m.tupletUnavailable('5/4')).toContain('5/4');
  });

  it('spells national note names', () => {
    expect(en.noteNames.syllables[6]).toBe('Ti');
    expect(itMessages.noteNames.syllables[6]).toBe('Si');
    expect(es.noteNames.syllables[6]).toBe('Si');
    expect(fr.noteNames.syllables[1]).toBe('Ré');
    expect(de.noteNames.syllables[4]).toBe('So');
    expect(de.noteNames.syllables[6]).toBe('Ti');
    expect(de.noteNames.letters[6]).toBe('H');
    for (const m of Object.values(LOCALES)) {
      expect(m.noteNames.syllables).toHaveLength(7);
      expect(m.noteNames.letters).toHaveLength(7);
    }
  });

  it('uses French narrow no-break spaces before high punctuation', () => {
    expect(fr.introLevelQuestion).toMatch(/ \?$/);
    expect(fr.levelAria('X')).toContain(' :');
  });
});

describe('Range hint octave conventions', () => {
  const range = (m: Messages, clef: 'treble' | 'bass' | 'alto', above: number, below: number): string => {
    const { low, high } = pitchBounds(clef, { above, below });
    return formatRange(low, high, m);
  };

  it('formats scientific pitch in English', () => {
    expect(range(en, 'treble', 3, 3)).toBe('E3 – F6');
    expect(range(en, 'bass', 1, 2)).toBe('B1 – D4');
  });

  it('formats Franco-Belgian syllables (Do3 = middle C) in it, fr and es', () => {
    expect(range(itMessages, 'treble', 3, 3)).toBe('Mi2 – Fa5');
    expect(range(fr, 'treble', 3, 3)).toBe('Mi2 – Fa5');
    expect(range(es, 'treble', 0, 0)).toBe('Re3 – Sol4');
    expect(range(fr, 'treble', 0, 0)).toBe('Ré3 – Sol4');
  });

  it('formats Helmholtz notation (c¹ = middle C) in German', () => {
    expect(range(de, 'treble', 3, 3)).toBe('e – f³');
    expect(range(de, 'treble', 0, 0)).toBe('d¹ – g²');
    expect(range(de, 'bass', 1, 2)).toBe('H₁ – d¹');
    // Middle C, the great and the contra octave
    expect(formatPitch(4 * 7, de)).toBe('c¹');
    expect(formatPitch(2 * 7, de)).toBe('C');
    expect(formatPitch(1 * 7 + 6, de)).toBe('H₁');
  });

  it('names middle C in each hint title', () => {
    expect(en.rangeTitle).toContain('C4');
    expect(itMessages.rangeTitle).toContain('Do3');
    expect(fr.rangeTitle).toContain('Do3');
    expect(es.rangeTitle).toContain('Do3');
    expect(de.rangeTitle).toContain('c¹');
  });
});

describe('Runtime loading and DOM translation', () => {
  afterEach(async () => {
    await loadLocale('en');
    vi.unstubAllGlobals();
  });

  it('loads a lazy locale and resolves labels from it', async () => {
    expect(await loadLocale('de')).toBe(true);
    expect(getLanguage()).toBe('de');
    expect(t().settings).toBe('Einstellungen');
    expect(noteLabels('letters')?.[6]).toBe('H');
    expect(noteLabels('none')).toBeNull();
  });

  it('a superseded load resolves false and the latest language wins', async () => {
    const first = loadLocale('fr');
    const second = loadLocale('es');
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(getLanguage()).toBe('es');
  });

  it('translates the shell and keeps icons and keyboard hints', async () => {
    await loadLocale('it');
    const doc = parseBody();
    applyDom(doc.body);
    expect(doc.querySelector('[data-i18n="settings"]')?.textContent?.trim()).toBe('Impostazioni');
    const reset = doc.getElementById('btn-reset');
    expect(reset?.querySelector('svg')).not.toBeNull();
    expect(reset?.querySelector('.btn-label')?.textContent).toBe('Azzera');
    expect(reset?.getAttribute('title')).toBe(itMessages.resetTitle);
    expect(doc.querySelector('[data-i18n-title="brandTagline"]')?.getAttribute('title')).toBe(itMessages.brandTagline);
    applyDom(document);
    expect(document.documentElement.lang).toBe('it');
    expect(document.title).toBe(itMessages.docTitle);
  });

  it('detects the first supported browser language', () => {
    vi.stubGlobal('navigator', { languages: ['pt-BR', 'de-AT', 'fr'], language: 'pt-BR' });
    expect(detectLanguage()).toBe('de');
    vi.stubGlobal('navigator', { languages: ['ja'], language: 'ja' });
    expect(detectLanguage()).toBe('en');
  });
});

describe('Language and label settings', () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('migrates legacy syllable modes and keeps the Beginner level matched', () => {
    for (const legacy of ['solfege', 'italian']) {
      const beginner = LEVEL_PRESETS[0].settings;
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...DEFAULT_APP_SETTINGS, ...beginner, solfegeLabelMode: legacy })
      );
      const loaded = loadStoredSettings();
      expect(loaded.solfegeLabelMode).toBe('syllables');
      expect(levelIndex(loaded)).toBe(1);
    }
  });

  it('validates the stored language and defaults to the detected one', () => {
    vi.stubGlobal('navigator', { languages: ['es-MX'], language: 'es-MX' });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: 'fr' }));
    expect(loadStoredSettings().language).toBe('fr');
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language: 'klingon' }));
    expect(loadStoredSettings().language).toBe('es');
  });

  it('the language never changes the matched level', () => {
    const beginner = { ...DEFAULT_APP_SETTINGS, ...LEVEL_PRESETS[0].settings };
    for (const language of SUPPORTED_LANGUAGES) {
      expect(levelIndex({ ...beginner, language })).toBe(1);
    }
  });
});

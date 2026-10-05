// Localization runtime (ADR 0059): typed dictionaries, lazy locale chunks, DOM
// translation by data-i18n* attributes and national note naming. No library.

import { LANGUAGES, Language, SolfegeLabelMode } from '../notation/types';
import en, { Messages } from './locales/en';

export type { Language, Messages };
export const SUPPORTED_LANGUAGES = LANGUAGES;

/** Each language named in itself, for the onboarding chips and the Settings select. */
export const ENDONYMS: Record<Language, string> = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

// Explicit map so Vite emits one small chunk per non-English locale
const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<{ default: Messages }>> = {
  it: () => import('./locales/it'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  es: () => import('./locales/es'),
};

let current: Messages = en;
let currentLanguage: Language = 'en';
let request = 0;

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * First browser language whose primary subtag is supported, else English. Mirrors the
 * inline head script in index.html, which hides the page until a non-English locale lands.
 */
export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of preferred) {
    const primary = String(tag ?? '').toLowerCase().split('-')[0];
    if (isLanguage(primary)) return primary;
  }
  return 'en';
}

/** The active dictionary. */
export function t(): Messages {
  return current;
}

export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Loads and activates `lang`. Resolves false when a later call superseded this one, so
 * quick switches never end on a stale locale. Rejects when the chunk fails to load.
 */
export async function loadLocale(lang: Language): Promise<boolean> {
  const token = ++request;
  const messages = lang === 'en' ? en : (await LOADERS[lang]()).default;
  if (token !== request) return false;
  current = messages;
  currentLanguage = lang;
  return true;
}

type TextKey = { [K in keyof Messages]: Messages[K] extends string ? K : never }[keyof Messages];

function isTextKey(key: string | undefined): key is TextKey {
  return key !== undefined && Object.prototype.hasOwnProperty.call(en, key) && typeof en[key as keyof Messages] === 'string';
}

/**
 * Sets an element's label. Elements that also hold icons or <kbd> keep them: only the
 * last non-blank text node changes, with its surrounding whitespace.
 */
function setText(el: Element, text: string): void {
  if (!el.firstElementChild) {
    el.textContent = text;
    return;
  }
  let target: Text | null = null;
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) target = node as Text;
  }
  if (!target) return;
  const [, lead, , trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(target.data) ?? ['', '', '', ''];
  target.data = lead + text + trail;
}

/** The label `setText` writes, read back (used by the HTML parity test). */
export function getText(el: Element): string {
  if (!el.firstElementChild) return (el.textContent ?? '').trim();
  let text = '';
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) text = node.textContent.trim();
  }
  return text;
}

const ATTRIBUTES = [
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-placeholder', 'placeholder'],
] as const;

function isDocument(root: Document | Element): root is Document {
  return root.nodeType === Node.DOCUMENT_NODE;
}

/** Translates every data-i18n* node under `root`, plus <html lang> and the document title. */
export function applyDom(root: Document | Element = document): void {
  const m = current;
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (isTextKey(key)) setText(el, m[key]);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (isTextKey(key)) el.innerHTML = m[key]; // Trusted: our own bundled dictionaries
  });
  for (const [data, attr] of ATTRIBUTES) {
    root.querySelectorAll(`[${data}]`).forEach((el) => {
      const key = el.getAttribute(data) ?? undefined;
      if (isTextKey(key)) el.setAttribute(attr, m[key]);
    });
  }
  if (isDocument(root)) {
    root.documentElement.lang = currentLanguage;
    // The nightly channel keeps one untranslated name, matching its shell (ADR 0078)
    root.title = __APP_CHANNEL__ === 'nightly' ? 'Guidonica Nightly' : m.docTitle;
  }
}

/** The label table for a mode in the active language, indexed by c d e f g a b. */
export function noteLabels(mode: SolfegeLabelMode): readonly string[] | null {
  if (mode === 'none') return null;
  return mode === 'syllables' ? current.noteNames.syllables : current.noteNames.letters;
}

/**
 * Names of the Notes chips, indexed by c d e f g a b (ADR 0070): the Labels table when one is
 * on, else the national convention, syllables where the octave hint uses them (it, fr, es)
 * and letters elsewhere (en, de with H).
 */
export function pitchClassNames(mode: SolfegeLabelMode, m: Messages = current): readonly string[] {
  if (mode === 'syllables') return m.noteNames.syllables;
  if (mode === 'letters') return m.noteNames.letters;
  return m.pitchNotation === 'franco-belgian' ? m.noteNames.syllables : m.noteNames.letters;
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

/**
 * Names a diatonic step (octave·7 + index in c d e f g a b) in a locale's octave convention:
 * scientific "C4", Franco-Belgian "Do3" (one octave lower, as taught in Italy, France and
 * Spain), or Helmholtz "c¹" (German: c = small octave, C = great, C₁ = contra).
 */
export function formatPitch(step: number, m: Messages = current): string {
  const octave = Math.floor(step / 7);
  const index = step - octave * 7;
  switch (m.pitchNotation) {
    case 'franco-belgian':
      return `${m.noteNames.syllables[index]}${octave - 1}`;
    case 'helmholtz': {
      const letter = m.noteNames.letters[index];
      if (octave >= 3) {
        const marks = octave - 3;
        return letter.toLowerCase() + (marks > 0 ? SUPERSCRIPT[marks] ?? '' : '');
      }
      return octave === 2 ? letter : letter + (SUBSCRIPT[2 - octave] ?? '');
    }
    default:
      return `${m.noteNames.letters[index]}${octave}`;
  }
}

/** Range hint text, e.g. "E3 – F6", "Mi2 – Fa5" or "e – f³". */
export function formatRange(low: number, high: number, m: Messages = current): string {
  return `${formatPitch(low, m)} – ${formatPitch(high, m)}`;
}

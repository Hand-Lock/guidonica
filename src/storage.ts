import { AppSettings, DEFAULT_TUPLET_OPTIONS } from './notation/types';

const STORAGE_KEY = 'solfege_scroller_settings_v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  tempo: 60,
  timeSignature: '4/4',
  clef: 'treble',
  subdivisions: {
    whole: true,
    half: true,
    quarter: true,
    eighth: true,
    sixteenth: false,
    triplets: false,
  },
  tuplets: {
    duplet: { ...DEFAULT_TUPLET_OPTIONS.duplet },
    triplet: { ...DEFAULT_TUPLET_OPTIONS.triplet },
    quadruplet: { ...DEFAULT_TUPLET_OPTIONS.quadruplet },
    quintuplet: { ...DEFAULT_TUPLET_OPTIONS.quintuplet },
    sextuplet: { ...DEFAULT_TUPLET_OPTIONS.sextuplet },
    septuplet: { ...DEFAULT_TUPLET_OPTIONS.septuplet },
  },
  rests: false,
  intervals: {
    unison: false,
    second: true,
    third: true,
    fourth: false,
    fifth: false,
    sixth: false,
    seventh: false,
    octave: false,
    ninthPlus: false,
  },
  solfegeLabelMode: 'none',
  soundProfile: 'triangle',
  pulse68: 'dotted-quarter',
  countIn: true,
  theme: 'light',
  volume: 0.8,
  isMuted: false,
};

/**
 * Loads stored settings from localStorage with deep merging and validation against defaults.
 */
export function loadStoredSettings(): AppSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      subdivisions: {
        ...DEFAULT_APP_SETTINGS.subdivisions,
        ...(parsed.subdivisions || {}),
      },
      tuplets: {
        duplet: { ...DEFAULT_APP_SETTINGS.tuplets.duplet, ...(parsed.tuplets?.duplet || {}) },
        triplet: { ...DEFAULT_APP_SETTINGS.tuplets.triplet, ...(parsed.tuplets?.triplet || {}) },
        quadruplet: { ...DEFAULT_APP_SETTINGS.tuplets.quadruplet, ...(parsed.tuplets?.quadruplet || {}) },
        quintuplet: { ...DEFAULT_APP_SETTINGS.tuplets.quintuplet, ...(parsed.tuplets?.quintuplet || {}) },
        sextuplet: { ...DEFAULT_APP_SETTINGS.tuplets.sextuplet, ...(parsed.tuplets?.sextuplet || {}) },
        septuplet: { ...DEFAULT_APP_SETTINGS.tuplets.septuplet, ...(parsed.tuplets?.septuplet || {}) },
      },
      intervals: {
        ...DEFAULT_APP_SETTINGS.intervals,
        ...(parsed.intervals || {}),
      },
    };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

/**
 * Saves current settings to localStorage.
 */
export function saveStoredSettings(settings: AppSettings): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota or private-browsing errors
  }
}

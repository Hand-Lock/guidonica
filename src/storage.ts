import {
  AppSettings,
  DEFAULT_TUPLET_OPTIONS,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  SoundProfile,
  ThemeMode,
  ZoomMode,
} from './notation/types';

export const STORAGE_KEY = 'guidonica_settings_v1';
export const LEGACY_STORAGE_KEY_V2 = 'solfege_scroller_settings_v2';
export const LEGACY_STORAGE_KEY_V1 = 'solfege_scroller_settings_v1';

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
  soundProfile: 'woodblock',
  pulse68: 'dotted-quarter',
  countIn: true,
  theme: 'auto',
  volume: 0.8,
  isMuted: false,
  zoom: DEFAULT_ZOOM,
  zoomMode: 'auto',
};

/**
 * Loads stored settings from localStorage with deep merging, validation, and legacy migrations.
 */
export function loadStoredSettings(): AppSettings {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    let isLegacyV1 = false;
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY_V2);
    }
    if (!raw) {
      raw = window.localStorage.getItem(LEGACY_STORAGE_KEY_V1);
      if (raw) isLegacyV1 = true;
    }
    if (!raw) {
      return { ...DEFAULT_APP_SETTINGS };
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    const solfegeLabelMode =
      parsed.solfegeLabelMode === 'none' ||
      parsed.solfegeLabelMode === 'solfege' ||
      parsed.solfegeLabelMode === 'italian' ||
      parsed.solfegeLabelMode === 'letters'
        ? parsed.solfegeLabelMode
        : DEFAULT_APP_SETTINGS.solfegeLabelMode;

    let soundProfile: SoundProfile = DEFAULT_APP_SETTINGS.soundProfile;
    if (parsed.soundProfile === 'woodblock') {
      soundProfile = 'woodblock';
    } else if (parsed.soundProfile === 'triangle') {
      soundProfile = isLegacyV1 ? 'woodblock' : 'triangle';
    }

    let theme: ThemeMode = DEFAULT_APP_SETTINGS.theme;
    if (parsed.theme === 'dark') {
      theme = 'dark';
    } else if (parsed.theme === 'light') {
      theme = isLegacyV1 ? 'auto' : 'light';
    } else if (parsed.theme === 'auto') {
      theme = 'auto';
    }

    let zoom = DEFAULT_APP_SETTINGS.zoom;
    if (typeof parsed.zoom === 'number' && !isNaN(parsed.zoom)) {
      zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, parsed.zoom));
    }

    let zoomMode: ZoomMode = DEFAULT_APP_SETTINGS.zoomMode;
    if (parsed.zoomMode === 'auto' || parsed.zoomMode === 'manual') {
      zoomMode = parsed.zoomMode;
    } else if (
      typeof parsed.zoom === 'number' &&
      !isNaN(parsed.zoom) &&
      Math.abs(parsed.zoom - DEFAULT_ZOOM) > 0.001
    ) {
      zoomMode = 'manual';
    }

    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      solfegeLabelMode,
      soundProfile,
      theme,
      zoom,
      zoomMode,
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

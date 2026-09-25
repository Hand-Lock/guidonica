import {
  AppSettings,
  CLEFS,
  Clef,
  DEFAULT_TUPLET_OPTIONS,
  DEFAULT_ZOOM,
  MAX_TEMPO,
  MAX_ZOOM,
  MIN_TEMPO,
  MIN_ZOOM,
  Pulse68Mode,
  SolfegeLabelMode,
  SoundProfile,
  TIME_SIGNATURES,
  TUPLET_NAMES,
  ThemeMode,
  TimeSignature,
  TupletOptions,
  ZoomMode,
  clampTempo,
} from './notation/types';

const SOLFEGE_LABEL_MODES: readonly SolfegeLabelMode[] = ['none', 'solfege', 'italian', 'letters'];
const SOUND_PROFILES: readonly SoundProfile[] = ['woodblock', 'triangle'];
const PULSE_68_MODES: readonly Pulse68Mode[] = ['dotted-quarter', 'eighth'];
const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark'];
const ZOOM_MODES: readonly ZoomMode[] = ['auto', 'manual'];

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
    dotted: true,
  },
  tuplets: structuredClone(DEFAULT_TUPLET_OPTIONS),
  rests: false,
  ties: false,
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
  showPlayhead: true,
};

type Parsed = Record<string, unknown>;

function isRecord(value: unknown): value is Parsed {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

/** Validates every boolean flag of a flat record against its defaults' key set. */
function pickBoolRecord<T extends { [K in keyof T]: boolean }>(value: unknown, defaults: T): T {
  const result = { ...defaults };
  if (!isRecord(value)) return result;
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    result[key] = pickBool(value[key], defaults[key]) as T[keyof T & string];
  }
  return result;
}

function pickTuplets(value: unknown): TupletOptions {
  const tuplets = structuredClone(DEFAULT_APP_SETTINGS.tuplets);
  if (!isRecord(value)) return tuplets;
  for (const name of TUPLET_NAMES) {
    tuplets[name] = pickBoolRecord(value[name], tuplets[name]);
  }
  return tuplets;
}

/**
 * Loads stored settings from localStorage, validating every field individually
 * (never spreading unvalidated JSON) and applying legacy migrations.
 */
export function loadStoredSettings(): AppSettings {
  const defaults = (): AppSettings => structuredClone(DEFAULT_APP_SETTINGS);
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults();
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
      return defaults();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return defaults();
    }
    const d = DEFAULT_APP_SETTINGS;

    // Legacy v1 'triangle' / 'light' predate the woodblock profile and auto theme
    let soundProfile = pickEnum<SoundProfile>(parsed.soundProfile, SOUND_PROFILES, d.soundProfile);
    if (isLegacyV1 && soundProfile === 'triangle') soundProfile = 'woodblock';
    let theme = pickEnum<ThemeMode>(parsed.theme, THEME_MODES, d.theme);
    if (isLegacyV1 && theme === 'light') theme = 'auto';

    const zoom = pickNumber(parsed.zoom, MIN_ZOOM, MAX_ZOOM, d.zoom);
    // Settings saved before zoomMode existed: a non-default zoom was a manual choice
    const zoomMode = pickEnum<ZoomMode>(
      parsed.zoomMode,
      ZOOM_MODES,
      Math.abs(zoom - DEFAULT_ZOOM) > 0.001 ? 'manual' : d.zoomMode
    );

    const tuplets = pickTuplets(parsed.tuplets);
    // Migrate the removed hidden `subdivisions.triplets` flag to its visible tuplet cell
    if (isRecord(parsed.subdivisions) && parsed.subdivisions.triplets === true) {
      tuplets.triplet['1/8'] = true;
    }

    return {
      tempo: clampTempo(pickNumber(parsed.tempo, MIN_TEMPO, MAX_TEMPO, d.tempo)),
      timeSignature: pickEnum<TimeSignature>(parsed.timeSignature, TIME_SIGNATURES, d.timeSignature),
      clef: pickEnum<Clef>(parsed.clef, CLEFS, d.clef),
      subdivisions: pickBoolRecord(parsed.subdivisions, d.subdivisions),
      tuplets,
      rests: pickBool(parsed.rests, d.rests),
      ties: pickBool(parsed.ties, d.ties),
      intervals: pickBoolRecord(parsed.intervals, d.intervals),
      solfegeLabelMode: pickEnum<SolfegeLabelMode>(
        parsed.solfegeLabelMode,
        SOLFEGE_LABEL_MODES,
        d.solfegeLabelMode
      ),
      soundProfile,
      pulse68: pickEnum<Pulse68Mode>(parsed.pulse68, PULSE_68_MODES, d.pulse68),
      countIn: pickBool(parsed.countIn, d.countIn),
      theme,
      volume: pickNumber(parsed.volume, 0, 1, d.volume),
      isMuted: pickBool(parsed.isMuted, d.isMuted),
      zoom,
      zoomMode,
      showPlayhead: pickBool(parsed.showPlayhead, d.showPlayhead),
    };
  } catch {
    return defaults();
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

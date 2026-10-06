import {
  AppSettings,
  CLEFS,
  Clef,
  DEFAULT_TUPLET_OPTIONS,
  DRONE_NOTES,
  DRONE_SOUNDS,
  DroneNote,
  DroneSound,
  DEFAULT_ZOOM,
  LedgerLineOptions,
  MAX_LEDGER_LINES,
  MAX_TEMPO,
  MAX_ZOOM,
  MIN_TEMPO,
  MIN_ZOOM,
  PitchClassOptions,
  SolfegeLabelMode,
  SoundProfile,
  TIME_SIGNATURES,
  TUPLET_NAMES,
  ThemeMode,
  TimeSignature,
  TupletOptions,
  ZoomMode,
  clampTempo,
  parsePulse,
} from './notation/types';
import { SUPPORTED_LANGUAGES, detectLanguage } from './i18n';

const SOLFEGE_LABEL_MODES: readonly SolfegeLabelMode[] = ['none', 'syllables', 'letters'];
// Label modes before ADR 0059: both syllable spellings became the language-driven 'syllables'
const LEGACY_SYLLABLE_MODES: readonly string[] = ['solfege', 'italian'];
const SOUND_PROFILES: readonly SoundProfile[] = ['woodblock', 'triangle'];
const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark'];
const ZOOM_MODES: readonly ZoomMode[] = ['auto', 'manual'];

/**
 * A localStorage key in the channel's namespace (ADR 0078): release keeps the original
 * `guidonica_` keys, nightly on the same origin uses `guidonica_nightly_`.
 */
export function storageKey(name: string, channel: 'release' | 'nightly' = __APP_CHANNEL__): string {
  return (channel === 'nightly' ? 'guidonica_nightly_' : 'guidonica_') + name;
}

export const STORAGE_KEY = storageKey('settings_v1');
export const LEGACY_STORAGE_KEY_V2 = 'solfege_scroller_settings_v2';
export const LEGACY_STORAGE_KEY_V1 = 'solfege_scroller_settings_v1';
/** Keys read before STORAGE_KEY existed; nightly never had them and never reads them. */
const LEGACY_KEYS: readonly string[] =
  __APP_CHANNEL__ === 'nightly' ? [] : [LEGACY_STORAGE_KEY_V2, LEGACY_STORAGE_KEY_V1];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  tempo: 60,
  timeSignature: '4/4',
  clef: 'treble',
  ledgerLines: { above: 3, below: 3 },
  subdivisions: {
    whole: true,
    half: true,
    quarter: true,
    eighth: true,
    sixteenth: false,
    thirtySecond: false,
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
  pitchClasses: { c: true, d: true, e: true, f: true, g: true, a: true, b: true },
  solfegeLabelMode: 'none',
  language: 'en', // Replaced by the detected browser language on load
  soundProfile: 'woodblock',
  pulse: 'beat',
  countIn: true,
  theme: 'auto',
  volume: 0.8,
  isMuted: false,
  droneNote: 'off',
  droneSound: 'shruti', // Sustained: the steadiest reference to sing against
  droneVolume: 0.6,
  zoom: DEFAULT_ZOOM,
  zoomMode: 'auto',
  showPlayhead: true,
  showTips: true,
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

function pickLedgerLines(value: unknown): LedgerLineOptions {
  const d = DEFAULT_APP_SETTINGS.ledgerLines;
  if (!isRecord(value)) return { ...d };
  const count = (v: unknown, fallback: number): number =>
    Math.round(pickNumber(v, 0, MAX_LEDGER_LINES, fallback));
  return { above: count(value.above, d.above), below: count(value.below, d.below) };
}

/** Pitch-class toggles; a record with every note off loads as all on, like the UI's last-chip guard. */
function pickPitchClasses(value: unknown): PitchClassOptions {
  const classes = pickBoolRecord(value, DEFAULT_APP_SETTINGS.pitchClasses);
  return Object.values(classes).some(Boolean) ? classes : { ...DEFAULT_APP_SETTINGS.pitchClasses };
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
  const defaults = (): AppSettings => ({ ...structuredClone(DEFAULT_APP_SETTINGS), language: detectLanguage() });
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults();
  }

  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    let isLegacyV1 = false;
    for (const key of LEGACY_KEYS) {
      if (raw) break;
      raw = window.localStorage.getItem(key);
      isLegacyV1 = raw !== null && key === LEGACY_STORAGE_KEY_V1;
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
      ledgerLines: pickLedgerLines(parsed.ledgerLines),
      subdivisions: pickBoolRecord(parsed.subdivisions, d.subdivisions),
      tuplets,
      rests: pickBool(parsed.rests, d.rests),
      ties: pickBool(parsed.ties, d.ties),
      intervals: pickBoolRecord(parsed.intervals, d.intervals),
      pitchClasses: pickPitchClasses(parsed.pitchClasses),
      solfegeLabelMode: LEGACY_SYLLABLE_MODES.includes(String(parsed.solfegeLabelMode))
        ? 'syllables'
        : pickEnum<SolfegeLabelMode>(parsed.solfegeLabelMode, SOLFEGE_LABEL_MODES, d.solfegeLabelMode),
      language: pickEnum(parsed.language, SUPPORTED_LANGUAGES, detectLanguage()),
      soundProfile,
      // `compoundPulse` and, before it, `pulse68` are the keys before half-note meters shared
      // the setting (ADR 0076, 0090)
      pulse: parsePulse(parsed.pulse ?? parsed.compoundPulse ?? parsed.pulse68) ?? d.pulse,
      countIn: pickBool(parsed.countIn, d.countIn),
      theme,
      volume: pickNumber(parsed.volume, 0, 1, d.volume),
      isMuted: pickBool(parsed.isMuted, d.isMuted),
      droneNote: pickEnum<DroneNote>(parsed.droneNote, DRONE_NOTES, d.droneNote),
      droneSound: pickEnum<DroneSound>(parsed.droneSound, DRONE_SOUNDS, d.droneSound),
      droneVolume: pickNumber(parsed.droneVolume, 0, 1, d.droneVolume),
      zoom,
      zoomMode,
      showPlayhead: pickBool(parsed.showPlayhead, d.showPlayhead),
      showTips: pickBool(parsed.showTips, d.showTips),
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

export const ONBOARDED_KEY = storageKey('onboarded_v1');

/** True when any current or legacy settings record exists (i.e. a returning user). */
export function hasStoredSettings(): boolean {
  try {
    const storage = window.localStorage;
    return [STORAGE_KEY, ...LEGACY_KEYS].some(
      (key) => storage.getItem(key) !== null
    );
  } catch {
    return false;
  }
}

/** True once the onboarding intro has been completed, skipped or dismissed. */
export function isOnboarded(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDED_KEY) !== null;
  } catch {
    return false;
  }
}

export function markOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    // Ignore quota or private-browsing errors
  }
}

export const ORIENTATION_TIP_KEY = storageKey('orientation_tip_v1');

/** True once the portrait "use landscape" tip has been dismissed (ADR 0055). */
export function isOrientationTipDismissed(): boolean {
  try {
    return window.localStorage.getItem(ORIENTATION_TIP_KEY) !== null;
  } catch {
    return false;
  }
}

export function dismissOrientationTip(): void {
  try {
    window.localStorage.setItem(ORIENTATION_TIP_KEY, '1');
  } catch {
    // Ignore quota or private-browsing errors
  }
}

export const TIP_COUNT_KEY = storageKey('tip_count_v1');

/** How many rotating tips have been shown (ADR 0087); 0 when missing or invalid. */
export function loadTipCount(): number {
  try {
    const raw = window.localStorage.getItem(TIP_COUNT_KEY);
    const count = raw === null ? 0 : Number(raw);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  } catch {
    return 0;
  }
}

export function saveTipCount(count: number): void {
  try {
    window.localStorage.setItem(TIP_COUNT_KEY, String(count));
  } catch {
    // Ignore quota or private-browsing errors
  }
}

export const SEEN_VERSION_KEY = storageKey('seen_version');

/** The release whose notes the user last saw (ADR 0078); null before versioning or on error. */
export function loadSeenVersion(): string | null {
  try {
    return window.localStorage.getItem(SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

export function saveSeenVersion(version: string): void {
  try {
    window.localStorage.setItem(SEEN_VERSION_KEY, version);
  } catch {
    // Ignore quota or private-browsing errors
  }
}

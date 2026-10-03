import {
  AppSettings,
  Clef,
  DEFAULT_TUPLET_OPTIONS,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletCell,
  TupletOptions,
  supportedTuplets,
} from './notation/types';

/**
 * Level presets for the onboarding intro (ADR 0049). A preset only sets controls the
 * user can already change in Settings; the generator is untouched, so every preset
 * stays inside the ergodic state space of its Ω (AGENTS.md §1).
 */

export type LevelId = 'beginner' | 'elementary' | 'intermediate' | 'advanced' | 'virtuoso';

export type PresetSettings = Pick<
  AppSettings,
  | 'tempo'
  | 'timeSignature'
  | 'ledgerLines'
  | 'subdivisions'
  | 'tuplets'
  | 'rests'
  | 'ties'
  | 'intervals'
  | 'solfegeLabelMode'
  | 'countIn'
>;

export interface LevelPreset {
  id: LevelId;
  name: string;
  description: string;
  settings: Readonly<PresetSettings>;
}

export interface IntroClefOption {
  clef: Clef;
  name: string;
  description: string;
}

/** Clefs offered by the intro; the remaining C/F clefs stay available in Settings. */
export const INTRO_CLEF_OPTIONS: readonly IntroClefOption[] = [
  { clef: 'treble', name: 'Treble', description: 'G clef · voice, violin, flute, piano right hand' },
  { clef: 'bass', name: 'Bass', description: 'F clef · cello, bassoon, trombone, piano left hand' },
  { clef: 'alto', name: 'Alto', description: 'C clef on the middle line · viola' },
  { clef: 'tenor', name: 'Tenor', description: 'C clef on the fourth line · upper cello & bassoon' },
];

export const INTRO_CLEFS: readonly Clef[] = INTRO_CLEF_OPTIONS.map((o) => o.clef);

// Every preset is in 4/4; buildPresetSettings() drops any tuplet cell 4/4 cannot realise
const PRESET_METER: TimeSignature = '4/4';

function tuplets(cells: readonly TupletCell[]): TupletOptions {
  const result: TupletOptions = structuredClone(DEFAULT_TUPLET_OPTIONS);
  for (const name of TUPLET_NAMES) {
    for (const value of TUPLET_VALUES) {
      result[name][value] = cells.includes(`${name}:${value}`);
    }
  }
  return result;
}

const ALL_TUPLET_CELLS: readonly TupletCell[] = TUPLET_NAMES.flatMap((name) =>
  TUPLET_VALUES.map((value): TupletCell => `${name}:${value}`)
);

export const LEVEL_PRESETS: readonly LevelPreset[] = [
  {
    id: 'beginner',
    name: 'Beginner',
    description: 'Steps & skips · whole to quarter notes · solfège labels · 50 BPM',
    settings: {
      tempo: 50,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 1, below: 1 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: false,
        sixteenth: false,
        thirtySecond: false,
        dotted: false,
      },
      tuplets: tuplets([]),
      rests: false,
      ties: false,
      intervals: {
        unison: true,
        second: true,
        third: true,
        fourth: false,
        fifth: false,
        sixth: false,
        seventh: false,
        octave: false,
        ninthPlus: false,
      },
      solfegeLabelMode: 'solfege',
      countIn: true,
    },
  },
  {
    id: 'elementary',
    name: 'Elementary',
    description: 'Up to 4ths · eighths, dots & rests · 60 BPM',
    settings: {
      tempo: 60,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 2, below: 2 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: false,
        thirtySecond: false,
        dotted: true,
      },
      tuplets: tuplets([]),
      rests: true,
      ties: false,
      intervals: {
        unison: true,
        second: true,
        third: true,
        fourth: true,
        fifth: false,
        sixth: false,
        seventh: false,
        octave: false,
        ninthPlus: false,
      },
      solfegeLabelMode: 'none',
      countIn: true,
    },
  },
  {
    id: 'intermediate',
    name: 'Intermediate',
    description: 'Up to 5ths · ties & eighth-note triplets · 72 BPM',
    settings: {
      tempo: 72,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 2, below: 2 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: false,
        thirtySecond: false,
        dotted: true,
      },
      tuplets: tuplets(['triplet:1/8']),
      rests: true,
      ties: true,
      intervals: {
        unison: true,
        second: true,
        third: true,
        fourth: true,
        fifth: true,
        sixth: false,
        seventh: false,
        octave: false,
        ninthPlus: false,
      },
      solfegeLabelMode: 'none',
      countIn: true,
    },
  },
  {
    id: 'advanced',
    name: 'Advanced',
    description: 'Up to the octave · sixteenths & triplets · 80 BPM',
    settings: {
      tempo: 80,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 3, below: 3 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: true,
        thirtySecond: false,
        dotted: true,
      },
      tuplets: tuplets(['triplet:1/4', 'triplet:1/8']),
      rests: true,
      ties: true,
      intervals: {
        unison: true,
        second: true,
        third: true,
        fourth: true,
        fifth: true,
        sixth: true,
        seventh: true,
        octave: true,
        ninthPlus: false,
      },
      solfegeLabelMode: 'none',
      countIn: true,
    },
  },
  {
    id: 'virtuoso',
    name: 'Virtuoso',
    description: 'Any leap · 32nds & every tuplet · 92 BPM',
    settings: {
      tempo: 92,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 3, below: 3 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: true,
        thirtySecond: true,
        dotted: true,
      },
      // Every cell requested; supportedTuplets() keeps only those 4/4 can realise
      tuplets: tuplets(ALL_TUPLET_CELLS),
      rests: true,
      ties: true,
      intervals: {
        unison: true,
        second: true,
        third: true,
        fourth: true,
        fifth: true,
        sixth: true,
        seventh: true,
        octave: true,
        ninthPlus: true,
      },
      solfegeLabelMode: 'none',
      countIn: true,
    },
  },
];

function findPreset(level: LevelId): LevelPreset {
  return LEVEL_PRESETS.find((p) => p.id === level) ?? LEVEL_PRESETS[0];
}

/** Settings patch for a level and clef: deep-cloned, tuplets limited to the meter. */
export function buildPresetSettings(level: LevelId, clef: Clef): Partial<AppSettings> {
  const settings = structuredClone(findPreset(level).settings) as PresetSettings;
  settings.tuplets = supportedTuplets(settings.timeSignature, settings.tuplets);
  return { ...settings, clef };
}

/** Key-order-insensitive equality for the plain JSON-like values held in settings. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ra), ...Object.keys(rb)]);
  for (const key of keys) {
    if (!sameValue(ra[key], rb[key])) return false;
  }
  return true;
}

/** The level whose preset matches `settings` exactly (ignoring clef), if any. */
export function matchLevel(settings: Readonly<AppSettings>): LevelId | null {
  for (const preset of LEVEL_PRESETS) {
    const patch = buildPresetSettings(preset.id, settings.clef);
    const keys = Object.keys(patch) as (keyof AppSettings)[];
    if (keys.every((key) => sameValue(patch[key], settings[key]))) return preset.id;
  }
  return null;
}

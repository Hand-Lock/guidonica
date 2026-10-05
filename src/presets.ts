import {
  AppSettings,
  Clef,
  DEFAULT_TUPLET_OPTIONS,
  IntervalOptions,
  MeasureData,
  NoteData,
  PitchClassOptions,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletCell,
  TupletOptions,
  TupletValue,
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
  | 'pitchClasses'
  | 'solfegeLabelMode'
  | 'countIn'
>;

/** Toggles a level's intro preview switches off (never on): preview Ω ⊆ preset Ω (ADR 0051). */
export interface PreviewOmissions {
  subdivisions?: readonly Exclude<keyof SubdivisionOptions, 'dotted'>[];
  intervals?: readonly (keyof IntervalOptions)[];
  tupletValues?: readonly TupletValue[]; // Drops every tuplet cell of these note values
  rests?: false; // Literal false: can only switch rests off
}

/** The notes a level card actually shows, with each note's beat from the strip start (ADR 0052). */
export interface PreviewWindow {
  notes: readonly NoteData[];
  beats: readonly number[];
  length: number; // Visible beats, fractional
}

/** A level's signature: whether a visible window shows what the level is about. */
export type PreviewCheck = (window: PreviewWindow) => boolean;

const base = (note: NoteData): string => note.duration.replace(/r$/, '');

function count(w: PreviewWindow, pred: (note: NoteData) => boolean): number {
  return w.notes.filter(pred).length;
}

/** Distinct beats (floor of the strip beat) holding a matching note. */
function beatsWith(w: PreviewWindow, pred: (note: NoteData) => boolean): number {
  return new Set(w.beats.filter((_, i) => pred(w.notes[i])).map(Math.floor)).size;
}

/** Beats a figure must cover: every whole visible beat, at most two. */
function need(w: PreviewWindow): number {
  return Math.max(0, Math.min(2, Math.floor(w.length)));
}

/** True when some note is a non-tuplet q with non-tuplet 8s on both sides (8 q 8). */
function hasSyncopation(w: PreviewWindow): boolean {
  const plain = (i: number, d: string): boolean => !w.notes[i].isTuplet && base(w.notes[i]) === d;
  for (let i = 1; i + 1 < w.notes.length; i++) {
    if (plain(i, 'q') && plain(i - 1, '8') && plain(i + 1, '8')) return true;
  }
  return false;
}

/** Names and descriptions live in the locale dictionaries, keyed by id (ADR 0059). */
export interface LevelPreset {
  id: LevelId;
  settings: Readonly<PresetSettings>;
  /** Representation for the intro card: what a 1–3 beat window cannot show well. */
  preview: Readonly<PreviewOmissions>;
  /** Signature a card's visible window must show, else the strip is re-rolled (ADR 0052). */
  check: PreviewCheck;
}

export type IntroClef = 'treble' | 'bass' | 'alto' | 'tenor';

/** Clefs offered by the intro; the remaining C/F clefs stay available in Settings. */
export const INTRO_CLEFS: readonly IntroClef[] = ['treble', 'bass', 'alto', 'tenor'];

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

const ALL_PITCH_CLASSES: Readonly<PitchClassOptions> = { c: true, d: true, e: true, f: true, g: true, a: true, b: true };

// Do-pentatonic: its widest gap is a 3rd, so 2nds and 3rds join it in every clef (ADR 0070)
const DO_PENTATONIC: Readonly<PitchClassOptions> = { ...ALL_PITCH_CLASSES, f: false, b: false };

export const LEVEL_PRESETS: readonly LevelPreset[] = [
  {
    id: 'beginner',
    settings: {
      tempo: 60,
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
      pitchClasses: { ...DO_PENTATONIC },
      solfegeLabelMode: 'syllables',
      countIn: true,
    },
    // Window ≈ 1 bar: a whole note would fill it; repeats show no motion
    preview: { subdivisions: ['whole'], intervals: ['unison'] },
    // q h q / h h motion, not only quarters
    check: (w) => count(w, (n) => base(n) === 'h') > 0,
  },
  {
    id: 'elementary',
    settings: {
      tempo: 70,
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
        fifth: true,
        sixth: false,
        seventh: false,
        octave: true,
        ninthPlus: false,
      },
      pitchClasses: { ...ALL_PITCH_CLASSES },
      solfegeLabelMode: 'none',
      countIn: true,
    },
    // Keep q for qd 8 / 8 q 8; show the new eighths, dots & rests with 3rds to octaves
    preview: { subdivisions: ['whole', 'half'], intervals: ['unison', 'second'] },
    // The dotted or syncopated figure, never rest clutter
    check: (w) => count(w, (n) => n.isRest) <= 1 && (count(w, (n) => base(n) === 'qd') > 0 || hasSyncopation(w)),
  },
  {
    id: 'intermediate',
    settings: {
      tempo: 80,
      timeSignature: PRESET_METER,
      ledgerLines: { above: 2, below: 2 },
      subdivisions: {
        whole: true,
        half: true,
        quarter: true,
        eighth: true,
        sixteenth: true,
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
        sixth: true,
        seventh: true,
        octave: true,
        ninthPlus: false,
      },
      pitchClasses: { ...ALL_PITCH_CLASSES },
      solfegeLabelMode: 'none',
      countIn: true,
    },
    // Only the new 16th figures beside eighth triplets, with ties and 4ths to octaves
    preview: {
      subdivisions: ['whole', 'half', 'quarter', 'eighth'],
      intervals: ['unison', 'second', 'third'],
      rests: false,
    },
    // 16ths and eighth triplets in one window
    check: (w) => count(w, (n) => n.isTuplet === true) > 0 && count(w, (n) => !n.isTuplet && base(n) === '16') > 0,
  },
  {
    id: 'advanced',
    settings: {
      tempo: 90,
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
        ninthPlus: true,
      },
      pitchClasses: { ...ALL_PITCH_CLASSES },
      solfegeLabelMode: 'none',
      countIn: true,
    },
    // No long values or quarter triplets: the new 32nds among 16ths and eighths, 6ths to 9th+ leaps
    preview: {
      subdivisions: ['whole', 'half', 'quarter'],
      intervals: ['unison', 'second', 'third', 'fourth', 'fifth'],
      tupletValues: ['1/4'],
      rests: false,
    },
    // 32nd figures on the visible beats
    check: (w) => beatsWith(w, (n) => !n.isTuplet && base(n) === '32') >= need(w),
  },
  {
    id: 'virtuoso',
    settings: {
      tempo: 120,
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
      pitchClasses: { ...ALL_PITCH_CLASSES },
      solfegeLabelMode: 'none',
      countIn: true,
    },
    // At 360 px/beat a quarter, an eighth or a sparse eighth-tuplet fills the window: 16ths, 32nds & 1/16 tuplets
    preview: {
      subdivisions: ['whole', 'half', 'quarter', 'eighth'],
      intervals: ['unison', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'],
      tupletValues: ['1/4', '1/8'],
      rests: false,
    },
    // A 1/16 tuplet in view, with 32nds or fast tuplets on the visible beats
    check: (w) =>
      count(w, (n) => n.isTuplet === true) > 0 &&
      beatsWith(w, (n) => base(n) === '32' || (n.isTuplet === true && base(n) === '16')) >= need(w),
  },
];

function findPreset(level: LevelId): LevelPreset {
  return LEVEL_PRESETS.find((p) => p.id === level) ?? LEVEL_PRESETS[0];
}

/**
 * The part of a strip a card shows (ADR 0052): every note whose strip beat
 * (`startBeat + beatOffset`) lies before `visibleBeats`.
 */
export function previewWindow(measures: readonly MeasureData[], visibleBeats: number): PreviewWindow {
  const notes: NoteData[] = [];
  const beats: number[] = [];
  for (const measure of measures) {
    for (const note of measure.notes) {
      const beat = measure.startBeat + note.beatOffset;
      if (beat >= visibleBeats) return { notes, beats, length: visibleBeats };
      notes.push(note);
      beats.push(beat);
    }
  }
  return { notes, beats, length: visibleBeats };
}

/** Whether `window` shows `level`'s signature figure. */
export function acceptsPreview(level: LevelId, window: PreviewWindow): boolean {
  return findPreset(level).check(window);
}

/** Settings patch for a level and clef: deep-cloned, tuplets limited to the meter. */
export function buildPresetSettings(level: LevelId, clef: Clef): Partial<AppSettings> {
  const settings = structuredClone(findPreset(level).settings) as PresetSettings;
  settings.tuplets = supportedTuplets(settings.timeSignature, settings.tuplets);
  return { ...settings, clef };
}

/**
 * Settings patch for a level's intro preview (ADR 0051): the preset patch with the
 * level's `preview` omissions switched off. Toggles are only ever cleared, so the
 * preview's Ω is a subset of the level's Ω and every figure shown is reachable there.
 */
export function buildPreviewSettings(level: LevelId, clef: Clef): Partial<AppSettings> {
  const patch = buildPresetSettings(level, clef);
  const { subdivisions, intervals, tuplets } = patch;
  if (!subdivisions || !intervals || !tuplets) return patch;
  const omit = findPreset(level).preview;
  for (const key of omit.subdivisions ?? []) subdivisions[key] = false;
  for (const key of omit.intervals ?? []) intervals[key] = false;
  for (const value of omit.tupletValues ?? []) {
    for (const name of TUPLET_NAMES) tuplets[name][value] = false;
  }
  if (omit.rests === false) patch.rests = false;
  return patch;
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

/** Header difficulty meter (ADR 0053): 0 for Custom, else the preset's 1-based rank. */
export function levelIndex(settings: Readonly<AppSettings>): number {
  const id = matchLevel(settings);
  return id === null ? 0 : LEVEL_PRESETS.findIndex((p) => p.id === id) + 1;
}

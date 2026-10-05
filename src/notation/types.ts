export const CLEFS = [
  'treble',
  'soprano',
  'mezzo-soprano',
  'alto',
  'tenor',
  'baritone-f',
  'baritone-c',
  'bass',
] as const;
export type Clef = (typeof CLEFS)[number];

/** UI languages; each also sets the note-naming convention (ADR 0059). */
export const LANGUAGES = ['en', 'it', 'fr', 'de', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

export const TIME_SIGNATURES = ['4/4', '3/4', '2/4', '6/8', '9/8', '12/8'] as const;
export type TimeSignature = (typeof TIME_SIGNATURES)[number];

export interface MeterConfig {
  beatsPerMeasure: number; // Count of metric beats (compound meters count eighth-note beats)
  beatValue: number; // Denominator of the time signature
  secondsPerBeatFactor: number; // Metric beat length relative to one quarter-note BPM beat
}

/** Single source of truth for meter arithmetic (generator, buffer, metronome, UI). */
export const METER: Record<TimeSignature, MeterConfig> = {
  '4/4': { beatsPerMeasure: 4, beatValue: 4, secondsPerBeatFactor: 1 },
  '3/4': { beatsPerMeasure: 3, beatValue: 4, secondsPerBeatFactor: 1 },
  '2/4': { beatsPerMeasure: 2, beatValue: 4, secondsPerBeatFactor: 1 },
  // At tempo = 60 quarter BPM an eighth-note beat lasts 0.5 s
  '6/8': { beatsPerMeasure: 6, beatValue: 8, secondsPerBeatFactor: 0.5 },
  '9/8': { beatsPerMeasure: 9, beatValue: 8, secondsPerBeatFactor: 0.5 },
  '12/8': { beatsPerMeasure: 12, beatValue: 8, secondsPerBeatFactor: 0.5 },
};

/** Compound meter: eighth-note metric beats grouped in dotted quarters (ADR 0076). */
export function isCompound(ts: TimeSignature): boolean {
  return METER[ts].beatValue === 8;
}

export type BeatAccent = 'primary' | 'secondary' | 'weak';

/**
 * The bar's medium pulses, shared by the click and the beat LEDs (ADR 0072): the middle
 * of 4/4, and every dotted-quarter beat after the downbeat in compound meters (ADR 0076).
 */
const SECONDARY_BEATS: Record<TimeSignature, readonly number[]> = {
  '4/4': [3],
  '3/4': [],
  '2/4': [],
  '6/8': [4],
  '9/8': [4, 7],
  '12/8': [4, 7, 10],
};

/** Metric accent of a 1-based beat: downbeat, a medium pulse, or weak (ADR 0072, 0076). */
export function beatAccent(ts: TimeSignature, beatNumber: number): BeatAccent {
  if (beatNumber === 1) return 'primary';
  return SECONDARY_BEATS[ts].includes(beatNumber) ? 'secondary' : 'weak';
}

export const MIN_TEMPO = 30;
export const MAX_TEMPO = 240;

export function clampTempo(bpm: number): number {
  return Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, Math.round(bpm)));
}

/** Upper-exclusive BPM bounds of the classical tempo markings, ascending. */
const TEMPO_MARKINGS: ReadonlyArray<readonly [number, string]> = [
  [40, 'Grave'],
  [60, 'Largo'],
  [66, 'Larghetto'],
  [76, 'Adagio'],
  [108, 'Andante'],
  [120, 'Moderato'],
  [156, 'Allegro'],
  [176, 'Vivace'],
  [200, 'Presto'],
];

/**
 * Maps a BPM to its conventional Italian tempo marking (non-overlapping ranges).
 */
export function tempoMarking(bpm: number): string {
  for (const [upper, name] of TEMPO_MARKINGS) {
    if (bpm < upper) return name;
  }
  return 'Prestissimo';
}

export interface IntervalOptions {
  unison: boolean; // 1st: same note / repeat (0 steps)
  second: boolean; // 2nd: step (1 step)
  third: boolean; // 3rd: skip (2 steps)
  fourth: boolean; // 4th (3 steps)
  fifth: boolean; // 5th (4 steps)
  sixth: boolean; // 6th (5 steps)
  seventh: boolean; // 7th (6 steps)
  octave: boolean; // 8ve: octave leap (7 steps)
  ninthPlus: boolean; // 9+: ninth and plus / compound intervals (8+ steps)
}

/** The seven diatonic pitch classes, indexed like the generator's step letters (c = 0 ... b = 6). */
export const PITCH_CLASSES = ['c', 'd', 'e', 'f', 'g', 'a', 'b'] as const;
export type PitchClass = (typeof PITCH_CLASSES)[number];

/** Notes the walk may use, in every octave of the clef and ledger-line range (ADR 0070). */
export type PitchClassOptions = Record<PitchClass, boolean>;

/** Ledger lines reachable above / below the staff (0 to MAX_LEDGER_LINES each). */
export const MAX_LEDGER_LINES = 3; // Bounded by the MEASURE_CANVAS_HEIGHT geometry

export interface LedgerLineOptions {
  above: number;
  below: number;
}

export interface ClefPitchConfig {
  bottomLine: string; // Bottom staff line; pitch bounds derive from it and the ledger-line setting
  defaultAnchor: string;
  restPitch: string; // Middle staff line, where rests are positioned
}

export const TUPLET_NAMES = [
  'duplet',
  'triplet',
  'quadruplet',
  'quintuplet',
  'sextuplet',
  'septuplet',
] as const;
export type TupletName = (typeof TUPLET_NAMES)[number];

export const TUPLET_VALUES = ['1/4', '1/8', '1/16'] as const;
export type TupletValue = (typeof TUPLET_VALUES)[number];

export type TupletOptions = Record<TupletName, Record<TupletValue, boolean>>;

export const DEFAULT_TUPLET_OPTIONS: Readonly<TupletOptions> = {
  duplet: { '1/4': false, '1/8': false, '1/16': false },
  triplet: { '1/4': false, '1/8': false, '1/16': false },
  quadruplet: { '1/4': false, '1/8': false, '1/16': false },
  quintuplet: { '1/4': false, '1/8': false, '1/16': false },
  sextuplet: { '1/4': false, '1/8': false, '1/16': false },
  septuplet: { '1/4': false, '1/8': false, '1/16': false },
};

export type TupletCell = `${TupletName}:${TupletValue}`;

// Tuplets available in every simple meter (per-beat and 2-beat groups)
const SIMPLE_METER_TUPLETS: readonly TupletCell[] = [
  'triplet:1/4',
  'triplet:1/8',
  'triplet:1/16',
  'quintuplet:1/8',
  'quintuplet:1/16',
  'sextuplet:1/8',
  'sextuplet:1/16',
  'septuplet:1/8',
  'septuplet:1/16',
];

// Tuplets available in every compound meter: duple divisions of dotted groups (ADR 0076)
const COMPOUND_METER_TUPLETS: readonly TupletCell[] = [
  'duplet:1/4',
  'duplet:1/8',
  'duplet:1/16',
  'triplet:1/16',
  'quadruplet:1/4',
  'quadruplet:1/8',
  'quadruplet:1/16',
];

/**
 * Single source of truth for which tuplet cells are musically meaningful per meter.
 * The generator only draws from supported cells and the UI disables the rest, so
 * every enabled cell is reachable (P > 0) and no checked cell is silently ignored.
 * - Quint/sext/septuplet ¼ span a whole 4/4 bar (5/6/7:4).
 * - Duplet ¼ and quadruplet ¼/⅛ divide the 3-beat 3/4 bar (2:3, 4:3, 4:6).
 * - Compound meters use duple divisions of their dotted groups: duplet/quadruplet ¼
 *   across two dotted-quarter beats, ⅛ across one, 1/16 across each dotted-eighth
 *   half-beat; triplet 1/16 divides a single eighth (ADR 0076).
 */
export const TUPLET_SUPPORT: Record<TimeSignature, ReadonlySet<TupletCell>> = {
  '2/4': new Set(SIMPLE_METER_TUPLETS),
  '3/4': new Set<TupletCell>([
    ...SIMPLE_METER_TUPLETS,
    'duplet:1/4',
    'quadruplet:1/4',
    'quadruplet:1/8',
  ]),
  '4/4': new Set<TupletCell>([
    ...SIMPLE_METER_TUPLETS,
    'quintuplet:1/4',
    'sextuplet:1/4',
    'septuplet:1/4',
  ]),
  '6/8': new Set(COMPOUND_METER_TUPLETS),
  '9/8': new Set(COMPOUND_METER_TUPLETS),
  '12/8': new Set(COMPOUND_METER_TUPLETS),
};

export function isTupletSupported(ts: TimeSignature, name: TupletName, value: TupletValue): boolean {
  return TUPLET_SUPPORT[ts].has(`${name}:${value}`);
}

/** "n in the time of d" for each tuplet, as the generator writes it (ADR 0059). */
const TUPLET_RATIO: Record<TupletName, readonly [number, number]> = {
  duplet: [2, 3],
  triplet: [3, 2],
  quadruplet: [4, 3],
  quintuplet: [5, 4],
  sextuplet: [6, 4],
  septuplet: [7, 4],
};

const TUPLET_VALUE_WHOLES: Record<TupletValue, number> = { '1/4': 1 / 4, '1/8': 1 / 8, '1/16': 1 / 16 };

/**
 * Ratio and span of a supported tuplet cell in `ts`. `beats` counts the meter's beats
 * (dotted quarters in compound meters). Only 3/4 quadruplet 1/8 departs from the table: 4:6 across the bar.
 */
export function tupletShape(
  ts: TimeSignature,
  name: TupletName,
  value: TupletValue
): { notes: number; inTimeOf: number; beats: number } {
  const [notes, base] = TUPLET_RATIO[name];
  const inTimeOf = ts === '3/4' && name === 'quadruplet' && value === '1/8' ? 6 : base;
  const beatWholes = isCompound(ts) ? 3 / 8 : 1 / 4;
  return { notes, inTimeOf, beats: (inTimeOf * TUPLET_VALUE_WHOLES[value]) / beatWholes };
}

/** Where one tuplet group may start: offsets (metric beats) within a repeating period. */
export interface TupletPlacement {
  period: number;
  offsets: readonly number[];
}

const ON_EACH_BEAT: TupletPlacement = { period: 1, offsets: [0] };
const ON_EACH_HALF_BEAT: TupletPlacement = { period: 0.5, offsets: [0] };

/** Two-beat groups: on beat 1 (and 3 in 4/4); in 3/4, on beat 1 or 2 (ADR 0065). */
function simpleMeterTupletPlacements(twoBeat: TupletPlacement): Partial<Record<TupletCell, TupletPlacement>> {
  return {
    'triplet:1/4': twoBeat,
    'triplet:1/8': ON_EACH_BEAT,
    'triplet:1/16': ON_EACH_HALF_BEAT,
    'quintuplet:1/8': twoBeat,
    'quintuplet:1/16': ON_EACH_BEAT,
    'sextuplet:1/8': twoBeat,
    'sextuplet:1/16': ON_EACH_BEAT,
    'septuplet:1/8': twoBeat,
    'septuplet:1/16': ON_EACH_BEAT,
  };
}

/**
 * Compound meters: ⅛ cells on each dotted-quarter beat, 1/16 duplets and quadruplets on
 * each dotted-eighth half-beat, the 1/16 triplet on every eighth; two-beat ¼ cells where
 * `twoBeat` puts them (ADR 0076).
 */
function compoundMeterTupletPlacements(twoBeat: TupletPlacement): Partial<Record<TupletCell, TupletPlacement>> {
  return {
    'duplet:1/4': twoBeat,
    'quadruplet:1/4': twoBeat,
    'duplet:1/8': { period: 3, offsets: [0] },
    'quadruplet:1/8': { period: 3, offsets: [0] },
    'duplet:1/16': { period: 1.5, offsets: [0] },
    'quadruplet:1/16': { period: 1.5, offsets: [0] },
    'triplet:1/16': ON_EACH_BEAT,
  };
}

/**
 * Tuplet placement table: where a group of each supported cell may start, the tuplet
 * counterpart of NOTEHEAD_PLACEMENTS (ties.ts). Its keys are exactly TUPLET_SUPPORT[ts];
 * a group's span comes from tupletSpan(). Bar-long cells start only at 0 (ADR 0065).
 */
export const TUPLET_PLACEMENTS: Record<TimeSignature, Partial<Record<TupletCell, TupletPlacement>>> = {
  '2/4': simpleMeterTupletPlacements({ period: 2, offsets: [0] }),
  '3/4': {
    ...simpleMeterTupletPlacements({ period: 3, offsets: [0, 1] }),
    'duplet:1/4': { period: 3, offsets: [0] },
    'quadruplet:1/4': { period: 3, offsets: [0] },
    'quadruplet:1/8': { period: 3, offsets: [0] },
  },
  '4/4': {
    ...simpleMeterTupletPlacements({ period: 2, offsets: [0] }),
    'quintuplet:1/4': { period: 4, offsets: [0] },
    'sextuplet:1/4': { period: 4, offsets: [0] },
    'septuplet:1/4': { period: 4, offsets: [0] },
  },
  // Two-beat ¼ cells: beats 1 (and 3) like 4/4's two-beat groups; in 9/8 beat 1 or 2, like 3/4
  '6/8': compoundMeterTupletPlacements({ period: 6, offsets: [0] }),
  '9/8': compoundMeterTupletPlacements({ period: 9, offsets: [0, 3] }),
  '12/8': compoundMeterTupletPlacements({ period: 6, offsets: [0] }),
};

/** Span of one group of a supported cell in metric beats (eighths in compound meters). */
export function tupletSpan(ts: TimeSignature, name: TupletName, value: TupletValue): number {
  return tupletShape(ts, name, value).beats * (isCompound(ts) ? 3 : 1);
}

/** Returns a copy of `tuplets` with every cell unsupported by `ts` switched off. */
export function supportedTuplets(ts: TimeSignature, tuplets: TupletOptions): TupletOptions {
  const result = structuredClone(DEFAULT_TUPLET_OPTIONS) as TupletOptions;
  for (const name of TUPLET_NAMES) {
    for (const value of TUPLET_VALUES) {
      result[name][value] = tuplets[name][value] && isTupletSupported(ts, name, value);
    }
  }
  return result;
}

export interface SubdivisionOptions {
  whole: boolean;
  half: boolean;
  quarter: boolean;
  eighth: boolean;
  sixteenth: boolean;
  /** 32nd notes (and, with dotted, the dotted 16th). Missing = off. */
  thirtySecond?: boolean;
  dotted?: boolean;
}

/** Note labels drawn beside noteheads; the UI language supplies the spelling (ADR 0059). */
export type SolfegeLabelMode = 'none' | 'syllables' | 'letters';
export type SoundProfile = 'triangle' | 'woodblock';
export type CompoundPulseMode = 'dotted-quarter' | 'eighth';
export type ThemeMode = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Single source of truth for every colour painted onto the notation canvas.
 * Staff lines (scroller) and VexFlow ledger lines/barlines (renderer) share
 * `staff`, so ledger lines never read brighter than the stave. `playhead`
 * mirrors the CSS `--playhead-color` token of the same theme.
 */
export interface CanvasPalette {
  background: string;
  backgroundRgb: string;
  staff: string;
  ink: string;
  tuplet: string;
  solfege: string;
  playhead: string;
  playheadRgb: string;
}

export const CANVAS_PALETTE: Record<ResolvedTheme, CanvasPalette> = {
  light: {
    background: '#ffffff',
    backgroundRgb: '255, 255, 255',
    staff: '#64748b',
    ink: '#000000',
    tuplet: '#334155',
    solfege: '#007a62',
    playhead: '#e11d48',
    playheadRgb: '225, 29, 72',
  },
  dark: {
    background: '#0f172a',
    backgroundRgb: '15, 23, 42',
    staff: '#64748b',
    ink: '#f8fafc',
    tuplet: '#cbd5e1',
    solfege: '#00ffcc',
    playhead: '#f43f5e',
    playheadRgb: '244, 63, 94',
  },
};

/**
 * Checks whether the host operating system currently prefers dark mode cross-platform.
 */
export function isSystemDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Resolves a ThemeMode ('auto' | 'light' | 'dark') to an explicit display theme ('light' | 'dark').
 */
export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === 'auto') {
    return isSystemDark() ? 'dark' : 'light';
  }
  return theme;
}

/**
 * Subscribes to OS color scheme preference changes with cross-platform fallback.
 */
export function subscribeSystemTheme(callback: (isDark: boolean) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent | MediaQueryList): void => {
    callback(e.matches);
  };

  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  } else if ('addListener' in mq) {
    // Safari < 14 fallback
    (mq as unknown as { addListener: (cb: (e: MediaQueryList) => void) => void }).addListener(handler);
    return () =>
      (mq as unknown as { removeListener: (cb: (e: MediaQueryList) => void) => void }).removeListener(handler);
  }
  return () => {};
}

export type ZoomMode = 'auto' | 'manual';

export interface AppSettings {
  tempo: number; // MIN_TEMPO-MAX_TEMPO BPM
  timeSignature: TimeSignature;
  clef: Clef;
  ledgerLines: LedgerLineOptions;
  subdivisions: SubdivisionOptions;
  tuplets: TupletOptions;
  rests: boolean;
  ties: boolean;
  intervals: IntervalOptions;
  pitchClasses: PitchClassOptions;
  solfegeLabelMode: SolfegeLabelMode;
  language: Language; // UI language and national note naming (ADR 0059)
  soundProfile: SoundProfile;
  compoundPulse: CompoundPulseMode;
  countIn: boolean;
  theme: ThemeMode;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
  zoom: number; // 0.3 to 1.5 (default 1.0)
  zoomMode: ZoomMode;
  showPlayhead: boolean; // default true: stationary red playhead cursor line
}

export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.5;
export const DEFAULT_ZOOM = 1.0;
export const ZOOM_STEP = 0.1;

export type PlaybackState = 'stopped' | 'counting-in' | 'playing' | 'paused';

export interface NoteData {
  keys: string[]; // e.g. ['c/4']
  duration: string; // VexFlow duration string: 'w', 'h', 'q', '8', '16', 'hd', 'qd', '8d'
  isRest: boolean;
  isTuplet?: boolean;
  tupletGroup?: number;
  tupletNumNotes?: number; // e.g. 2, 3, 4, 5, 6, 7
  tupletNotesOccupied?: number; // e.g. 2, 3, 4
  tieStart?: boolean;
  tieEnd?: boolean;
  beatOffset: number; // Beat offset within the measure (0-indexed)
  beatDuration: number; // Duration measured in metric beats
}

export interface MeasureData {
  index: number; // Sequential measure index: 0, 1, 2...
  notes: NoteData[];
  clef: Clef;
  timeSignature: TimeSignature;
  beatsPerMeasure: number; // Count of metric beats (e.g., 4 for 4/4, 12 for 12/8)
  beatValue: number; // Denominator (e.g. 4 for 4/4, 8 for 6/8)
  beatWidth: number; // Metric beat width (px) dynamically sized for active subdivisions
  width: number; // Measure pixel width
  startBeat: number; // Global start beat offset from beginning of piece
  /**
   * Tie arriving at notes[0] from the previous bar's last note. Self-contained (the
   * previous note's layout, not a reference to that measure), so re-rendering and
   * eviction never depend on a neighbouring measure.
   */
  tieIn?: {
    beatOffset: number; // Previous note's beat offset within the previous bar
    duration: string; // Previous note's VexFlow duration
    beatWidth: number; // Previous bar's beat width (px)
    measureWidth: number; // Previous bar's width (px)
  };
}

export interface RenderedMeasure {
  data: MeasureData;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Global metric layout constants */
export const NOTE_START_OFFSET = 26; // Padding before beat 0 after the left barline
export const MEASURE_CANVAS_HEIGHT = 220;

/** True when a stage of `stageHeight` CSS px shows the whole measure canvas at `zoom` (ADR 0054). */
export function stageFitsStaff(stageHeight: number, zoom: number): boolean {
  return stageHeight >= MEASURE_CANVAS_HEIGHT * zoom;
}
export const STAVE_CANVAS_Y = 40;
export const STAVE_TOP_LINE_Y = 80; // In VexFlow, stave.getYForLine(0) = STAVE_CANVAS_Y + 4 * 10 = 80

/** Stationary pinned clef + time signature layout constants */
export const PINNED_HEADER_WIDTH = 115; // Offscreen canvas width for clef + time signature
export const PINNED_HEADER_OFFSET_X = 20; // Left margin indent of pinned header
export const PINNED_HEADER_MASK_WIDTH = 135; // Opaque mask protecting stationary header from scrolling notes
export const PINNED_HEADER_FADE_WIDTH = 40; // Horizontal width of gradient fade
export const PINNED_HEADER_TOTAL_MARGIN = PINNED_HEADER_MASK_WIDTH + PINNED_HEADER_FADE_WIDTH; // 175
export const PLAYHEAD_MIN_CLEARANCE = 30; // Clearance between fade margin and fixed playhead
export const MIN_PLAYHEAD_X = PINNED_HEADER_TOTAL_MARGIN + PLAYHEAD_MIN_CLEARANCE; // 205

/**
 * Computes the metric beat width (W_beat) beforehand based on the active
 * subdivisions, tuplets, and time signature.
 * Sizing the beat width beforehand guarantees that measures saturated with the highest
 * enabled subdivision (e.g. 16th notes, fast tuplets) have sufficient horizontal room
 * so notes, stems, beams, and barlines never collide or overshoot the measure boundary,
 * while maintaining a perfectly constant scrolling velocity throughout playback.
 */
export function computeBeatWidth(
  subdivisions: SubdivisionOptions,
  timeSignature: TimeSignature,
  requestedTuplets?: TupletOptions
): number {
  // Cells unsupported by this meter never generate, so they must not widen spacing
  const tuplets = requestedTuplets && supportedTuplets(timeSignature, requestedTuplets);
  const has16thTuplet =
    tuplets &&
    (tuplets.septuplet['1/16'] ||
      tuplets.sextuplet['1/16'] ||
      tuplets.quintuplet['1/16'] ||
      tuplets.quadruplet['1/16'] ||
      tuplets.triplet['1/16'] ||
      tuplets.duplet['1/16']);

  const hasSeptuplet16 = tuplets?.septuplet['1/16'];
  const hasSextuplet16 = tuplets?.sextuplet['1/16'];
  const hasQuintuplet16 = tuplets?.quintuplet['1/16'];

  const has8thTuplet =
    tuplets &&
    (tuplets.septuplet['1/8'] ||
      tuplets.sextuplet['1/8'] ||
      tuplets.quintuplet['1/8'] ||
      tuplets.quadruplet['1/8'] ||
      tuplets.triplet['1/8'] ||
      tuplets.duplet['1/8']);

  if (isCompound(timeSignature)) {
    // Compound meters: per-eighth-beat widths, whatever the bar length.
    if (subdivisions.thirtySecond) {
      // 32nd note = 0.25 eighth beat -> 45px spacing per 32nd (180px per eighth beat)
      return 180;
    }
    if (subdivisions.sixteenth || has16thTuplet) {
      return 110;
    }
    if (tuplets?.quadruplet['1/8'] || tuplets?.duplet['1/8']) {
      return 95;
    }
    // Eighth notes only
    return 80;
  }

  // Simple meters (4/4, 3/4, 2/4): 1 beat = 1 quarter note.
  if (subdivisions.thirtySecond) {
    // 32nd note = 0.125 beat -> 45px spacing per 32nd (360px per quarter beat),
    // wider than every 16th-tuplet spacing below
    return 360;
  }
  if (hasSeptuplet16) {
    // 7 sixteenth notes in 1 beat -> 40px spacing per note (280px per beat)
    return 280;
  }
  if (hasSextuplet16 || hasQuintuplet16) {
    // 5 or 6 sixteenth notes in 1 beat -> 42-48px spacing per note (250px per beat)
    return 250;
  }
  if (subdivisions.sixteenth || has16thTuplet) {
    // 16th note = 0.25 beat -> 55px spacing per 16th note (220px per quarter beat)
    return 220;
  }
  if (has8thTuplet) {
    // Triplet eighth = 1/3 beat -> 55px spacing per triplet note (165px per quarter beat)
    return 165;
  }
  if (subdivisions.eighth) {
    // 8th note = 0.5 beat -> 65px spacing per 8th note (130px per quarter beat)
    return 130;
  }
  // Quarter notes, half notes, whole notes:
  return 110;
}

/**
 * Returns the count of metric beats in a measure for a given time signature.
 */
export function getBeatsPerMeasure(ts: TimeSignature): number {
  return METER[ts].beatsPerMeasure;
}

/**
 * Computes the optimal / recommended zoom scale for a given viewport width and measure settings.
 * Ensures that at least one full measure can be seen at once across the visible stave for proper
 * sight-reading forereading, while capping the default at 1.0 (100%) on larger screens where
 * multiple measures naturally fit.
 */
export function computeOptimalZoom(
  viewportWidth: number,
  subdivisions: SubdivisionOptions,
  timeSignature: TimeSignature,
  tuplets?: TupletOptions
): number {
  const beatWidth = computeBeatWidth(subdivisions, timeSignature, tuplets);
  const beatsPerMeasure = getBeatsPerMeasure(timeSignature);
  const measureWidth = beatsPerMeasure * beatWidth;

  // Space occupied by stationary pinned header solid mask before scaling
  const headerMargin = PINNED_HEADER_MASK_WIDTH; // 135

  // Exact scale allowing at least 1 full measure to fit across the visible stave
  const rawFit = viewportWidth / (measureWidth + headerMargin);

  // Quantize to integer staff-line scale (multiples of 0.1 / 10% so 10 * Z is an integer)
  const stepped = Math.round(rawFit * 10) / 10;

  // Cap at 1.0 (100%) on larger screens, and clamp between MIN_ZOOM (0.3) and MAX_ZOOM (1.5)
  return Math.max(MIN_ZOOM, Math.min(DEFAULT_ZOOM, stepped));
}

/**
 * W3C Audio Session API specification types (WebKit Safari 16.4+).
 * Direct mapping to native iOS AVAudioSessionCategory.
 */
export type AudioSessionType =
  | 'auto'
  | 'playback'
  | 'transient'
  | 'transient-solo'
  | 'ambient'
  | 'play-and-record';

export interface NavigatorAudioSession {
  type: AudioSessionType;
  readonly state?: 'inactive' | 'active' | 'interrupted';
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
}

declare global {
  interface Navigator {
    audioSession?: NavigatorAudioSession;
  }
}

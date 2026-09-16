export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';

export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

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

export interface ClefPitchConfig {
  pitches: string[];
  minPitch: string;
  maxPitch: string;
  defaultAnchor: string;
}

export const CLEF_RANGE_DISPLAY: Record<Clef, string> = {
  treble: 'E3 – F6 (±3 ledger lines)',
  bass: 'G1 – A4 (±3 ledger lines)',
  alto: 'F2 – G5 (±3 ledger lines)',
  tenor: 'D2 – E5 (±3 ledger lines)',
};

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

export const DEFAULT_TUPLET_OPTIONS: TupletOptions = {
  duplet: { '1/4': false, '1/8': false, '1/16': false },
  triplet: { '1/4': false, '1/8': false, '1/16': false },
  quadruplet: { '1/4': false, '1/8': false, '1/16': false },
  quintuplet: { '1/4': false, '1/8': false, '1/16': false },
  sextuplet: { '1/4': false, '1/8': false, '1/16': false },
  septuplet: { '1/4': false, '1/8': false, '1/16': false },
};

export interface SubdivisionOptions {
  whole: boolean;
  half: boolean;
  quarter: boolean;
  eighth: boolean;
  sixteenth: boolean;
  triplets?: boolean;
}

export type SolfegeLabelMode = 'none' | 'solfege' | 'letters';
export type SoundProfile = 'triangle' | 'woodblock';
export type Pulse68Mode = 'dotted-quarter' | 'eighth';
export type ThemeMode = 'light' | 'dark';

export const SOLFEGE_SYLLABLES: Record<string, string> = {
  c: 'Do',
  d: 'Re',
  e: 'Mi',
  f: 'Fa',
  g: 'Sol',
  a: 'La',
  b: 'Ti',
};

export const NOTE_LETTER_NAMES: Record<string, string> = {
  c: 'C',
  d: 'D',
  e: 'E',
  f: 'F',
  g: 'G',
  a: 'A',
  b: 'B',
};

export interface AppSettings {
  tempo: number; // 30-240 BPM
  timeSignature: TimeSignature;
  clef: Clef;
  subdivisions: SubdivisionOptions;
  tuplets: TupletOptions;
  rests: boolean;
  intervals: IntervalOptions;
  solfegeLabelMode: SolfegeLabelMode;
  soundProfile: SoundProfile;
  pulse68: Pulse68Mode;
  countIn: boolean;
  theme: ThemeMode;
  volume: number; // 0.0 to 1.0
  isMuted: boolean;
}

export type PlaybackState = 'stopped' | 'counting-in' | 'playing' | 'paused';

export interface NoteData {
  keys: string[]; // e.g. ['c/4']
  duration: string; // VexFlow duration string: 'w', 'h', 'q', '8', '16'
  isRest: boolean;
  isTuplet?: boolean;
  tupletGroup?: number;
  tupletNumNotes?: number; // e.g. 2, 3, 4, 5, 6, 7
  tupletNotesOccupied?: number; // e.g. 2, 3, 4
  tupletBracketed?: boolean;
  tupletRatioed?: boolean;
  beatOffset: number; // Beat offset within the measure (0-indexed)
  beatDuration: number; // Duration measured in metric beats
}

export interface MeasureData {
  index: number; // Sequential measure index: 0, 1, 2...
  notes: NoteData[];
  clef: Clef;
  timeSignature: TimeSignature;
  beatsPerMeasure: number; // Count of metric beats (e.g., 4 for 4/4, 6 for 6/8)
  beatValue: number; // Denominator (e.g. 4 for 4/4, 8 for 6/8)
  beatWidth: number; // Metric beat width (px) dynamically sized for active subdivisions
  width: number; // Measure pixel width
  startBeat: number; // Global start beat offset from beginning of piece
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
export const STAVE_CANVAS_Y = 40;
export const STAVE_TOP_LINE_Y = 80; // In VexFlow, stave.getYForLine(0) = STAVE_CANVAS_Y + 4 * 10 = 80

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
  tuplets?: TupletOptions
): number {
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

  if (timeSignature === '6/8') {
    // 6/8 compound meter: 6 eighth-note beats per measure.
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
  if (has8thTuplet || subdivisions.triplets) {
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

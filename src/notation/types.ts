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

export interface SubdivisionOptions {
  whole: boolean;
  half: boolean;
  quarter: boolean;
  eighth: boolean;
  sixteenth: boolean;
  triplets: boolean;
}

export interface AppSettings {
  tempo: number; // 30-240 BPM
  timeSignature: TimeSignature;
  clef: Clef;
  subdivisions: SubdivisionOptions;
  rests: boolean;
  intervals: IntervalOptions;
}

export type PlaybackState = 'stopped' | 'counting-in' | 'playing' | 'paused';

export interface NoteData {
  keys: string[]; // e.g. ['c/4']
  duration: string; // VexFlow duration string: 'w', 'h', 'q', '8', '16'
  isRest: boolean;
  isTuplet?: boolean;
  tupletGroup?: number;
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
export const DEFAULT_BEAT_WIDTH = 120; // Default fallback pixel width per metric beat
export const NOTE_START_OFFSET = 26; // Padding before beat 0 after the left barline
export const MEASURE_CANVAS_HEIGHT = 180;
export const STAVE_CANVAS_Y = 40;
export const STAVE_TOP_LINE_Y = 80; // In VexFlow, stave.getYForLine(0) = STAVE_CANVAS_Y + 4 * 10 = 80

/**
 * Computes the metric beat width (W_beat) beforehand based on the active
 * subdivisions and time signature.
 * Sizing the beat width beforehand guarantees that measures saturated with the highest
 * enabled subdivision (e.g. 16th notes, triplets) have sufficient horizontal room
 * so notes, stems, beams, and barlines never collide or overshoot the measure boundary,
 * while maintaining a perfectly constant scrolling velocity throughout playback.
 */
export function computeBeatWidth(
  subdivisions: SubdivisionOptions,
  timeSignature: TimeSignature
): number {
  if (timeSignature === '6/8') {
    // 6/8 compound meter: 6 eighth-note beats per measure.
    if (subdivisions.sixteenth) {
      // 16th note = 0.5 eighth beat -> 55px per 16th note (110px per eighth beat)
      return 110;
    }
    // Eighth notes only
    return 80;
  }

  // Simple meters (4/4, 3/4, 2/4): 1 beat = 1 quarter note.
  if (subdivisions.sixteenth) {
    // 16th note = 0.25 beat -> 55px spacing per 16th note (220px per quarter beat)
    return 220;
  }
  if (subdivisions.triplets) {
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

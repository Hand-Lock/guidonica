export type Clef = 'treble' | 'bass' | 'alto' | 'tenor';

export type TimeSignature = '4/4' | '3/4' | '2/4' | '6/8';

export type AllowedIntervals = 'seconds' | 'thirds' | 'octaves' | 'any';

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
  intervals: AllowedIntervals;
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
export const BEAT_WIDTH = 120; // W_beat: pixel width per metric beat
export const NOTE_START_OFFSET = 24; // Padding before beat 0 after the barline
export const MEASURE_CANVAS_HEIGHT = 180;
export const STAVE_CANVAS_Y = 40;

import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  METER,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletName,
  TupletOptions,
  TupletValue,
  ViewMode,
  computeBeatWidth,
  DEFAULT_TUPLET_OPTIONS,
} from './types';
import { MusicGenerator } from './generator';
import { mulberry32 } from './random';

/**
 * Horizontal spacing of one bar (ADR 0109): its body beat width and, in the squishy view,
 * the wider neighbours' beat widths it eases from and to. Without ramps it is the linear
 * layout of SPEC §3.
 */
export interface BeatSpacing {
  beatWidth: number;
  entryBeatWidth?: number;
  exitBeatWidth?: number;
}

/**
 * X of `offset` metric beats into a bar, in measure units (the left barline is x = 0).
 * Without ramps it is NOTE_START_OFFSET + offset·beatWidth, the steady layout. With an entry
 * ramp the velocity falls linearly from entryBeatWidth to beatWidth over the first felt beat
 * (r = beatGroup metric beats); with an exit ramp it rises to exitBeatWidth over the last:
 *
 *   X(o) = 26 + w·o + (e − w)·E(o) + (x − w)·F(o)
 *   E(o) = o − o²/2r for o ≤ r, else r/2
 *   F(o) = 0 for o ≤ B − r, else (o − B + r)²/2r
 *
 * Offsets outside the bar extend its end velocities, so the map is total and increasing.
 */
export function beatX(spacing: BeatSpacing, ts: TimeSignature, offset: number): number {
  const w = spacing.beatWidth;
  const e = spacing.entryBeatWidth;
  const x = spacing.exitBeatWidth;
  if (e === undefined && x === undefined) return NOTE_START_OFFSET + offset * w;
  const { beatsPerMeasure: bar, beatGroup: r } = METER[ts];
  if (offset <= 0) return NOTE_START_OFFSET + offset * (e ?? w);
  if (offset >= bar) return NOTE_START_OFFSET + spacingWidth(spacing, ts) + (offset - bar) * (x ?? w);
  let pos = NOTE_START_OFFSET + w * offset;
  if (e !== undefined) pos += (e - w) * (offset <= r ? offset - (offset * offset) / (2 * r) : r / 2);
  if (x !== undefined) {
    const t = offset - (bar - r);
    if (t > 0) pos += ((x - w) * t * t) / (2 * r);
  }
  return pos;
}

/** Width of a bar with this spacing: w·B, plus half a felt beat of each ramp's extra speed. */
export function spacingWidth(spacing: BeatSpacing, ts: TimeSignature): number {
  const { beatsPerMeasure: bar, beatGroup: r } = METER[ts];
  const w = spacing.beatWidth;
  let width = bar * w;
  if (spacing.entryBeatWidth !== undefined) width += ((spacing.entryBeatWidth - w) * r) / 2;
  if (spacing.exitBeatWidth !== undefined) width += ((spacing.exitBeatWidth - w) * r) / 2;
  return width;
}

const NO_SUBDIVISIONS: SubdivisionOptions = {
  whole: false,
  half: false,
  quarter: false,
  eighth: false,
  sixteenth: false,
  thirtySecond: false,
  dotted: false,
};

/** Base value of a written duration; the breve rides on the whole, a dot on its base. */
const BASE_VALUE: Record<string, keyof SubdivisionOptions> = {
  b: 'whole',
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': 'sixteenth',
  '32': 'thirtySecond',
};

const TUPLET_VALUE_WHOLES: Record<TupletValue, number> = { '1/4': 1 / 4, '1/8': 1 / 8, '1/16': 1 / 16 };

/** computeBeatWidth with a single option on, per meter: a handful of entries, never more. */
const singleWidths = new Map<string, number>();

function valueWidth(ts: TimeSignature, duration: string): number {
  const key = `${ts}|${duration}`;
  const cached = singleWidths.get(key);
  if (cached !== undefined) return cached;
  const value = BASE_VALUE[duration.endsWith('d') ? duration.slice(0, -1) : duration];
  const subdivisions = value ? { ...NO_SUBDIVISIONS, [value]: true } : NO_SUBDIVISIONS;
  const width = computeBeatWidth(subdivisions, ts);
  singleWidths.set(key, width);
  return width;
}

function cellWidth(ts: TimeSignature, name: TupletName, value: TupletValue): number {
  const key = `${ts}|${name}:${value}`;
  const cached = singleWidths.get(key);
  if (cached !== undefined) return cached;
  const tuplets = structuredClone(DEFAULT_TUPLET_OPTIONS) as TupletOptions;
  tuplets[name][value] = true;
  const width = computeBeatWidth(NO_SUBDIVISIONS, ts, tuplets);
  singleWidths.set(key, width);
  return width;
}

/**
 * The tuplet cell a group was written from: n notes in the time of `inTimeOf` units, the
 * group lasting `beats` metric beats, so one unit is beats / inTimeOf metric beats, i.e.
 * that over beatValue of a whole. Null when no cell matches.
 */
export function tupletCell(
  ts: TimeSignature,
  numNotes: number,
  inTimeOf: number,
  beats: number
): { name: TupletName; value: TupletValue } | null {
  const name = TUPLET_NAMES[numNotes - 2];
  if (name === undefined || inTimeOf <= 0) return null;
  const wholes = beats / inTimeOf / METER[ts].beatValue;
  const value = TUPLET_VALUES.find((v) => Math.abs(TUPLET_VALUE_WHOLES[v] - wholes) < 1e-9);
  return value === undefined ? null : { name, value };
}

/**
 * Body beat width of a bar in the squishy view: the widest per-beat need among its notes.
 * A note needs the linear width of its own value alone (computeBeatWidth with only that
 * value on), a tuplet member that of its cell alone; a note longer than a beat spreads one
 * beat's room over its length. computeBeatWidth is monotone over enabled options, so the
 * result never exceeds the session's linear width; it is capped there all the same.
 */
export function squishyBeatWidth(data: MeasureData, settings: AppSettings): number {
  const ts = data.timeSignature;
  const linear = computeBeatWidth(settings.subdivisions, ts, settings.tuplets);
  const notes = data.notes;
  let width = 0;
  for (let i = 0; i < notes.length; ) {
    const note = notes[i];
    if (note.isTuplet && note.tupletGroup !== undefined) {
      let beats = 0;
      let j = i;
      for (; j < notes.length && notes[j].isTuplet && notes[j].tupletGroup === note.tupletGroup; j++) {
        beats += notes[j].beatDuration;
      }
      width = Math.max(width, groupWidth(ts, note, beats, linear));
      i = j;
    } else {
      width = Math.max(width, valueWidth(ts, note.duration) / Math.max(1, note.beatDuration));
      i++;
    }
  }
  return width > 0 ? Math.min(width, linear) : linear;
}

function groupWidth(ts: TimeSignature, first: NoteData, beats: number, linear: number): number {
  const cell = tupletCell(ts, first.tupletNumNotes ?? 0, first.tupletNotesOccupied ?? 0, beats);
  return cell ? cellWidth(ts, cell.name, cell.value) : linear;
}

/** Whether `b` is the bar right after `a` on the tape. */
function follows(a: MeasureData, b: MeasureData): boolean {
  return b.index === a.index + 1 && b.startBeat === a.startBeat + a.beatsPerMeasure;
}

/**
 * Lays a generated bar out for `view`: a new MeasureData with its beat width, width and,
 * in squishy, the ramps from a wider `prev` and to a wider `next`. `prev` is the previous
 * bar as laid out, `next` the following bar as generated (only its notes are read); either
 * is ignored unless it is the adjacent bar. An incoming tie takes `prev`'s spacing, so both
 * halves still draw the same curve. The notes are shared, never copied or changed.
 */
export function spaceMeasure(
  data: MeasureData,
  prev: MeasureData | null,
  next: MeasureData | null,
  view: ViewMode,
  settings: AppSettings
): MeasureData {
  const ts = data.timeSignature;
  const before = prev && follows(prev, data) ? prev : null;
  const after = next && follows(data, next) ? next : null;
  const { entryBeatWidth: _entry, exitBeatWidth: _exit, tieIn, ...rest } = data;
  const spaced: MeasureData = rest;

  if (view === 'squishy') {
    const w = squishyBeatWidth(data, settings);
    spaced.beatWidth = w;
    if (before && before.beatWidth > w) spaced.entryBeatWidth = before.beatWidth;
    const nextWidth = after ? squishyBeatWidth(after, settings) : 0;
    if (nextWidth > w) spaced.exitBeatWidth = nextWidth;
    spaced.width = spacingWidth(spaced, ts);
  } else {
    spaced.beatWidth = computeBeatWidth(settings.subdivisions, ts, settings.tuplets);
    spaced.width = data.beatsPerMeasure * spaced.beatWidth;
  }

  if (tieIn) {
    spaced.tieIn = before
      ? {
          beatOffset: tieIn.beatOffset,
          duration: tieIn.duration,
          beatWidth: before.beatWidth,
          measureWidth: before.width,
          ...(before.entryBeatWidth !== undefined && { entryBeatWidth: before.entryBeatWidth }),
          ...(before.exitBeatWidth !== undefined && { exitBeatWidth: before.exitBeatWidth }),
        }
      : tieIn;
  }
  return spaced;
}

/** Bars sampled for the typical squishy width; their neighbours are generated too. */
const SAMPLE_BARS = 32;
const SAMPLE_SEED = 0x5eed;

let typicalKey: string | null = null;
let typicalWidth = 0;

/**
 * The squishy view's typical bar width for the session's rhythm: the median width of
 * SAMPLE_BARS bars from a seeded generator, ramps included. Pitch settings are fixed to
 * the defaults, so the answer depends on the rhythm options alone; it is memoised for the
 * last rhythm asked about. The app's auto zoom fits this bar (ADR 0109).
 */
export function typicalBarWidth(settings: AppSettings): number {
  const { timeSignature, subdivisions, tuplets, rests, ties } = settings;
  const key = JSON.stringify([timeSignature, subdivisions, tuplets, rests, ties]);
  if (key === typicalKey) return typicalWidth;

  const d = DEFAULT_APP_SETTINGS;
  const sample: AppSettings = {
    ...settings,
    clef: d.clef,
    ledgerLines: d.ledgerLines,
    intervals: d.intervals,
    pitchClasses: d.pitchClasses,
  };
  const generator = new MusicGenerator(mulberry32(SAMPLE_SEED));
  const beats = METER[timeSignature].beatsPerMeasure;
  const raw: MeasureData[] = [];
  for (let i = 0; i < SAMPLE_BARS + 2; i++) raw.push(generator.generateMeasure(i, sample, i * beats));

  const widths: number[] = [];
  let prev = spaceMeasure(raw[0], null, raw[1], 'squishy', sample);
  for (let i = 1; i <= SAMPLE_BARS; i++) {
    prev = spaceMeasure(raw[i], prev, raw[i + 1], 'squishy', sample);
    widths.push(prev.width);
  }
  widths.sort((a, b) => a - b);
  const mid = widths.length >> 1;
  typicalKey = key;
  typicalWidth = widths.length % 2 ? widths[mid] : (widths[mid - 1] + widths[mid]) / 2;
  return typicalWidth;
}

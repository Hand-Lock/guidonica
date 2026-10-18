import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  METER,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  SpacingKnots,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  ViewMode,
  computeBeatWidth,
  supportedTuplets,
  tupletShape,
  tupletSpan,
} from './types';
import { MusicGenerator, rhythmGrammar } from './generator';
import { noteSpan } from './ties';
import { mulberry32 } from './random';

/**
 * Horizontal spacing of one bar (ADR 0109): its mean beat width and, in the squishy view,
 * the knots of its engraved spacing curve. Without knots it is the linear layout of SPEC §3.
 */
export interface BeatSpacing {
  beatWidth: number;
  knots?: SpacingKnots;
}

/**
 * Engraved spacing exponent (ADR 0109): a note of duration d gets s_min·(d / v_min)^0.5,
 * so each doubling of duration adds ×√2 of space, as in printed music (Gould, Ross).
 */
export const SPACING_EXPONENT = 0.5;

/**
 * X of `offset` metric beats into a bar, in measure units (the left barline is x = 0).
 * Without knots it is NOTE_START_OFFSET + offset·beatWidth, the steady layout. With knots
 * it is the monotone cubic Hermite through (offsets[i], xs[i]) with slopes[i]:
 *
 *   X(o) = h00(t)·x_k + h10(t)·h·m_k + h01(t)·x_{k+1} + h11(t)·h·m_{k+1},  t = (o − o_k)/h
 *
 * Offsets outside the bar extend its end slopes, so the map is total and strictly
 * increasing. It allocates nothing: the scroller calls it every frame.
 */
export function beatX(spacing: BeatSpacing, _ts: TimeSignature, offset: number): number {
  const knots = spacing.knots;
  if (knots === undefined) return NOTE_START_OFFSET + offset * spacing.beatWidth;
  const { offsets, xs, slopes } = knots;
  const n = offsets.length - 1;
  if (offset <= offsets[0]) return xs[0] + (offset - offsets[0]) * slopes[0];
  if (offset >= offsets[n]) return xs[n] + (offset - offsets[n]) * slopes[n];
  let lo = 0;
  let hi = n;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (offsets[mid] <= offset) lo = mid;
    else hi = mid;
  }
  const h = offsets[hi] - offsets[lo];
  const t = (offset - offsets[lo]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * xs[lo] +
    (t3 - 2 * t2 + t) * h * slopes[lo] +
    (3 * t2 - 2 * t3) * xs[hi] +
    (t3 - t2) * h * slopes[hi]
  );
}

type RhythmSettings = Pick<AppSettings, 'subdivisions' | 'tuplets'>;

/**
 * The shortest duration a configuration can write, in metric beats: over the values of its
 * rhythm grammar (the quarter, or the beat unit, when that grammar needs it) and one member
 * of each supported tuplet cell, a group's span over its note count.
 */
export function shortestBeats(settings: RhythmSettings, ts: TimeSignature): number {
  const grammar = rhythmGrammar(ts, settings.subdivisions, settings.tuplets);
  let shortest = Infinity;
  for (const value of grammar.values) {
    const span = noteSpan(ts, value);
    if (span !== null) shortest = Math.min(shortest, span);
  }
  const tuplets = settings.tuplets && supportedTuplets(ts, settings.tuplets);
  if (tuplets) {
    for (const name of TUPLET_NAMES) {
      for (const value of TUPLET_VALUES) {
        if (tuplets[name][value]) shortest = Math.min(shortest, tupletSpan(ts, name, value) / tupletShape(ts, name, value).notes);
      }
    }
  }
  return Number.isFinite(shortest) ? shortest : 1;
}

/** A session's spacing constants: linear beat width, shortest duration and its space. */
interface SpacingBase {
  linear: number;
  shortest: number;
  base: number;
}

let baseKey: string | null = null;
let lastBase: SpacingBase = { linear: 0, shortest: 1, base: 0 };

function spacingBase(settings: RhythmSettings, ts: TimeSignature): SpacingBase {
  const key = JSON.stringify([ts, settings.subdivisions, settings.tuplets]);
  if (key === baseKey) return lastBase;
  const linear = computeBeatWidth(settings.subdivisions, ts, settings.tuplets);
  const shortest = shortestBeats(settings, ts);
  baseKey = key;
  lastBase = { linear, shortest, base: linear * Math.min(shortest, 1) };
  return lastBase;
}

/**
 * Space of a note lasting `d` metric beats, s_min·(d / v_min)^0.5, capped at the linear
 * layout's linear·d. The cap only binds below v_min (a rest piece shorter than any written
 * value), so no note is ever wider per beat than in the steady view.
 */
function space(d: number, b: SpacingBase): number {
  return Math.min(b.base * Math.pow(d / b.shortest, SPACING_EXPONENT), b.linear * d);
}

/** Engraved space (px) of a note lasting `beats` metric beats in this session (ADR 0109). */
export function noteSpace(beats: number, settings: RhythmSettings, ts: TimeSignature): number {
  return space(beats, spacingBase(settings, ts));
}

/** A note's secant: its space per metric beat. */
function secant(note: NoteData, b: SpacingBase): number {
  return space(note.beatDuration, b) / note.beatDuration;
}

/** Fritsch–Butland slope at a knot between secants a and b: their harmonic mean. */
function harmonic(a: number, b: number): number {
  return (2 * a * b) / (a + b);
}

/**
 * The squishy knots of a bar: one per note onset plus the barline at B, each note spaced by
 * its own duration. Interior slopes are Fritsch–Butland; a barline's slope comes from the
 * neighbouring bar's raw notes, so both bars compute the same one and the speed is
 * continuous. Without a neighbour the end slope is the one-sided secant.
 */
function squishyKnots(data: MeasureData, before: MeasureData | null, after: MeasureData | null, b: SpacingBase) {
  const notes = data.notes;
  const n = notes.length;
  const offsets = new Float64Array(n + 1);
  const xs = new Float64Array(n + 1);
  const slopes = new Float64Array(n + 1);
  let x = NOTE_START_OFFSET;
  for (let i = 0; i < n; i++) {
    offsets[i] = notes[i].beatOffset;
    xs[i] = x;
    x += space(notes[i].beatDuration, b);
  }
  offsets[n] = data.beatsPerMeasure;
  xs[n] = x;
  for (let i = 1; i < n; i++) slopes[i] = harmonic(secant(notes[i - 1], b), secant(notes[i], b));
  const first = secant(notes[0], b);
  const last = secant(notes[n - 1], b);
  const prevNotes = before?.notes;
  const nextNotes = after?.notes;
  slopes[0] = prevNotes?.length ? harmonic(secant(prevNotes[prevNotes.length - 1], b), first) : first;
  slopes[n] = nextNotes?.length ? harmonic(last, secant(nextNotes[0], b)) : last;
  return { knots: { offsets, xs, slopes }, width: x - NOTE_START_OFFSET };
}

/** Whether `b` is the bar right after `a` on the tape. */
function follows(a: MeasureData, b: MeasureData): boolean {
  return b.index === a.index + 1 && b.startBeat === a.startBeat + a.beatsPerMeasure;
}

/**
 * Lays a generated bar out for `view`: a new MeasureData with its beat width, width and, in
 * squishy, its engraved knots. `prev` is the previous bar as laid out, `next` the following
 * bar as generated (only its notes are read); either is ignored unless it is the adjacent
 * bar. An incoming tie shares `prev`'s knots, so both halves still draw the same curve. The
 * notes are shared, never copied or changed.
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
  const { knots: _knots, tieIn, ...rest } = data;
  const spaced: MeasureData = rest;

  if (view === 'squishy' && data.notes.length > 0) {
    const { knots, width } = squishyKnots(data, before, after, spacingBase(settings, ts));
    spaced.knots = knots;
    spaced.width = width;
    spaced.beatWidth = width / data.beatsPerMeasure;
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
          ...(before.knots && { knots: before.knots }),
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
 * SAMPLE_BARS bars from a seeded generator. Pitch settings are fixed to the defaults, so
 * the answer depends on the rhythm options alone; it is memoised for the last rhythm asked
 * about. The app's auto zoom fits this bar (ADR 0109).
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

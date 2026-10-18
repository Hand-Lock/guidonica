import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  METER,
  MeasureData,
  NOTE_START_OFFSET,
  NoteData,
  PAGE_DENSITY,
  PAGE_MIN_NOTE_SPACE,
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
export function beatX(spacing: BeatSpacing, offset: number): number {
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

/**
 * The spacing constants at `density` times the squishy space: 1 in squishy, PAGE_DENSITY on
 * a page (ADR 0110). Scaling both the linear cap and s_min scales every note's space alike.
 * A denser layout never brings s_min under PAGE_MIN_NOTE_SPACE, so a bar's last notehead
 * still clears the next barline, which sits NOTE_START_OFFSET before the next note.
 */
function spacingBase(settings: RhythmSettings, ts: TimeSignature, density = 1): SpacingBase {
  const key = JSON.stringify([ts, settings.subdivisions, settings.tuplets, density]);
  if (key === baseKey) return lastBase;
  const linear = computeBeatWidth(settings.subdivisions, ts, settings.tuplets);
  const shortest = shortestBeats(settings, ts);
  const base = linear * Math.min(shortest, 1);
  const scale = density < 1 ? Math.max(density, Math.min(1, PAGE_MIN_NOTE_SPACE / base)) : density;
  baseKey = key;
  lastBase = { linear: linear * scale, shortest, base: base * scale };
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
 * squishy, its engraved knots. On a page it is the squishy layout at PAGE_DENSITY, the bar's
 * natural width before its line is justified (ADR 0110). `prev` is the previous bar as laid
 * out, `next` the following bar as generated (only its notes are read); either is ignored
 * unless it is the adjacent bar. An incoming tie shares `prev`'s knots, so both halves still
 * draw the same curve. The notes are shared, never copied or changed.
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
  const { knots: _knots, tieIn, lineStart: _lineStart, ...rest } = data;
  const spaced: MeasureData = rest;

  if (view !== 'steady' && data.notes.length > 0) {
    const density = view === 'page' ? PAGE_DENSITY : 1;
    const { knots, width } = squishyKnots(data, before, after, spacingBase(settings, ts, density));
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

/**
 * A page line's bars justified by `j` (ADR 0110): a new MeasureData whose knots are scaled
 * about the first note, x' = 26 + (x − 26)·j, with slopes, width and beat width × j. Every bar
 * of a line shares one j, so the cursor's speed stays continuous across the barlines inside
 * it. `prevInLine` is the line's previous bar, already justified: an incoming tie takes its
 * spacing, so both halves draw one curve. A line's first bar (no `prevInLine`) is marked
 * `lineStart`; its incoming tie keeps the natural spacing and is drawn as the half arc after
 * the clef. The notes are shared, never copied or changed.
 */
export function justifyMeasure(data: MeasureData, j: number, prevInLine: MeasureData | null): MeasureData {
  const { knots, tieIn, lineStart: _lineStart, ...rest } = data;
  const justified: MeasureData = { ...rest, width: data.width * j, beatWidth: data.beatWidth * j };
  if (knots) {
    const n = knots.offsets.length;
    const xs = new Float64Array(n);
    const slopes = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = NOTE_START_OFFSET + (knots.xs[i] - NOTE_START_OFFSET) * j;
      slopes[i] = knots.slopes[i] * j;
    }
    justified.knots = { offsets: knots.offsets, xs, slopes };
  }
  if (prevInLine === null) justified.lineStart = true;
  if (tieIn) {
    justified.tieIn =
      prevInLine && follows(prevInLine, data)
        ? {
            beatOffset: tieIn.beatOffset,
            duration: tieIn.duration,
            beatWidth: prevInLine.beatWidth,
            measureWidth: prevInLine.width,
            ...(prevInLine.knots && { knots: prevInLine.knots }),
          }
        : tieIn;
  }
  return justified;
}

/** Bars sampled for the typical squishy width; their neighbours are generated too. */
const SAMPLE_BARS = 32;
const SAMPLE_SEED = 0x5eed;

const typicalWidths = new Map<ViewMode, { key: string; width: number }>();

/**
 * The typical bar width of `view` for the session's rhythm: the median width of SAMPLE_BARS
 * bars from a seeded generator. Pitch settings are fixed to the defaults, so the answer
 * depends on the rhythm options alone; it is memoised per view for the last rhythm asked
 * about. Auto zoom fits this bar in squishy (ADR 0109) and two of them in a page line,
 * where it is the natural width before justification (ADR 0110).
 */
export function typicalBarWidth(settings: AppSettings, view: ViewMode = 'squishy'): number {
  const { timeSignature, subdivisions, tuplets, rests, ties } = settings;
  const key = JSON.stringify([timeSignature, subdivisions, tuplets, rests, ties]);
  const memo = typicalWidths.get(view);
  if (memo?.key === key) return memo.width;

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
  let prev = spaceMeasure(raw[0], null, raw[1], view, sample);
  for (let i = 1; i <= SAMPLE_BARS; i++) {
    prev = spaceMeasure(raw[i], prev, raw[i + 1], view, sample);
    widths.push(prev.width);
  }
  widths.sort((a, b) => a - b);
  const mid = widths.length >> 1;
  const width = widths.length % 2 ? widths[mid] : (widths[mid - 1] + widths[mid]) / 2;
  typicalWidths.set(view, { key, width });
  return width;
}

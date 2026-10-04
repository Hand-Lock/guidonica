import type { PartitionItem } from './generator';
import { METER, TimeSignature } from './types';

/** Probability that a legal tie boundary is actually tied (see applyTies). */
export const TIE_PROBABILITY = 0.25;

const EPS = 1e-9;

/**
 * Note values expressible by a single notehead, keyed by span in metric beats
 * (quarters in simple meters, eighths in 6/8) and mapped to their VexFlow duration.
 */
export const NOTE_VALUES: Record<TimeSignature, Record<number, string>> = {
  '4/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.375: '16d', 0.25: '16', 0.125: '32' },
  '3/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.375: '16d', 0.25: '16', 0.125: '32' },
  '2/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.375: '16d', 0.25: '16', 0.125: '32' },
  '6/8': { 6: 'hd', 4: 'h', 3: 'qd', 2: 'q', 1.5: '8d', 1: '8', 0.75: '16d', 0.5: '16', 0.25: '32' },
};

export interface Placement {
  /** Metric grid (beats) the offsets repeat on. */
  period: number;
  /** Offsets within one period where the notehead reads canonically. */
  offsets: readonly number[];
  /** Offsets that are accepted single-note spellings but may also be tied. */
  tolerated?: readonly number[];
}

/**
 * Notehead placement table: where one notehead of each value may start in each meter.
 * A note must additionally fit inside the bar. Encodes Gould's beaming/tie rules:
 * - 4/4: the middle of the bar stays visible. Nothing canonical crosses beat 3 except
 *   w (and hd from beat 1). The syncopations `q h q` and `q h.` are tolerated exceptions
 *   (h@1, hd@1): written as single notes or tied across the middle.
 * - Simple meters: sub-beat values never cross their parent (8 at .25 = the `16 8 16`
 *   figure; 16 at .125 = `32 16 32` inside one eighth; 16d/32 never cross an eighth).
 * - 6/8: the same eighth-level rule one level down (16, 16d, 32 stay inside one eighth).
 * - 3/4: the bar is one undivided unit, so q, qd and h may sit on any eighth / beat.
 * - 6/8: the dotted-quarter beat stays visible; a 4-eighth sound (h) has no placement
 *   and is always spelled tied.
 */
export const NOTEHEAD_PLACEMENTS: Record<TimeSignature, Record<string, Placement>> = {
  '4/4': {
    w: { period: 4, offsets: [0] },
    hd: { period: 4, offsets: [0], tolerated: [1] },
    h: { period: 2, offsets: [0], tolerated: [1] },
    qd: { period: 2, offsets: [0, 0.5] },
    q: { period: 2, offsets: [0, 0.5, 1] },
    '8d': { period: 1, offsets: [0, 0.25] },
    '8': { period: 1, offsets: [0, 0.25, 0.5] },
    '16': { period: 0.5, offsets: [0, 0.125, 0.25] },
    '16d': { period: 0.5, offsets: [0, 0.125] },
    '32': { period: 0.125, offsets: [0] },
  },
  '2/4': {
    h: { period: 2, offsets: [0] },
    qd: { period: 2, offsets: [0, 0.5] },
    q: { period: 2, offsets: [0, 0.5, 1] },
    '8d': { period: 1, offsets: [0, 0.25] },
    '8': { period: 1, offsets: [0, 0.25, 0.5] },
    '16': { period: 0.5, offsets: [0, 0.125, 0.25] },
    '16d': { period: 0.5, offsets: [0, 0.125] },
    '32': { period: 0.125, offsets: [0] },
  },
  '3/4': {
    hd: { period: 3, offsets: [0] },
    h: { period: 3, offsets: [0, 1] },
    qd: { period: 0.5, offsets: [0] },
    q: { period: 0.5, offsets: [0] },
    '8d': { period: 1, offsets: [0, 0.25] },
    '8': { period: 1, offsets: [0, 0.25, 0.5] },
    '16': { period: 0.5, offsets: [0, 0.125, 0.25] },
    '16d': { period: 0.5, offsets: [0, 0.125] },
    '32': { period: 0.125, offsets: [0] },
  },
  '6/8': {
    hd: { period: 6, offsets: [0] },
    qd: { period: 3, offsets: [0] },
    q: { period: 3, offsets: [0, 1] },
    '8d': { period: 3, offsets: [0, 1] },
    '8': { period: 1, offsets: [0] },
    '16': { period: 1, offsets: [0, 0.25, 0.5] },
    '16d': { period: 1, offsets: [0, 0.25] },
    '32': { period: 0.25, offsets: [0] },
  },
};

export type PlacementKind = 'canonical' | 'tolerated';

function valueFor(ts: TimeSignature, span: number): string | null {
  for (const [key, duration] of Object.entries(NOTE_VALUES[ts])) {
    if (Math.abs(Number(key) - span) < EPS) return duration;
  }
  return null;
}

function onGrid(phase: number, offsets: readonly number[]): boolean {
  return offsets.some((o) => Math.abs(phase - o) < EPS);
}

/**
 * Classifies one notehead of `span` beats starting at `offset`:
 * 'canonical' / 'tolerated' per NOTEHEAD_PLACEMENTS, or null when no single notehead
 * can express it there (the span is not a note value, is misplaced, or overflows the bar).
 */
export function placementOf(ts: TimeSignature, offset: number, span: number): PlacementKind | null {
  if (offset < -EPS || offset + span > METER[ts].beatsPerMeasure + EPS) return null;
  const value = valueFor(ts, span);
  if (value === null) return null;
  const placement = NOTEHEAD_PLACEMENTS[ts][value];
  if (!placement) return null;
  let phase = offset % placement.period;
  if (placement.period - phase < EPS) phase = 0;
  if (onGrid(phase, placement.offsets)) return 'canonical';
  if (placement.tolerated && onGrid(phase, placement.tolerated)) return 'tolerated';
  return null;
}

function sameTupletGroup(a: PartitionItem, b: PartitionItem): boolean {
  return Boolean(a.isTuplet && b.isTuplet && a.tupletGroup === b.tupletGroup);
}

/**
 * Lengths, in units of its tuplet (the eighth of an eighth triplet), that one notehead
 * expresses inside a group: 1, 2, 4 and the dotted 3 and 6 (ADR 0065).
 */
export const TUPLET_NOTEHEAD_UNITS: ReadonlySet<number> = new Set([1, 2, 3, 4, 6]);

/**
 * Legality of tying `items[i]` to `items[i + 1]` inside one bar, given that the chain
 * currently ending at `items[i]` starts at `items[chainStart]`. `offsets[k]` is the
 * beat offset of `items[k]`. A tie is legal iff no single canonical notehead can express
 * the merged sound: for every suffix c_j..a of the chain, (c_j..a)+b must not be canonical.
 * Inside one tuplet group the merged length must not be a TUPLET_NOTEHEAD_UNITS member
 * (8~8 in a quintuplet is a q). Tuplet time never merges with other time, so any suffix
 * mixing b's group with other notes is automatically inexpressible.
 */
export function isLegalInnerTie(
  items: readonly PartitionItem[],
  offsets: readonly number[],
  i: number,
  chainStart: number,
  ts: TimeSignature
): boolean {
  const a = items[i];
  const b = items[i + 1];
  if (!a || !b || a.isRest || b.isRest) return false;
  let span = b.beatDuration;
  for (let j = i; j >= chainStart; j--) {
    span += items[j].beatDuration;
    const suffix = items.slice(j, i + 1);
    if (b.tupletUnit !== undefined && suffix.every((c) => sameTupletGroup(c, b))) {
      if (TUPLET_NOTEHEAD_UNITS.has(Math.round(span / b.tupletUnit))) return false;
      continue;
    }
    const touchesTuplet = Boolean(b.isTuplet) || suffix.some((c) => c.isTuplet);
    if (touchesTuplet) continue;
    if (placementOf(ts, offsets[j], span) === 'canonical') return false;
  }
  return true;
}

const SIMPLE_METER_RESTS: Record<string, Placement> = {
  q: { period: 1, offsets: [0] },
  '8': { period: 0.5, offsets: [0] },
  '16': { period: 0.25, offsets: [0] },
  '32': { period: 0.125, offsets: [0] },
};

/**
 * Rest placement table: where one rest of each value may start. Rests never obscure a
 * beat: each sits on a multiple of its own span, the half rest only on either half of a
 * 4/4 bar, the 6/8 quarter rest only at a group start, and no rest is dotted except the
 * whole-group qd in 6/8. A silence filling the bar is one whole rest in every meter
 * (spellRest), so 3/4 and 2/4 need no longer value (ADR 0065).
 */
export const REST_PLACEMENTS: Record<TimeSignature, Record<string, Placement>> = {
  '4/4': { h: { period: 2, offsets: [0] }, ...SIMPLE_METER_RESTS },
  '3/4': SIMPLE_METER_RESTS,
  '2/4': SIMPLE_METER_RESTS,
  '6/8': {
    qd: { period: 3, offsets: [0] },
    q: { period: 3, offsets: [0] },
    '8': { period: 1, offsets: [0] },
    '16': { period: 0.5, offsets: [0] },
    '32': { period: 0.25, offsets: [0] },
  },
};

/** Glyph of a bar-long rest, whatever the meter: the whole rest. */
export const BAR_REST = 'w';

/** Span in metric beats of the note value `duration` in `ts`, or null if it has none. */
export function noteSpan(ts: TimeSignature, duration: string): number | null {
  for (const [key, value] of Object.entries(NOTE_VALUES[ts])) {
    if (value === duration) return Number(key);
  }
  return null;
}

/** Rest values of `ts`, longest first. */
const RESTS_BY_SPAN: Record<TimeSignature, { duration: string; span: number; placement: Placement }[]> =
  Object.fromEntries(
    (Object.keys(REST_PLACEMENTS) as TimeSignature[]).map((ts) => [
      ts,
      Object.entries(REST_PLACEMENTS[ts])
        .map(([duration, placement]) => ({ duration, span: noteSpan(ts, duration) ?? 0, placement }))
        .sort((x, y) => y.span - x.span),
    ])
  ) as Record<TimeSignature, { duration: string; span: number; placement: Placement }[]>;

/** Whether `offset` (metric beats) lies on one of the placement's grid offsets. */
export function isPlaced(offset: number, placement: Pick<Placement, 'period' | 'offsets'>): boolean {
  let phase = offset % placement.period;
  if (placement.period - phase < EPS) phase = 0;
  return onGrid(phase, placement.offsets);
}

/**
 * Canonical spelling of the silence [start, end) (metric beats). A silence over the whole
 * bar is one whole rest, whatever the enabled values. Otherwise greedy: at each point the
 * longest legal rest that fits, preferring the enabled `values` so a level without half
 * notes shows no half rest; a value outside them is used only where no enabled rest is
 * legal (8r 8r for a silent syncopated q when only quarters are on).
 */
export function spellRest(
  ts: TimeSignature,
  start: number,
  end: number,
  values: ReadonlySet<string>
): PartitionItem[] {
  const bar = METER[ts].beatsPerMeasure;
  if (start < EPS && end > bar - EPS) {
    return [{ duration: BAR_REST, beatDuration: bar, isRest: true }];
  }
  const rests: PartitionItem[] = [];
  let offset = start;
  while (offset < end - EPS) {
    const legal = RESTS_BY_SPAN[ts].filter(
      (r) => offset + r.span < end + EPS && isPlaced(offset, r.placement)
    );
    const rest = legal.find((r) => values.has(r.duration)) ?? legal[0];
    if (!rest) throw new Error(`No rest fits at ${offset} in ${ts}`);
    rests.push({ duration: rest.duration, beatDuration: rest.span, isRest: true });
    offset += rest.span;
  }
  return rests;
}

/** Re-spells each run of adjacent non-tuplet rests with spellRest. */
export function consolidateRests(
  items: readonly PartitionItem[],
  ts: TimeSignature,
  values: ReadonlySet<string>
): PartitionItem[] {
  const result: PartitionItem[] = [];
  let offset = 0;
  let i = 0;
  while (i < items.length) {
    if (!items[i].isRest || items[i].isTuplet) {
      result.push(items[i]);
      offset += items[i].beatDuration;
      i++;
      continue;
    }
    let end = offset;
    while (i < items.length && items[i].isRest && !items[i].isTuplet) {
      end += items[i].beatDuration;
      i++;
    }
    result.push(...spellRest(ts, offset, end, values));
    offset = end;
  }
  return result;
}

/** A tie across the barline is always notation; it only needs two sounding notes. */
export function canTieAcrossBarline(a: PartitionItem, b: PartitionItem): boolean {
  return !a.isRest && !b.isRest;
}

/**
 * Within-measure tie pass. Walks adjacent pairs, tracking the current tie chain, and ties
 * each legal pair (isLegalInnerTie) independently with probability TIE_PROBABILITY.
 * Every legal tied spelling therefore has P > 0, and no redundant tie (one a single
 * canonical notehead could replace) is ever written. Durations are untouched.
 */
export function applyTies(items: PartitionItem[], ts: TimeSignature): PartitionItem[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const item of items) {
    offsets.push(offset);
    offset += item.beatDuration;
  }
  let chainStart = 0;
  for (let i = 0; i < items.length - 1; i++) {
    if (!items[i].tieEnd) chainStart = i;
    if (isLegalInnerTie(items, offsets, i, chainStart, ts) && Math.random() < TIE_PROBABILITY) {
      items[i].tieStart = true;
      items[i + 1].tieEnd = true;
    }
  }
  return items;
}

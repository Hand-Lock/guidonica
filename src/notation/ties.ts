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
  '4/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.25: '16' },
  '3/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.25: '16' },
  '2/4': { 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.25: '16' },
  '6/8': { 6: 'hd', 4: 'h', 3: 'qd', 2: 'q', 1.5: '8d', 1: '8', 0.5: '16' },
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
 * - Simple meters: sub-beat values never cross a beat (8 at .25 = the `16 8 16` figure).
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
    '16': { period: 0.25, offsets: [0] },
  },
  '2/4': {
    h: { period: 2, offsets: [0] },
    qd: { period: 2, offsets: [0, 0.5] },
    q: { period: 2, offsets: [0, 0.5, 1] },
    '8d': { period: 1, offsets: [0, 0.25] },
    '8': { period: 1, offsets: [0, 0.25, 0.5] },
    '16': { period: 0.25, offsets: [0] },
  },
  '3/4': {
    hd: { period: 3, offsets: [0] },
    h: { period: 3, offsets: [0, 1] },
    qd: { period: 0.5, offsets: [0] },
    q: { period: 0.5, offsets: [0] },
    '8d': { period: 1, offsets: [0, 0.25] },
    '8': { period: 1, offsets: [0, 0.25, 0.5] },
    '16': { period: 0.25, offsets: [0] },
  },
  '6/8': {
    hd: { period: 6, offsets: [0] },
    qd: { period: 3, offsets: [0] },
    q: { period: 3, offsets: [0, 1] },
    '8d': { period: 3, offsets: [0, 1] },
    '8': { period: 1, offsets: [0] },
    '16': { period: 0.5, offsets: [0] },
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
 * Legality of tying `items[i]` to `items[i + 1]` inside one bar, given that the chain
 * currently ending at `items[i]` starts at `items[chainStart]`. `offsets[k]` is the
 * beat offset of `items[k]`. A tie is legal iff no single canonical notehead can express
 * the merged sound: for every suffix c_j..a of the chain, (c_j..a)+b must not be canonical.
 * Tuplet time never merges with other time, so any suffix containing a tuplet note (in a
 * different group from b) is automatically inexpressible.
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
  if (!a || !b || a.isRest || b.isRest || sameTupletGroup(a, b)) return false;
  let span = b.beatDuration;
  for (let j = i; j >= chainStart; j--) {
    span += items[j].beatDuration;
    const touchesTuplet = Boolean(b.isTuplet) || items.slice(j, i + 1).some((c) => c.isTuplet);
    if (touchesTuplet) continue;
    if (placementOf(ts, offsets[j], span) === 'canonical') return false;
  }
  return true;
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

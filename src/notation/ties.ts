import type { PartitionItem } from './generator';
import { METER, TimeSignature } from './types';

/** Probability that a legal tie boundary is actually tied (see applyTies). */
export const TIE_PROBABILITY = 0.25;

const EPS = 1e-9;

// The breve (b) and the dotted whole and breve exist for the longer quarter-beat bars: no
// placement in 4/4, 3/4, 2/4 ever admits them, so those grammars are unchanged (ADR 0090)
const SIMPLE_NOTE_VALUES: Record<number, string> = {
  12: 'bd', 8: 'b', 6: 'wd', 4: 'w', 3: 'hd', 2: 'h', 1.5: 'qd', 1: 'q', 0.75: '8d', 0.5: '8', 0.375: '16d',
  0.25: '16', 0.125: '32',
};

// The dotted whole is the 12/8 whole-bar note: without it a full-bar sound is a redundant hd~hd (ADR 0076)
const COMPOUND_NOTE_VALUES: Record<number, string> = {
  12: 'wd', 8: 'w', 6: 'hd', 4: 'h', 3: 'qd', 2: 'q', 1.5: '8d', 1: '8', 0.75: '16d', 0.5: '16', 0.25: '32',
};

/**
 * Note values expressible by a single notehead, keyed by span in metric beats
 * (quarters in simple meters, eighths in compound ones) and mapped to their VexFlow duration.
 */
export const NOTE_VALUES: Record<TimeSignature, Record<number, string>> = {
  '4/4': SIMPLE_NOTE_VALUES,
  '3/4': SIMPLE_NOTE_VALUES,
  '2/4': SIMPLE_NOTE_VALUES,
  '6/8': COMPOUND_NOTE_VALUES,
  '9/8': COMPOUND_NOTE_VALUES,
  '12/8': COMPOUND_NOTE_VALUES,
  '4/2': SIMPLE_NOTE_VALUES,
  '3/2': SIMPLE_NOTE_VALUES,
  '2/2': SIMPLE_NOTE_VALUES,
  '12/4': SIMPLE_NOTE_VALUES,
  '9/4': SIMPLE_NOTE_VALUES,
  '6/4': SIMPLE_NOTE_VALUES,
};

export interface Placement {
  /** Metric grid (beats) the offsets repeat on. */
  period: number;
  /** Offsets within one period where the notehead reads canonically. */
  offsets: readonly number[];
  /** Offsets that are accepted single-note spellings but may also be tied. */
  tolerated?: readonly number[];
}

/** Placements inside one dotted-quarter beat, shared by every compound meter (ADR 0076). */
const COMPOUND_BEAT_PLACEMENTS: Record<string, Placement> = {
  qd: { period: 3, offsets: [0] },
  q: { period: 3, offsets: [0, 1] },
  '8d': { period: 3, offsets: [0, 1] },
  '8': { period: 1, offsets: [0] },
  '16': { period: 1, offsets: [0, 0.25, 0.5] },
  '16d': { period: 1, offsets: [0, 0.25] },
  '32': { period: 0.25, offsets: [0] },
};

/** Placements inside one quarter, the same in every quarter-beat meter. */
const QUARTER_PLACEMENTS: Record<string, Placement> = {
  '8d': { period: 1, offsets: [0, 0.25] },
  '8': { period: 1, offsets: [0, 0.25, 0.5] },
  '16': { period: 0.5, offsets: [0, 0.125, 0.25] },
  '16d': { period: 0.5, offsets: [0, 0.125] },
  '32': { period: 0.125, offsets: [0] },
};

/** Placements inside one half-note beat (4/4's half bars), shared by 2/2, 3/2, 4/2 (ADR 0090). */
const HALF_BEAT_PLACEMENTS: Record<string, Placement> = {
  qd: { period: 2, offsets: [0, 0.5] },
  q: { period: 2, offsets: [0, 0.5, 1] },
  ...QUARTER_PLACEMENTS,
};

/** 6/8's beat placements one value up: inside one dotted-half beat of 6/4, 9/4, 12/4 (ADR 0090). */
const COMPOUND_QUARTER_BEAT_PLACEMENTS: Record<string, Placement> = {
  hd: { period: 3, offsets: [0] },
  h: { period: 3, offsets: [0, 1] },
  qd: { period: 3, offsets: [0, 1] },
  q: { period: 1, offsets: [0] },
  ...QUARTER_PLACEMENTS,
};

/**
 * Notehead placement table: where one notehead of each value may start in each meter.
 * A note must additionally fit inside the bar. Encodes Gould's beaming/tie rules:
 * - 4/4: the middle of the bar stays visible. Nothing canonical crosses beat 3 except
 *   w (and hd from beat 1). The syncopations `q h q` and `q h.` are tolerated exceptions
 *   (h@1, hd@1): written as single notes or tied across the middle.
 * - Simple meters: sub-beat values never cross their parent (8 at .25 = the `16 8 16`
 *   figure; 16 at .125 = `32 16 32` inside one eighth; 16d/32 never cross an eighth).
 * - Compound meters: the same eighth-level rule one level down (16, 16d, 32 stay inside
 *   one eighth).
 * - 3/4: the bar is one undivided unit, so q, qd and h may sit on any eighth / beat.
 * - Compound meters: the dotted-quarter beat stays visible; 4- and 8-eighth sounds (h, w)
 *   have no placement and are always spelled tied. 9/8 reads like 3/4 one level up (hd on
 *   beat 1 or 2), 12/8 like 4/4 (wd fills the bar; hd on beat 2 is the tolerated
 *   `qd hd qd`, written whole or tied across the middle) (ADR 0076).
 * - Half-note meters are 2/4, 3/4 and 4/4 one value up: 2/2 like 2/4 (`q h q` canonical),
 *   3/2 like 3/4 (w on beat 1 or 2, wd fills the bar), 4/2 like 4/4 (b fills the bar, the
 *   middle stays visible, `h w h` and `h wd` tolerated). 6/4, 9/4, 12/4 are 6/8, 9/8 and
 *   12/8 one value up: w and b, like h and w in 6/8, are always tied (ADR 0090).
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
  '6/8': { hd: { period: 6, offsets: [0] }, ...COMPOUND_BEAT_PLACEMENTS },
  '9/8': { hd: { period: 9, offsets: [0, 3] }, ...COMPOUND_BEAT_PLACEMENTS },
  '12/8': {
    wd: { period: 12, offsets: [0] },
    hd: { period: 6, offsets: [0], tolerated: [3] },
    ...COMPOUND_BEAT_PLACEMENTS,
  },
  '4/2': {
    b: { period: 8, offsets: [0] },
    wd: { period: 8, offsets: [0], tolerated: [2] },
    w: { period: 4, offsets: [0], tolerated: [2] },
    hd: { period: 4, offsets: [0, 1] },
    h: { period: 4, offsets: [0, 1, 2] },
    ...HALF_BEAT_PLACEMENTS,
  },
  '3/2': {
    wd: { period: 6, offsets: [0] },
    w: { period: 6, offsets: [0, 2] },
    hd: { period: 1, offsets: [0] },
    h: { period: 1, offsets: [0] },
    ...HALF_BEAT_PLACEMENTS,
  },
  '2/2': {
    w: { period: 4, offsets: [0] },
    hd: { period: 4, offsets: [0, 1] },
    h: { period: 4, offsets: [0, 1, 2] },
    ...HALF_BEAT_PLACEMENTS,
  },
  '12/4': {
    bd: { period: 12, offsets: [0] },
    wd: { period: 6, offsets: [0], tolerated: [3] },
    ...COMPOUND_QUARTER_BEAT_PLACEMENTS,
  },
  '9/4': { wd: { period: 9, offsets: [0, 3] }, ...COMPOUND_QUARTER_BEAT_PLACEMENTS },
  '6/4': { wd: { period: 6, offsets: [0] }, ...COMPOUND_QUARTER_BEAT_PLACEMENTS },
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

const COMPOUND_METER_RESTS: Record<string, Placement> = {
  qd: { period: 3, offsets: [0] },
  q: { period: 3, offsets: [0] },
  '8': { period: 1, offsets: [0] },
  '16': { period: 0.5, offsets: [0] },
  '32': { period: 0.25, offsets: [0] },
};

const HALF_METER_RESTS: Record<string, Placement> = {
  h: { period: 2, offsets: [0] },
  ...SIMPLE_METER_RESTS,
};

const COMPOUND_QUARTER_METER_RESTS: Record<string, Placement> = {
  hd: { period: 3, offsets: [0] },
  h: { period: 3, offsets: [0] },
  q: { period: 1, offsets: [0] },
  '8': { period: 0.5, offsets: [0] },
  '16': { period: 0.25, offsets: [0] },
  '32': { period: 0.125, offsets: [0] },
};

/**
 * Rest placement table: where one rest of each value may start. Rests never obscure a
 * beat: each sits on a multiple of its own span, the half rest only on either half of a
 * 4/4 bar (the dotted-half rest likewise in 12/8), the compound quarter rest only at a
 * beat start, and no rest is dotted except the compound whole-beat qd and 12/8 half-bar
 * hd. A silence filling the bar is one whole rest in every meter (spellRest), so 3/4,
 * 2/4, 6/8 and 9/8 need no longer value (ADR 0065, 0076). Half-note meters rest a half
 * per beat and a whole per 4/2 half bar; 6/4, 9/4, 12/4 are 6/8's table one value up (ADR 0090).
 */
export const REST_PLACEMENTS: Record<TimeSignature, Record<string, Placement>> = {
  '4/4': { h: { period: 2, offsets: [0] }, ...SIMPLE_METER_RESTS },
  '3/4': SIMPLE_METER_RESTS,
  '2/4': SIMPLE_METER_RESTS,
  '6/8': COMPOUND_METER_RESTS,
  '9/8': COMPOUND_METER_RESTS,
  '12/8': { hd: { period: 6, offsets: [0] }, ...COMPOUND_METER_RESTS },
  '4/2': { w: { period: 4, offsets: [0] }, ...HALF_METER_RESTS },
  '3/2': HALF_METER_RESTS,
  '2/2': HALF_METER_RESTS,
  '12/4': { wd: { period: 6, offsets: [0] }, ...COMPOUND_QUARTER_METER_RESTS },
  '9/4': COMPOUND_QUARTER_METER_RESTS,
  '6/4': COMPOUND_QUARTER_METER_RESTS,
};

/**
 * Glyph of a bar-long rest: the whole rest, except the breve rest in 4/2, the one meter
 * whose bar is exactly a breve (ADR 0090).
 */
export function barRest(ts: TimeSignature): string {
  return ts === '4/2' ? 'b' : 'w';
}

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
 * bar is one bar rest (barRest), whatever the enabled values. Otherwise greedy: at each point the
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
    return [{ duration: barRest(ts), beatDuration: bar, isRest: true }];
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

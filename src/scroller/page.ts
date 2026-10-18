import {
  MeasureData,
  PAGE_ANCHOR,
  PAGE_LEFT_MARGIN,
  PAGE_MIN_STAFF_DISTANCE,
  PAGE_PLAYED_ALPHA,
  PAGE_RIGHT_MARGIN,
  PAGE_SYSTEM_GAP,
  PAGE_TURN_BEATS,
  STAVE_TOP_LINE_Y,
} from '../notation/types';
import { beatX, justifyMeasure } from '../notation/spacing';

/**
 * One line (system) of the page view (ADR 0110), in page units: y grows down the page and
 * a line's y is its measure canvases' top, so its staff's top line sits at y + 80.
 */
export interface PageSystem {
  /** MeasureData.index of the line's first bar. */
  firstIndex: number;
  /** Bars in the line. */
  count: number;
  /** Metric beat of the first bar's downbeat and of the line's closing barline. */
  startBeat: number;
  endBeat: number;
  /** Width of the clef (and meter) header before the first bar. */
  header: number;
  /** Whether the header shows the time signature: only on the line holding bar 0. */
  meter: boolean;
  y: number;
  /** The previous line's y (y itself on the first line), so a turn never reads an evicted line. */
  prevY: number;
  /** Ink extent of the line's bars in canvas units, the staff [80, 120] included. */
  inkTop: number;
  inkBottom: number;
}

/** Width a line's bars share: the page less its margins and the line's header. */
export function lineAvailable(pageWidth: number, header: number): number {
  return Math.max(1, pageWidth - PAGE_LEFT_MARGIN - header - PAGE_RIGHT_MARGIN);
}

/**
 * Whether a bar `width` wide still joins a line whose bars already use `used` of
 * `available`. Lines only stretch: squeezing one would bring a bar's last notehead or flag
 * into the next barline. The first bar always joins.
 */
export function fitsLine(used: number, width: number, available: number): boolean {
  return used === 0 || used + width <= available;
}

/**
 * Justifies a closed line's natural bars to fill `available` exactly: one factor
 * j = available / Σ widths for every bar, so the cursor's speed stays continuous at each
 * barline inside the line. A lone bar wider than the line gets j < 1.
 */
export function closeLine(naturals: readonly MeasureData[], available: number): MeasureData[] {
  let sum = 0;
  for (const d of naturals) sum += d.width;
  const j = sum > 0 ? available / sum : 1;
  const out: MeasureData[] = [];
  let prev: MeasureData | null = null;
  for (const d of naturals) {
    prev = justifyMeasure(d, j, prev);
    out.push(prev);
  }
  return out;
}

/**
 * Distance from one line's y to the next one's: the least staff distance, or more when
 * the upper line's ink bottom and the lower one's ink top would come closer than the gap.
 */
export function lineDistance(upperInkBottom: number, lowerInkTop: number): number {
  return Math.max(PAGE_MIN_STAFF_DISTANCE, upperInkBottom - lowerInkTop + PAGE_SYSTEM_GAP);
}

/** Index of the line playing at `vb`: the last one starting at or before it (0 before the first). */
export function findSystem(systems: readonly PageSystem[], vb: number): number {
  let lo = 0;
  let hi = systems.length - 1;
  if (hi < 0) return -1;
  if (vb < systems[0].startBeat) return 0;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (systems[mid].startBeat <= vb) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** C¹ ease from 0 to 1 over [0, 1]: 3t² − 2t³. */
function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

/**
 * Index of the line the page is turning to at `vb` when `a` is the line playing, or -1
 * outside turns: a turn spans PAGE_TURN_BEATS centred on the break, so half a beat before
 * the next break the turn to it has begun.
 */
function turningTo(systems: readonly PageSystem[], a: number, vb: number): number {
  const half = PAGE_TURN_BEATS / 2;
  const next = systems[a + 1];
  if (next !== undefined && vb > next.startBeat - half) return a + 1;
  if (a > 0 && vb < systems[a].startBeat + half) return a;
  return -1;
}

/** Eased progress of the turn to `turning` at `vb`, shared by the scroll and the band. */
function turnEase(turning: PageSystem, vb: number): number {
  return smoothstep((vb - (turning.startBeat - PAGE_TURN_BEATS / 2)) / PAGE_TURN_BEATS);
}

/**
 * The reading anchor in page units (ADR 0110): how far the page scrolls short of a line's
 * y, so that the line's middle staff line sits PAGE_ANCHOR of the way down a stage
 * `stageHeight` px tall at `zoom`.
 */
export function pageAnchor(stageHeight: number, zoom: number): number {
  return Math.max(0, (stageHeight * PAGE_ANCHOR) / zoom - STAVE_TOP_LINE_Y - 20);
}

/**
 * Lines kept above the one playing so none still on the stage is evicted: those within
 * the anchor, one more for the line a turn is leaving, and one more for a line's ink
 * below its staff, which reaches at most 68 units past the next line's y (lineDistance).
 */
export function pageRowsAbove(anchor: number): number {
  return Math.ceil(anchor / PAGE_MIN_STAFF_DISTANCE) + 2;
}

/**
 * The page's scroll at `vb`, the y shown at the stage top (ADR 0110). Each line's target
 * is max(0, y − anchor): the page starts at its top, like a document, and once the
 * reading line reaches the anchor the page scrolls instead. Across a break the scroll
 * eases from the previous line's target to the next one's over PAGE_TURN_BEATS centred on
 * the break; clamping each target rather than the eased curve keeps it C¹ where the clamp
 * releases. With reduced motion it cuts at the barline. A pure function of the beat, so
 * the page is wherever the audio clock says.
 */
export function pageScrollY(systems: readonly PageSystem[], vb: number, anchor: number, reducedMotion = false): number {
  const a = findSystem(systems, vb);
  if (a < 0) return 0;
  const k = reducedMotion ? -1 : turningTo(systems, a, vb);
  if (k < 0) return Math.max(0, systems[a].y - anchor);
  const turning = systems[k];
  const from = Math.max(0, turning.prevY - anchor);
  const to = Math.max(0, turning.y - anchor);
  return from + (to - from) * turnEase(turning, vb);
}

/**
 * Opacity of line `i` at `vb`: 1 until the next line starts, then easing to
 * PAGE_PLAYED_ALPHA over the half beat after the break. Played lines stay on the page,
 * dimmed, so the bars just played can still be seen above the reading line.
 */
export function lineAlpha(systems: readonly PageSystem[], i: number, vb: number): number {
  const next = systems[i + 1];
  if (next === undefined || vb <= next.startBeat) return 1;
  return 1 - (1 - PAGE_PLAYED_ALPHA) * smoothstep((vb - next.startBeat) / (PAGE_TURN_BEATS / 2));
}

/**
 * Weight in [0, 1] of the band marking line `i` as the one playing at `vb`: 1 on the
 * active line outside turns; across a turn the departing line gets 1 − σ and the arriving
 * one σ, with the scroll's own ease, so the weights always sum to 1. With reduced motion
 * the band moves at the barline.
 */
export function lineFocus(systems: readonly PageSystem[], i: number, vb: number, reducedMotion = false): number {
  const a = findSystem(systems, vb);
  if (a < 0) return 0;
  const k = reducedMotion ? -1 : turningTo(systems, a, vb);
  if (k < 0) return i === a ? 1 : 0;
  const sigma = turnEase(systems[k], vb);
  if (i === k) return sigma;
  if (i === k - 1) return 1 - sigma;
  return 0;
}

/**
 * The cursor's x on its line, in page units: the line's left margin, its header, the
 * widths of the bars before the one playing and beatX into that bar. `bars` holds the
 * line's justified bars from position `first`.
 */
export function cursorOffsetX(
  system: PageSystem,
  bars: readonly { data: MeasureData }[],
  first: number,
  vb: number
): number {
  let x = PAGE_LEFT_MARGIN + system.header;
  const last = Math.min(bars.length, first + system.count) - 1;
  for (let i = first; i <= last; i++) {
    const d = bars[i].data;
    if (i === last || vb < d.startBeat + d.beatsPerMeasure) {
      return x + beatX(d, d.timeSignature, vb - d.startBeat);
    }
    x += d.width;
  }
  return x;
}

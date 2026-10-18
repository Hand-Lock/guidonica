import {
  MeasureData,
  PAGE_LEFT_MARGIN,
  PAGE_MIN_STAFF_DISTANCE,
  PAGE_RIGHT_MARGIN,
  PAGE_SYSTEM_GAP,
  PAGE_TURN_BEATS,
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
 * The page's scroll at `vb`, the y shown at the stage top (ADR 0110). It is the active
 * line's y, except across a break, where it eases from the previous line's y over
 * PAGE_TURN_BEATS centred on the break. With reduced motion it cuts at the barline.
 * A pure function of the beat, so the page is wherever the audio clock says.
 */
export function pageScrollY(systems: readonly PageSystem[], vb: number, reducedMotion = false): number {
  const a = findSystem(systems, vb);
  if (a < 0) return 0;
  const active = systems[a];
  if (reducedMotion) return active.y;
  const half = PAGE_TURN_BEATS / 2;
  // Half a beat before the next break, the turn to the next line has begun
  const next = systems[a + 1];
  const turning = next !== undefined && vb > next.startBeat - half ? next : vb < active.startBeat + half && a > 0 ? active : null;
  if (turning === null) return active.y;
  const t = (vb - (turning.startBeat - half)) / PAGE_TURN_BEATS;
  return turning.prevY + (turning.y - turning.prevY) * smoothstep(t);
}

/**
 * Opacity of line `i` at `vb`: 1 until the next line starts, then easing to 0 over the
 * half beat after the break, while the page turn carries it up past the stage top. A
 * finished line is then not drawn, so no tail of it lingers above the active line.
 */
export function lineAlpha(systems: readonly PageSystem[], i: number, vb: number): number {
  const next = systems[i + 1];
  if (next === undefined || vb <= next.startBeat) return 1;
  return 1 - smoothstep((vb - next.startBeat) / (PAGE_TURN_BEATS / 2));
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

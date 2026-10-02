export type Point = [number, number];
export type Point3 = [number, number, number];

/** A tapered digit in reference-tile units (authored thumb-right; mirrored when fitted). */
export interface DigitGeometry {
  name: 'little' | 'ring' | 'middle' | 'index' | 'thumb';
  root: Point;
  tip: Point;
  /** Base and tip widths. */
  wb: number;
  wt: number;
  len: number;
  /** Unit axis root → tip, and its normal. */
  d: Point;
  nl: Point;
  /** Point on the axis at t ∈ [0, 1]. */
  at(t: number): Point;
  /** Half-width at t. */
  half(t: number): number;
  /** Point on the edge at t, side s = ±1. */
  edge(t: number, s: number): Point;
  path: string;
}

export interface HandGeometry {
  palm: string;
  fingers: DigitGeometry[];
  thumb: DigitGeometry;
  /** The 19 on-hand gamut stations in historical order; `front` is the palm-side point (z > 0). */
  gamut: { name: string; p: Point; front: Point3 }[];
  thread: {
    /** Gamut stations the thread passes, in order. */
    stations: string[];
    points: Point3[];
    /** Bézier runs split at z = 0: front runs pass over the hand, back runs under it. */
    runs: { front: boolean; d: string; len: number }[];
  };
  joints: { g: DigitGeometry; t: number }[];
}

export function handGeometry(): HandGeometry;
export function buildGlyphSymbol(): string;
export function buildTileSvg(options?: { detail?: 'small' | 'full'; size?: number; bleed?: boolean }): string;
export function roundCorners(png: Buffer, rx: number): Buffer;
export function pngToIco(png: Buffer, size: number): Buffer;

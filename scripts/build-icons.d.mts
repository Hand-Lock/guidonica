export type Point = [number, number];

export interface FingerGeometry {
  name: 'little' | 'ring' | 'middle' | 'index';
  a: Point;
  b: Point;
  r: number;
  angle: number;
  len: number;
  joints: { base: Point; mid: Point; upper: Point; tip: Point };
  creases: Point[];
  dir: Point;
}

export interface HandGeometry {
  palm: string;
  fingers: FingerGeometry[];
  thumb: {
    name: 'thumb';
    segments: { a: Point; b: Point; r: number }[];
    joints: { base: Point; joint: Point; tip: Point };
    creases: Point[];
    dir: Point;
  };
  gamut: { name: string; p: Point }[];
}

export function handGeometry(): HandGeometry;
export function buildGlyphSymbol(): string;
export function buildTileSvg(options?: { detail?: 'small' | 'full'; size?: number }): string;
export function roundCorners(png: Buffer, rx: number): Buffer;
export function pngToIco(png: Buffer, size: number): Buffer;

/** A uniform draw on [0, 1), like Math.random (ADR 0103). */
export type Random = () => number;

/**
 * mulberry32: a 32-bit seeded generator, enough for sampling and free of dependencies.
 * The same seed always yields the same stream (ADR 0103); the app itself never seeds.
 */
export function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

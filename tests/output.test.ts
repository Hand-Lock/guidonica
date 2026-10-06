import { describe, it, expect } from 'vitest';
import { softClipCurve } from '../src/audio/output';

describe('output soft clipper (ADR 0095)', () => {
  const curve = softClipCurve();
  const n = curve.length;
  /** The input level a curve index stands for: u ∈ [−2, 2]. */
  const u = (k: number): number => -2 + (4 * k) / (n - 1);

  it('samples u ∈ [−2, 2] with u = 0 on a sample', () => {
    expect(n % 2).toBe(1);
    expect(curve[(n - 1) / 2]).toBe(0);
  });

  it('leaves every level up to the knee unchanged', () => {
    for (let k = 0; k < n; k++) {
      if (Math.abs(u(k)) <= 0.9) expect(curve[k]).toBeCloseTo(u(k), 6);
    }
  });

  it('is odd, monotonic and never passes full scale', () => {
    for (let k = 0; k < n; k++) {
      expect(curve[n - 1 - k] + curve[k]).toBe(0);
      expect(Math.abs(curve[k])).toBeLessThanOrEqual(1);
      if (k === 0) continue;
      // Past |u| ≈ 1.2 the tanh tail flattens below Float32 resolution
      if (Math.abs(u(k)) < 1.2) expect(curve[k]).toBeGreaterThan(curve[k - 1]);
      else expect(curve[k]).toBeGreaterThanOrEqual(curve[k - 1]);
    }
  });

  it('rounds peaks above the knee instead of clipping them', () => {
    const at = (x: number): number => curve[Math.round(((x + 2) * (n - 1)) / 4)];
    expect(at(1)).toBeCloseTo(0.9 + 0.1 * Math.tanh(1), 5);
    expect(at(1)).toBeLessThan(1);
    expect(at(1.2)).toBeGreaterThan(at(1));
    // Slope matches at the knee: no corner, so no hard-clip harmonics
    const slope = (curve[Math.round((2.9 * (n - 1)) / 4) + 1] - at(0.9)) / (4 / (n - 1));
    expect(slope).toBeCloseTo(1, 2);
  });
});

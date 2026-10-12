import { describe, it, expect } from 'vitest';
import { FrameRateMonitor } from '../src/utils/frameRate';

/** Feeds frames spaced by `intervals` (cycled) from `start`; returns the hits and the end time. */
function run(
  monitor: FrameRateMonitor,
  intervals: number[],
  frames: number,
  start = 0
): { hits: number[]; end: number } {
  const hits: number[] = [];
  let now = start;
  for (let i = 0; i < frames; i++) {
    if (monitor.sample(now)) hits.push(now);
    now += intervals[i % intervals.length];
  }
  return { hits, end: now };
}

describe('FrameRateMonitor (ADR 0098)', () => {
  it('flags a steady 30 fps loop once, after warm-up and a full window', () => {
    const monitor = new FrameRateMonitor();
    const { hits } = run(monitor, [1000 / 30], 600);
    expect(hits).toHaveLength(1);
    // 500 ms warm-up plus 60 intervals of 33.3 ms
    expect(hits[0]).toBeGreaterThan(2400);
    expect(hits[0]).toBeLessThan(2700);
  });

  it('stays quiet at 60 and 120 fps', () => {
    expect(run(new FrameRateMonitor(), [1000 / 60], 2000).hits).toEqual([]);
    expect(run(new FrameRateMonitor(), [1000 / 120], 4000).hits).toEqual([]);
  });

  it('stays quiet at 60 fps with 20 % dropped frames', () => {
    const drop = [1000 / 60, 1000 / 60, 1000 / 60, 2000 / 60];
    expect(run(new FrameRateMonitor(), drop, 2000).hits).toEqual([]);
  });

  it('stays quiet at 60 fps even when half the frames are dropped at random spots', () => {
    const half = [1000 / 60, 2000 / 60, 2000 / 60, 1000 / 60, 1000 / 60, 2000 / 60];
    expect(run(new FrameRateMonitor(), half, 2000).hits).toEqual([]);
  });

  it('ignores the first 500 ms after a reset', () => {
    const monitor = new FrameRateMonitor();
    // 59 in-band intervals inside the warm-up never count
    run(monitor, [1000 / 30], 15);
    monitor.reset();
    const { hits } = run(monitor, [1000 / 30], 600, 10_000);
    expect(hits[0] - 10_000).toBeGreaterThan(2400);
  });

  it('skips gaps over 100 ms instead of judging them', () => {
    const monitor = new FrameRateMonitor();
    // 60 fps with a 250 ms stall every 20 frames: never flagged
    const stalls = [...Array<number>(19).fill(1000 / 60), 250];
    expect(run(monitor, stalls, 3000).hits).toEqual([]);
  });

  it('restarts the window on reset, so a pause never counts', () => {
    const monitor = new FrameRateMonitor();
    const first = run(monitor, [1000 / 30], 60);
    expect(first.hits).toEqual([]);
    monitor.reset();
    // Resume ten seconds later: warm-up and a full window again
    const { hits } = run(monitor, [1000 / 30], 600, first.end + 10_000);
    expect(hits).toHaveLength(1);
    expect(hits[0] - (first.end + 10_000)).toBeGreaterThan(2400);
  });

  it('never fires again after the first time, even across resets', () => {
    const monitor = new FrameRateMonitor();
    expect(run(monitor, [1000 / 30], 600).hits).toHaveLength(1);
    monitor.reset();
    expect(run(monitor, [1000 / 30], 600, 100_000).hits).toEqual([]);
  });
});

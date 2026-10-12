/**
 * Detects a frame loop held to ~30 fps, as WebKit's Low Power Mode and Chrome's battery
 * saver do to requestAnimationFrame (ADR 0098). Pure: it only sees frame timestamps.
 */

/** Frames in the first half second after a (re)start are skipped: warm-up and first render. */
const WARMUP_MS = 500;
/** A longer gap is a tab switch or a stall, not the frame rate. */
const MAX_GAP_MS = 100;
/** Intervals judged at once, about 2 s at 30 fps. */
const WINDOW = 60;
/** Frames between verdicts once the window is full. */
const CHECK_EVERY = 30;
/** A 30 fps interval is 33.3 ms; the band is 27–33 Hz. */
const THROTTLED_MIN_MS = 30;
const THROTTLED_MAX_MS = 37;
/**
 * Share of intervals that must fall in the band. A 60 Hz loop dropping frames mixes
 * 16.7 and 33.3 ms intervals and stays well below it. Above one half, it also puts the
 * median in the band.
 */
const THROTTLED_SHARE = 0.75;

export class FrameRateMonitor {
  private readonly intervals = new Float64Array(WINDOW);
  private count = 0;
  private start: number | null = null;
  private last = 0;
  private fired = false;

  /** Forgets the samples, so a pause never counts as a long frame. */
  public reset(): void {
    this.count = 0;
    this.start = null;
  }

  /** Records a frame timestamp; true the first time the loop is judged throttled, then never again. */
  public sample(now: number): boolean {
    if (this.fired) return false;
    if (this.start === null) {
      this.start = now;
      this.last = now;
      return false;
    }
    const dt = now - this.last;
    this.last = now;
    if (now - this.start < WARMUP_MS || dt <= 0 || dt > MAX_GAP_MS) return false;

    this.intervals[this.count % WINDOW] = dt;
    this.count++;
    if (this.count < WINDOW || (this.count - WINDOW) % CHECK_EVERY !== 0) return false;

    let inBand = 0;
    for (let i = 0; i < WINDOW; i++) {
      const interval = this.intervals[i];
      if (interval >= THROTTLED_MIN_MS && interval <= THROTTLED_MAX_MS) inBand++;
    }
    if (inBand < WINDOW * THROTTLED_SHARE) return false;
    this.fired = true;
    return true;
  }
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Screen Wake Lock Controller
// Copyright (C) 2026 A. C. Lo Cascio

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean;
  readonly type: 'screen';
  release(): Promise<void>;
  onrelease: ((this: WakeLockSentinelLike, ev: Event) => void) | null;
}

interface NavigatorWithWakeLock {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
}

/**
 * ScreenWakeLockController manages W3C Screen Wake Lock API requests.
 * Prevents mobile devices, tablets, and laptops from dimming or sleeping
 * during active sight-reading sessions when the user's hands are on their instrument.
 * Zero external dependencies, zero-bloat, fail-safe on unsupported browsers.
 */
export class ScreenWakeLockController {
  private sentinel: WakeLockSentinelLike | null = null;
  private isAcquiring: boolean = false;
  /** Latest caller intent; guards against release() racing an in-flight request. */
  private wantHeld: boolean = false;

  /**
   * Requests a screen wake lock if supported by the browser and page is visible.
   */
  public async acquire(): Promise<void> {
    this.wantHeld = true;
    if (typeof navigator === 'undefined') return;
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (!nav.wakeLock || this.isAcquiring) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.sentinel && !this.sentinel.released) return;

    this.isAcquiring = true;
    try {
      const sentinel = await nav.wakeLock.request('screen');
      if (!this.wantHeld) {
        // release() was called while the request was pending
        await sentinel.release();
        return;
      }
      sentinel.onrelease = () => {
        if (this.sentinel === sentinel) this.sentinel = null;
      };
      this.sentinel = sentinel;
    } catch {
      // Rejections are expected if user agent disallows wake locks
      // (e.g. low battery, platform policy, or inactive window).
      this.sentinel = null;
    } finally {
      this.isAcquiring = false;
    }
  }

  /**
   * Releases the active screen wake lock (or cancels one still being requested).
   */
  public async release(): Promise<void> {
    this.wantHeld = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // Ignored
      }
    }
  }

  /**
   * Returns whether a screen wake lock is currently held.
   */
  public isHeld(): boolean {
    return Boolean(this.sentinel && !this.sentinel.released);
  }
}

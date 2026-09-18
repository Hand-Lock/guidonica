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

  /**
   * Requests a screen wake lock if supported by the browser and page is visible.
   */
  public async acquire(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    const nav = navigator as unknown as NavigatorWithWakeLock;
    if (!nav.wakeLock || this.isAcquiring) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    try {
      if (!this.sentinel || this.sentinel.released) {
        this.isAcquiring = true;
        this.sentinel = await nav.wakeLock.request('screen');
        this.sentinel.onrelease = () => {
          this.sentinel = null;
        };
      }
    } catch {
      // Rejections are expected if user agent disallows wake locks
      // (e.g. low battery, platform policy, or inactive window).
      this.sentinel = null;
    } finally {
      this.isAcquiring = false;
    }
  }

  /**
   * Releases the active screen wake lock.
   */
  public async release(): Promise<void> {
    if (this.sentinel && !this.sentinel.released) {
      try {
        await this.sentinel.release();
      } catch {
        // Ignored
      }
      this.sentinel = null;
    }
  }

  /**
   * Returns whether a screen wake lock is currently held.
   */
  public isHeld(): boolean {
    return Boolean(this.sentinel && !this.sentinel.released);
  }
}

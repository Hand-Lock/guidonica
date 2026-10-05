import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ScrollerView } from '../src/scroller/scroller';
import type { MeasureBuffer } from '../src/scroller/buffer';
import type { MetronomeEngine } from '../src/audio/metronome';
import type { MeasureRenderer } from '../src/notation/renderer';
import {
  DEFAULT_APP_SETTINGS,
  ORIENTATION_TIP_KEY,
  dismissOrientationTip,
  isOrientationTipDismissed,
} from '../src/storage';
import { isPortraitLockedInAppBrowser } from '../src/utils/inAppBrowser';

describe('Auto zoom follows the measured stage (ADR 0055)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let observerCallback: (() => void) | null = null;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function () {
      return {} as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          observerCallback = callback;
        }
        observe(): void {}
        disconnect(): void {}
      }
    );
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
    observerCallback = null;
  });

  it('runs onResize after the new viewport width is cached', () => {
    const parent = document.createElement('main');
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    let width = 390;
    parent.getBoundingClientRect = () => ({ width, height: 500 }) as DOMRect;

    const scroller = new ScrollerView(
      canvas,
      { rerender: () => {} } as unknown as MeasureBuffer,
      {} as unknown as MetronomeEngine,
      { setDpr: () => {} } as unknown as MeasureRenderer,
      () => DEFAULT_APP_SETTINGS
    );
    vi.spyOn(scroller, 'renderFrame').mockImplementation(() => {});
    expect(scroller.getViewportWidth()).toBe(390);

    const seen: number[] = [];
    scroller.onResize(() => seen.push(scroller.getViewportWidth()));

    // Rotate to landscape: layout settles, then the observer delivers
    width = 844;
    observerCallback?.();
    expect(seen).toEqual([844]);
    scroller.destroy();
  });

  it('sizes the stage from the content box inside the notch insets (ADR 0056)', () => {
    const parent = document.createElement('main');
    parent.style.paddingLeft = '47px';
    parent.style.paddingRight = '47px';
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    document.body.appendChild(parent);
    let width = 390;
    parent.getBoundingClientRect = () => ({ width, height: 500 }) as DOMRect;

    const scroller = new ScrollerView(
      canvas,
      { rerender: () => {} } as unknown as MeasureBuffer,
      {} as unknown as MetronomeEngine,
      { setDpr: () => {} } as unknown as MeasureRenderer,
      () => DEFAULT_APP_SETTINGS
    );
    vi.spyOn(scroller, 'renderFrame').mockImplementation(() => {});

    const seen: number[] = [];
    scroller.onResize(() => seen.push(scroller.getViewportWidth()));

    width = 812;
    observerCallback?.();
    expect(seen).toEqual([812 - 94]);
    expect(canvas.style.width).toBe('718px');
    scroller.destroy();
    parent.remove();
  });

  it('pads the stage and offsets the canvas by the safe-area insets (ADR 0056)', () => {
    const styleCss = fs.readFileSync(path.resolve(__dirname, '../src/style.css'), 'utf-8');
    expect(styleCss).toMatch(
      /\.canvas-wrapper \{[^}]*padding: 0 env\(safe-area-inset-right\) 0 env\(safe-area-inset-left\);/
    );
    expect(styleCss).toMatch(/#scroller-canvas \{[^}]*left: env\(safe-area-inset-left\);/);
    expect(styleCss).toMatch(/\.canvas-wrapper::after \{[^}]*right: env\(safe-area-inset-right\);/);
  });

  it('drops the window resize listener that read a stale width', () => {
    const mainTs = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
    expect(mainTs).not.toMatch(/window\.addEventListener\('resize'[\s\S]{0,120}syncAutoZoom/);
    expect(mainTs).toMatch(/this\.scroller\.onResize\(/);
  });
});

describe('Portrait landscape tip (ADR 0055)', () => {
  const rootDir = path.resolve(__dirname, '..');

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows only on small portrait touch screens until dismissed', () => {
    const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf-8');
    expect(styleCss).toMatch(
      /@media \(orientation: portrait\) and \(pointer: coarse\) and \(max-width: 600px\) \{\s*\.orientation-notice:not\(\[hidden\]\) \{\s*display: flex;/
    );
    expect(styleCss).toMatch(/\.orientation-notice \{\s*display: none;/);
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
    expect(html).toContain('id="orientation-notice"');
    expect(html).toContain('id="btn-orientation-dismiss"');
    expect(html).toContain('<symbol id="i-rotate"');
  });

  it('round-trips the dismissal flag', () => {
    expect(isOrientationTipDismissed()).toBe(false);
    dismissOrientationTip();
    expect(isOrientationTipDismissed()).toBe(true);
    expect(window.localStorage.getItem(ORIENTATION_TIP_KEY)).toBe('1');
  });

  it('tolerates localStorage throwing', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => dismissOrientationTip()).not.toThrow();
    expect(isOrientationTipDismissed()).toBe(false);
  });
});

describe('In-app browser landscape tip (ADR 0083)', () => {
  const locked = {
    'Instagram iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.4.32.98 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 606459473)',
    'Instagram Android':
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.53 Mobile Safari/537.36 Instagram 333.0.0.42.91 Android (34/14; 420dpi; 1080x2400; Google/google; Pixel 8; shiba; shiba; en_US; 606458190)',
    'Facebook iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/468.0.0.39.104;FBBV/609318592;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/80]',
    'Facebook Android':
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP1A.240505.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.53 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/467.0.0.46.85;]',
    'Threads iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 334.0.4.32.98 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 606459473)',
  };
  const free = {
    'Safari iOS':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Chrome Android':
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Chrome desktop':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  };

  it.each(Object.entries(locked))('detects %s', (_, ua) => {
    expect(isPortraitLockedInAppBrowser(ua)).toBe(true);
  });

  it.each(Object.entries(free))('leaves %s alone', (_, ua) => {
    expect(isPortraitLockedInAppBrowser(ua)).toBe(false);
  });

  it('swaps the tip keys so language switches keep the in-app text', () => {
    const mainTs = fs.readFileSync(path.resolve(__dirname, '../src/main.ts'), 'utf-8');
    expect(mainTs).toMatch(
      /isPortraitLockedInAppBrowser\(navigator\.userAgent\)[\s\S]{0,400}dataset\.i18n = 'inAppTitle'[\s\S]{0,80}dataset\.i18n = 'inAppBody'[\s\S]{0,40}applyDom\(orientationNotice\)/
    );
  });
});

import { describe, it, expect } from 'vitest';
import { safariPlatform } from '../src/utils/safari';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const mac = (version: string): string =>
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${version} Safari/605.1.15`;

describe('Safari web app detection (ADR 0114)', () => {
  it('finds Safari on iPhone and iPad', () => {
    expect(safariPlatform(IPHONE_SAFARI, 5)).toBe('ios');
    expect(safariPlatform(IPAD_SAFARI, 5)).toBe('ios');
  });

  it('tells iPadOS desktop mode from a Mac by its touch points', () => {
    expect(safariPlatform(mac('18.5'), 5)).toBe('ios');
    expect(safariPlatform(mac('18.5'), 0)).toBe('mac');
    expect(safariPlatform(mac('18.5'), 1)).toBe('mac');
  });

  it('offers the Dock from Safari 17 on, and nothing before', () => {
    expect(safariPlatform(mac('17.0'), 0)).toBe('mac');
    expect(safariPlatform(mac('26.0'), 0)).toBe('mac');
    expect(safariPlatform(mac('16.6'), 0)).toBeNull();
  });

  it('ignores the other iOS browsers and in-app WebViews', () => {
    for (const ua of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/137.0.7151.79 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/139.0 Mobile/15E148 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/137.3296.68 Mobile/15E148 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/370.0.774043014 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 385.0.0.18.84 (iPhone15,2; iOS 18_5; en_US; en; scale=3.00; 1179x2556; 739283917)',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/512.0.0.43.109;FBBV/735284161;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.5;FBSS/3;FBCR/;FBID/phone;FBLC/en_US;FBOP/5]',
    ]) {
      expect(safariPlatform(ua, 5), ua).toBeNull();
    }
  });

  it('ignores desktop Chrome, Firefox and Edge', () => {
    for (const ua of [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:139.0) Gecko/20100101 Firefox/139.0',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
    ]) {
      expect(safariPlatform(ua, 0), ua).toBeNull();
    }
  });
});

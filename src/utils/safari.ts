// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Safari web app detection for the install tip (ADR 0114)
// Copyright (C) 2026 A. C. Lo Cascio

import { isPortraitLockedInAppBrowser } from './inAppBrowser';

export type SafariPlatform = 'ios' | 'mac';

// Other browsers and WebViews that also carry the Safari token
const NOT_SAFARI = /\b(CriOS|FxiOS|EdgiOS|OPiOS|OPT|GSA|DuckDuckGo|YaBrowser|Chrome|Chromium|Edg|Firefox)\b/;

/** Safari that can add Guidonica as a web app: Home Screen on iOS/iPadOS, Dock on macOS 14+ (Safari 17+). */
export function safariPlatform(ua: string, maxTouchPoints: number): SafariPlatform | null {
  const version = /\bVersion\/(\d+)[\d.]*.*\bSafari\//.exec(ua);
  if (!version || NOT_SAFARI.test(ua) || isPortraitLockedInAppBrowser(ua)) return null;
  if (/\b(iPhone|iPad|iPod)\b/.test(ua)) return 'ios';
  if (!/\bMacintosh\b/.test(ua)) return null;
  // iPadOS asks for desktop sites with a Mac user agent; only the touch points tell it apart
  if (maxTouchPoints > 1) return 'ios';
  return Number(version[1]) >= 17 ? 'mac' : null;
}

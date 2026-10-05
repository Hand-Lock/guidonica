/**
 * True in Meta's in-app browsers (Instagram, Facebook, Threads = "Barcelona"), which are locked
 * to portrait, so the landscape tip has to say "open in your browser" instead (ADR 0083).
 */
export function isPortraitLockedInAppBrowser(ua: string): boolean {
  return /\b(Instagram|FBAN|FBAV|FB_IAB|Barcelona)\b/.test(ua);
}

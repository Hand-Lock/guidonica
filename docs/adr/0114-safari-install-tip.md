# 0114. Safari Install Tip

- **Status**: Accepted
- **Date**: 2026-10-21
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0063](0063-offline-service-worker.md), [0083](0083-in-app-browser-landscape-tip.md), [0087](0087-rotating-tips.md)

## Context & Problem Statement

The rotating tips (ADR 0087) include a generic `install` tip: *"After one visit Guidonica works
without a connection. Add it to your home screen or install it from the browser menu."* Chromium
browsers back that with an install prompt and an "Install" menu item. Safari has neither: on
iPhone and iPad the only way is **Share → Add to Home Screen**, and on macOS 14+ (Safari 17+)
**File → Add to Dock**. Safari users therefore rarely learn that Guidonica can run as a web app
with its own icon, full screen or in its own window, offline. The tip also sat near the end of
the rotation, so a returning user first saw it around the 17th visit.

## Decision & Implementation

1. **Detection: `src/utils/safari.ts`.** A pure function of the user agent and
   `navigator.maxTouchPoints`, unit-tested like `isPortraitLockedInAppBrowser` (ADR 0083):

   ```ts
   export type SafariPlatform = 'ios' | 'mac';
   export function safariPlatform(ua: string, maxTouchPoints: number): SafariPlatform | null
   ```

   - **Safari** carries `Version/N … Safari/` and none of `CriOS FxiOS EdgiOS OPiOS OPT GSA
     DuckDuckGo YaBrowser Chrome Chromium Edg Firefox` (the other browsers and WebViews that also
     carry the Safari token), and is not a Meta in-app browser (`isPortraitLockedInAppBrowser`),
     whose WebView has no Add to Home Screen.
   - **`ios`**: `iPhone`, `iPad` or `iPod`, or `Macintosh` with `maxTouchPoints > 1`, which is
     iPadOS asking for desktop sites.
   - **`mac`**: `Macintosh`, at most one touch point, `Version/` major ≥ 17. Older Safari has no
     Add to Dock and gets `null`.
   - Everything else, including Chrome, Firefox and Edge on iOS, gets `null`.

   User-agent sniffing is the only signal: Safari exposes no install API to feature-detect.
   A wrong guess costs one tip with the wrong menu path, never a broken feature.

2. **Tips.** `TipContext` gains `safari: SafariPlatform | null`, computed in
   `tipContext()` from `navigator.userAgent` and `navigator.maxTouchPoints`. Two new tips join
   `install`, mutually exclusive, all without an action button (the steps are in the browser's
   own chrome):

   | tip | shown when |
   |---|---|
   | `install` | not standalone and not Safari |
   | `installIos` | not standalone and `safari === 'ios'` |
   | `installMac` | not standalone and `safari === 'mac'` |

   Standalone detection is unchanged and already covers both targets: `navigator.standalone` on
   iOS, `(display-mode: standalone)` for a Dock web app (the manifest declares
   `"display": "standalone"`).

3. **Order.** The install group moves from near the end of `FEATURE_TIPS` to second, right after
   `levels`, so every browser shows it on the second visit. Offline use, a full-screen stage and
   an icon of its own matter more early than late. As ADR 0087 notes, reordering only shifts each
   user's rotation once.

4. **Copy.** Each locale names Apple's own localized menu items:

   | | iPhone, iPad | Mac |
   |---|---|---|
   | en | Share → Add to Home Screen | File → Add to Dock |
   | it | Condividi → Aggiungi alla schermata Home | Archivio → Aggiungi al Dock |
   | fr | Partager → Sur l'écran d'accueil | Fichier → Ajouter au Dock |
   | de | Teilen → Zum Home-Bildschirm | Ablage → Zum Dock hinzufügen |
   | es | Compartir → Añadir a pantalla de inicio | Archivo → Añadir al Dock |

5. **Tooling.** The run-guidonica driver gains `--ua UA`, which sets the context's user agent, so
   `--browser webkit --tips --ua '<iPhone or Mac Safari UA>' eval:location.reload() wait:1500`
   shows either tip on the second boot.

## Consequences

- Safari users get exact steps instead of a reference to an install menu that does not exist.
- Everyone sees an install tip on their second visit instead of around the seventeenth.
- Size: the entry chunk grows by 346 B gzipped (the detector, the tip rows and the English copy);
  each lazy locale chunk by about 100 B.
- Apple renames menu items now and then (iOS 26 puts Share behind the ⋯ button in the compact tab
  bar); the copy needs a look when that happens. `tests/safari.test.ts` pins the detection rules
  on real user-agent strings.

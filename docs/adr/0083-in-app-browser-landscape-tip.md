# 0083. In-App Browser Landscape Tip

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md)

## Context & Problem Statement

ADR 0055 shows a tip on small portrait touch screens: "Best in landscape. Rotate your device…".
Links shared on Instagram open in its in-app browser, which is locked to portrait, so the advice
cannot be followed there. The same holds for Facebook and Threads, which share Meta's webview.

A page cannot unlock the rotation. iOS has no orientation lock API, and Android's
`screen.orientation.lock()` only works in fullscreen, which these webviews don't reliably grant.
What does work is opening the page in the system browser, from the webview's ⋯ menu.

## Decisions & Implementation

- `src/utils/inAppBrowser.ts`: `isPortraitLockedInAppBrowser(ua)` tests the user agent for
  `\b(Instagram|FBAN|FBAV|FB_IAB|Barcelona)\b`. `Instagram` covers both platforms, `FBAN`/`FBAV`
  Facebook on iOS, `FB_IAB` Facebook on Android, and `Barcelona` is the Threads token. Pure
  function, so it is unit-tested against real UA strings.
- `main.ts`, where the tip is wired: in such a browser the `<strong>`'s `data-i18n` becomes
  `inAppTitle` and the `<span>`'s `inAppBody`, then `applyDom(orientationNotice)` writes them.
  Since the keys live in the attributes, a later language switch re-applies the in-app text.
  `setText` keeps the nested `<strong>` intact.
- New locale keys `inAppTitle` / `inAppBody` in all five locales. The dismiss button keeps
  `landscapeDismissAria`, and dismissal reuses `ORIENTATION_TIP_KEY` unchanged.
- The CSS rule that decides visibility (portrait, coarse pointer, ≤ 600px) is unchanged, so the
  tip still disappears in landscape and on tablets.

## Consequences

- Instagram, Facebook and Threads users get advice they can act on; everyone else sees the
  original tip.
- UA sniffing is brittle by nature. A missed in-app browser falls back to the 0055 tip, which is
  the old behavior, and a false positive only changes the wording of a dismissible tip.
- Other portrait-locked webviews (TikTok, LinkedIn, …) can join by adding their token to the
  regular expression.
- Zero runtime cost beyond one regular expression at startup; no new listeners.

# 0060. Self-Hosted Text Fonts & a No-Tracking Privacy Note

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & lauseta
- **Amends**: [0023](0023-ubuntu-mono-monospace-typography.md) (how Ubuntu Mono is delivered), [0012](0012-web-font-synchronization-and-clef-invalidation.md) (the solfège label face it waits on)

## Context & Problem Statement

`index.html` loaded Alegreya, Alegreya Sans and Ubuntu Mono from Google Fonts: two `preconnect`s
and a `fonts.googleapis.com/css2` stylesheet, whose `@font-face` rules then fetched woff2 files
from `fonts.gstatic.com`. Every visitor's IP address and user agent therefore went to Google before
the first note was drawn.

- **Legal.** LG München I (3 O 17493/20, 20 January 2022) held that embedding Google Fonts this
  way, without consent, transfers personal data to Google in breach of the GDPR. Guidonica is
  served from `guidonica.it` to an EU audience.
- **Product claim.** The app calls itself client-only, and the About dialog credits only local
  dependencies. A third-party font CDN contradicts both, and privacy-minded audiences (Hacker News,
  Reddit, Mastodon) check the Network tab.
- **Robustness.** A blocked or slow Google domain (some networks, some countries, content
  blockers) silently swapped every title to Georgia.

Nothing else in the page leaves the origin. With the fonts local, the app makes no third-party
requests, sets no cookies, and stores only functional settings in `localStorage`, so it needs no
consent banner.

## Decision

### Ship Google's Latin subsets from our own origin

`scripts/fetch-ui-fonts.mjs` (Node 22, zero dependencies, `pnpm ui-fonts`) requests the same
`css2` URL the page used, with a current Chrome user agent, keeps only the `/* latin */`
`@font-face` blocks, and downloads their woff2 files byte for byte into `src/fonts/`:

| File | Face | woff2 |
|---|---|---|
| `alegreya-700.woff2` | Alegreya Bold (titles) | 23.8 KB |
| `alegreya-italic.woff2` | Alegreya Italic, variable 400–700 (tempo marking, dialog titles) | 43.4 KB |
| `alegreya-sans-400.woff2` | Alegreya Sans Regular (body) | 16.7 KB |
| `alegreya-sans-500.woff2` | Alegreya Sans Medium | 16.8 KB |
| `alegreya-sans-700.woff2` | Alegreya Sans Bold (buttons, solfège labels on canvas) | 16.8 KB |
| `ubuntu-mono-400.woff2` | Ubuntu Mono Regular | 11.6 KB |
| `ubuntu-mono-700.woff2` | Ubuntu Mono Bold (BPM, zoom, `<kbd>`) | 11.5 KB |

It also writes the licences: `OFL-Alegreya.txt`, `OFL-AlegreyaSans.txt` (SIL OFL 1.1) and
`UFL.txt` (Ubuntu Font Licence 1.0), from `google/fonts`. The output is committed, so clone →
install → dev never touches the network, as with the ADR 0058 music font.

- **Why Google's files and not our own subset.** They are already Latin-only, they are the exact
  bytes every visitor received before (no visual change), and redistributing them unmodified keeps
  the licences simple: the UFL places conditions on modified versions, which a fresh `pyftsubset`
  run would create. Re-subsetting to the ~120 characters the UI uses would save perhaps 40%, but
  only on faces the browser actually requests.
- **Why only Latin.** en, it, fr, de and es (ADR 0059) need nothing outside Google's Latin range
  (U+0000–00FF, Œœ, general punctuation, €, ™, ↑↓ …). The few symbols beyond it in the UI
  (→ ↗ ♩ ♪) were never in these fonts on any subset and already fell back to system fonts.

### `@font-face` in `src/style.css`

Seven rules at the top of the stylesheet with the same family names, styles, weights,
`font-display: swap` and `unicode-range` as Google's CSS. `src: url('./fonts/<file>.woff2')` lets
Vite fingerprint each file into `dist/assets/`. The Alegreya italic rule declares
`font-weight: 400 700` because Google serves one variable file for both. `--font-title`,
`--font-body` and `--font-mono` keep their family names and fallback stacks, so nothing else
in the CSS changes. A browser downloads a face only when some text uses it, as before.

`index.html` drops both `preconnect`s and the Google stylesheet link.

### Canvas label face

`renderer.ts` draws solfège labels with `700 …px "Alegreya Sans"`, and `waitForMusicFonts()` in
`src/notation/fonts.ts` already waits on `document.fonts.load('700 12px "Alegreya Sans"')`. That
call now resolves against the local `@font-face`; only its comment changes. A failed load still
falls back to `system-ui` without blocking the stream.

### Privacy line in the About dialog

The About metadata grid gains a **Privacy** row: "No accounts, no cookies, no tracking: nothing
leaves your device." (`metaPrivacy`, `privacyNote` in every locale). The Third-Party
Acknowledgements paragraph (`thanksHtml`) now credits Alegreya, Alegreya Sans and Ubuntu Mono with
their licences, since the app now redistributes them.

If page-view counting is ever added (GoatCounter was considered and deferred), this line must
change in the same commit, and that endpoint becomes the single documented exception.

## Consequences

- **Zero third-party requests.** With `pnpm preview`, the only origin in the request log is the
  app's own; `dist/index.html` contains no `googleapis` or `gstatic`.
- **Same bytes, one fewer connection.** The fonts weigh what they did, but arrive over the
  already-open origin connection, with no extra DNS/TLS handshake to two Google hosts and no
  render-blocking cross-origin stylesheet.
- **Typography is unchanged**: the same font files, families and fallbacks.
- **No consent banner** is needed: no cookies, no third-party processing, only functional
  `localStorage`.
- **Maintenance.** Changing a weight or adding a family means editing `CSS_URL` in
  `scripts/fetch-ui-fonts.mjs`, re-running `pnpm ui-fonts`, and adding the matching `@font-face`
  rule. A new locale outside Latin (e.g. Greek, Cyrillic) needs that script's subset filter widened.

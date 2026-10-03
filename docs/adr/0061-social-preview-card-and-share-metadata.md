# 0061. Social Preview Card & Share Metadata

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Before announcing Guidonica on social media, a link to `https://guidonica.it` pasted into X,
Facebook, WhatsApp, Telegram, Discord, Reddit, Mastodon or LinkedIn showed a bare URL with no
image: `index.html` had no Open Graph or Twitter Card tags. Those crawlers do not run JavaScript,
so the card must be static markup in the HTML shell.

The meta description was also written for engineers ("high-performance procedural … engine"),
and search results and cards would show it to musicians.

## Decision

### Static tags in `index.html`

- `<meta name="description">`: *"Free sight-reading and solfège practice: endless fresh sheet
  music scrolls past a playhead in time with a metronome. No sign-up, works on any device."*
- `<title>` and `og:title`: **Guidonica — Sight-Reading & Solfège Practice**. English `docTitle`
  matches, so `applyDom` doesn't change the tab title after boot. Other locales keep their own.
- `<link rel="canonical" href="https://guidonica.it/">`, so the GitHub Pages mirror
  (`hand-lock.github.io/guidonica`) doesn't compete with the custom domain (ADR 0031).
- Open Graph: `og:type=website`, `og:site_name`, `og:title`, `og:description`,
  `og:url=https://guidonica.it/`, `og:image` (absolute URL, as crawlers require) with `:type`,
  `:width=1200`, `:height=630` and `:alt`, `og:locale=en_US` plus `og:locale:alternate` for
  it_IT, fr_FR, de_DE and es_ES (ADR 0059).
- Twitter/X: `twitter:card=summary_large_image`, title, description, image and image alt.
  X reads `og:*` as a fallback, but explicit tags avoid edge cases.

The card text stays English: a crawler can't see the visitor's language, and the app switches
language on load anyway.

### `public/og-image.png` (1200 × 630, 158 KB)

A composed card, not a mock-up:

- **Top:** the brand mark (`docs/brand/guidonica-mark.svg`, ADR 0048), the "Guidonica" wordmark
  in Alegreya Bold, the subtitle *Sight-reading & solfège practice* in Alegreya Bold Italic
  (accent `#008269`), a one-line pitch in Alegreya Sans, and a `guidonica.it` pill in Ubuntu Mono.
  The fonts come from `src/fonts/` (ADR 0060). The background is the light theme's `--bg-gradient`.
- **Bottom:** a 290 px strip of a real capture of the running production build. Settings: light
  theme, treble clef, 4/4, 80 BPM, halves to eighths with dots, rests, ties, steps to fifths,
  solfège syllable labels, zoom 85%. It was captured mid-stream at device pixel ratio 2 and shown
  at 1.25× scale, so noteheads, the tie, labels and the red playhead stay legible in a phone-sized
  card preview.

How it was made (no build step; recreate it by hand if the UI changes significantly):
`pnpm build && pnpm preview`, then headless Chromium (Playwright) with
`guidonica_onboarded_v1` and the settings above seeded in `localStorage`. Press Space, wait
about 14 s, screenshot at 1200 × 630 @2×. A small HTML page then composes the header and the
cropped strip, and is screenshotted at 1200 × 630 @1×. The image stays under the ~300 KB that
keeps WhatsApp and Telegram previews reliable.

The same image heads the README, under the title and the plain-language pitch.

## Consequences

- Every major platform renders a large-image card with the real product in it.
- `og:image` is an absolute `https://guidonica.it/…` URL, so the mirror's cards also point at the
  canonical host.
- Platforms cache cards aggressively. After changing the image, rename it or append
  `?v=N` to `og:image`, then re-scrape with the Facebook Sharing Debugger or LinkedIn Post
  Inspector.
- Verify a deploy with opengraph.xyz, those two inspectors, and a paste into a WhatsApp or Telegram
  chat to yourself.

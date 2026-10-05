# 0079. Social Profile Banners

- **Status**: Accepted
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Guidonica had a share card (`public/og-image.png`, ADR 0061) and an avatar (the Guidonian Hand
mark, ADR 0048), but no header art for its social profiles. Each platform wants a different size,
covers part of the image with the avatar, and crops differently on phones, desktops and TVs.

The ADR 0061 card was made by hand, and that recipe has to be recreated whenever the UI changes.
The banners should come from a script instead.

## Decision

### Outputs (`docs/brand/banners/`, committed)

| File | Size | For | Limit checked |
|---|---|---|---|
| `header-3000x1000.png` | 3000 × 1000 | Bluesky (its recommended size) | ≤ 1,000,000 B (Bluesky's image blob cap) |
| `header-1500x500.png` | 1500 × 500 | Mastodon, X | ≤ 2 MB |
| `youtube-2560x1440.png` | 2560 × 1440 | YouTube channel art | ≤ 6 MB |

Both headers come from one layout in 1500 × 500 CSS px, rendered at device pixel ratio 1 and 2.
If the 3000 × 1000 PNG ever goes over 1 MB, the script writes it as a JPEG (quality 92) instead.
The first run's PNG is 0.3 MB, so that fallback hasn't been needed.

These files aren't part of the app. They live in `docs/brand/` next to the README logo and are
uploaded to each profile by hand.

### Look

The banners use the share card's look: the light theme's `--bg-gradient`
(`#e3ebf4 → #f1f5f9 → #e6edf5`, 160°), "Guidonica" in Alegreya Bold, *Sight-reading & solfège
practice* in Alegreya Bold Italic in the accent `#008269`, and a `guidonica.it` pill in Ubuntu Mono.
The fonts are the self-hosted `src/fonts/*.woff2` files (ADR 0060), inlined as data URLs. The
banners don't include the hand mark because the avatar next to them already shows it.

Below the wordmark, a white strip runs edge to edge. It's a real capture of the notation stream,
with the red playhead and solfège syllable labels.

### Safe zones

- **3:1 header (Mastodon, Bluesky, X).** The text stays inside x ≥ 420, y 60–330 of 1500 × 500.
  That keeps it clear of the avatar, which covers the bottom-left corner on all three platforms
  (X's is largest, about a 333 px circle from x = 40), and of the top and bottom strips that X
  crops on phones. The strip starts at y = 260, and the staff can run under the avatar. The
  playhead sits at x = 495 (33%), clear of X's avatar, and the staff sits high in the strip, so
  notes below it stay above the bottom crop.
- **YouTube.** Phones show only the 1546 × 423 centre (x 507–2053, y 508–931), desktops a
  2560 × 423 band, TVs the full image. The wordmark, tagline and pill sit on one line at the top
  of the safe area, and the staff strip fills the rest of it, running the full 2560 px width. Above
  and below the band, which only TVs show, a bass and an alto staff at 20% opacity continue the
  stream. They use `mix-blend-mode: multiply`, so their white canvas background disappears.

`pnpm banners --guides` also writes copies with the avatar outlines (X, Bluesky, Mastodon), the
crop strips and the safe areas drawn on top, to `$TMPDIR/guidonica-banner-guides/`. They're for
review and aren't committed. The avatar positions are measured from each platform's web layout,
which can change.

### Pipeline: `scripts/build-banners.mjs` (`pnpm banners`, dev-only)

1. **Browser.** The script reuses the run-guidonica Playwright setup. `PW_ENTRY`,
   `browserCache()`, `findExecutable()` and `findChromium()` moved from `driver.mjs` into
   `.claude/skills/run-guidonica/chromium.mjs`, which both files import. The driver behaves as
   before. If `playwright-core` is missing, the script stops and says to run
   `driver.mjs --setup`. `package.json` gains only the `banners` script, no dependencies.
2. **Serve.** Vite's JS API runs `build()` into a temporary directory and then `preview()` on a
   free port, in-process. The script closes the server and deletes the directory at the end. The
   build is the release channel, the same as guidonica.it.
3. **Capture.** Each strip gets a fresh browser context. `addInitScript` seeds the onboarded flag,
   a far-future seen version (so "What's new" stays closed; ADR 0078) and the ADR 0061 practice
   settings: light theme, 4/4, 80 BPM, halves to eighths with dots, rests, ties, steps to fifths,
   syllable labels, manual zoom 130%. It also replaces `Math.random` with a seeded mulberry32. The
   generator draws only from `Math.random` (`generator.ts`, `ties.ts`), so a seed always gives the
   same music. The script presses Space, waits 12 s (a 3 s count-in, then the stream on both sides
   of the playhead), and copies a band of `#scroller-canvas` with `drawImage` into a PNG data URL.
   Copying canvas pixels, not taking a screenshot, leaves out the zoom pill and the rest of the UI.
   The scroller centres the staff vertically in the canvas, so a band at a fixed offset from the
   centre always frames it.
4. **Playhead position.** The scroller puts the playhead at 22% of the viewport width. The header
   strip is captured in a 2250 px viewport and cropped to its left 1500 px, so the playhead lands
   at 495 px (33%). YouTube uses the full 2560 px viewport, which puts the playhead at 563 px,
   just inside the safe area.
5. **Compose.** `page.setContent()` loads one HTML template per format, with the strips as CSS
   background data URLs. The script then takes a screenshot at the exact pixel size.
6. **Report.** The script prints each file's size and exits non-zero if any file is over its
   platform limit.

Each strip has its own seed (`STRIPS` in the script). The number of measures generated ahead
depends on the viewport width, and that changes how many random numbers are used before the
captured passage. So the same seed gives different music in different widths. The seeds were
chosen by eye for a full, varied passage: ledger lines, a tie across the playhead, a beam and
labels.

## Consequences

- Running the script again redraws the same music. Two runs only differ by a few pixels of scroll
  offset, because the capture time depends on wall-clock timers, not the audio clock. The
  committed PNGs aren't byte-stable, so only commit them again when the banners are meant to
  change.
- When the notation UI, the palette or the fonts change, run `pnpm banners --guides`, check the
  guide copies, commit, and upload the files again: Bluesky and Mastodon take
  `header-3000x1000.png` and `header-1500x500.png`, X `header-1500x500.png`, YouTube
  `youtube-2560x1440.png`. The platforms don't update profile images from the repository.
- If a generator change alters what a seed draws, the passages change too. Check the strips for
  sparse or awkward passages, and pick a new seed if needed.
- The driver refactor is behaviour-neutral. `driver.mjs --setup` and every step work as before.

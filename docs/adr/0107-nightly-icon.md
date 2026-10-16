# 0107. Nightly Icon: A Night-Blue Tile and a Violet Thread

- **Status**: Accepted
- **Date**: 2026-10-16
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0047](0047-guidonian-hand-v2.md), [0048](0048-brand-mark-rollout-manifest-and-readme-logo.md), [0063](0063-offline-service-worker.md), [0078](0078-release-channels-calver-changelog-whats-new.md)

## Context & Problem Statement

guidonica.it/nightly/ (ADR 0078) shipped the release's teal Guidonian Hand icons. A browser tab,
an installed home-screen app or the open app gave no hint that it was Nightly. Only the install
name, "Guidonica Nightly", differed, and iOS and Android truncate it under the icon. Testers with
both channels installed could not tell them apart.

## Decision

Nightly gets its own icon family with the same hand, and its header hand is tinted.

### 1. Palette per channel (`scripts/build-icons.mjs`)

`buildTileSvg()` takes `channel: 'release' | 'nightly'` (default `release`, byte-identical to the
earlier output). A `PALETTES` table replaces the hard-coded tile colours:

| | gel stops (top → bottom) | hand shadow | back thread |
|---|---|---|---|
| release | `#1d9c82` `#0a6f5b` `#065646` | `#003d31` | `#0b8a72` |
| nightly | `#5a4fc4` `#352a92` `#1b1550` | `#120d3a` | `#4f6fc0` |

The pearl hand, aqua front thread, glow and bead stay the same: they contrast well on indigo, and
they are what makes the mark Guidonica's.

### 2. Crescent moon

Nightly tiles add a pearl crescent (`#fff` → `#dfe4f4`) with a faint lavender glow, drawn in tile
units outside the hand's fit transform. The crescent is a disc of radius r less a disc of radius
0.8 r whose centre is pushed (0.42 r, −0.3 r), towards the upper right; `crescent()` intersects
the two circles and joins them with a large outer arc and an inner arc.

It sits top left, above the thumb, the only corner the hand leaves free: the little finger fills
the top right.

- Rimmed and iOS tiles (`margin` 4 and 5.5): centre (13, 13), r = 6.5. That is inside the 14-unit
  corner radius and iOS's squircle mask, and clear of the index finger and the Γ bead's glow.
- Maskable icon (`margin` = `MASKABLE_MARGIN`): centre (20, 19.5), r = 5, so centre distance +
  radius = 22.7 ≤ 25.6, inside Android's safe circle around (32, 32).

The moon stays at the small detail level. Rendered at 32 px it is a legible six-pixel crescent, and
the colour alone already separates the favicons.

### 3. `public-nightly/` overrides

`pnpm icons` writes `public-nightly/favicon.svg`, and `--raster` also writes `favicon.ico`,
`apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `icon-maskable-512.png`. These use the
same calls as the release set, with `channel: 'nightly'`. One loop over
`[['public', 'release'], ['public-nightly', 'nightly']]` writes both sets. The release README logo
and the `#g-hand` sprite are written once, as before.

The nightly build already copies `public/` files itself (`channel()` plugin, `generateBundle`).
For each file it now prefers `public-nightly/<file>` when one exists. The file names are the same,
so the manifest, the `index.html` icon links and the service-worker precache list (ADR 0063) need
no change. The worker version hashes the nightly bytes because they are in the bundle. Release
builds never read `public-nightly/`.

### 4. Header tint

`nightlyHtml()` turns `<html lang="en">` into `<html lang="en" data-channel="nightly">`. The
language pages derive from the built shell, and `localePage()` now matches `<html lang="en"`
without the closing bracket, so they keep the attribute.

`style.css` adds a `--nightly` token (`#5b4bd0` light, `#a99cff` dark; about 5.7:1 and 7.6:1
against the bar) and
`[data-channel='nightly'] .brand-mark, [data-channel='nightly'] .intro-mark { --accent: var(--nightly); }`.
The `#g-hand` symbol strokes its thread and bead in `var(--accent)`, and custom properties inherit
into the `<use>` shadow tree, so only the header and onboarding hands turn violet. There is no JS
and no layout or paint cost.

## Verification

- `pnpm icons -- --raster` leaves every file in `public/` byte-identical and adds `public-nightly/`.
  The 32, 180, 192 and 512 px renders were checked by eye, with the safe circle drawn over the
  maskable icon.
- `GUIDONICA_CHANNEL=nightly pnpm build`: `dist/` icons equal `public-nightly/`, the manifest names
  "Guidonica Nightly", and `dist/index.html` and `dist/it/index.html` carry `data-channel`. In a
  release build the icons equal `public/` and there is no `data-channel`.
- Screenshots of `pnpm build:site` in light and dark: the header thread is violet only under
  `/nightly/`.
- `tests/brandMark.test.ts` checks that `public-nightly/favicon.svg` matches the generator, that
  every nightly file has a release namesake, and that every manifest icon exists in
  `public-nightly/` as a PNG of its declared size. `tests/serviceWorker.test.ts` and
  `tests/localePages.test.ts` check `data-channel`.

## Consequences

- A tab, a home-screen icon and the open app each tell Nightly from the release at a glance.
- `public-nightly/` is generated, like `public/`'s icons; never hand-edit it. A change to the hand
  regenerates both sets with one `pnpm icons -- --raster`.
- A release tag built before this ADR has no `public-nightly/`. That is harmless, since only the
  nightly build reads it.
- Any other accent use inside `.brand-mark` or `.intro-mark` would also turn violet on Nightly.
  Today the thread and bead are the only ones.

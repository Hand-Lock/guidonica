# 0107. Nightly Icon & Accent: A Night-Blue Tile and a Violet UI

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

Nightly gets its own icon family with the same hand, and violet replaces Olo as its UI accent.

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

### 4. Nightly accent

`nightlyHtml()` turns `<html lang="en">` into `<html lang="en" data-channel="nightly">`. The
language pages derive from the built shell, and `localePage()` now matches `<html lang="en"`
without the closing bracket, so they keep the attribute.

Every teal in the UI chrome is a token in the two theme blocks of `style.css`. Right after them,
two blocks override the whole accent family:

- `[data-channel='nightly']` (specificity 0,1,0, later than both theme blocks) holds the light
  values.
- `[data-channel='nightly'][data-theme='dark']` (0,2,0) holds the dark ones. It restates every
  token the light block sets, or the light value would beat the dark theme block.

| token | light | dark |
|---|---|---|
| `--accent` | `#5b4bd0` | `#a99cff` |
| `--accent-strong` | `#4535b0` | `#c7bfff` |
| `--accent-tint` | `rgba(110, 90, 240, 0.13)` | `rgba(169, 156, 255, 0.12)` |
| `--focus-ring` | 3px `rgba(100, 80, 230, 0.45)` | 3px `rgba(169, 156, 255, 0.45)` |
| `--gel-bg` | `#7566dd` → `#5b4bd0` → `#4a3bb8` | `#cfc7ff` → `#ac9fff` → `#8f80f5` |
| `--gel-hover` | `#8174e2` → `#6455d6` → `#5243c0` | `#ddd7ff` → `#bdb2ff` → `#a092fa` |
| `--gel-border` | `#3a2c96` | `rgba(169, 156, 255, 0.7)` |
| `--gel-ink` | white (theme value) | `#150f3d` |
| `--gel-ink-shadow`, `--gel-glow` | indigo shadow, violet glow | theme shadow, violet glow |
| `--bead`, `--bead-border`, `--bead-shadow` | radial `#fff` / `#b9adff` / `#6a5ad6` / `#4535b0` | radial `#fff` / `#c2b8ff` / `#8a7af0` / `#3f2fa0` |
| `--led-on`, `--led-on-glow` | radial `#fff` / `#b9adff` / `#7a6ae0` / `#4a3bb8`, `#a99cff` glow | radial `#fff` / `#b9adff` / `#8a7af0` / `#352a92`, `#a99cff` glow |
| `--led-on-halo` | `0 0 6px #a99cff` | `0 0 6px #a99cff` |

Gradient and glow stops keep the positions of the teal originals, so only the hue changes.
`--led-on-halo` is new: the small LEDs of checked chips, intro cards and language chips glowed in a
literal `var(--color-olo)`, which is now the token's release value.

WCAG contrast: light `--accent` 6.3:1 on white and 5.4:1 on the page background,
`--accent-strong` 8.8:1, white gel ink 6.3:1 on the gel's middle stop. Dark `--accent` 7.6:1 and
`--accent-strong` 10.5:1 on `#0f172a`, the deep gel ink 7.8:1 on the middle stop and 5.6:1 on the
bottom one. The release's light teal accent is 4.8:1 on white, so violet is never weaker.

The header and onboarding hands stroke their thread and bead in `var(--accent)`, and custom
properties inherit into the `<use>` shadow tree, so they turn violet with the rest; the earlier
`--nightly` token and its `.brand-mark` rule are gone. There is no JS and no layout or paint cost.

Out of scope, on purpose:

- The canvas. Staff solfège and the intro level previews draw with `CANVAS_PALETTE`'s teal. The
  engine has no channel knowledge (ADR 0104), and the score should look the same on both channels.
- Amber (Playing gel), danger red, the playhead and the orange and red accent LEDs: they carry
  meaning, not brand.

## Verification

- `pnpm icons -- --raster` leaves every file in `public/` byte-identical and adds `public-nightly/`.
  The 32, 180, 192 and 512 px renders were checked by eye, with the safe circle drawn over the
  maskable icon.
- `GUIDONICA_CHANNEL=nightly pnpm build`: `dist/` icons equal `public-nightly/`, the manifest names
  "Guidonica Nightly", and `dist/index.html` and `dist/it/index.html` carry `data-channel`. In a
  release build the icons equal `public/` and there is no `data-channel`.
- Screenshots of `pnpm build:site` in light and dark, inspector open and playing: the release is
  all teal; under `/nightly/` the header thread, tabs, checked chips, Settings button, focus ring,
  Start gel, tempo bead, zoom label and lit beat LEDs are violet, while the amber Pause gel, the
  playhead, the count-in LED and the staff are unchanged.
- `tests/brandMark.test.ts` checks that `public-nightly/favicon.svg` matches the generator, that
  every nightly file has a release namesake, and that every manifest icon exists in
  `public-nightly/` as a PNG of its declared size. It also checks that both nightly blocks in
  `style.css` set every accent token above, that the dark block restates every light override,
  and that neither contains Olo. `tests/serviceWorker.test.ts` and
  `tests/localePages.test.ts` check `data-channel`.

## Consequences

- A tab, a home-screen icon and the open app each tell Nightly from the release at a glance.
- `public-nightly/` is generated, like `public/`'s icons; never hand-edit it. A change to the hand
  regenerates both sets with one `pnpm icons -- --raster`.
- A release tag built before this ADR has no `public-nightly/`. That is harmless, since only the
  nightly build reads it.
- A new accent token in the theme blocks needs a nightly value in both override blocks, or
  Nightly shows teal there. Add it to the test's token list too. A teal literal outside the theme
  blocks would escape the override, so accent colours stay tokens.

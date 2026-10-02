# 0048. Brand Mark Rollout: Web App Manifest & README Logo

- **Status**: Accepted (extends [0046](0046-guidonian-hand-brand-mark.md) and [0047](0047-guidonian-hand-v2.md))
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

- The v2 Guidonian Hand (ADR 0047) shipped as the favicon, the iOS touch icon and the header glyph.
- **Android / Chrome install**: with no web app manifest, "Install app" / "Add to Home screen" falls back to a scaled favicon. iOS was already covered by `apple-touch-icon.png`.
- **README**: the repository page showed no logo.
- Every asset must keep coming from the one generator (`scripts/build-icons.mjs`), byte-stable and drift-tested.

## Decision & Implementation

### 1. Generator

- `buildTileSvg()` gains an optional `margin`: the space between the hand's bounding box and the tile edge on the 64-unit grid. It defaults to the previous values (5.5 full, 4 small), so existing outputs are unchanged byte for byte.
- `npm run icons` now also writes `docs/brand/guidonica-mark.svg` = `buildTileSvg({ detail: 'full', bleed: false, size: 256 })`: the full-detail gel tile with the white rim and rounded corners.
- `npm run icons -- --raster` now also writes:

| File | Source | Purpose |
|------|--------|---------|
| `public/icon-192.png` | full tile, rim, no bleed; `roundCorners()` at rx = 14/64 · size | manifest `any` |
| `public/icon-512.png` | same | manifest `any` (splash screen, install dialog) |
| `public/icon-maskable-512.png` | full tile, full bleed, `margin = MASKABLE_MARGIN` (12) | manifest `maskable` |

### 2. Maskable safe zone

- Android launchers crop a maskable icon to their own shape (circle, squircle, teardrop…). Only the central circle of radius **0.4 · size** is guaranteed visible: 25.6 units on the 64 grid, 204.8 px at 512.
- At the default margin 5.5 the hand reaches the tile edge and would be cropped.
- A bounding-box estimate is too pessimistic: the 40-unit box at margin 12 has corners at 28.3 units, outside the circle, but the hand does not fill its corners. A bound from Bézier control points was also too loose (32.9 units).
- **Measured instead**: the tile was rasterized at 512 px with the gel replaced by a key colour and the sheen removed, and the farthest non-background pixel from the centre was found:

| margin | any ink (px) | solid ink (px) | safe radius (px) |
|--------|--------------|----------------|------------------|
| 10 | 199.8 | 193.6 | 204.8 |
| 11 | 190.8 | 185.1 | 204.8 |
| **12** | **182.8** | **176.5** | 204.8 |
| 13 | 174.3 | 167.6 | 204.8 |

- **Chosen: 12**. That leaves ~22 px of clearance at 512 (the glow included), versus 5 px at margin 10, and still fills ~62 % of the tile width.
- Verified visually with the safe circle overlaid and with a circular crop.

### 3. Manifest (`public/manifest.webmanifest`)

- Static, hand-written JSON (it is not geometry), linked from `index.html` with `<link rel="manifest" href="manifest.webmanifest" />`.
- `start_url: "."` and `scope: "."` are relative to the manifest URL. They resolve to the site root on `guidonica.it` and to `/guidonica/` on the `hand-lock.github.io` mirror, consistent with Vite's default `base: './'` and the relative icon links (ADR 0046); `public/` files are copied verbatim, so the manifest's relative paths never depend on `base`.
- `display: "standalone"`; `background_color` and `theme_color` are `#e9eef3`, the light `theme-color` meta. The manifest cannot follow `prefers-color-scheme`; the `theme-color` metas still do once the page loads.
- No service worker: the manifest is for install and icons only. Offline caching is a separate decision.

### 4. README logo

- `README.md` opens with a centred `<img src="docs/brand/guidonica-mark.svg" width="128" height="128">` above the `# Guidonica` heading, so the heading anchors and the table of contents are unchanged.
- The rimmed, rounded tile (not the full-bleed one) is used: it reads as an app icon on both GitHub light (`#ffffff`) and dark (`#0d1117`) backgrounds. GitHub renders SVG gradients, clip paths and masks inside `<img>`; the SVG has no scripts or external references.
- Size: 11.7 kB (2.9 kB gzipped).

## Consequences

- **Pros**:
  - Android and desktop Chrome install with a proper icon, launcher-shaped by the OS.
  - The repository page carries the mark; it can never drift from the app's icon.
- **Cons**:
  - Three more PNGs in `public/` (34 + 97 + 91 kB). They are fetched only by the install flow, never by a normal page load.
  - The safe-zone check is a measurement, not a test: the PNG content is not decoded in tests. If the hand's extent changes, re-run the check (ADR 0047, "Editing the mark").
- **Tests** (`tests/brandMark.test.ts`):
  - drift guard for `docs/brand/guidonica-mark.svg`;
  - `index.html` links the manifest relatively;
  - the manifest parses, has relative `start_url` and `scope`, and every icon exists as a PNG whose IHDR size matches its `sizes`; one icon is `maskable`.
- **Follow-up (not done)**: an Open Graph / Twitter social card (1200 × 630). It needs its own layout and typography, so it is out of scope here.

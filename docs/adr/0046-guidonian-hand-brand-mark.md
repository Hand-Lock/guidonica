# 0046. Guidonian Hand Brand Mark, Favicon & App Icon

- **Status**: Superseded in part by [0047](0047-guidonian-hand-v2.md): geometry, spiral, detail levels and tile material. Orientation is also corrected: the thumb belongs on the **left**. The raster pipeline, drift guard and glyph contract still apply.
- **Date**: 2026-10-02
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

- The favicon was a generic quarter-note data URI, and the header brand was text only.
- Guidonica is named after the *Manus Guidonica*, so its identity should come from the hand itself: one mark used as header logo, favicon and app icon.
- Safari and iOS ignore SVG favicons and SVG touch icons, so raster fallbacks are needed.
- The manifesto (§1) asks for "sensory richness through mathematical frugality": no sprite textures, no image-gen bitmaps, no new dependencies.

## Decision & Implementation

### 1. Deterministic geometry: `scripts/build-icons.mjs` (zero dependencies)
- The art is computed, not drawn, so it is reproducible, diffable and tuned by changing numbers.
- **Subject**: a **left hand, palm facing the viewer** (the historical convention: the left hand is the diagram, the right hand points). The little finger is on the left and the thumb on the right.
- **Silhouette** = union of primitives on a 64-unit grid. Same-fill overlapping shapes render as a union in SVG, so no boolean geometry library is needed.
  - **Palm**: one cubic path with a thenar bulge towards the thumb.
  - **Fingers**: capsules rooted on an arc across the palm top. Direction for fan angle θ is `(sin θ, −cos θ)`.

    | Finger | Root | Fan θ | Length (× middle = 27) |
    |--------|------|-------|------------------------|
    | little | (20.2, 34.4) | −18° | 0.74 |
    | ring | (26.8, 32.2) | −6° | 0.92 |
    | middle | (33.4, 31.6) | +5° | 1.00 |
    | index | (39.8, 32.6) | +16° | 0.93 |

    Width is 5.8. Each capsule's centre line starts `r` below the base crease (overlapping the palm) and ends `r` short of the tip.
  - **Thumb**: a 2-segment capsule, base (39.8, 50) → joint (47.2, 43) → tip (50.8, 35), widths 10.4 / 8.6.
  - **Capsule path**: with unit normal `n̂` of `b − a`: `M a+rn̂ L b+rn̂ A r r 0 0 0 b−rn̂ L a−rn̂ A r r 0 0 0 a+rn̂ Z`.
- **Fit**: the bounding box of all primitives is scaled uniformly and centred into `[m, 64 − m]` (m = 2 glyph, 5 favicon, 9 touch icon).
- **Byte stability**: every coordinate is rounded to 2 decimals.

### 2. The gamut spiral: "every path through the hand must be walked"
- Positions along each finger, as fractions of root → tip: base 0.04, middle joint 0.42, upper joint 0.70, tip 0.90.
- One continuous line walks the 19 on-hand positions in historical order, a clockwise spiral that winds inward. Sources differ on the inner four; this order is adopted:

  | Step | Notes | Position |
  |------|-------|----------|
  | 1 | Γ, A, B | thumb tip, thumb joint, thumb base |
  | 2 | C, D, E, F | bases of index, middle, ring, little |
  | 3 | G, a, b | little finger: middle joint, upper joint, tip |
  | 4 | c, d, e | tips of ring, middle, index |
  | 5 | f, g | index: upper joint, middle joint |
  | 6 | aa, bb, cc, dd | middle mid, ring mid, ring upper, middle upper |

- The curve is a uniform Catmull-Rom spline through the points, emitted as cubic Béziers: for segment `Pᵢ → Pᵢ₊₁`, `c₁ = Pᵢ + (Pᵢ₊₁ − Pᵢ₋₁)/6`, `c₂ = Pᵢ₊₁ − (Pᵢ₊₂ − Pᵢ)/6`, with the endpoints duplicated.
- Γ starts with a bead; in full detail the line ends with a bead at dd.
- `tests/brandMark.test.ts` locks the 19-step order.

### 3. Two detail levels
| Level | Used for | Content |
|-------|----------|---------|
| **Full** | `apple-touch-icon.png` (180 px) | Silhouette, phalanx joint creases, all 19 stations, Γ and dd beads |
| **Small** | `favicon.svg`, `favicon.ico`, header glyph | Silhouette and a thicker spiral through 11 stations (Γ B C F G b c d e g aa) that hugs the outline; no creases |

The small spiral skips the inner loop because at 16–32 px it would close up into a blot. Keeping all four tips makes the line follow the fingertips instead of cutting across the fingers.

### 4. Materials (manifesto §3)
- **App icon / favicon = Gel tile**:
  - Light-mode hero gel body `#17a387 → #00826a → #006e58`, gloss cap on the top half, 1px top specular.
  - Pearl hand (`#fff → #e6fff8`, lit top-left), with a contact shadow made from the same silhouette offset by (0.6, 1.2) at 38% `#003d31` (no filters).
  - Spiral `#006652`; the Γ bead is pure Olo `#00ffcc` with a radial glow and a `#006652` rim. White on deep gel follows the ink-on-gel rule.
  - The favicon is a rounded tile (rx 14). The touch icon is full-bleed because iOS applies its own mask.
- **Header mark = flat glyph** (`<symbol id="g-hand">` in the sprite), not gel: the Play hero stays the only tier-1 element.
  - The hand is filled `currentColor` (the text colour).
  - The spiral and Γ bead are painted with `style="fill:var(--accent);stroke:var(--accent)"`. Custom properties inherit into the `<use>` shadow tree, so the line is Olo Viridian in light mode and pure Olo in dark mode.
  - **Knockout halo**: accent on ink alone is too weak (≈ 3.7:1 for `#008269` on `#0f172a`). A `<mask id="g-hand-cut">` cuts a gap 1.1 units wider than the line on each side out of the hand, so the line reads as separate from the silhouette in both themes.
  - `.brand-mark` is 26px (22px at ≤ 600px), `aria-hidden`, with no filter, hover or animation.

### 5. Raster fallbacks (`node scripts/build-icons.mjs --raster`, dev-only)
- **Rasterizer**: Firefox headless (`--screenshot --window-size=N,N` with a throwaway profile). It is not a project dependency.
- **Transparent corners**: screenshots have an opaque page background. `roundCorners()` decodes the 8-bit RGBA PNG with `node:zlib` (all 5 scanline filters), multiplies alpha by the rounded-rect coverage (4 × 4 supersampling, rx 7 px at 32 px) and re-encodes it.
- **ICO**: `pngToIco()` writes a 6-byte header and one 16-byte directory entry followed by the PNG bytes (PNG-in-ICO, valid since Vista). No ImageMagick.
- **Links** (`index.html`): `favicon.ico` (sizes 32x32), `favicon.svg` (type `image/svg+xml`) and `apple-touch-icon.png`. All are relative, which matches Vite `base: './'`; `public/` is copied verbatim into `dist/`.

### 6. Drift guard
- `npm run icons` rewrites `public/favicon.svg` and the `#g-hand` symbol inside `index.html` in place.
- `tests/brandMark.test.ts` fails if either differs from the generator. It also checks the brand markup, the icon links, the ICO header and the 180 × 180 PNG.

## Consequences
- **Pros**: one source of truth for the brand mark; no binary art or tooling in dependencies; theme-aware header glyph with zero JS; ~3.6 kB SVG favicon.
- **Cons**: the PNG/ICO rasters need Firefox installed to regenerate, and they must be regenerated by hand (`--raster`) after geometry changes. The SVG outputs are checked by tests; the rasters are not compared pixel-for-pixel.
- **Maintenance**: never hand-edit `public/favicon.*`, `public/apple-touch-icon.png` or the `#g-hand` symbol. Change the numbers in `scripts/build-icons.mjs` and run `npm run icons -- --raster`.

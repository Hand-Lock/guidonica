# 0047. Guidonian Hand v2: Anatomical Proportions, Volume Shading & 3D Thread

- **Status**: Accepted (supersedes in part [0046](0046-guidonian-hand-brand-mark.md): geometry, spiral, detail levels, tile material, orientation)
- **Date**: 2026-10-02
- **Author**: Claude & lauseta

## Context & Problem Statement

- The v1 mark (ADR 0046) used capsule fingers on an arc, a flat silhouette and a 2D spiral. It read as a mitten.
- An AI-generated reference (dev-only, not committed) looked much better:
  - long tapered fingers;
  - a palm taller than the middle finger;
  - a wrist stub;
  - a low, wide-swung thumb;
  - grey volume shading, knuckle creases and palm lines;
  - a thread that wraps *around* the digits;
  - a gel tile with a diagonal sheen and a white rim.
- The reference is non-deterministic and a bitmap. Auto-tracing it would need a new tool (none is installed: no potrace, vtracer or ImageMagick), would produce an unparametric blob and would copy its AI artifacts.
- **Decision**: measure the reference's landmarks and re-express them as numbers in the existing zero-dependency, byte-stable generator.
- **Orientation fix**: ADR 0046 drew the thumb on the right. The Guidonian Hand is the student's **own left hand, palm facing them**, so the thumb sits on the **left**. v2 corrects this.

## Decision & Implementation

All of this lives in `scripts/build-icons.mjs`. The exports keep the same names; `handGeometry()` and `buildGlyphSymbol()` now take no arguments, and `buildTileSvg` gains `bleed`.

### 1. Authoring frame & the mirror

- **Units**: geometry is authored in *reference-tile units*. The reference tile spans px 280..1320 × 290..1330 of the 1600 px PNG, so 1 unit = 16.25 px.
- **Measurement**: landmarks were measured with a scratchpad PNG decoder by thresholding hand pixels and taking per-row and per-column extents. This gave:
  - each finger's root, tip, base width and tip width;
  - the palm outline (hypothenar edge, wrist stub, thenar edge);
  - the thumb axis.
- **Frame**: in this frame the thumb is on the right, as in the reference.
- **Mirror**: `fitter()` fits the bounding box (palm path numbers plus digit tips and tip sides) into `[m, 64 − m]` and mirrors it:
  `matrix(−k 0 0 k ox oy)`, with `ox = 32 + cx·k` and `oy = 32 − cy·k`.
  - The output shows the thumb on the left.
  - Lighting stays top-left (manifesto §3), so offsets authored in the raw frame are flipped in x:
    - the contact shadow is translated by `(−0.6/k, 1.2/k)`;
    - the tube highlight is translated by `(+0.16·w, −0.2·w)`;
    - digit gradients run white→grey from the `−n̂` edge to the `+n̂` edge;
    - the palm radial gradient is centred right of the palm centre in the raw frame.
- **Margins**: full 5.5, small 4, header glyph 1.5.

### 2. Tapered digits

- **Parameters**: each digit is `{ root, tip, wb, wt, sink }`.
  - The axis is `d̂ = unit(tip − root)` and the normal is `n̂ = (d̂y, −d̂x)`.
  - `len = |tip − root|` and `at(t) = root + d̂·t·len`. The path starts at `at(−sink/len)`, so the base sinks under the palm.
- **Half-width**: `half(t)` falls linearly from `wb/2` at `t = 0` to `wt/2` at the tip-circle centre `tc = 1 − rt/len`, where `rt = wt/2`.
- **Path**:
  1. base-left;
  2. a `Q` whose control point sits at the mean half-width plus `0.07·wb` (a slight convex belly);
  3. tip-left;
  4. a semicircle `A rt rt 0 0 1`;
  5. tip-right;
  6. a mirrored `Q` back to base-right.
- **Finger stations** (`t` along root → tip): base 0.06, mid 0.40, upper 0.675, tip 0.86. **Thumb stations**: base 0.20, joint 0.53, tip 0.86.
- **Palm**: one path from the little finger's base edge, along the measured hypothenar, wrist stub (flat cut) and thenar curve, into the thumb root. It crosses the thumb base, rises to the index root, then crosses the finger roots with `Q` valleys whose control point is the midpoint pushed 1 unit down.
- **Union outline** (full detail only): every primitive is stroked in `#a9bcc0` first, then every fill is drawn on top, so only the outer edge of the union survives. No boolean geometry library is needed.

### 3. Volume (full detail, ≥ 48 px)

- **Digits**: one `userSpaceOnUse` linear gradient per digit across its axis at `t = 0.5`: `#fff → #f4f7f8 → #d3dde0`.
- **Palm**: a radial gradient `#fff → #f3f6f7 → #dce4e6 → #c3cfd2`, highlight towards the upper lit side.
- **Lines**: palm lines (heart, head, life and 2 wrist creases) and knuckle creases (2 arcs per joint, bowed towards the tip) are **tapered crescents**: two cubics whose control points are pushed `±w` along the chord normal. They are filled `#9fb0b4`, with no stroke caps to blob up.
- **Contact shadow**: kept from v1 (offset silhouette, `#003d31` at 35 %).

### 4. The 3D thread

- **Points**: the thread is a list of `(x, y, z)` points. `z > 0` is in front of the palm and `z < 0` is behind the hand.
  - `front(g, t)` is a point on the axis with positive z.
  - `rim(g, t, s)` is a point just beyond edge `s` at `z = 0`.
- **Helix**: `coil(g, t0, t1, turns, φ₀ = π/2)` emits `⌈6·turns⌉` steps (6 per turn). For `s = i/steps`:
  ```
  φ = φ₀ + 2π·turns·s
  t = t0 + (t1 − t0)·s
  R = half(t) + GAP        (GAP = 0.6)
  p = at(t) + n̂·R·cos φ
  z = R·sin φ
  ```
  Its projection is the natural wrap ellipse.
- **Curve**: a uniform Catmull-Rom spline through the points, converted to cubic Béziers in 3D (same formula as ADR 0046, with endpoints duplicated). Consecutive duplicate points are dropped.
- **Splitting at z = 0**: each Bézier's z-component is sampled 32 times. Every sign change is refined by 40 bisection steps, and the curve is cut there with de Casteljau. Pieces are grouped into **runs** of constant sign. Each run carries `front` and `len` (the sum of its chord lengths), and is emitted as 2-decimal path data.
- **Paint order** (full tile):
  1. contact shadow;
  2. **back runs**: `#0b8a72` at 0.72·w, butt caps, painted *under* the hand so they only show where they peek past the silhouette;
  3. union outline strokes;
  4. digit fills;
  5. palm fill;
  6. palm and knuckle lines;
  7. **front tube**: rim `#008a70` at `w + 0.7/k`, core `#2ef0c8` at `w`, and a 35 % white highlight at `0.32·w`;
  8. Γ glow;
  9. Γ bead.

### 5. The route: A (the AI route), passing Γ, A, B

- **Path**: the Γ bead at the thumb tip, then 2¼ coils down the thumb, then a dive behind the thenar. It comes out at the index base, makes an S-curve across the palm and a loop around the wrist, travels behind the hand to the index, wraps the index middle phalanx, then crosses the finger roots and wraps around the little-finger side.
- **Stations**: with `φ₀ = π/2`, the thumb coil is exactly at the front at steps 0, 6 and 12. Those steps are the thumb tip, joint and base, i.e. **Γ, A, B**: the first three gamut steps, in order. `thread.stations = ['Γ','A','B']`.
- **Gamut table**: `handGeometry().gamut` still lists all 19 stations in historical order (ADR 0046 table) with their palm-side points, for future use and tests.
- **Alternatives built and rejected** on a side-by-side sheet (180 / 32 / 16 px, glyph light/dark, overlay on the reference):
  - **B, the strict 19-station gamut as a 3D wrap**: it needed ~12 crossings and coils on every finger. At 180 px it read as a tangle; at 16–32 px it was noise.
  - **C, a hybrid hitting 7 of 19 stations (Γ A B C e f g)**: it was more faithful on paper, but stations are unmarked, so the order is invisible at icon sizes. Small sizes were nearly identical to A, and the full tile looked slightly worse.
  - A already passes Γ, A, B, the part of the gamut a viewer can actually read (the thumb coil from the Γ bead). Historical fidelity is kept in the data (`gamut`) rather than drawn as an illegible path.

### 6. Detail levels

| Level | Used by | Contents |
|-------|---------|----------|
| **Full** | `apple-touch-icon.png` (180 px) | Union outline, digit and palm gradients, palm lines, knuckle creases, back runs, tube with highlight, Γ glow and bead |
| **Small** | `favicon.svg`, `favicon.ico`, header glyph | Pearl silhouette, front runs only, thickened (`2.7/k`, glyph `2.4/k`), Γ bead |

- **Run filter**: at the small level, front runs shorter than `SMALL_RUN = 7` units are dropped, which removes the coil stubs (they blur into dots below 48 px). Back runs are never drawn at the small level.
- **Header glyph contract**: unchanged from 0046. The hand is `currentColor`; the thread is `style="fill:var(--accent);stroke:var(--accent)"`; a mask (`#g-hand-cut`) knocks a halo out of the hand under the thread and the bead.

### 7. Tile

- **Body**: a deeper gel, `#1d9c82 → #0a6f5b → #065646`.
- **Sheen**: a **diagonal sheen** replaces the half-height gloss cap.
  - Shape: `M 0 0 L 64 0 L 64 11.5 Q 30 19 0 36.5 Z`, clipped to the tile.
  - Fill: a `userSpaceOnUse` gradient from (21, −4) to (31, 22), white at 0.42 → 0.13 → 0.03, so its curved lower edge fades instead of cutting.
- **Rim**: a thin white rim inset 1.4 (stroke 0.8 full, 1.1 small, 85 % opacity).
- **Touch icon**: `bleed` (the default for full) gives a square full-bleed tile with no rim, because iOS applies its own mask.
- This is a **brand-tile exception** to the manifesto's top-half gloss-cap rule (§5A).

## Consequences

- **Pros**:
  - The mark now reads as a hand at every size, with the correct student's-left-palm orientation.
  - The 3D wrap gives the "thread around the hand" look of the reference while staying deterministic, theme-aware and dependency-free.
  - Sizes: favicon SVG 4.8 kB, ICO 2.7 kB, touch PNG 26 kB, header symbol 2.9 kB (all inline sprite text compresses well).
- **Cons**:
  - The drawn thread follows the gamut only for Γ, A, B. The full 19-step order exists in data and tests, not in the picture.
  - The full-detail tile has more paths than v1.
  - Rasters still need Firefox to regenerate.
- **Tests** (`tests/brandMark.test.ts`):
  - the SVG drift guards;
  - the 19-name gamut order;
  - the claimed stations are hit in order on their palm-side points (within 0.01);
  - at least one front run and one back run exist.
- **Maintenance**: as in 0046, never hand-edit the outputs. Change the numbers and run `npm run icons -- --raster`. A second `npm run icons` must produce no diff.

## Editing the mark

Everything is in `scripts/build-icons.mjs`. Never hand-edit an output (`public/favicon.*`, `public/apple-touch-icon.png`, `public/icon-*.png`, `docs/brand/guidonica-mark.svg`, the `#g-hand` symbol in `index.html`).

| To change… | Edit |
|------------|------|
| Finger length, width, spread | `FINGERS`: `root`, `tip`, `wb` / `wt` (base / tip width), `sink` (run-on under the palm) |
| Thumb | `THUMB` (same fields) |
| Gamut station and joint positions along a digit | `T` (fingers) and `TT` (thumb), fractions of root → tip |
| Palm, wrist and thenar outline | `PALM_OUTLINE` (the path joining the finger roots to the thumb root) |
| Thread route and depth | `threadPoints()`: 3D points `[x, y, z]`; `z > 0` passes in front of the hand, `z < 0` behind; `coil()` / `front()` / `rim()` place points relative to a digit |
| Palm lines (full detail) | `PALM_LINES`: cubic `[p0, c1, c2, p3, width]` per crease |
| Tile colours, sheen, rim, thread tube | the `defs` and the returned markup in `buildTileSvg()` |
| Small-level thread pruning | `SMALL_RUN` |
| Size inside the tile | the `margin` defaults in `buildTileSvg()`, `MASKABLE_MARGIN` (ADR 0048), the glyph's `1.5` in `buildGlyphSymbol()` |

- **Frame**: coordinates are in the *authoring* frame, thumb on the **right** (as in the reference drawing). `fitter()` mirrors x, so the icon shows the thumb on the left. To move something left in the icon, *increase* its authoring x; y is not flipped.
- **Route changes**: if the thread no longer crosses the front at the stations it claims, update `THREAD_STATIONS` and the station test in `tests/brandMark.test.ts` to match.
- **Then**:
  1. `npm run icons -- --raster` (needs Firefox) to regenerate all outputs.
  2. `npm run icons` again: `git status` must show no further change (byte-stable).
  3. `npm test`. The drift tests fail if any SVG output is stale.
  4. If the hand's extent changed, re-check the maskable icon against the safe circle (ADR 0048).

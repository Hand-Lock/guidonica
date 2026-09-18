# 34. Matched Segmented-Square Fullscreen Icons & Inverted Exit Geometry

Date: 2026-09-18

## Status
Accepted

## Context
Guidonica's utility bar provides a dedicated full-screen button (`#btn-fullscreen-toggle`) that interfaces with the W3C Fullscreen API. Previously, the button displayed Unicode text glyphs to represent state:
- Enter Fullscreen: `⛶` (U+26EF SQUARE FOUR CORNERS), depicting a square with segmented sides.
- Exit Fullscreen: `🗗` (U+1F5D7 OVERLAP), depicting two overlapping window rectangles reminiscent of desktop OS window restore buttons.

This initial implementation had several pedagogical and aesthetic shortcomings:
1. **Asymmetric Iconography**: `🗗` broke visual continuity with the segmented square. While `⛶` intuitively communicates screen expansion, `🗗` signifies multi-window tiling rather than contracting/exiting full screen.
2. **Absence of Inverted Unicode Glyph**: Unicode defines no inverted/inward-pointing counterpart to `⛶` (i.e. four inward corner brackets `┘ └` / `┐ ┌`).
3. **Cross-Platform Glyph Inconsistency**: System font fallbacks (Apple Symbols, Segoe UI, STIX Two Math, or Noto) render `⛶` with varying stroke weights, corner radii, and vertical baseline offsets, potentially rendering as missing-glyph tofu (□) on minimal Linux distributions.

The classic symbol for exiting full screen across modern media players, notation tools, and UI design systems is the exact reverse of the segmented square: the four corner segments flipped to point inward towards the center.

## Decisions

### 1. Zero-Dependency Matched Vector SVG Pair
Rather than relying on font glyphs or importing external icon libraries, Guidonica implements a custom, resolution-independent vector SVG pair directly in the semantic DOM and TypeScript layer:

- **Enter Fullscreen (`FULLSCREEN_ENTER_PATH`)**:
  Four outward-pointing corner brackets outlining the perimeter of a segmented square:
  ```
  ┌      ┐
  
  └      ┘
  ```
  Path definition (16×16 coordinate grid):
  `M2.5 5.5V2.5h3 M13.5 5.5V2.5h-3 M2.5 10.5v3h3 M13.5 10.5v3h-3`

- **Exit Fullscreen (`FULLSCREEN_EXIT_PATH`)**:
  The exact same segmented lines flipped inward towards the center:
  ```
    ┘  └  
  
    ┐  ┌  
  ```
  Path definition (16×16 coordinate grid):
  `M5.5 2.5v3h-3 M10.5 2.5v3h3 M5.5 13.5v-3h-3 M10.5 13.5v-3h3`

### 2. Precise Geometric & Styling Parameters
- **Stroke Weight**: 1.75px uniform stroke width (`stroke-width="1.75"`), matching the visual weight of the adjacent theme toggle (`#btn-theme-toggle`) and GitHub icon (`#btn-github-link`).
- **Cap Geometry**: Crisp square caps (`stroke-linecap="square"`), preserving the classic architectural line endings of the segmented square without rounded dilution.
- **Color Inheritance**: `stroke="currentColor"`, inheriting liquid glass button colors across both light mode and dark mode without separate color rules.
- **CSS Block Alignment**: `.fullscreen-icon { display: block; }` ensures perfect mathematical centering within `.btn-icon-only` (33×33px) with zero font baseline shift or layout jitter.

### 3. Reactive State Synchronization
The `syncFullscreenGlyph()` method updates the SVG path and accessibility attributes upon `fullscreenchange` and `webkitfullscreenchange` events:
- When entering full screen: path `d` updates to `FULLSCREEN_EXIT_PATH`, `aria-label` and `title` update to `"Exit full screen"`.
- When exiting full screen: path `d` updates to `FULLSCREEN_ENTER_PATH`, `aria-label` and `title` update to `"Toggle full screen"`.

## Consequences

### Positive
- **Symmetric, Classic Aesthetics**: The exit fullscreen icon is the exact geometric inverse of the enter fullscreen icon, providing intuitive visual feedback.
- **Zero-Shift Transitions**: Switching between windowed and fullscreen modes causes zero sub-pixel movement or button resizing.
- **Cross-Platform Uniformity**: Guaranteed pixel-perfect rendering across macOS, Windows, Linux, iOS, and Android without reliance on system font fallbacks.
- **Suckless Engineering**: Pure inline SVG requiring 0 kB additional dependencies and zero external asset requests.

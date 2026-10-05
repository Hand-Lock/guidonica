# 0073. Dumbbell Icon for the Header Level Button

- **Status**: Accepted (amends [0053](0053-header-level-button.md) §2)
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

ADR 0053 gave `#btn-level-toggle` five rising bars. In a top-right toolbar, next to Fullscreen and Theme, that shape reads as phone signal or connection strength, and users reported that they couldn't find the difficulty control. Below 1280px the button shows only its icon, so the shape alone has to say "difficulty".

The replacement must keep ADR 0053's live state: each level shows a different icon, and Custom (no matching preset) stays neutral.

## Decision & Implementation

### 1. Geometry (`index.html`)

The icon is a dumbbell whose plates get heavier with the level. Fitness apps already use dumbbells for intensity, and the shape can't be mistaken for a status indicator.

The SVG stays inline (CSS has to reach the plates, which a `<use>` shadow tree hides) and follows the UI icon grammar: 16-unit grid, stroke 1.75, round caps and joins, `currentColor`.

| Part | Geometry | Scales |
|---|---|---|
| Sleeve + handle | `M.75 8h14.5`, stroked | no |
| Collars (outer) | `x = 1.5 / 13`, 1.5 × 4, `y = 6`, `rx = .6`, filled `currentColor` | no |
| Plates `.lv-plate` | `x = 3.5 / 9.5`, 3 × 12, `y = 2`, `rx = 1`, filled | yes |

The plan began with one plate per side (x = 3/10, bar 1.5–14.5). Rendered at 16px it read as an "H" or "#" at the heavier levels. The fixed outer collar gives the stepped silhouette of a real dumbbell, so it was added. The collar is 4 units tall, below the lightest plate (6), so Beginner still shows a plate heavier than the collar.

### 2. Weights (`src/style.css`)

The plates are full height in the markup. CSS shrinks them with `transform: scaleY(var(--lv-weight))` and `transform-box: fill-box; transform-origin: center`, so they stay centred on the bar.

| `data-level` | Level | `--lv-weight` | Plate height (units) |
|---|---|---|---|
| 1 | Beginner | .5 | 6 |
| 2 | Elementary | .625 | 7.5 |
| 3 | Intermediate | .75 | 9 |
| 4 | Advanced | .875 | 10.5 |
| 5 | Virtuoso | 1 | 12 |
| 0 | Custom | .75 (base rule) | 9 |

The steps are even, 1.5 units each (1.5px at 16px). Every level stayed distinct in renders at 390px and 1440px, at DPR 3.

### 3. Colour

- Levels 1–5: `.btn-level-toggle:not([data-level='0']) .lv-plate { fill: var(--accent) }`, like the lit bars before. The bar and collars stay `currentColor`.
- Custom (0): the plates stay `currentColor` at full opacity. Neutral means "no preset matches", and a dimmed icon would look disabled.
- `transition: transform var(--fast) ease, fill var(--fast) ease`. The global reduced-motion rule makes both instant.

### 4. Unchanged

`syncLevelButton()` still sets only `data-level`, the label and `aria-label`. The button's attributes, label width (`min-width: 73px`) and ADR 0053's breakpoints are untouched. The utility group measures the same as before: 162px at 390px and 364px at 1440px.

### 5. Rejected candidates

| Candidate | Why not |
|---|---|
| Mountain | Looks like the generic image icon |
| Stars | Read as a rating |
| Chili | Reads as food |
| Ski-run shapes | Only 3–4 grades, and they vary by country |
| Gauge | Reads as tempo in a metronome app |
| Graduation cap | Static: it can't show the level |

## Consequences

- The header control now reads as difficulty, even when it shows only the icon. Its plate size still shows the current level at a glance.
- The `.lv-bar` / `nth-child` rules are gone. Only the two `.lv-plate` rects scale, and the collars and bar must stay outside that class.
- No new strings, so no i18n changes.
- Tests: `tests/levelButton.test.ts` checks for two `.lv-plate` elements and no `.lv-bar`.

# 0054. Responsive Header Fit Audit

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & lauseta
- **Amends**: [0045](0045-aero-guidonica-2-material-hierarchy-and-responsive-redesign.md), [0053](0053-header-level-button.md)

## Context & Problem Statement

Before finalizing the app, the layout was measured in headless Chromium:

- widths from 280 to 1920px;
- mouse and touch (`--hit` is 36px with a mouse, 44px with touch);
- 4/4 and 6/8 (6/8 shows six beat dots, so the cluster is 144px wide instead of 102px);
- idle, drawer open, tuplets popover open, intro dialog and About dialog;
- landscape phones and short laptop screens.

The breakpoints of ADR 0045 assumed one pointer type and one meter. The audit found seven problems:

| # | Where | Problem (measured) |
|---|---|---|
| 1 | 961–1135px | The one-row header needs 1037–1103px of content (more with touch or 6/8) but has only 929px at 961px. Settings runs up to 148px off the right edge. This predates ADR 0053. |
| 2 | ≤600px, touch | The fixed `≤380px` badge rule ignores 44px touch targets. The SOLFÈGE badge collides with the utilities at 381–410px (by up to 28px). The wordmark is clipped at 320–340px (by up to 24px), and at 280px it collides even with a mouse (32px). |
| 3 | ≤600px, 6/8 | Start + Reset run into the beat dots: 4px at 320px touch, 36–44px at 280px. |
| 4 | 601–960px | In the grid `'brand . utils' / 'transport tempo beats'`, the utilities in row 1 set the width of the beats column in row 2. The tempo track shrinks to 102px (78px in 6/8) at 601px, and the slider is about 80px wide on a 667×375 landscape phone. |
| 5 | ≤960px sheet | `max-height: calc(100dvh - 110px / 170px)` assumes a fixed header height. On a 667×375 landscape phone the sheet ends at 402px, 27px past the viewport, so its last controls can't be reached. |
| 6 | >960px, short screens | The drawer opens by default in-flow. At 1024×600 it leaves the staff about 110px, less than the 220px it needs (`MEASURE_CANVAS_HEIGHT` × zoom), so the notes are hidden under the footer. |
| 7 | >960px, short screens | The tuplets popover runs 8px past the viewport at 1024×600, which clips its hint line. |

These passed the audit: the intro and About dialogs (they scroll internally), the phone sheet's content, the tuplets accordion and the footer. Nothing causes horizontal page scroll at any width.

## Decision & Implementation

### A. Compact desktop ribbon, 961–1140px (`src/style.css`; fixes 1)

A `@media (min-width: 961px) and (max-width: 1140px)` block sets `column-gap: 12px`, changes the tempo track to `minmax(160px, 380px)`, and collapses Reset and Settings to `var(--hit)` icon buttons (as in the ≤600 tier).

Worst case is touch + 6/8 at 961px. The 929px of content minus four 12px gaps leaves 881px. Brand 196 + transport 170 + beats 144 + utilities 200 = 710px, which leaves 171px for tempo, above the 160px minimum. With a mouse in 4/4, tempo gets 253px. From 1141px, the normal tier fits the worst case (1135px needed). From 1280px, the labelled Level button fits as well (1269px needed).

### B. Tablet utilities span the empty cell (≤960; fixes 4)

`grid-template-areas: 'brand utils utils' / 'transport tempo beats'`. The tempo track is `minmax(0, 1fr)`, so its minimum is fixed. The spanning utilities spread their width over tempo + beats, and the beats column is sized by the beat dots alone. At 601px tempo grows from 102 to 230px (from 78 to 188px in 6/8), and the utilities still fit their 346px span.

### C. Phone brand and transport collapse by measured room (≤600; fixes 2, 3)

Viewport breakpoints can't follow pointer type or meter, so both groups become size containers and collapse by the room their `minmax(0, 1fr)` column actually gets:

| Container | Query | Effect | Measured need |
|---|---|---|---|
| `.brand` (`brand`) | `max-width: 182px` | Badge hidden | mark + wordmark + badge = 183px |
| `.brand` (`brand`) | `max-width: 117px` | `h1` visually hidden (clip/1px), still read by assistive tech; only the hand shows | mark + wordmark = 118px |
| `.playback-controls` (`transport`) | `max-width: 147px` | Start drops its label, `min-width: var(--hit)`; keeps `flex: 1` and the play/pause icon | Start 96 + gap 8 + Reset 44 = 148px |

The fixed `@media (max-width: 380px)` badge rule is removed. Containment is declared only inside the ≤600 block. `inline-size` containment makes an element's width independent of its content, and on the desktop `auto` columns that would collapse them to zero.

### D. Sheet height from the header itself (≤960; fixes 5)

The sheet is absolutely positioned at `top: 100%` of `.control-panel`, which is `position: relative` at y = 0. A percentage `max-height` on an absolutely positioned box resolves against its containing block, which is the header. So `max-height: calc(100dvh - 100%)` (with a `100vh` fallback) is exactly "viewport minus header", however many rows the header wraps to. The ≤600 `170px` override is removed.

### E. Desktop drawer opens by default only when the staff fits (`src/main.ts`, `src/notation/types.ts`; fixes 6)

- `stageFitsStaff(stageHeight, zoom)` returns `stageHeight >= MEASURE_CANVAS_HEIGHT * zoom`. It sits next to the constant.
- `openDrawerByDefault(wide)` replaces the direct `setDrawerOpen(wide)` at init and on the `(min-width: 961px)` change. It opens the drawer when wide, reads `.canvas-wrapper.clientHeight` once and closes the drawer again if the staff no longer fits. Layout is read only at init and on breakpoint changes, never per frame. The user can still open the drawer by hand.
- Measured: 1024×600 starts closed (stage 490px when closed). 1024×768 (277px), 1280×720 (256px) and 1440×900 start open, as before.

### F. Desktop tuplets popover stays on screen (fixes 7)

`.tuplets-popover` gains `overflow-y: auto; overscroll-behavior: contain`. `openTupletsPopover()` checks the computed `position`. If it is `absolute` (desktop overlay), it sets `style.maxHeight = max(160, innerHeight − rect.top − 12)px`. Otherwise (the static ≤960 accordion inside the scrolling sheet), it clears the cap.

## Verification

- `tests/responsiveLayout.test.ts`: structural checks on `style.css` (sheet `100%` height with no fixed offsets, the container queries, the 961–1140 block, `'brand utils utils'`, no 380px rule) and `stageFitsStaff` at the exact `220 × zoom` boundary for zoom 0.5, 1 and 1.5.
- Headless audit, re-run after the change, reported zero problems:
  - 280–1920px, mouse and touch, 4/4 and 6/8: no element past the viewport, no brand or transport collisions, and the tempo track is at least 160px at every width above 600px;
  - the sheet bottom equals the viewport height at 320×568, 375×667, 667×375 and 844×390, and the last control is reachable;
  - the drawer default matches item E;
  - the popover bottom is at 590px of 600px at 1024×600.

## Consequences

- The header now adapts to pointer type and meter without new breakpoints, and the thresholds come from measured content widths. If brand, transport or button sizes change, re-measure the container thresholds (they are in comments in `style.css`).
- On the narrowest touch phones (≈ 320px), the header shows only the hand mark and an icon-only Start. That is the price of 44px targets. The page `<title>`, the intro dialog and the accessible `h1` still name the app.
- In the worst compact-ribbon case (touch + 6/8 at 961px), the slider inside the 171px tempo track is about 94px wide, because the BPM readout shares the track. It stays usable, and the readout accepts typed values.
- Short desktop screens start with Settings closed. The gear button opens them in-flow as before, and the staff then scrolls under the footer as it always did.

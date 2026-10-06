# 0053. Header Level Button with a Live Difficulty Meter

- **Status**: Accepted; amended by [0054](0054-responsive-header-fit-audit.md), [0073](0073-level-button-dumbbell-icon.md)
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0049](0049-level-presets-onboarding-intro.md)

## Context & Problem Statement

Before this change, level presets (ADR 0049) could be reopened only from Settings → Practice → "Level presets…" (`#btn-intro-open`). That entry sat two taps deep inside a dense sheet. A phone user who just wanted "easier" or "harder" had to find it there, or toggle chips one at a time. Difficulty is the setting people change most often, so it deserves a direct header button with the same weight as Settings and Fullscreen.

## Decision & Implementation

### 1. One entry point: `#btn-level-toggle` (`index.html`)

- The button sits in `.utility-actions` between Fullscreen and Settings. It uses the Settings acrylic tier-2 recipe: `btn btn-secondary btn-level-toggle`, `aria-haspopup="dialog"`, `aria-controls="modal-intro"`.
- The drawer's "Level" row (`#btn-intro-open`) is removed, so the header button is the only way to reopen the presets. The now-unused `.icon-hand` rule is removed with it.

### 2. Icon: an inline five-bar meter

> Amended by ADR 0073: the five bars are replaced by an inline dumbbell whose plates scale with `data-level`, because the bars read as a signal-strength indicator.

- Five vertical stroked bars (`.lv-bar`) on the 16-unit grid: stroke 2, round caps, x = 2/5/8/11/14, heights rising to the full box.
- The SVG is **inline**, like the fullscreen icon (ADR 0034). CSS can't select individual shapes inside a `<use>` shadow tree, and the meter has to light bars one by one.
- The button carries `data-level="0…5"`. `.btn-level-toggle[data-level='n'] .lv-bar:nth-child(-n + n)` gives the first *n* bars `stroke: var(--accent)` at opacity 1, and unlit bars sit at 0.3. Level 0 (Custom) leaves every bar dim. Only `opacity` transitions, and reduced-motion already zeroes that.

### 3. Label and state (`src/presets.ts`, `src/main.ts`)

- `levelIndex(settings)` returns 0 when `matchLevel()` finds no preset (Custom). Otherwise it returns the preset's 1-based rank in `LEVEL_PRESETS`.
- `syncLevelButton(settings)` sets `data-level`, the `.btn-label` text (the preset name or "Custom") and `aria-label="Level: <name>. Choose a level preset"`. It runs once after the first `hydrateUI` and on every state notification from `syncUI()`.
- **Identity guard.** `globalState.updateSettings()` always replaces the `settings` object, while beat ticks notify with the same object. Comparing identity with the last synced object means `matchLevel()` runs only when settings really change, never at beat rate.
- No other wiring is needed. A chip toggle goes through `updateSettings`, so the button flips to "Custom". Applying a preset lights the right bars.
- The label has `min-width: 73px`, measured as the bold 13px width of "Intermediate" (72.3px, the widest name). The header doesn't shift when the level changes.

### 4. Dialog copy follows the entry point

`openIntro(firstVisit)` sets `#intro-title-text` and `#btn-intro-skip`:

| Opened by | Title | Dismiss button |
|---|---|---|
| First visit (constructor) | Welcome to Guidonica | Skip |
| Header button | Choose your level | Cancel |

### 5. Header fit: Level takes the theme toggle's place below 1280px

These widths were measured in Chromium. The `.utility-actions` group was 230px before this change, and the labelled Level button adds 134px.

- **≥ 1280px**: there's room in the one-row header, so every button shows and Level keeps its label.
- **< 1280px**: Level collapses to its meter (a `--hit` square) and `#btn-theme-toggle` hides. The utility group keeps exactly its old width at every narrower breakpoint. The two-row tablet header (601–960px) shares its utility column with the beat dots, so any extra width there would squeeze the tempo slider. The theme stays available in Settings → Practice → Theme (`#select-theme`), which makes it the right control to demote.
- **≤ 600px**: Settings and Reset collapse to icons as before. The phone row holds the brand plus four 44px buttons with no overflow, checked at 320, 360, 390 and 430px.

## Consequences

- Difficulty is now one tap from anywhere. The meter also shows at a glance whether the settings still match a preset.
- The theme toggle appears in the header only at 1280px and wider. Narrower screens change the theme from Settings.
- Like `#btn-fullscreen-toggle`, the meter is an inline SVG and stays outside the sprite. Its bars must keep the `.lv-bar` class and their order for the `nth-child` rules to work.
- Not addressed here: at 961–1050px, the one-row header was already wider than the viewport before this change. This ADR leaves that width unchanged.
- Tests: `tests/presets.test.ts` covers `levelIndex` (each preset under every intro clef, and Custom after a one-chip deviation). `tests/levelButton.test.ts` checks the button's placement, ARIA, five bars and that `#btn-intro-open` is gone.

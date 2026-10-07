# 0097. Stage-First Shell: Top Bar, Transport Dock, Tabbed Inspector and ⋯ Menu

- **Status**: Accepted
- **Date**: 2026-10-07
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0045](0045-aero-guidonica-2-material-hierarchy-and-responsive-redesign.md) (layout and material mapping), [0053](0053-header-level-button.md) (where the Level button and theme toggle live), [0054](0054-responsive-header-fit-audit.md) (the responsive contract), [0082](0082-visible-social-links.md) (the footer links)

## Context & Problem Statement

The shell grew one feature at a time on a layout designed before most of them (ADRs 0045, 0053, 0054). The drone added four controls, then came the half-note beat, the C and ¢ signs, exercise links, tips, What's new, the socials and the Level presets. Screenshots of 2026.10.2 showed three structural problems:

- **Desktop, 1440×900**: the open settings cards took about 60% of the height, leaving the staff a band in the lower third. The footer of keycaps and links cost another row. Settings and transport shared one header, so nothing read as primary.
- **Phone landscape, 844×390**: the two-row header took about 30% of the height in the only orientation that shows enough music.
- **Phone portrait**: the transport was at the top, out of thumb reach. Settings opened as one long scroll of four cards, and "Practice" had become a junk drawer of 13 controls: language, labels, assists, click, volume, four drone controls, theme and share.

The goal was a clear hierarchy that keeps the engine, the material system and the suckless constraints: vanilla TS, pure CSS, compositor-only animation, no new dependencies, the IDs `main.ts` binds, and five complete locales.

## Decision

### 1. Information hierarchy

Each control sits where its frequency of use puts it.

| Tier | Content | Where |
|---|---|---|
| 0 · Stage | Scrolling staff, playhead, zoom pill, notices, share toast | All remaining space; never covered on wide screens |
| 1 · Transport, used every few seconds | Reset · **Play** (the only gel) · tempo readout, Italian term and slider · beat LEDs and count-in · mute | Bottom glass **dock** (`footer.transport-dock`) |
| 2 · Exercise, between runs | Brand, Level, summary chips (`Treble (G) · 4/4 · Drone C`), fullscreen, Settings | Slim top glass **bar** (`header.app-bar`) |
| 3 · Configuration | Every setting, in five tabs | **Inspector** `aside#controls-drawer`: docked right on wide screens, a sheet elsewhere |
| 4 · Meta | Exercise link, About, What's new, Keyboard shortcuts, Theme, GitHub · Privacy, socials, Support | **⋯ menu** `#app-menu` in the bar |

The footer is removed. Its keycaps moved to a Keyboard shortcuts dialog, and its links moved to the ⋯ menu. The About dialog keeps the `social-link` anchors, so the `rel="me"` verification (ADRs 0080, 0082) is unchanged.

### 2. Layout modes: one grid, switched by media queries only

`#app` is a CSS grid. Each mode only changes its template, so JS never reads layout to place the chrome.

| Mode | Query | `#app` areas | Inspector |
|---|---|---|---|
| **Wide** | `(min-width: 1024px) and (min-height: 501px)` | `'bar insp' 'stage insp' 'dock insp'`; columns `minmax(0, 1fr) 0`, or `min(380px, 32vw)` with `#app.inspector-open` | A docked column. Opening it is one layout and one canvas resize through the existing `ResizeObserver` and auto zoom (ADR 0055). Only its content animates (`inspector-in`: opacity and translateX). |
| **Compact** | otherwise | `'bar' 'stage' 'dock'` | Shares the `stage` grid area, so the canvas never reflows. A bottom sheet (`min(100%, 680px)`, top radius only) in portrait and a right side sheet (`min(360px, 55vw)`) in landscape. It scrolls internally. Its transparent margin passes taps to the stage, which closes it. |
| **Short landscape** | `(max-height: 500px)` | `'stage stage' 'dock bar'`, columns `minmax(0, 1fr) auto` | As compact, from the right. The bar and dock share one bottom row; the ⋯ menu opens upwards. |
| **Phone** | `(max-width: 600px)` | as compact | The dock becomes a two-row grid, `'transport beats mute' 'tempo tempo tempo'`, with the slider running full width under the thumb. |

`main.ts` exports the two queries. `DOCKED_INSPECTOR_QUERY` decides whether Escape closes the inspector, since only a sheet closes. `OPEN_INSPECTOR_QUERY`, `(min-width: 1280px) and (min-height: 501px)`, opens the inspector by default and follows its `change` event. This replaces the `stageFitsStaff` check after `document.fonts.ready` (ADRs 0054, 0096), which is deleted: from 1280px a 380px column still leaves the staff at least 900px.

Room-based collapse uses container queries, never viewport widths:

- **`bar`** (the top bar): the SOLFÈGE badge shows from 960px, the summary chips hide at 719px and below, and Level and Settings keep only their icons at 559px and below.
- **`brand`** and **`transport`** (phone block): the ADR 0054 thresholds are unchanged. The badge goes below 183px, the wordmark below 118px, and Start's label below 148px.
- **`dock`** (short landscape only): the merged row holds 418px besides the tempo group, budgeted for 44px touch targets and the widest LED cluster (12/8, 152px). The tempo group itself measures 193px with its Italian term and a 56px slider. The tempo term hides at 610px and below, the slider at 550px, Start's label at 484px, and the BPM unit at 412px. The readout and the arrow keys still set the tempo. On a 640×360 Android phone in 12/8, the row then still fits.

The bar is not a size container in short landscape (`container-type: normal`), because an `auto` grid column must size from its content.

Layering: the bar is at z-index 30 so the ⋯ menu opens over a sheet, the inspector at 25, and the dock at 20. The bar's and dock's glass is painted on `::before` (`z-index: -1`), so neither element is a backdrop root and the menu's own glass blurs what lies under it.

### 3. The tabbed inspector

The inspector has a header (the Alegreya italic title "Settings" and `#btn-drawer-close`) and an ARIA tablist `.inspector-tabs`. Five `button[role=tab]` elements each carry an icon and a short label: **Staff**, **Rhythm**, **Melody**, **Sound** and **Display**. Their `section[role=tabpanel]` panels are switched with the `hidden` attribute, so `.settings-section[hidden] { display: none }` is needed against the section's `display: flex`.

| Tab | Controls (IDs unchanged) |
|---|---|
| Staff | clef, ledger lines with the range hint, meter, half-note beat, C and ¢ signs, pulse |
| Rhythm | note values, dotted, tuplets, rests, ties |
| Melody | notes, intervals with the fallback hint |
| Sound | click timbre with count-in, volume, drone note, sound, tuning and volume |
| Display | language, note names, assists (playhead, tips), theme |

The old Practice section is removed. The exercise link moved to the ⋯ menu.

- **`src/utils/tabs.ts`**: `selectTab(tabs, id)` sets `aria-selected`, keeps the selected tab as the only tab stop and toggles each panel through `aria-controls`. `bindTabs(list, onSelect)` binds clicks and reuses `bindRovingKeys` from `src/utils/radioGroup.ts` for the arrow, Home and End keys, with automatic activation. The panels are already in the DOM, so selecting costs nothing. The last tab is kept in memory, not stored.
- **Tuplets** is an in-flow disclosure at every size. The desktop popover positioning is deleted. `#btn-tuplets-toggle`, `#tuplets-popover` and Escape-to-close stay, and changing tab closes it.
- Section titles and well cards are gone inside the inspector: the tab names the group, and the glass sheet itself is the container.
- New stroked 16-unit sprite icons: `i-staff`, `i-rhythm`, `i-melody`, `i-display`, `i-more` and `i-keyboard`. Sound reuses `i-speaker`.

### 4. Summary chips

`src/summary.ts` `exerciseSummary(settings, messages)` returns `{ text, tab }` chips:

- the clef, by its locale name;
- the meter as written, where `timeSignatureSpec` gives `C` and `C|`, shown as `C` and `¢` when the signs are on;
- the drone, as `summaryDrone(note)` in the user's note-name convention (Bordone Si, Bordun H), only while the drone sounds.

`renderExerciseSummary` rebuilds `#exercise-summary` from `syncUI`, but only when the settings object changes identity, the same caching as `syncLevelButton`, so `syncUI` stays idempotent (ADR 0091). `applyTranslations` forces a rebuild. A chip click calls `openInspector(tab)`, which closes the tuplets, selects the tab, opens the inspector and scrolls it to the top. Tips use the same path: their `SettingsSection` targets are now the five tabs, and the exercise-link tip has a `{ kind: 'share' }` action that clicks `#btn-share-exercise`.

### 5. ⋯ menu, keyboard shortcuts and Escape

- **⋯ menu**: a disclosure (`#btn-menu-toggle[aria-expanded]` plus `#app-menu[hidden]`), not the Popover API, which is newer than the Safari 16 and Firefox 115 baseline (ADR 0096). It closes on outside `pointerdown`, on Escape and when an item is chosen. That last listener runs in the capture phase, because some items stop propagation before they open their dialog. The Theme item cycles in place and leaves the menu open, so the new mode is visible.
- **Keyboard shortcuts**: `#modal-shortcuts` reuses the `.about-dialog` styles and the former footer's `<kbd>` rows and `data-i18n` keys. It opens from the menu and from <kbd>?</kbd>, but not while typing in an input or select. It joins the "modal open → ignore shortcuts" guard.
- **Escape** closes the innermost open layer first: the menu, then the tuplets disclosure, then a compact inspector sheet. Only then does it reset.

### 6. Share toast, phone sheets and focus mode

- **Share toast**: `#share-status` is a glass toast at the top centre of the stage. It enters with `notice-in`, and `toast-out` fades it after 4s (`forwards`). On `animationend` for `toast-out`, `main.ts` adds `.hidden`, so the next share replays both animations. No timer is involved. With reduced motion every animation is off, so the toast stays until the settings next change, which also hides it.
- **Phone dialogs**: at 600px and below, About, What's new, Keyboard shortcuts and the intro are bottom sheets. They are full width, rounded on top only, and slide up with `sheet-up` (transform and opacity). The footer padding clears `safe-area-inset-bottom`. This is CSS only.
- **Focus mode**: `syncUI` writes `#app[data-playback]` only when the playback state changes, never per beat (ADR 0091). While it is `playing`, the bar and the zoom pill fade to 0.4 opacity. `:hover`, inside `@media (hover: hover)`, and `:focus-within` bring them back. The dock stays fully lit, because it holds Pause.

### 7. Materials

The manifesto §3 rules are unchanged; only the mapping moves:

- **Gel**: Play only.
- **Glass**: the bar, dock, inspector and sheets, ⋯ menu, toast, zoom pill and notices.
- **Acrylic**: buttons, chips, tabs and summary chips. The selected tab takes the `:checked` chip look: an Olo tint, an accent border and accent text.
- **Well**: the tempo readout, the LED capsule, slider tracks, inputs and the tuplets disclosure.

Tabs are 44px tall. Their labels wrap with `hyphens: auto` rather than ellipsize, which German needs ("Notensystem").

### 8. Localization

The new keys are in all five locales:

- section and tab names: `sectionSound`, `sectionDisplay`, `inspectorTabsAria`;
- the menu and dialogs: `moreMenu`, `moreMenuAria`, `shortcutsTitle`, `shortcutsMenu`, `keyHelp`, `closeSettings`;
- the summary chips: `exerciseSummaryAria`, `summaryDrone(note)`;
- `themeMenu(mode)`.

`sectionPractice` is removed. Tips now point to the Sound and Display tabs and to the ⋯ menu.

## Consequences

- **The staff gets the screen.** At 1440×900 the stage is about 795px tall instead of about 300px. At 844×390 the merged row costs 52px, where the two-row header cost about 120px.
- **Thumb reach**: on phones Start, tempo, beats and mute sit at the bottom, and settings open as a sheet above them.
- **One canvas resize per inspector toggle on wide screens, none on compact ones.** The beat path is unchanged: a click still only toggles `.active` on an LED (ADR 0091). The focus-mode fade runs once per playback change.
- **Dimming makes the bar a backdrop root.** While the bar is at 0.4 opacity, its glass blurs only the bar's own layer. The difference is invisible at that opacity, and focus or hover restores it.
- **Narrow short landscape trades text for room**: at 667×375 the tempo term and slider hide, and at 640×360 Start shows its icon only. The tempo stays settable from the readout and the keyboard.
- **Size**: CSS grows from 8.4 to 9.5 kB gzipped (tabs, menu, dialog sheets, four layout modes). App JS grows from 40.8 to 41.7 kB (tabs, summary, menu), and each lazy locale chunk from 6.4 to 6.6 kB.
- **Tests**: `tests/responsiveLayout.test.ts` pins the grid templates, queries and container thresholds, and `tests/inspector.test.ts` pins the tabs, their panels, the tip targets and the summary chips per locale. The DOM tests for the Level button, beat lights and fullscreen pass unchanged, because their markup kept its IDs.
- Verified at 1440×900, 1100×800, 1024×768, 820×1180, 390×844, 844×390, 667×375, 640×360, 320×568 and 2560×1440, in light and dark, in en, de and it, and in Blink, Gecko and WebKit, with no console errors.

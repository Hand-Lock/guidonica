# 0049. Level Presets & Onboarding Intro ("What's your level?")

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

- New visitors landed on the factory defaults (`DEFAULT_APP_SETTINGS`, `src/storage.ts`) in front of a dense settings sheet, with no quick way to get material that suits them.
- Any fix must not touch the generator. Ergodicity (AGENTS.md §1, §3.5) has to hold for every configuration a preset produces.
- Returning users must never be interrupted.

## Decision & Implementation

### 1. Two-step intro dialog

- `<dialog id="modal-intro" class="about-dialog intro-dialog">` in `index.html` reuses the About modal's glass shell (header / body / footer).
- **Step 1, Level**: a five-card `role="radiogroup"`. The cards are built in TS from `LEVEL_PRESETS`, so the data lives in one place. "Next" stays disabled until a level is picked. "Skip" keeps the current settings.
- **Step 2, Clef**: four cards (Treble, Bass, Alto, Tenor) from `INTRO_CLEF_OPTIONS`. The current clef is preselected, or Treble if it is not one of the four. A note points to Settings → Staff for the other C/F clefs. "Back" returns to step 1 and "Start practising" applies the preset.
- **Radio semantics**: each card is a `<button role="radio" aria-checked>` with a roving tabindex. Arrow keys and Home/End move the selection, and focus follows the selection. With nothing selected, the group container (tabindex −1) takes focus, so no unselected card shows a focus ring.
- **Reopen**: Settings → Practice → "Level presets…" (`#btn-intro-open`, `btn btn-menu`). When the current settings match a preset exactly (clef ignored, key order ignored, `matchLevel()`), that level is preselected.
- **Shortcuts**: `bindKeyboardShortcuts()` ignores global keys while `#modal-intro` is open, as it already did for About, so Space and R never start or reset playback behind the dialog.

### 2. Preset table (`src/presets.ts`)

Every preset is 4/4 with count-in on. Presets leave theme, volume, mute, zoom, sound, 6/8 pulse and playhead alone.

| Level | BPM | Ledger ↑/↓ | Rhythms | Dotted | Rests | Ties | Tuplets | Intervals | Labels |
|---|---|---|---|---|---|---|---|---|---|
| Beginner | 50 | 1/1 | whole, half, quarter | – | – | – | – | unison, 2nd, 3rd | solfège |
| Elementary | 60 | 2/2 | + eighth | ✓ | ✓ | – | – | unison–4th | none |
| Intermediate | 72 | 2/2 | + eighth | ✓ | ✓ | ✓ | triplet ⅛ | unison–5th | none |
| Advanced | 80 | 3/3 | + sixteenth | ✓ | ✓ | ✓ | triplet ¼, ⅛ | unison–octave | none |
| Virtuoso | 92 | 3/3 | + 32nd | ✓ | ✓ | ✓ | all 4/4-supported cells | all incl. 9+ | none |

- `buildPresetSettings(level, clef): Partial<AppSettings>` returns a deep clone and passes tuplets through `supportedTuplets('4/4', …)`. Virtuoso asks for every cell, and only the 12 cells in `TUPLET_SUPPORT['4/4']` survive. Duplets and quadruplets are dropped, and the UI shows them disabled, as it would after a manual meter change.
- `GuidonicaApp.applyLevelPreset()`: `globalState.updateSettings(patch)` → `metronome.setTempo / setTimeSignature` → `renderBeatDots` → `hydrateUI` (every control, tuplet availability, auto zoom) → `resetSession()` (stops playback, regenerates the buffer).

### 3. First-visit detection (`src/storage.ts`)

- `ONBOARDED_KEY = 'guidonica_onboarded_v1'`, with `isOnboarded()` / `markOnboarded()`.
- `hasStoredSettings()` checks `STORAGE_KEY` and both legacy keys.
- The intro shows when `!isOnboarded() && !hasStoredSettings()`. This is computed at the very top of the `GuidonicaApp` constructor, before `hydrateUI → applyZoom` can save settings. Existing users (saved settings, no flag) never see it.
- The dialog's `close` event calls `markOnboarded()`, so a preset, Skip, ✕, Esc and a backdrop click all count as onboarded.
- Every storage access is wrapped in try/catch. If storage is unavailable (some private modes), the intro shows on each visit, which is harmless.

### 4. Audio safety

- Opening the intro at the end of the constructor creates and resumes no `AudioContext`. Audio still starts only on the user's Start / Space gesture (AGENTS.md §3.3).

## Consequences

- **Ergodicity preserved**: presets only set user-visible toggles (`tempo`, `timeSignature`, `ledgerLines`, `subdivisions`, `tuplets`, `rests`, `ties`, `intervals`, `solfegeLabelMode`, `countIn`, `clef`). Each preset is just one point in Ω, and the generator still gives every valid permutation within that Ω a non-zero probability. No hidden heuristic is introduced.
- **No new dependencies**: about 1 kB of TS and pure CSS (acrylic option cards with the chips' LED tell, plus an accent ring when selected). One column on phones, two columns from 601 px, with Virtuoso spanning the last row.
- **Maintenance**: changing a preset means editing `LEVEL_PRESETS` only. The card text, matching and application all derive from it. The descriptions must be kept in step with the values by hand.
- **Follow-up**: ADR 0050 adds generated notation examples to the level cards and clef glyphs to the clef cards.

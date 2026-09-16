# 0016: Default Woodblock Metronome Profile and Auto OS Theme Mode

## Status
Accepted

## Date
2026-09-16

## Context
1. **Acoustic Woodblock Metronome Preference**:
   The application previously defaulted to an electronic triangle wave (`'triangle'`) synthesizer click. While technically clean, synthesized triangle clicks produce high-frequency harmonics that can induce ear fatigue during extended sight-reading sessions. In ADR 0013, an acoustic woodblock profile was synthesized using an exponential downward frequency chirp ($1600\text{Hz} \rightarrow 800\text{Hz}$ on downbeats, $1100\text{Hz} \rightarrow 550\text{Hz}$ on regular beats over a $25\text{ms}$ envelope). Musically and pedagogically, the woodblock timbre provides superior perceptual clarity against vocal singing or instrumental solfège practice without masking pitched notes. Users sought to have woodblock as the out-of-the-box default sound.

2. **Unified Auto (OS-Aligned) Theme Mode Default**:
   ADR 0015 introduced dynamic `ThemeMode = 'auto' | 'light' | 'dark'`, supporting real-time operating system dark/light switching via `window.matchMedia('(prefers-color-scheme: dark)')`. However, static HTML markup, CSS variable fallback scopes, and notation renderer method signatures retained legacy `'light'` assumptions (`<html data-theme="light">`, button icon `🌙`, default renderer parameters `theme: ThemeMode = 'light'`). On dark-mode operating systems, this produced a brief flash of unstyled light content (FOUC) prior to JavaScript hydration, and legacy localStorage migrations did not upgrade the audio profile.

---

## Decision & Implementation Methods

### 1. Default Woodblock Click Profile
- In `src/audio/metronome.ts`:
  - Updated private default initialization:
    ```ts
    private soundProfile: SoundProfile = 'woodblock';
    ```
- In `src/storage.ts`:
  - Updated `DEFAULT_APP_SETTINGS.soundProfile = 'woodblock'`.
  - Added robust validation in `loadStoredSettings()` to ensure only legal `SoundProfile` values are loaded.
  - Implemented migration for legacy `v1` storage: if migrating from `v1` where `'triangle'` was the unchangeable or default profile, it is migrated to `'woodblock'`, whereas explicit `'triangle'` choices in `v2` are preserved.
- In `index.html`:
  - Updated `<select id="select-sound-profile">` so `<option value="woodblock" selected>` is the selected element.
- In `tests/metronome.test.ts` & `tests/storage.test.ts`:
  - Updated baseline assertions to verify `'woodblock'` default across empty storage, instance initialization, and legacy migrations.

### 2. Zero-FOUC Auto Theme Default Across All Layers
- In `index.html`:
  - Removed hardcoded `data-theme="light"` from `<html lang="en">`.
  - Added an early, synchronous `<script>` in `<head>` before stylesheet evaluation to inspect `localStorage` or evaluate `(prefers-color-scheme: dark)`, immediately setting `document.documentElement.setAttribute('data-theme', ...)` before initial DOM painting.
  - Updated header theme toggle button (`#btn-theme-toggle`) markup to default to `🌓` with accessible labels `Theme: Auto (OS)`.
- In `src/style.css`:
  - Added `@media (prefers-color-scheme: dark)` fallback block targeting `:root:not([data-theme='light'])` so that all dark palette variables apply natively even before scripts execute or if `data-theme` is unspecified.
- In `src/notation/renderer.ts`:
  - Updated default parameter in `renderMeasure` and `renderPinnedClef` to `theme: ThemeMode = 'auto'`.

---

## Consequences & Verification
- **Acoustic Ergonomics**: Sight-reading sessions immediately begin with organic woodblock audio feedback without requiring drawer navigation.
- **Zero-FOUC Visual Comfort**: Dark mode users no longer experience a white screen flash on page load or refresh.
- **Backward Compatibility**: Existing sessions cleanly upgrade legacy defaults without losing customized tempo, meter, clef, subdivision, or interval configurations.
- **Hygiene & Strict Typing**: 100% test pass rate across all 27 unit tests (`npm test`), 0 TypeScript compiler warnings (`npm run typecheck`), and clean production builds (`npm run build`).

# 0015: Italian Solfège Syllables and Cross-Platform OS-Aligned Auto Night Mode

## Status
Accepted

## Date
2026-09-16

## Context
1. **Italian Fixed-Do Solfège Pedagogy**:
   Solfège Scroller previously provided two label modes: Anglo-American Solfège (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Ti`) and standard note letters (`C`, `D`, `E`, `F`, `G`, `A`, `B`). In Romance and classical conservatory pedagogy (Italian, French, Spanish, Latin American traditions), musical notes are named using fixed-Do solfège where degree 7 ($B$) is universally designated **"Si"** rather than **"Ti"** (derived from the historic hymn *Ut queant laxis* honoring *Sancte Iohannes*). Users practicing in these pedagogical frameworks required an Italian lettering solfège option.

2. **Cross-Platform OS Night Mode Alignment**:
   In previous revisions (ADR 0002), the application standardized on light mode to prevent forced browser contrast inversions and black-on-black glyph clashes in specialized environments. Later updates reintroduced a high-contrast dark theme palette with crisp slate canvases and light notation glyphs, but theme selection was purely manual. Users on macOS, Windows, Linux, and mobile platforms expect modern web applications to automatically detect the operating system's color scheme preference in real time without requiring manual toggling each time system daylight/night scheduling shifts.

---

## Decision & Implementation Methods

### 1. Italian Solfège Syllables (`ITALIAN_SOLFEGE_SYLLABLES`)
- In `src/notation/types.ts`, extended `SolfegeLabelMode` union:
  ```ts
  export type SolfegeLabelMode = 'none' | 'solfege' | 'italian' | 'letters';
  ```
- Exported constant mapping for Italian syllables:
  ```ts
  export const ITALIAN_SOLFEGE_SYLLABLES: Record<string, string> = {
    c: 'Do',
    d: 'Re',
    e: 'Mi',
    f: 'Fa',
    g: 'Sol',
    a: 'La',
    b: 'Si',
  };
  ```
- In `src/notation/renderer.ts`:
  When `solfegeMode === 'italian'`, pitch letters are resolved against `ITALIAN_SOLFEGE_SYLLABLES`. Stave offset geometry, baseline rendering at $Y = 148$, and dynamic lower ledger line step-down calculations are completely unified with standard syllables without visual drift or clipping.
- In `index.html`:
  Updated the label dropdown to clearly contrast Anglo-American and Italian solfège:
  - `None`
  - `Solfège (Do-Re-Mi / Ti)`
  - `Italian (Do-Re-Mi / Si)`
  - `Letters (C-D-E)`

### 2. Cross-Platform OS Color Scheme Detection & Real-Time Synchronization
- Extended `ThemeMode` to include `'auto'`:
  ```ts
  export type ThemeMode = 'auto' | 'light' | 'dark';
  export type ResolvedTheme = 'light' | 'dark';
  ```
- Implemented `isSystemDark()`, `resolveTheme()`, and `subscribeSystemTheme()` in `src/notation/types.ts`:
  - Utilizes `window.matchMedia('(prefers-color-scheme: dark)')`.
  - Provides robust backward compatibility for older WebKit / Safari runtimes via `addListener` fallback.
- In `src/scroller/scroller.ts` and `src/notation/renderer.ts`:
  - Canvas rendering methods compute `resolveTheme(theme)` to determine background fills, staff line strokes, pinned clef glyph styles, and note color tokens.
- In `src/main.ts`:
  - Bound real-time OS preference watcher: when the OS changes between light and dark modes, if `settings.theme === 'auto'`, the DOM `data-theme` attribute updates instantly, pinned clef caches are invalidated, and offscreen measure canvases are re-rendered with new high-contrast palette tokens.
  - Theme button cycles `Auto (OS)` 🌓 $\rightarrow$ `Dark` 🌙 $\rightarrow$ `Light` ☀️ $\rightarrow$ `Auto (OS)` 🌓.
  - Added a dedicated "Theme" select dropdown in the Settings Drawer to allow explicit selection of `Auto (OS)`, `Light`, or `Dark`.

### 3. Local Storage Migration & Backward Compatibility
- In `src/storage.ts`:
  - Updated `DEFAULT_APP_SETTINGS.theme` to `'auto'`.
  - Introduced `STORAGE_KEY_V2 = 'solfege_scroller_settings_v2'`.
  - Legacy `v1` storage containing the old hardcoded default (`theme: 'light'`) is migrated to `'auto'`, activating OS alignment out-of-the-box while preserving all existing user tempo, meter, clef, subdivision, and interval configurations.

---

## Consequences & Verification
- **Pedagogical Inclusivity**: Italian/Romance solfège practitioners have native support for "Si" without disrupting users who practice with "Ti".
- **OS Fluidity**: Automatic night mode works cross-platform on macOS, Windows, Linux, iOS, and Android, switching instantly without page reloads.
- **Strict Typing & Hygiene**: Zero TypeScript errors (`tsc --noEmit`), full test coverage in `tests/solfege.test.ts` and `tests/storage.test.ts`, and clean production builds via Vite.

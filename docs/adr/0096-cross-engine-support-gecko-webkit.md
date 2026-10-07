# 0096. Cross-Engine Support: Gecko and WebKit, Chromium Untouched

- **Status**: Accepted
- **Date**: 2026-10-07
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Until now Guidonica was driven and verified in Chromium only: the `run-guidonica` driver launched Playwright's cached Chromium and nothing else. Users open it in Firefox, Safari, Opera and others, and it has to work properly in all of them without changing what Chromium does and without adding weight.

Opera, Edge, Brave, Vivaldi and Arc all run Blink, so the browsers reduce to three engines:

| Engine | Browsers |
|---|---|
| Blink (Chromium) | Chrome, Edge, Opera, Brave, Vivaldi, Arc, Samsung Internet, Android WebViews |
| Gecko | Firefox, Firefox ESR, Tor Browser, Mullvad Browser, LibreWolf |
| WebKit | Safari on macOS, and every browser on iOS and iPadOS (Chrome, Firefox, Edge… for iOS) |

A static audit found the code already hardened: `requestIdleCallback` falls back to `setTimeout`, `webkitAudioContext` and the prefixed Fullscreen API are handled, fullscreen, Wake Lock, `navigator.share`, `navigator.audioSession` and `serviceWorker` are feature-detected, `matchMedia` falls back to `addListener`, `100vh` precedes `100dvh`, range inputs are styled for `-webkit-` and `-moz-`, and evicted canvases are zeroed for iOS's canvas memory cap (ADR 0091). No Chromium-only API is used (`popover`, `closedby`, View Transitions, `scheduler`, Speculation Rules). Reading the code cannot show how the other engines lay out, paint and time it, so the app had to be run in them.

## Decision

### 1. Support baseline

**Chromium 105+, Firefox 115 ESR+, Safari / iOS 16+.** These are the versions the app already needs: `@container` queries (Chrome 105, Firefox 110, Safari 16), `structuredClone` and `<dialog>` with `::backdrop` (Safari 15.4). Firefox 115 is the oldest ESR still serving users.

`vite.config.ts` states it as `build.target: ['chrome105', 'firefox115', 'safari16']` instead of Vite's implicit `modules` default (Chrome 87, Firefox 78, Safari 14), so esbuild's down-levelling follows the baseline. It no longer transpiles syntax every baseline browser runs natively, and the CSS loses prefixes no baseline browser needs (`-moz-appearance: none`, `-webkit-appearance: textfield`) and gains the `inset` shorthand. Gzipped sizes:

| chunk | `modules` | baseline |
|---|---|---|
| app JS (`index`) | 41.63 kB | 40.82 kB |
| `vexflow/core` | 93.34 kB | 93.29 kB |
| CSS | 8.42 kB | 8.40 kB |

`sw.js` (2.33 kB raw) and the locale and changelog-notes chunks are unchanged.

### 2. The fallback-only rule

Every engine fix is a feature-detected branch or a fallback declaration that Chromium never takes, or one that only changes behaviour where Chromium was already wrong (§4.2). No user-agent sniffing, no polyfills, no runtime dependencies.

### 3. Driving three engines (`.claude/skills/run-guidonica/`)

- `chromium.mjs` gains `ENGINES` and `findBrowser(engine)`: `chromium` defers to the existing `findChromium()` (still used by `scripts/build-banners.mjs`), `firefox` finds the newest `firefox-*` build's `firefox` binary (inside `Nightly.app` on macOS), and `webkit` the newest `webkit-*` build's `pw_run.sh`.
- `driver.mjs` gains `--browser chromium|firefox|webkit` (default `chromium`, so existing commands are unchanged) and `--setup [engine…]`, which installs every missing engine in one `playwright-core install` call. Playwright's installer deletes cached builds the current `playwright-core` no longer uses, so a stale Chromium build can disappear when another engine is installed; `--setup` lists every engine it was asked for and reinstalls what is missing. Context options are the cross-engine subset: Firefox rejects `isMobile`, so it is never passed.

Verified with playwright-core 1.63: Chromium 153 (`chromium-1243`), Firefox 155 (`firefox-1543`), WebKit 26.6 (`webkit-2359`).

### 4. Matrix and fixes

Each engine ran against `pnpm dev` and against the production build (`pnpm preview`) with the service worker: boot, play (notes move, beat lights tick), the drone (`D`), Space, R, P, the tempo arrows, `+`/`-`/`0` zoom, Escape on the tuplet popover, the onboarding intro in French, About in Italian dark, Settings at 390×844 in German dark, all five languages in light and dark, a `#x=1` link (tempo, clef and meter decoded), and the Share button's clipboard fallback (Firefox has no `navigator.share`). In production the worker registered, controlled the page and served it with the server stopped. All three engines finished with no console or page errors, and their screenshots match Chromium's: glass, chips, LCD inputs, range thumbs, the `@container` header, the `:has()` disabled tuplet labels and the masked strips. Three bugs were found and fixed.

#### 4.1 Blocked site data (`src/storage.ts`)

Firefox and Safari throw a `SecurityError` from the `window.localStorage` getter itself when cookies and site data are blocked. `loadStoredSettings` and `saveStoredSettings` tested `window.localStorage` before their `try`, so the app failed to boot. The test now sits inside the `try`: the app boots with the defaults and saves are ignored. The other helpers were already wrapped.

#### 4.2 Drawer fit check raced the fonts (`src/main.ts`)

On a wide screen the Settings drawer opens by default when the staff still fits beside it (ADR 0054). The check ran at boot while the self-hosted text fonts were still loading, so the fallback font's wider metrics wrapped the drawer one row taller (634 px instead of 538 px at 1280×900), the stage measured 157 px, below the 220 px staff, and the drawer closed. Chromium and Firefox did this; WebKit, which had the fonts in time, kept it open. `openDrawerByDefault` now waits for `document.fonts.ready` when `document.fonts.status` is `loading` and drops a check superseded by a later breakpoint change. Chromium is affected too, for the better: a first visit at 1280×900 opens the drawer, as ADR 0054 intends.

#### 4.3 Coarsened frame timestamps (`src/audio/metronome.ts`)

Firefox with `privacy.resistFingerprinting` (also Tor and Mullvad Browser) rounds rAF timestamps to 16.67 ms, so at 60 Hz some frames read 0 ms apart and the next 33 ms (35 of 240 frames in a headed run). The frame-locked clock (ADR 0089) advanced by the frame interval, so the tape stood still for one frame and jumped two in the next. A timestamp that does not advance can only come from a coarsened timer, so `tick()` now advances it by the last real interval (`frameIntervalMs`, updated only from intervals in (0, 50) ms) and lets the following longer gap absorb it. A 0-then-33 pattern becomes fully even; a 33-then-0 pattern becomes 33 then 16.7, never worse than before. Accurate clocks never take the branch.

The audit's other candidates were ruled out: Safari has no `AudioContext.outputLatency`, but `outputLatency()` falls back to `baseLatency` then 0, so the clock never sees NaN; Firefox's native scrollbars and the canvas text of VexFlow needed no change.

### 5. Harness limits (not app bugs)

- Playwright's Firefox and WebKit builds paint no `backdrop-filter`, headless or headed, while `filter: blur()` paints and `CSS.supports('backdrop-filter', 'blur(4px)')` is true. Real Firefox (103+) and Safari (with `-webkit-backdrop-filter`) blur the glass and the dialog `::backdrop`, so no CSS fallback was added; the blur is on the manual checklist.
- In WebKit, `context.setOffline(true)` followed by a reload fails with an internal error. Stopping the preview server instead shows the service worker serving the app.
- In WebKit a mouse click does not focus a `<button>` (macOS platform behaviour), so focus-dependent assertions use the keyboard.

## Consequences

- One support statement, in README §17 and SPEC §6, and one build target to keep it honest.
- The driver can reproduce engine bugs; Chromium remains its default and the banner script is untouched.
- Known limitations: Safari reports no `outputLatency`, so over Bluetooth the notes may cross the playhead slightly before the click is heard (no heuristic was added); iPhone Safari has no Fullscreen API, so the button stays hidden there (ADR 0033); and audio timing by ear cannot be judged headless, so real Safari, Firefox, Opera and iPhone Safari remain a manual check.
- **Tests**: `tests/storage.test.ts` (a throwing `localStorage` getter boots with the defaults and ignores saves) and `tests/metronome.test.ts` (a timestamp repeated every 7th frame keeps every visual step within 25 % of a frame).

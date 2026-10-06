---
name: run-guidonica
description: Build, run, and drive Guidonica. Use when asked to run or start the app or its Vite dev server, take a screenshot of the UI, drive it in a headless browser (play/pause, open the About dialog or the Settings drawer, switch language or theme), run its tests, or build it.
---

Guidonica is a client-only Vite web app. To drive it, start the dev server, then
run `.claude/skills/run-guidonica/driver.mjs`. That is a one-shot headless Chromium
(Playwright) script: you give it a list of steps, it runs them in a fresh browser
context, prints any console and page errors, and exits non-zero on any failure.

All paths are relative to the repo root.

## Prerequisites

Node >= 22.13 and pnpm 11 (`packageManager` in `package.json`). The driver
needs a Chromium in Playwright's browser cache: `~/Library/Caches/ms-playwright`
on macOS, `~/.cache/ms-playwright` on Linux, or `$PLAYWRIGHT_BROWSERS_PATH` if
that is set. If none is there, `--setup` downloads one.

## Setup

```bash
pnpm install
node .claude/skills/run-guidonica/driver.mjs --setup
```

`--setup` installs `playwright-core` into `node_modules/.cache/run-guidonica/`.
The Playwright and Chromium lookup lives in `chromium.mjs`, which
`scripts/build-banners.mjs` (`pnpm banners`, ADR 0079) shares.
That directory is gitignored, and `package.json` is deliberately left unchanged
(AGENTS.md keeps the dependency list minimal). It then prints the Chromium it
will use, which is the newest `chromium-*` or `chromium_headless_shell-*` in the
cache, and ends with `ready`.

## Build

```bash
pnpm build      # tsc --noEmit && vite build -> dist/, including dist/sw.js
pnpm build:site # site/ = latest v20* release tag, site/nightly/ = working tree (ADR 0078)
```

To drive both channels, serve `site/` and point the driver at either URL:

```bash
(pnpm exec vite preview --outDir site --port 4173 --strictPort > $TMPDIR/guidonica-preview.log 2>&1 &)
node .claude/skills/run-guidonica/driver.mjs --url http://localhost:4173/nightly/ click:#btn-about-toggle text:#about-version
```

## Run (agent path)

Start the dev server, unless a Guidonica dev server is already listening. Poll
the port rather than sleeping. macOS has no `timeout` command, so poll with a
plain loop:

```bash
lsof -ti:3000 -sTCP:LISTEN || (pnpm dev --port 3000 --strictPort > $TMPDIR/guidonica-dev.log 2>&1 &)
for i in $(seq 1 30); do curl -sf http://localhost:3000 >/dev/null && echo up && break; sleep 1; done
```

Drive it. Each run opens a fresh context, loads the page, waits for load plus
800 ms (VexFlow font and first measures), then runs the steps in order:

```bash
D=.claude/skills/run-guidonica/driver.mjs

# Playing stage: the count-in lasts 4 beats (4 s at the default 60 BPM), so wait past it.
# The two shots 1 s apart show the notes moving left.
node $D click:#btn-play-pause wait:6000 shot:playing-a wait:1000 shot:playing-b

# About dialog in Italian, dark mode, at phone size, scrolled to the Trademarks section
node $D --lang it --theme dark --size 390x844 click:#btn-about-toggle \
  'scroll:#modal-about .about-section:has([data-i18n="trademarkHeading"])' wait:300 \
  'text:#modal-about .about-section:has([data-i18n="trademarkHeading"])' shot:about-it-dark-phone

# Settings drawer: at phone size it starts closed, and the toggle opens the overlay sheet
node $D --size 390x844 click:#btn-drawer-toggle wait:500 \
  "eval:document.querySelector('#controls-drawer').classList.contains('open')" shot:settings-phone

# Keyboard: Space starts, Space pauses
node $D press:Space wait:6000 press:Space "eval:document.querySelector('#btn-play-pause').innerText"

# First-visit onboarding, with the language detected from the browser locale
node $D --intro --lang fr "eval:document.querySelector('#modal-intro').open" text:#intro-title shot:intro-fr
```

Screenshots go to `$TMPDIR/guidonica-shots/<name>.png`, and the driver prints
each absolute path. Open the PNGs with the Read tool to check them. The
dev-server log is in `$TMPDIR/guidonica-dev.log`.

| option | default | effect |
|---|---|---|
| `--url URL` | `http://localhost:3000` | page to load |
| `--lang en\|it\|fr\|de\|es` | browser-detected | `language` in `guidonica_settings_v1`, plus the context locale |
| `--theme light\|dark\|auto` | app default (auto) | `theme` in `guidonica_settings_v1`; `dark` also emulates `prefers-color-scheme: dark` |
| `--size WxH` | `1280x900` | viewport; below 961 px wide the layout is the phone one |
| `--dpr N` | `2` | device scale factor |
| `--intro` | off | keeps the onboarding dialog; nothing is seeded in localStorage |
| `--seen VERSION` | `9999.0.0` | last version whose "What's new" notes were seen; pass an older one (e.g. `1.0.0`) against a newer build to open the dialog at boot |
| `--out DIR` | `$TMPDIR/guidonica-shots` | screenshot directory |

| step | what it does |
|---|---|
| `click:<selector>` | clicks the element (5 s timeout) |
| `press:<Key>` | presses a Playwright key name: `Space`, `KeyR`, `Escape`, `ArrowUp`, … |
| `wait:<ms>` | waits that many milliseconds |
| `scroll:<selector>` | scrolls the first match into view |
| `text:<selector>` | prints the first match's `innerText` |
| `eval:<js>` | evaluates the expression in the page and prints the JSON result |
| `shot:<name>` | writes `<out>/<name>.png` (the viewport) and prints its path |

Exit codes: 0 means every step ran and there were no console or page errors.
1 means a step failed (`step click:#x failed: …`) or errors were logged; they
are listed after `errors (N):`.

Useful selectors: `#btn-play-pause`, `#btn-reset`, `#btn-about-toggle`,
`#modal-about`, `#btn-drawer-toggle`, `#controls-drawer`, `#btn-level-toggle`,
`#modal-intro`, `#btn-theme-toggle`.

Stop the server only if you started it:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs kill
```

## Run (human path)

```bash
pnpm dev        # -> http://localhost:3000 (server.port in vite.config.ts). Ctrl-C to stop.
pnpm preview    # serves dist/ after pnpm build, with the service worker active
```

## Test

```bash
pnpm typecheck
pnpm test       # vitest + happy-dom: 32 files, 647 tests pass
```

## Gotchas

- **The onboarding intro blocks clicks.** On a first visit the `#modal-intro` `<dialog>` opens modally. It only appears when neither `guidonica_onboarded_v1` nor `guidonica_settings_v1` is stored (`src/main.ts`), so the driver seeds the onboarded flag by default. Pass `--intro` to test the intro itself.
- **"What's new" can open at boot and block clicks** (ADR 0078). The driver seeds both channels' keys (`guidonica_` and `guidonica_nightly_`) with the onboarded flag and a far-future seen version, so it stays closed unless you pass `--seen`.
- **Language and theme are read from the `guidonica_settings_v1` JSON.** Without that entry, the language is detected from `navigator.languages`. The driver writes only the fields you pass, and every other setting stays at its default.
- **The Settings drawer is already open on wide screens.** At 961 px and wider it opens by default whenever the staff still fits, so `click:#btn-drawer-toggle` at the default 1280x900 *closes* it. Use `--size 390x844` to screenshot it opening.
- **The count-in delays the first notes.** Playback starts with a 4-beat count-in, so shots taken earlier than about 5 s after Play show a stationary staff.
- **The `AudioContext` needs a user gesture.** Start playback with `click:` or `press:`, never `eval:`.
- **The About dialog body scrolls.** Run `scroll:` on the section before `shot:`, or it may be out of view at phone size.
- **The service worker registers only in production builds** (`src/utils/serviceWorker.ts`). Against `pnpm preview` a reused browser profile can serve stale precached assets. The driver uses a fresh context on every run, so this only affects a manual browser.
- **No system Chrome or `chromium-cli` was found on the dev machine.** That is why the driver launches Playwright's cached Chromium through `executablePath`.

## Troubleshooting

- **`Error: Port 3000 is already in use`** in the dev log, while the curl poll still says `up`: another Guidonica dev server, often the user's own, already holds the port, and `--strictPort` made yours exit. Either reuse it, since it serves the same checkout, or start yours on another port and pass `--url http://localhost:<port>`. Don't kill a server you didn't start.
- **`(eval):1: command not found: timeout`** (macOS): there is no GNU `timeout` there. Use the `for … seq` poll loop above.
- **`step load failed: page.goto: net::ERR_CONNECTION_REFUSED`**: the server isn't up yet, or it exited. Poll first, then check `$TMPDIR/guidonica-dev.log`.
- **`step click:<sel> failed: page.click: Timeout 5000ms exceeded.`**: the selector matches nothing, or the element is hidden or covered (for example by the intro dialog when `--intro` is passed).

Verified on macOS arm64 (Node 22.22, playwright-core 1.63 driving the cached
`chromium-1223`). The Linux cache path is coded but has not been verified.

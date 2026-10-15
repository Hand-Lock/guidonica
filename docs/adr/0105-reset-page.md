# 0105. Reset Page: `/reset` Restores a First Visit

- **Status**: Accepted
- **Date**: 2026-10-15
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0063](0063-offline-service-worker.md), [0078](0078-release-channels-calver-changelog-whats-new.md), [0086](0086-language-landing-pages.md), [0096](0096-cross-engine-support-gecko-webkit.md)

## Context & Problem Statement

What a visitor sees on load depends on two layers of state. localStorage decides the first-visit
intro (`src/main.ts`: `firstVisit = !isOnboarded() && !hasStoredSettings()`), "What's new"
(`bootAction`, ADR 0078), the tip rotation and every setting. The offline worker of ADR 0063 adds
a registration and a precache. Making the app behave like a first visit again, for debugging or
for a user who wants a clean slate, meant clearing site data by hand in the browser's settings,
which also wipes the other channel on the same origin.

## Decision

A static page at `reset/` next to each channel's shell: `guidonica.it/reset` for release,
`guidonica.it/nightly/reset` for nightly. It clears only its own channel's state, then opens the
app, which shows the intro and reinstalls the worker exactly as on a first visit.

### 1. The page (`resetPage(channel)` in `vite.config.ts`)

A minimal document: charset, viewport, `color-scheme`, the shell's two `theme-color` metas, a body
in the theme's background colour, `noindex`, no canonical, title "Guidonica — Reset". No app JS,
no fonts, no stylesheet; it adds nothing to the app bundle. One inline script, with the channel's
prefixes baked in as literals, runs four steps, each in its own `try`/`catch` because blocked
storage throws in Firefox and Safari (ADR 0096):

1. **localStorage.** Removes every key that starts with `guidonica_` but not `guidonica_nightly_`,
   plus the legacy `solfege_scroller_settings_v1`/`_v2` (release); every `guidonica_nightly_` key
   (nightly). The match is by prefix, so any future key made with `storageKey()` is covered.
2. **Worker.** Unregisters the registration whose scope is `new URL('../', location.href)`, this
   channel's app root. The release reset never touches `/nightly/`'s worker, and vice versa.
3. **Caches.** Deletes the names `staleCaches(names, '', channel)` would pick: `guidonica-` but
   not `guidonica-nightly-` (release), `guidonica-nightly-` (nightly).
4. **Redirect.** `location.replace('../')`, which always runs: `/reset/` → `/`,
   `/nightly/reset/` → `/nightly/`. `replace` keeps the reset page out of the back history.

### 2. The plugin (`resetPages()`)

`generateBundle` emits `reset/index.html` = `resetPage(buildChannel())`. GitHub Pages answers
`/reset` with a 301 to `/reset/`, so `../` resolves to the app root. The dev and preview servers
get the same redirect as middleware; the dev server also answers `/reset/` with the release page,
since it has no build output. Dev has no worker, so there the reset clears storage only.

`precacheList` already drops every `*/index.html`, so the page is never precached. Offline,
`/reset` falls back to the shell like the language pages (ADR 0086), and nothing is reset.

### 3. Tests (`tests/resetPage.test.ts`)

The inline script is run with fakes of `localStorage`, `navigator`, `caches` and `location`, which
it uses as bare globals for this reason. The storage is seeded with every `storageKey('…')` name
parsed from `src/storage.ts` for both channels, the legacy keys and an unrelated key; the worker
fakes sit at `/` and `/nightly/`; the caches are one per channel plus an unrelated one. Each
channel must remove only its own keys, worker and caches, and redirect to `../`, also when
localStorage throws. A parity test checks the baked prefixes against `storageKey()` and
`cachePrefix()` from `src/sw.ts`. `tests/serviceWorker.test.ts` checks `reset/index.html` stays
out of the precache list.

## Verification

Headless Chromium against `pnpm preview` (release) and `pnpm build:site` served by
`vite preview --outDir site` (nightly): after onboarding and a changed tempo, `/reset` landed on
the app with the intro open and the default tempo, removed a seeded stale cache of the channel,
kept the other channel's keys and cache, and the worker registered again. On `pnpm dev`,
`/reset` redirected to `/reset/` and then to the app with the intro.

## Consequences

- One URL makes a first visit reproducible, per channel, without touching the other channel.
- `guidonica.it/reset` works from the first release after this commit (the root serves the latest
  tag, ADR 0078); `guidonica.it/nightly/reset` works from this deploy.
- A reset run while another tab of the app is open leaves that tab's worker controlling it until
  it closes; the app then registers the worker again on its next load.
- The prefixes are duplicated as literals in the page, not imported; the parity test keeps them
  in step with `storageKey()` and `cachePrefix()`.

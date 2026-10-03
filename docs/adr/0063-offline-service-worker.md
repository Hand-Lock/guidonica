# 0063. Offline Service Worker

- **Status**: Accepted (amends [0048](0048-brand-mark-rollout-manifest-and-readme-logo.md))
- **Date**: 2026-10-03
- **Author**: Claude & lauseta

## Context & Problem Statement

Guidonica has an install manifest with `display: standalone` (ADR 0048) but had no service
worker. An installed copy without a connection showed the browser's offline error page, even
though the app needs nothing from the network after its first load: notation, audio and
generation all run on the client, the fonts are self-hosted (ADRs 0058, 0060) and every language
is a lazy chunk from the same origin (ADR 0059). ADR 0048 left offline caching as "a separate
decision".

Requirements:

- After one visit, the app works fully offline, including switching language.
- Online users always get the newest deploy.
- A running page never loses files it may still load (lazy locale chunks are hashed and are
  replaced by every deploy that touches them).
- No new dependency: no Workbox, no `vite-plugin-pwa`.
- Works on both `guidonica.it/` and the `hand-lock.github.io/guidonica/` mirror.

## Decision

A hand-written worker, `src/sw.ts`, compiled at build time to `dist/sw.js` (1.8 kB, 0.9 kB
gzipped) with its precache list and version baked in.

### 1. Strategies

| Request | Route | Strategy |
|---------|-------|----------|
| Non-GET, or another origin | `bypass` | No `respondWith`; the browser handles it as if there were no worker |
| `mode === 'navigate'` | `shell` | Network first with a 3 s deadline; on failure, the cached `./` |
| Anything else from this origin | `asset` | Cache first, then the network |

`route(request, scopeUrl)` is exported and pure, so it is unit-tested.

- **Navigations are never written to the cache.** Each worker version keeps the `index.html` it
  was installed with, next to exactly the hashed assets that `index.html` references. If the
  network copy were cached at runtime, an offline user could get a newer `index.html` that
  points at chunks this cache does not hold.
- **No runtime caching for assets either.** Everything the app needs is in the precache list; a
  request that misses (say, a query string) simply goes to the network. The snapshot stays exact.
- **`ignoreVary: true`** on every `cache.match`. Module scripts and fonts are CORS requests that
  carry an `Origin` header the precache request lacked; a server that sends `Vary: Origin`
  (Vite preview does) would otherwise never match, and lazy locales failed offline in testing.
  The cache holds only this app's own static files, so ignoring `Vary` is safe.
- **The 3 s deadline** (`AbortSignal.timeout(3000)`) covers a connection that is up but stalls,
  which is common on weak signal in practice rooms. It is a network deadline, not a visual or
  audio clock, so the hardware-clock rule (AGENTS.md: no independent timers for motion or
  sound) is untouched.

### 2. Install, activate, update

- **install**: `caches.open('guidonica-<version>')`, then `addAll` with
  `new Request(url, { cache: 'reload' })`. GitHub Pages sends `Cache-Control: max-age=600`;
  `'reload'` skips the HTTP cache, so a stale `index.html` is never stored next to new assets.
- **activate**: delete every `guidonica-*` cache except the current one, then `clients.claim()`.
  On a first install this puts the first session under the worker at once, so switching language
  offline works without a reload. On an update it is harmless: the new worker only activates once
  no old page remains.
- **No `skipWaiting()`.** An updated worker waits until every tab of the app is closed. A running
  page therefore never has its cache swapped under it and can still load the old hashed chunks
  (for example a locale it has not used yet) mid-session.
- **Online users still get the newest deploy:** navigations are network first, so a reload while
  online always serves the live `index.html` and its assets from the network, whatever worker is
  installed. The worker version only decides what is served offline.

### 3. Registration (`src/utils/serviceWorker.ts`)

`registerServiceWorker()` is called once at the end of `bootstrap()` in `src/main.ts`. It does
nothing unless `import.meta.env.PROD` and `'serviceWorker' in navigator`, so `pnpm dev` never
registers a worker (test with `pnpm preview`). It registers `'sw.js'` on `window` `load` (or at
once if the page has already loaded), so the precache never competes with first-load bandwidth.
The URL is relative, so the default scope is the app directory on both hosts. Failures are
ignored silently: the app then simply works online as before.

### 4. Build plugin (`serviceWorker()` in `vite.config.ts`)

- `apply: 'build'`, `enforce: 'post'`, so `index.html` and the CSS assets are already in the
  bundle when `generateBundle` runs. `configResolved` stores `publicDir`.
- **Precache list** (`precacheList(bundleNames, publicNames)`): `'./'` (the shell), then every
  bundle file except `index.html` (served as `./`), then the `public/` files except `CNAME`,
  `robots.txt`, `sitemap.xml`, `og-image.png` and dotfiles: these are for hosting, crawlers and
  link previews, never for the app. All entries are relative URLs.
- **Version** (`swVersion(entries)`): the first 12 hex characters of a sha256 over the sorted
  names and contents of every precached file (`index.html` for `./`). Two builds of the same tree
  give a byte-identical `sw.js`; any change to a precached file changes the version, and so the
  bytes of `sw.js`, which is what makes the browser install the new worker. A change to the
  worker code alone also changes `sw.js` and installs a new worker; it keeps the cache name,
  which is fine because the cached files are then identical.
- **Compile**: Vite's own `transformWithEsbuild` (`format: 'iife'`, `minify`, `target: es2020`,
  `define` for `__SW_VERSION__` and `__SW_PRECACHE__`). The output is a classic script, since
  module service workers are not yet supported everywhere, emitted with
  `this.emitFile({ type: 'asset', fileName: 'sw.js' })`. No new dependency.
- **Types**: the DOM lib has no worker types, so `src/sw.ts` declares the few members it uses
  (`ExtendableEvent`, `FetchEvent`, the worker scope) and a module-local `declare const self`
  that shadows the global. The listeners are attached only when `'registration' in self`, so
  tests can import `route()` safely.

### 5. Tests (`tests/serviceWorker.test.ts`)

- `route()`: cross-origin and POST are `bypass`, a navigation is `shell`, a same-origin
  subresource is `asset`.
- `precacheList()`: starts with `./`; includes hashed assets, icons and the manifest; excludes
  `index.html`, `og-image.png`, `CNAME`, `robots.txt`, `sitemap.xml` and dotfiles; every entry is
  relative.
- `swVersion()`: deterministic, independent of input order, and changes when a name or any
  content changes.

### 6. Verification

- Two builds of an unchanged tree give a byte-identical `sw.js`; a one-comment edit to
  `index.html` changes the version.
- Headless Chromium against `pnpm preview`: the worker takes control on the first visit and
  precaches 23 files. With the preview server killed (real offline, not emulation), a reload
  serves the shell in under 100 ms, the "Guidonica Notation" face loads, the notation canvases
  render, all four lazy locale chunks import, and there are no page errors.

## Consequences

- **Pros**:
  - The installed app, and any browser tab after one visit, works with no connection.
  - Online behaviour is unchanged: navigations still come from the network.
  - About 90 lines of typed code, no dependency, under 1 kB gzipped on the wire.
- **Cons / trade-offs**:
  - Each origin stores about 1 MB in Cache Storage (0.99 MB for 23 files at v1.0.0). The install
    re-downloads them once (about 0.57 MB on the wire), after the `load` event.
  - An offline user runs the deploy their worker installed; if they last opened the app before
    a deploy, offline they are one deploy behind until they next open it online and close every
    tab.
- **Maintenance**:
  - A new `public/` file is precached by default. If it is not part of the app (like
    `og-image.png`), add its name to `PUBLIC_NOT_PRECACHED` in `vite.config.ts` and to the test.
  - Never add `skipWaiting()` or runtime caching of navigations without revisiting this ADR:
    both break the "one consistent snapshot per worker" rule above.

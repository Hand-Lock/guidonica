# 0078. Release Channels, CalVer Changelog and "What's New"

- **Status**: Accepted (amends [0018](0018-github-actions-pages-continuous-deployment.md) and [0063](0063-offline-service-worker.md))
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Until now every push to `main` went live on guidonica.it within minutes. The only version marker was a one-off `v1.0.0` tag, and there was no changelog. Users got untested changes right away and never learned what had changed.

The goals:

- guidonica.it serves a release that was chosen on purpose.
- The latest commit stays public for testing.
- Each change is recorded when it is made.
- Returning users are told what changed since their last visit, in their language. First-time users are not bothered.

All of this has to fit the suckless rules in `AGENTS.md`: no new dependencies, no runtime cost beyond a small lazy chunk, and deterministic builds.

## Decision

### 1. Two channels on one origin

| Channel | URL | Built from | Indexed |
| --- | --- | --- | --- |
| Release | `guidonica.it/` | the newest `v20*` tag | yes |
| Nightly | `guidonica.it/nightly/` | the commit being deployed (`main`) | no (`noindex`, `Disallow: /nightly/`) |

`scripts/build-site.mjs` (`pnpm build:site`) builds both into `site/` (gitignored):

1. **Release.** The newest tag from `git tag --list 'v20*' --sort=-v:refname` is checked out into a temporary `git worktree`, followed by `pnpm install --frozen-lockfile` and `vite build --outDir site`. The worktree is removed in a `finally`. If HEAD *is* that tag and the tree is clean, the working tree is built directly.
   - **Bootstrap:** while no CalVer tag exists, the working tree is built as the release. The legacy `v1.0.0` tag is never rebuilt.
2. **Nightly.** The working tree is built with `GUIDONICA_CHANNEL=nightly` into `site/nightly/`. The release build runs first because its `--emptyOutDir` would otherwise delete the nightly directory.

`vite.config.ts` gains a `channel()` plugin:

- **Env.** It reads `GUIDONICA_CHANNEL` (`release` by default, or `nightly`; anything else throws), `GUIDONICA_COMMIT` and `GUIDONICA_COMMIT_DATE`. When these are unset it falls back to `git rev-parse --short HEAD` and `git log -1 --format=%cs`. The clock is never read.
- **Defines.** `__APP_VERSION__` (from `package.json`), `__APP_CHANNEL__`, `__APP_COMMIT__` and `__APP_BUILD_DATE__`. Release builds drop the nightly-only code through dead-code elimination, so the commit hash never reaches a release bundle. Rebuilding an unchanged tag therefore gives a byte-identical `sw.js` and triggers no service-worker update; this was verified by building twice.
- **Nightly HTML.** The title becomes "Guidonica Nightly", `<meta name="robots" content="noindex">` is added, `rel="canonical"` is removed, and the inline head script reads `guidonica_nightly_settings_v1` instead of the release and legacy keys.
- **Nightly public files.** `publicDir` is turned off for nightly, and the plugin emits `public/` through the bundle so the precache hashes the bytes actually served.
  - It skips dotfiles (`.well-known`), `CNAME`, `robots.txt`, `sitemap.xml` and `og-image.png`; these belong to the origin root.
  - The manifest's `name` and `short_name` become "Guidonica Nightly", so both channels can be installed side by side.

### 2. Storage and service-worker isolation

Both channels share one origin, so they share `localStorage` and Cache Storage. Each channel gets its own namespace:

- `storageKey(name)` in `src/storage.ts` gives `guidonica_<name>` for release (the existing keys, unchanged) and `guidonica_nightly_<name>` for nightly. It covers the settings, the onboarded flag, the orientation tip and the seen version. Nightly never reads the legacy `solfege_scroller_*` keys.
- Cache names use the prefix `guidonica-` (release) or `guidonica-nightly-` (nightly).
  - Cleanup goes through the pure `staleCaches(names, keep, channel)`, which never deletes the other channel's caches.
  - Because the nightly prefix also begins with `guidonica-`, the release filter excludes it explicitly.
- The release worker's scope is `/`, which also covers `/nightly/`. `route()` returns `bypass` for every URL under `<scope>nightly/` when it runs as the release worker. Otherwise, offline `/nightly/` navigations would receive the release shell. The nightly worker registers from `/nightly/sw.js`, its scope is `/nightly/`, and the longer scope wins.

### 3. `CHANGELOG.md`, Keep a Changelog 1.1.0

- **Source.** One English file at the repository root. Every commit adds its entry under `## [Unreleased]`, in the same commit, written for users in plain sentences, with an optional trailing `(ADR NNNN)`.
- **Sections.** `Added`, `Changed`, `Fixed`, `Removed` and `Security` are user-facing. `Internal` (docs, CI, refactors) appears on GitHub only.
- **Versions.** CalVer `YYYY.M.MICRO` (for example `2026.10.0`, tag `v2026.10.0`). `MICRO` counts the releases within the month, starting at 0. The month is not zero-padded, so versions compare numerically.
- **Parser.** `scripts/changelog.mjs` (`// @ts-check`, typed by `changelog.d.mts`) is shared by the Vite plugin, the release scripts and the tests. It handles a strict subset of the format: `## [v] - date` headings, `### Kind` sections, `- ` bullets, continuation lines indented by two spaces, and link definitions. Any other line throws, so a malformed changelog fails the tests rather than silently losing entries.
- **Translations.** `src/i18n/changelog/{it,fr,de,es}.md` hold the *released* versions only, with the same versions, dates, section kinds and bullet counts as the English file, minus `Internal`. They are written once, at release time; `tests/changelog.test.ts` enforces the mirror.

### 4. In-app "What's new"

- **Notes modules.** `*.md?notes` imports resolve, in the plugin, to a JSON module with the user-facing sections as plain text: ADR references, links, emphasis and backticks are stripped by `plainText`. `NOTES_LOADERS` in `src/whatsNew.ts` maps each language to its own lazy chunk (0.13 kB gzipped for one release; 0.9 kB on nightly with Unreleased), which the service worker precaches like the locale chunks. Nightly builds also include the English `Unreleased` block at the top of every language, because Unreleased is never translated.
- **Boot.** This runs in the `GuidonicaApp` constructor, after the intro decision, through the pure `bootAction(firstVisit, seen, current)`:
  - **New user** (the intro shows): store the current version silently. They never see notes.
  - **Returning user with no stored version** (from before versioning): treat them as having seen `1.0.0`.
  - **`seen < current`:** show `releasesToShow(notes, seen, current)`, meaning every release with `seen < v ≤ current`, newest first, Unreleased excluded. The version is saved when the dialog closes.
    - If the notes chunk fails to load (offline and not cached), nothing is shown and nothing is saved, so the notes appear on a later visit.
    - If the active language has no entry for those versions, the version is saved silently.
  - **`seen > current`** (a rollback): store silently.
  - Nightly runs the same logic on its own key, using the base release version.
- **Dialog.** `<dialog id="modal-whats-new">` reuses the About dialog's shell and classes. Its body is built with `createElement` and `textContent` only, never `innerHTML`, because the notes are data. Dates are formatted with `Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' })`. The footer links to the full changelog on GitHub.
- **About.** A new "Version" row:
  - Release: `2026.10.0`, linking to its GitHub Release.
  - Nightly: `Nightly · 2026.10.0+229f72e · 2026-10-05`, linking to the commit.
  - A "What's new" button opens the full history; on nightly, Unreleased comes first.
- **i18n.** New keys in all five locales: `metaVersion`, `whatsNewButton`, `nightly`, `whatsNewTitle`, `unreleased`, `fullChangelog` and `changeKinds`.

### 5. Release procedure

`scripts/release.mjs` (`pnpm release`, with `--dry-run` available) never commits. Its steps:

1. **Checks.** The tree is clean, the branch is `main`, and it is level with `origin/main` after a fetch.
2. **Version.** `nextVersion(today, tags)` computes it. `cutRelease` moves Unreleased under `## [version] - date`, leaves a fresh empty Unreleased and rewrites the compare links. It refuses to run if Unreleased is empty.
3. **Output.** It bumps `package.json` with a regex, so the file's formatting is kept, and prints the section.

The full protocol is in `AGENTS.md` §5. It runs only when the maintainer explicitly says "release":

1. Confirm the last `main` CI run is green.
2. Run `pnpm release`.
3. Translate the new section.
4. Run `pnpm typecheck && pnpm test && pnpm build:site`.
5. Commit `chore(release): <version>`.
6. Run `git tag -a v<version>` and `git push --atomic origin main v<version>`.

### 6. CI (amends ADR 0018)

The deploy workflow changes:

- **Checkout.** It checks out with `fetch-depth: 0` so the tags are present, and runs `pnpm build:site` before uploading `./site`.
- **Deploy.** Only `main` deploys. The `github-pages` environment's branch policy allows `main` alone, and an atomic push makes the tag visible to the `main` run, so the new release reaches the root in that run.
- **Tag push.** A pushed `v*` tag runs the tests, then a `release` job. That job alone holds `contents: write` (least privilege, ADR 0069) and runs `node scripts/release-notes.mjs "$TAG" > notes.md && gh release create "$TAG" --verify-tag --title "Guidonica <version>" --notes-file notes.md`.
- **Release notes.** `release-notes.mjs` prints the release's section, including Internal. It links each ADR number to its file at that tag and appends the compare link.

## Consequences

- **Pushing to `main` no longer changes guidonica.it**; it updates `/nightly/` only. Users get a release that was chosen on purpose, and the maintainer can try each commit live first.
- **Bigger CI runs.** Each run builds twice, and once a release tag exists it runs a second `pnpm install` in the worktree. That adds a few seconds.
- **A separate nightly install.** Nightly users keep their own settings, onboarding and offline cache. Nothing carries over from the release, by design.
- **Changelog discipline is part of every commit.** A missing entry is a review failure, and a malformed file is a test failure.
- **A translation is required for each release.** A release without a translated section fails `tests/changelog.test.ts`.
- **Main-bundle cost.** The main bundle grows by about 1.2 kB gzipped of JS (dialog code and English strings, 32.37 → 33.60 kB) and 0.1 kB of CSS. The notes themselves stay in lazy chunks.
- The run-guidonica driver seeds both namespaces and a far-future seen version, so the dialog never blocks automated clicks. `--seen <version>` simulates an upgrade.

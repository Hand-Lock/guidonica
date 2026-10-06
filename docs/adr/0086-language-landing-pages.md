# 0086. Language Landing Pages

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Guidonica speaks five languages (ADR [0059](0059-localization-and-national-note-naming.md)), but only after JavaScript
runs, and only at one URL. `index.html` is English: its title, description and Open Graph card
are English, and `og:locale:alternate` names four locales that have no page. A search for
"lettura a prima vista" or "Blattlesen üben" has nothing in Italian or German to match.
`public/sitemap.xml` lists a single URL.

## Decision

1. **One page per language, from the same build.** The `localePages()` Vite plugin
   (`vite.config.ts`, build only, `enforce: 'post'`) takes the final `index.html` in
   `generateBundle` and emits `it/index.html`, `fr/index.html`, `de/index.html` and
   `es/index.html` with `localePage()`. Each page is the same app. English stays at the root.
   No second entry point and no templating: the root shell is the only source, and each
   edit uses `replaceOnce`, so the build fails if an anchor moves.
2. **What `localePage()` changes**:
   - Relative `href`/`src` gain `../` (fragments, root-absolute paths and URLs with a scheme
     are left alone), so assets, icons and the manifest resolve from the subdirectory.
   - `<html lang="xx" data-page-lang="xx">`.
   - `<title>`, `og:title` and `twitter:title` are the locale's `docTitle`.
   - Description, `og:description`, `twitter:description` and both image alts come from
     `src/i18n/landing.ts`, which only the build and tests import, so these strings never
     ship in the locale chunks.
   - `canonical` and `og:url` are the page's own URL. `og:locale` is the page's locale, with
     the other four as alternates.
   - The About tagline (`aboutTaglineHtml`) is written in the page's language, as static
     text for crawlers that don't run scripts.
3. **hreflang in the source shell.** `index.html` lists all five languages and `x-default`
   (the root) as `<link rel="alternate" hreflang>`. Every page inherits that same set, so the
   annotations are reciprocal and self-referencing as Google requires. The nightly shell
   removes them along with the canonical link (`nightlyHtml`), and nightly language pages keep
   the "Guidonica Nightly" title and `noindex`.
4. **Language priority: stored, page, browser.** `detectLanguage()` and the inline head
   script read `data-page-lang` before the browser languages. A stored language still comes
   first, so a returning user keeps the language they use, and a new visitor, or a crawler
   with no storage, gets the page's language. Once settings are saved, that language is
   stored like any detected one.
5. **Service worker.**
   - Registration resolves `../sw.js` against the main chunk's URL (`assets/`), so a language
     page registers the root worker with the root scope instead of a missing `it/sw.js`.
   - The language pages are **not precached**. Each is a ~16 kB gzipped copy of the shell,
     so four of them would add ~62 kB to every install and every update, for a rarely used
     offline path. Instead, `serveShell`, offline, redirects any navigation other than the
     shell to the shell (`offlineRedirect`). The cached root shell cannot be served at
     `it/`, because its relative asset URLs would resolve under `it/`. The fragment survives
     the redirect, so an exercise link (ADR 0085) still loads.
   - `precacheList` skips every `*/index.html`. There is no runtime caching of navigations
     (ADR 0063).
6. **Sitemap**: all five landing URLs. `tests/localePages.test.ts` checks that every page has
   the same hreflang set, its own canonical in that set and in the sitemap, the translated
   head, the rewritten URLs, the nightly variant, and the language priority.

## Consequences

- Search engines can index the app once per language, with a title, description and preview
  card in that language, and the alternates tell them which page to show to whom.
- The root site serves the latest release tag (ADR 0078), so the pages and the new sitemap
  reach guidonica.it with the next release. Nightly has the pages at once, without
  canonical or hreflang.
- The dev server serves the root shell at `/it/` (Vite's SPA fallback), without
  `data-page-lang`. Use `pnpm build` and `vite preview` to try the pages.
- Offline, a language page opens the root shell in the stored language. A visitor who never
  saved settings gets the browser language instead.
- A new language needs its `LANDING` entry, an hreflang link, a sitemap URL and an
  `og:locale:alternate` in `index.html`. The compiler catches a missing entry and the tests a
  missing link or URL.

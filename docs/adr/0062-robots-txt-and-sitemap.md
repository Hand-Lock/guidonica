# 0062. robots.txt & sitemap.xml

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & lauseta

## Context & Problem Statement

Guidonica is live at the canonical `https://guidonica.it/` (ADR 0031, ADR 0061), but `public/`
had no `robots.txt` or `sitemap.xml`. A crawler asking for `/robots.txt` got the GitHub Pages 404,
which crawlers read as "allow everything". Nothing was broken, but the 404 showed up as noise in
crawler logs and Search Console, there was no stated crawl policy, and Search Console had no
sitemap to register.

With one page and a canonical link, a sitemap adds little today. It is still cheap, and it is
ready for the planned ear-training pages.

## Decision

Two static files in `public/`, copied as-is by Vite to the site root. No JS, no build step,
nothing added to the shipped bundle.

### `public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://guidonica.it/sitemap.xml
```

- Allow everything: the site has no private paths, and blocking `/assets/` would stop Google
  from rendering the page.
- `Sitemap:` must be an absolute URL, so it uses the canonical host, like `og:image` (ADR 0061).
- The `hand-lock.github.io/guidonica` mirror redirects to the custom domain because of the CNAME
  (ADR 0031), so it needs no separate handling.

### `public/sitemap.xml`

One `<url>` with only a `<loc>` of `https://guidonica.it/`.

- No `<lastmod>`: a hand-written date goes stale, and Google ignores it once it proves wrong.
- No `<changefreq>` or `<priority>`: Google ignores both.
- No `hreflang` alternates: all five languages share one URL and the language is chosen on the
  client (ADR 0059), so there are no per-language URLs to list.

### Test

`tests/shellPrivacyAndShare.test.ts` ("crawler files (ADR 0062)") checks that `robots.txt` has
`User-agent: *` and a `Sitemap:` line of exactly `https://guidonica.it/sitemap.xml`, that every
sitemap `<loc>` starts with `https://guidonica.it/`, and that the `rel="canonical"` href in
`index.html` is one of them.

## Consequences

- Crawlers get a real `robots.txt` instead of a 404, and Search Console / Bing Webmaster Tools
  can register `https://guidonica.it/sitemap.xml` (a manual step after deploy).
- **Adding a page:** add a `<url>` with an absolute `https://guidonica.it/…` `<loc>` to
  `public/sitemap.xml`, and give the page its own `rel="canonical"` pointing at that URL. The test
  enforces the host and keeps the sitemap and the shell's canonical link in sync.

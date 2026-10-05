# 0081. Release Announcements on Bluesky and Mastodon

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

A release (ADR 0078) already makes a GitHub Release and deploys guidonica.it. The Bluesky and
Mastodon accounts (ADR 0080) should announce each release too, with no extra work. The posts
must link a site that is already live, never leak the `Internal` notes, and never post twice
when a job is re-run. No new dependencies: no SDKs, no crossposting service.

## Decision

### The headline lives in CHANGELOG.md

A release may carry one `> ` blockquote right under its heading. Continuation `> ` lines are
joined:

```markdown
## [2026.11.0] - 2026-11-02

> Practise 5/4, and the metronome sounds warmer.

### Added
```

`parseChangelog` stores it on `ChangelogRelease.summary`. A `> ` line after a section heading is
still a stray line and throws. The agent writes the headline at release time, after
`pnpm release` and before the release commit (AGENTS.md §5). It is English only:

- `appNotes` maps fields explicitly, so the headline never reaches the in-app dialog, whose
  notes are translated.
- `releaseSection` returns every line, so the GitHub Release body opens with the quote.
- `cutRelease` carries a headline written under Unreleased over to the new version.
- `src/i18n/changelog/*.md` don't need one. The mirror test compares sections only.

### The thread: `scripts/announce.mjs`

`buildThread(md, version, { limit, count })` is pure and returns the posts:

1. **Root**: `Guidonica <version> is out. <headline>`, a blank line, `https://guidonica.it`, a
   blank line, `#SightReading #MusicEducation`. Without a headline it is just `… is out.`. The
   headline goes through `plainText`, so markdown and `(ADR NNNN)` disappear. A root over the
   limit **throws**.
2. **Replies**: each user-facing section as a label (`New:`, `Changed:`, `Fixed:`, `Removed:`,
   `Security:`) followed by `• ` + `plainText(item)` lines, in CHANGELOG order. Sections are
   packed greedily, separated by a blank line. A section that continues into the next reply
   repeats its label. A bullet that can't fit one post is split at word boundaries, the cut
   marked `…` on both sides. `Internal` has no label and is skipped.

Each network counts differently:

| | Limit | `count` |
|---|---|---|
| Bluesky | 300 | graphemes, `Intl.Segmenter` |
| Mastodon | 500 | code points (an upper bound for its grapheme count), each URL as 23 |

`blueskyFacets(text)` returns `app.bsky.richtext.facet#link` and `#tag` facets. Bluesky
renders neither from plain text, and facet ranges are UTF-8 **byte** offsets, so
`Buffer.byteLength` of the prefix gives `byteStart`. Trailing punctuation is kept out of links.

### Posting

`node scripts/announce.mjs v<version> [--dry-run]` builds both threads first, so a bad headline
fails before any network call. `--dry-run` prints them and posts nothing. Node 22's `fetch`
calls the APIs directly.

- **Bluesky**: `com.atproto.server.createSession` on `bsky.social` with the `guidonica.it`
  handle and `BLUESKY_APP_PASSWORD`. The PDS is the `#atproto_pds` service in the returned
  `didDoc`. `uploadBlob` sends `public/og-image.png` for the root's `app.bsky.embed.external`
  card, whose title and description are the `og:` tags in `index.html`. Each post is a
  `createRecord` of `app.bsky.feed.post` with `langs: ['en']`, facets and, for replies,
  `reply { root, parent }` from the previous strong refs.
- **Mastodon**: `POST /api/v1/statuses` on mastodon.social with `MASTODON_TOKEN`,
  `language: 'en'` and `Idempotency-Key: guidonica-v<version>-<i>`. The root is `public`; the
  replies are `unlisted` and chained with `in_reply_to_id`, so the thread doesn't flood public
  timelines. Mastodon builds the link card itself.
- **Re-run safety**: each network first looks for `Guidonica <version> is out` in its recent
  posts (`com.atproto.repo.listRecords`; the public `accounts/lookup` and
  `accounts/:id/statuses`) and skips if it's there. Reading is public on Mastodon, so the token
  needs only the `write:statuses` scope.
- The networks are independent: one failing doesn't stop the other, and the script exits
  non-zero at the end if either failed. It logs post URLs, never credentials.

### CI

`build-and-test` exposes `release_tag`: the `v20*` tag on `HEAD`, if any.
`fetch-depth: 0` already fetches the tags. A new `announce` job:

- runs only on a `main` push whose commit carries a release tag, after `deploy`
  (`needs: [build-and-test, deploy]`), so the link and its card are live when people open
  them;
- uses the `social` environment, restricted to `main`, which holds `BLUESKY_APP_PASSWORD` and
  `MASTODON_TOKEN`. No other job sees them;
- has `contents: read` only, and checks out without persisted credentials.

It runs in the main-push run rather than the tag run. Both runs share the `pages` concurrency
group, so only the main run knows when the deploy is done. `git push --atomic origin main
v<version>` guarantees the tag exists when main is checked out. The thread doesn't link the
GitHub Release, which the tag run may not have created yet.

### Setup (one time, by the owner)

1. Bluesky → Settings → Privacy and security → App passwords → `guidonica-ci`.
2. Mastodon → Preferences → Development → New application `guidonica-ci`, scope
   `write:statuses` only → access token.
3. `gh secret set BLUESKY_APP_PASSWORD --env social` and
   `gh secret set MASTODON_TOKEN --env social`.

## Consequences

- Every release commit is checked by `tests/announce.test.ts`, which builds the thread of every
  release in the real `CHANGELOG.md` for both limits. An over-long headline fails CI before
  deploy, so nothing goes out half-built.
- Nightly pushes never post: `announce` is skipped when the commit has no release tag.
- If the root posts and a reply fails, a re-run sees the root and skips that network; the
  missing replies have to be posted by hand. Partial failures are rare, and resuming would
  need per-post state.
- An app password and a single-scope token are revocable on their own, without touching the
  accounts' main credentials.
- Other languages, other networks (Instagram has no text-post API) and images per release are
  out of scope.

# 0082. Visible Bluesky and Mastodon Links

- **Status**: Accepted; amended by 0084, [0097](0097-stage-first-shell.md)
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

ADR [0080](0080-social-profiles-verification.md) added invisible `rel="me"` links for
@guidonica.it on Bluesky and @guidonica@mastodon.social, and held back visible links until the
profiles had content. They now do, and the owner wants users to find them. Instagram stays
deferred.

The links have to follow the same rules as the Ko-fi link (ADR [0074](0074-donations-ko-fi-link.md)):
no third-party request from the page (ADR [0060](0060-self-hosted-text-fonts-and-privacy-note.md)),
every string localized (ADR [0059](0059-localization-and-national-note-naming.md)), and every asset
relicensable (ADR [0067](0067-contribution-licensing-dco-and-trademark-policy.md)).

## Decision

### Placement

- **About dialog**: a "Follow" row in the meta grid, after Repository. Each link is the network's
  logo plus its name.
- **Footer** (`.footer-source`, between GitHub and Support): icon-only links. The footer is hidden
  at ≤960px, so phones reach the profiles through the About row.

"Bluesky" and "Mastodon" are proper nouns and need no text key, the same as the footer's
"GitHub". The row label (`metaFollow`) and the link titles (`blueskyTitle`, `mastodonTitle`) are
localized; the handles inside the titles stay verbatim. The footer links use the titles as their
`aria-label` too, since they have no text.

### Logos

- Two `<symbol>`s in the inline sprite in `index.html`: `#i-bluesky` and `#i-mastodon`,
  `viewBox="0 0 24 24"`, one `<path fill="currentColor">` each.
- Path data from **Simple Icons 16.34.0**, which is **CC0-1.0**, so the paths can ship under every
  Guidonica license. It was copied once and is not a dependency. The Mastodon logo is never taken
  from the AGPL Mastodon repository.
- Monochrome in `currentColor`, so the logos take the link's accent color in light and dark mode
  and sit with the glass UI. No brand blue or purple. Both networks' brand guidelines allow their
  logo to link to an official profile.
- `fill` sits on the path, so the stroke-style `.icon` rules don't apply. The logo is 14px in the
  About row and 15px in the footer (`.social-link .icon`).

### Plain links, no embed

Each link is an ordinary `<a target="_blank" rel="noopener noreferrer">` to the profile page. No
follow button, feed widget or embed: those would load scripts from another origin and contact the
network on every page view, for the reason given in ADR 0074 §2.

### Kept in sync with `rel="me"`

`tests/shellPrivacyAndShare.test.ts` checks that the set of visible `.social-link` hrefs equals
the set of `<link rel="me">` hrefs in `<head>`. Changing a handle in one place without the other
fails the test.

## Consequences

- No new request, dependency or token. The sprite grows by about 2 kB before gzip.
- Adding a network (Instagram, later) means a sprite symbol, a `rel="me"` link, a visible link in
  both places and a title key in every locale; the sync test enforces the first three together.
  *Amended by [0084](0084-instagram-link.md)*: Instagram is linked this way.
- If a network changes its logo, update the path from Simple Icons.

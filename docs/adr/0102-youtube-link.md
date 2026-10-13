# 0102. YouTube Link

- **Status**: Accepted
- **Date**: 2026-10-13
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0082](0082-visible-social-links.md), [0084](0084-instagram-link.md), [0101](0101-tiktok-link.md)

## Context & Problem Statement

Guidonica now has a YouTube channel, **@guidonica**. It is a Brand Account channel owned by a
Google account kept just for Guidonica, so the channel can change owner later. The 24-second
trailer is posted twice: the 16:9 cut is the channel trailer and the vertical cut is a Short whose
Related video leads to it. The daily solfège Shorts will follow. The owner wants the channel linked
wherever the other networks are. The URL-like handle `@guidonica.it` used on the other networks is
not allowed on YouTube, so this one handle is `@guidonica`.

## Decision

YouTube follows the ADR 0082, 0084 and 0101 recipe with no new mechanism:

- **Placement**: a fifth link after TikTok in three places: the ⋯ menu's social row and the follow
  tip (`#tip-social`), both icon-only `btn-pill-action` pills, and the About "Follow" row, logo
  plus "YouTube". "YouTube" is a proper noun and needs no text key; the title `youtubeTitle`
  ("Guidonica on YouTube (@guidonica)") is localized in every locale and doubles as the icon-only
  links' `aria-label`. The follow tip's body names YouTube in every locale.
- **Logo**: `#i-youtube` in the inline sprite, `viewBox="0 0 24 24"`, one
  `<path fill="currentColor">`, path data from **Simple Icons 16.34.0** (**CC0-1.0**), the same
  version as the other four. Monochrome in the link's accent color: the play triangle is a hole in
  the rounded rectangle, not a red and white pair.
- **Plain link, no embed**: an ordinary `<a target="_blank" rel="noopener noreferrer">` to
  `https://www.youtube.com/@guidonica`. No embedded player, subscribe button or `youtube-nocookie`
  frame, so the page makes no request to YouTube or Google (ADR 0074 §2).
- **`rel="me"`**: a `<link rel="me">` to the channel in `<head>`, kept for the rule the sync test in
  `tests/shellPrivacyAndShare.test.ts` enforces (every profile we link is a profile we claim, and
  the reverse). YouTube has no `rel="me"` verification. The claim is still true: the channel's
  first link, shown in its header, is guidonica.it.
- **The ⋯ menu row may wrap**: `.menu-social` gets `flex-wrap: wrap` and a 4 px row gap. Five pills
  plus Ko-fi fit one row from about 360 px in every locale. Below that, the German label
  "Unterstützen" (and, at 320 px, the French "Soutenir") pushed the Ko-fi button past the menu's
  edge. Now Ko-fi drops to its own line, still right-aligned by its `margin-left: auto`.

## Consequences

- CI doesn't post releases to YouTube (ADR [0081](0081-release-announcements-bluesky-mastodon.md)):
  community posts have no public API and the Data API uploads video only, so YouTube posts stay
  manual.
- Checked with the run-guidonica driver: at 375 px and on desktop the ⋯ row stays on one line in
  en, fr and de; at 320 px Ko-fi wraps inside the menu. The follow tip's six buttons fit at 320 px.
- The sprite grows by about 0.4 kB before gzip. No new request, dependency or token.

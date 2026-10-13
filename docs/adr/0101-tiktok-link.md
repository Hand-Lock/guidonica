# 0101. TikTok Link

- **Status**: Accepted; amended by [0102](0102-youtube-link.md)
- **Date**: 2026-10-13
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0082](0082-visible-social-links.md), [0084](0084-instagram-link.md)

## Context & Problem Statement

Guidonica now has a TikTok account, **@guidonica.it** (a Personal account, the product trailer
pinned). The owner wants it linked wherever Bluesky, Mastodon and Instagram are. Since ADR 0084 the
shell has changed: ADR [0097](0097-stage-first-shell.md) replaced the footer with the ⋯ menu, and
ADR [0087](0087-rotating-tips.md) added a follow tip with the social links.

## Decision

TikTok follows the ADR 0082 and 0084 recipe with no new mechanism:

- **Placement**: a fourth link after Instagram in three places: the ⋯ menu's social row and the
  follow tip (`#tip-social`), both icon-only `btn-pill-action` pills, and the About "Follow" row,
  logo plus "TikTok". "TikTok" is a proper noun and needs no text key; the title `tiktokTitle`
  ("Guidonica on TikTok (@guidonica.it)") is localized in every locale and doubles as the
  icon-only links' `aria-label`. The follow tip's body names TikTok in every locale.
- **Logo**: `#i-tiktok` in the inline sprite, `viewBox="0 0 24 24"`, one
  `<path fill="currentColor">`, path data from **Simple Icons 16.34.0** (**CC0-1.0**), the same
  version as the other three. Monochrome in the link's accent color, like the others: no cyan and
  red offset layers, no brand colors.
- **Plain link, no embed**: an ordinary `<a target="_blank" rel="noopener noreferrer">` to
  `https://www.tiktok.com/@guidonica.it`. No embed, follow button or creator widget, so the page
  makes no request to TikTok or ByteDance (ADR 0074 §2).
- **`rel="me"`**: a `<link rel="me">` to the profile in `<head>`, kept for the rule the sync test in
  `tests/shellPrivacyAndShare.test.ts` enforces (every profile we link is a profile we claim, and
  the reverse). TikTok has no `rel="me"` verification. The claim is still true: the profile's bio
  names guidonica.it. TikTok unlocks the clickable website field only at 1,000 followers.

## Consequences

- CI doesn't post releases to TikTok (ADR [0081](0081-release-announcements-bluesky-mastodon.md)):
  its Content Posting API needs an audited app and takes video only, so TikTok posts stay manual.
- The in-app browser landscape tip (ADR [0083](0083-in-app-browser-landscape-tip.md)) still names
  Instagram, Facebook and Threads only. TikTok's in-app browser is left out until its rotation
  behaviour is checked on a device.
- The ⋯ menu's social row holds four pills plus Ko-fi and still fits a 375 px phone.
  *Amended by [0102](0102-youtube-link.md)*: a fifth pill, YouTube, follows TikTok; below ~360 px Ko-fi wraps to its own line.
- The sprite grows by about 0.8 kB before gzip. No new request, dependency or token.

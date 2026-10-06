# 0084. Instagram Link

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0080](0080-social-profiles-verification.md), [0082](0082-visible-social-links.md)

## Context & Problem Statement

ADRs [0080](0080-social-profiles-verification.md) and [0082](0082-visible-social-links.md) linked
the Bluesky and Mastodon profiles and held back Instagram @guidonica.it because the profile was
empty. It now has the product trailer, and the owner wants it linked like the other two.

## Decision

Instagram follows the ADR 0082 recipe with no new mechanism:

- **Placement**: a third link in the About "Follow" row (logo plus "Instagram") and a third
  icon-only link in the footer, after Mastodon. "Instagram" is a proper noun and needs no text key;
  the title `instagramTitle` ("Guidonica on Instagram (@guidonica.it)") is localized in every
  locale and doubles as the footer link's `aria-label`.
- **Logo**: `#i-instagram` in the inline sprite, `viewBox="0 0 24 24"`, one
  `<path fill="currentColor">`, path data from **Simple Icons 16.34.0** (**CC0-1.0**), the same
  version as the other two. Monochrome in the link's accent color: no gradient, no brand colors.
  Instagram's brand guidelines allow the glyph to link to an official account.
- **Plain link, no embed**: an ordinary `<a target="_blank" rel="noopener noreferrer">` to
  `https://www.instagram.com/guidonica.it/`. No embed, follow button or feed widget, so the page
  makes no request to Instagram or Meta (ADR 0074 §2).
- **`rel="me"`**: a `<link rel="me">` to the profile in `<head>`. The claim is true, since the
  Instagram profile links back to guidonica.it.

## Consequences

- Instagram has no `rel="me"` verification of its own. The head link only keeps the rule the sync
  test in `tests/shellPrivacyAndShare.test.ts` enforces: every profile we link is a profile we
  claim, and the reverse. A Mastodon profile field pointing to Instagram will not turn green.
- CI still doesn't post releases to Instagram (ADR [0081](0081-release-announcements-bluesky-mastodon.md)):
  it has no text-post API, so Instagram posts stay manual.
- The sprite grows by about 2.2 kB before gzip. No new request, dependency or token.

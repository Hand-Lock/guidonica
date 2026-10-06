# 0080. Social Profiles: rel="me" Verification and Bluesky Domain Handle

- **Status**: Accepted; amended by 0082
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Guidonica now has accounts on Bluesky and Mastodon, next to Instagram, and uses the ADR 0079
banners as their headers. Anyone can register a "Guidonica" account on either network, so each
profile needs a link back to the domain that proves it's the official one. Neither check
should cost the app anything at runtime.

## Decision

### Bluesky: the domain is the handle

The account's handle is **@guidonica.it**, not `guidonica.bsky.social`. Bluesky proves the
handle with a DNS TXT record:

```
_atproto.guidonica.it.  TXT  "did=did:plc:jf2dbm2sk4oyn345gegh3dkj"
```

The record lives at the registrar (Register.it today), not in the repo. When the domain moves to
another DNS host, this record must be recreated **before** the nameserver switch. Otherwise the
handle falls back to an invalid state until the new zone has it.

### Mastodon: `rel="me"` links

Mastodon marks a profile field green when the linked page links back with `rel="me"`. Two
links do that:

- **Website** (`https://guidonica.it`): `index.html` carries
  `<link rel="me" href="https://mastodon.social/@guidonica" />` in `<head>`.
- **Source** (`https://github.com/Hand-Lock/guidonica`): the Hand-Lock GitHub profile lists the
  Mastodon account under *Social accounts*, and GitHub renders it with `rel="me"`.

`index.html` also has `<link rel="me" href="https://bsky.app/profile/guidonica.it" />`. Bluesky
doesn't read it, because the DNS record already proves the handle. It's there for IndieWeb
tools and costs nothing.

`<link>` elements are invisible and carry no user-facing text, so they need no i18n keys. The
browser never fetches a `rel="me"` URL, so the ADR 0060 no-third-party-requests test in
`tests/shellPrivacyAndShare.test.ts` exempts `rel="me"` the same way it exempts `rel="canonical"`.

### Server and handles

- Bluesky: `@guidonica.it`, hosted on Bluesky's default PDS.
- Mastodon: `@guidonica@mastodon.social`. It's the largest general server with open sign-up.
  A topic server (Fosstodon, a music instance) has a smaller audience and stricter rules, and
  moving later keeps followers but not posts.
- No Bridgy Fed: native accounts on both networks would otherwise appear twice.

## Consequences

- Mastodon re-checks `rel="me"` only when the profile is saved. Nightly builds don't serve the
  root, so the Website field turns green only after the next release deploys `index.html` to
  `guidonica.it`. Then the profile has to be saved again.
- Changing a handle or a server means changing these links.
- Visible links to the profiles (About dialog, README) are deferred until the profiles have
  content, as with Instagram.
  *Amended by [0082](0082-visible-social-links.md)*: the About dialog, the footer and the README
  now link to Bluesky and Mastodon. Instagram is still deferred.
  *Amended by [0084](0084-instagram-link.md)*: Instagram is linked too.

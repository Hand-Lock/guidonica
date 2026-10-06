# 0088. Pre-release Audit 2026-10-06: Second History Rewrite, Privacy Policy

- **Status**: Accepted (amends [0060](0060-self-hosted-text-fonts-and-privacy-note.md), [0068](0068-project-email-guidonica-it-migadu.md), [0069](0069-security-privacy-audit.md) and [0074](0074-donations-ko-fi-link.md))
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

[ADR 0069](0069-security-privacy-audit.md) asks for the audit to be re-run before every major release. Before the next release, it was repeated over:

- all 225 tracked files and all 119 commits;
- the GitHub settings (keys, forks, rulesets, environments, security features);
- the dependencies (`pnpm audit`) and their licences;
- the local build in `site/`;
- the guidonica.it DNS zone.

**Clean, no action needed.**

- Every commit uses the noreply identity. There are no forks and no deploy keys.
- No secrets appear in the tree or in history. CI secrets live only in the `social` environment ([ADR 0081](0081-release-announcements-bluesky-mastodon.md)).
- CI keeps workflow-level `contents: read`, and every action is pinned to a SHA. The DCO ruleset blocks force-push and deletion.
- Secret scanning, push protection and private vulnerability reporting are on. The Pages domain is verified and HTTPS is enforced.
- DNS has SPF `-all`, DKIM, DMARC with `rua`, and CAA (`letsencrypt.org` plus `iodef`). `security.txt` expires 2027-10-01.
- The app makes no outbound requests, and `localStorage` holds settings only. Images and SVGs carry no metadata, and the build has no source maps or local paths.
- `cdn.jsdelivr.net` appears in the VexFlow chunk only as the dormant `Font.HOST_URL` default. The app calls `setFonts` with its self-hosted subset and never calls `loadFonts`, so the URL is never requested ([ADR 0058](0058-music-font-audit-and-bravura-subset.md)).
- All dependencies are permissive (MIT, BSD, ISC, Apache-2.0, OFL). Bravura's Reserved Font Name is respected by the "Guidonica Notation" rename. Alegreya, Alegreya Sans and Ubuntu Mono ship with their OFL and UFL texts, and the brand icons come from Simple Icons (CC0).
- ™ is used, never ®. The AGPL §13 source links and the AI disclosure ([ADR 0075](0075-ai-assistance-disclosure.md)) are present.

## Findings

1. **Privacy (medium).** ADR 0074 §7 named the private Migadu login mailbox with its Stripe tag, which ADR 0068 §2–3 says is never published. The same line listed Stripe Radar and Stripe Tax settings, which are needless account detail. The line came in with the Ko-fi commit on 2026-10-05, inside the released tag `v2026.10.0`, with 17 commits after it.
2. **Dependency advisory (high per `pnpm audit`, dev-only).** `source-map-js@1.2.1` (GHSA-68fv-2mgg-jv7q, an event-loop DoS) came in through vite → postcss. It never reaches the shipped app.
3. **Legal (GDPR Art. 13).** The site had no privacy policy, although its operator is identified and based in Italy, and GitHub Pages logs visitors' IP addresses. The About line "nothing leaves your device" was also too broad, because every page request reaches GitHub.
4. **Not acted on.** 28 source files lack the SPDX/AGPL header that 13 others carry. It is cosmetic: `LICENSE` covers the whole repository.

## Decisions

### 1. Second history rewrite (finding 1)

An offline mirror backup was made first (`git clone --mirror`, never pushed). Then `git filter-repo --replace-text --replace-message` ran with two replacements:

- the tagged login address → "a private per-service address (ADR 0068 §3)";
- "; Stripe Radar on Lite, Stripe Tax off." → ".".

Commit messages never contained either string. Unlike ADR 0069, the rewrite starts at the Ko-fi commit, so every earlier commit keeps its SHA and `v1.0.0` is unchanged. Only that one line of ADR 0074 differs from the backup's tree. The new SHAs:

| Ref | Before | After |
|---|---|---|
| Ko-fi commit (ADR 0074) | `b37109c` | `d1d7ea2` |
| `v2026.10.0` commit | `8e96887` | `443cf4b` |
| `v2026.10.0` tag object | `9ab9cc7` | `49444c6` |
| `main` before this ADR | `4a86ccf` | `7c3dcff` |

`main` and `v2026.10.0` were force-pushed through the owner bypass on the ruleset. The GitHub Release stays attached to the tag. The tag push re-runs the `release` job, which fails because the release already exists. That failure is expected and harmless. A later commit also dropped the code formatting around the replacement text.

The changelog quotes none of the rewritten SHAs. `229f72e` in ADR 0078 is only a format example.

### 2. Dependency bump (finding 2)

`pnpm update source-map-js` moved the lockfile to 1.2.2. `pnpm audit` now reports no known vulnerabilities, so no `pnpm.overrides` entry was needed.

### 3. Privacy policy (finding 3)

[`PRIVACY.md`](../../PRIVACY.md) holds an English policy, then an Italian "Informativa sulla privacy" in the same file, so one URL serves every locale. It covers:

- the controller (A. C. Lo Cascio, `legal@`);
- the app, which collects nothing;
- the `localStorage` items and the service worker cache, which are strictly necessary storage (ePrivacy Art. 5(3), Codice privacy art. 122);
- exercise links, whose `#` fragment browsers never send;
- GitHub Pages hosting (IP logs, Art. 6(1)(f), the EU-U.S. Data Privacy Framework);
- external links and Ko-fi tips (Art. 6(1)(c) for accounting records);
- email, hosted by Migadu-Mail GmbH (Switzerland, which has an EU adequacy decision) on servers in the EU. The audit plan had placed the servers in Switzerland, but Migadu's own pages put its data centres in France.
- data subject rights (Arts. 15–22) and the Garante;
- no automated decisions, and changes tracked in git.

The app links to it in two places:

- **About.** The Privacy row's `privacyNote` became `privacyHtml` (`data-i18n-html`): "No accounts, no cookies, no tracking: your settings stay on your device." followed by a policy link, with `${LINK}` attributes as in `trademarkHtml`. The Italian link jumps to `#informativa-sulla-privacy`. `tests/i18n.test.ts` now expects five `data-i18n-html` blocks.
- **Footer.** A "Privacy" link (`privacyLink`) follows the GitHub link.

`README.md` points to the policy from its Contact section.

### 4. Guards against a repeat

`tests/shellPrivacyAndShare.test.ts` reads every tracked text file from `git ls-files` and fails when:

- a guidonica.it address uses any local part other than `hello`, `legal`, `security`, `postmaster`, `abuse` or `admin`;
- any plus-addressed guidonica.it address appears.

A test run with an injected address was checked to fail both cases. `AGENTS.md` §3 gains the matching rule.

## Owner actions outside the repository

- **Rotate the login.** Rename the Migadu login mailbox to a new private address, then update the Stripe and Ko-fi login emails. Copies made before the rewrite may already have been scraped, and rotation makes the leaked address useless.
- **GitHub Support.** Ask them to purge cached views and unreferenced objects of the pre-rewrite commits from the Ko-fi commit onward.
- **Other clones.** Re-clone, or run `git fetch origin && git reset --hard origin/main`.
- **Unchanged from ADRs 0068 and 0069.** Move DMARC to `p=reject` after two clean weeks of reports. Enable DNSSEC after the registrar migration.

## Consequences

**Positive**

- No private address remains in the tree or in reachable history, and CI fails if one comes back.
- Visitors get a GDPR Art. 13 notice in English and Italian, and the About line no longer overstates what stays local.
- The dev toolchain has no known advisories.

**Negative / trade-offs**

- The 17 commits from the Ko-fi commit onward have new SHAs. Older clones must be reset.
- The policy states facts about third parties (GitHub, Ko-fi, Migadu). It must be re-checked when a host or a payment path changes, and its "Last updated" date bumped in the same commit.
- The policy exists only in English and Italian. French, German and Spanish users get the English text.

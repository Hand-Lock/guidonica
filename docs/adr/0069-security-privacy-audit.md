# 0069. Security & Privacy Audit: History Rewrite, CI Least Privilege & Repository Hardening

- **Status**: Accepted (amends [0018](0018-github-actions-pages-continuous-deployment.md), [0067](0067-contribution-licensing-dco-and-trademark-policy.md) and [0068](0068-project-email-guidonica-it-migadu.md))
- **Date**: 2026-10-04
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

The repository is public, and since [ADR 0067](0067-contribution-licensing-dco-and-trademark-policy.md) and [ADR 0068](0068-project-email-guidonica-it-migadu.md) it also documents the domain, the mail setup and the legal owner. Before the project is promoted, everything an outsider can see was audited:

- every tracked file, and all 96 commits (content, author and committer identities, trailers, deleted paths);
- the production build in `dist/`, the dependencies (`pnpm audit`) and the CI workflows;
- the GitHub repository settings (keys, rulesets, environments, security features);
- the live site and the guidonica.it DNS zone.

**Clean, no action needed.** No credentials, tokens, keys, `.env` files or private paths appear anywhere in history. The private mail login address and the plus-address tags (ADR 0068 §2–3) never appear. `pnpm audit` reports no vulnerabilities. The PNG and SVG files carry no metadata, and `dist/` ships no source maps. In the app, `innerHTML` only receives bundled locale strings, `localStorage` is validated field by field ([`src/storage.ts`](../../src/storage.ts)), the service worker only answers same-origin GETs from its precache ([ADR 0063](0063-offline-service-worker.md)), and external links use `rel="noopener noreferrer"`. The site enforces HTTPS, the `www` and `http` redirects are correct, and `security.txt` is live. The zone has SPF `-all`, DKIM, no wildcard and no autoconfig records. The Actions default token is read-only, the repository has no secrets, and the `github-pages` environment only accepts `main`.

## Findings (most severe first)

1. **A personal email address in public history.** 55 commits from 14–20 September 2026 (author names `HandLock_` and `Hand-Lock`) carried a personal address instead of the GitHub noreply address that later commits use.
2. **A stale read-write deploy key** from another machine, last used 2026-09-14. It no longer had a purpose, but could still push.
3. **The custom domain is not verified on the GitHub account.** If Pages were ever disabled, another account could claim guidonica.it for its own Pages site.
4. **GitHub security features off**: secret scanning, push protection, Dependabot alerts and private vulnerability reporting.
5. **DNS**: DMARC had no `rua`, so ADR 0068's "two weeks of clean sending, then `p=reject`" could not be checked. There was no CAA record and no DNSSEC.
6. **ADR 0068 over-shared**: it named the mail plan and its exact daily limits, which tells anyone how many messages it takes to flood `security@`.
7. **The local account name** of the development machine appeared in 45 ADR author lines and in two early `package.json` fields.
8. **CI privilege**: `pages: write` and `id-token: write` were granted at workflow level, so the pull-request build job had them too. Actions were pinned by mutable tag, including the third-party `pnpm/action-setup`. The DCO ruleset did not block force-pushes or deletion of `main`.

**Accepted as-is.** The owner's real name is intentional: it identifies the copyright and trademark owner ([`TRADEMARKS.md`](../../TRADEMARKS.md)). The `ssh-add --apple-load-keychain` notes in `AGENTS.md` name no secret. There is no Content Security Policy. The app has no untrusted input, so a CSP is defence in depth rather than a fix; it can come later as a build-time `<meta>` with a hash of the one inline script.

## Decisions

### 1. History rewrite (findings 1 and 7)

The whole history was rewritten with [`git filter-repo`](https://github.com/newren/git-filter-repo):

- **Identities** (`--mailmap`): the personal address becomes `54068030+Hand-Lock@users.noreply.github.com`, and both early author names become `Hand-Lock`. Every commit now has the same noreply identity.
- **Content** (`--replace-text`): the account name in ADR author lines becomes `A. C. Lo Cascio`, the owner's name. The two early `package.json` fields become `Hand-Lock` (the `author` field and the repository URL). No commit message contained either string.
- **Tags**: `v1.0.0` was rewritten with the history and force-pushed; its GitHub release still points at it.

The first commit changed, so **every commit SHA changed**, including those before this ADR. A SHA quoted in an older issue, ADR or chat no longer resolves on GitHub; look the commit up by its message and date instead. The trees are identical to the originals except for the replaced strings. A mirror backup of the pre-rewrite history is kept offline and is never pushed.

The rewrite removes the strings from the repository, not from copies made before it (clones, forks, caches). The repository had no forks at the time. GitHub Support can be asked to purge cached views of the old commits.

### 2. CI least privilege and pinned actions (finding 8)

`.github/workflows/deploy.yml` now grants `contents: read` at workflow level. Only the `deploy` job adds `pages: write` and `id-token: write`, so pull-request builds can neither publish nor mint a Pages OIDC token. Every action is pinned to a full commit SHA, with the version in a comment:

| Action | Version | Commit |
|---|---|---|
| `actions/checkout` (both workflows) | v4.4.0 | `11d5960a326750d5838078e36cf38b85af677262` |
| `pnpm/action-setup` | v4.3.0 | `b906affcce14559ad1aafd4ab0e942779e9f58b1` |
| `actions/setup-node` | v4.4.0 | `49933ea5288caeca8642d1e84afbd3f7d6820020` |
| `actions/upload-pages-artifact` | v3.0.1 | `56afc609e74202658d3ffba0e8f6dda462b719fa` |
| `actions/deploy-pages` | v4.0.5 | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` |

Each is the commit its major tag pointed to on 2026-10-04, so behaviour is unchanged. `upload-pages-artifact` stays on v3, because v4 drops hidden files such as `.well-known/` (ADR 0068, maintenance duties). A tag can be moved to malicious code; a commit SHA cannot.

### 3. Repository settings (findings 2, 4 and 8)

- The stale deploy key was deleted. Pushes use the owner's account SSH key.
- Secret scanning, push protection, Dependabot alerts and private vulnerability reporting are enabled.
- The DCO ruleset (ADR 0067) also blocks force-pushes (`non_fast_forward`) and deletion of `main`, with the same owner bypass. The bypass is what allowed the force-push in §1.

### 4. Second private reporting channel

`SECURITY.md` now offers GitHub's private vulnerability reporting next to `security@`, so a mail outage or a flood of the inbox cannot block a report.

### 5. ADR 0068 trimmed (findings 5 and 6)

ADR 0068 no longer names the mail plan or its limits. It only says the plan has daily limits that suit a contact inbox, not bulk mail. Its DMARC section now includes the `rua` reporting address.

### 6. Owner actions outside the repository (findings 1, 3 and 5)

These live in web consoles that only the owner can reach:

- **GitHub → Settings → Emails**: turn on "Keep my email addresses private" and "Block command line pushes that expose my email", so the personal address cannot come back in a new commit.
- **GitHub → Settings → Pages**: verify `guidonica.it`, with the `_github-pages-challenge-Hand-Lock` TXT record at Register.it.
- **Register.it DNS**:
  - add `CAA 0 issue "letsencrypt.org"` (GitHub Pages certificates) and `CAA 0 iodef "mailto:security@guidonica.it"`;
  - set `_dmarc` to `v=DMARC1; p=quarantine; rua=mailto:postmaster@guidonica.it`, read the reports, then move to `p=reject`;
  - enable DNSSEC if the registrar offers it for `.it`.
- **Accounts**: two-factor authentication with offline recovery codes on the registrar, the mail host, GitHub and Instagram, and a transfer lock on the domain. The registrar account controls the mail, and so every password reset.

## Consequences

**Positive**

- Public history now shows only the noreply identity and the owner's name.
- No leftover credential can push to the repository, and pull-request code cannot deploy.
- A moved tag in a third-party action can no longer change what CI runs.
- Leaked secrets are blocked at push time, and researchers have two private channels.

**Negative / trade-offs**

- All commit SHAs changed (§1). Any existing clone must be re-cloned, or reset with `git fetch origin && git reset --hard origin/main`.
- Pinned actions do not update themselves. Dependabot alerts cover npm dependencies, not actions, so bumping the pins is a manual task.
- The owner bypass on the ruleset still allows force-pushes from the owner's account, which is why 2FA on that account matters.

## Maintenance duties

- **Bump the action pins** when a new major or security release ships: resolve the tag with `gh api repos/<owner>/<action>/git/ref/tags/<tag>` (dereference an annotated tag with `git/tags/<sha>`), then update the SHA and the version comment together.
- **Never commit with a personal address.** The noreply address is the only commit identity, and the GitHub email setting in §6 enforces it.
- **Re-run this audit** before every major release, or at least yearly: grep history for addresses and secrets, check `gh api repos/Hand-Lock/guidonica/keys`, the rulesets and `security_and_analysis`, and `dig` the zone.
- **Renew `security.txt`** and **tighten DMARC** as ADR 0068 describes.

# 0068. Project Email on guidonica.it (Migadu), Contact Addresses & security.txt

- **Status**: Accepted (amends [0031](0031-custom-domain-guidonica-it.md) and [0067](0067-contribution-licensing-dco-and-trademark-policy.md))
- **Date**: 2026-10-04
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Until now the project had no email. [ADR 0031](0031-custom-domain-guidonica-it.md) pruned every mail record from the guidonica.it zone, and [ADR 0067](0067-contribution-licensing-dco-and-trademark-policy.md) §5 routed trademark and commercial-licensing requests through public GitHub issues ("No email address is published"). That left three gaps:

- **Private requests had to be public.** A company asking about a commercial engine license, or a takedown notice, had to post in the open issue tracker.
- **Vulnerabilities had no private channel.** The only route for a security report was a public issue, which discloses it before a fix ships.
- **Accounts needed an address.** Store developer accounts, social profiles and similar services need a project address that is not a personal one.

## Decisions

### 1. Zone records added to the ADR 0031 zone

Mail is hosted by Migadu (Micro plan). These records were added at Register.it:

| Type | Name | Value |
|---|---|---|
| `MX` | `@` | `aspmx1.migadu.com.` (priority 10), `aspmx2.migadu.com.` (priority 20) |
| `TXT` | `@` | `v=spf1 include:spf.migadu.com -all` |
| `TXT` | `@` | `hosted-email-verify=…` (Migadu domain ownership) |
| `CNAME` | `key1._domainkey`, `key2._domainkey`, `key3._domainkey` | `keyN.guidonica.it._domainkey.migadu.com.` |
| `TXT` | `_dmarc` | `v=DMARC1; p=quarantine;` |

The four GitHub Pages `A` records and the `www` CNAME are unchanged. The SPF policy is `-all` (hard fail), because Migadu is the only sender. The DKIM keys are CNAMEs, so Migadu can rotate them without a zone change.

### 2. One private login mailbox; public addresses are aliases

Migadu holds **one mailbox**. Its address is a private login address: it is used to sign in to Migadu and to the mail client, and it is never published, in this repository or anywhere else. Every public or role address is an **alias** that delivers to that mailbox:

| Address | Kind | Purpose |
|---|---|---|
| `hello@` | alias + send-only identity | Teachers, schools, press, general questions |
| `legal@` | alias + send-only identity | Trademark permissions, commercial licensing, takedowns, privacy |
| `security@` | alias + send-only identity | Vulnerability reports |
| `postmaster@`, `abuse@` | alias | RFC 2142 / RFC 5321 role addresses |
| `admin@` | alias | Migadu's default `admin@` mailbox, replaced by an alias |

`hello`, `legal` and `security` are also Migadu **identities** with receiving turned off, so replies go out from the address the mail was sent to (and are DKIM-signed with `d=guidonica.it`), while all incoming mail still lands in the one mailbox.

**Why split login and public addresses.** A published address attracts spam, phishing and credential-stuffing attempts. Keeping the login address out of public view means an attacker who targets the published addresses never learns which address the account signs in with. A public address can also be retired or replaced (it is only an alias) without touching the account.

### 3. Per-service plus-addressing

Service signups (social profiles, store developer accounts and the like) use plus-addressing on the private mailbox, one tag per service. Mail to a tagged address shows which service it came from, and if a tag starts receiving spam, that service leaked or sold it. The tags are private and never appear in this repository.

### 4. Nothing that accepts arbitrary addresses

There is **no catch-all**, **no wildcard MX** and **no autoconfig, autodiscover or SRV records**. Mail to an address that does not exist is rejected at SMTP time, so dictionary spam does not reach the mailbox and nobody can invent an address that appears to belong to the project.

### 5. DMARC: quarantine, then reject

DMARC starts at `p=quarantine`. After about two weeks of clean sending (no legitimate mail failing SPF or DKIM), it is tightened to `p=reject`, so receivers drop mail that spoofs guidonica.it instead of filing it as spam.

### 6. Published addresses

Only `hello@`, `legal@` and `security@` are published. They appear in:

- `README.md`: a `## Contact` section (all three), and `### Dual Licensing` (`legal@`, subject "Commercial licensing");
- `TRADEMARKS.md` → Contact (`legal@`, subject "Trademark request" or "Commercial licensing"); the About dialog links there, so no locale strings change;
- `SECURITY.md` and `/.well-known/security.txt` (`security@`).

Bugs and feature requests still go to GitHub issues. This amends ADR 0067 §5: trademark and licensing requests now go to `legal@`.

### 7. security.txt and SECURITY.md

`public/.well-known/security.txt` follows [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116):

```text
Contact: mailto:security@guidonica.it
Expires: 2027-10-01T00:00:00.000Z
Preferred-Languages: en, it
Canonical: https://guidonica.it/.well-known/security.txt
Policy: https://github.com/Hand-Lock/guidonica/blob/main/SECURITY.md
```

Vite copies `public/` verbatim, so it ships at `dist/.well-known/security.txt`. It is **never precached** by the service worker ([ADR 0063](0063-offline-service-worker.md)): `precacheList` in `vite.config.ts` drops every top-level public name that starts with a dot, and `tests/serviceWorker.test.ts` now passes `.well-known` in its fixture and asserts that it is excluded. No config change was needed.

`SECURITY.md` (GitHub shows it in the repository's Security tab) asks for private reports to `security@`, lists what to include, sets the scope (the app at guidonica.it, its hand-lock.github.io/guidonica mirror, and this repository), supports only the latest deploy of `main`, and promises a best-effort acknowledgement with credit if wanted.

## Consequences

**Positive**

- Licensing, trademark, takedown and privacy requests can be made privately.
- Security researchers have a private channel that tools and scanners find at the standard path.
- Replies come from the project domain and pass SPF, DKIM (`d=guidonica.it`) and DMARC (verified 2026-10-04 with a reply sent as `hello@`).
- The login address stays private, and every role address can be changed without touching the account.

**Negative / trade-offs**

- Migadu Micro is a paid plan with daily limits: 20 outgoing and 200 incoming messages. That is ample for a contact inbox, but not for newsletters or bulk mail.
- Mail is one more service to keep alive: the plan must be renewed, and the zone records must survive any future DNS change.
- `security.txt` has an expiry date, which creates a recurring task (below).

## Maintenance duties

- **Renew `Expires`** in `public/.well-known/security.txt` before 2027-10-01, keeping it less than a year ahead (RFC 9116 §2.5.5 recommends that).
- **Tighten DMARC** from `p=quarantine` to `p=reject` after about two weeks of clean sending, at Register.it (`_dmarc` TXT).
- **`actions/upload-pages-artifact`:** `.github/workflows/deploy.yml` uses `@v3`, which includes hidden files such as `.well-known/`. Version 4 excludes them by default; if the workflow moves to v4, add `include-hidden-files: true`, or `security.txt` silently disappears from the site.
- **Migadu limits:** 20 outgoing and 200 incoming messages a day on Micro. Upgrade the plan if the volume grows.
- **New public addresses** follow §2: an alias (and an identity if it needs to send), never a new mailbox, and never the login address.

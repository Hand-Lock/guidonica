# 0074. Donations: a Plain Ko-fi Link

- **Status**: Accepted; amended by [0088](0088-pre-release-audit-2026-10-06.md)
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Guidonica will earn money from paid store builds and Guidonica Studio. The owner also wants web users to be able to leave a tip. The donation path has to respect the project's existing rules:

- the app is client-only and loads nothing from a third-party origin (AGENTS.md, [0060](0060-self-hosted-text-fonts-and-privacy-note.md));
- the About dialog promises "No accounts, no cookies, no tracking: nothing leaves your device";
- the app works offline ([0063](0063-offline-service-worker.md));
- every string is localized ([0059](0059-localization-and-national-note-naming.md));
- the App Store and Play Store builds must not link to outside payments.

## Decision & Implementation

### 1. Platform: Ko-fi

Comparison as of 2026-10:

| Platform | Platform fee | Donor needs an account? | One-off / monthly | Fit |
|---|---|---|---|---|
| **Ko-fi** | 0% on tips (5% on shop and memberships, which are off) | No (card, Apple/Google Pay via Stripe, or PayPal) | Both | Best fit for musicians, teachers and students |
| GitHub Sponsors | 0% from personal accounts | **Yes, a GitHub account** | Both | Developers only; a later secondary channel |
| Liberapay | 0% (nonprofit) | Yes; one-off "not properly supported" | Recurring | Good ethos, poor UX for this audience |
| Buy Me a Coffee | 5% | No | Both | Ko-fi does the same for 0% |
| Patreon / Open Collective | 8–12% / ~10% host fee | Yes | Recurring | Too heavy for tips |
| Own Stripe Payment Link | Stripe only | No | Both | Receipts, refunds and disputes all fall on the owner |

Every option still pays the processor fee (Stripe or PayPal). Ko-fi pays tips straight into the owner's own Stripe account and takes no cut. Most users aren't developers, so the tip must not require an account.

### 2. Link only, no widget

Each donate element is a plain outbound anchor:

```html
<a class="donate" href="https://ko-fi.com/guidonica" target="_blank" rel="noopener noreferrer">…</a>
```

There is no Ko-fi widget, button script, iframe, hotlinked image or Ko-fi logo. A widget would load `ko-fi.com` on every visit and could set cookies, which would break the privacy note and the no-third-party-origin rule. With a plain link nothing contacts Ko-fi until the user clicks, and then it opens in a new tab, so the privacy note stays true. `noreferrer` means Ko-fi doesn't receive the page URL either. The service worker never sees the request, because it is a cross-origin navigation in a new tab.

The icon is a new `#i-heart` symbol in the existing UI icon grammar: 16-unit viewBox, `currentColor` stroke 1.75, round caps and joins. It is not Ko-fi's cup logo, which is their trademark.

### 3. Placement

| Where | Element | Notes |
|---|---|---|
| Footer `.footer-source` | `·` separator + `<a class="donate">Support</a>` after GitHub | Picks up the `.footer-source a` style. The footer is hidden at ≤960px. |
| About dialog | `.about-section.donate` between Trademarks and Acknowledgements: `h3`, one paragraph, and a `.btn.btn-secondary.donate-link` with the heart and a `.btn-label` | Reaches phone users. `applyDom` swaps only the label, so the SVG survives. `.donate-link { align-self: flex-start }` stops the button stretching across the flex column. |

Donating is never prompted: no nag dialog, no banner, no reminder after practice sessions.

### 4. Strings

New keys in all five locales: `donate`, `donateTitle`, `donateBody`, `donateCta`. The English body reads: "Guidonica is free, with no ads and no tracking. If it helps your practice, a voluntary tip funds its development. Tips unlock nothing: it's simply a thank-you." The German copy uses *Sie* and the French copy uses *vous*, matching each locale's privacy note.

### 5. Store builds hide `.donate`

Apple guideline 3.1.1 and the Google Play payments policy require in-app tips to the developer to go through IAP or Play Billing. Every donate element therefore carries `class="donate"`, and the private store build hides them all with one rule (`.donate { display: none !important; }`). That rule lives in the private repository and is not part of this one.

### 6. No perks

A tip unlocks nothing: no features, no "supporter" badge, no early access. This keeps tips gifts under the store rules and for tax purposes, and keeps the public AGPL build identical for everyone.

### 7. Ko-fi account configuration (owner-side)

- Page `ko-fi.com/guidonica`, Stripe connected via a private per-service address (ADR 0068 §3).
- Simple tip mode in EUR with "Tip" wording; suggested amounts €3 / €5 / €10, €3 minimum.
- Shop, Memberships, Commissions and the supporter leaderboard are off.

### 8. Tax

Tips to an Italian individual are not automatically tax-free, and Ko-fi, Stripe and PayPal report under DAC7. Declaring them is the owner's duty (to be confirmed with a *commercialista*). The code takes no position.

### 9. `.github/FUNDING.yml`

The file contains only `ko_fi: guidonica`, which turns on GitHub's Sponsor button. `github: Hand-Lock` will be added once the owner's GitHub Sponsors application is approved.

## Consequences

- Web users get a tip path that loads nothing from a third-party origin and keeps the privacy note true.
- The README Contact section links to Ko-fi with a plain text link, no badge.
- Any new donate surface must be a plain link carrying `class="donate"`, must be localized in every locale, and must never offer perks or interrupt practice.
- Store builds must ship the `.donate` hiding rule.
- Bundle impact: one SVG symbol, one CSS rule and four strings per locale.

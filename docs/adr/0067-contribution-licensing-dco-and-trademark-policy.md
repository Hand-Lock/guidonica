# 0067. Contribution Licensing (Inbound MIT + DCO) & Trademark Policy

- **Status**: Accepted (amends [0019](0019-licensing-strict-copyleft-agplv3.md) and [0020](0020-in-app-license-and-repository-ui.md)); amended by [0068](0068-project-email-guidonica-it-migadu.md)
- **Date**: 2026-10-04
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Guidonica's monetization model has two layers:

1. **Free forever:** the web app at guidonica.it and its engine stay AGPL-3.0-or-later ([ADR 0019](0019-licensing-strict-copyleft-agplv3.md)).
2. **Paid:** the copyright holder, A. C. Lo Cascio, also ships paid app-store builds and **Guidonica Studio**, a paid tool for teachers and creators, and may sell commercial (non-AGPL) licenses for the engine.

Layer 2 works only while the copyright holder holds non-AGPL rights to **all** of the code. A copyright holder is not bound by their own license, so they can relicense their own work freely. They cannot relicense someone else's.

**The default for contributions is inbound = outbound.** [GitHub's Terms of Service §D.6](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service#6-contributions-under-repository-license) say that content added to a repository with a license notice is licensed under that same license, unless a separate agreement says otherwise. Without such an agreement, every merged pull request would be AGPL-only, and its code could not go into a paid store build or a commercial engine license.

**The brand is not protected either.** The AGPL is a copyright license. Anyone may legally publish a modified fork, but nothing told them not to call it "Guidonica" and use the Guidonian Hand logo, so users could confuse it with the official app.

**Provenance today:** as of this ADR, 100% of the commits in the repository are the owner's, under the `Hand-Lock` / `HandLock_` identities. No outside contribution has been merged, so the policy can be set before the first one arrives, with no relicensing debt.

## Decisions

### 1. The project license is unchanged

`LICENSE` (verbatim FSF text), `package.json` `"license": "AGPL-3.0-or-later"` and the SPDX headers stay as they are. Every public build, including contributed code, remains AGPL.

### 2. Inbound MIT + DCO 1.1

Contributors license their contribution to everyone under the **MIT License** and certify the **Developer Certificate of Origin 1.1** by signing off each commit ([`CONTRIBUTING.md`](../../CONTRIBUTING.md)). That document is the "separate agreement" GitHub §D.6 allows. MIT is GPL-compatible, so contributed code combines into the AGPL project as before. Because it is MIT, the copyright holder may also include it in proprietary builds, as long as its notice is kept.

The DCO's clause (a) refers to "the open source license indicated in the file". `CONTRIBUTING.md` states that for a contribution this is the MIT License, even when the file carries an AGPL header.

| Option | Paid builds possible | Friction for contributors | Trust / fairness | Verdict |
|---|---|---|---|---|
| Do nothing (§D.6 inbound = outbound AGPL) | **No** for any contributed code | None | High | Rejected: breaks layer 2 |
| CLA (license grant to the maintainer) | Yes | High: legal document, signature bot, corporate review | Medium: asymmetric, often discourages contributors | Deferred (see §8) |
| Copyright assignment | Yes | Highest; in Italy, moral rights are inalienable anyway | Low | Rejected |
| Refuse outside contributions | Yes | Total | Low; loses translations and fixes | Rejected |
| **Inbound MIT + DCO** | **Yes** | Low: `git commit -s` and a checkbox | High: symmetric (MIT to *everyone*, not only to the maintainer), and the purpose is stated openly | **Adopted** |

### 3. Enforcement

- **`.github/workflows/dco.yml`:** a self-contained workflow, with no third-party GitHub App. It runs on `pull_request` with `permissions: contents: read` and a full-history checkout. Base and head SHAs reach the script only through `env:`, never as `${{ }}` inside `run:`, to avoid script injection. For each commit in `git rev-list --no-merges "$BASE..$HEAD"`, it reads `%(trailers:key=Signed-off-by,valueonly)` and requires one that contains the author's `<email>` (case-insensitive). Each failing commit gets an `::error::` annotation, then one more gives the fix (`git commit --amend -s`, or `git rebase --signoff origin/main`, then `git push --force-with-lease`). The owner's direct pushes to `main` are not pull requests, so they never run it.
- **`.github/pull_request_template.md`:** checkboxes for the DCO sign-off and the MIT grant (an explicit, per-PR acceptance of the terms), plus the hygiene checks from AGENTS.md.
- **Repository setting** (done): "Require contributors to sign off on web-based commits" is on (`web_commit_signoff_required: true`), so the GitHub web editor adds the trailer itself.
- **Repository ruleset** (done, id 24458065): "Require DCO sign-off on main" targets the default branch with one `required_status_checks` rule, context `sign-off` (the job name in `dco.yml`) from `integration_id: 15368` (GitHub Actions, so no other app can satisfy it). A pull request with an unsigned commit cannot be merged. The Repository admin role (`actor_id: 5`) bypasses it with mode `always`, because a required check also applies to direct pushes, which have no PR check; the owner's `git push origin main` (AGENTS.md §5) therefore still works and GitHub prints "Bypassed rule violations", which is expected. Rollback: Settings → Rules → Rulesets, or `gh api -X DELETE repos/Hand-Lock/guidonica/rulesets/24458065`.

### 4. Provenance rules

- **Dependencies and assets:** runtime dependencies and vendored assets must be permissive (MIT, BSD, ISC, Apache-2.0; OFL or UFL for fonts). No GPL, AGPL, LGPL or other copyleft licenses, no non-commercial licenses (CC BY-NC), nothing of unknown origin. Today's runtime set already complies: VexFlow (MIT), Bravura (OFL), Alegreya and Alegreya Sans (OFL), Ubuntu Mono (UFL).
- **Merging:** merge pull requests from outside contributors with a rebase or a merge commit, which keep each commit and its trailers. If you squash, keep every `Signed-off-by` line (and the `Co-authored-by` lines) in the squashed message.
- **The record:** the git history (author, sign-off) together with the pull request (template checkboxes, discussion) is the provenance record for each contribution. No separate database is kept.

### 5. Trademark policy

[`TRADEMARKS.md`](../../TRADEMARKS.md) covers the word mark **Guidonica™** and the **Guidonian Hand logo**, owned by A. C. Lo Cascio. It:

- invokes **AGPL §7(e)** ("declining to grant rights under trademark law for use of some trade names, trademarks, or service marks") and serves as the §7 notice of that additional term. The AGPL licenses the copyright in the logo files, but not the right to use them as a mark;
- allows, without asking: unmodified redistribution and self-hosting, factual references ("based on Guidonica"), and articles, reviews and teaching material;
- requires permission for: modified versions distributed or hosted under the marks, app-store listings, domain, product or company names containing the mark, implied endorsement, and confusingly similar marks;
- gives forks a rebranding checklist, and asks them to keep the AGPL notices plus the attribution "based on Guidonica by A. C. Lo Cascio";
- takes requests at legal@guidonica.it, with the subject "Trademark request" or "Commercial licensing" ([ADR 0068](0068-project-email-guidonica-it-migadu.md)).

**™, not ®.** The marks are unregistered, so they use ™. Using ® for an unregistered mark is unlawful in Italy (a false claim of registration, Codice della proprietà industriale, art. 127(2)). After a registration (UIBM or EUIPO, classes 9, 41, 42; optional, see "Manual follow-ups"), switch ™ to ® and update the status line in `TRADEMARKS.md`.

### 6. In-app notice

The About dialog gets a third `.about-section` after the copyleft one (keys `trademarkHeading` and `trademarkHtml` in all five locales, per [ADR 0059](0059-localization-and-national-note-naming.md)). In English: "Guidonica™ and the Guidonian Hand logo are trademarks of A. C. Lo Cascio. The AGPL covers the code, not the brand: modified versions must use a different name and logo (see the trademark policy)". The link points to `TRADEMARKS.md` on GitHub and reuses the locale's `LINK` attribute constant. The static HTML copy matches `en`. `tests/i18n.test.ts` now expects four `data-i18n-html` blocks.

The README states the dual licensing openly (`### Dual Licensing`) and summarises the trademark terms (`### Trademarks`), and a new `## Contributing` section points to `CONTRIBUTING.md`.

### 7. What paid builds must carry

Store builds, Studio and commercially licensed engines are proprietary distributions, so they must include:

- the MIT copyright and permission notice of **every contributor** whose code they contain (an in-app "Acknowledgements" screen or a bundled `NOTICES` file);
- **VexFlow's** MIT notice;
- the **SIL OFL 1.1** texts for Bravura (as the "Guidonica Notation" subset), Alegreya and Alegreya Sans, and the **Ubuntu Font Licence 1.0** text. These fonts may be bundled in a paid app, but never sold on their own (OFL condition 1 and the matching UFL condition).

**Paid-only features stay out of this repository.** Anything pushed here is AGPL for everyone, so a free fork could copy it legally. Store-only extras and the Studio features (video and PDF export) live in a private repository or package that builds on top of this engine. The public repository holds only what the free web app ships.

**App stores:** Apple's App Store terms add usage restrictions that conflict with the AGPL for *third parties* distributing AGPL code. The copyright holder is not bound by their own license, and inbound MIT gives them the right to relicense the contributed code, so the conflict does not apply to official store builds. A third-party fork in the App Store would still face it, which is one more reason forks need their own name.

### 8. Upgrade path

If the project grows to many regular contributors, or a commercial partner asks for stronger guarantees, switch **new** contributions to a CLA. Contributions already received under MIT stay usable in paid builds forever: the MIT grant is irrevocable and needs no re-consent.

## Consequences

**Positive**

- Every future contribution can ship in the free AGPL build, the paid store builds, Studio and commercial engine licenses, with no relicensing round.
- The dual licensing is stated openly in `CONTRIBUTING.md` and the README. Contributors know what they agree to and why (it funds the free app).
- Low friction: one `-s` flag, enforced by a ~30-line workflow with no third-party app and read-only permissions.
- Forks stay legal and welcome, but cannot pass themselves off as the official app. Users can tell the official Guidonica from derivatives.

**Negative / trade-offs**

- A contributor's code is MIT, so a third party could take *that file* from the contribution under MIT. The combined project is still AGPL, and the rest of the code remains the owner's under the AGPL. This is accepted as the cost of symmetry with contributors.
- Paid builds must collect and display contributor MIT notices. This is a small, recurring compliance task.
- The trademark is unregistered, so enforcement rests on Italian and EU unregistered-mark and unfair-competition law until it is registered.
- Someone else could register "Guidonica" first. Prior use (the git history and the guidonica.it deploys) would probably still let the project keep the name, but might not let it stop the other registrant. App-store trademark complaints are also harder to win without a registration number.
- First-time contributors who forget `-s` see a red check. The `::error::` message gives the exact fix.

## Manual follow-ups (owner)

- ~~GitHub → Settings → General → enable "Require contributors to sign off on web-based commits".~~ Done.
- ~~Optional: a ruleset that requires the DCO check on pull requests to `main`, with an owner bypass.~~ Done: "Require DCO sign-off on main" (see §3).
- Optional, when budget allows: registration. The policy stays valid while the mark is unregistered. The AGPL §7(e) term binds every licensee whether or not the mark is registered, and the unregistered mark is protected by Italian law (c.c. art. 2571, prior use) and by unfair-competition law (c.c. art. 2598). The path, cheapest first (check current fees before filing):
  1. Search [TMview](https://www.tmdn.org/tmview/) for "Guidonica" (free).
  2. File a national application at UIBM in classes 9, 41 and 42 (roughly €100–€200). This also gives a 6-month Paris Convention priority for a later EU filing.
  3. File an EUIPO application (€850 for one class, +€50 for the second, +€150 for each further class), claiming the UIBM priority if it is still within 6 months.

  After any registration is granted, switch ™ → ® and update the status line in `TRADEMARKS.md`.

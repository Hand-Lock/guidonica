# 0075. AI-Assistance Disclosure in the About Dialog

- **Status**: Accepted
- **Date**: 2026-10-05
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Much of Guidonica's code is written with Claude, Anthropic's AI coding assistant, and the owner reviews every change. Anyone who opens the repository can see this in the commit trailers (`Co-Authored-By: Claude …`) and in the ADR author lines. The app itself said nothing about it.

Most users are musicians, teachers and students who will never open GitHub. If they found out later on their own, it could look as if it had been hidden, even though nothing was. Some people object to generative AI in creative work. Guidonica uses AI only to help write code: no music, image or text in the app is produced by a model, and no model runs at runtime. That is worth stating plainly. There is no legal duty to disclose. This decision is about honesty and the project's reputation.

## Decision & Implementation

### 1. Placement: an About section, not a banner

A new `.about-section` titled "How Guidonica is made" sits in `#modal-about` between Trademarks and Support. People look for credits in the About dialog, and the section comes before the tip button, so anyone who tips has had the chance to read it.

There is no banner, popup, badge or onboarding step. Those would frame the whole app around AI, which is a smaller part of the product than the notation, the generator and the metronome. Like the donate section ([0074](0074-donations-ko-fi-link.md)), the note never interrupts practice.

### 2. Wording

English reference copy (`madeHeading`, `madeBody`):

> **How Guidonica is made**
> Guidonica is designed, tested and maintained by A. C. Lo Cascio, who writes much of its code with an AI coding assistant (Anthropic's Claude) and reviews every change. No AI runs inside the app: exercises come from a random generator whose rules are documented in the source, and the metronome is synthesized live in your browser.

Rules for this copy and its translations:

- Say "AI coding assistant". Avoid slang such as "vibe-coded" and vague phrases such as "AI-powered", which suggest a model runs in the app.
- Name the tool (Anthropic's Claude) rather than keeping the copy AI-agnostic. A generic "AI" makes readers ask which one and how much, which is the suspicion this note exists to remove. The name also matches the repository, where commits carry `Co-Authored-By: Claude` trailers. The cost is that the copy goes stale if the tool changes; see Consequences.
- State that no AI runs inside the app, and say what does: the documented random generator (SPEC, [0065](0065-grammar-driven-rhythm-sampler.md)) and the live Web Audio synthesis.
- Keep it factual and non-defensive: no apology and no argument for AI.
- Keep "reviews every change" only while it stays true. The owner confirmed it on 2026-10-05.

### 3. Strings

New keys in all five locales ([0059](0059-localization-and-national-note-naming.md)): `madeHeading`, `madeBody`. Both are plain text (`data-i18n`, not `data-i18n-html`). German uses *Sie* and French uses *vous*, matching the privacy note. `tests/i18n.test.ts` checks that the static HTML copy matches `en`.

### 4. README

The License section of `README.md` carries the same statement right after the copyright line, so the repository and the app say the same thing.

## Consequences

- Users learn how the app is made from the app itself, in their own language, without a prompt that frames Guidonica as an AI product.
- If the workflow changes (for example, a different coding assistant is used, changes are no longer reviewed one by one, or a model is ever run inside the app), this copy, the README sentence and this ADR must be updated together in all locales.
- Store builds keep the section: unlike `.donate`, it carries no store-policy restriction.
- Bundle impact: two strings per locale and one HTML section.

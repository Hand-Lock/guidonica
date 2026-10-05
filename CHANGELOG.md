# Changelog

All notable changes to Guidonica™ are recorded here. The format follows
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and versions use
calendar versioning, `YEAR.MONTH.MICRO` (ADR 0078).

Every change lands under **Unreleased** in the commit that makes it, and goes live on
[guidonica.it/nightly/](https://guidonica.it/nightly/). A release promotes it to
[guidonica.it](https://guidonica.it/), where returning users see the notes in the app.

- **Added**, **Changed**, **Fixed**, **Removed**, **Security**: written for users and shown
  in the app's "What's new" dialog, translated at release.
- **Internal**: documentation, CI and refactors. Shown on GitHub only.

## [Unreleased]

## [2026.10.0] - 2026-10-05

### Added

- Practise 9/8 and 12/8: compound triple and quadruple meters, with the same pulse choice as 6/8 (ADR 0076).
- Pick which notes to read: each note name can be switched on or off in Settings, and Beginner starts with a few notes only (ADR 0070).
- The welcome steps now ask for a time signature too, after the level and the clef (ADR 0071).
- Guidonica works offline: after one visit, it opens and plays with no connection (ADR 0063).
- What's new: after an update, Guidonica lists what changed since your last visit. About shows the version and the full list (ADR 0078).
- A Ko-fi link in About and in the footer, for voluntary tips (ADR 0074).
- About explains how Guidonica is made, including the AI coding assistant used to write it (ADR 0075).

### Changed

- The beat lights and the click now have three accent levels: the downbeat, the bar's middle pulse (beat 3 of 4/4, beat 4 of 6/8) and the other beats (ADR 0072).
- The levels progress more evenly in tempo, intervals and note values (ADR 0070).
- The level button shows a dumbbell, so it no longer looks like a signal-strength meter (ADR 0073).
- Rhythms come from a new generator: every figure that may appear in a bar can now appear, and rests are spelled the way a copyist would write them (ADRs 0064, 0065).
- Rests can fill whole beats and whole bars, and tuplets can mix note values, such as a quarter and an eighth under a triplet bracket (ADRs 0065, 0066).
- Melodies built from leaps only, such as thirds or fifths, now reach every note of the range (ADR 0066).

### Internal

- Release channels: guidonica.it serves the latest release and guidonica.it/nightly/ the latest commit, with separate settings and offline caches (ADR 0078).
- Security and privacy audit, least-privilege CI with pinned actions (ADR 0069), and CI actions on Node 24 (ADR 0077).
- Contributor terms with DCO sign-off, a trademark policy and a security contact (ADRs 0067, 0068).
- robots.txt and sitemap.xml for search engines (ADR 0062).

## [1.0.0] - 2026-10-03

### Added

- First public release.

[Unreleased]: https://github.com/Hand-Lock/guidonica/compare/v2026.10.0...HEAD
[2026.10.0]: https://github.com/Hand-Lock/guidonica/compare/v1.0.0...v2026.10.0
[1.0.0]: https://github.com/Hand-Lock/guidonica/releases/tag/v1.0.0

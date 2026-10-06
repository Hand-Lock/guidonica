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

### Added

- Half-note time signatures for early music. A Half-note beat switch in Settings → Staff and in the welcome guide turns 4/4, 3/4, 2/4, 6/8, 9/8 and 12/8 into 4/2, 3/2, 2/2 (alla breve), 6/4, 9/4 and 12/4, with half-note clicks, breves and the breve rest (ADR 0090).
- A drone to sing against: a steady shruti box or pad on any note, with its own volume, in Settings → Practice. Exercise links carry the drone note (ADR 0092).
- Common-time and alla breve signs: Settings → Staff can write 4/4 as C and 2/2 as ¢ (ADR 0093).
- Tune the drone to A = 415, 430, 442 or 466 Hz besides 440, for Baroque, Classical or Renaissance pitch, in Settings → Practice. Exercise links carry it (ADR 0094).
- Press D to turn the drone on and off.

### Changed

- The Compound pulse setting is now called Pulse and also works in half-note meters: the click follows the beat or each subdivision.

### Fixed

- Scrolling notation is smooth on high-refresh displays and in Firefox, where it could stutter (ADR 0089).
- Scrolling no longer hitches on each metronome click or when a new bar is drawn, on displays up to 144 Hz. (ADR 0091)

### Internal

- ADR 0089 documents the frame-locked audio clock; `SPEC.md` §5 and `AGENTS.md` §1 describe it.
- ADR 0090 documents the half-note beat meters. Meters gain a `beatGroup` (metric beats per felt beat), the `compoundPulse` setting becomes `pulse` (`beat` or `division`; old settings and links still load), and the beat lights group by `beatGroup`.
- ADR 0091 documents jank-free beat and measure frames: compositor-only beat lights, VexFlow measures rendered in idle callbacks, an idempotent `syncUI`, and cached canvas gradients and dark-mode query; `SPEC.md` §3 and §5 and `AGENTS.md` §1 describe it.
- ADR 0092 documents the drone, including why the tanpura timbre was retired (its pluck cycle ignored the tempo): `src/audio/drone.ts` voices on a drone bus beside the click's master gain, the `droneNote`, `droneSound` and `droneVolume` settings and the additive `drone=` link parameter; `SPEC.md` §5 and §6, `AGENTS.md` §1 and §2 and the README describe it.
- ADR 0093 documents the C and ¢ signs: `timeSignatureSpec` spells 4/4 and 2/2 for VexFlow when the new `meterSigns` setting is on, display only, left out of links; `SPEC.md` §2 and §6 and the README describe it.
- ADR 0094 documents the drone tuning: the `referencePitch` setting (`REFERENCE_PITCHES`), `droneFrequency(pc, a4)`, `MetronomeEngine.setReferencePitch` and the additive `a4=` link parameter; `SPEC.md` §5 and §6 and the README describe it.
- ADR 0094 §5 records the D shortcut: `applyDroneNote` serves the drone select and the key, and the last note lives in memory only.
- ADR 0095: a zero-latency soft clipper on the output keeps click plus drone below full scale (`src/audio/output.ts`).

## [2026.10.1] - 2026-10-06

> Send an exercise as a link, discover hidden features through short tips, and open Guidonica in your language at guidonica.it/it/, /fr/, /de/ and /es/.

### Added

- The About dialog and footer link to Guidonica on Bluesky and Mastodon (ADR 0082).
- The About dialog and footer link to Guidonica on Instagram too, where you can watch the trailer (ADR 0084).
- Send an exercise as a link: Settings → Practice → Share copies a link with your clef, meter, tempo, note values and notes, and whoever opens it practises with the same settings (ADR 0085).
- Guidonica has an address in each language: guidonica.it/it/, /fr/, /de/ and /es/ open in Italian, French, German and Spanish, so searches in those languages can find it (ADR 0086).
- A short tip when you open Guidonica points to features you may have missed, such as level presets, note names and exercise links, and now and then to our social pages and Ko-fi. Turn tips off in Settings → Practice. (ADR 0087)
- A privacy policy, in English and Italian, linked from the About dialog and the footer (ADR 0088).

### Changed

- The About dialog's privacy line now says your settings stay on your device. Visiting the site still reaches its host, GitHub Pages, as the privacy policy explains (ADR 0088).

### Fixed

- In Instagram, Facebook and Threads, which can't rotate, the landscape tip now explains how to open Guidonica in your browser instead (ADR 0083).
- The What's new and About buttons no longer overflow the dialog on narrow phones; long labels wrap instead.

### Internal

- Profile banners for Mastodon, Bluesky, X and YouTube, generated by `pnpm banners` (ADR 0079).
- `rel="me"` links to the Mastodon and Bluesky profiles in `index.html`, and the @guidonica.it Bluesky domain handle (ADR 0080).
- Releases are announced on Bluesky and Mastodon by CI, as a thread opened by a `> ` headline in the changelog (ADR 0081).
- README, SPEC, AGENTS and contributor docs brought up to date with the current app, and the 16:9 trailer embedded in the README. The AGENTS clock and buffer rules now describe the scheduler's wake-up timer and the beat-based lookahead.
- Pre-release privacy, security and legal audit: a private address was removed from ADR 0074 and from history with a second history rewrite, `source-map-js` was bumped to 1.2.2 for a dev-only advisory, and tests now reject any non-public guidonica.it address (ADR 0088).

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

[Unreleased]: https://github.com/Hand-Lock/guidonica/compare/v2026.10.1...HEAD
[2026.10.1]: https://github.com/Hand-Lock/guidonica/compare/v2026.10.0...v2026.10.1
[2026.10.0]: https://github.com/Hand-Lock/guidonica/compare/v1.0.0...v2026.10.0
[1.0.0]: https://github.com/Hand-Lock/guidonica/releases/tag/v1.0.0

# Agent Guidelines & Repository Hygiene: Guidonica

## 1. Project Overview & Philosophy
**Guidonica** is a high-performance, client-only web tool for sight-reading and solfège practice, inspired by Guido d'Arezzo's historic *manus guidonica* pedagogy. It continuously streams procedurally generated music notation across a fixed playhead in synchronization with a synthesized metronome.

### Suckless Engineering Philosophy
The core software architecture is strictly governed by an uncompromising "suckless", ultra-lightweight, and zero-bloat engineering philosophy:
- **Zero Framework Bloat**: No React, Vue, Svelte, or Angular. Written in **Vanilla TypeScript** driving native DOM APIs, HTML5 Canvas, and Web Audio API directly. Zero virtual DOM reconciliation, zero runtime reactivity overhead, zero state management dependencies. Shipped JS is ~125 kB gzipped: ~31 kB of app code (including the English dictionary) plus ~93 kB of VexFlow's font-free `vexflow/core`; each other language is one lazy ~4.1 kB chunk (ADR 0059). The music font is a separate 19.6 kB Bravura subset (ADR 0058); never import the full `'vexflow'` entry, which inlines ~600 kB of fonts.
- **Single Source of Truth Hardware Clock**: Visual motion and synthesized metronome audio clicks are mathematically linked to the hardware audio clock (`AudioContext.currentTime`). Never introduce independent `setInterval`, `setTimeout`, or visual time accumulators. Visual-auditory drift is mathematically impossible; noteheads cross the playhead at the exact physical microsecond the speaker clicks.
- **Hardware-Accelerated Measure Blitting**: VexFlow layout and font glyph rasterization execute **once** onto an offscreen canvas per measure. The 60/120 FPS animation loop (`requestAnimationFrame`) exclusively executes GPU-accelerated bit-block transfers (`ctx.drawImage()`). Zero per-frame layout, zero font parsing, sub-millisecond per-frame CPU time (< 1% CPU utilization).
- **Bounded Ring-Buffer & Zero-Leak Memory Discipline**: Only 4 to 6 measures exist in memory at any time. Measures scrolling past the left edge are immediately evicted and their offscreen canvases dereferenced. An infinite 3-hour practice session maintains the exact same memory footprint (~30–45 MB process memory) as a 5-second test.
- **Synthesized Audio (0-Byte Sample Downloads)**: Metronome clicks and woodblock timbres are synthesized live on the audio hardware using native Web Audio `OscillatorNode` (sine/triangle) and exponential `GainNode` envelopes. Zero audio files (MP3/WAV/OGG) downloaded over the network.
- **Pure Mathematical Generation**: Rhythms are sampled over a 32nd grid from a grammar derived from the notehead, rest and tuplet placement tables (ADR 0065). Pitches are generated via a symmetric discrete Markov random walk. Zero heavy music theory AI or rule engines.
- **The Ergodic Generation Principle (State-Space Completeness)**: The music generator is strictly ergodic (the "infinite monkey theorem" heuristic). For any user-selected parameter configuration $\Omega = (\text{Clef}, \text{TimeSig}, \text{Subdivisions}, \text{Dotted}, \text{Ties}, \text{Intervals}, \text{Notes}, \text{Accidentals})$, *every mathematically and grammatically valid permutation within $\Omega$ must possess a strictly non-zero generation probability ($P(\omega) > 0, \forall \omega \in \Omega$)*. No valid rhythmic figure (such as `q 8` or `8 q` in 6/8, or `q h` and `h q` in 3/4) or interval leap may be artificially suppressed, hijacked, or hardcoded out of existence. Generation rules must remain transparent, organized, and complete.
- **Pure CSS3 Liquid Glass & Zero CSS Frameworks**: The entire Frutiger Aero / Aqua / Liquid Glass visual design is constructed via pure, hardware-composited CSS3 (`backdrop-filter`, multi-stop linear/radial gradients, beveled shadows). Zero Tailwind runtime, zero CSS-in-JS libraries, zero sprite textures. Total CSS is ~7.9 kB gzipped. Text fonts (Alegreya, Alegreya Sans, Ubuntu Mono) are self-hosted Latin woff2 files in `src/fonts/` (ADR 0060); never load fonts, scripts or styles from a third-party origin.
- **Offline Without Dependencies**: A hand-written service worker (`src/sw.ts`, ~1.8 kB) precaches the build so the app works offline after one visit (ADR 0063). No Workbox, no PWA plugin; never add `skipWaiting()` or runtime caching of navigations.
- **Strict Typing, Zero Silent Errors**: TypeScript with `strict: true`. Avoid `any`. Catch duration arithmetic mismatches, null pointers, and VexFlow type incompatibilities at compile time. Instant build in < 800ms.

### Authoritative Specification
- Consult [`SPEC.md`](SPEC.md) in the project root for the complete functional specification, metric linearity formulas, and musical generation requirements.
- Consult [`docs/DESIGN_MANIFESTO.md`](docs/DESIGN_MANIFESTO.md) for the authoritative Aero-Guidonica visual styling and ergonomics manual.

---

## 2. Directory Structure & Architecture

```
guidonica/
├── AGENTS.md               # Strict developer & agent rules (this file)
├── SPEC.md                 # Product and pedagogical specification
├── CHANGELOG.md            # Keep a Changelog, CalVer; every commit adds its Unreleased entry (ADR 0078)
├── CONTRIBUTING.md         # Contributor guide: inbound MIT + DCO sign-off (ADR 0067)
├── TRADEMARKS.md           # Guidonica™ name & logo policy, AGPL §7(e) notice (ADR 0067)
├── SECURITY.md            # Private vulnerability reporting to security@guidonica.it (ADR 0068)
├── package.json            # Minimal dependencies (vite, typescript, vexflow; @vexflow-fonts/bravura as font source)
├── tsconfig.json           # Strict TypeScript configuration
├── vite.config.ts          # Minimal Vite configuration + serviceWorker(), channel() and localePages() build plugins (ADRs 0063, 0078, 0086)
├── index.html              # Minimal semantic HTML shell
├── .claude/
│   └── skills/
│       └── run-guidonica/  # Agent run/screenshot skill + Playwright driver (dev-only)
│           ├── driver.mjs  # Headless run/screenshot driver
│           └── chromium.mjs # Playwright + cached Chromium lookup, shared with build-banners.mjs
├── .github/
│   ├── FUNDING.yml         # Sponsor button: Ko-fi only until GitHub Sponsors is approved (ADR 0074)
│   ├── pull_request_template.md # DCO + MIT checkboxes and hygiene checklist (ADR 0067)
│   └── workflows/
│       ├── deploy.yml      # Typecheck, test, build:site, Pages deploy; tags create GitHub Releases; releases announced (ADRs 0018, 0078, 0081)
│       └── dco.yml         # Signed-off-by check on every pull request commit (ADR 0067)
├── public/                 # Copied verbatim: favicon.svg/.ico, apple-touch-icon.png, icon-*.png, manifest.webmanifest, og-image.png (ADR 0061), robots.txt, sitemap.xml (ADR 0062), CNAME, .well-known/security.txt (ADR 0068)
├── scripts/
│   ├── build-site.mjs      # site/ = latest v20* tag (release) + site/nightly/ = working tree (pnpm build:site; ADR 0078)
│   ├── changelog.mjs       # CHANGELOG.md parser, cutRelease, releaseSection (shared by Vite, scripts, tests; ADR 0078)
│   ├── release.mjs         # pnpm release: cuts Unreleased into the next CalVer version, bumps package.json (ADR 0078)
│   ├── release-notes.mjs   # GitHub Release body for a tag, run by CI (ADR 0078)
│   ├── announce.mjs        # Bluesky + Mastodon release thread from CHANGELOG.md, run by CI after deploy (ADR 0081)
│   ├── build-icons.mjs     # Guidonian Hand mark generator (npm run icons; ADRs 0046–0048)
│   ├── build-banners.mjs   # Social profile banners from live captures (pnpm banners, dev-only; ADR 0079)
│   ├── build-music-font.py # Bravura → Guidonica Notation subset (npm run music-font; fontTools, dev-only; ADR 0058)
│   └── fetch-ui-fonts.mjs  # Self-hosted text fonts from Google Fonts' Latin subsets (npm run ui-fonts, dev-only; ADR 0060)
├── docs/
│   ├── DESIGN_MANIFESTO.md # Aero-Guidonica design manifesto and visual rules
│   ├── brand/
│   │   ├── guidonica-mark.svg # README logo, generated by build-icons.mjs (never hand-edit)
│   │   └── banners/        # Mastodon/Bluesky/X headers + YouTube art, generated by build-banners.mjs (ADR 0079)
│   └── adr/                # Architectural Decision Records & implementation notes
│       ├── README.md       # ADR index and registration log
│       └── 0001-*.md       # Specific architectural & subsystem records
└── src/
    ├── main.ts             # Application bootstrapper, UI event wiring & locale bootstrap
    ├── sw.ts               # Offline service worker, compiled to dist/sw.js by vite.config.ts (ADR 0063)
    ├── state.ts            # Typed session state and parameter interfaces
    ├── storage.ts          # Validated localStorage settings, defaults, onboarding flag; per-channel keys (ADR 0078)
    ├── whatsNew.ts         # "What's new": version compare, boot action, notes loaders & dialog rendering (ADR 0078)
    ├── env.d.ts            # Build-time constants (__APP_VERSION__, __APP_CHANNEL__, …) and *.md?notes modules
    ├── presets.ts          # Level presets, preview representations & signatures (ADR 0049, 0051, 0052)
    ├── style.css           # Clean light-mode styles and accent colors
    ├── fonts/              # Self-hosted text fonts + OFL/UFL licences (ADR 0060; never hand-edit)
    ├── i18n/
    │   ├── index.ts        # Locale runtime: lazy chunks, t(), applyDom, note names & octave formats (ADR 0059)
    │   ├── locales/        # en.ts (reference, defines Messages), it.ts, fr.ts, de.ts, es.ts
    │   ├── landing.ts      # Build-only head metadata of the /it/ /fr/ /de/ /es/ landing pages (ADR 0086)
    │   └── changelog/      # it.md, fr.md, de.md, es.md: released notes translated at release time (ADR 0078)
    ├── utils/
    │   ├── radioGroup.ts   # Shared roving-tabindex radiogroup helpers (intro cards, language chips)
    │   ├── inAppBrowser.ts # Portrait-locked in-app browser detection for the landscape tip (ADR 0083)
    │   ├── serviceWorker.ts # Production-only service worker registration (ADR 0063)
    │   └── wakeLock.ts     # Screen Wake Lock controller
    ├── audio/
    │   └── metronome.ts    # Web Audio oscillator synthesis & clock scheduler
    ├── notation/
    │   ├── generator.ts    # Grammar-driven rhythm sampler & pitch random-walk
    │   ├── renderer.ts     # VexFlow offscreen measure canvas builder
    │   ├── fonts.ts        # Music font registration, VexFlow.setFonts & readiness gate (ADR 0012, 0058)
    │   ├── fonts/          # Generated by build-music-font.py (never hand-edit): woff2, codepoints.json, OFL.txt
    │   ├── preview.ts      # Intro notation thumbnails: level strips & clef icons (ADR 0050, 0052)
    │   ├── ties.ts         # Tie grammar, notehead & rest placement tables, rest spelling
    │   └── types.ts        # Musical data types (Note, Measure, Clef, TimeSignature)
    └── scroller/
        ├── scroller.ts     # Viewport canvas manager, rAF loop, measure blitting
        └── buffer.ts       # Active measure ring-buffer & disposal pipeline
```

---

## 3. Strict Coding & Hygiene Rules

1. **Type Safety & Compile Checks**:
   - Always run `npm run typecheck` (`tsc --noEmit`) before committing code. All code must compile with zero errors and zero warnings.
   - Do not use `any` unless wrapping an un-typed third-party dynamic property. Create explicit interfaces and type unions (e.g., `type Clef = 'treble' | 'bass' | 'alto' | 'tenor';`).
   - Prefer type guards and explicit null checks over non-null assertions (`!`).

2. **Memory & Garbage Collection Discipline**:
   - In an infinite scroller, memory leaks quickly degrade performance.
   - Measures that scroll past the left edge of the viewport must be cleanly evicted from the measure ring-buffer.
   - Do not retain references to offscreen canvases that are no longer visible.

3. **Audio Safety & Lifecycle**:
   - Modern browsers require user interaction before resuming an `AudioContext`.
   - Never call `audioCtx.resume()` during module initialization. Only initialize or resume `AudioContext` inside a direct user gesture (e.g., clicking "Start" or pressing `Space`).

4. **Clean Code & Styling**:
   - 2 spaces for indentation.
   - No extraneous console logging in production modules (`console.log` should be removed before committing).
   - Strict adherence to the **Aero-Guidonica Design Manifesto** ([`docs/DESIGN_MANIFESTO.md`](docs/DESIGN_MANIFESTO.md)). All visual elements must follow the pure CSS3 Liquid Glass / Frutiger Aero / skeuomorphic tactile physics model without adding external CSS or JS dependencies.

5. **Localization (ADR 0059)**:
   - New UI text needs a key in every locale (`src/i18n/locales/*.ts`); `en.ts` is the reference and the compiler rejects an incomplete locale.
   - Never hardcode user-visible strings in TS. Static HTML text keeps its English copy plus a `data-i18n*` attribute; `tests/i18n.test.ts` checks that it matches `en`.
   - Note names and octave formats come from the locale (`noteLabels`, `formatRange`); the renderer receives a resolved label table.
   - Release notes are translated at release time only (ADR 0078): `CHANGELOG.md` Unreleased stays English, and each release adds its section to `src/i18n/changelog/{it,fr,de,es}.md` with the same versions, dates, section kinds and bullet counts, `Internal` omitted. `tests/changelog.test.ts` enforces the mirror.

6. **Procedural Ergodicity & Rule Transparency**:
   - Whenever modifying the procedural generator (`src/notation/generator.ts` or related files), you must preserve metric and melodic ergodicity.
   - Never introduce hardcoded duration substitutions, silent omissions of valid rhythms, or hidden heuristics that reduce the reachable state space.
   - All musical capabilities (e.g., dotted notes, ties, rests) must be transparently controllable by the user and mathematically reachable in the generator's rhythm grammar.

7. **Licensing & Provenance (ADR 0067)**:
   - The project is AGPL-3.0-or-later, and the copyright holder also ships it under other terms (paid store builds, Guidonica Studio, commercial engine licenses). Keep every line of code relicensable.
   - Runtime dependencies and vendored assets must be permissive (MIT, BSD, ISC, Apache-2.0; OFL or UFL for fonts). Never add copyleft (GPL/AGPL/LGPL) or non-commercial (CC BY-NC) material.
   - Never paste third-party code of unknown or copyleft license.
   - Merge outside contributions only when every commit is DCO signed off under the [`CONTRIBUTING.md`](CONTRIBUTING.md) terms, and keep the `Signed-off-by` trailers (rebase or merge commit; a squash message must carry them all).
   - Use of the name and logo follows [`TRADEMARKS.md`](TRADEMARKS.md). Write Guidonica™, never ®, until a registration is granted.
   - Never commit paid-only features (store extras, Guidonica Studio such as video or PDF export) to this public repository. Anything pushed here is AGPL for everyone; those features live in a private repository.

---

## 4. Architectural Decision Records (ADRs) & Knowledge Continuity

1. **ADR Repository (`docs/adr/`)**:
   - Whenever a subsystem is designed, an architectural choice is made, or an implementation method is introduced/modified, the agent must document it in `docs/adr/` and register it in `docs/adr/README.md`.
   - Each ADR must specify: Status, Date, Context/Problem, Decisions & Implementation Methods (with math/code rationale), and Consequences.
2. **LLM Knowledge Retention**:
   - The ADRs serve as the persistent source of truth so future LLM agents know with certainty what has been developed, which algorithms are active, and why specific engineering decisions were made.

---

## 5. Git & Version Control Hygiene

1. **Mandatory Commit & Push Upon Task Completion**:
   - **Every time you finish a task requested by the user, you MUST create a git commit AND push it to remote (`git push origin main`).**
   - **Every commit records its change in `CHANGELOG.md` under `## [Unreleased]`, in the same commit** (ADR 0078). Write user-facing changes for users, in plain sentences, under `Added`, `Changed`, `Fixed`, `Removed` or `Security`, with an optional trailing `(ADR NNNN)`; they are shown in the app. Docs, CI and refactors go under `Internal` (GitHub only). Never edit a released section.
   - Pushing to `origin/main` triggers `.github/workflows/deploy.yml`, which tests and publishes the commit to **guidonica.it/nightly/** only. The root, guidonica.it, keeps serving the latest release tag.
   - The commit message must be written by the agent following Conventional Commits (`feat:`, `fix:`, `refactor:`, `perf:`, `docs:`, `chore:`).
   - Always execute macOS Keychain loading before pushing in background agent subshells:
     ```bash
     ssh-add --apple-load-keychain 2>&1 && git push origin main
     ```
   - Never leave uncommitted or unpushed changes at the end of a completed task unless explicitly instructed by the user.
2. **Release Protocol (ADR 0078)**: only when the user explicitly says "release"; never on your own initiative.
   1. Confirm the latest `main` CI run is green: `gh run list --branch main -L 1`.
   2. `pnpm release`: checks a clean tree level with `origin/main`, computes the CalVer version (`YYYY.M.MICRO`), moves Unreleased under it in `CHANGELOG.md`, bumps `package.json` and prints the section. It does not commit.
   3. Write the release headline (ADR 0081): one `> ` line right under `## [<version>] - <date>`, in English, for users, naming the one or two biggest changes. It opens the Bluesky and Mastodon announcement and must fit Bluesky's 300-grapheme first post; `pnpm test` checks it. It is not translated.
   4. Translate the new section's user-facing sections into `src/i18n/changelog/{it,fr,de,es}.md`, at the top, same structure, `Internal` omitted.
   5. `pnpm typecheck && pnpm test && pnpm build:site`.
   6. Commit `chore(release): <version>`, then:
      ```bash
      git tag -a v<version> -m "Guidonica <version>"
      ssh-add --apple-load-keychain 2>&1 && git push --atomic origin main v<version>
      ```
   7. CI redeploys (root = the new tag) and the tag run creates the GitHub Release from the changelog section. After the deploy, the main run's `announce` job posts the release thread to @guidonica.it on Bluesky and @guidonica@mastodon.social (ADR 0081). A failed `announce` leaves the site and the GitHub Release untouched; re-run it from the Actions UI, it never double-posts.
3. **Repository Setup**:
   - Keep the repository self-contained and reproducible.
   - `.gitignore` must ignore `node_modules/`, `dist/`, `site/`, `.DS_Store`, and temporary test artifacts.
4. **Cross-Machine Reproducibility**:
   - Any developer on another machine must be able to run:
     ```bash
     git clone <repo-url>
     cd guidonica
     pnpm install   # or npm install
     pnpm dev       # or npm run dev
     ```
   - No global binaries or environment variables should be assumed.
5. **macOS SSH Keychain Authentication**:
   - The user's SSH key passphrase is saved in macOS Keychain. When running `git push origin main` in background agent or non-interactive subshells, run `ssh-add --apple-load-keychain` first to ensure the identity is loaded without interactive prompts.
6. **Node.js & pnpm Runtime Requirement**:
   - `pnpm@11.8.0` requires **Node.js >= 22.13** (due to dependency on `node:sqlite`). All environments, `.nvmrc`, and CI runners must target Node 22+.

---

## 6. Development & Verification Workflow

- **Node.js Version**: Node 22+ (`node -v` >= 22.13.0)
- **Install Dependencies**: `pnpm install` (or `npm install`)
- **Start Dev Server**: `pnpm dev` (or `npm run dev`)
- **Typecheck**: `pnpm typecheck` (or `npm run typecheck`)
- **Production Build**: `pnpm build` (or `npm run build`)
- **Preview Build**: `pnpm preview` (or `npm run preview`)

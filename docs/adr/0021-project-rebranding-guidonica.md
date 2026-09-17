# ADR 0021: Project, Web-App, and Repository Rebranding to Guidonica

## Status
Accepted

## Date
2026-09-17

## Context & Pedagogical Heritage
The web application was initially created under the working name **Solfège Scroller** (`solfege-scroller`). While descriptive of the mechanical implementation (a scrolling music notation canvas), the application's pedagogical purpose transcends simple scrolling.

In the 11th century, Benedictine monk and music theorist **Guido d'Arezzo** (c. 991 – after 1033) formulated the foundational elements of Western music pedagogy:
1. **Modern Staff Notation**: Replacing un-pitched neumes with diastematic staff lines so that any singer could sight-read melodies without hearing them first.
2. **Hexachordal Solmization**: Assigning mnemonic syllables (*ut, re, mi, fa, sol, la*) from the hymn *Ut queant laxis* to anchor pitch relationships.
3. **Manus Guidonica (The Guidonian Hand)**: The world's first spatial visual-mnemonic sight-singing interface. By mapping pitches and hexachord syllables to joints and fingertips of the left hand, teachers could silently point to joints, prompting students to sing intervals and notes in real time.

**Guidonica** is the modern web-native successor to this tradition: a client-only, zero-latency procedural notation engine that streams notes across a stationary playhead in synchronization with a synthesized metronome. Renaming the application to **Guidonica** honors Guido d'Arezzo's historic vision while providing a distinctive, evocative identity for the project.

## Decision & Implementation Details

1. **GitHub Repository & Remotes**:
   - The remote repository on GitHub was renamed from `Hand-Lock/solfege-scroller` to `Hand-Lock/guidonica` using the GitHub CLI:
     ```bash
     gh repo rename guidonica --yes
     git remote set-url origin git@github.com:Hand-Lock/guidonica.git
     ```
   - GitHub maintains automatic redirects for legacy HTTP and git operations, while git tracking is explicitly pointed to the new canonical URL.

2. **Package & Build Configuration**:
   - `package.json` package name updated to `"guidonica"`.
   - Repository URL updated to `https://github.com/Hand-Lock/guidonica.git`.
   - Keywords augmented with `"guidonica"`, `"guido-d-arezzo"`, and `"manus-guidonica"`.
   - Relative asset resolution (`base: './'`) in `vite.config.ts` ensures instant compatibility with GitHub Pages at `https://hand-lock.github.io/guidonica/` as well as any future custom domain.

3. **Backward-Compatible Storage Migration**:
   - In `src/storage.ts`, the primary persistence key was transitioned from `solfege_scroller_settings_v2` to `guidonica_settings_v1`.
   - To guarantee zero data loss or setting resets for existing users:
     - `loadStoredSettings()` checks `guidonica_settings_v1`.
     - If absent, it automatically inspects `solfege_scroller_settings_v2`, followed by `solfege_scroller_settings_v1`.
     - Saving always writes to `guidonica_settings_v1`.
   - In `index.html`, the synchronous theme initialization script checks keys in precedence order (`guidonica_settings_v1` → `solfege_scroller_settings_v2` → `solfege_scroller_settings_v1`), avoiding light/dark theme flash on first load.

4. **UI Branding & Presentation**:
   - Page `<title>` updated to `Guidonica — Sight-Reading & Solfège Engine`.
   - Primary bar header brand displays `Guidonica`.
   - Native In-App About Dialog updated to **About Guidonica**, incorporating the historical tribute to Guido d'Arezzo alongside AGPLv3 licensing and repository links.
   - Core application class in `src/main.ts` renamed from `SolfegeScrollerApp` to `GuidonicaApp`.

5. **Historical Documentation Coherence**:
   - Historical ADR records updated to refer to Guidonica consistently, creating a clean, unified documentation surface as if the application was always called Guidonica.

## Consequences

- **Pedagogical Alignment**: Connects the digital tool directly to the rich historical tradition of sight-singing and solfège pedagogy.
- **Seamless Upgrade Path**: Existing users retain their saved tempos, clefs, meter configurations, themes, and sound profiles with zero manual intervention.
- **Continuous Deployment**: Automated GitHub Actions workflow immediately deploys the rebranded site to `https://hand-lock.github.io/guidonica/`.

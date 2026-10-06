# 0085. Shareable Exercise Links

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio

## Context & Problem Statement

Settings live only in `localStorage` (`src/storage.ts`). A teacher who sets up an exercise for a
student (bass clef, 3/4, rests, notes C to G, 72 bpm) can only describe it in words, and the
student has to rebuild it control by control. Nothing in the app reads `location.hash` or
`location.search`, and there is no share action.

The owner raised a business concern. Guidonica Studio, the paid product for teachers, is planned
as a main source of income. Would links that carry exercises make Studio less desirable? This
record weighs that concern before deciding.

## Evaluation: philosophy and business model

**What a free link must not replace.** Studio is defined by what the free app cannot do. It
exports video and PDF of a fixed exercise, it gives every student the *same* notes, and it
organizes classes. These are reproducible material, distribution and class management. A
settings link offers none of them. The generator stays ergodic and unseeded (AGENTS.md §1), so
two students who open the same link read *different* music under the same rules. Getting the
identical sequence, as a printable sheet, a video or a graded assignment, is still a Studio
feature.

**What the link does carry.** It carries only what the free UI already exposes, and a student
could rebuild it by hand in a minute. The link saves that minute and the explanation. It adds
no capability, so it removes nothing from Studio's offer.

**Why it helps the business.** Studio's buyers are teachers who already use Guidonica. A teacher
who can send "practise this" to a class makes the free app part of their teaching, and every
student who opens the link is a new user. Links are the cheapest acquisition channel the
project has (no account, no server, no ads). The teacher who outgrows them is the one who wants
the same exercise for everyone, a PDF for the lesson, or a video for the class channel, and
that is Studio.

**Why holding it back would not protect anything.** The app is AGPL. Any fork could add the
feature in an afternoon, so withholding it would only make the official app worse than its
forks.

**Philosophy.** The link puts the parameters in the URL *fragment*. Browsers never send the
fragment to a server, so there are no analytics, no tracking and no server state (ADR 0074 §2).
Search engines see no duplicate URLs. The decoder reuses the settings guards, so a link can
only produce an exercise the controls could produce.

**Boundary, recorded for future work.** Free links stay settings-only. Seeds, fixed note
sequences, assignments, progress reports and anything that makes two students see identical
music belong to Studio (AGENTS.md §3.7) and must not be added to this format.

## Decision

1. **Payload**: the exercise subset of `AppSettings`, typed `Exercise` in `src/share.ts`:
   tempo, meter, clef, ledger lines, note values (dotted included), tuplets, rests, ties,
   intervals, notes, note-name labels, compound pulse and count-in. These are the fields a level
   preset sets, plus clef, meter and pulse. Language, theme, click sound, volume, zoom and the
   playhead stay with each user.
2. **Format**: a URL fragment built by `URLSearchParams`, versioned by `x=1`, with short
   readable tokens and `.` as the list separator (never escaped):
   ```
   #x=1&clef=bass&meter=3-4&bpm=72&ledger=1-1&values=h.q.8&tuplets=3-8&rests=1&ties=0
     &int=1.2.3&notes=c.d.e.f.g&labels=none&pulse=dotted-quarter&countin=1
   ```
   Values are `w h q 8 16 32 dot`, intervals are numbered as musicians write them (1 = unison …
   8 = octave, 9 = ninth and wider), and tuplets are `<count>-<value>` (`3-8` is an eighth-note
   triplet).
3. **Decoding** (`decodeExercise`): returns null without `x=1`, so other fragments are left
   alone. Every field is checked on its own. A missing or unknown value keeps the user's current
   setting, unknown list tokens are ignored, tempo is clamped to 30–240 and ledger lines to
   `MAX_LEDGER_LINES`. The UI guards apply too: if no note value and no tuplet the meter supports
   is on, quarter turns on, and if no note is on, all notes load.
4. **Boot** (`bootstrap` in `src/main.ts`): `takeSharedExercise()` decodes `location.hash`
   before the app is built and removes the fragment with `history.replaceState`, so a reload
   doesn't re-apply it over later changes. The exercise is applied through
   `globalState.updateSettings` and saved like any other change. A link opened on a first visit
   skips the intro steps, since the exercise is already chosen, and marks the user onboarded.
   Pasting a new link into an open tab (`hashchange`) reloads the page so it boots the same way.
5. **Share button**: Settings → Practice → Share → "Exercise link". It calls
   `navigator.share` (title, text, URL) where it exists, and does nothing more when the user
   cancels (`AbortError`). Otherwise it copies the URL with `navigator.clipboard.writeText` and
   shows a status line, which hides on the next settings change. If the clipboard is refused, it
   falls back to `window.prompt` with the URL selected. All strings are keys in every locale
   (`share*`, ADR 0059).
6. **Service worker**: no change. The fragment never reaches the network or the cache key, so
   `/#x=1&…` is served by the same precached shell offline (ADR 0063).

## Consequences

- A teacher can send an exercise in any chat, and the student opens it with one tap, online or
  offline. The same rules give different music each time, which is the point of sight-reading.
- Opening a link replaces the recipient's exercise settings. That is the intent of a link, and
  the user can change them back at once, but their previous exercise is not kept.
- The format is public and versioned. Future fields must stay optional with a fallback, and a
  breaking change needs `x=2`. Version 1 links must keep loading.
- `tests/share.test.ts` round-trips every level preset in every clef and meter, checks that no
  personal preference leaks into a link, and covers clamping, unknown tokens and the guards.

# 0087. Rotating Tips

- **Status**: Accepted
- **Date**: 2026-10-06
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0055](0055-orientation-aware-auto-zoom-and-landscape-tip.md)

## Context & Problem Statement

Several features stay out of sight for less experienced users:
- the four Settings sections;
- the level presets behind the header Level button;
- pinch zoom and keyboard shortcuts;
- exercise links (ADR [0085](0085-shareable-exercise-links.md));
- offline install;
- the "What's new" history.

The Bluesky, Mastodon, Instagram and Ko-fi links are in About and in the footer. The footer is hidden at 960 px and below, so a phone user can only reach them through About.

Guidonica needs a way to point these out that does not interrupt practice, never runs a timer, adds no dependency, and can be switched off.

## Decision

1. **One tip per visit, from the second visit on.** At boot, `main.ts` shows one tip, but only when all of these hold:
   - `settings.showTips` is on;
   - it is not a first visit, which is the intro's job;
   - it is not a shared-link load (ADR 0085), where the sender's exercise comes first;
   - "What's new" is not opening (`boot.kind !== 'show'`, ADR 0078);
   - the landscape tip is not visible (`getComputedStyle(#orientation-notice).display === 'none'`, ADR 0055).

   A visit that shows no tip does not advance the rotation.
2. **Hiding.** The tip hides on its close button, on any action, when the Tips chip is turned off, and as soon as playback leaves `stopped` (`syncUI`, an early return when already hidden). It does not come back in the same visit; Reset does not re-show it.
3. **Opt-out.** `showTips` (default `true`, validated by `pickBool`) is a "Tips" chip in Settings → Practice → Assists. It is a personal preference like theme and sound, so it is not part of the exercise link payload.
4. **Rotation (`src/tips.ts`, pure, no DOM).** `TIP_COUNT_KEY` (`storageKey('tip_count_v1')`) holds $n$, the number of tips shown so far. `pickTip(n, ctx)` works as follows:
   - **Community slot.** Slot $n$ is a community slot when $(n+1) \bmod 4 = 0$ (`COMMUNITY_EVERY`). Its tip is `COMMUNITY_TIPS[⌊n/4⌋ mod 2]`, which alternates *follow* (the three social links) and *support* (Ko-fi). One tip in four asks for anything.
   - **Feature slot.** Any other slot uses the feature cursor $c = n - \lfloor (n+1)/4 \rfloor$, which counts only feature slots. The tip is `eligible[c mod |eligible|]`, where `eligible` is `FEATURE_TIPS` filtered by each tip's `when(ctx)`.
   - **Fallback.** If nothing is eligible, a community tip is returned.

   The plan was to walk the full list from `c mod |FEATURE_TIPS|` to the next eligible tip. Filtering first is better: walking would show the same tip on consecutive visits whenever ineligible tips sit just before it. With filtering, each eligible tip shows once per cycle and none repeats while eligibility holds.
5. **Eligibility depends only on settings and the device, never on tracked usage.**

   | tip | action | shown when |
   |---|---|---|
   | `levels` | open the level intro | always |
   | `labels` | Settings → Practice | labels are off |
   | `keys` | none | fine pointer with hover |
   | `clefs` | Settings → Staff | always |
   | `notes` | Settings → Melody | all seven notes are on |
   | `pinch` | none | coarse pointer |
   | `tuplets` | Settings → Rhythm | no tuplet cell is on |
   | `share` | Settings → Practice | always |
   | `restsTies` | Settings → Rhythm | rests or ties are off |
   | `pulse` | Settings → Staff | 6/8, 9/8 or 12/8 |
   | `install` | none | not running standalone |
   | `playhead` | Settings → Practice | the playhead is shown |
   | `whatsNew` | open "What's new" | always |

   `TipContext` reads three media queries, once, at boot:
   - `(pointer: coarse)`;
   - `(hover: hover) and (pointer: fine)`;
   - `(display-mode: standalone)` (or `navigator.standalone` on iOS).
6. **Placement.** `<aside id="tip-notice" class="stage-notice tip-notice" role="note" hidden>` sits next to the landscape tip in `main.canvas-wrapper`.
   - **Shared class.** The glass, geometry and `notice-in` animation of `.orientation-notice` moved into a shared `.stage-notice` class. `.orientation-notice` keeps only its portrait media-query display rule.
   - **Layout.** The tip sits at the top centre, away from the bottom-right zoom pill. It wraps (`flex-wrap`, body `flex: 1 1 220px`) to fit 390 px.
   - **Hidden rule.** `.tip-notice [hidden] { display: none }` is needed because `.btn { display: inline-flex }` would otherwise defeat the `hidden` attribute on the action slots.
7. **Actions.**
   - **Internal actions.** These use `#btn-tip-action`, labelled from the existing `settings`, `levelPresets` and `whatsNewButton` keys:
     - *settings* opens the drawer and scrolls `.section-<name>` into view (`block: 'nearest'`);
     - *levels* calls `openIntro(false)`;
     - *whatsNew* calls `openWhatsNew(null)`.
   - **External links.** The Ko-fi button and the three social icons are static HTML copied from the footer, with the same `href`/`rel`. JS only toggles `hidden`, so the privacy and `rel="me"` shell tests keep covering them.
8. **Text.** The text is set with `textContent` from `t().tips[id]`. `en.ts` types the table as `Record<TipId, { title; body }>`, so every locale must translate every tip. `applyTranslations()` re-renders a visible tip on a language switch.
9. **Tooling.**
   - The run-guidonica driver seeds `showTips: false` unless `--tips` is passed.
   - `pnpm banners` seeds `showTips: false`.

   This keeps screenshots and banners free of a tip over the staff.

## Consequences

- **Bundle.** The cost is +1.86 kB gzipped app JS (35.36 → 37.22 kB, mostly the English tip copy) and +0.07 kB CSS (8.29 → 8.36 kB). Each lazy locale chunk grows by about 0.75 kB (Italian: 4.90 → 5.64 kB). There is no per-frame cost and no timer; the only work is one `localStorage` read and write at boot.
- **Fixed share.** The community share is fixed at one in four by `COMMUNITY_EVERY`. Raising the share or adding a community tip is a one-line change in `src/tips.ts`, covered by `tests/tips.test.ts`.
- **Adding a tip.** A new feature tip needs:
  - an entry in `FEATURE_TIPS`;
  - a `TipId`;
  - `tips.<id>` in all five locales, which the compiler enforces.

  Tips that point to a Settings section must use that locale's section names in the body.
- **Rotation on settings changes.** Eligibility changes with the settings, so the rotation can skip ahead or step back when settings change between visits. This is harmless: the next visit still shows an eligible tip, and every eligible tip comes up within one cycle.
- **Tip count is per channel.** The count lives under the channel prefix (ADR 0078), so nightly and release rotate independently.

# 0039. Repository Audit: Ergodicity Restoration, Clock Unification, and Configuration Hygiene

- **Status**: Accepted
- **Date**: 2026-09-25
- **Author**: Claude & lauseta

## Context & Problem Statement

A full audit of the repository against the principles in `AGENTS.md` turned up four groups of problems.

1. **Ergodicity violations.** Several valid measures had zero probability:
   - `q h q` in 4/4, because only the `2+2` split existed.
   - Off-beat `8 q 8` in 3/4 unless `half` was on.
   - Four or more repeated notes, because of a hard unison cap at 2.
   - Leaps wider than 11 steps.
   - Ties were available only as the hard-coded `q~q` and `qd~qd` candidates.
   - Several tuplet matrix cells were silently ignored.
2. **A second visual clock.** The beat indicator was driven by `setTimeout`, independently of `AudioContext.currentTime`. Output latency (100–250 ms on Bluetooth) was not compensated.
3. **Visual-only changes regenerated the music.** Changing the theme, solfège mode, zoom, auto-zoom on resize or DPR called `buffer.reset()`, which re-rolled the measure under the playhead.
4. **Robustness and hygiene gaps:**
   - Storage spread unvalidated JSON over the defaults.
   - A legacy `subdivisions.triplets` flag had no UI.
   - Cmd/Ctrl shortcuts were hijacked.
   - The wake lock could stay held because of a race.
   - The AudioContext was resumed outside a user gesture.
   - Tests were not typechecked.
   - Meter, clef and tempo tables were duplicated in six places.

## Decisions & Implementation Methods

### 1. Single-source tables (`src/notation/types.ts`)
- `CLEFS` and `TIME_SIGNATURES` are `as const` arrays, and their union types are derived from them.
- `METER[ts] = { beatsPerMeasure, beatValue, secondsPerBeatFactor }`. For 6/8, `secondsPerBeatFactor = 0.5` because the tempo is quoted in quarter notes and 6/8 counts eighths.
- `MIN_TEMPO`, `MAX_TEMPO` and `clampTempo()`.
- `ClefPitchConfig.restPitch` replaces the per-clef rest switch.
- `TUPLET_SUPPORT: Record<TimeSignature, ReadonlySet<"name:value">>` is the only authority on which tuplet cells exist in each meter. `supportedTuplets(ts, opts)` filters any options object through it.

### 2. Ergodic generator (`src/notation/generator.ts`)
- **4/4**: the bar splits uniformly into `2+2` or `1+2+1`, so a 2-beat figure (h, qd 8, …) can start on beat 2. The `hd` patterns are no longer gated on `quarter`.
- **3/4**: the bar splits uniformly into `2+1`, `1+2` or `1+1+1` for every subdivision set.
- **Ties** are a post-pass, `applyTies(items, gridUnit)`, with `gridUnit = 3` eighths in 6/8 and `1` beat otherwise.
  - For each adjacent pair $(a, b)$ that are both non-rest and non-tuplet, with boundary $t = \sum_{i \le a} d_i$ satisfying $|t/g - \mathrm{round}(t/g)| < 10^{-9}$, set `a.tieStart = b.tieEnd = true` with $p = 0.25$.
  - Chains arise naturally.
  - Ties never cross the barline. `tieEnd` notes reuse the previous pitch, and the renderer skips their solfège label.
- **Unisons**: after $u$ consecutive unisons, the weight of a unison is $w_0 = 1/(1+u) > 0$, against 1 for each other interval class.
- **9+ leaps**: pick a direction with room $\ge 8$, then choose $\text{step} = 8 + \lfloor U \cdot (\text{maxStep} - 7) \rfloor$, so every leap in $[8, \text{maxStep}]$ has $P > 0$.
- **New 6/8 tuplets**:
  - Duplet ¼: `makeTupletItems(2,3,'q',6)`.
  - Quadruplet ¼: `(4,3,'q',6)`, both across the bar.
  - Duplet 1/16 and quadruplet 1/16: two groups of 1.5 eighths per compound beat.
  - The unreachable `q~q` / `qd~qd` candidates were removed.
- **UI**: unsupported cells are `disabled`, with a `Not available in <ts>` title. Their stored checked state is kept. The active-tuplet count covers only supported cells, so the "at least one subdivision" guard stays sound when the meter changes.

### 3. One hardware clock (`src/audio/metronome.ts`, `src/scroller/scroller.ts`)
- Removed `onBeat` / `dispatchBeat` / `pendingBeatTimeouts`.
- `getBeatInfo()` computes `{beatIndex, beatNumber, isDownbeat, isCountIn}` from $\lfloor \text{globalBeat} \rfloor$ with a positive modulo. It is polled from `ScrollerView.onFrame`, a hook at the end of the existing rAF frame.
- Visual time is $t_{\text{audible}} = \text{currentTime} - \lambda$, where $\lambda$ = `outputLatency || baseLatency || 0`. The audio scheduling side stays in raw context time. The pause snapshot and resume re-anchoring both use $t_{\text{audible}}$, so pause and resume stay continuous.
- `unlock()` creates and resumes the context synchronously in the user gesture, before any `await`. `visibilitychange` no longer resumes audio.

### 4. Re-render instead of regenerate (`src/scroller/buffer.ts`)
- `MeasureBuffer.rerender(settings)` re-rasterizes the retained `MeasureData` with the current zoom, DPR, theme and solfège mode. The generator is not touched.
- Theme, solfège, zoom, OS theme and DPR changes go through this path. Only an explicit session reset regenerates.

### 5. Robustness & hygiene
- Storage is rebuilt field by field with `pickEnum`, `pickBool`, `pickNumber` and `pickTuplets`, starting from `structuredClone` defaults.
  - A legacy `triplets: true` migrates to `tuplets.triplet['1/8']`.
  - Tempo is clamped.
- Keyboard shortcuts ignore any Meta, Ctrl or Alt chord.
- The wake lock tracks `wantHeld`. A sentinel that resolves after `release()` is released immediately.
- `tsconfig.json` now includes `tests` and `vite.config.ts` with `@types/node`. `vite.config.ts` uses `defineConfig` from `vitest/config`. `engines.node` is `>=22.13`. `pnpm-workspace.yaml` keeps only `allowBuilds`.

## Consequences

- Every figure named in the ergodicity principle is reachable. `tests/generator.test.ts` checks this empirically over N = 2000 measures, and checks every `(meter, tuplet cell)` pair for beat-sum conservation and shape.
- The playhead, beat dots and heard clicks share one timebase, including on high-latency outputs.
- Visual tweaks during practice no longer change the music being read.
- Tie density is a single constant (`TIE_PROBABILITY`). Adding a tuplet cell now needs an entry in `TUPLET_SUPPORT` plus a generator branch, and the test suite fails if either is missing.

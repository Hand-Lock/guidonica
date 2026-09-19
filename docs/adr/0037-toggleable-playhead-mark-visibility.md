# 0037. Toggleable Playhead Mark Visibility & Unassisted Sight-Reading Mode

- **Status**: Accepted
- **Date**: 2026-09-19
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Guidonica's core visual architecture streams procedurally generated musical notation from right to left across a stationary vertical playhead line. By design, noteheads cross this fixed horizontal coordinate ($x_{\text{playhead}}$) at the exact microsecond the metronome audio click sounds.

From a pedagogical perspective, the stationary playhead mark serves different functions across skill levels:
1. **Beginner / Guided Sight-Reading**: The crisp red cursor line and triangular pointers act as a vital spatial anchor, training students to associate physical screen positions with audible pulses and rhythmic subdivisions.
2. **Intermediate & Advanced / Unassisted Sight-Reading**: Advanced vocalists and instrumentalists frequently train without visual cursors ("blind" reading) to cultivate an internal pulse, eliminate visual fixation crutches, and practice horizontal forereading (scanning oncoming measures ahead of the sound) as if reading a continuous physical music scroll.

Previously, the red playhead line, background glow, and triangular markers were hardcoded into the scroller loop, with no mechanism to hide or toggle their visibility.

---

## Decisions & Implementation Methods

### 1. Separation of Coordinate Math and Visual Rendering
Guidonica strictly decouples the **spatial-temporal origin coordinate** ($x_{\text{playhead}}$) from the **visual cursor rendering** (`drawPlayhead`):
- **Invariance of Synchronization Math**:
  Regardless of playhead visibility, notes continue to be blitted according to the exact metric equation:
  $$\text{measureScreenX} = x_{\text{playhead}} - (O_{\text{note}} \times Z) + (m.\text{startBeat} - \text{visualBeat}) \times (m.\text{beatWidth} \times Z)$$
  Buffer lookahead, eviction thresholds, and downbeat audio alignment are completely unaffected.
- **Conditional Rendering**:
  In `ScrollerView.renderFrame()` and `ScrollerView.renderEmptyFrame()`, `this.drawPlayhead(ctx, h)` is guarded by `settings.showPlayhead !== false`. When disabled, the canvas avoids drawing the background gradient glow, the 2px red vertical stem, and the top and bottom guide triangles.

### 2. State Management & Persistent Storage
- Extended `AppSettings` with `showPlayhead: boolean;` (defaulting to `true` to maintain existing user expectations).
- Deserialization in `loadStoredSettings()` validates boolean values and safely falls back to `true` if missing or malformed.
- Persisted automatically to `localStorage` under `guidonica_settings_v1`.

### 3. User Interface & Skeuomorphic Aero Aesthetics
- **Settings Drawer Control**:
  Added a dedicated checkbox (`#toggle-playhead`) within `#controls-drawer` alongside existing musical modifiers (Count-In, Rests, Ties).
  Accompanied by a vector SVG playhead icon (`.icon-playhead`) colored with `--playhead-color` (`#e11d48` light / `#f43f5e` dark) depicting the top/bottom triangles and central stem.
- **Instant Idle & Paused Re-rendering**:
  Toggling the checkbox while stopped or paused immediately triggers `renderIdleFrame()`, allowing musicians to inspect the score with or without the line before starting playback.
- **Global Keyboard Shortcut (<kbd>P</kbd>)**:
  Mapped key `KeyP` to instantaneously toggle `showPlayhead`. The shortcut is guarded against firing when the user is focused inside text or number inputs (such as tempo).
- **Footer Hint Integration**:
  Added `<span><kbd>P</kbd> Playhead</span>` to the persistent keyboard shortcuts hint bar in the footer.

---

## Consequences

- **Pedagogical Versatility**: Musicians can seamlessly toggle between guided spatial practice and unassisted scroll reading.
- **Zero Performance Overhead**: Disabling the playhead saves sub-millisecond canvas draw operations per frame with zero impact on audio-visual timing or memory allocation.
- **Full Backward Compatibility**: Sessions default to `showPlayhead: true`, preserving the familiar look for all existing users.

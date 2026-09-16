# 13. Production Readiness, High-DPI Retina Pipeline & Audio Polish

Date: 2026-09-16

## Status
Accepted

## Context
Following a full repository audit, six critical defects and several pedagogical and sensory omissions were identified:
1. Keyboard accessibility: focused HTML form controls (checkboxes) had their default spacebar toggle overridden by global playback keydown handlers.
2. The measure ring-buffer eviction pipeline omitted tuplet options when computing `activeBeatWidth`, causing premature eviction of measures with wide tuplet beat widths.
3. Offscreen measure and pinned clef canvases were rasterized at $1\times$ CSS resolution rather than native device pixel ratio ($2\times$ on Retina displays), causing anti-aliased blurring on high-DPI hardware.
4. On mobile screens ($< 660\text{px}$), a fixed $22\%$ playhead fell within the $145\text{px}$ solid clef fade mask, occluding notes at the playhead.
5. The metronome lacked a volume slider, mute toggle, organic acoustic click option, and 6/8 compound pulse selection.
6. The repository had zero automated unit tests and no continuous integration.

## Decisions

### 1. High-DPI ($2\times$) Native Canvas Rasterization
- Offscreen measure canvases are allocated at `width * dpr` and `height * dpr`, where `dpr = window.devicePixelRatio || 1`.
- VexFlow's HTML5 Canvas context is pre-scaled by `ctx.scale(dpr, dpr)`.
- When blitted to the main viewport canvas via `drawImage`, source canvas pixels map 1:1 to hardware device pixels.
- The pinned clef is similarly rasterized at native resolution and cached per clef and active theme.

### 2. Spacebar Accessibility Fix
- The global keyboard handler checks if the active element is an `<input>` of type `'checkbox'` or `'radio'`. If so, default browser toggling is preserved and playback toggle is bypassed.

### 3. Playhead Margin Clearance
- The horizontal playhead coordinate enforces a minimum threshold:
  $$\text{playheadX} = \max(145\text{px} + 30\text{px},\, \text{round}(\text{viewportWidth} \times 0.22))$$
  guaranteeing that notes approaching the playhead are never occluded by the clef fade mask on mobile devices.

### 4. Audio Synthesis Polish & Compound 6/8 Pulse
- A master volume control ($0.0$ to $1.0$) and instant mute toggle are introduced via the master Web Audio `GainNode`.
- An organic acoustic woodblock sound profile is synthesized by applying an exponential frequency chirp ($1600\text{Hz} \rightarrow 800\text{Hz}$ on downbeats, $1100\text{Hz} \rightarrow 550\text{Hz}$ on regular beats) over a $25\text{ms}$ envelope.
- A 6/8 compound pulse mode (`dotted-quarter`) allows musicians to practice 6/8 with 2 clicks per measure (beats 1 and 4) while maintaining continuous eighth-note visual beat dots and scrolling velocity.
- An explicit iOS Safari audio resume guard is attached to `visibilitychange` listeners.

### 5. Pedagogical Solfège Syllable Overlay
- An optional overlay displays Solfège syllables (*Do, Re, Mi, Fa, Sol, La, Ti*) or note letter names centered beneath noteheads, sized and offset safely below the staff lines.

### 6. Theme Engine & Responsive Controls Drawer
- Full Dark Mode and Light Mode support with CSS custom properties (`data-theme="light"` / `data-theme="dark"`).
- On screens $< 960\text{px}$, controls collapse into an accessible slide-down drawer (`#controls-drawer`) toggled by a settings button, preserving full viewport height for the notation canvas.

### 7. Typed State Persistence & Automated Testing
- `localStorage` persistence saves all user preferences and restores them on load with defensive default merging.
- A comprehensive **Vitest** test suite covers rhythm partitioning, pitch bounds, consecutive unison constraints, tuplet formatting, beat width sizing, storage serialization, and metronome math.
- A GitHub Actions CI workflow automates typechecking, testing, and production builds.

## Consequences
- Music notation is razor-sharp on Retina screens and 4K monitors.
- Full keyboard accessibility and mobile responsiveness are restored.
- The audio experience is customizable and pleasant for extended sight-reading practice sessions.
- Regressions are prevented by automated continuous integration testing.

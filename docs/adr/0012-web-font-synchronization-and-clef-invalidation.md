# 0012. Web Font Loading Synchronization & Pinned Clef Cache Invalidation

- **Status**: Accepted
- **Date**: 2026-09-16
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

When users first launched the application or reloaded the page in the browser, severe musical notation rendering anomalies were observed:
1. **Initial Page Launch**: The notation stream showed blank rectangles (tofu) in place of noteheads, accidentals, rests, and the pinned clef.
2. **Page Reload**: After reloading the page from the browser, noteheads and rests began rendering correctly, but the pinned clef remained a blank rectangle.
3. **Dropdown Clef Switch**: Only after switching the Clef selector dropdown at least once in the UI did the pinned clef and noteheads suddenly render correctly.

---

## Root Cause Analysis

### 1. Asynchronous Font Decoding vs. Synchronous Canvas Rendering
VexFlow 5 utilizes standard SMuFL web fonts (`Bravura` for music notation glyphs and `Academico` for text) to render glyphs onto HTML5 Canvas via `CanvasRenderingContext2D.fillText()`.
- The font assets are bundled as base64 data URIs within VexFlow and loaded using the browser's `FontFace` API (`new FontFace(fontName, url, descriptors).load()`).
- Although the font data is client-side, base64 decoding and font rasterizer registration by the browser font engine is strictly **asynchronous** (`Promise<FontFace>`).
- In `src/main.ts`, the application bootstrap previously executed synchronously inside `window.addEventListener('DOMContentLoaded', () => { new SolfegeScrollerApp(); })`.
- During the synchronous constructor execution at $t = 0\text{ ms}$, `resetBuffer()` immediately invoked `this.buffer.ensureAhead(0, 16, settings)` and `this.scroller.renderFrame(settings)`.
- At this exact moment, the `Bravura` font was not yet registered in the active font subsystem (`document.fonts.check('20px Bravura')` returned `false`).
- When `ctx.fillText(glyphCode, x, y)` was called for SMuFL private-use Unicode codepoints (e.g., `\uE050` for G clef, `\uE0A4` for black notehead), the browser canvas engine fell back to a system font lacking SMuFL characters, painting missing glyph tofu (blank rectangles).
- Because `MeasureRenderer` draws to offscreen canvas bitmaps, those blank rectangles were permanently rasterized into the initial measure canvases and the pinned clef canvas.

### 2. Pinned Clef Canvas Cache Staleness
In `ScrollerView`:
```typescript
private drawPinnedClef(ctx: CanvasRenderingContext2D, clef: Clef, height: number): void {
  if (!this.pinnedClefCanvas || this.cachedClef !== clef) {
    this.pinnedClefCanvas = this.renderer.renderPinnedClef(clef);
    this.cachedClef = clef;
  }
  ...
}
```
- During initial frame rendering, `this.pinnedClefCanvas` was null, so `renderPinnedClef(clef)` executed before `Bravura` was ready, drawing a blank rectangle.
- `this.pinnedClefCanvas` was assigned this corrupted canvas, and `this.cachedClef` was set to `'treble'`.
- Subsequently, neither `resetSession()` nor `resetBuffer()` ever cleared or invalidated `this.pinnedClefCanvas`.
- On browser reload, warm browser caching allowed newly streamed measures in `MeasureBuffer` to pick up the decoded font, but `this.pinnedClefCanvas` was already non-null with `this.cachedClef === 'treble'`. As a result, the pinned clef was never re-rendered.
- Only when the user manually changed the Clef dropdown did `this.cachedClef !== clef` evaluate to `true`, forcing `renderPinnedClef` to re-execute with the font fully loaded.

---

## Decisions & Implementation Methods

### 1. Dedicated Font Readiness Module (`src/notation/fonts.ts`)
We introduced `waitForMusicFonts()` and `isMusicFontReady()` to manage font synchronization with the browser's CSS Font Loading API:
```typescript
export function isMusicFontReady(): boolean {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return true;
  }
  return document.fonts.check('20px Bravura');
}

export async function waitForMusicFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return;
  }

  if (document.fonts.check('20px Bravura') && document.fonts.check('20px Academico')) {
    return;
  }

  try {
    await Promise.all([
      document.fonts.load('20px Bravura'),
      document.fonts.load('20px Academico'),
      document.fonts.ready,
    ]);
  } catch {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  }

  const maxWaitMs = 2000;
  const startTime = performance.now();
  while (!isMusicFontReady() && performance.now() - startTime < maxWaitMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, 16));
  }
}
```
- **Rationale**: Uses `document.fonts.check('20px Bravura')` to synchronously verify whether the SMuFL font is actually ready for 2D canvas text rendering.
- `document.fonts.load()` explicitly cues the browser to resolve the font face, and `document.fonts.ready` guarantees resolution of all pending `FontFace` loads.

### 2. Clean Idle Viewport Rendering During Font Initialization
- Instead of attempting to render notation measures before fonts are available, `ScrollerView` introduces `renderEmptyFrame()`:
  - Renders the white background, 5 stationary staff lines, and playhead indicator directly with native canvas drawing primitives (which do not depend on any font).
  - The UI presents a clean, polished stave instantly at $t = 0\text{ ms}$ without any missing glyph artifacts.

### 3. Asynchronous App Initialization & Playback Guard
In `src/main.ts`:
- The constructor wires up DOM listeners and renders the empty stave frame, then triggers `this.fontInitPromise = this.initFonts()`.
- `initFonts()` awaits `waitForMusicFonts()` before calling `resetBuffer()`, populating the measure buffer and rendering the pinned clef only when glyphs can be faithfully rasterized.
- `togglePlayback()` awaits `this.fontInitPromise` if the user clicks Play or presses Space before font initialization completes.

### 4. Explicit Pinned Clef Cache Invalidation & Rendering Guard
- In `ScrollerView`:
  - Added public `invalidatePinnedClef(): void { this.pinnedClefCanvas = null; this.cachedClef = null; }`.
  - `drawPinnedClef()` checks `if (!isMusicFontReady()) return;` before creating or caching any clef canvas.
  - `handleResize` calls `this.invalidatePinnedClef()`.
- In `MeasureBuffer`:
  - `ensureAhead()` checks `if (!isMusicFontReady()) return;` to avoid populating the ring-buffer with corrupt fallback glyphs.
- In `main.ts`:
  - `resetBuffer()` calls `this.scroller.invalidatePinnedClef()` on every reset.

---

## Consequences & Verification

- **Zero Blank Rectangles on Cold Launch**: On initial launch, the notation stream renders noteheads, accidentals, flags, barlines, and clefs with 100% fidelity.
- **Flawless Reload Behavior**: Refreshing the browser preserves crisp noteheads and an immediate, valid pinned clef without needing any user interaction.
- **Clef Switching Redundancy Removed**: The clef works out of the box; switching clefs continues to operate smoothly as an intentional user option rather than a bug workaround.
- **Verification**:
  - Tested cold launch and hard reloads across browser viewports; glyphs render immediately once fonts resolve.
  - Tested playback triggering during initial load; cleanly waits for font readiness before streaming.
  - Tested rapid clef, tempo, meter, interval, and subdivision switching; cache invalidation works reliably.
  - Typecheck (`tsc --noEmit`) passes with 0 errors.
  - Production build (`vite build`) succeeds cleanly.

# 28. Device-Adaptive Zoom & Sight-Reading Forereading

Date: 2026-09-18

## Status
Accepted

## Context
In music sight-reading, **forereading** (anticipatory reading ahead of the audible pulse) is the core pedagogical skill: musicians must visually recognize and prepare upcoming intervals, contours, and rhythmic groupings before they cross the playhead.

Prior to this decision, Guidonica defaulted to a static zoom level of `1.0` (100%) on all hardware. While 100% zoom functions well on desktop displays ($W \ge 1200\text{ px}$)—providing 2 to 3 full measures ahead of the playhead—on compact mobile viewports such as an iPhone 13 Mini in Portrait mode ($W = 375\text{ px}$), a standard 4/4 measure with 8th notes ($520\text{ px}$) could not even fit across the screen at 100% zoom, leaving only ~0.3 measures visible ahead of the playhead. Sight-reading under these conditions was nearly impossible without manually zooming out.

Furthermore, `MIN_ZOOM` was capped at `0.5` (50%). Under dense rhythmic subdivisions (such as 16th notes where an unscaled measure is $880\text{ px}$ or fast tuplets reaching $1120\text{ px}$), even 50% zoom ($440\text{ px}$) exceeded the horizontal screen width of compact mobile phones ($375\text{ px}$).

The objective was to introduce a device-adaptive zoom system that:
1. Automatically computes the exact mathematical zoom scale that guarantees at least one full measure is visible at once across the staff for proper forereading.
2. Retains the canonical `1.0` (100%) zoom on larger screens (desktop/tablet) where multiple measures naturally fit, serving as a forced default minimum.
3. Keeps 100% zoom as the fixed, objective standard notation scale across the app without altering UI proportions.
4. Lowers `MIN_ZOOM` from `0.5` (50%) to `0.3` (30%) so dense rhythmic measures fit cleanly on compact mobile viewports without truncation.
5. Intelligently distinguishes between `'auto'` and `'manual'` zoom modes, preserving user manual adjustments while providing an intuitive one-tap return to the optimal device auto-fit.

## Decisions

### 1. Mathematical Formulation of Optimal Measure Zoom
For a measure with unscaled width $W_{\text{measure}} = \text{beatsPerMeasure} \times \text{computeBeatWidth}(\text{subdivisions}, \text{timeSignature}, \text{tuplets})$, and a viewport width $W$:
The stationary pinned header solid mask occupies $H_{\text{mask}} \times Z$ where $H_{\text{mask}} = 135\text{ px}$.
The maximum zoom scale $Z_{\text{fit}}$ at which a full measure fits across the visible unmasked stave is:
$$Z_{\text{fit}} = \frac{W}{W_{\text{measure}} + 135}$$

To maintain clean stepped increments and guarantee integer-scaled pentagram line spacing without pixel jitter or uneven line gaps, this value is quantized to the nearest $10\%$ ($0.10$) increment:
$$Z_{\text{stepped}} = \frac{\lfloor 10 \times Z_{\text{fit}} + 0.5 \rfloor}{10}$$

On larger screens where multiple measures fit ($Z_{\text{stepped}} \ge 1.0$), the default zoom is capped at $1.0$ ($100\%$). It is clamped between $\text{MIN\_ZOOM} = 0.3$ and $\text{MAX\_ZOOM} = 1.5$:
$$Z_{\text{optimal}} = \max(0.3, \min(1.0, Z_{\text{stepped}}))$$

Empirical & theoretical results:
- **iPhone 13 Mini in Portrait ($W = 375\text{ px}$)**:
  - 4/4 meter with 8th notes ($W_{\text{measure}} = 520\text{ px}$): $Z = 375 / (520 + 135) = 0.5725 \to \mathbf{60\%}$ (measure width: $520 \times 0.6 = 312\text{ px} \le 375\text{ px}$, line spacing: $6\text{ px}$ uniform across all 4 spaces).
  - 4/4 meter with 16th notes ($W_{\text{measure}} = 880\text{ px}$): $Z = 375 / (880 + 135) = 0.3695 \to \mathbf{40\%}$ (measure width: $880 \times 0.4 = 352\text{ px} \le 375\text{ px}$, line spacing: $4\text{ px}$).
  - 2/4 meter with quarter notes ($W_{\text{measure}} = 220\text{ px}$): $Z = 375 / (220 + 135) = 1.056 \to \mathbf{100\%}$.
- **iPhone 13 Mini in Landscape ($W = 812\text{ px}$)**:
  - 4/4 meter with 8th notes: $Z = 812 / 655 = 1.239 \to \mathbf{100\%}$.
- **Desktop ($W \ge 1200\text{ px}$)**:
  - 4/4 meter with 8th notes: $Z = 1200 / 655 = 1.832 \to \mathbf{100\%}$.
- **iPad Portrait ($W = 768\text{ px}$)**:
  - 4/4 meter with 8th notes: $Z = 768 / 655 = 1.17 \to \mathbf{100\%}$.
  - 4/4 meter with 16th notes: $Z = 768 / 1015 = 0.7566 \to \mathbf{80\%}$ ($880 \times 0.8 = 704\text{ px} \le 768\text{ px}$, line spacing: $8\text{ px}$).
- **6/8 Compound Meter ($W = 375\text{ px}$)**:
  - 8th notes ($W_{\text{measure}} = 480\text{ px}$): $Z = 375 / 615 = 0.6098 \to \mathbf{60\%}$.
  - 16th notes ($W_{\text{measure}} = 660\text{ px}$): $Z = 375 / 795 = 0.4717 \to \mathbf{50\%}$.

### 2. Pixel-Perfect Pentagram Line Spacing via Integer Scaling
In standard Western music notation rendered with VexFlow, stave line spacing is defined as 10 units. Under a continuous zoom factor $Z$, the vertical gap between lines on screen is $s(Z) = 10 \times Z$.
When $Z$ is not a multiple of $0.1$ (such as $0.55$), $s(0.55) = 5.5\text{ px}$. When rounded to device pixels, lines fall at offsets $[0, 6, 11, 17, 22]$, causing the 4 spaces between the 5 stave lines to alternate in thickness ($6\text{ px}, 5\text{ px}, 6\text{ px}, 5\text{ px}$), which appears visibly non-uniform and causes eye fatigue during sight-reading.

By restricting and quantizing all zoom values to multiples of $0.10$ ($10\%$ steps: $0.3, 0.4, 0.5, \dots, 1.5$):
1. $s(Z) = 10 \times Z \in \{3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15\}\text{ px}$ is always an exact integer.
2. In `ScrollerView`, the stave lines are positioned using:
   $$y_k = \text{startY} + k \times \text{lineSpacing} + 0.5 \quad (k \in [0, 4])$$
   where $\text{startY} = \lfloor \text{centerY} - 2 \times \text{lineSpacing} \rfloor$.
3. All 4 spaces between the 5 lines have an identical pixel height of exactly $\text{lineSpacing}$, guaranteeing pixel-perfect pentagram uniformity without aliasing or jitter across all supported zoom scales.

### 3. Expanded Dynamic Range (`MIN_ZOOM = 0.3`)
`MIN_ZOOM` was lowered from `0.5` to `0.3` (30%). On modern High-DPI mobile devices (e.g. Retina `@3x`), rendering at $0.3\times$ to $0.4\times$ zoom yields $3 \times 0.4 = 1.2\times$ physical device pixel mapping, maintaining crisp notation glyphs without blurring or subpixel artifacts. The settings slider range was updated to `min="30" max="150" step="10"`.

### 4. State & Mode Separation (`auto` vs `manual`)
`AppSettings` tracks both `zoom: number` and `zoomMode: 'auto' | 'manual'`:
- In `'auto'` mode (default):
  - On application bootstrap, `computeOptimalZoom` computes the appropriate scale for the active screen resolution and meter.
  - When the device rotates (Portrait $\leftrightarrow$ Landscape) or when the user changes meter, subdivisions, or tuplets, the app automatically updates the zoom level.
  - The drawer `Auto` button displays active skeuomorphic luminescence.
- In `'manual'` mode:
  - Triggered whenever the user directly drags the zoom slider, taps `[-]` / `[+]`, pinches on the canvas, or uses `+` / `-` keyboard shortcuts.
  - Preserves the user's explicit zoom preference.
  - The drawer `Auto` button dims to secondary glass.
- Returning to Auto:
  - Tapping the `Auto` button in the drawer, clicking the center zoom percentage label on the floating canvas pill, or pressing keyboard shortcut <kbd>0</kbd> instantly returns to `'auto'` mode and recalculates the screen-optimal fit.

### 5. Zero-Drift & Memory Discipline Invariance
Because `computeOptimalZoom` produces a standard scalar $Z \in [0.3, 1.5]$, all mathematical invariants established in ADR 0025 are preserved:
- Screen beat width scales linearly: $W_{\text{beat}}(Z) = W_{\text{beat}} \times Z$.
- Measure screen position formula remains exact; noteheads cross the playhead at the microsecond of the audio pulse.
- Ring-buffer lookahead beats scale dynamically: $(W - \text{playheadX}) / (W_{\text{beat}} \times Z) + 6$.
- Zero audio-visual drift.

## Consequences
- Musicians practicing on small mobile devices (like the iPhone 13 Mini) immediately have an optimal sight-reading experience with at least one full measure visible for forereading.
- Desktop users experience zero disruption; notation continues to default to 100% with multiple measures visible.
- Switching meters or subdivisions on mobile automatically adjusts zoom to preserve measure visibility.
- Musicians retain full manual zoom control whenever desired, with single-touch return to auto-fit.
- Zero external libraries or framework dependencies added; 100% vanilla TypeScript and pure CSS3 Liquid Glass.

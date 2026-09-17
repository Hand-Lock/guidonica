# 25. In-App Notation Zoom & Mobile Ergonomics

Date: 2026-09-18

## Status
Accepted

## Context
When sight-reading music or practicing solfège, musicians have varying visual requirements depending on their instrument, reading distance, and device:
1. **Broader Measure Horizon**: Looking ahead 3 to 4 measures allows sight-readers to anticipate incoming phrases, leaps, and rhythmic transitions. Previously, the only way to achieve this was browser-level zooming (`Cmd -`), which shrunk the app header, buttons, sliders, beat dots, and fonts, breaking touch targets on mobile and distorting UI proportions.
2. **Mobile Constraints**: Mobile browsers restrict or make page-level zooming cumbersome, often inducing horizontal page panning or layout jank.
3. **Distance Practice (Instrument Stands)**: When placed on a piano desk or music stand several feet away, musicians need larger notation (zooming in to 125%–150%) without enlarging the UI controls.

The goal was to introduce an in-webapp zoom control exclusively for the notation stream, maintaining zero bloat, zero dependencies, 1:1 High-DPI sharpness, mathematical zero-drift audio-visual synchronization, and intuitive mobile touch ergonomics.

## Decisions

### 1. Mathematical Linearity & Zero-Drift Coordinate Transformation
Visual motion and metronome audio clicks remain linked to `AudioContext.currentTime`. Under a zoom factor $Z \in [0.5, 1.5]$:
- Screen beat width scales linearly:
  $$W_{\text{beat}}(Z) = W_{\text{beat}} \times Z$$
- Measure screen position is given by:
  $$\text{measureScreenX} = \text{playheadX} - (\text{NOTE\_START\_OFFSET} \times Z) + (m.\text{startBeat} - \text{currentGlobalBeat}) \times (m.\text{beatWidth} \times Z)$$
- When $\text{currentGlobalBeat} = m.\text{startBeat} + b_j$, the screen X coordinate of note $j$ is identically $\text{playheadX}$ for all values of $Z$. Auditory clicks and visual crossings remain synchronized to the microsecond.

### 2. High-DPI ($1:1$) Subpixel Native Rasterization
Rather than downscaling or upscaling a fixed-size canvas via bilinear interpolation (which would blur thin staff lines and note stems), `MeasureRenderer` allocates offscreen canvases directly at:
$$\text{canvas.width} = \max(1, \lfloor \text{data.width} \times \text{dpr} \times Z \rfloor)$$
$$\text{canvas.height} = \max(1, \lfloor \text{MEASURE\_CANVAS\_HEIGHT} \times \text{dpr} \times Z \rfloor)$$
and pre-scales VexFlow's canvas context by $\text{dpr} \times Z$. When blitted to the viewport canvas (which is scaled by $\text{dpr}$), source canvas pixels map $1:1$ to hardware device pixels at every zoom level.

### 3. Vertical Staff Line & Clef Alignment
The 5 stationary staff lines drawn across the viewport by `ScrollerView` are spaced by $10 \times Z$.
- Staff center line (line 2) is positioned at the viewport vertical center $Y_{\text{center}} = \lfloor H / 2 \rfloor$.
- Top staff line (line 0) is at:
  $$\text{staveTopY}(Z) = Y_{\text{center}} - 20 \times Z$$
- Measure canvas top is at:
  $$\text{measureDrawY}(Z) = Y_{\text{center}} - 100 \times Z$$
This aligns VexFlow's line $k$ at $\text{measureDrawY}(Z) + (80 + 10k) \times Z = Y_{\text{center}} + (k - 2) \times 10 \times Z$, matching the stationary staff lines with exact mathematical precision.

### 4. Bounded Ring Buffer Scaling
The buffer lookahead and eviction boundaries scale inversely with $Z$:
$$\text{lookaheadBeats} = \frac{W - \text{playheadX}}{W_{\text{beat}} \times Z} + 6$$
$$\text{minVisibleBeat} = \text{currentGlobalBeat} - \frac{\text{playheadX}}{W_{\text{beat}} \times Z} - 2$$
At $50\%$ zoom, twice as many measures are buffered to saturate the wider view, while evictions ensure offscreen measures are immediately released from memory.

### 5. Multi-Modal Ergonomics & Pure CSS3 Liquid Glass
Zoom is accessible via four complementary interactions without touching browser scaling:
1. **On-Canvas Floating Glass Pill (`#canvas-zoom-pill`)**: Positioned at bottom-right of the notation viewport using pure CSS3 Liquid Glass (`[-] 100% [+]`). Tapping `[-]` or `[+]` steps by $\pm 10\%$, and clicking the label resets to $100\%$.
2. **Settings Drawer Integration**: A slider ($50\%$ to $150\%$, step $5\%$) with stepper buttons and $100\%$ reset button.
3. **Keyboard Shortcuts**: `+` / `=` zooms in ($+10\%$), `-` / `_` zooms out ($-10\%$), and `0` resets to $100\%$.
4. **Mobile Two-Finger Touch Pinch-to-Zoom**: Two-finger touch gestures on the canvas calculate the pinch distance ratio against initial touch distance, smoothly scaling notation without triggering browser page zoom.
5. **Session Persistence**: Stored in `localStorage` under `guidonica_settings_v1` and restored upon reload.

## Consequences
- Musicians can view 2x more measures at 50% zoom, or enlarge notation up to 150% for distant reading.
- The UI chrome, buttons, fonts, and controls remain crisp and at standard 100% scale.
- Zero audio-visual drift during playback.
- Subpixel crispness on Retina displays.
- Zero external dependencies or framework bloat added.

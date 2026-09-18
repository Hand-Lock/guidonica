# 30. Stacked Count-In Indicator and Mobile Traffic Lights Geometry

Date: 2026-09-18

## Status
Accepted

## Context
Guidonica features a luminous beat indicator capsule ("traffic lights") in the primary navigation bar (`.primary-bar`), containing dynamic skeuomorphic LED glass spheres (`.beat-dot`) that pulse in synchronization with metronome beats.

When count-in is active, a red pulsating badge (`#count-in-badge`) informs the musician that the metronome is currently ticking pre-performance preparation beats before notation begins scrolling.

Previously, `#count-in-badge` was laid out horizontally adjacent to `#beat-dots` inside `.beat-indicator-container` (`display: flex; align-items: center; gap: 10px;`). When count-in started, the badge became visible, expanding the container's horizontal width by ~70px (from ~97px to ~167px in 4/4 meter).

On mobile viewports (e.g. 375px–414px width on smartphones), the primary navigation bar has `flex-wrap: wrap`. Because horizontal space on small screens is strictly constrained, this sudden 70px expansion exceeded the remaining line clearance on Row 2 (shared with the tempo control), forcing the traffic lights element to wrap ("get dragged on the next space") onto Row 3. Once count-in concluded, the badge hid, the container shrank back by 70px, and the traffic lights abruptly snapped back up to Row 2. This jarring geometric jump distracted musicians right at the exact moment musical performance began.

---

## Decisions

### 1. Invariant Horizontal Frame Geometry
We decoupled the `#count-in-badge` from the normal horizontal document layout flow.
- The glass capsule (`.beat-indicator-container`) frames **strictly** the beat dots (`#beat-dots`).
- The horizontal width of `.beat-indicator-container` is invariant to count-in state:
  $$W_{\text{container}} = 2 \times P_{\text{horizontal}} + N_{\text{dots}} \times W_{\text{dot}} + (N_{\text{dots}} - 1) \times G_{\text{dot}}$$
  For 4/4 meter ($N_{\text{dots}} = 4$):
  $$W_{\text{container}} = 2 \times 12\text{px} + 4 \times 13\text{px} + 3 \times 7\text{px} = 24 + 52 + 21 = 97\text{px}$$
- This width is identical whether count-in is enabled, running, paused, or stopped.

### 2. Top-Stacked Absolute Positioning
The `#count-in-badge` is repositioned vertically **on top** of the traffic lights capsule using absolute centering:
```css
.beat-indicator-container {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 12px;
  background: var(--beat-container-bg);
  border-radius: 20px;
  border: 1px solid var(--beat-container-border);
  box-shadow: var(--beat-container-shadow);
}

.badge-count-in {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
  background: var(--danger);
  color: #ffffff;
  font-family: var(--font-family);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.8px;
  line-height: 1.2;
  animation: pulse 0.5s infinite alternate;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 5;
}
```

### 3. Copy Standardization
The badge text in `index.html` was standardized to `COUNT-IN` with a hyphen, ensuring crisp, punchy legibility above the capsule.

---

## Consequences

1. **Zero Layout Shifts**: The traffic lights element maintains an invariant width and screen position at all times. On mobile and desktop alike, starting or ending a count-in causes zero line-wrapping or adjacent element movement.
2. **Clear Sightline**: Positioned at `bottom: calc(100% + 4px)` above the capsule, the badge does not obscure the active beat dots, which freely scale (`transform: scale(1.28)`) and project their radial glow.
3. **Ergonomic Visual Balance**: The top-stacked badge aligns naturally with the uppercase label line of adjacent control groups (such as the `TEMPO: 60 BPM` label), creating a balanced, cohesive ribbon hierarchy.
4. **Suckless Compliance**: Achieved through pure CSS positioning math without adding any JavaScript layout calculations, libraries, or virtual DOM wrappers.

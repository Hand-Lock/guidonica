# 33. Fullscreen API Capability Detection & Selective UI Presentation

Date: 2026-09-18

## Status
Accepted

## Context
On desktop browsers (Chromium, Firefox, Safari) and modern iPadOS (16.4+), Guidonica's fullscreen button (`#btn-fullscreen-toggle`) functions as intended by invoking the W3C Fullscreen API (`document.documentElement.requestFullscreen()`).

However, on iOS Safari on iPhone (and any webview or sandboxed iframe where DOM element fullscreen is disabled), the W3C Fullscreen API is explicitly unsupported by Apple:
- Apple strictly restricts fullscreen on iPhone to `<video>` elements (`HTMLVideoElement.webkitEnterFullscreen()`) to avoid phishing/spoofing risks and edge-gesture collisions.
- Calling `document.documentElement.requestFullscreen()` on iPhone Safari throws a synchronous runtime exception (`TypeError: document.documentElement.requestFullscreen is not a function`) because `requestFullscreen` is `undefined`.
- Displaying a broken, non-functional button in the primary header utility bar violates user expectations and UI quality standards.
- Rather than attempting complex pseudo-fullscreen or intrusive interface alterations, the most elegant and suckless solution is to recognize when the running device and browser do not support the Fullscreen API and gracefully hide the button altogether.

## Decisions

### 1. Robust Three-Tier Capability Detection
A dedicated, strictly typed helper method `isFullscreenSupported()` was introduced to `GuidonicaApp`:

1. **Explicit Mobile Phone Exclusion (`/iPhone|iPod/i`)**:
   - WebKit on iPhone and iPod touch does not support arbitrary DOM element fullscreen across any browser (Safari, Chrome, or Firefox on iOS). Detecting this form factor ensures immediate, defensive exclusion on devices where the API can never succeed.
2. **Permission & Policy Flags (`document.fullscreenEnabled` & `webkitFullscreenEnabled`)**:
   - The W3C specification defines `document.fullscreenEnabled` as a boolean reflecting whether fullscreen mode is allowed by document policy. If present and `false` (e.g. inside a sandboxed `<iframe>` without `allow="fullscreen"` or blocked by permissions policy), fullscreen is treated as unsupported.
3. **Callable DOM Element Method Verification**:
   - Directly checks that `requestFullscreen` or `webkitRequestFullscreen` on `document.documentElement` is an executable `function`.

### 2. Clean Selective UI Hiding
- When `!isFullscreenSupported()`:
  - The application applies `.hidden` (`display: none !important;`) to `#btn-fullscreen-toggle`.
  - Sets `aria-hidden="true"` and `tabIndex = -1` to remove the element from screen reader flows and keyboard navigation.
  - Because the header `.utility-actions` bar uses flexbox (`display: flex`), the remaining buttons (Theme toggle, Settings drawer, About modal, GitHub link) smoothly reflow with zero visual gaps or layout shift.
- When supported:
  - The click listener supports both standard and WebKit-prefixed methods (`requestFullscreen`/`webkitRequestFullscreen` and `exitFullscreen`/`webkitExitFullscreen`).
  - Event listeners on `fullscreenchange` and `webkitfullscreenchange` dynamically update the button glyph (`⛶` vs `🗗`), title, and `aria-label`.

## Consequences

### Positive
- **Zero Dead Buttons**: Users on iPhone Safari and restricted environments will never see or tap a non-functioning fullscreen button.
- **Flawless Layout Reflow**: The utility actions bar naturally adapts with zero layout disruption.
- **Cross-Browser WebKit Resilience**: Older Safari, WebKit webviews, and iPadOS devices with vendor prefixes are handled seamlessly.
- **Ultra-Lightweight & Suckless**: Implemented in ~35 lines of vanilla TypeScript with zero external dependencies, zero CSS bloat, and sub-millisecond execution.

### Considerations
- On iPads running iPadOS 16.4+, `document.documentElement.requestFullscreen` is supported; therefore, the fullscreen button remains visible and functional on those devices.

# ADR 0020: In-App License and Repository Presentation Architecture

## Status
Accepted

## Date
2026-09-17

## Context
Following the formal adoption of the **GNU Affero General Public License v3.0 or later (`AGPL-3.0-or-later`)** in ADR 0019, users interacting with **Guidonica** need clear, prominent, and native in-app access to:
1. The full legal license terms and copyright notice.
2. The official GitHub source code repository.
3. An explanation of the strict copyleft requirements and remote network interaction obligations (Section 13 of the AGPLv3).

In addition, because Guidonica is a responsive client-only web tool that runs across desktop monitors, tablets, and mobile devices (where viewports `<= 960px` collapse the bottom keyboard shortcuts hint and drawer controls), license presentation must be:
- Readily discoverable on both desktop and mobile viewports.
- Keyboard accessible without interfering with ongoing musical practice shortcuts (such as `Space` for playback and `R` for session reset).
- Native and framework-free, adhering strictly to the repository's Suckless vanilla TypeScript philosophy without third-party modal libraries.

## Decisions & Implementation

### 1. Direct GitHub Top-Bar Anchor
In the desktop and mobile primary header (`.utility-actions`), added a direct repository icon anchor:
```html
<a id="btn-github-link" class="btn-icon-only btn-github" href="https://github.com/Hand-Lock/guidonica" target="_blank" rel="noopener noreferrer" aria-label="GitHub Repository" title="GitHub Repository & AGPLv3 License">
  <svg class="nav-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
    ...
  </svg>
</a>
```
This guarantees that regardless of drawer or viewport state, a direct link to the upstream source code is immediately available in the viewport header.

### 2. Multi-Surface "About & License" Entrypoints
To ensure comprehensive accessibility across various user journeys, three distinct UI entrypoints were integrated:
1. **Primary Utility Bar**: An `ℹ️` icon button (`#btn-about-toggle`) directly beside the theme and fullscreen buttons.
2. **Settings Drawer**: A dedicated full-width button (`#btn-drawer-about`) at the bottom of the drawer menu, visible to all users customizing playback or reading on mobile devices.
3. **Shortcuts Footer**: Updated desktop footer text links (`#btn-footer-about` and external GitHub link).

### 3. Native HTML `<dialog>` Modal Architecture
To minimize bundle size and eliminate framework modal overhead, the modal was implemented using the native HTML5 `<dialog id="modal-about" class="about-dialog">` API:
- **`dialog.showModal()`**: Activates the native browser modal behavior, rendering on the top layer above canvas blitting and control panels.
- **`dialog::backdrop`**: Rendered with subtle dark translucency (`rgba(0, 0, 0, 0.5)`) and hardware-accelerated background blur (`backdrop-filter: blur(3px)`).
- **Keyboard Shortcut Isolation**: In `MainApp.bindKeyboardShortcuts()`, an active modal guard was introduced:
  ```typescript
  if (this.modalAbout && this.modalAbout.open) {
    return; // Preserve text selection and standard dialog keystrokes
  }
  ```
  This prevents spacebar or arrow keys from toggling playback or altering tempo while inspecting license terms.
- **Escape Key & Backdrop Dismissal**: Native browser `Escape` key handling automatically closes the modal; a backdrop click listener provides standard outside-click dismissal.

### 4. Content Structure & Transparency
The modal presents:
- **Software Identity**: Name, description, and version.
- **Authorship & Copyright**: Attributed to `A. C. Lo Cascio`.
- **License Badge**: `GNU AGPLv3` (Strict Copyleft).
- **Plain-Language Reciprocity Summary**: Clarifies that modifications deployed over a network must provide complete source code under AGPL-3.0 Section 13.
- **Direct Hyperlinks**: Direct link to the repository root and to the raw `LICENSE` file on GitHub.
- **Third-Party Acknowledgements**: VexFlow 5 (MIT License).

## Consequences

### Positive
- **Complete In-App Legal Compliance**: Satisfies AGPLv3 Section 13 recommendations by making the license and source code prominently accessible from any running instance of the application.
- **Universal Mobile & Desktop Accessibility**: Users can access the license from the header, the settings drawer, or the footer.
- **Zero Framework Footprint**: Built entirely with native DOM `<dialog>` and CSS custom properties, preserving 60/120 FPS performance with zero bundle bloat.
- **Keyboard Safety**: Modals cleanly isolate keydown events to protect user playback state.

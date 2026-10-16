# 0106. Keyboard Detection: Shortcuts Only Where Keys Exist

- **Status**: Accepted
- **Date**: 2026-10-16
- **Author**: Claude & A. C. Lo Cascio
- **Relates to**: [0087](0087-rotating-tips.md), [0096](0096-cross-engine-support-gecko-webkit.md), [0097](0097-stage-first-shell.md)

## Context & Problem Statement

The ⋯ menu (ADR 0097) has a **Keyboard shortcuts** item (`#btn-shortcuts`) that opens a dialog of
keys. On a phone with no physical keyboard nobody can press them, so the item is noise.

No web API reports whether a physical keyboard is connected. `navigator.keyboard` exists only in
Chromium and gives the layout, not the presence of a keyboard; Safari and Firefox lack it.
The rotating `keys` tip (ADR 0087) had the same question and answered it with
`(hover: hover) and (pointer: fine)`, which only looks at the primary pointer.

## Decision

`src/utils/keyboard.ts` guesses from two signals and reports the guess through
`watchKeyboard(onChange)`, which calls back once at once and again whenever the guess changes.

### 1. Input capability: `(any-pointer: fine), (any-hover: hover)`

Any mouse or trackpad matches: desktops, laptops, and an iPad with a Magic Keyboard (a trackpad
plus keys). A touch-only phone or tablet fails it. The `any-` forms look at every input, not only
the primary one, so a touch laptop still counts. The query's `change` event follows a mouse being
attached or detached; it uses `addEventListener?.` as `DOCKED_INSPECTOR_QUERY` does, which the
Safari 16 baseline supports (ADR 0096). Without `matchMedia` the guess is true, so the item is
never hidden by mistake.

### 2. A real key press

A phone paired with a Bluetooth keyboard but no mouse still looks touch-only. One capture-phase
`window` `keydown` listener turns the guess true for the rest of the session at the first key
`isPhysicalKeyEvent` accepts, then removes itself. On-screen keyboards only send keys to editable
fields, so a key counts unless:

- its target is editable: an `<input>` other than checkbox, radio or range, a `<textarea>`, a
  `<select>`, or `contentEditable` (here only `#tempo-number` is editable);
- `isComposing` is set;
- `key` is `Unidentified`, as Android's virtual keyboards report.

Nothing is stored: keyboards come and go, and one key press brings the item back.

### 3. Consumers (`src/main.ts`)

- `bindAppMenu` sets `#btn-shortcuts.hidden = !likely`. `.menu-item { display: flex }` overrides
  the UA `[hidden]` rule, so `style.css` adds `.menu-item[hidden] { display: none }` next to the
  existing `.app-menu[hidden]` rule.
- `tipContext().keyboard` reads the same `keyboardLikely` field, so the `keys` tip and the menu
  item never disagree. `TipContext` keeps its shape.
- The `?` shortcut (`bindKeyboardShortcuts`) is unchanged and opens the dialog on any device.

### 4. Tests (`tests/keyboard.test.ts`)

A fake `MediaQueryList` covers: a matching query gives true; a non-matching one gives false until
a key on `document.body`; keys on an `<input type="number">`, `Unidentified` and composing keys
leave it false; `change` events follow the query; a key press outlives a detached mouse; missing
`matchMedia` gives true. `isPhysicalKeyEvent` is checked on buttons, checkbox/radio/range inputs
and editable fields.

## Verification

Playwright against the dev server: desktop Chromium shows the item; Chromium and WebKit with the
iPhone 13 descriptor hide it, keep it hidden while typing in `#tempo-number`, and show it after a
key press on the page.

## Consequences

- A plain phone never shows the item. A phone with a Bluetooth keyboard shows it after the first
  key press outside a text field, and the `keys` tip becomes eligible at the next boot.
- A touchscreen device with a stylus counts as having a fine pointer and shows the item; that
  errs toward showing, as does a missing `matchMedia`.
- The ⋯ button's aria-label still mentions shortcuts; it stays true because `?` works everywhere.

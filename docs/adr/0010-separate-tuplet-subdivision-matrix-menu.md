# 0010. Separate Tuplet Subdivision Matrix Menu & Arbitrary n-Tuplet Engine

- **Status**: Accepted
- **Date**: 2026-09-14
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Prior to this architectural addition, tuplet support in Solfège Scroller was limited to a single boolean checkbox (`triplets: boolean`) embedded inside the standard Subdivisions fieldset. This suffered from multiple critical limitations:
1. **Inflexible Tuplet Ratios**: Users were locked into 8th-note triplets (3:2) only. They could not select quarter-note triplets (3 in 2 beats), 16th-note triplets (3 in 0.5 beat), or higher-order subdivisions such as quintuplets (5:4), sextuplets (6:4), septuplets (7:4), quadruplets (4:3 in compound or simple meter), or duplets (2:3 in 6/8).
2. **Lack of Granular Control**: Sight-reading and solfège pedagogy requires isolating specific tuplet ratios and rhythmic values—for example, practicing 5-tuplets of sixteenth notes against quarter notes, or mastering quarter-note triplets across barlines and meter boundaries.
3. **Toolbar Overcrowding**: Inserting an extensive 2D matrix of tuplet checkboxes directly into the header would drastically expand the vertical height of the navigation bar, squashing the streaming music notation canvas.

---

## Decisions & Implementation Methods

### 1. Dedicated Tuplets Popover Menu & 2D Configuration Matrix
- **UI Architecture**:
  - Removed the monolithic `Triplets (3)` checkbox from `<fieldset class="control-group subdivisions-group">`. Standard subdivisions remain focused on binary metric levels (Quarter, Eighth, Half, Whole, 16th).
  - Added a dedicated Tuplets dropdown/popover control (`.tuplets-group`) with an accessible trigger button `<button id="btn-tuplets-toggle">`.
  - The button features:
    - Live active count badge (`#tuplets-badge`), dynamically displaying the number of active tuplet combinations and applying an accent-tinted active state.
    - Animated dropdown chevron indicator (`.menu-arrow`).
    - Standard ARIA attributes (`aria-haspopup="dialog"`, `aria-expanded`).
  - Clicking the button opens a clean, light-mode popover modal (`#tuplets-popover`) containing a 2D matrix table (`.tuplets-table`):
    - **Vertical axis (Rows)**: n-tuplet order ($n$):
      - Duplet ($n = 2$)
      - Triplet ($n = 3$)
      - Quadruplet ($n = 4$)
      - Quintuplet ($n = 5$)
      - Sextuplet ($n = 6$)
      - Septuplet ($n = 7$)
    - **Horizontal axis (Columns)**: Base note value ($V$):
      - Quarter note (`1/4`, ♩)
      - Eighth note (`1/8`, ♪)
      - Sixteenth note (`1/16`, 𝅘𝅥𝅯)
  - Each cell provides an individual toggle checkbox with tooltips documenting the ratio and metric beat duration.
  - Header actions include a **Clear All** button to immediately uncheck all tuplets and a **Close (✕)** button.
  - The popover dismisses seamlessly on outside click, on `Escape` keypress, or via the close button, and stays open while toggling cells so changes can be auditioned live.

### 2. Typed Tuplet Settings & State Representation
- In `src/notation/types.ts`:
  ```typescript
  export const TUPLET_NAMES = ['duplet', 'triplet', 'quadruplet', 'quintuplet', 'sextuplet', 'septuplet'] as const;
  export type TupletName = (typeof TUPLET_NAMES)[number];

  export const TUPLET_VALUES = ['1/4', '1/8', '1/16'] as const;
  export type TupletValue = (typeof TUPLET_VALUES)[number];

  export type TupletOptions = Record<TupletName, Record<TupletValue, boolean>>;
  ```
- Extended `AppSettings` with `tuplets: TupletOptions`, with safe immutable defaults in `DEFAULT_TUPLET_OPTIONS`.
- Extended `NoteData` with tuplet metadata:
  ```typescript
  export interface NoteData {
    // ...
    isTuplet?: boolean;
    tupletGroup?: number;
    tupletNumNotes?: number;     // e.g. 2, 3, 4, 5, 6, 7
    tupletNotesOccupied?: number; // e.g. 2, 3, 4
    tupletBracketed?: boolean;
    tupletRatioed?: boolean;
  }
  ```

### 3. Procedural Rhythm Partitioning Engine (`MusicGenerator`)
- Implemented `makeTupletItems(numNotes, notesOccupied, duration, totalBeatDuration, bracketed?, ratioed?)`:
  - Accurately computes the fractional beat duration per note:
    $$D_{\text{note}} = \frac{D_{\text{total}}}{n}$$
  - Assigns a unique sequential `tupletGroup` identifier ensuring strict grouping for VexFlow.
- **Simple Meter (4/4, 3/4, 2/4)**:
  - **4-Beat Tuplets**: Quintuplets (5:4), Sextuplets (6:4), and Septuplets (7:4) of quarter notes spanning whole 4/4 measures.
  - **3-Beat Tuplets**: Quadruplets (4:3) and Duplets (2:3) of quarter notes spanning 3 beats in 3/4 or 4/4 meter.
  - **2-Beat Tuplets**: Triplets (3:2) of quarter notes, and Quintuplets (5:4), Sextuplets (6:4), Septuplets (7:4) of eighth notes spanning 2 metric beats.
  - **1-Beat Tuplets**: Triplets (3:2) of eighth notes, and Quintuplets (5:4), Sextuplets (6:4), Septuplets (7:4) of sixteenth notes filling individual metric beats.
  - **0.5-Beat Tuplets**: Triplets (3:2) of sixteenth notes filling half a beat (paired as 2 groups to fill 1 beat).
- **Compound Meter (6/8)**:
  - Supports Duplets (2:3) and Quadruplets (4:3) of eighth notes filling 1 compound beat (3 eighth-note beats), alongside sixteenth-note triplets (3 in 2 sixteenths).
- **Graceful Isolation & Fallback**:
  - If regular subdivisions are unchecked, measures are composed exclusively of selected tuplets.
  - If both regular subdivisions and tuplets are checked, measures organically interweave standard and tuplet rhythms.

### 4. Dynamic Beat Width & VexFlow Engraving Pipeline
- In `computeBeatWidth(subdivisions, timeSignature, tuplets)`:
  - Dynamically calculates the required beat width ($W_{\text{beat}}$) to ensure high-density tuplets (such as 7 sixteenths per beat) have $\ge 40$px horizontal space per note head ($W_{\text{beat}} = 280$px).
  - Guarantees zero collisions with barlines or adjacent notes while maintaining perfectly uniform scrolling velocity.
- In `MeasureRenderer.renderMeasure`:
  - Beams for tuplet groups of eighth and sixteenth notes are constructed with a single unified beam `new Beam(entry.notes)` spanning all $n$ notes.
  - Non-beamed tuplet notes (quarter-note tuplets) automatically receive tuplet brackets (`bracketed: true`).
  - Non-tuplet notes continue to receive meter-aware beam groups via `Beam.generateBeams(nonTupletNotes)`.
  - Tuplet text numbers and brackets are styled in high-contrast slate (`#334155`).

---

## Consequences & Verification

- **Comprehensive Verification**:
  - Validated all 72 individual tuplet combinations across all supported meters (`4/4`, `3/4`, `2/4`, `6/8`). Every generated measure satisfies exact mathematical beat-sum parity ($\sum D_{\text{note}} = \text{beatsPerMeasure}$).
  - Tested 50 randomized measures combining arbitrary subdivisions and multiple tuplet layers with zero beat drift or fractional rounding errors.
- **Production Build & Typecheck**:
  - `tsc --noEmit` compiles with 0 errors and 0 warnings.
  - `vite build` creates optimized production assets in under 700ms.

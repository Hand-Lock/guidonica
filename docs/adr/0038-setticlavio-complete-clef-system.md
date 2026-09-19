# 0038. Setticlavio Complete Clef System: Soprano, Mezzo-Soprano, and Dual Baritone (F & C) Integration

- **Status**: Accepted
- **Date**: 2026-09-19
- **Author**: Antigravity Assistant & lauseta

## Context & Problem Statement

Prior to this architectural evolution, Guidonica provided four standard modern clefs: Treble (G2), Bass (F4), Alto (C3), and Tenor (C4).

In traditional conservatory sight-reading and vocal solfège pedagogy (most notably codified by Guido d'Arezzo and developed through the treatises of Pozzoli, Poltronieri, Ciriaco, and Bona), sight-reading and transposition mastery require training in the **Setticlavio**—the complete historical system of 7 clef positions across the five-line stave:
1. **Chiave di Violino (Treble)**: G on line 2
2. **Chiave di Soprano**: C on line 1
3. **Chiave di Mezzosoprano**: C on line 2
4. **Chiave di Contralto (Alto)**: C on line 3
5. **Chiave di Tenore**: C on line 4
6. **Chiave di Baritono**: F on line 3 (or C on line 5)
7. **Chiave di Basso**: F on line 4

Without the Soprano, Mezzo-Soprano, and Baritone clefs, students preparing for conservatory exams and professional solfège transposition could not utilize Guidonica for complete setticlavio practice.

---

## Decisions & Implementation Methods

### 1. Expanded Clef Domain Union & VexFlow Key Concordance

We expanded the typed union `Clef` in `src/notation/types.ts` to represent all 8 clefs in vocal register order:
```typescript
export type Clef =
  | 'treble'
  | 'soprano'
  | 'mezzo-soprano'
  | 'alto'
  | 'tenor'
  | 'baritone-f'
  | 'baritone-c'
  | 'bass';
```

Each type identifier maps 1:1 to VexFlow's internal `Clef.types` table (`'soprano'`, `'mezzo-soprano'`, `'baritone-f'`, `'baritone-c'`). This provides native rendering with zero transformation overhead or wrapper mappings.

### 2. Strict Geometric & Mathematical Pitch Symmetry ($\pm 3$ Ledger Lines)

Each clef spans an exact pool of 23 diatonic notes ($N = 23$), extending from the space below the 3rd ledger line below the stave, through the 5 stave lines, to the space above the 3rd ledger line above the stave.

$$\text{Range}(C) = [L_{\text{min}}, L_{\text{max}}] \quad \text{where } |V| = 23$$

The pitch pools and staff geometries are configured as follows:

| Clef | Glyph & Line Position | Staff Lines (1 $\to$ 5) | Center Line (Rest) | $\pm 3$ Ledger Line Range | Default Anchor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Treble (G2)** | G clef on line 2 | E4, G4, B4, D5, F5 | B4 (`b/4`) | E3 – F6 | C4 (`c/4`) |
| **Soprano (C1)** | C clef on line 1 | C4, E4, G4, B4, D5 | G4 (`g/4`) | C3 – D6 | C4 (`c/4`) |
| **Mezzo-Soprano (C2)** | C clef on line 2 | A3, C4, E4, G4, B4 | E4 (`e/4`) | A2 – B5 | C4 (`c/4`) |
| **Alto (C3)** | C clef on line 3 | F3, A3, C4, E4, G4 | C4 (`c/4`) | F2 – G5 | C4 (`c/4`) |
| **Tenor (C4)** | C clef on line 4 | D3, F3, A3, C4, E4 | A3 (`a/3`) | D2 – E5 | C4 (`c/4`) |
| **Baritone (F3)** | F clef on line 3 | B2, D3, F3, A3, C4 | F3 (`f/3`) | B1 – C5 | C3 (`c/3`) |
| **Baritone (C5)** | C clef on line 5 | B2, D3, F3, A3, C4 | F3 (`f/3`) | B1 – C5 | C3 (`c/3`) |
| **Bass (F4)** | F clef on line 4 | G2, B2, D3, F3, A3 | D3 (`d/3`) | G1 – A4 | C3 (`c/3`) |

### 3. Proof of Symmetrical Line Invariants

In VexFlow stave coordinate mapping (`StaveNote.getKeyProps()[0].line`):
- Line 1 is the bottom staff line.
- Line 3 is the center staff line.
- Line 5 is the top staff line.
- Line $-2.5$ is the space below the 3rd ledger line below.
- Line $8.5$ is the space above the 3rd ledger line above.

Across all 8 clefs, every single pitch pool satisfies:
$$\text{line}(\text{minPitch}) = -2.5, \quad \text{line}(\text{maxPitch}) = 8.5, \quad \text{line}(\text{centerPitch}) = 3.0$$

This mathematical symmetry ensures that all random-walk boundary bias routines, stem inversion rules, and measure canvas vertical clearance bounds operate identically and stably regardless of the active clef.

### 4. Storage Validation & Fallback Discipline

In `src/storage.ts`, `loadStoredSettings()` validates `parsed.clef` against `VALID_CLEFS`. Any unrecognized or corrupted clef string automatically falls back to `DEFAULT_APP_SETTINGS.clef` (`'treble'`), protecting against corrupted local session state.

### 5. UI Presentation & Ergonomics

The `<select id="select-clef">` presents clefs organized by vocal register (Treble $\to$ Soprano $\to$ Mezzo-Soprano $\to$ Alto $\to$ Tenor $\to$ Baritone $\to$ Bass), displaying clear traditional labels:
- Treble (G)
- Soprano (C1)
- Mezzo-Soprano (C2)
- Alto (C3)
- Tenor (C4)
- Baritone (F3)
- Baritone (C5)
- Bass (F)

The `#clef-range-hint` element automatically updates dynamically upon change to indicate the exact sounding diatonic range (e.g., `C3 – D6 (±3 ledger lines)`).

---

## Consequences

- **Pedagogical Completeness**: Guidonica now fully covers the complete Setticlavio system, catering to classical conservatory students and advanced musicians practicing transposition and sight-singing.
- **Dual Baritone Support**: Both historical representations of Baritone (F on line 3 and C on line 5) are supported; singers and instrumentalists can practice reading either standard variant with identical underlying pitch mappings.
- **Zero Framework / Zero Overhead**: Fully implemented using existing VexFlow 5 native glyphs and Canvas blitting. Zero extra bundle weight or audio dependencies.
- **Comprehensive Test Coverage**: Added tests covering all 8 clefs across pitch boundaries, tonic anchors, rest positioning, Solfège mappings, pinned header rendering, zoom scaling, and localStorage persistence.

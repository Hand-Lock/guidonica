# 0058. Music Font Audit: Keep Bravura, Ship a Renamed Subset

- **Status**: Accepted
- **Date**: 2026-10-03
- **Author**: Claude & A. C. Lo Cascio
- **Amends**: [0012](0012-web-font-synchronization-and-clef-invalidation.md) (which font is loaded and how)

## Context & Problem Statement

Nobody chose Bravura for Guidonica. It is VexFlow 5's default, and it arrived through
`import … from 'vexflow'`. That full entry (`vexflow/build/esm/entry/vexflow.js`) inlines **six**
base64 woff2 fonts into the JS bundle, and the app renders with one of them:

| Chunk / font (before) | raw | gzip |
|---|---|---|
| `vexflow-*.js` total | 1,126 KB | **693 KB** |
| Bravura (used) | 330 KB | 250 KB |
| Petaluma (unused) | 301 KB | 228 KB |
| Petaluma Script (unused) | 69 KB | 52 KB |
| Gonville (unused) | 31 KB | 23 KB |
| Academico + Bold (text font, unused: VexFlow draws no text here) | 62 KB | 47 KB |
| VexFlow code itself | ~334 KB | ~93 KB |
| App JS (`index-*.js`) | 89 KB | 24 KB |

Base64 woff2 doesn't compress, so about 87% of the shipped JavaScript was font data, and about
300 KB gz of it was never used. The "~19.3 kB gzipped" figure in the docs left VexFlow out.

The question was whether Bravura is the right font for a suckless app at all, or whether to
switch to another open-licensed SMuFL font.

## Survey

Every OFL / free SMuFL font. Coverage was checked with fontTools against the glyphs Guidonica
draws: G/C/F clefs, time-signature digits, whole/half/black noteheads, rests to the 32nd, flags
to the 32nd, ♯ ♭ ♮ 𝄪 𝄫, the augmentation dot and tuplet digits.

| Font | License | Glyphs | Full woff2 | Subset woff2\* | Covers Guidonica? | Style |
|---|---|---|---|---|---|---|
| **Bravura** (Steinberg/Dorico) | OFL, RFN | 3,693 (SMuFL reference) | 247 KB | **12.9 KB** | ✅ | Bold 19th-c. European engraving, built for legibility |
| Leland (MuseScore 4) | OFL, RFN | 467 (VexFlow pkg v0.77) | 36 KB | 8.4 KB | ✅ | SCORE-inspired, clean, slightly lighter |
| Leipzig (Verovio) | OFL, RFN | 732 | 45 KB | 7.8 KB | ✅ | Lighter, academic-edition look |
| Sebastian | OFL, RFN | 1,283 | 75 KB | 11.0 KB | ✅ | Lighter, Bärenreiter-like |
| Finale Maestro | OFL, RFN | 2,745 | 127 KB | 7.2 KB | ✅ | Classic Finale look |
| Petaluma / MuseJazz | OFL | 1,524 / 414 | 225 / 47 KB | 17.8 / 14.6 KB | ✅ | Handwritten jazz, wrong register for solfège |
| Finale Ash / Broadway / Jazz | OFL | 302–719 | 28–59 KB | — | ❌ no 32nd flags (ADR 0043) | Handwritten |
| Gonville / Gootville | free / OFL | 199 / 314 | 23 / 14 KB | — | ❌ no tuplet digits (ADR 0010, 0057) | LilyPond-like |
| Edwin, Academico, Nepomuk | OFL | — | — | — | text fonts, not music | — |

\*The ~70 codepoints listed above, `pyftsubset --flavor=woff2`.

## Decision

### Keep Bravura

1. **Size isn't a reason to switch.** Subset to the glyphs we draw, Bravura is 12.9 KB against
   7–11 KB for the lighter fonts. The 600 KB problem came from how the fonts were bundled, not
   from which font we use.
2. **It is the most legible at speed and on small screens.** Its noteheads, stems and
   accidentals are the heaviest of the engraved fonts, which matters for scrolling sight-reading
   at low zoom on phones.
3. **It is complete.** As the SMuFL reference font it already covers any future feature
   (articulations, key signatures, ornaments). The Leland VexFlow ships is an old v0.77 with
   467 glyphs.
4. **VexFlow is tuned for it.** VexFlow 5 measures glyphs at runtime, but its global engraving
   constants (stem, beam, staff-line and ledger thicknesses) were tuned against Bravura.
5. **The codebase is coupled to it.** The ADR 0017/0043 UI icons are traced from Bravura
   outlines, ADR 0057's `TUPLET_NUMBER_HEIGHT` is measured from Bravura's digits, and ADR 0026's
   time signatures use Bravura glyphs.
6. **Licensing is the same for all of them.** Every candidate is OFL with a Reserved Font Name,
   so a subset of any of them must be renamed.

Leland is the only reasonable alternative, if a lighter, SCORE-like look were ever wanted. It
would mean redrawing the UI icons, re-measuring ADR 0057 and accepting a much smaller glyph set,
for no size gain.

### Stop shipping unused font bytes

- **`vexflow/core`.** `renderer.ts` (and the tests) import from VexFlow's font-free entry. The
  `manualChunks` entry in `vite.config.ts` points at it. No CDN fetch happens: `Font.load` is
  never called.
- **Guidonica Notation.** `scripts/build-music-font.py` (Python fontTools, dev-only:
  `pip install fonttools brotli`, `pnpm music-font`) subsets
  `node_modules/@vexflow-fonts/bravura/bravura.woff2` to whole SMuFL blocks, so a new clef, rest
  or accidental does not need a rebuild:

  | Range | SMuFL block |
  |---|---|
  | E050–E07F | Clefs |
  | E080–E09F | Time signatures |
  | E0A0–E0A4 | Noteheads (double whole .. black) |
  | E1E7 | Augmentation dot |
  | E240–E24F | Flags |
  | E260–E26F | Standard accidentals |
  | E4E0–E4FF | Rests |
  | E880–E88F | Tuplet digits |

  The source package's woff2 is byte-identical to the one VexFlow inlines. The script rewrites
  name IDs 1, 3, 4, 6 and 10 to "Guidonica Notation" / `GuidonicaNotation-Regular`, drops the
  Bravura trademark notice (ID 7), and keeps the copyright (ID 0) and licence (IDs 13/14). It
  writes three committed files to `src/notation/fonts/`, so clone → install → dev never needs
  Python:
  - `guidonica-notation.woff2`: 150 glyphs, 19.6 KB.
  - `guidonica-notation.codepoints.json`: the subset's cmap.
  - `OFL.txt`: Bravura's copyright and licence.

  The generator uses Python because no Node tool reliably both subsets and renames a font.
- **Registration.** `src/notation/fonts.ts` imports the woff2 with `?url` (Vite emits it as a
  hashed asset). At module load it calls `VexFlow.setFonts('Guidonica Notation')`, adds a
  `FontFace` (`display: block`) to `document.fonts`, and starts the download. `renderer.ts`
  imports `./fonts` for that side effect, so the family is set before any measure is drawn. The
  ADR 0012 readiness check, load wait and verification poll are unchanged; they now probe
  `20px "Guidonica Notation"`, and the Academico checks are gone.
- **Coverage guard.** `tests/musicFontCoverage.test.ts` stubs a 2D context that records every
  `fillText` codepoint drawn in the music font. It renders pinned headers for every clef with and
  without each time signature, then streams measures on every clef and time signature with all
  subdivisions, dotted notes, rests, ties, every supported tuplet and every interval. It asserts
  that every recorded codepoint is in `guidonica-notation.codepoints.json`. A feature that draws a
  new glyph fails here instead of shipping tofu.

## Verification

- Outlines and advance widths of all 150 glyphs compare equal to Bravura (fontTools
  `RecordingPen`). `hhea`/`OS/2` vertical metrics and `unitsPerEm` are unchanged. In Chromium,
  every glyph drawn at 60 px gives 0 differing pixels against Bravura and 0 `measureText`
  mismatches.
- A cold load of the production build shows the intro previews, the pinned clef and the stream
  without tofu.

## Consequences

| After | raw | gzip |
|---|---|---|
| `vexflow-*.js` | 335 KB | **93 KB** |
| `guidonica-notation-*.woff2` (separate, cacheable) | 19.6 KB | 19.6 KB |
| App JS (`index-*.js`) | 89 KB | 24 KB |

- VexFlow plus its font go from **693 KB to about 113 KB gz (−84%)**. The whole cold-load JS +
  font drops from about 717 KB to about 137 KB gz.
- The font is a separate request that starts when `fonts.ts` evaluates rather than arriving
  inside the JS. The ADR 0012 readiness gate already covers that window.
- Drawing a glyph outside the eight ranges needs `RANGES` widened in
  `scripts/build-music-font.py` and the script re-run. The coverage test points to the missing
  codepoint.
- Bravura © Steinberg Media Technologies GmbH, SIL OFL 1.1, is credited in the README and in
  the in-app About dialog.

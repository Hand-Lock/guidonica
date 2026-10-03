#!/usr/bin/env python3
"""
Guidonica Notation: a renamed SMuFL subset of Bravura (ADR 0058).

VexFlow draws every notation glyph with fillText() in one SMuFL font. Guidonica needs about
70 of Bravura's 3,693 glyphs, so this script keeps only generous SMuFL ranges around them
(whole blocks, so a new clef, rest or accidental does not need a rebuild) and renames the
result. The SIL OFL 1.1 treats a subset as a Modified Version, which may not use the
Reserved Font Name "Bravura".

    pip install fonttools brotli
    python3 scripts/build-music-font.py

Source: node_modules/@vexflow-fonts/bravura/bravura.woff2 (the same file VexFlow inlines).
Output (committed, so clone -> install -> dev never needs Python):
    src/notation/fonts/guidonica-notation.woff2
    src/notation/fonts/guidonica-notation.codepoints.json   cmap of the subset, for tests
    src/notation/fonts/OFL.txt                              Bravura copyright + licence

Outlines and metrics are copied untouched, so rendering is pixel-identical to Bravura.
"""
import json
import os
import shutil
import sys

try:
  from fontTools import subset
  from fontTools.ttLib import TTFont
except ImportError:
  sys.exit('fontTools missing: pip install fonttools brotli')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'node_modules', '@vexflow-fonts', 'bravura')
OUT_DIR = os.path.join(ROOT, 'src', 'notation', 'fonts')

FAMILY = 'Guidonica Notation'
POSTSCRIPT = 'GuidonicaNotation-Regular'

# SMuFL blocks (https://w3c.github.io/smufl/latest/tables/), inclusive.
RANGES = [
  (0xE050, 0xE07F),  # Clefs: G, C, F and their octave/line variants
  (0xE080, 0xE09F),  # Time signatures: digits, common/cut time, joiners
  (0xE0A0, 0xE0A4),  # Noteheads: double whole .. black
  (0xE1E7, 0xE1E7),  # Augmentation dot
  (0xE240, 0xE24F),  # Flags: 8th .. 1024th, up and down
  (0xE260, 0xE26F),  # Standard accidentals: flat, natural, sharp, double, parenthesised
  (0xE4E0, 0xE4FF),  # Rests: maxima .. 1024th, multi-measure pieces
  (0xE880, 0xE88F),  # Tuplets: digits 0-9, colon
]


def main():
  src = os.path.join(SRC_DIR, 'bravura.woff2')
  if not os.path.exists(src):
    sys.exit(f'{src} not found: run pnpm install first')

  font = TTFont(src, recalcTimestamp=False)
  version = font['name'].getDebugName(5)
  cmap = font.getBestCmap()
  unicodes = [c for lo, hi in RANGES for c in range(lo, hi + 1) if c in cmap]

  options = subset.Options()
  options.flavor = 'woff2'
  options.name_IDs = ['*']
  options.name_languages = ['*']
  options.notdef_outline = True
  options.recalc_bounds = False
  options.recalc_timestamp = False
  subsetter = subset.Subsetter(options)
  subsetter.populate(unicodes=unicodes)
  subsetter.subset(font)

  rename(font['name'], version)

  os.makedirs(OUT_DIR, exist_ok=True)
  out = os.path.join(OUT_DIR, 'guidonica-notation.woff2')
  font.flavor = 'woff2'
  font.save(out)

  kept = sorted(font.getBestCmap())
  with open(os.path.join(OUT_DIR, 'guidonica-notation.codepoints.json'), 'w') as f:
    json.dump([f'{c:04X}' for c in kept], f, indent=0)
    f.write('\n')
  shutil.copyfile(os.path.join(SRC_DIR, 'LICENSE.txt'), os.path.join(OUT_DIR, 'OFL.txt'))

  print(f'{os.path.relpath(out, ROOT)}: {len(kept)} glyphs, {os.path.getsize(out)} bytes')


def rename(name, version):
  """Rewrite the identifying names; copyright (0), licence (13/14) and credits stay as they are."""
  derived = f'{FAMILY} is derived from Bravura {version.removeprefix("Version ")} (SIL OFL 1.1), subset for Guidonica.'
  names = {
    1: FAMILY,
    3: f'{version};{POSTSCRIPT}',
    4: FAMILY,
    6: POSTSCRIPT,
    7: None,  # Bravura trademark notice: does not apply to the renamed font
    10: derived,
    16: None,
    17: None,
  }
  for record in list(name.names):
    if record.nameID in names:
      value = names[record.nameID]
      if value is None:
        name.names.remove(record)
      else:
        record.string = value


if __name__ == '__main__':
  main()

#!/usr/bin/env node
/*
 * Self-hosted UI text fonts (ADR 0060).
 *
 * Downloads the Latin woff2 files Google Fonts serves for the three UI families, so the page
 * never contacts fonts.googleapis.com / fonts.gstatic.com at runtime. The files are byte-identical
 * to what Google sends a current Chrome; nothing is re-subset or renamed.
 *
 *   node scripts/fetch-ui-fonts.mjs        (pnpm ui-fonts)
 *
 * Output (committed, so clone -> install -> dev never needs the network):
 *   src/fonts/*.woff2          one file per face, named <family>-<style>.woff2
 *   src/fonts/OFL-*.txt        Alegreya and Alegreya Sans (SIL Open Font License 1.1)
 *   src/fonts/UFL.txt          Ubuntu Mono (Ubuntu Font Licence 1.0)
 *
 * The @font-face rules in src/style.css reference these names; update them if a face changes.
 * Zero dependencies (Node 22 fetch).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'fonts');

// Google serves woff2 with per-script unicode-range subsets only to modern user agents.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const CSS_URL = 'https://fonts.googleapis.com/css2'
  + '?family=Alegreya:ital,wght@0,700;1,400;1,700'
  + '&family=Alegreya+Sans:wght@400;500;700'
  + '&family=Ubuntu+Mono:wght@400;700'
  + '&display=swap';

const LICENSES = {
  'OFL-Alegreya.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/alegreya/OFL.txt',
  'OFL-AlegreyaSans.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/alegreyasans/OFL.txt',
  'UFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ufl/ubuntumono/UFL.txt',
};

const slug = (family) => family.toLowerCase().replace(/\s+/g, '-');

async function get(url, as) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return as === 'bytes' ? new Uint8Array(await res.arrayBuffer()) : res.text();
}

async function main() {
  const css = await get(CSS_URL, 'text');
  // Only the /* latin */ blocks: en, it, fr, de and es need nothing beyond them (ADR 0059).
  const blocks = [...css.matchAll(/\/\* latin \*\/\s*@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  if (blocks.length === 0) throw new Error('no latin @font-face blocks in the Google Fonts CSS');

  mkdirSync(OUT_DIR, { recursive: true });
  const written = new Map();
  for (const block of blocks) {
    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
    const style = /font-style:\s*(\w+)/.exec(block)?.[1];
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1];
    const url = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
    if (!family || !style || !weight || !url) throw new Error(`unparsed block: ${block}`);
    // Alegreya italic is variable: Google sends one file for 400 and 700
    const name = style === 'italic' ? `${slug(family)}-italic.woff2` : `${slug(family)}-${weight}.woff2`;
    if (written.has(name)) {
      if (written.get(name) !== url) throw new Error(`${name}: two different files`);
      continue;
    }
    const bytes = await get(url, 'bytes');
    writeFileSync(join(OUT_DIR, name), bytes);
    written.set(name, url);
    console.log(`${name}  ${(bytes.length / 1024).toFixed(1)} KB  ${family} ${style} ${weight}`);
  }

  for (const [name, url] of Object.entries(LICENSES)) {
    writeFileSync(join(OUT_DIR, name), await get(url, 'text'));
    console.log(name);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

// @ts-check
// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Prints the GitHub Release body for a tag from CHANGELOG.md (ADR 0078):
// the release's section with ADR references linked, and the compare link.
// Usage: node scripts/release-notes.mjs v2026.10.0 > notes.md
// Copyright (C) 2026 A. C. Lo Cascio

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO_URL, releaseSection } from './changelog.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Links each four-digit ADR number inside "(ADR …)" / "(ADRs …)" to its file at the tag.
 * @param {string} body
 * @param {string} tag
 * @param {readonly string[]} adrFiles file names in docs/adr/
 */
export function linkAdrs(body, tag, adrFiles) {
  return body.replace(/\(ADRs? [^)]*\)/g, (group) =>
    group.replace(/\b(\d{4})\b/g, (n) => {
      const file = adrFiles.find((f) => f.startsWith(`${n}-`));
      return file ? `[${n}](${REPO_URL}/blob/${tag}/docs/adr/${file})` : n;
    }),
  );
}

/**
 * @param {string} md CHANGELOG.md
 * @param {string} tag such as v2026.10.0
 * @param {readonly string[]} adrFiles
 */
export function releaseNotes(md, tag, adrFiles) {
  const version = tag.replace(/^v/, '');
  const link = new RegExp(`^\\[${version.replace(/\./g, '\\.')}\\]: (\\S+)$`, 'm').exec(md);
  const body = linkAdrs(releaseSection(md, version), tag, adrFiles);
  return link ? `${body}\n\n**Full changes**: ${link[1]}\n` : `${body}\n`;
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const tag = process.argv[2];
  if (!tag) {
    console.error('usage: node scripts/release-notes.mjs <tag>');
    process.exit(1);
  }
  const md = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  process.stdout.write(releaseNotes(md, tag, readdirSync(join(ROOT, 'docs/adr'))));
}

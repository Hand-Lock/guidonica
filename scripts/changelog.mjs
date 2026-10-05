// @ts-check
// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - CHANGELOG.md parser shared by the Vite notes plugin, the release scripts
// and the tests (ADR 0078). Keep a Changelog 1.1.0 subset: `## [version] - date`
// headings, `### Kind` sections and `- ` bullets, continuation lines indented.
// Copyright (C) 2026 A. C. Lo Cascio

/** @typedef {'added' | 'changed' | 'fixed' | 'removed' | 'security' | 'internal'} ChangeKind */
/** @typedef {{ kind: ChangeKind, items: string[] }} ChangeSection */
/** @typedef {{ version: string, date: string | null, sections: ChangeSection[] }} ChangelogRelease */

export const UNRELEASED = 'Unreleased';
export const REPO_URL = 'https://github.com/Hand-Lock/guidonica';

/** Section kinds in display order. `internal` is GitHub-only and never shipped in-app. */
/** @type {readonly ChangeKind[]} */
export const CHANGE_KINDS = ['added', 'changed', 'fixed', 'removed', 'security', 'internal'];

const RELEASE_HEADING = /^## \[([^\]]+)\](?: - (\d{4}-\d{2}-\d{2}))?\s*$/;
const SECTION_HEADING = /^### (.+?)\s*$/;
const BULLET = /^[-*] (.*)$/;
const CONTINUATION = /^\s{2,}(\S.*)$/;

/**
 * @param {string} heading
 * @returns {ChangeKind}
 */
function changeKind(heading) {
  const kind = heading.toLowerCase();
  const found = CHANGE_KINDS.find((k) => k === kind);
  if (!found) throw new Error(`CHANGELOG: unknown section "### ${heading}"`);
  return found;
}

/**
 * Releases in file order (newest first). Bullets keep their markdown; text before the
 * first release heading and link reference definitions are ignored.
 * @param {string} md
 * @returns {ChangelogRelease[]}
 */
export function parseChangelog(md) {
  /** @type {ChangelogRelease[]} */
  const releases = [];
  /** @type {ChangelogRelease | null} */
  let release = null;
  /** @type {ChangeSection | null} */
  let section = null;
  /** @type {string[] | null} */
  let item = null;
  let index = -1;
  for (const line of md.split(/\r?\n/)) {
    const heading = RELEASE_HEADING.exec(line);
    if (heading) {
      release = { version: heading[1], date: heading[2] ?? null, sections: [] };
      releases.push(release);
      section = null;
      item = null;
      continue;
    }
    if (!release) continue;
    if (line.startsWith('## ')) throw new Error(`CHANGELOG: malformed release heading "${line}"`);
    const sub = SECTION_HEADING.exec(line);
    if (sub) {
      section = { kind: changeKind(sub[1]), items: [] };
      release.sections.push(section);
      item = null;
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet && section) {
      section.items.push(bullet[1].trim());
      item = section.items;
      index = item.length - 1;
      continue;
    }
    const more = CONTINUATION.exec(line);
    if (more && item) {
      item[index] += ' ' + more[1].trim();
      continue;
    }
    if (line.trim() === '' || line.startsWith('[')) {
      item = null;
      continue;
    }
    throw new Error(`CHANGELOG: unexpected line under [${release.version}]: "${line}"`);
  }
  for (const r of releases) r.sections = r.sections.filter((s) => s.items.length > 0);
  return releases;
}

/**
 * A bullet as plain text for the in-app dialog: drops "(ADR NNNN)" and "(ADRs …)"
 * references, link syntax, emphasis and backticks.
 * @param {string} item
 * @returns {string}
 */
export function plainText(item) {
  return item
    .replace(/\s*\(ADRs? \d{4}[^)]*\)/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?![\w*])/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The notes shipped in a build: user-facing sections only, plain-text bullets, and the
 * Unreleased block only when asked (nightly) and non-empty.
 * @param {string} md
 * @param {{ unreleased: boolean }} options
 * @returns {ChangelogRelease[]}
 */
export function appNotes(md, { unreleased }) {
  return parseChangelog(md)
    .filter((r) => unreleased || r.version !== UNRELEASED)
    .map((r) => ({
      version: r.version,
      date: r.date,
      sections: r.sections
        .filter((s) => s.kind !== 'internal')
        .map((s) => ({ kind: s.kind, items: s.items.map(plainText) })),
    }))
    .filter((r) => r.sections.length > 0);
}

/**
 * Lines of the Unreleased block, or null when the file has none.
 * @param {string[]} lines
 * @returns {{ start: number, end: number } | null}
 */
function unreleasedBlock(lines) {
  const start = lines.findIndex((l) => l.trim() === `## [${UNRELEASED}]`);
  if (start < 0) return null;
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ') && !/^\[[^\]]+\]: /.test(lines[end])) end++;
  return { start, end };
}

/**
 * Turns the Unreleased block into `## [version] - date` under a fresh, empty Unreleased
 * heading; drops empty section headings and rewrites the compare links.
 * @param {string} md
 * @param {string} version
 * @param {string} date YYYY-MM-DD
 * @returns {string}
 */
export function cutRelease(md, version, date) {
  const lines = md.split('\n');
  const block = unreleasedBlock(lines);
  if (!block) throw new Error('CHANGELOG: no [Unreleased] section');
  const unreleased = parseChangelog(lines.slice(block.start, block.end).join('\n'))[0];
  if (!unreleased || unreleased.sections.length === 0) throw new Error('CHANGELOG: [Unreleased] is empty');

  /** @type {string[]} */
  const body = [];
  for (const s of unreleased.sections) {
    body.push(`### ${s.kind[0].toUpperCase()}${s.kind.slice(1)}`, '');
    for (const text of s.items) body.push(`- ${text}`);
    body.push('');
  }
  const released = [`## [${UNRELEASED}]`, '', `## [${version}] - ${date}`, '', ...body];

  const out = [...lines.slice(0, block.start), ...released, ...lines.slice(block.end)];
  const linkAt = out.findIndex((l) => l.startsWith(`[${UNRELEASED}]: `));
  if (linkAt < 0) throw new Error('CHANGELOG: no [Unreleased] link definition');
  const previous = /\/compare\/(\S+?)\.\.\.HEAD\s*$/.exec(out[linkAt]);
  if (!previous) throw new Error(`CHANGELOG: cannot read the previous tag from "${out[linkAt]}"`);
  out.splice(
    linkAt,
    1,
    `[${UNRELEASED}]: ${REPO_URL}/compare/v${version}...HEAD`,
    `[${version}]: ${REPO_URL}/compare/${previous[1]}...v${version}`,
  );
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * The markdown body of one release (sections and bullets, Internal included), for the
 * GitHub Release. Throws when the version is missing.
 * @param {string} md
 * @param {string} version
 * @returns {string}
 */
export function releaseSection(md, version) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => {
    const m = RELEASE_HEADING.exec(l);
    return m !== null && m[1] === version;
  });
  if (start < 0) throw new Error(`CHANGELOG: no [${version}] section`);
  let end = start + 1;
  while (end < lines.length && !lines[end].startsWith('## ') && !/^\[[^\]]+\]: /.test(lines[end])) end++;
  return lines.slice(start + 1, end).join('\n').trim();
}

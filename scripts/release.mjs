// @ts-check
// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Cuts a CalVer release (ADR 0078): moves CHANGELOG.md's Unreleased block
// under the new version, bumps package.json and prints the section. It never commits,
// tags or pushes; AGENTS.md §5 lists the steps that follow.
// Usage: pnpm release [--dry-run]
// Copyright (C) 2026 A. C. Lo Cascio

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cutRelease, releaseSection } from './changelog.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const PACKAGE = join(ROOT, 'package.json');
const dryRun = process.argv.includes('--dry-run');

/** @param {string[]} args */
function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

/** @param {string} message */
function fail(message) {
  console.error(`release: ${message}`);
  process.exit(1);
}

/**
 * YYYY.M.MICRO for `date` (UTC): MICRO is one past the highest tag of that month, or 0.
 * @param {Date} date
 * @param {string[]} tags
 */
export function nextVersion(date, tags) {
  const month = `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}`;
  const micros = tags
    .map((t) => new RegExp(`^v${month.replace('.', '\\.')}\\.(\\d+)$`).exec(t))
    .filter((m) => m !== null)
    .map((m) => Number(m[1]));
  return `${month}.${micros.length ? Math.max(...micros) + 1 : 0}`;
}

function main() {
  if (!dryRun) {
    if (git(['status', '--porcelain']) !== '') fail('the working tree is not clean');
    if (git(['branch', '--show-current']) !== 'main') fail('not on main');
    git(['fetch', '--quiet', 'origin', 'main', '--tags']);
    if (git(['rev-parse', 'HEAD']) !== git(['rev-parse', 'origin/main'])) fail('main is not level with origin/main');
  }

  const now = new Date();
  const version = nextVersion(now, git(['tag', '--list', 'v20*']).split('\n').filter(Boolean));
  const date = now.toISOString().slice(0, 10);
  let md;
  try {
    md = cutRelease(readFileSync(CHANGELOG, 'utf8'), version, date);
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }
  const pkg = readFileSync(PACKAGE, 'utf8');
  const bumped = pkg.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`);
  if (bumped === pkg) fail('cannot find the version in package.json');

  if (!dryRun) {
    writeFileSync(CHANGELOG, md);
    writeFileSync(PACKAGE, bumped);
  }
  console.log(`## [${version}] - ${date}\n\n${releaseSection(md, version)}\n`);
  console.log(dryRun
    ? '(dry run: nothing written)'
    : `Next: write a "> " headline under the version heading (English, for the Bluesky and\n` +
      `Mastodon announcement, ADR 0081), translate this section into src/i18n/changelog/{it,fr,de,es}.md (Internal omitted),\n` +
      `run pnpm typecheck && pnpm test && pnpm build:site, then commit "chore(release): ${version}",\n` +
      `git tag -a v${version} -m "Guidonica ${version}" && git push --atomic origin main v${version}`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main();

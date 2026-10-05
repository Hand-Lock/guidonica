// @ts-check
// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Builds the deployed site (ADR 0078): the latest CalVer release tag at the
// root of site/ and the working tree, as the nightly channel, in site/nightly/.
// Usage: pnpm build:site
// Copyright (C) 2026 A. C. Lo Cascio

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SITE = join(ROOT, 'site');

/**
 * @param {string[]} args
 * @param {string} [cwd]
 */
function git(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(command, args, cwd, env = process.env) {
  execFileSync(command, args, { cwd, env, stdio: 'inherit' });
}

/**
 * Builds the checkout at `cwd` into `outDir`. Commit and date come from git, never from
 * the clock, so rebuilding an unchanged tag gives byte-identical output.
 * @param {string} cwd
 * @param {string} outDir
 * @param {'release' | 'nightly'} channel
 */
function build(cwd, outDir, channel) {
  const env = {
    ...process.env,
    GUIDONICA_CHANNEL: channel,
    GUIDONICA_COMMIT: git(['rev-parse', '--short', 'HEAD'], cwd),
    GUIDONICA_COMMIT_DATE: git(['log', '-1', '--format=%cs'], cwd),
  };
  console.log(`\n▶ ${channel} build of ${env.GUIDONICA_COMMIT} → ${outDir}`);
  run('pnpm', ['exec', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'], cwd, env);
}

/** Newest CalVer release tag (v2026.10.0 and later), or null before the first one. */
function latestReleaseTag() {
  return git(['tag', '--list', 'v20*', '--sort=-v:refname']).split('\n').find(Boolean) ?? null;
}

rmSync(SITE, { recursive: true, force: true });

const tag = latestReleaseTag();
const clean = git(['status', '--porcelain']) === '';
if (tag === null) {
  // Bootstrap: until the first CalVer release the root keeps tracking the working tree
  console.log('No CalVer release tag yet: building the working tree as the release.');
  build(ROOT, SITE, 'release');
} else if (clean && git(['rev-parse', `${tag}^{commit}`]) === git(['rev-parse', 'HEAD'])) {
  console.log(`HEAD is ${tag}: building the release from the working tree.`);
  build(ROOT, SITE, 'release');
} else {
  const worktree = mkdtempSync(join(tmpdir(), 'guidonica-release-'));
  try {
    git(['worktree', 'add', '--detach', worktree, tag]);
    run('pnpm', ['install', '--frozen-lockfile'], worktree);
    build(worktree, SITE, 'release');
  } finally {
    git(['worktree', 'remove', '--force', worktree]);
    rmSync(worktree, { recursive: true, force: true });
  }
}

build(ROOT, join(SITE, 'nightly'), 'nightly');
console.log(`\n✔ site/ ← ${tag ?? 'working tree'} · site/nightly/ ← working tree`);

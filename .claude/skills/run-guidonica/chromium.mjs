// Guidonica - Playwright and Chromium lookup shared by the run driver and
// scripts/build-banners.mjs (dev-only, not shipped)
//
// playwright-core lives in node_modules/.cache/run-guidonica/ (gitignored) so the
// project's package.json keeps its minimal dependency list. See SKILL.md.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const PW_DIR = join(REPO, 'node_modules/.cache/run-guidonica');
export const PW_ENTRY = join(PW_DIR, 'node_modules/playwright-core/index.mjs');
export const PW_CLI = join(PW_DIR, 'node_modules/playwright-core/cli.js');

/** Playwright's browser cache: PLAYWRIGHT_BROWSERS_PATH, else the per-OS default. */
export function browserCache() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  return platform() === 'darwin'
    ? join(homedir(), 'Library/Caches/ms-playwright')
    : join(homedir(), '.cache/ms-playwright');
}

const EXECUTABLES = new Set(['Google Chrome for Testing', 'Chromium', 'chrome', 'chrome-headless-shell', 'headless_shell']);

export function findExecutable(dir, depth) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isFile() && EXECUTABLES.has(name) && stat.mode & 0o111) return path;
    if (stat.isDirectory() && depth > 0) {
      const found = findExecutable(path, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/** Newest cached Chromium; the full build wins over the headless shell at equal revision. */
export function findChromium() {
  const cache = browserCache();
  if (!existsSync(cache)) return null;
  const dirs = readdirSync(cache)
    .map((name) => /^(chromium|chromium_headless_shell)-(\d+)$/.exec(name))
    .filter((m) => m !== null)
    .sort((a, b) => Number(b[2]) - Number(a[2]) || (a[1] === 'chromium' ? -1 : 1));
  for (const m of dirs) {
    const exe = findExecutable(join(cache, m[0]), 5);
    if (exe) return exe;
  }
  return null;
}

// Guidonica - Playwright and browser lookup shared by the run driver and
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

export function findExecutable(dir, depth, names = EXECUTABLES) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isFile() && names.has(name) && stat.mode & 0o111) return path;
    if (stat.isDirectory() && depth > 0) {
      const found = findExecutable(path, depth - 1, names);
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

/** Playwright's engines: Opera, Edge, Brave, Vivaldi and Arc are all Chromium (ADR 0096). */
export const ENGINES = ['chromium', 'firefox', 'webkit'];

// Gecko ships as firefox/Nightly.app/…/firefox (macOS) or firefox/firefox (Linux);
// WebKit's launcher script is pw_run.sh at the top of its directory.
const ENGINE_EXECUTABLES = { firefox: new Set(['firefox']), webkit: new Set(['pw_run.sh']) };

/** Newest cached build of an engine, or null; chromium is findChromium(). */
export function findBrowser(engine) {
  if (engine === 'chromium') return findChromium();
  const names = ENGINE_EXECUTABLES[engine];
  const cache = browserCache();
  if (!names || !existsSync(cache)) return null;
  const pattern = new RegExp(`^${engine}-(\\d+)$`);
  const dirs = readdirSync(cache)
    .map((name) => pattern.exec(name))
    .filter((m) => m !== null)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  for (const m of dirs) {
    const dir = join(cache, m[0]);
    const top = join(dir, 'pw_run.sh');
    if (engine === 'webkit' && existsSync(top)) return top;
    const exe = findExecutable(dir, 5, names);
    if (exe) return exe;
  }
  return null;
}

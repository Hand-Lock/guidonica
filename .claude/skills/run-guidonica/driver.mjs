#!/usr/bin/env node
// Guidonica - headless run/screenshot driver for agents (dev-only, not shipped)
//
//   node .claude/skills/run-guidonica/driver.mjs --setup
//   node .claude/skills/run-guidonica/driver.mjs [options] <step> <step> ...
//
// playwright-core lives in node_modules/.cache/run-guidonica/ (gitignored) so the
// project's package.json keeps its minimal dependency list. See SKILL.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PW_DIR = join(REPO, 'node_modules/.cache/run-guidonica');
const PW_ENTRY = join(PW_DIR, 'node_modules/playwright-core/index.mjs');
const PW_CLI = join(PW_DIR, 'node_modules/playwright-core/cli.js');
const LANGS = ['en', 'it', 'fr', 'de', 'es'];
const THEMES = ['light', 'dark', 'auto'];
const STEP_KINDS = ['click', 'press', 'wait', 'scroll', 'text', 'eval', 'shot'];

const USAGE = `usage: driver.mjs --setup
       driver.mjs [--url URL] [--lang ${LANGS.join('|')}] [--theme ${THEMES.join('|')}]
                  [--size WxH] [--dpr N] [--intro] [--out DIR] <step>...
steps: click:<sel> press:<Key> wait:<ms> scroll:<sel> text:<sel> eval:<js> shot:<name>`;

function fail(message) {
  console.error(`driver: ${message}`);
  process.exit(1);
}

/** Playwright's browser cache: PLAYWRIGHT_BROWSERS_PATH, else the per-OS default. */
function browserCache() {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) return process.env.PLAYWRIGHT_BROWSERS_PATH;
  return platform() === 'darwin'
    ? join(homedir(), 'Library/Caches/ms-playwright')
    : join(homedir(), '.cache/ms-playwright');
}

const EXECUTABLES = new Set(['Google Chrome for Testing', 'Chromium', 'chrome', 'chrome-headless-shell', 'headless_shell']);

function findExecutable(dir, depth) {
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
function findChromium() {
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

function setup() {
  if (!existsSync(PW_ENTRY)) {
    mkdirSync(PW_DIR, { recursive: true });
    writeFileSync(join(PW_DIR, 'package.json'), '{ "private": true }\n');
    console.log(`installing playwright-core into ${PW_DIR}`);
    execFileSync('npm', ['install', '--prefix', PW_DIR, '--no-audit', '--no-fund', 'playwright-core'], { stdio: 'inherit' });
  }
  let exe = findChromium();
  if (!exe) {
    console.log('no cached Chromium found, running playwright-core install chromium');
    execFileSync(process.execPath, [PW_CLI, 'install', 'chromium'], { stdio: 'inherit' });
    exe = findChromium();
  }
  if (!exe) fail(`still no Chromium under ${browserCache()}`);
  console.log(`playwright-core: ${PW_ENTRY}\nchromium: ${exe}\nready`);
}

function parseArgs(argv) {
  const opts = { url: 'http://localhost:3000', lang: null, theme: null, width: 1280, height: 900, dpr: 2, intro: false, out: join(tmpdir(), 'guidonica-shots') };
  const steps = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => (i + 1 < argv.length ? argv[++i] : fail(`${arg} needs a value`));
    if (arg === '--url') opts.url = value();
    else if (arg === '--lang') opts.lang = value();
    else if (arg === '--theme') opts.theme = value();
    else if (arg === '--size') {
      const m = /^(\d+)x(\d+)$/.exec(value()) ?? fail('--size must be WxH, e.g. 390x844');
      opts.width = Number(m[1]);
      opts.height = Number(m[2]);
    } else if (arg === '--dpr') opts.dpr = Number(value());
    else if (arg === '--intro') opts.intro = true;
    else if (arg === '--out') opts.out = resolve(value());
    else if (arg.startsWith('--')) fail(`unknown option ${arg}\n${USAGE}`);
    else {
      const colon = arg.indexOf(':');
      const kind = colon > 0 ? arg.slice(0, colon) : '';
      if (!STEP_KINDS.includes(kind)) fail(`bad step "${arg}"\n${USAGE}`);
      steps.push({ kind, arg: arg.slice(colon + 1) });
    }
  }
  if (opts.lang !== null && !LANGS.includes(opts.lang)) fail(`--lang must be one of ${LANGS.join(', ')}`);
  if (opts.theme !== null && !THEMES.includes(opts.theme)) fail(`--theme must be one of ${THEMES.join(', ')}`);
  if (!(opts.dpr > 0)) fail('--dpr must be a positive number');
  if (steps.length === 0) fail(`no steps given\n${USAGE}`);
  return { opts, steps };
}

async function run(opts, steps) {
  if (!existsSync(PW_ENTRY)) fail('playwright-core is missing: run driver.mjs --setup');
  const executablePath = findChromium() ?? fail(`no Chromium under ${browserCache()}: run driver.mjs --setup`);
  const { chromium } = await import(pathToFileURL(PW_ENTRY).href);
  mkdirSync(opts.out, { recursive: true });

  const browser = await chromium.launch({ executablePath });
  // A fresh context per run: empty localStorage and no service worker from a previous run.
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    deviceScaleFactor: opts.dpr,
    colorScheme: opts.theme === 'dark' ? 'dark' : 'light',
    locale: opts.lang ?? 'en-US',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  // The intro shows only when neither key is stored (src/main.ts), so --intro seeds nothing
  // and the language then comes from the context locale.
  if (!opts.intro) {
    await page.addInitScript(({ lang, theme }) => {
      localStorage.setItem('guidonica_onboarded_v1', '1');
      if (lang === null && theme === null) return;
      let settings = {};
      try {
        settings = JSON.parse(localStorage.getItem('guidonica_settings_v1') ?? '{}') ?? {};
      } catch {}
      if (lang !== null) settings.language = lang;
      if (theme !== null) settings.theme = theme;
      localStorage.setItem('guidonica_settings_v1', JSON.stringify(settings));
    }, { lang: opts.lang, theme: opts.theme });
  }

  let failed = false;
  let current = 'load';
  try {
    await page.goto(opts.url, { waitUntil: 'load' });
    // VexFlow font and first measures
    await page.waitForTimeout(800);
    for (const { kind, arg } of steps) {
      current = `${kind}:${arg}`;
      if (kind === 'click') await page.click(arg, { timeout: 5000 });
      else if (kind === 'press') await page.keyboard.press(arg);
      else if (kind === 'wait') await page.waitForTimeout(Number(arg));
      else if (kind === 'scroll') await page.locator(arg).first().scrollIntoViewIfNeeded({ timeout: 5000 });
      else if (kind === 'text') console.log(`text ${arg}:\n${await page.locator(arg).first().innerText({ timeout: 5000 })}`);
      else if (kind === 'eval') console.log(`eval: ${JSON.stringify(await page.evaluate(arg))}`);
      else if (kind === 'shot') {
        const path = join(opts.out, `${arg}.png`);
        await page.screenshot({ path });
        console.log(`shot: ${path}`);
      }
    }
  } catch (e) {
    failed = true;
    console.error(`step ${current} failed: ${e.message.split('\n')[0]}`);
  } finally {
    await browser.close();
  }
  console.log(errors.length ? `errors (${errors.length}):\n${errors.join('\n')}` : 'errors: none');
  process.exit(failed || errors.length ? 1 : 0);
}

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.length === 0) console.log(USAGE);
else if (argv[0] === '--setup') setup();
else {
  const { opts, steps } = parseArgs(argv);
  await run(opts, steps);
}

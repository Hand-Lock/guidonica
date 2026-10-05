#!/usr/bin/env node
// Guidonica - headless run/screenshot driver for agents (dev-only, not shipped)
//
//   node .claude/skills/run-guidonica/driver.mjs --setup
//   node .claude/skills/run-guidonica/driver.mjs [options] <step> <step> ...
//
// playwright-core lives in node_modules/.cache/run-guidonica/ (gitignored) so the
// project's package.json keeps its minimal dependency list. See SKILL.md.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PW_CLI, PW_DIR, PW_ENTRY, browserCache, findChromium } from './chromium.mjs';

const LANGS = ['en', 'it', 'fr', 'de', 'es'];
const THEMES = ['light', 'dark', 'auto'];
const STEP_KINDS = ['click', 'press', 'wait', 'scroll', 'text', 'eval', 'shot'];

const USAGE = `usage: driver.mjs --setup
       driver.mjs [--url URL] [--lang ${LANGS.join('|')}] [--theme ${THEMES.join('|')}]
                  [--size WxH] [--dpr N] [--intro] [--seen VERSION] [--out DIR] <step>...
steps: click:<sel> press:<Key> wait:<ms> scroll:<sel> text:<sel> eval:<js> shot:<name>`;

function fail(message) {
  console.error(`driver: ${message}`);
  process.exit(1);
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
  const opts = { url: 'http://localhost:3000', lang: null, theme: null, width: 1280, height: 900, dpr: 2, intro: false, seen: null, out: join(tmpdir(), 'guidonica-shots') };
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
    else if (arg === '--seen') opts.seen = value();
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
  // and the language then comes from the context locale. Both channels' namespaces are
  // seeded (ADR 0078), so --url …/nightly/ behaves the same. The seen version defaults to
  // one far ahead, which the app treats as a rollback, so "What's new" stays closed.
  if (!opts.intro) {
    await page.addInitScript(({ lang, theme, seen }) => {
      for (const prefix of ['guidonica_', 'guidonica_nightly_']) {
        localStorage.setItem(`${prefix}onboarded_v1`, '1');
        localStorage.setItem(`${prefix}seen_version`, seen ?? '9999.0.0');
        if (lang === null && theme === null) continue;
        let settings = {};
        try {
          settings = JSON.parse(localStorage.getItem(`${prefix}settings_v1`) ?? '{}') ?? {};
        } catch {}
        if (lang !== null) settings.language = lang;
        if (theme !== null) settings.theme = theme;
        localStorage.setItem(`${prefix}settings_v1`, JSON.stringify(settings));
      }
    }, { lang: opts.lang, theme: opts.theme, seen: opts.seen });
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

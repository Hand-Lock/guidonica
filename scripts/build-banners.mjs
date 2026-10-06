#!/usr/bin/env node
/*
 * Social profile banners (ADR 0079): Mastodon, Bluesky and X headers plus YouTube channel art.
 *
 *   pnpm banners             docs/brand/banners/header-3000x1000.png, header-1500x500.png,
 *                            youtube-2560x1440.png
 *   pnpm banners --guides    also writes copies with avatar circles and safe/crop zones drawn
 *                            on top to $TMPDIR/guidonica-banner-guides/ (review only)
 *
 * The staff strips are real captures of the production build, served in-process by Vite.
 * Math.random is seeded per clef, so every run draws the same music. Dev-only: needs the
 * run-guidonica Playwright setup (node .claude/skills/run-guidonica/driver.mjs --setup).
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PW_ENTRY, findChromium } from '../.claude/skills/run-guidonica/chromium.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/brand/banners');
const GUIDES = process.argv.includes('--guides');
const GUIDES_OUT = join(tmpdir(), 'guidonica-banner-guides');

const ACCENT = '#008269';
const INK = '#0f172a';
const BG_GRADIENT = 'linear-gradient(160deg, #e3ebf4 0%, #f1f5f9 50%, #e6edf5 100%)';

// Upload limits: Bluesky stores at most 1,000,000 bytes per image blob
const LIMITS = {
  'header-3000x1000': 1_000_000,
  'header-1500x500': 2 * 1024 * 1024,
  'youtube-2560x1440': 6 * 1024 * 1024,
};

// The share card's practice settings (ADR 0061), zoomed in for a profile-sized staff
const SETTINGS = {
  theme: 'light',
  language: 'en',
  timeSignature: '4/4',
  tempo: 80,
  subdivisions: { whole: false, half: true, quarter: true, eighth: true, sixteenth: false, thirtySecond: false, dotted: true },
  rests: true,
  ties: true,
  intervals: { unison: false, second: true, third: true, fourth: true, fifth: true, sixth: false, seventh: false, octave: false, ninthPlus: false },
  solfegeLabelMode: 'syllables',
  zoom: 1.3,
  zoomMode: 'manual',
  showTips: false, // no rotating tip over the staff (ADR 0087)
};

/**
 * Strips in CSS px, captured at DPR 2. The music depends on the seed and on the viewport
 * width (it sets how many measures are generated ahead), so each strip has its own seed,
 * picked for a full, varied stream. The header viewport is wider than its crop: the playhead
 * (22% of the viewport) lands at 495 px, clear of X's avatar, and the staff sits high in
 * its strip, so notes below it stay clear of X's mobile bottom crop.
 */
const STRIPS = {
  header: { clef: 'treble', seed: 3, width: 2250, crop: 1500, band: 240, above: 100 },
  youtube: { clef: 'treble', seed: 0x6d2b79f5, width: 2560, band: 291 },
  bass: { clef: 'bass', seed: 0x2545f491, width: 2560, band: 291 },
  alto: { clef: 'alto', seed: 0x1b873593, width: 2560, band: 291 },
};
const DPR = 2;
// Count-in (3 s at 80 BPM) plus enough playback for notes on both sides of the playhead
const PLAY_MS = 12_000;

function fail(message) {
  console.error(`banners: ${message}`);
  process.exit(1);
}

function freePort() {
  return new Promise((ok, ko) => {
    const server = createServer();
    server.once('error', ko);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => ok(port));
    });
  });
}

/** Production build in a temp dir, served by vite preview; returns its URL and a closer. */
async function serveBuild() {
  const { build, preview } = await import('vite');
  const outDir = mkdtempSync(join(tmpdir(), 'guidonica-banners-'));
  await build({ root: ROOT, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  const port = await freePort();
  const server = await preview({ root: ROOT, logLevel: 'warn', build: { outDir }, preview: { port, strictPort: true, host: '127.0.0.1', open: false } });
  return {
    url: `http://127.0.0.1:${port}/`,
    close: async () => {
      await server.close();
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}

/**
 * Plays the stream in one clef and returns the staff band of #scroller-canvas as a PNG data
 * URL: `band` CSS px tall with the staff's middle line `above` CSS px from its top (the
 * scroller centres the staff in the canvas), and the left `crop` CSS px wide. The playhead sits at 22% of the viewport width, so a viewport
 * wider than the crop moves it right in the strip.
 */
async function captureStrip(browser, url, { clef, seed, width, crop = width, band, above = band / 2 }) {
  const context = await browser.newContext({ viewport: { width, height: 1000 }, deviceScaleFactor: DPR, colorScheme: 'light', locale: 'en-US' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(({ settings, seed }) => {
    // mulberry32: the generator draws only from Math.random (generator.ts, ties.ts)
    let a = seed >>> 0;
    Math.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (const prefix of ['guidonica_', 'guidonica_nightly_']) {
      localStorage.setItem(`${prefix}onboarded_v1`, '1');
      localStorage.setItem(`${prefix}seen_version`, '9999.0.0');
      localStorage.setItem(`${prefix}settings_v1`, JSON.stringify(settings));
    }
  }, { settings: { ...SETTINGS, clef }, seed });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(PLAY_MS);
  const strip = await page.evaluate(({ bandCss, aboveCss, cropCss }) => {
    const canvas = document.querySelector('#scroller-canvas');
    const dpr = canvas.width / canvas.getBoundingClientRect().width;
    const h = Math.round(bandCss * dpr);
    const w = Math.round(cropCss * dpr);
    const y = Math.round(canvas.height / 2 - aboveCss * dpr);
    if (y < 0 || y + h > canvas.height || w > canvas.width) throw new Error(`canvas is ${canvas.width}x${canvas.height}, strip needs ${w}x${h}`);
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(canvas, 0, y, w, h, 0, 0, w, h);
    return out.toDataURL('image/png');
  }, { bandCss: band, aboveCss: above, cropCss: crop });
  await context.close();
  // Thrown, not fail(), so the finally below still stops the server and deletes the build
  if (errors.length) throw new Error(`${clef} capture logged errors:\n${errors.join('\n')}`);
  return strip;
}

const font = (file) => `data:font/woff2;base64,${readFileSync(join(ROOT, 'src/fonts', file)).toString('base64')}`;
const FONTS = `
@font-face { font-family: 'Alegreya'; font-weight: 700; src: url(${font('alegreya-700.woff2')}) format('woff2'); }
@font-face { font-family: 'Alegreya'; font-weight: 700; font-style: italic; src: url(${font('alegreya-italic.woff2')}) format('woff2'); }
@font-face { font-family: 'Ubuntu Mono'; font-weight: 700; src: url(${font('ubuntu-mono-700.woff2')}) format('woff2'); }`;

const BASE_CSS = `${FONTS}
* { margin: 0; box-sizing: border-box; }
html, body { width: var(--w); height: var(--h); overflow: hidden; }
body { position: relative; background: ${BG_GRADIENT}; color: ${INK}; -webkit-font-smoothing: antialiased; }
.wordmark { font: 700 var(--title) / 1 'Alegreya', serif; letter-spacing: -0.01em; }
.tagline { font: italic 700 var(--tag) / 1.1 'Alegreya', serif; color: ${ACCENT}; }
.pill { font: 700 var(--pill) / 1 'Ubuntu Mono', monospace; color: ${ACCENT}; padding: 0.45em 0.9em; border-radius: 999px;
  background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(0, 130, 105, 0.25); box-shadow: inset 0 1px 0 #fff; }
.strip { position: absolute; left: 0; width: 100%; background-size: 100% 100%;
  box-shadow: 0 -1px 0 rgba(15, 23, 42, 0.06), 0 -8px 24px rgba(15, 23, 42, 0.06); }`;

/** 3:1 header in 1500x500 CSS px; rendered at DPR 1 and 2. */
function headerHtml(strip) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
:root { --w: 1500px; --h: 500px; --title: 92px; --tag: 40px; --pill: 26px; }
.band { position: absolute; left: 420px; right: 60px; top: 60px; height: 190px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; }
.row { display: flex; align-items: center; gap: 28px; }
.strip { top: 260px; height: 240px; background-image: url(${strip}); }
</style></head><body>
<div class="band"><div class="row"><div class="wordmark">Guidonica</div><div class="pill">guidonica.it</div></div>
<div class="tagline">Sight-reading &amp; solfège practice</div></div>
<div class="strip"></div>
</body></html>`;
}

/** YouTube channel art, 2560x1440; the 1546x423 safe area is x 507–2053, y 508–931. */
function youtubeHtml(strip, above, below) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}
:root { --w: 2560px; --h: 1440px; --title: 96px; --tag: 52px; --pill: 32px; }
.band { position: absolute; left: 507px; width: 1546px; top: 516px; height: 112px;
  display: flex; align-items: center; justify-content: center; gap: 36px; }
.wordmark { transform: translateY(-4px); }
.strip { top: 640px; height: 291px; background-image: url(${strip}); }
/* multiply drops the strip's white canvas background, so only the notation shows */
.ghost { position: absolute; left: 0; width: 100%; height: 291px; background-size: 100% 100%; opacity: 0.2; mix-blend-mode: multiply; }
</style></head><body>
<div class="ghost" style="top: 108px; background-image: url(${above})"></div>
<div class="band"><div class="wordmark">Guidonica</div><div class="tagline">Sight-reading &amp; solfège practice</div><div class="pill">guidonica.it</div></div>
<div class="strip"></div>
<div class="ghost" style="top: 1041px; background-image: url(${below})"></div>
</body></html>`;
}

// Review overlays: avatar circles and crop/safe zones, in each format's CSS px
const HEADER_GUIDES = `
<div style="position:absolute;left:420px;top:60px;width:1020px;height:270px;outline:3px dashed #2563eb"></div>
<div style="position:absolute;left:0;top:0;width:1500px;height:60px;background:rgba(220,38,38,.18)"></div>
<div style="position:absolute;left:0;bottom:0;width:1500px;height:60px;background:rgba(220,38,38,.18)"></div>
<div title="X" style="position:absolute;left:40px;top:333px;width:333px;height:333px;border-radius:50%;border:4px solid #dc2626"></div>
<div title="Bluesky" style="position:absolute;left:35px;top:388px;width:225px;height:225px;border-radius:50%;border:4px dashed #0ea5e9"></div>
<div title="Mastodon" style="position:absolute;left:35px;top:383px;width:235px;height:235px;border-radius:20px;border:4px dotted #7c3aed"></div>`;
const YOUTUBE_GUIDES = `
<div style="position:absolute;left:507px;top:508px;width:1546px;height:423px;outline:4px dashed #2563eb"></div>
<div style="position:absolute;left:0;top:508px;width:2560px;height:423px;outline:4px solid #dc2626"></div>
<div style="position:absolute;left:0;top:0;width:2560px;height:1440px;outline:6px solid #7c3aed;outline-offset:-6px"></div>`;

async function render(browser, html, { width, height, dpr, path, type = 'png', quality }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type, quality, clip: { x: 0, y: 0, width, height } });
  await context.close();
}

if (!existsSync(PW_ENTRY)) fail('playwright-core is missing: run node .claude/skills/run-guidonica/driver.mjs --setup');
const executablePath = findChromium() ?? fail('no cached Chromium: run node .claude/skills/run-guidonica/driver.mjs --setup');
const { chromium } = await import(pathToFileURL(PW_ENTRY).href);

const server = await serveBuild();
const browser = await chromium.launch({ executablePath });
const written = [];
try {
  const header = await captureStrip(browser, server.url, STRIPS.header);
  const youtube = await captureStrip(browser, server.url, STRIPS.youtube);
  const bass = await captureStrip(browser, server.url, STRIPS.bass);
  const alto = await captureStrip(browser, server.url, STRIPS.alto);

  mkdirSync(OUT, { recursive: true });
  const jobs = [
    { name: 'header-1500x500', html: headerHtml(header), width: 1500, height: 500, dpr: 1, guides: HEADER_GUIDES },
    { name: 'header-3000x1000', html: headerHtml(header), width: 1500, height: 500, dpr: 2, guides: HEADER_GUIDES },
    { name: 'youtube-2560x1440', html: youtubeHtml(youtube, bass, alto), width: 2560, height: 1440, dpr: 1, guides: YOUTUBE_GUIDES },
  ];
  for (const job of jobs) {
    let path = join(OUT, `${job.name}.png`);
    await render(browser, job.html, { ...job, path });
    // Bluesky's 1 MB cap: fall back to a high-quality JPEG
    if (statSync(path).size > LIMITS[job.name]) {
      rmSync(path);
      path = join(OUT, `${job.name}.jpg`);
      await render(browser, job.html, { ...job, path, type: 'jpeg', quality: 92 });
    } else rmSync(join(OUT, `${job.name}.jpg`), { force: true });
    written.push({ name: job.name, path });
    if (GUIDES) {
      mkdirSync(GUIDES_OUT, { recursive: true });
      const guided = job.html.replace('</body>', `${job.guides}</body>`);
      await render(browser, guided, { ...job, dpr: 1, path: join(GUIDES_OUT, `${job.name}-guides.png`) });
    }
  }
} finally {
  await browser.close();
  await server.close();
}

let over = false;
for (const { name, path } of written) {
  const size = statSync(path).size;
  const ok = size <= LIMITS[name];
  over ||= !ok;
  console.log(`${ok ? 'ok  ' : 'OVER'} ${path.slice(ROOT.length + 1)}  ${size.toLocaleString('en-US')} B (limit ${LIMITS[name].toLocaleString('en-US')})`);
}
if (GUIDES) console.log(`guides: ${GUIDES_OUT}`);
if (over) fail('a banner is over its platform limit');

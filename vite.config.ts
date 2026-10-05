import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformWithEsbuild, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { UNRELEASED, appNotes } from './scripts/changelog.mjs';

export type Channel = 'release' | 'nightly';

/** The build's release channel from GUIDONICA_CHANNEL; unset means release (ADR 0078). */
export function buildChannel(value: string | undefined = process.env.GUIDONICA_CHANNEL): Channel {
  if (value === undefined || value === '' || value === 'release') return 'release';
  if (value === 'nightly') return 'nightly';
  throw new Error(`GUIDONICA_CHANNEL must be "release" or "nightly", got "${value}"`);
}

/** public/ files that are not part of the app and so are never precached (ADR 0063). */
const PUBLIC_NOT_PRECACHED = new Set(['CNAME', 'robots.txt', 'sitemap.xml', 'og-image.png']);

/** Relative URLs the worker precaches: the shell as './' plus every app file. */
export function precacheList(bundleNames: string[], publicNames: string[]): string[] {
  const app = bundleNames.filter((name) => name !== 'index.html');
  const pub = publicNames.filter((name) => !name.startsWith('.') && !PUBLIC_NOT_PRECACHED.has(name));
  return ['./', ...[...app, ...pub].sort()];
}

/** First 12 hex characters of a sha256 over the sorted names and contents. */
export function swVersion(entries: { name: string; content: string | Uint8Array }[]): string {
  const hash = createHash('sha256');
  for (const { name, content } of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    hash.update(name).update('\0').update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

/** Compiles src/sw.ts to dist/sw.js with the precache list and version baked in. */
export function serviceWorker(): Plugin {
  let publicDir = '';
  return {
    name: 'guidonica:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    async generateBundle(_, bundle) {
      const publicNames = publicDir ? readdirSync(publicDir) : [];
      const urls = precacheList(Object.keys(bundle), publicNames);
      const entries = urls.map((url) => {
        const name = url === './' ? 'index.html' : url;
        const file = bundle[name];
        if (file) return { name, content: file.type === 'chunk' ? file.code : file.source };
        return { name, content: readFileSync(join(publicDir, name)) };
      });
      const source = readFileSync(new URL('./src/sw.ts', import.meta.url), 'utf8');
      const { code } = await transformWithEsbuild(source, 'sw.ts', {
        loader: 'ts',
        format: 'iife',
        minify: true,
        target: 'es2020',
        define: {
          __SW_VERSION__: JSON.stringify(swVersion(entries)),
          __SW_PRECACHE__: JSON.stringify(urls),
          __SW_CHANNEL__: JSON.stringify(buildChannel()),
        },
      });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

const ROOT = dirname(fileURLToPath(import.meta.url));
const CHANGELOG = resolve(ROOT, 'CHANGELOG.md');
const NOTES_QUERY = '?notes';

/** One git value of the checkout being built; empty outside a repository. Never the clock. */
function gitValue(args: string[]): string {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Applies one exact edit to index.html, failing the build if the anchor moved. */
function replaceOnce(html: string, search: string | RegExp, replacement: string): string {
  const next = html.replace(search, replacement);
  if (next === html) throw new Error(`nightly index.html: anchor not found: ${String(search)}`);
  return next;
}

/** The nightly shell: noindex, its own title and the nightly settings key (ADR 0078). */
export function nightlyHtml(html: string): string {
  let out = replaceOnce(
    html,
    /<title>[^<]*<\/title>/,
    '<title>Guidonica Nightly</title>\n    <meta name="robots" content="noindex" />',
  );
  out = replaceOnce(out, /\n\s*<link rel="canonical"[^>]*>/, '');
  return replaceOnce(
    out,
    "localStorage.getItem('guidonica_settings_v1') || localStorage.getItem('solfege_scroller_settings_v2') || localStorage.getItem('solfege_scroller_settings_v1')",
    "localStorage.getItem('guidonica_nightly_settings_v1')",
  );
}

/** The nightly web manifest, installable next to the release app. */
export function nightlyManifest(json: string): string {
  const manifest = JSON.parse(json) as Record<string, unknown>;
  manifest.name = 'Guidonica Nightly';
  manifest.short_name = 'Guidonica Nightly';
  return JSON.stringify(manifest, null, 2) + '\n';
}

/**
 * Release channel build (ADR 0078): app version and channel constants, `*.md?notes`
 * changelog modules, and the nightly shell, manifest and public/ subset.
 */
export function channel(): Plugin {
  const name = buildChannel();
  const nightly = name === 'nightly';
  const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as { version: string };
  return {
    name: 'guidonica:channel',
    enforce: 'pre',
    config(_, { command }) {
      return {
        define: {
          __APP_VERSION__: JSON.stringify(pkg.version),
          __APP_CHANNEL__: JSON.stringify(name),
          __APP_COMMIT__: JSON.stringify(process.env.GUIDONICA_COMMIT || gitValue(['rev-parse', '--short', 'HEAD'])),
          __APP_BUILD_DATE__: JSON.stringify(process.env.GUIDONICA_COMMIT_DATE || gitValue(['log', '-1', '--format=%cs'])),
        },
        // A nightly build emits its own public/ subset below
        ...(nightly && command === 'build' ? { publicDir: false as const } : {}),
      };
    },
    load(id) {
      if (!id.endsWith('.md' + NOTES_QUERY)) return null;
      const file = id.slice(0, -NOTES_QUERY.length);
      this.addWatchFile(file);
      let notes = appNotes(readFileSync(file, 'utf8'), { unreleased: nightly });
      // Unreleased exists in English only; nightly shows it on top of every language
      if (nightly && resolve(file) !== CHANGELOG) {
        this.addWatchFile(CHANGELOG);
        const unreleased = appNotes(readFileSync(CHANGELOG, 'utf8'), { unreleased: true }).filter(
          (r) => r.version === UNRELEASED,
        );
        notes = [...unreleased, ...notes];
      }
      return `export default ${JSON.stringify(notes)};`;
    },
    transformIndexHtml(html) {
      return nightly ? nightlyHtml(html) : html;
    },
    generateBundle() {
      if (!nightly) return;
      const publicDir = resolve(ROOT, 'public');
      for (const file of readdirSync(publicDir).sort()) {
        // Hosting, crawler and share files belong to the release site only
        if (file.startsWith('.') || PUBLIC_NOT_PRECACHED.has(file)) continue;
        const path = join(publicDir, file);
        const source = file === 'manifest.webmanifest' ? nightlyManifest(readFileSync(path, 'utf8')) : readFileSync(path);
        this.emitFile({ type: 'asset', fileName: file, source });
      }
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [channel(), serviceWorker()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vexflow: ['vexflow/core'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});

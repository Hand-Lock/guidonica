import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformWithEsbuild, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

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
        },
      });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: code });
    },
  };
}

export default defineConfig({
  base: process.env.BASE_PATH || './',
  plugins: [serviceWorker()],
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

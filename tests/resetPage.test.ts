import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { LEGACY_STORAGE_KEY_V1, LEGACY_STORAGE_KEY_V2, storageKey } from '../src/storage';
import { cachePrefix } from '../src/sw';
import { resetPage, type Channel } from '../vite.config';

const ROOT = path.resolve(__dirname, '..');
const CHANNELS: Channel[] = ['release', 'nightly'];

/** Every storageKey('…') name in src/storage.ts, so a new key is covered without editing this test. */
const NAMES = [...fs.readFileSync(path.join(ROOT, 'src/storage.ts'), 'utf8').matchAll(/storageKey\('([^']+)'\)/g)].map(
  (m) => m[1],
);

const ORIGIN = 'https://guidonica.it';
const scopeOf = (channel: Channel): string => `${ORIGIN}/${channel === 'nightly' ? 'nightly/' : ''}`;

function inlineScript(html: string): string {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html);
  if (!match) throw new Error('no inline script');
  return match[1].trim();
}

class FakeStorage {
  readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(name: string): void {
    this.map.delete(name);
  }
}

/** Runs the page's script against fakes of the four globals it uses. */
async function runReset(channel: Channel, { storageThrows = false } = {}) {
  const storage = new FakeStorage();
  for (const name of NAMES) {
    for (const c of CHANNELS) storage.map.set(storageKey(name, c), '1');
  }
  storage.map.set(LEGACY_STORAGE_KEY_V1, '1');
  storage.map.set(LEGACY_STORAGE_KEY_V2, '1');
  storage.map.set('unrelated', '1');

  const registrations = CHANNELS.map((c) => ({ scope: scopeOf(c), unregistered: false }));
  const navigator = {
    serviceWorker: {
      getRegistrations: async () =>
        registrations.map((r) => ({
          scope: r.scope,
          unregister: async () => {
            r.unregistered = true;
            return true;
          },
        })),
    },
  };
  const cacheNames = new Set(['guidonica-abc', 'guidonica-nightly-def', 'other']);
  const caches = { keys: async () => [...cacheNames], delete: async (name: string) => cacheNames.delete(name) };
  const replaced: string[] = [];
  const location = { href: `${scopeOf(channel)}reset/`, replace: (url: string) => replaced.push(url) };
  const localStorage = storageThrows
    ? new Proxy({}, { get: () => { throw new DOMException('denied', 'SecurityError'); } })
    : storage;

  const run = new Function('localStorage', 'navigator', 'caches', 'location', `return ${inlineScript(resetPage(channel))}`);
  await run(localStorage, navigator, caches, location);
  return { storage, registrations, cacheNames, replaced };
}

describe('reset page (ADR 0105)', () => {
  it('finds the storage keys it must cover', () => {
    expect(NAMES).toEqual(expect.arrayContaining(['settings_v1', 'onboarded_v1', 'seen_version']));
  });

  it('release: clears only release keys, worker and caches, then opens the app', async () => {
    const { storage, registrations, cacheNames, replaced } = await runReset('release');
    expect([...storage.map.keys()].sort()).toEqual(
      [...NAMES.map((n) => storageKey(n, 'nightly')), 'unrelated'].sort(),
    );
    expect(registrations.map((r) => r.unregistered)).toEqual([true, false]);
    expect([...cacheNames].sort()).toEqual(['guidonica-nightly-def', 'other']);
    expect(replaced).toEqual(['../']);
  });

  it('nightly: clears only nightly keys, worker and caches, then opens the app', async () => {
    const { storage, registrations, cacheNames, replaced } = await runReset('nightly');
    expect([...storage.map.keys()].sort()).toEqual(
      [...NAMES.map((n) => storageKey(n, 'release')), LEGACY_STORAGE_KEY_V1, LEGACY_STORAGE_KEY_V2, 'unrelated'].sort(),
    );
    expect(registrations.map((r) => r.unregistered)).toEqual([false, true]);
    expect([...cacheNames].sort()).toEqual(['guidonica-abc', 'other']);
    expect(replaced).toEqual(['../']);
  });

  it('still clears the worker and caches and redirects when storage is blocked', async () => {
    for (const channel of CHANNELS) {
      const { registrations, cacheNames, replaced } = await runReset(channel, { storageThrows: true });
      expect(registrations.filter((r) => r.unregistered).map((r) => r.scope)).toEqual([scopeOf(channel)]);
      expect(cacheNames.size).toBe(2);
      expect(replaced).toEqual(['../']);
    }
  });

  it('bakes in the prefixes of storageKey() and cachePrefix()', () => {
    for (const channel of CHANNELS) {
      const script = inlineScript(resetPage(channel));
      expect(script).toContain(JSON.stringify(storageKey('x', channel).slice(0, -1)));
      expect(script).toContain(JSON.stringify(cachePrefix(channel)));
    }
  });

  it('is kept out of search results', () => {
    for (const channel of CHANNELS) {
      const html = resetPage(channel);
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(html).not.toContain('canonical');
    }
  });
});

// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Offline Service Worker (ADR 0063)
// Copyright (C) 2026 A. C. Lo Cascio

// Compiled to a classic script `sw.js` by the `serviceWorker()` plugin in vite.config.ts,
// which also defines the two constants below. They are read only inside the handlers,
// so tests can import route() without them.
declare const __SW_VERSION__: string;
declare const __SW_PRECACHE__: string[];

// The DOM lib has no worker types; these are the few members this worker uses.
interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  readonly request: Request;
  respondWith(response: Promise<Response>): void;
}

interface WorkerScope {
  readonly registration: { readonly scope: string };
  readonly clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
}

declare const self: WorkerScope;

export type Route = 'bypass' | 'shell' | 'asset';

/** Navigation deadline: past it, a stalled connection falls back to the cached shell. */
const NAVIGATE_TIMEOUT_MS = 3000;

/** Decides how a request is served. Pure, so it is unit-tested. */
export function route(request: Request, scopeUrl: string): Route {
  if (request.method !== 'GET') return 'bypass';
  if (new URL(request.url).origin !== new URL(scopeUrl).origin) return 'bypass';
  return request.mode === 'navigate' ? 'shell' : 'asset';
}

function cacheName(): string {
  return 'guidonica-' + __SW_VERSION__;
}

async function precache(): Promise<void> {
  const cache = await caches.open(cacheName());
  // 'reload' skips the HTTP cache (GitHub Pages sends max-age=600), so a stale
  // index.html is never stored next to the new hashed assets.
  await cache.addAll(__SW_PRECACHE__.map((url) => new Request(url, { cache: 'reload' })));
}

async function dropOldCaches(): Promise<void> {
  const keep = cacheName();
  const names = await caches.keys();
  await Promise.all(
    names.filter((name) => name.startsWith('guidonica-') && name !== keep).map((name) => caches.delete(name)),
  );
  await self.clients.claim();
}

/** Network first, so online users get the newest deploy; the cached shell otherwise. */
async function serveShell(request: Request): Promise<Response> {
  try {
    return await fetch(request, { signal: AbortSignal.timeout(NAVIGATE_TIMEOUT_MS) });
  } catch {
    const cache = await caches.open(cacheName());
    const shell = await cache.match(new URL('./', self.registration.scope).href, { ignoreVary: true });
    if (shell) return shell;
    throw new Error('offline and no cached shell');
  }
}

/** Cache first: precached files are content-hashed or tied to this worker version. */
async function serveAsset(request: Request): Promise<Response> {
  const cache = await caches.open(cacheName());
  // ignoreVary: a module or font request carries an Origin header the precache request
  // lacked, and a `Vary: Origin` response would otherwise never match.
  const hit = await cache.match(request, { ignoreVary: true });
  return hit ?? fetch(request);
}

// No skipWaiting(): an updated worker waits until every tab is closed, so a running
// page never loses the old hashed chunks it may still load (e.g. a lazy locale).
if (typeof self !== 'undefined' && 'registration' in self) {
  self.addEventListener('install', (event) => event.waitUntil(precache()));
  self.addEventListener('activate', (event) => event.waitUntil(dropOldCaches()));
  self.addEventListener('fetch', (event) => {
    const kind = route(event.request, self.registration.scope);
    if (kind === 'shell') event.respondWith(serveShell(event.request));
    else if (kind === 'asset') event.respondWith(serveAsset(event.request));
  });
}

// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Offline Service Worker (ADRs 0063, 0078, 0086)
// Copyright (C) 2026 A. C. Lo Cascio

// Compiled to a classic script `sw.js` by the `serviceWorker()` plugin in vite.config.ts,
// which also defines the constants below. They are read only inside the handlers,
// so tests can import route() and staleCaches() without them.
declare const __SW_VERSION__: string;
declare const __SW_PRECACHE__: string[];
declare const __SW_CHANNEL__: Channel;

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

/** Release serves the site root, nightly its /nightly/ subdirectory on the same origin (ADR 0078). */
export type Channel = 'release' | 'nightly';

const NIGHTLY_PREFIX = 'guidonica-nightly-';

/** Each channel names its caches apart, so neither worker deletes the other's. */
export function cachePrefix(channel: Channel): string {
  return channel === 'nightly' ? NIGHTLY_PREFIX : 'guidonica-';
}

/** This channel's caches other than `keep`, deleted when a new worker activates. */
export function staleCaches(names: string[], keep: string, channel: Channel): string[] {
  return names.filter(
    (name) =>
      name !== keep &&
      name.startsWith(cachePrefix(channel)) &&
      (channel === 'nightly' || !name.startsWith(NIGHTLY_PREFIX)),
  );
}

/** Navigation deadline: past it, a stalled connection falls back to the cached shell. */
const NAVIGATE_TIMEOUT_MS = 3000;

/**
 * Decides how a request is served. Pure, so it is unit-tested. The release worker's scope
 * contains nightly/, which it leaves to the network and the nightly worker: its own shell
 * must never answer a nightly navigation.
 */
export function route(request: Request, scopeUrl: string, channel: Channel = 'release'): Route {
  if (request.method !== 'GET') return 'bypass';
  const url = new URL(request.url);
  const scope = new URL(scopeUrl);
  if (url.origin !== scope.origin) return 'bypass';
  if (channel === 'release' && url.pathname.startsWith(new URL('nightly/', scope).pathname)) return 'bypass';
  return request.mode === 'navigate' ? 'shell' : 'asset';
}

/**
 * Where an offline navigation outside the shell goes: the shell itself. Only './' is
 * precached, and its relative asset URLs would break if served from a language page such
 * as it/ (ADR 0086). Null when the request is the shell. Pure, so it is unit-tested.
 */
export function offlineRedirect(requestUrl: string, scopeUrl: string): string | null {
  const shell = new URL('./', scopeUrl);
  return new URL(requestUrl).pathname === shell.pathname ? null : shell.href;
}

function cacheName(): string {
  return cachePrefix(__SW_CHANNEL__) + __SW_VERSION__;
}

async function precache(): Promise<void> {
  const cache = await caches.open(cacheName());
  // 'reload' skips the HTTP cache (GitHub Pages sends max-age=600), so a stale
  // index.html is never stored next to the new hashed assets.
  await cache.addAll(__SW_PRECACHE__.map((url) => new Request(url, { cache: 'reload' })));
}

async function dropOldCaches(): Promise<void> {
  const stale = staleCaches(await caches.keys(), cacheName(), __SW_CHANNEL__);
  await Promise.all(stale.map((name) => caches.delete(name)));
  await self.clients.claim();
}

/** Network first, so online users get the newest deploy; the cached shell otherwise. */
async function serveShell(request: Request): Promise<Response> {
  try {
    return await fetch(request, { signal: AbortSignal.timeout(NAVIGATE_TIMEOUT_MS) });
  } catch {
    // The fragment, such as an exercise link's (ADR 0085), survives the redirect
    const redirect = offlineRedirect(request.url, self.registration.scope);
    if (redirect) return Response.redirect(redirect, 302);
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
    const kind = route(event.request, self.registration.scope, __SW_CHANNEL__);
    if (kind === 'shell') event.respondWith(serveShell(event.request));
    else if (kind === 'asset') event.respondWith(serveAsset(event.request));
  });
}

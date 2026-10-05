// @ts-check
// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Announces a release on Bluesky and Mastodon from CHANGELOG.md (ADR 0081):
// a root post with the release headline and a guidonica.it link, then replies with the
// user-facing changes. Internal is never posted. Run by CI after Pages deploys a release.
// Usage: node scripts/announce.mjs v2026.10.1 [--dry-run]
// Env: BLUESKY_APP_PASSWORD, MASTODON_TOKEN (write:statuses only)
// Copyright (C) 2026 A. C. Lo Cascio

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseChangelog, plainText } from './changelog.mjs';

/** @typedef {import('./changelog.mjs').ChangeKind} ChangeKind */
/** @typedef {{ limit: number, count: (text: string) => number }} PostLimit */

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const SITE_URL = 'https://guidonica.it';
export const HASHTAGS = '#SightReading #MusicEducation';
const BLUESKY_HANDLE = 'guidonica.it';
const BLUESKY_SERVICE = 'https://bsky.social';
const MASTODON_SERVER = 'https://mastodon.social';
const MASTODON_ACCOUNT = 'guidonica';

/** Reply labels per user-facing section, in CHANGELOG order. Internal has none. */
/** @type {Partial<Record<ChangeKind, string>>} */
const LABELS = { added: 'New:', changed: 'Changed:', fixed: 'Fixed:', removed: 'Removed:', security: 'Security:' };

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

/**
 * User-perceived characters, as Bluesky counts them.
 * @param {string} text
 */
export function graphemes(text) {
  let n = 0;
  for (const _ of segmenter.segment(text)) n++;
  return n;
}

/**
 * Mastodon's length: code points (an upper bound for its grapheme count), with every URL
 * counted as 23 characters whatever its real length.
 * @param {string} text
 */
export function mastodonLength(text) {
  return [...text.replace(/https?:\/\/\S+/g, 'x'.repeat(23))].length;
}

/** @type {PostLimit} */
export const BLUESKY = { limit: 300, count: graphemes };
/** @type {PostLimit} */
export const MASTODON = { limit: 500, count: mastodonLength };

/**
 * The opening post. Throws when the version is missing.
 * @param {string} md
 * @param {string} version
 */
function release(md, version) {
  const found = parseChangelog(md).find((r) => r.version === version);
  if (!found) throw new Error(`CHANGELOG: no [${version}] section`);
  return found;
}

/**
 * Splits a line longer than `budget` at word boundaries, marking each cut with "…".
 * @param {string} text
 * @param {number} budget
 * @param {(text: string) => number} count
 * @returns {string[]}
 */
function splitLine(text, budget, count) {
  /** @type {string[]} */
  const pieces = [];
  let words = text.split(' ');
  let prefix = '';
  for (;;) {
    const whole = prefix + words.join(' ');
    if (count(whole) <= budget) return [...pieces, whole];
    let n = 0;
    while (n < words.length && count(`${prefix}${words.slice(0, n + 1).join(' ')}…`) <= budget) n++;
    if (n === 0) throw new Error(`announce: a word in "${text}" does not fit one post`);
    pieces.push(`${prefix}${words.slice(0, n).join(' ')}…`);
    words = words.slice(n);
    prefix = '…';
  }
}

/**
 * The thread for one release: the root post, then the user-facing changes packed greedily
 * into replies. A section that continues into the next reply repeats its label. Throws
 * when the root, whose length is set by the `> ` headline, exceeds the limit.
 * @param {string} md CHANGELOG.md
 * @param {string} version such as 2026.10.1
 * @param {PostLimit} platform
 * @returns {string[]}
 */
export function buildThread(md, version, { limit, count }) {
  const r = release(md, version);
  const headline = r.summary ? ` ${plainText(r.summary)}` : '';
  const root = `Guidonica ${version} is out.${headline}\n\n${SITE_URL}\n\n${HASHTAGS}`;
  if (count(root) > limit) {
    throw new Error(`announce: the [${version}] headline makes the first post ${count(root)} long, over ${limit}`);
  }

  /** @type {string[]} */
  const posts = [root];
  /** @type {string[]} */
  let post = [];
  const flush = () => {
    if (post.length) posts.push(post.join('\n'));
    post = [];
  };
  for (const section of r.sections) {
    const label = LABELS[section.kind];
    if (!label) continue;
    const budget = limit - count(`${label}\n`);
    let open = false;
    for (const item of section.items) {
      for (const piece of splitLine(`• ${plainText(item)}`, budget, count)) {
        const head = open ? [] : post.length ? ['', label] : [label];
        if (count([...post, ...head, piece].join('\n')) <= limit) {
          post.push(...head, piece);
        } else {
          flush();
          post.push(label, piece);
        }
        open = true;
      }
    }
  }
  flush();
  return posts;
}

/**
 * Bluesky rich-text facets for the links and hashtags in `text`, as UTF-8 byte ranges.
 * @param {string} text
 */
export function blueskyFacets(text) {
  const bytes = (/** @type {string} */ s) => Buffer.byteLength(s, 'utf8');
  /** @type {{ index: { byteStart: number, byteEnd: number }, features: Record<string, string>[] }[]} */
  const facets = [];
  for (const m of text.matchAll(/https?:\/\/[^\s]+?(?=[.,;:!?)]*(?:\s|$))/g)) {
    const byteStart = bytes(text.slice(0, m.index));
    facets.push({
      index: { byteStart, byteEnd: byteStart + bytes(m[0]) },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: m[0] }],
    });
  }
  for (const m of text.matchAll(/(?<=^|\s)#(\p{L}[\p{L}\p{N}_]*)/gu)) {
    const byteStart = bytes(text.slice(0, m.index));
    facets.push({
      index: { byteStart, byteEnd: byteStart + bytes(m[0]) },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: m[1] }],
    });
  }
  return facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
}

/** The marker both platforms search for before posting, so a re-run never double-posts. */
const marker = (/** @type {string} */ version) => `Guidonica ${version} is out`;

/**
 * JSON over fetch; throws with the status and the start of the response body.
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<any>}
 */
async function request(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new Error(`${init?.method ?? 'GET'} ${new URL(url).pathname} → ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * The og: card text in index.html.
 * @param {string} property
 */
function ogMeta(property) {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const m = new RegExp(`<meta property="${property}" content="([^"]*)"`).exec(html);
  if (!m) throw new Error(`index.html has no ${property}`);
  return m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

/**
 * @param {string[]} thread
 * @param {string} version
 */
async function postBluesky(thread, version) {
  const password = process.env.BLUESKY_APP_PASSWORD;
  if (!password) throw new Error('BLUESKY_APP_PASSWORD is not set');
  const session = await request(`${BLUESKY_SERVICE}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: BLUESKY_HANDLE, password }),
  });
  /** @type {{ id: string, serviceEndpoint: string }[]} */
  const services = session.didDoc?.service ?? [];
  const pds = services.find((s) => s.id.endsWith('#atproto_pds'))?.serviceEndpoint ?? BLUESKY_SERVICE;
  const auth = { Authorization: `Bearer ${session.accessJwt}` };
  const did = session.did;

  const recent = await request(
    `${pds}/xrpc/com.atproto.repo.listRecords?repo=${encodeURIComponent(did)}&collection=app.bsky.feed.post&limit=50`,
    { headers: auth },
  );
  if (recent.records.some((/** @type {any} */ r) => String(r.value?.text ?? '').includes(marker(version)))) {
    console.log(`Bluesky: ${version} is already announced, skipping`);
    return;
  }

  const { blob } = await request(`${pds}/xrpc/com.atproto.repo.uploadBlob`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'image/png' },
    body: readFileSync(join(ROOT, 'public/og-image.png')),
  });
  const card = {
    $type: 'app.bsky.embed.external',
    external: { uri: SITE_URL, title: ogMeta('og:title'), description: ogMeta('og:description'), thumb: blob },
  };

  /** @type {{ uri: string, cid: string } | null} */
  let root = null;
  /** @type {{ uri: string, cid: string } | null} */
  let parent = null;
  for (const text of thread) {
    const record = {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: new Date().toISOString(),
      langs: ['en'],
      facets: blueskyFacets(text),
      ...(root && parent ? { reply: { root, parent } } : { embed: card }),
    };
    const { uri, cid } = await request(`${pds}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo: did, collection: 'app.bsky.feed.post', record }),
    });
    parent = { uri, cid };
    root ??= parent;
    console.log(`Bluesky: https://bsky.app/profile/${BLUESKY_HANDLE}/post/${uri.split('/').pop()}`);
  }
}

/**
 * @param {string[]} thread
 * @param {string} version
 */
async function postMastodon(thread, version) {
  const token = process.env.MASTODON_TOKEN;
  if (!token) throw new Error('MASTODON_TOKEN is not set');
  const account = await request(`${MASTODON_SERVER}/api/v1/accounts/lookup?acct=${MASTODON_ACCOUNT}`);
  const recent = await request(
    `${MASTODON_SERVER}/api/v1/accounts/${account.id}/statuses?limit=40&exclude_replies=true`,
  );
  if (recent.some((/** @type {any} */ s) => String(s.content ?? '').includes(marker(version)))) {
    console.log(`Mastodon: ${version} is already announced, skipping`);
    return;
  }

  /** @type {string | null} */
  let parent = null;
  for (const [i, text] of thread.entries()) {
    const status = await request(`${MASTODON_SERVER}/api/v1/statuses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `guidonica-v${version}-${i}`,
      },
      body: JSON.stringify({
        status: text,
        language: 'en',
        // Replies stay off public timelines, so the thread doesn't flood them.
        visibility: parent ? 'unlisted' : 'public',
        ...(parent ? { in_reply_to_id: parent } : {}),
      }),
    });
    parent = status.id;
    console.log(`Mastodon: ${status.url}`);
  }
}

async function main() {
  const tag = process.argv[2];
  if (!tag || !/^v\d/.test(tag)) {
    console.error('usage: node scripts/announce.mjs <tag> [--dry-run]');
    process.exit(1);
  }
  const version = tag.slice(1);
  const md = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
  const threads = { Bluesky: buildThread(md, version, BLUESKY), Mastodon: buildThread(md, version, MASTODON) };

  if (process.argv.includes('--dry-run')) {
    for (const [name, thread] of Object.entries(threads)) {
      console.log(`===== ${name} (${thread.length} posts) =====`);
      for (const post of thread) console.log(`${post}\n-----`);
    }
    return;
  }

  // The platforms are independent: one failing never stops the other.
  let failed = false;
  for (const [name, post] of /** @type {const} */ ([['Bluesky', postBluesky], ['Mastodon', postMastodon]])) {
    try {
      await post(threads[name], version);
    } catch (error) {
      failed = true;
      console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exit(1);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) await main();

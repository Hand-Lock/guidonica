import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { UNRELEASED, parseChangelog } from '../scripts/changelog.mjs';
import {
  BLUESKY,
  MASTODON,
  blueskyFacets,
  buildThread,
  graphemes,
  mastodonLength,
} from '../scripts/announce.mjs';

const ROOT = path.resolve(__dirname, '..');

const SAMPLE = `# Changelog

## [Unreleased]

## [2026.11.0] - 2026-11-02

> Practise **5/4**, and the metronome
> sounds warmer (ADR 0090).

### Added

- Practise \`5/4\` (ADR 0090).
- A second [feature](https://example.com).

### Internal

- A CI secret detail.

### Fixed

- A bug is gone.

## [2026.10.0] - 2026-10-05

### Added

- First thing.
`;

/** A release whose bullets are given, under one Added section. */
const release = (items: string[], summary = '') =>
  `## [2026.12.0] - 2026-12-01\n\n${summary ? `> ${summary}\n\n` : ''}### Added\n\n${items.map((i) => `- ${i}`).join('\n')}\n`;

const words = (n: number, word = 'word') => Array.from({ length: n }, () => word).join(' ');

describe('release announcements (ADR 0081)', () => {
  it('opens with the headline, a guidonica.it link and the hashtags', () => {
    const thread = buildThread(SAMPLE, '2026.11.0', BLUESKY);
    expect(thread[0]).toBe(
      'Guidonica 2026.11.0 is out. Practise 5/4, and the metronome sounds warmer.\n\n' +
        'https://guidonica.it\n\n#SightReading #MusicEducation',
    );
    expect(buildThread(SAMPLE, '2026.10.0', MASTODON)[0]).toBe(
      'Guidonica 2026.10.0 is out.\n\nhttps://guidonica.it\n\n#SightReading #MusicEducation',
    );
    expect(() => buildThread(SAMPLE, '2030.1.0', BLUESKY)).toThrow(/no \[2030\.1\.0\]/);
  });

  it('replies with the user-facing sections in plain text, never Internal', () => {
    const thread = buildThread(SAMPLE, '2026.11.0', MASTODON);
    expect(thread.slice(1)).toEqual(['New:\n• Practise 5/4.\n• A second feature.\n\nFixed:\n• A bug is gone.']);
    expect(thread.join('\n')).not.toContain('CI secret');
  });

  it('throws when the headline makes the first post too long', () => {
    expect(() => buildThread(release(['x'], words(60)), '2026.12.0', BLUESKY)).toThrow(/headline/);
    expect(() => buildThread(release(['x'], words(60)), '2026.12.0', MASTODON)).not.toThrow();
  });

  it('packs bullets greedily and repeats a section label in the next reply', () => {
    const bullet = words(20); // "• " + 99 characters
    const thread = buildThread(release([bullet, bullet, bullet, bullet]), '2026.12.0', BLUESKY);
    expect(thread.slice(1)).toEqual([`New:\n• ${bullet}\n• ${bullet}`, `New:\n• ${bullet}\n• ${bullet}`]);
    for (const post of thread) expect(graphemes(post)).toBeLessThanOrEqual(BLUESKY.limit);
  });

  it('splits a bullet longer than a post at a word boundary', () => {
    const long = words(100); // 499 characters
    const thread = buildThread(release([long]), '2026.12.0', BLUESKY);
    const replies = thread.slice(1);
    expect(replies.length).toBe(2);
    expect(replies[0]).toMatch(/^New:\n• word( word)*…$/);
    expect(replies[1]).toMatch(/^New:\n…word( word)*$/);
    for (const post of replies) expect(graphemes(post)).toBeLessThanOrEqual(BLUESKY.limit);
    const rejoined = replies.map((p) => p.replace(/^New:\n/, '')).join('').replace(/……/g, ' ');
    expect(rejoined).toBe(`• ${long}`);
  });

  it('counts graphemes on Bluesky and code points on Mastodon, with URLs as 23', () => {
    const accented = 'é'; // é as e + combining acute: 1 grapheme, 2 code points
    expect(graphemes(`${accented}👍🏽`)).toBe(2);
    expect(mastodonLength(`${accented}👍🏽`)).toBe(4);
    expect(mastodonLength('https://guidonica.it')).toBe(23);

    const bullet = words(25, accented); // 49 graphemes, 74 code points
    const md = release([bullet, bullet, bullet]);
    // "New:\n" + 3 × ("• " + bullet) + 2 newlines: 160 graphemes, 235 code points
    expect(buildThread(md, '2026.12.0', { limit: 200, count: graphemes }).length).toBe(2);
    expect(buildThread(md, '2026.12.0', { limit: 200, count: mastodonLength }).length).toBe(3);
  });

  it('marks links and hashtags as UTF-8 byte ranges for Bluesky', () => {
    const text = 'Guidonica è qui.\n\nhttps://guidonica.it.\n\n#SightReading #Solfège';
    const facets = blueskyFacets(text);
    expect(facets.map((f) => [f.index, f.features[0]])).toEqual([
      [{ byteStart: 19, byteEnd: 39 }, { $type: 'app.bsky.richtext.facet#link', uri: 'https://guidonica.it' }],
      [{ byteStart: 42, byteEnd: 55 }, { $type: 'app.bsky.richtext.facet#tag', tag: 'SightReading' }],
      [{ byteStart: 56, byteEnd: 65 }, { $type: 'app.bsky.richtext.facet#tag', tag: 'Solfège' }],
    ]);
    const bytes = Buffer.from(text);
    expect(facets.map((f) => bytes.subarray(f.index.byteStart, f.index.byteEnd).toString())).toEqual([
      'https://guidonica.it',
      '#SightReading',
      '#Solfège',
    ]);
  });
});

describe('the real CHANGELOG.md announces every release (ADR 0081)', () => {
  const md = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf-8');
  const released = parseChangelog(md).filter((r) => r.version !== UNRELEASED);

  for (const r of released) {
    for (const [name, platform] of [['Bluesky', BLUESKY], ['Mastodon', MASTODON]] as const) {
      it(`${r.version} fits ${name}`, () => {
        const thread = buildThread(md, r.version, platform);
        expect(thread[0].startsWith(`Guidonica ${r.version} is out.`)).toBe(true);
        expect(thread.length).toBeGreaterThan(1);
        for (const post of thread) expect(platform.count(post)).toBeLessThanOrEqual(platform.limit);
      });
    }
  }
});

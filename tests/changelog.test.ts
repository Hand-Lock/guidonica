import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { UNRELEASED, appNotes, cutRelease, parseChangelog, plainText, releaseSection } from '../scripts/changelog.mjs';
import { linkAdrs, releaseNotes } from '../scripts/release-notes.mjs';
import { nextVersion } from '../scripts/release.mjs';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf-8');

const SAMPLE = `# Changelog

Intro text with a [link](https://example.com).

## [Unreleased]

> A headline for the
> announcement.

### Added

- A new \`thing\` with **bold** text,
  continued on a second line (ADR 0078).

### Internal

- CI tweak (ADRs 0069, 0077).

### Fixed

## [2026.9.0] - 2026-09-20

### Fixed

- A [bug](https://example.com/bug) is gone.

## [1.0.0] - 2026-09-01

### Added

- First public release.

[Unreleased]: https://github.com/Hand-Lock/guidonica/compare/v2026.9.0...HEAD
[2026.9.0]: https://github.com/Hand-Lock/guidonica/compare/v1.0.0...v2026.9.0
[1.0.0]: https://github.com/Hand-Lock/guidonica/releases/tag/v1.0.0
`;

describe('changelog parser (ADR 0078)', () => {
  it('reads releases, sections and multi-line bullets, dropping empty sections', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      [UNRELEASED, null],
      ['2026.9.0', '2026-09-20'],
      ['1.0.0', '2026-09-01'],
    ]);
    expect(releases[0].sections.map((s) => s.kind)).toEqual(['added', 'internal']);
    expect(releases[0].sections[0].items).toEqual(['A new `thing` with **bold** text, continued on a second line (ADR 0078).']);
  });

  it('reads an optional headline, joining its quote lines (ADR 0081)', () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases[0].summary).toBe('A headline for the announcement.');
    expect(releases[1].summary).toBeUndefined();
    expect(appNotes(SAMPLE, { unreleased: true })[0]).not.toHaveProperty('summary');
    expect(() => parseChangelog('## [Unreleased]\n\n### Added\n\n- x\n\n> late quote\n')).toThrow(/unexpected line/);
  });

  it('rejects unknown sections and stray lines', () => {
    expect(() => parseChangelog('## [Unreleased]\n\n### Improved\n\n- x\n')).toThrow(/unknown section/);
    expect(() => parseChangelog('## [Unreleased]\n\nloose text\n')).toThrow(/unexpected line/);
    expect(() => parseChangelog('## [Unreleased]\n\n## 2026.9.0\n')).toThrow(/malformed/);
  });

  it('strips ADR references and markdown for the app', () => {
    expect(plainText('A new `thing` with **bold** and _em_ text (ADR 0078).')).toBe('A new thing with bold and em text.');
    expect(plainText('See [the docs](https://x.y) (ADRs 0064, 0065).')).toBe('See the docs.');
    expect(plainText('snake_case_name stays')).toBe('snake_case_name stays');
  });

  it('ships user-facing sections only, and Unreleased only when asked', () => {
    expect(appNotes(SAMPLE, { unreleased: false }).map((r) => r.version)).toEqual(['2026.9.0', '1.0.0']);
    const nightly = appNotes(SAMPLE, { unreleased: true });
    expect(nightly[0]).toEqual({
      version: UNRELEASED,
      date: null,
      sections: [{ kind: 'added', items: ['A new thing with bold text, continued on a second line.'] }],
    });
    expect(nightly[1].sections[0].items).toEqual(['A bug is gone.']);
  });

  it('cuts a release under a fresh Unreleased and rewrites the compare links', () => {
    const md = cutRelease(SAMPLE, '2026.10.0', '2026-10-05');
    const releases = parseChangelog(md);
    expect(releases.map((r) => r.version)).toEqual([UNRELEASED, '2026.10.0', '2026.9.0', '1.0.0']);
    expect(releases[0].sections).toEqual([]);
    expect(releases[1].date).toBe('2026-10-05');
    expect(releases[1].sections.map((s) => s.kind)).toEqual(['added', 'internal']);
    expect(releases[1].summary).toBe('A headline for the announcement.');
    expect(md).toContain('## [2026.10.0] - 2026-10-05\n\n> A headline for the announcement.\n\n### Added');
    expect(md).toContain('[Unreleased]: https://github.com/Hand-Lock/guidonica/compare/v2026.10.0...HEAD\n');
    expect(md).toContain('[2026.10.0]: https://github.com/Hand-Lock/guidonica/compare/v2026.9.0...v2026.10.0\n');
    expect(md).not.toMatch(/\n{3,}/);
    expect(md).not.toContain('### Fixed\n\n## [2026.10.0]');
  });

  it('refuses to cut an empty Unreleased', () => {
    const md = cutRelease(SAMPLE, '2026.10.0', '2026-10-05');
    expect(() => cutRelease(md, '2026.10.1', '2026-10-06')).toThrow(/empty/);
  });

  it('extracts one release for the GitHub Release, Internal included', () => {
    const section = releaseSection(cutRelease(SAMPLE, '2026.10.0', '2026-10-05'), '2026.10.0');
    expect(section.startsWith('> A headline for the announcement.\n\n### Added')).toBe(true);
    expect(section).toContain('### Internal');
    expect(section).not.toContain('2026.9.0');
    expect(() => releaseSection(SAMPLE, '2030.1.0')).toThrow();
  });

  it('links ADR numbers in the GitHub Release body', () => {
    const files = ['0069-security-audit.md', '0077-node-24.md'];
    expect(linkAdrs('- CI tweak (ADRs 0069, 0077).', 'v2026.10.0', files)).toBe(
      '- CI tweak (ADRs [0069](https://github.com/Hand-Lock/guidonica/blob/v2026.10.0/docs/adr/0069-security-audit.md), ' +
        '[0077](https://github.com/Hand-Lock/guidonica/blob/v2026.10.0/docs/adr/0077-node-24.md)).',
    );
    const notes = releaseNotes(SAMPLE, 'v2026.9.0', files);
    expect(notes).toContain('- A [bug](https://example.com/bug) is gone.');
    expect(notes.trimEnd().endsWith('https://github.com/Hand-Lock/guidonica/compare/v1.0.0...v2026.9.0')).toBe(true);
  });

  it('numbers releases YYYY.M.MICRO from the month tags', () => {
    const date = new Date('2026-10-05T12:00:00Z');
    expect(nextVersion(date, ['v1.0.0'])).toBe('2026.10.0');
    expect(nextVersion(date, ['v1.0.0', 'v2026.10.0', 'v2026.10.1', 'v2026.9.4'])).toBe('2026.10.2');
    expect(nextVersion(new Date('2027-01-02T00:00:00Z'), ['v2026.12.3'])).toBe('2027.1.0');
  });
});

describe('the real CHANGELOG.md (ADR 0078)', () => {
  const md = read('CHANGELOG.md');
  const releases = parseChangelog(md);
  const released = releases.filter((r) => r.version !== UNRELEASED);

  it('opens with Unreleased, then dated CalVer releases newest first', () => {
    expect(releases[0].version).toBe(UNRELEASED);
    expect(released.length).toBeGreaterThan(0);
    for (const r of released) {
      expect(r.version).toMatch(/^(20\d\d\.(1[0-2]|[1-9])\.\d+|1\.0\.0)$/);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const dates = released.map((r) => r.date ?? '');
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('has a link definition for every heading', () => {
    for (const r of releases) expect(md).toContain(`\n[${r.version}]: https://github.com/Hand-Lock/guidonica/`);
  });

  it('matches package.json, whose version is the newest release', () => {
    const pkg = JSON.parse(read('package.json')) as { version: string };
    expect(pkg.version).toBe(released[0].version);
  });

  for (const lang of ['it', 'fr', 'de', 'es']) {
    it(`is mirrored by src/i18n/changelog/${lang}.md for every released version`, () => {
      const translated = parseChangelog(read(`src/i18n/changelog/${lang}.md`));
      expect(translated.map((r) => [r.version, r.date])).toEqual(released.map((r) => [r.version, r.date]));
      released.forEach((r, i) => {
        const shape = (sections: typeof r.sections) => sections.map((s) => [s.kind, s.items.length]);
        expect(shape(translated[i].sections)).toEqual(shape(r.sections.filter((s) => s.kind !== 'internal')));
      });
    });
  }
});

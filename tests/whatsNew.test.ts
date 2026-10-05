import { describe, it, expect } from 'vitest';
import en from '../src/i18n/locales/en';
import itMessages from '../src/i18n/locales/it';
import {
  APP_VERSION,
  LEGACY_SEEN_VERSION,
  NOTES_LOADERS,
  ReleaseNotes,
  UNRELEASED,
  bootAction,
  compareVersions,
  releasesToShow,
  renderReleaseNotes,
  versionHref,
  versionLabel,
} from '../src/whatsNew';
import { SUPPORTED_LANGUAGES } from '../src/i18n';

const release = (version: string, date: string | null = '2026-10-05'): ReleaseNotes => ({
  version,
  date,
  sections: [{ kind: 'added', items: [`Item of ${version}`] }],
});

describe('version comparison (ADR 0078)', () => {
  it('compares numeric components, not strings', () => {
    expect(compareVersions('2026.10.0', '2026.9.3')).toBe(1);
    expect(compareVersions('2026.9.3', '2026.10.0')).toBe(-1);
    expect(compareVersions('1.0.0', '2026.10.0')).toBe(-1);
    expect(compareVersions('2026.10', '2026.10.0')).toBe(0);
    expect(compareVersions('2026.10.1', '2026.10.0')).toBe(1);
  });
});

describe('releases to show (ADR 0078)', () => {
  const all = [release(UNRELEASED, null), release('2026.10.1'), release('2026.10.0'), release('2026.9.0'), release('1.0.0')];

  it('lists the missed releases up to the running one, newest first, without Unreleased', () => {
    expect(releasesToShow(all, '1.0.0', '2026.10.0').map((r) => r.version)).toEqual(['2026.10.0', '2026.9.0']);
    expect(releasesToShow([...all].reverse(), '2026.9.0', '2026.10.1').map((r) => r.version)).toEqual(['2026.10.1', '2026.10.0']);
  });

  it('shows nothing when already up to date', () => {
    expect(releasesToShow(all, '2026.10.1', '2026.10.1')).toEqual([]);
  });
});

describe('boot action (ADR 0078)', () => {
  it('stores the version silently for a new user', () => {
    expect(bootAction(true, null, '2026.10.0')).toEqual({ kind: 'store' });
  });

  it('treats a returning user from before versioning as having seen 1.0.0', () => {
    expect(LEGACY_SEEN_VERSION).toBe('1.0.0');
    expect(bootAction(false, null, '2026.10.0')).toEqual({ kind: 'show', since: '1.0.0' });
    expect(bootAction(false, null, '1.0.0')).toEqual({ kind: 'none' });
  });

  it('shows the notes after an upgrade', () => {
    expect(bootAction(false, '2026.9.0', '2026.10.0')).toEqual({ kind: 'show', since: '2026.9.0' });
  });

  it('does nothing when up to date and stores silently after a rollback', () => {
    expect(bootAction(false, '2026.10.0', '2026.10.0')).toEqual({ kind: 'none' });
    expect(bootAction(false, '2026.11.0', '2026.10.0')).toEqual({ kind: 'store' });
  });
});

describe('release notes dialog (ADR 0078)', () => {
  it('renders versions, localized dates and section titles as text', () => {
    const container = document.createElement('div');
    const notes: ReleaseNotes[] = [
      { version: UNRELEASED, date: null, sections: [{ kind: 'fixed', items: ['<b>not markup</b>'] }] },
      {
        version: '2026.10.0',
        date: '2026-10-05',
        sections: [
          { kind: 'changed', items: ['Changed one'] },
          { kind: 'added', items: ['Added one', 'Added two'] },
        ],
      },
    ];
    renderReleaseNotes(container, notes, itMessages, 'it');
    const articles = container.querySelectorAll('article.whats-new-release');
    expect(articles).toHaveLength(2);
    expect(articles[0].querySelector('h3')?.textContent).toBe(itMessages.unreleased);
    expect(articles[0].querySelector('b')).toBeNull();
    expect(articles[0].querySelector('li')?.textContent).toBe('<b>not markup</b>');
    expect(articles[1].querySelector('h3')?.textContent).toContain('2026.10.0');
    expect(articles[1].querySelector('time')?.getAttribute('datetime')).toBe('2026-10-05');
    expect(articles[1].querySelector('time')?.textContent).toMatch(/5 ottobre 2026/);
    expect([...articles[1].querySelectorAll('h4')].map((h) => h.textContent)).toEqual([
      itMessages.changeKinds.added,
      itMessages.changeKinds.changed,
    ]);
  });

  it('labels and links the release build', () => {
    expect(versionLabel(en)).toBe(APP_VERSION);
    expect(versionHref()).toBe(`https://github.com/Hand-Lock/guidonica/releases/tag/v${APP_VERSION}`);
  });

  it('has a notes loader per language, each returning released versions only', async () => {
    expect(Object.keys(NOTES_LOADERS).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());
    for (const lang of SUPPORTED_LANGUAGES) {
      const notes = (await NOTES_LOADERS[lang]()).default;
      expect(notes.length).toBeGreaterThan(0);
      expect(notes.some((r) => r.version === UNRELEASED)).toBe(false);
      expect(notes.find((r) => r.version === APP_VERSION)).toBeDefined();
    }
  });
});

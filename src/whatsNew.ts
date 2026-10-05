// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - "What's new" release notes (ADR 0078)
// Copyright (C) 2026 A. C. Lo Cascio

import type { Language, Messages } from './i18n';

/** Section kinds shipped in-app; CHANGELOG.md's Internal sections never reach the bundle. */
export type ChangeKind = 'added' | 'changed' | 'fixed' | 'removed' | 'security';

/** One release as the `*.md?notes` modules export it, newest first. */
export interface ReleaseNotes {
  /** CalVer such as 2026.10.0, or 'Unreleased' (nightly builds only). */
  version: string;
  /** YYYY-MM-DD; null for Unreleased. */
  date: string | null;
  sections: { kind: ChangeKind; items: string[] }[];
}

export const UNRELEASED = 'Unreleased';
export const APP_VERSION = __APP_VERSION__;
export const IS_NIGHTLY = __APP_CHANNEL__ === 'nightly';
/** Version assumed for a returning user from before versioning: the first public release. */
export const LEGACY_SEEN_VERSION = '1.0.0';

const REPO_URL = 'https://github.com/Hand-Lock/guidonica';
export const CHANGELOG_URL = `${REPO_URL}/blob/main/CHANGELOG.md`;

// Explicit map so Vite emits one small notes chunk per language, like the locale chunks
export const NOTES_LOADERS: Record<Language, () => Promise<{ default: ReleaseNotes[] }>> = {
  en: () => import('../CHANGELOG.md?notes'),
  it: () => import('./i18n/changelog/it.md?notes'),
  fr: () => import('./i18n/changelog/fr.md?notes'),
  de: () => import('./i18n/changelog/de.md?notes'),
  es: () => import('./i18n/changelog/es.md?notes'),
};

/** Compares dot-separated numeric versions; a missing component counts as 0. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

/** Released versions with seen < v ≤ current, newest first. */
export function releasesToShow(releases: readonly ReleaseNotes[], seen: string, current: string): ReleaseNotes[] {
  return releases
    .filter((r) => r.version !== UNRELEASED && compareVersions(seen, r.version) < 0 && compareVersions(r.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * What the app does with the notes at boot: a new user stores the current version
 * silently, an upgrade shows what was missed since `since`, a rollback stores silently.
 */
export type BootAction = { kind: 'none' } | { kind: 'store' } | { kind: 'show'; since: string };

export function bootAction(firstVisit: boolean, seen: string | null, current: string): BootAction {
  if (firstVisit) return { kind: 'store' };
  const since = seen ?? LEGACY_SEEN_VERSION;
  const order = compareVersions(since, current);
  if (order < 0) return { kind: 'show', since };
  return order > 0 ? { kind: 'store' } : { kind: 'none' };
}

/** About's version label: "2026.10.0", or "Nightly · 2026.10.0+229f72e · 2026-10-05". */
export function versionLabel(m: Messages): string {
  if (!IS_NIGHTLY) return APP_VERSION;
  const build = __APP_COMMIT__ ? `${APP_VERSION}+${__APP_COMMIT__}` : APP_VERSION;
  return [m.nightly, build, __APP_BUILD_DATE__].filter(Boolean).join(' · ');
}

/** The GitHub Release of this version, or the commit a nightly build was made from. */
export function versionHref(): string {
  if (IS_NIGHTLY && __APP_COMMIT__) return `${REPO_URL}/commit/${__APP_COMMIT__}`;
  return `${REPO_URL}/releases/tag/v${APP_VERSION}`;
}

const KIND_ORDER: readonly ChangeKind[] = ['added', 'changed', 'fixed', 'removed', 'security'];

function formatDate(date: string, lang: Language): string {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) return date;
  return new Intl.DateTimeFormat(lang, { dateStyle: 'long', timeZone: 'UTC' }).format(time);
}

/** Fills `container` with the releases, using DOM text nodes only (never innerHTML). */
export function renderReleaseNotes(container: HTMLElement, releases: readonly ReleaseNotes[], m: Messages, lang: Language): void {
  const doc = container.ownerDocument;
  container.replaceChildren();
  for (const release of releases) {
    const article = doc.createElement('article');
    article.className = 'whats-new-release';
    const heading = doc.createElement('h3');
    heading.textContent = release.version === UNRELEASED ? m.unreleased : release.version;
    if (release.date) {
      const time = doc.createElement('time');
      time.dateTime = release.date;
      time.textContent = formatDate(release.date, lang);
      heading.append(' ', time);
    }
    article.append(heading);
    const sections = [...release.sections].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
    for (const section of sections) {
      const title = doc.createElement('h4');
      title.textContent = m.changeKinds[section.kind];
      const list = doc.createElement('ul');
      for (const item of section.items) {
        const li = doc.createElement('li');
        li.textContent = item;
        list.append(li);
      }
      article.append(title, list);
    }
    container.append(article);
  }
}

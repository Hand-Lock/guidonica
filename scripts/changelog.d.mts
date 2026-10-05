export type ChangeKind = 'added' | 'changed' | 'fixed' | 'removed' | 'security' | 'internal';
export interface ChangeSection {
  kind: ChangeKind;
  items: string[];
}
export interface ChangelogRelease {
  version: string;
  /** YYYY-MM-DD; null for Unreleased. */
  date: string | null;
  sections: ChangeSection[];
}

export const UNRELEASED: 'Unreleased';
export const REPO_URL: string;
export const CHANGE_KINDS: readonly ChangeKind[];
export function parseChangelog(md: string): ChangelogRelease[];
export function plainText(item: string): string;
export function appNotes(md: string, options: { unreleased: boolean }): ChangelogRelease[];
export function cutRelease(md: string, version: string, date: string): string;
export function releaseSection(md: string, version: string): string;

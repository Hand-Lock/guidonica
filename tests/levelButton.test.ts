import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Header level button (ADR 0053)', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
  // Body only: the head's <link> tags would make happy-dom fetch assets
  const body = indexHtml.match(/<body[\s\S]*<\/body>/)?.[0] ?? '';
  const doc = new DOMParser().parseFromString(body.replace(/<script[\s\S]*?<\/script>/g, ''), 'text/html');

  it('sits in the utility bar before the settings toggle', () => {
    const buttons = [...doc.querySelectorAll('.utility-actions > button')].map((b) => b.id);
    expect(buttons).toContain('btn-level-toggle');
    expect(buttons.indexOf('btn-level-toggle')).toBeLessThan(buttons.indexOf('btn-drawer-toggle'));
  });

  it('opens the level dialog and carries a five-bar meter', () => {
    const btn = doc.getElementById('btn-level-toggle');
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn?.getAttribute('aria-controls')).toBe('modal-intro');
    expect(btn?.querySelectorAll('.lv-bar')).toHaveLength(5);
    expect(btn?.querySelector('.btn-label')).not.toBeNull();
    expect(doc.getElementById('modal-intro')).not.toBeNull();
    expect(doc.getElementById('intro-title-text')).not.toBeNull();
  });

  it('is the single entry point: the drawer level row is gone', () => {
    expect(doc.getElementById('btn-intro-open')).toBeNull();
  });
});

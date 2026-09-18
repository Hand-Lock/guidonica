import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Header Brand Badge', () => {
  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

  it('renders Guidonica brand title alongside SOLFÈGE capsule badge', () => {
    // Verify brand container exists
    expect(indexHtml).toContain('<div class="brand">');
    expect(indexHtml).toContain('<h1>Guidonica</h1>');

    // Verify brand-badge capsule contains SOLFÈGE with accented È (U+00C8)
    const badgeMatch = indexHtml.match(/<span class="brand-badge"([^>]*)>([\s\S]*?)<\/span>/);
    expect(badgeMatch).not.toBeNull();

    const badgeAttributes = badgeMatch![1];
    const badgeContent = badgeMatch![2].trim();

    expect(badgeContent).toBe('SOLFÈGE');
    expect(badgeContent).toContain('\u00C8'); // Latin Capital Letter E with Grave
    expect(badgeContent).not.toMatch(/MANUS/i);

    // Verify badge tooltip
    expect(badgeAttributes).toContain('title="Sight-Reading &amp; Solfège Engine"');
  });
});

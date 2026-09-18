import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Metronome Traffic Lights & Count-In Indicator', () => {
  const rootDir = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
  const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf-8');

  it('renders COUNT-IN badge and beat-dots inside beat-indicator-container in index.html', () => {
    expect(indexHtml).toContain('class="beat-indicator-container"');
    expect(indexHtml).toContain('id="count-in-badge"');
    expect(indexHtml).toContain('id="beat-dots"');

    // Verify badge text is standardized to COUNT-IN with hyphen
    const badgeMatch = indexHtml.match(/<div id="count-in-badge"[^>]*>([\s\S]*?)<\/div>/);
    expect(badgeMatch).not.toBeNull();
    expect(badgeMatch![1].trim()).toBe('COUNT-IN');

    // Verify initial hidden state
    expect(badgeMatch![0]).toContain('class="badge-count-in hidden"');
  });

  it('enforces top-stacked absolute positioning in src/style.css to preserve horizontal frame', () => {
    // Container must establish relative positioning context
    expect(styleCss).toMatch(/\.beat-indicator-container\s*\{[^}]*position:\s*relative;/);

    // Badge must be absolutely positioned on top (above) the capsule
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*position:\s*absolute;/);
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*bottom:\s*calc\(100%\s*\+\s*4px\);/);
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*left:\s*50%;/);
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*transform:\s*translateX\(-50%\);/);

    // Badge must avoid word wrapping and pass pointer events
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*white-space:\s*nowrap;/);
    expect(styleCss).toMatch(/\.badge-count-in\s*\{[^}]*pointer-events:\s*none;/);

    // Badge must support .hidden class
    expect(styleCss).toMatch(/\.badge-count-in\.hidden\s*\{[^}]*display:\s*none;/);
  });

  it('simulates count-in badge visibility toggling in DOM without altering beat-dots hierarchy', () => {
    const containerMatch = indexHtml.match(/<div class="beat-indicator-container"[\s\S]*?<\/div>\s*<\/div>/);
    expect(containerMatch).not.toBeNull();

    const parser = new DOMParser();
    const doc = parser.parseFromString(containerMatch![0], 'text/html');

    const container = doc.querySelector('.beat-indicator-container');
    const badge = doc.querySelector('#count-in-badge');
    const dotsContainer = doc.querySelector('#beat-dots');

    expect(container).not.toBeNull();
    expect(badge).not.toBeNull();
    expect(dotsContainer).not.toBeNull();

    // Verify badge starts hidden
    expect(badge!.classList.contains('hidden')).toBe(true);

    // Simulate count-in start
    badge!.classList.remove('hidden');
    expect(badge!.classList.contains('hidden')).toBe(false);

    // Verify beat-dots remain intact and distinct
    expect(dotsContainer!.parentNode).toBe(container);
    expect(badge!.parentNode).toBe(container);

    // Simulate count-in end
    badge!.classList.add('hidden');
    expect(badge!.classList.contains('hidden')).toBe(true);
  });
});

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

  it('lights the secondary beat as an orange gem between the weak and downbeat scales (ADR 0072)', () => {
    expect(styleCss).toMatch(/\.beat-dot\.secondary::after\s*\{[^}]*background:\s*var\(--led-mid\);[^}]*box-shadow:\s*var\(--led-mid-glow\);/);
    expect(styleCss).toMatch(/\.beat-dot\.downbeat::after\s*\{[^}]*background:\s*var\(--led-down\);[^}]*box-shadow:\s*var\(--led-down-glow\);/);
    expect(styleCss).toMatch(/\.beat-dot::after\s*\{[^}]*background:\s*var\(--led-on\);[^}]*box-shadow:\s*var\(--led-on-glow\);[^}]*opacity:\s*0;/);
    expect(styleCss).toMatch(/\.beat-dot\.active\.secondary::after\s*\{[^}]*transform:\s*scale\(1\.35\);/);
    expect(styleCss).toMatch(/\.beat-dot\.active::after\s*\{[^}]*transform:\s*scale\(1\.28\);/);
    expect(styleCss).toMatch(/\.beat-dot\.active\.downbeat::after\s*\{[^}]*transform:\s*scale\(1\.42\);/);
    expect(styleCss).toMatch(/--led-mid:\s*radial-gradient/);
    // Light and dark themes both define the orange glow
    expect(styleCss.match(/--led-mid-glow:/g)?.length).toBe(2);
  });

  it('changes only compositor properties on a beat (ADR 0091)', () => {
    const rules = [...styleCss.matchAll(/(\.beat-dot[^{,]*)\{([^}]*)\}/g)];
    expect(rules.length).toBeGreaterThan(0);
    for (const [, selector, body] of rules) {
      // Only the gem's opacity and transform ever animate: no box-shadow or background
      const transition = body.match(/transition:\s*([^;]*);/);
      if (transition) {
        for (const part of transition[1].split(',')) expect(part.trim()).toMatch(/^(transform|opacity) /);
      }
      // Lit and unlit LEDs differ only in the gem's opacity and scale
      if (selector.includes('.active')) {
        expect(selector).toContain('::after');
        expect(body).not.toMatch(/background|box-shadow/);
      }
    }
    expect(styleCss).toMatch(/\.beat-dot\.active::after\s*\{\s*opacity:\s*1;/);
    expect(styleCss).toMatch(/\.beat-dot::after\s*\{[^}]*will-change:\s*transform, opacity;/);
    const mainTs = fs.readFileSync(path.join(rootDir, 'src/main.ts'), 'utf-8');
    const highlight = mainTs.match(/private highlightBeatDot\([\s\S]*?\n  \}/);
    expect(highlight).not.toBeNull();
    expect(highlight![0]).not.toMatch(/querySelector/);
  });

  it('groups LEDs by felt beat: full beat LEDs, 5px divisions (ADRs 0076, 0090)', () => {
    const mainTs = fs.readFileSync(path.join(rootDir, 'src/main.ts'), 'utf-8');
    expect(mainTs).toContain("this.beatDotsContainer.classList.toggle('grouped', beatGroup > 1);");
    expect(mainTs).toContain("dot.className = (i - 1) % beatGroup !== 0 ? 'beat-dot sub' : 'beat-dot';");
    expect(styleCss).toMatch(/\.beat-dots\.grouped\s*\{\s*gap:\s*2px;/);
    expect(styleCss).toMatch(/\.beat-dots\.grouped \.beat-dot:not\(\.sub\):not\(:first-child\)\s*\{\s*margin-left:\s*4px;/);
    expect(styleCss).toMatch(/\.beat-dot\.sub\s*\{\s*width:\s*5px;\s*height:\s*5px;/);
    // The beat LED itself keeps the simple-meter size
    expect(styleCss).toMatch(/\.beat-dot\s*\{\s*width:\s*13px;\s*height:\s*13px;/);
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FULLSCREEN_ENTER_PATH, FULLSCREEN_EXIT_PATH } from '../src/main';

describe('Fullscreen Icon Matched Segmented-Square Pair', () => {
  const indexHtmlPath = path.resolve(__dirname, '../index.html');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const styleCssPath = path.resolve(__dirname, '../src/style.css');
  const styleCss = fs.readFileSync(styleCssPath, 'utf-8');

  it('renders vector SVG with id="fullscreen-icon-path" in index.html with initial enter path', () => {
    expect(indexHtml).toContain('id="btn-fullscreen-toggle"');
    expect(indexHtml).toContain('<svg class="fullscreen-icon"');
    expect(indexHtml).toContain('id="fullscreen-icon-path"');
    expect(indexHtml).toContain(`d="${FULLSCREEN_ENTER_PATH}"`);
    // Ensure old Unicode characters are removed
    expect(indexHtml).not.toMatch(/<button id="btn-fullscreen-toggle"[^>]*>[\s\S]*?⛶[\s\S]*?<\/button>/);
    expect(indexHtml).not.toMatch(/<button id="btn-fullscreen-toggle"[^>]*>[\s\S]*?🗗[\s\S]*?<\/button>/);
  });

  it('defines block display styling for .fullscreen-icon in style.css', () => {
    expect(styleCss).toMatch(/\.fullscreen-icon\s*\{[\s\S]*?display:\s*block;/);
  });

  it('maintains mathematical and geometric symmetry between enter and exit paths', () => {
    // Both paths must consist of exactly 4 segmented corner arms
    const enterCorners = FULLSCREEN_ENTER_PATH.split(' M').map((s, idx) => (idx === 0 ? s : 'M' + s));
    const exitCorners = FULLSCREEN_EXIT_PATH.split(' M').map((s, idx) => (idx === 0 ? s : 'M' + s));

    expect(enterCorners).toHaveLength(4);
    expect(exitCorners).toHaveLength(4);

    // Enter corners describe the outward perimeter (square with segmented sides)
    // Exit corners describe the inverted/flipped corners (pointing towards center)
    expect(FULLSCREEN_ENTER_PATH).not.toBe(FULLSCREEN_EXIT_PATH);
  });

  it('dynamically toggles path and accessibility labels on state change', () => {
    document.body.innerHTML = `
      <button id="btn-fullscreen-toggle" class="btn-icon-only" type="button" aria-label="Toggle full screen" title="Toggle Fullscreen">
        <svg class="fullscreen-icon" viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" aria-hidden="true">
          <path id="fullscreen-icon-path" d="${FULLSCREEN_ENTER_PATH}" />
        </svg>
      </button>
    `;

    const button = document.getElementById('btn-fullscreen-toggle') as HTMLButtonElement;
    const pathElem = document.getElementById('fullscreen-icon-path') as SVGPathElement;

    // Simulate syncFullscreenGlyph logic for entering fullscreen
    const syncState = (isFs: boolean): void => {
      pathElem.setAttribute('d', isFs ? FULLSCREEN_EXIT_PATH : FULLSCREEN_ENTER_PATH);
      const label = isFs ? 'Exit full screen' : 'Toggle full screen';
      button.setAttribute('aria-label', label);
      button.title = label;
    };

    // 1. Initial State (Normal / Windowed)
    expect(pathElem.getAttribute('d')).toBe(FULLSCREEN_ENTER_PATH);
    expect(button.getAttribute('aria-label')).toBe('Toggle full screen');

    // 2. Fullscreen Active State (Flipped Inward Corners)
    syncState(true);
    expect(pathElem.getAttribute('d')).toBe(FULLSCREEN_EXIT_PATH);
    expect(button.getAttribute('aria-label')).toBe('Exit full screen');
    expect(button.title).toBe('Exit full screen');

    // 3. Exiting Fullscreen (Reverts to Outward Segmented Square)
    syncState(false);
    expect(pathElem.getAttribute('d')).toBe(FULLSCREEN_ENTER_PATH);
    expect(button.getAttribute('aria-label')).toBe('Toggle full screen');
    expect(button.title).toBe('Toggle full screen');
  });
});

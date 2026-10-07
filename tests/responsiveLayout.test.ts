import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DOCKED_INSPECTOR_QUERY, OPEN_INSPECTOR_QUERY } from '../src/main';

const rootDir = path.resolve(__dirname, '..');
const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

/** The body of the first `@media <query> { … }` block at the top level of the stylesheet. */
function mediaBlock(query: string): string {
  const match = styleCss.match(new RegExp(`@media ${query.replace(/[()]/g, '\\$&')} \\{([\\s\\S]*?)\\n\\}`));
  expect(match, query).not.toBeNull();
  return match?.[1] ?? '';
}

describe('Stage-first shell (ADR 0097)', () => {
  it('orders the shell as bar, inspector, stage and dock, with no footer', () => {
    const order = ['<header class="app-bar">', '<aside id="controls-drawer"', '<main class="canvas-wrapper">', '<footer class="transport-dock">'];
    const at = order.map((tag) => indexHtml.indexOf(tag));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(indexHtml).not.toContain('shortcuts-hint');
    expect(indexHtml).not.toContain('btn-footer-about');
  });

  it('puts the transport in the dock and the meta actions in the ⋯ menu', () => {
    const dock = indexHtml.slice(indexHtml.indexOf('<footer class="transport-dock">'), indexHtml.indexOf('</footer>'));
    for (const id of ['btn-reset', 'btn-play-pause', 'tempo-number', 'tempo-slider', 'beat-dots', 'btn-volume-mute']) {
      expect(dock, id).toContain(`id="${id}"`);
    }
    const menu = indexHtml.slice(indexHtml.indexOf('<div id="app-menu"'), indexHtml.indexOf('</header>'));
    for (const id of ['btn-share-exercise', 'btn-about-toggle', 'btn-menu-whats-new', 'btn-shortcuts', 'btn-theme-toggle']) {
      expect(menu, id).toContain(`id="${id}"`);
    }
    expect(menu).toContain('href="https://ko-fi.com/guidonica"');
  });

  it('lays #app out as a grid of bar, stage and dock', () => {
    expect(styleCss).toMatch(/#app \{[^}]*display: grid;[^}]*grid-template-areas:\s*'bar'\s*'stage'\s*'dock';/);
    expect(styleCss).toMatch(/\.canvas-wrapper \{\s*grid-area: stage;/);
  });

  it('docks the inspector as a column that only opens wide', () => {
    expect(DOCKED_INSPECTOR_QUERY).toBe('(min-width: 1024px) and (min-height: 501px)');
    expect(OPEN_INSPECTOR_QUERY).toBe('(min-width: 1280px) and (min-height: 501px)');
    const wide = mediaBlock(DOCKED_INSPECTOR_QUERY);
    expect(wide).toMatch(/'bar insp'\s*'stage insp'\s*'dock insp'/);
    expect(wide).toMatch(/#app \{[^}]*grid-template-columns: minmax\(0, 1fr\) 0;/);
    expect(wide).toMatch(/#app\.inspector-open \{\s*grid-template-columns: minmax\(0, 1fr\) min\(380px, 32vw\);/);
  });

  it('overlays the stage with a sheet elsewhere, never with a fixed offset', () => {
    const compact = mediaBlock('(max-width: 1023px), (max-height: 500px)');
    expect(compact).toMatch(/\.inspector \{[^}]*grid-area: stage;[^}]*max-height: 100%;/);
    expect(styleCss).not.toMatch(/100d?vh - 100%/);
    expect(styleCss).not.toMatch(/100d?vh - 1[17]0px/);
  });

  it('merges bar and dock into one bottom row on short landscape screens', () => {
    const short = mediaBlock('(max-height: 500px)');
    expect(short).toMatch(/'stage stage'\s*'dock bar'/);
    // An auto track sized from content cannot hold a size container
    expect(short).toMatch(/\.app-bar \{\s*container-type: normal;/);
    expect(short).toMatch(/\.app-menu \{\s*top: auto;\s*bottom: calc\(100% \+ 8px\);/);
  });

  it('wraps the phone dock to a thumb row and a full-width tempo row', () => {
    const phone = mediaBlock('(max-width: 600px)');
    expect(phone).toMatch(/'transport beats mute'\s*'tempo tempo tempo'/);
  });

  it('collapses the phone brand and transport by container width', () => {
    expect(styleCss).toMatch(/\.brand\s*\{\s*container:\s*brand \/ inline-size;/);
    expect(styleCss).toMatch(/\.playback-controls\s*\{\s*container:\s*transport \/ inline-size;/);
    expect(styleCss).toContain('@container brand (max-width: 182px)');
    expect(styleCss).toContain('@container brand (max-width: 117px)');
    expect(styleCss).toContain('@container transport (max-width: 147px)');
  });

  it('replaces the fixed 380px badge breakpoint', () => {
    expect(styleCss).not.toContain('@media (max-width: 380px)');
  });
});

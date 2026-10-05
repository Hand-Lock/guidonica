import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MEASURE_CANVAS_HEIGHT, stageFitsStaff } from '../src/notation/types';

describe('Responsive header fit (ADR 0054)', () => {
  const rootDir = path.resolve(__dirname, '..');
  const styleCss = fs.readFileSync(path.join(rootDir, 'src/style.css'), 'utf-8');

  it('sizes the overlay sheet from the header height, not a fixed offset', () => {
    expect(styleCss).toMatch(/max-height:\s*calc\(100dvh - 100%\);/);
    expect(styleCss).toMatch(/max-height:\s*calc\(100vh - 100%\);/);
    expect(styleCss).not.toMatch(/100d?vh - 110px/);
    expect(styleCss).not.toMatch(/100d?vh - 170px/);
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

  it('compacts the one-row ribbon between 961 and 1150px', () => {
    const block = styleCss.match(/@media \(min-width: 961px\) and \(max-width: 1150px\) \{([\s\S]*?)\n\}/);
    expect(block).not.toBeNull();
    expect(block?.[1]).toContain('minmax(160px, 380px)');
    expect(block?.[1]).toMatch(/\.btn-drawer-toggle \.btn-label/);
    expect(block?.[1]).toMatch(/\.beat-indicator-container \{\s*padding: 0 6px;/);
  });

  it('lets the tablet utilities span the empty cell above tempo', () => {
    expect(styleCss).toContain("'brand utils utils'");
    expect(styleCss).not.toContain("'brand . utils'");
  });
});

describe('stageFitsStaff', () => {
  it('accepts a stage exactly one measure canvas tall', () => {
    expect(stageFitsStaff(MEASURE_CANVAS_HEIGHT, 1)).toBe(true);
    expect(stageFitsStaff(MEASURE_CANVAS_HEIGHT - 1, 1)).toBe(false);
  });

  it('scales the requirement with zoom', () => {
    expect(stageFitsStaff(110, 0.5)).toBe(true);
    expect(stageFitsStaff(109, 0.5)).toBe(false);
    expect(stageFitsStaff(330, 1.5)).toBe(true);
    expect(stageFitsStaff(329, 1.5)).toBe(false);
  });
});

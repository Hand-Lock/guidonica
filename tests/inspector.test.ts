import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { bindTabs, selectTab } from '../src/utils/tabs';
import { exerciseSummary } from '../src/summary';
import { FEATURE_TIPS } from '../src/tips';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import en from '../src/i18n/locales/en';
import it_ from '../src/i18n/locales/it';
import de from '../src/i18n/locales/de';

const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
// Body only: the head's <link> tags would make happy-dom fetch assets
const body = (indexHtml.match(/<body[\s\S]*<\/body>/)?.[0] ?? '').replace(/<script[\s\S]*?<\/script>/g, '');

const TABS = ['staff', 'rhythm', 'melody', 'sound', 'display'];

describe('Settings inspector tabs (ADR 0097)', () => {
  beforeEach(() => {
    document.body.innerHTML = new DOMParser().parseFromString(body, 'text/html').body.innerHTML;
  });

  const tabs = (): HTMLButtonElement[] => Array.from(document.querySelectorAll<HTMLButtonElement>('.inspector-tabs [role="tab"]'));

  it('has five tabs, each controlling its panel, Staff shown first', () => {
    expect(tabs().map((t) => t.dataset.tab)).toEqual(TABS);
    for (const tab of tabs()) {
      const panel = document.getElementById(tab.getAttribute('aria-controls') ?? '');
      expect(panel?.getAttribute('role'), tab.id).toBe('tabpanel');
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
      expect(panel?.hidden).toBe(tab.dataset.tab !== 'staff');
      expect(tab.getAttribute('aria-selected')).toBe(String(tab.dataset.tab === 'staff'));
    }
  });

  it('puts each control in its tab and drops the Practice section', () => {
    const inPanel: Record<string, string[]> = {
      staff: ['select-clef', 'select-ledger-above', 'select-time-signature', 'toggle-half-note-beat', 'toggle-meter-signs', 'select-pulse'],
      rhythm: ['btn-tuplets-toggle', 'tuplets-popover'],
      melody: [],
      sound: ['toggle-count-in', 'select-sound-profile', 'volume-slider', 'select-drone-note', 'select-drone-sound', 'select-drone-tuning', 'drone-volume-slider'],
      display: ['select-language', 'select-solfege-mode', 'toggle-playhead', 'toggle-tips', 'select-theme'],
    };
    for (const [tab, ids] of Object.entries(inPanel)) {
      for (const id of ids) expect(document.getElementById(id)?.closest('[role="tabpanel"]')?.id, id).toBe(`panel-${tab}`);
    }
    expect(document.querySelector('.section-practice')).toBeNull();
    expect(indexHtml).not.toContain('sectionPractice');
  });

  it('selects by click and arrow keys with one tab stop', () => {
    const list = document.querySelector<HTMLElement>('.inspector-tabs');
    expect(list).not.toBeNull();
    if (!list) return;
    const seen: string[] = [];
    const select = bindTabs(list, (id) => seen.push(id));
    tabs()[3].click();
    expect(document.getElementById('panel-sound')?.hidden).toBe(false);
    expect(document.getElementById('panel-staff')?.hidden).toBe(true);
    expect(tabs().map((t) => t.tabIndex)).toEqual([-1, -1, -1, 0, -1]);
    tabs()[3].focus();
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs()[4].getAttribute('aria-selected')).toBe('true');
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(select('melody')).toBe(true);
    expect(select('practice')).toBe(false);
    expect(seen).toEqual(['sound', 'display', 'staff', 'melody']);
    expect(selectTab(tabs(), 'rhythm')).toBe(true);
    expect(document.getElementById('panel-rhythm')?.hidden).toBe(false);
  });

  it('points every settings tip at an existing tab', () => {
    for (const tip of FEATURE_TIPS) {
      if (tip.action?.kind === 'settings') expect(TABS, tip.id).toContain(tip.action.section);
    }
    expect(FEATURE_TIPS.find((t) => t.id === 'share')?.action).toEqual({ kind: 'share' });
  });
});

describe('Exercise summary chips (ADR 0097)', () => {
  const settings = structuredClone(DEFAULT_APP_SETTINGS);

  it('names the clef and meter, and the drone only while it sounds', () => {
    const off = { ...settings, clef: 'bass' as const, timeSignature: '3/4' as const, droneNote: 'off' as const };
    expect(exerciseSummary(off, en)).toEqual([
      { text: 'Bass (F)', tab: 'staff' },
      { text: '3/4', tab: 'staff' },
    ]);
    const on = { ...off, droneNote: 'd' as const };
    expect(exerciseSummary(on, en)[2]).toEqual({ text: 'Drone D', tab: 'sound' });
  });

  it('writes C and ¢ when the meter signs are on', () => {
    const common = { ...settings, timeSignature: '4/4' as const, meterSigns: true };
    expect(exerciseSummary(common, en)[1].text).toBe('C');
    expect(exerciseSummary({ ...common, timeSignature: '2/2' }, en)[1].text).toBe('¢');
    expect(exerciseSummary({ ...common, meterSigns: false }, en)[1].text).toBe('4/4');
  });

  it('follows the language and its note names', () => {
    const on = { ...settings, clef: 'treble' as const, droneNote: 'b' as const, solfegeLabelMode: 'none' as const };
    expect(exerciseSummary(on, it_).map((c) => c.text)).toEqual([it_.clefTreble, exerciseSummary(on, it_)[1].text, 'Bordone Si']);
    expect(exerciseSummary(on, de)[2].text).toBe('Bordun H');
  });
});

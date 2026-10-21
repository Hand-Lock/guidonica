import { describe, it, expect } from 'vitest';
import { COMMUNITY_EVERY, COMMUNITY_TIPS, FEATURE_TIPS, TipContext, TipId, pickTip } from '../src/tips';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { AppSettings } from '../src/notation/types';
import en from '../src/i18n/locales/en';

/** A context in which every feature tip is eligible. */
function openContext(): TipContext {
  const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), timeSignature: '6/8' };
  return { settings, touch: true, keyboard: true, standalone: false };
}

const ids = (from: number, to: number, ctx: TipContext): TipId[] => {
  const out: TipId[] = [];
  for (let n = from; n < to; n++) out.push(pickTip(n, ctx).id);
  return out;
};

describe('rotating tips (ADR 0087)', () => {
  it('makes every fourth tip a community tip, alternating follow and support', () => {
    const ctx = openContext();
    expect(COMMUNITY_EVERY).toBe(4);
    expect(ids(0, 12, ctx).map((id, n) => ((n + 1) % 4 === 0 ? id : 'feature'))).toEqual([
      'feature', 'feature', 'feature', 'follow',
      'feature', 'feature', 'feature', 'support',
      'feature', 'feature', 'feature', 'follow',
    ]);
    const community = new Set<TipId>(COMMUNITY_TIPS.map((t) => t.id));
    for (let n = 0; n < 40; n++) {
      expect(community.has(pickTip(n, ctx).id), String(n)).toBe((n + 1) % 4 === 0);
    }
  });

  it('shows every feature tip once per cycle, in order, when all are eligible', () => {
    const ctx = openContext();
    const features = ids(0, 40, ctx).filter((_, n) => (n + 1) % 4 !== 0);
    // The view tips split by device: swiping on touch screens, V on keyboards alone; Labels
    // after playing waits until labels are on (ADR 0112)
    const cycle = FEATURE_TIPS.map((t) => t.id).filter((id) => id !== 'viewsKey' && id !== 'labelsAfter');
    expect(features.slice(0, cycle.length)).toEqual(cycle);
    expect(features.slice(cycle.length, cycle.length * 2)).toEqual(cycle.slice(0, features.length - cycle.length));
  });

  it('skips tips that would tell the user nothing new', () => {
    const ctx = openContext();
    ctx.settings.solfegeLabelMode = 'syllables';
    ctx.settings.timeSignature = '4/4';
    ctx.settings.showPlayhead = false;
    ctx.settings.droneNote = 'd';
    ctx.settings.rests = true;
    ctx.settings.ties = true;
    ctx.settings.pitchClasses.f = false;
    ctx.settings.tuplets.triplet['1/8'] = true;
    ctx.keyboard = false;
    ctx.standalone = true;
    const seen = new Set(ids(0, 60, ctx));
    for (const id of ['labels', 'pulse', 'playhead', 'drone', 'restsTies', 'notes', 'tuplets', 'keys', 'install'] as TipId[]) {
      expect(seen.has(id), id).toBe(false);
    }
    for (const id of ['levels', 'halfNote', 'clefs', 'pinch', 'share', 'whatsNew', 'follow', 'support'] as TipId[]) {
      expect(seen.has(id), id).toBe(true);
    }
  });

  it('offers Labels after playing once labels are on, until it is on (ADR 0112)', () => {
    const tip = FEATURE_TIPS.find((t) => t.id === 'labelsAfter');
    const ctx = openContext();
    expect(tip?.when?.(ctx)).toBe(false);
    ctx.settings.solfegeLabelMode = 'letters';
    expect(tip?.when?.(ctx)).toBe(true);
    expect(new Set(ids(0, 60, ctx)).has('labelsAfter')).toBe(true);
    ctx.settings.labelsAfterPlaying = true;
    expect(tip?.when?.(ctx)).toBe(false);
    expect(tip?.action).toEqual({ kind: 'settings', section: 'display' });
  });

  it('never repeats a feature tip on consecutive feature slots', () => {
    const ctx = openContext();
    ctx.settings.timeSignature = '4/4'; // pulse ineligible
    ctx.touch = false; // pinch ineligible
    const features = ids(0, 80, ctx).filter((_, n) => (n + 1) % 4 !== 0);
    for (let i = 1; i < features.length; i++) expect(features[i], String(i)).not.toBe(features[i - 1]);
  });

  it('follows touch and keyboard: pinch on touch screens, shortcuts with a mouse', () => {
    const touchOnly = { ...openContext(), keyboard: false };
    const mouseOnly = { ...openContext(), touch: false };
    expect(new Set(ids(0, 40, touchOnly)).has('keys')).toBe(false);
    expect(new Set(ids(0, 40, touchOnly)).has('pinch')).toBe(true);
    expect(new Set(ids(0, 40, mouseOnly)).has('pinch')).toBe(false);
    expect(new Set(ids(0, 40, mouseOnly)).has('keys')).toBe(true);
  });

  it('falls back to a community tip when no feature tip is eligible', () => {
    const ctx = openContext();
    const none = FEATURE_TIPS.map((tip) => ({ ...tip, when: () => false }));
    for (let n = 0; n < 12; n++) {
      expect(['follow', 'support']).toContain(pickTip(n, ctx, none).id);
    }
  });

  it('treats invalid counts as the first tip', () => {
    const ctx = openContext();
    expect(pickTip(-3, ctx).id).toBe(FEATURE_TIPS[0].id);
    expect(pickTip(Number.NaN, ctx).id).toBe(FEATURE_TIPS[0].id);
  });

  it('teaches the swipe on touch screens and V on keyboards, until the view changed (ADR 0109)', () => {
    const tip = (id: TipId) => FEATURE_TIPS.find((t) => t.id === id);
    const ctx = openContext();
    expect(tip('views')?.when?.(ctx)).toBe(true);
    expect(tip('viewsKey')?.when?.(ctx)).toBe(false);
    ctx.touch = false;
    expect(tip('views')?.when?.(ctx)).toBe(false);
    expect(tip('viewsKey')?.when?.(ctx)).toBe(true);
    ctx.settings.view = 'squishy';
    expect(tip('viewsKey')?.when?.(ctx)).toBe(false);
    expect(tip('views')?.action).toEqual({ kind: 'settings', section: 'display' });
    // Both view tips name the page view (ADR 0110)
    expect(en.tips.views.body).toMatch(/Page/);
    expect(en.tips.viewsKey.body).toMatch(/Page/);
  });
});

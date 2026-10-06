// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Rotating tips (ADR 0087)
// Copyright (C) 2026 A. C. Lo Cascio

import { AppSettings, TUPLET_NAMES, TUPLET_VALUES, isCompound } from './notation/types';

export type SettingsSection = 'staff' | 'rhythm' | 'melody' | 'practice';

export type TipId =
  | 'levels'
  | 'labels'
  | 'keys'
  | 'pinch'
  | 'clefs'
  | 'notes'
  | 'tuplets'
  | 'restsTies'
  | 'pulse'
  | 'playhead'
  | 'share'
  | 'install'
  | 'whatsNew'
  | 'follow'
  | 'support';

export type TipAction =
  | { kind: 'settings'; section: SettingsSection }
  | { kind: 'levels' }
  | { kind: 'whatsNew' }
  | { kind: 'kofi' }
  | { kind: 'social' };

/** What a tip may depend on: the user's settings and the device, never usage history. */
export interface TipContext {
  settings: AppSettings;
  touch: boolean; // coarse pointer: pinch zoom exists
  keyboard: boolean; // fine pointer with hover: shortcuts are usable
  standalone: boolean; // installed (home screen or app window)
}

export interface Tip {
  id: TipId;
  action?: TipAction;
  /** Shown only when this holds; absent means always eligible. */
  when?: (ctx: TipContext) => boolean;
}

const anyTuplet = (s: AppSettings): boolean =>
  TUPLET_NAMES.some((name) => TUPLET_VALUES.some((value) => s.tuplets[name][value]));

/** Feature tips in rotation order. A tip is skipped while it would tell the user nothing new. */
export const FEATURE_TIPS: readonly Tip[] = [
  { id: 'levels', action: { kind: 'levels' } },
  {
    id: 'labels',
    action: { kind: 'settings', section: 'practice' },
    when: (c) => c.settings.solfegeLabelMode === 'none',
  },
  { id: 'keys', when: (c) => c.keyboard },
  { id: 'clefs', action: { kind: 'settings', section: 'staff' } },
  {
    id: 'notes',
    action: { kind: 'settings', section: 'melody' },
    when: (c) => Object.values(c.settings.pitchClasses).every(Boolean),
  },
  { id: 'pinch', when: (c) => c.touch },
  {
    id: 'tuplets',
    action: { kind: 'settings', section: 'rhythm' },
    when: (c) => !anyTuplet(c.settings),
  },
  { id: 'share', action: { kind: 'settings', section: 'practice' } },
  {
    id: 'restsTies',
    action: { kind: 'settings', section: 'rhythm' },
    when: (c) => !c.settings.rests || !c.settings.ties,
  },
  {
    id: 'pulse',
    action: { kind: 'settings', section: 'staff' },
    when: (c) => isCompound(c.settings.timeSignature),
  },
  { id: 'install', when: (c) => !c.standalone },
  {
    id: 'playhead',
    action: { kind: 'settings', section: 'practice' },
    when: (c) => c.settings.showPlayhead,
  },
  { id: 'whatsNew', action: { kind: 'whatsNew' } },
];

/** Follow and support, which alternate in every COMMUNITY_EVERY-th slot. */
export const COMMUNITY_TIPS: readonly Tip[] = [
  { id: 'follow', action: { kind: 'social' } },
  { id: 'support', action: { kind: 'kofi' } },
];

export const COMMUNITY_EVERY = 4;

/**
 * The tip for the `count`-th shown tip (0-based). Slots 3, 7, 11… are community slots,
 * alternating follow and support; the rest advance a cursor over the eligible feature
 * tips, so each one shows once per cycle and none repeats while eligibility holds.
 */
export function pickTip(count: number, ctx: TipContext, features: readonly Tip[] = FEATURE_TIPS): Tip {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if ((n + 1) % COMMUNITY_EVERY === 0) {
    return COMMUNITY_TIPS[Math.floor(n / COMMUNITY_EVERY) % COMMUNITY_TIPS.length];
  }
  const cursor = n - Math.floor((n + 1) / COMMUNITY_EVERY);
  const eligible = features.filter((tip) => !tip.when || tip.when(ctx));
  if (eligible.length === 0) return COMMUNITY_TIPS[cursor % COMMUNITY_TIPS.length];
  return eligible[cursor % eligible.length];
}

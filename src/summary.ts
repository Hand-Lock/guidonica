// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Exercise summary chips in the top bar (ADR 0097)
// Copyright (C) 2026 A. C. Lo Cascio

import { AppSettings, Clef, PITCH_CLASSES, timeSignatureSpec } from './notation/types';
import type { Messages } from './i18n/locales/en';
import { pitchClassNames } from './i18n';
import type { SettingsSection } from './tips';

export interface SummaryChip {
  text: string;
  /** The inspector tab that changes it. */
  tab: SettingsSection;
}

const CLEF_KEYS: Record<Clef, keyof Messages> = {
  treble: 'clefTreble',
  soprano: 'clefSoprano',
  'mezzo-soprano': 'clefMezzoSoprano',
  alto: 'clefAlto',
  tenor: 'clefTenor',
  'baritone-f': 'clefBaritoneF',
  'baritone-c': 'clefBaritoneC',
  bass: 'clefBass',
};

/** Clef, meter as written (C and ¢ when the signs are on) and the drone note when it sounds. */
export function exerciseSummary(settings: Readonly<AppSettings>, m: Messages): SummaryChip[] {
  const meter = timeSignatureSpec(settings.timeSignature, settings.meterSigns).replace('C|', '¢');
  const chips: SummaryChip[] = [
    { text: String(m[CLEF_KEYS[settings.clef]]), tab: 'staff' },
    { text: meter, tab: 'staff' },
  ];
  if (settings.droneNote !== 'off') {
    const names = pitchClassNames(settings.solfegeLabelMode, m);
    chips.push({ text: m.summaryDrone(names[PITCH_CLASSES.indexOf(settings.droneNote)]), tab: 'sound' });
  }
  return chips;
}

import { describe, it, expect } from 'vitest';
import { MusicGenerator } from '../src/notation/generator';
import { AppSettings, TUPLET_NAMES, TUPLET_VALUES, computeBeatWidth } from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  INTRO_CLEFS,
  LEVEL_PRESETS,
  LevelId,
  buildPresetSettings,
  buildPreviewSettings,
  matchLevel,
} from '../src/presets';

const BARS = 300;

function full(patch: Partial<AppSettings>): AppSettings {
  return { ...structuredClone(DEFAULT_APP_SETTINGS), ...patch };
}

/** Every boolean true in `preview` is true in `preset`; every other leaf is equal. */
function expectSubset(preview: unknown, preset: unknown, path: string): void {
  if (typeof preview === 'boolean') {
    if (preview) expect(preset, path).toBe(true);
    return;
  }
  if (typeof preview === 'object' && preview !== null) {
    expect(typeof preset, path).toBe('object');
    const a = preview as Record<string, unknown>;
    const b = preset as Record<string, unknown>;
    expect(Object.keys(a).sort(), path).toEqual(Object.keys(b).sort());
    for (const key of Object.keys(a)) expectSubset(a[key], b[key], `${path}.${key}`);
    return;
  }
  expect(preview, path).toEqual(preset);
}

function generateBars(settings: AppSettings): string[] {
  const generator = new MusicGenerator();
  const durations: string[] = [];
  let startBeat = 0;
  for (let m = 0; m < BARS; m++) {
    const measure = generator.generateMeasure(m, settings, startBeat);
    startBeat += measure.beatsPerMeasure;
    for (const note of measure.notes) {
      if (!note.isTuplet) durations.push(note.duration.replace(/r$/, ''));
    }
  }
  return durations;
}

describe('intro preview representations (ADR 0051)', () => {
  for (const preset of LEVEL_PRESETS) {
    for (const clef of INTRO_CLEFS) {
      it(`${preset.id} / ${clef}: preview Ω ⊆ preset Ω with the same spacing`, () => {
        const previewPatch = buildPreviewSettings(preset.id, clef);
        const presetPatch = buildPresetSettings(preset.id, clef);
        expectSubset(previewPatch, presetPatch, preset.id);

        const preview = full(previewPatch);
        const real = full(presetPatch);
        expect(computeBeatWidth(preview.subdivisions, preview.timeSignature, preview.tuplets)).toBe(
          computeBeatWidth(real.subdivisions, real.timeSignature, real.tuplets)
        );

        const { dotted: _dotted, ...values } = preview.subdivisions;
        const anyTuplet = TUPLET_NAMES.some((n) => TUPLET_VALUES.some((v) => preview.tuplets[n][v]));
        expect(Object.values(values).some(Boolean) || anyTuplet).toBe(true);
        expect(Object.values(preview.intervals).some(Boolean)).toBe(true);
      });
    }

    it(`${preset.id}: applying the level still loads the full preset`, () => {
      expect(matchLevel(full(buildPresetSettings(preset.id, 'treble')))).toBe(preset.id);
      expect(matchLevel(full(buildPreviewSettings(preset.id, 'treble')))).toBeNull();
    });
  }

  const FORBIDDEN: Record<LevelId, readonly string[]> = {
    beginner: ['w'],
    elementary: ['w', 'h', 'hd'],
    intermediate: ['w', 'h', 'hd'],
    advanced: ['w', 'h', 'hd'],
    virtuoso: ['w', 'h', 'hd', 'q'],
  };

  for (const preset of LEVEL_PRESETS) {
    it(`${preset.id}: ${BARS} preview bars never use an omitted value`, () => {
      const settings = full(buildPreviewSettings(preset.id, 'treble'));
      const durations = new Set(generateBars(settings));
      for (const duration of FORBIDDEN[preset.id]) {
        expect(durations.has(duration), `${preset.id} produced ${duration}`).toBe(false);
      }
    });
  }

  it('virtuoso preview never draws a quarter-note tuplet', () => {
    const settings = full(buildPreviewSettings('virtuoso', 'treble'));
    const generator = new MusicGenerator();
    let startBeat = 0;
    for (let m = 0; m < BARS; m++) {
      const measure = generator.generateMeasure(m, settings, startBeat);
      startBeat += measure.beatsPerMeasure;
      for (const note of measure.notes) {
        if (note.isTuplet) expect(note.duration.replace(/r$/, '')).not.toBe('q');
      }
    }
  });
});

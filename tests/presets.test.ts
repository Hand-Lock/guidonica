import { describe, it, expect } from 'vitest';
import { MusicGenerator } from '../src/notation/generator';
import {
  AppSettings,
  MeasureData,
  TUPLET_NAMES,
  TUPLET_VALUES,
  computeBeatWidth,
} from '../src/notation/types';
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

function generateMeasures(settings: AppSettings): MeasureData[] {
  const generator = new MusicGenerator();
  const measures: MeasureData[] = [];
  let startBeat = 0;
  for (let m = 0; m < BARS; m++) {
    const measure = generator.generateMeasure(m, settings, startBeat);
    startBeat += measure.beatsPerMeasure;
    measures.push(measure);
  }
  return measures;
}

function generateBars(settings: AppSettings): string[] {
  return generateMeasures(settings).flatMap((measure) =>
    measure.notes.filter((note) => !note.isTuplet).map((note) => note.duration.replace(/r$/, ''))
  );
}

const LETTERS = 'cdefgab';

/** Diatonic step index of a VexFlow key such as `c/4`. */
function diatonicStep(key: string): number {
  const [letter, octave] = key.split('/');
  return Number(octave) * 7 + LETTERS.indexOf(letter);
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
    intermediate: ['w', 'h', 'hd', 'q', 'qd'],
    advanced: ['w', 'h', 'hd', 'q', 'qd'],
    virtuoso: ['w', 'h', 'hd', 'q', 'qd', '8', '8d'],
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

  for (const preset of LEVEL_PRESETS) {
    const keepsRests = preset.id === 'elementary';
    it(`${preset.id}: ${BARS} preview bars ${keepsRests ? 'include' : 'never include'} rests`, () => {
      const settings = full(buildPreviewSettings(preset.id, 'treble'));
      const rests = generateMeasures(settings).flatMap((m) => m.notes).filter((n) => n.isRest);
      if (keepsRests) expect(rests.length).toBeGreaterThan(0);
      else expect(rests.length).toBe(0);
    });
  }

  // Kept diatonic distances per level, in steps (2nd = 1 … 8ve = 7, 9th+ = 8 and up)
  const BAND: Record<LevelId, readonly [number, number]> = {
    beginner: [1, 2],
    elementary: [2, 3],
    intermediate: [3, 4],
    advanced: [5, 7],
    virtuoso: [7, Infinity],
  };

  for (const preset of LEVEL_PRESETS) {
    const [min, max] = BAND[preset.id];
    it(`${preset.id}: ${BARS} preview bars only move by the kept intervals`, () => {
      const settings = full(buildPreviewSettings(preset.id, 'treble'));
      const sounding = generateMeasures(settings).flatMap((m) => m.notes).filter((n) => !n.isRest);
      for (let i = 1; i < sounding.length; i++) {
        if (sounding[i].tieEnd) continue;
        const distance = Math.abs(
          diatonicStep(sounding[i].keys[0]) - diatonicStep(sounding[i - 1].keys[0])
        );
        expect(distance, `${preset.id} note ${i}`).toBeGreaterThanOrEqual(min);
        expect(distance, `${preset.id} note ${i}`).toBeLessThanOrEqual(max);
      }
    });
  }
});

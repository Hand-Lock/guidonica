import { describe, it, expect } from 'vitest';
import { MusicGenerator } from '../src/notation/generator';
import {
  AppSettings,
  MeasureData,
  NoteData,
  TUPLET_NAMES,
  TUPLET_VALUES,
  computeBeatWidth,
} from '../src/notation/types';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import {
  INTRO_CLEFS,
  LEVEL_PRESETS,
  LevelId,
  PreviewWindow,
  acceptsPreview,
  buildPresetSettings,
  buildPreviewSettings,
  levelIndex,
  matchLevel,
  previewWindow,
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

function generateMeasures(settings: AppSettings, bars = BARS): MeasureData[] {
  const generator = new MusicGenerator();
  const measures: MeasureData[] = [];
  let startBeat = 0;
  for (let m = 0; m < bars; m++) {
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

  // Sparse tuplet cells dropped from the cards (ADR 0052)
  const FORBIDDEN_TUPLETS: Partial<Record<LevelId, readonly string[]>> = {
    advanced: ['q'],
    virtuoso: ['q', '8'],
  };

  for (const [level, forbidden] of Object.entries(FORBIDDEN_TUPLETS) as [LevelId, readonly string[]][]) {
    it(`${level} preview never draws a ${forbidden.join(' or ')} tuplet`, () => {
      const settings = full(buildPreviewSettings(level, 'treble'));
      const tuplets = generateMeasures(settings).flatMap((m) => m.notes).filter((n) => n.isTuplet);
      expect(tuplets.length).toBeGreaterThan(0);
      for (const note of tuplets) expect(forbidden).not.toContain(note.duration.replace(/r$/, ''));
    });
  }

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

/** A window of hand-written notes laid end to end from beat 0. */
function windowOf(spec: string, length: number): PreviewWindow {
  const BEATS: Record<string, number> = { h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25, '32': 0.125 };
  const notes: NoteData[] = [];
  const beats: number[] = [];
  let beat = 0;
  for (const token of spec.split(' ')) {
    // `3x8` is one note of an eighth triplet; a trailing `r` marks a rest
    const tuplet = token.match(/^(\d)x(.+)$/);
    const duration = tuplet ? tuplet[2] : token;
    const value = duration.replace(/r$/, '');
    const beatDuration = tuplet ? (BEATS[value] * 2) / Number(tuplet[1]) : BEATS[value];
    notes.push({
      keys: ['c/5'],
      duration,
      isRest: duration.endsWith('r'),
      isTuplet: tuplet !== null,
      beatOffset: beat,
      beatDuration,
    });
    beats.push(beat);
    beat += beatDuration;
  }
  return { notes, beats, length };
}

describe('intro preview signature check (ADR 0052)', () => {
  const CASES: Record<LevelId, { accept: readonly string[]; reject: readonly string[] }> = {
    beginner: { accept: ['q h q'], reject: ['q q q q'] },
    elementary: {
      accept: ['qd 8 q', '8 q 8 q', 'qd 8 qr'],
      reject: ['q q 8 8', 'qr qd 8r', '8 8 q q'],
    },
    intermediate: { accept: ['8 8 3x8 3x8 3x8'], reject: ['8 8 8 8'] },
    advanced: { accept: ['16 16 16 16 8d 16'], reject: ['8 8 8 8', '16 16 16 16 3x8 3x8 3x8'] },
    virtuoso: {
      accept: ['32 32 16 16 16 3x16 3x16 3x16 3x16 3x16 3x16'],
      reject: ['16 16 16 16 16 16 16 16', '32 32 16 16 16 16 16 16 16'],
    },
  };

  for (const preset of LEVEL_PRESETS) {
    const { accept, reject } = CASES[preset.id];
    it(`${preset.id}: accepts its signature and rejects plain windows`, () => {
      for (const spec of accept) expect(acceptsPreview(preset.id, windowOf(spec, 2)), spec).toBe(true);
      for (const spec of reject) expect(acceptsPreview(preset.id, windowOf(spec, 2)), spec).toBe(false);
    });
  }

  it('previewWindow keeps only the notes starting before the visible beat', () => {
    const settings = full(buildPreviewSettings('beginner', 'treble'));
    const measures = generateMeasures(settings, 3);
    const window = previewWindow(measures, 5.5);
    expect(window.length).toBe(5.5);
    expect(window.notes.length).toBe(window.beats.length);
    expect(window.beats.every((beat) => beat < 5.5)).toBe(true);
    const all = measures.flatMap((m) => m.notes.map((n) => m.startBeat + n.beatOffset));
    expect(window.beats).toEqual(all.filter((beat) => beat < 5.5));
  });

  // 32 attempts all failing has probability (1 − rate)^32 < 1e-4 when rate ≥ 25%.
  // Cards of 229–510 px show ≈ 1–4 beats; only the 220/360 px beats get down to one.
  const WINDOWS = 300;
  const LENGTHS: Record<LevelId, readonly number[]> = {
    beginner: [1.3, 2, 4],
    elementary: [1.3, 2, 4],
    intermediate: [1.3, 2, 4],
    advanced: [1, 1.3, 2, 4],
    virtuoso: [1, 1.3, 2, 4],
  };
  for (const preset of LEVEL_PRESETS) {
    for (const length of LENGTHS[preset.id]) {
      it(`${preset.id}: ≥ 25% of ${length}-beat windows pass`, () => {
        const settings = full(buildPreviewSettings(preset.id, 'treble'));
        let accepted = 0;
        for (let i = 0; i < WINDOWS; i++) {
          const window = previewWindow(generateMeasures(settings, 3), length);
          if (acceptsPreview(preset.id, window)) accepted++;
        }
        expect(accepted / WINDOWS).toBeGreaterThanOrEqual(0.25);
      });
    }
  }
});

describe('header level meter index (ADR 0053)', () => {
  it('ranks each preset 1–5 under every intro clef', () => {
    LEVEL_PRESETS.forEach((preset, i) => {
      for (const clef of INTRO_CLEFS) {
        expect(levelIndex(full(buildPresetSettings(preset.id, clef)))).toBe(i + 1);
      }
    });
  });

  it('reads Custom (0) whenever no preset matches', () => {
    const defaults = structuredClone(DEFAULT_APP_SETTINGS);
    const expected = matchLevel(defaults) === null ? 0 : LEVEL_PRESETS.findIndex((p) => p.id === matchLevel(defaults)) + 1;
    expect(levelIndex(defaults)).toBe(expected);

    for (const preset of LEVEL_PRESETS) {
      const settings = full(buildPresetSettings(preset.id, 'treble'));
      settings.subdivisions = { ...settings.subdivisions, quarter: !settings.subdivisions.quarter };
      expect(levelIndex(settings)).toBe(0);
    }
  });
});

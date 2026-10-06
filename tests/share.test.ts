import { describe, it, expect } from 'vitest';
import { Exercise, decodeExercise, encodeExercise, exerciseUrl } from '../src/share';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { LEVEL_PRESETS, buildPresetSettings } from '../src/presets';
import { AppSettings, CLEFS, DRONE_NOTES, TIME_SIGNATURES } from '../src/notation/types';

const base = (): AppSettings => structuredClone(DEFAULT_APP_SETTINGS);

/** The exercise fields of a full settings object. */
function exerciseOf(s: AppSettings): Exercise {
  const {
    tempo, timeSignature, clef, ledgerLines, subdivisions, tuplets, rests, ties,
    intervals, pitchClasses, solfegeLabelMode, pulse, countIn, droneNote,
  } = s;
  return {
    tempo, timeSignature, clef, ledgerLines, subdivisions, tuplets, rests, ties,
    intervals, pitchClasses, solfegeLabelMode, pulse, countIn, droneNote,
  };
}

/** Subdivision records may omit thirtySecond and dotted; the decoder spells them out. */
function normalized(e: Exercise): Exercise {
  return {
    ...e,
    subdivisions: { thirtySecond: false, dotted: false, ...e.subdivisions },
  };
}

describe('exercise links (ADR 0085)', () => {
  it('round-trips every level preset in every clef and meter', () => {
    for (const preset of LEVEL_PRESETS) {
      for (const clef of CLEFS) {
        for (const meter of TIME_SIGNATURES) {
          const settings = { ...base(), ...buildPresetSettings(preset.id, clef, meter) } as AppSettings;
          const decoded = decodeExercise(encodeExercise(settings), base());
          expect(decoded).toEqual(normalized(exerciseOf(settings)));
        }
      }
    }
  });

  it('round-trips a custom exercise, overriding a different base', () => {
    const settings: AppSettings = {
      ...base(),
      tempo: 97,
      timeSignature: '6/8',
      clef: 'baritone-c',
      ledgerLines: { above: 0, below: 2 },
      subdivisions: { whole: false, half: false, quarter: true, eighth: true, sixteenth: true, thirtySecond: true, dotted: true },
      rests: true,
      ties: true,
      intervals: { ...base().intervals, unison: true, ninthPlus: true, second: false },
      pitchClasses: { c: true, d: false, e: true, f: false, g: true, a: false, b: false },
      solfegeLabelMode: 'letters',
      pulse: 'division',
      countIn: false,
      droneNote: 'd',
    };
    settings.tuplets.duplet['1/8'] = true;
    settings.tuplets.quadruplet['1/16'] = true;
    expect(decodeExercise(`#${encodeExercise(settings)}`, base())).toEqual(exerciseOf(settings));
  });

  it('carries no personal preferences', () => {
    const settings: AppSettings = {
      ...base(), language: 'de', theme: 'dark', volume: 0.1, zoom: 0.5, showTips: false,
      droneSound: 'pad', droneVolume: 0.2,
    };
    const hash = encodeExercise(settings);
    expect(hash).toBe(encodeExercise(base()));
    for (const word of ['language', 'theme', 'volume', 'zoom', 'mute', 'playhead', 'sound', 'tip']) {
      expect(hash).not.toContain(word);
    }
  });

  it('carries the drone note; links without one keep the recipient\'s (ADR 0092)', () => {
    for (const droneNote of DRONE_NOTES) {
      const hash = encodeExercise({ ...base(), droneNote });
      expect(hash).toContain(`drone=${droneNote}`);
      expect(decodeExercise(hash, { ...base(), droneNote: 'a' })?.droneNote).toBe(droneNote);
    }
    expect(decodeExercise('#x=1&clef=bass', { ...base(), droneNote: 'g' })?.droneNote).toBe('g');
    expect(decodeExercise('#x=1&drone=h', { ...base(), droneNote: 'e' })?.droneNote).toBe('e');
  });

  it('uses only characters URLs leave unescaped', () => {
    const hash = encodeExercise(base());
    expect(hash).toMatch(/^[A-Za-z0-9=&._-]+$/);
    expect(hash).toContain('meter=4-4');
  });

  it('puts the exercise in the fragment and keeps path and query', () => {
    const url = new URL(exerciseUrl(base(), 'https://guidonica.it/it/?a=1#old'));
    expect(url.pathname).toBe('/it/');
    expect(url.search).toBe('?a=1');
    expect(url.hash.startsWith('#x=1&')).toBe(true);
  });

  it('ignores fragments that are not exercise links', () => {
    expect(decodeExercise('', base())).toBeNull();
    expect(decodeExercise('#about', base())).toBeNull();
    expect(decodeExercise('#x=2&clef=bass', base())).toBeNull();
  });

  it('keeps the base for missing and unknown values', () => {
    const b = { ...base(), clef: 'alto' as const, tempo: 80 };
    const decoded = decodeExercise('#x=1&clef=lute&meter=5-4&bpm=fast&rests=yes&labels=neumes&pulse=half', b);
    expect(decoded).toEqual(exerciseOf(b));
  });

  it('reads the pulse values of links made before ADR 0090, and the half-note meters', () => {
    expect(decodeExercise('#x=1&meter=12-8&pulse=eighth', base())?.pulse).toBe('division');
    expect(decodeExercise('#x=1&meter=6-8&pulse=dotted-quarter', { ...base(), pulse: 'division' })?.pulse).toBe('beat');
    for (const meter of ['2/2', '3/2', '4/2', '6/4', '9/4', '12/4'] as const) {
      expect(decodeExercise(`#x=1&meter=${meter.replace('/', '-')}`, base())?.timeSignature).toBe(meter);
    }
  });

  it('clamps tempo and ledger lines', () => {
    expect(decodeExercise('#x=1&bpm=9999&ledger=99-0', base())).toMatchObject({
      tempo: 240,
      ledgerLines: { above: 3, below: 0 },
    });
    expect(decodeExercise('#x=1&bpm=1', base())?.tempo).toBe(30);
  });

  it('ignores unknown list tokens', () => {
    const decoded = decodeExercise('#x=1&values=q.64.zz&int=2.10&tuplets=3-8.11-4&notes=c.h', base());
    expect(decoded?.subdivisions).toEqual({
      whole: false, half: false, quarter: true, eighth: false, sixteenth: false, thirtySecond: false, dotted: false,
    });
    expect(Object.entries(decoded?.intervals ?? {}).filter(([, on]) => on).map(([k]) => k)).toEqual(['second']);
    expect(decoded?.tuplets.triplet['1/8']).toBe(true);
    expect(decoded?.pitchClasses).toEqual({ c: true, d: false, e: false, f: false, g: false, a: false, b: false });
  });

  it('applies the settings guards: a note value and a note stay on', () => {
    const decoded = decodeExercise('#x=1&meter=4-4&values=dot&tuplets=&notes=', base());
    expect(decoded?.subdivisions.quarter).toBe(true);
    expect(Object.values(decoded?.pitchClasses ?? {}).every(Boolean)).toBe(true);
    // A tuplet the meter supports is enough; one it does not support is not
    expect(decodeExercise('#x=1&meter=4-4&values=&tuplets=3-8', base())?.subdivisions.quarter).toBe(false);
    expect(decodeExercise('#x=1&meter=6-8&values=&tuplets=3-8', base())?.subdivisions.quarter).toBe(true);
  });
});

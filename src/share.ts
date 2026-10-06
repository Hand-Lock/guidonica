// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Shareable exercise links (ADR 0085)
// Copyright (C) 2026 A. C. Lo Cascio

import {
  AppSettings,
  CLEFS,
  Clef,
  DRONE_NOTES,
  IntervalOptions,
  MAX_LEDGER_LINES,
  PITCH_CLASSES,
  PitchClassOptions,
  REFERENCE_PITCHES,
  SolfegeLabelMode,
  SubdivisionOptions,
  TIME_SIGNATURES,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletName,
  TupletOptions,
  TupletValue,
  clampTempo,
  parsePulse,
  supportedTuplets,
} from './notation/types';

/**
 * What a link carries: the settings a level preset sets, plus clef, meter, pulse, the
 * drone note and its tuning. Language, theme, sounds, volumes, zoom and the playhead stay
 * with each user.
 */
export type Exercise = Pick<
  AppSettings,
  | 'tempo'
  | 'timeSignature'
  | 'clef'
  | 'ledgerLines'
  | 'subdivisions'
  | 'tuplets'
  | 'rests'
  | 'ties'
  | 'intervals'
  | 'pitchClasses'
  | 'solfegeLabelMode'
  | 'pulse'
  | 'countIn'
  | 'droneNote'
  | 'referencePitch'
>;

/** Link format version; a fragment without `x=1` is not an exercise and is left alone. */
const VERSION = '1';
/** List separator: one of the few characters URLSearchParams never escapes. */
const SEP = '.';

const SUBDIVISION_TOKENS: Record<keyof SubdivisionOptions, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
  thirtySecond: '32',
  dotted: 'dot',
};

// Interval number as musicians write it: 1 = unison … 8 = octave, 9 = ninth and wider
const INTERVAL_TOKENS: Record<keyof IntervalOptions, string> = {
  unison: '1',
  second: '2',
  third: '3',
  fourth: '4',
  fifth: '5',
  sixth: '6',
  seventh: '7',
  octave: '8',
  ninthPlus: '9',
};

const TUPLET_NUMBERS: Record<TupletName, number> = {
  duplet: 2,
  triplet: 3,
  quadruplet: 4,
  quintuplet: 5,
  sextuplet: 6,
  septuplet: 7,
};

/** Note values proper; `dotted` only modifies them. */
const NOTE_VALUES = ['whole', 'half', 'quarter', 'eighth', 'sixteenth', 'thirtySecond'] as const;

const LABEL_MODES: readonly SolfegeLabelMode[] = ['none', 'syllables', 'letters'];

/** "3-8": a triplet of eighths. */
function tupletToken(name: TupletName, value: TupletValue): string {
  return `${TUPLET_NUMBERS[name]}-${value.slice(2)}`;
}

function enabled<K extends string>(flags: Partial<Record<K, boolean>>, tokens: Record<K, string>): string {
  return (Object.keys(tokens) as K[]).filter((key) => flags[key]).map((key) => tokens[key]).join(SEP);
}

/** The flags named in a list, every other known flag off; unknown tokens are ignored. */
function flagsFrom<K extends string>(list: string, tokens: Record<K, string>): Record<K, boolean> {
  const named = new Set(list.split(SEP));
  const result = {} as Record<K, boolean>;
  for (const key of Object.keys(tokens) as K[]) result[key] = named.has(tokens[key]);
  return result;
}

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | null {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function pickFlag(value: string | null): boolean | null {
  return value === '1' ? true : value === '0' ? false : null;
}

/** The URL fragment (without '#') that carries `settings`' exercise. */
export function encodeExercise(settings: Exercise): string {
  const tuplets = TUPLET_NAMES.flatMap((name) =>
    TUPLET_VALUES.filter((value) => settings.tuplets[name][value]).map((value) => tupletToken(name, value))
  );
  const params = new URLSearchParams({
    x: VERSION,
    clef: settings.clef,
    meter: settings.timeSignature.replace('/', '-'),
    bpm: String(settings.tempo),
    ledger: `${settings.ledgerLines.above}-${settings.ledgerLines.below}`,
    values: enabled(settings.subdivisions, SUBDIVISION_TOKENS),
    tuplets: tuplets.join(SEP),
    rests: settings.rests ? '1' : '0',
    ties: settings.ties ? '1' : '0',
    int: enabled(settings.intervals, INTERVAL_TOKENS),
    notes: PITCH_CLASSES.filter((pc) => settings.pitchClasses[pc]).join(SEP),
    labels: settings.solfegeLabelMode,
    pulse: settings.pulse,
    countin: settings.countIn ? '1' : '0',
    drone: settings.droneNote,
    a4: String(settings.referencePitch),
  });
  return params.toString();
}

/** `href` with its fragment replaced by the exercise. */
export function exerciseUrl(settings: Exercise, href: string): string {
  const url = new URL(href);
  url.hash = encodeExercise(settings);
  return url.href;
}

/**
 * The exercise in a URL fragment, validated field by field: a missing or unknown value
 * keeps `base`'s. Null when the fragment is not an exercise link. The same guards as the
 * settings UI apply: some note value or tuplet stays on, and some note stays selected.
 */
export function decodeExercise(hash: string, base: Exercise): Exercise | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('x') !== VERSION) return null;

  const timeSignature =
    pick<TimeSignature>(params.get('meter')?.replace('-', '/') ?? null, TIME_SIGNATURES) ?? base.timeSignature;

  const bpm = Number(params.get('bpm') || NaN);
  const tempo = Number.isFinite(bpm) ? clampTempo(bpm) : base.tempo;

  const ledgerMatch = /^(\d+)-(\d+)$/.exec(params.get('ledger') ?? '');
  const ledgerLines = ledgerMatch
    ? {
        above: Math.min(MAX_LEDGER_LINES, Number(ledgerMatch[1])),
        below: Math.min(MAX_LEDGER_LINES, Number(ledgerMatch[2])),
      }
    : { ...base.ledgerLines };

  const values = params.get('values');
  const subdivisions: SubdivisionOptions =
    values === null ? { ...base.subdivisions } : flagsFrom(values, SUBDIVISION_TOKENS);

  const tupletList = params.get('tuplets');
  const tuplets: TupletOptions = structuredClone(base.tuplets);
  if (tupletList !== null) {
    const named = new Set(tupletList.split(SEP));
    for (const name of TUPLET_NAMES) {
      for (const value of TUPLET_VALUES) tuplets[name][value] = named.has(tupletToken(name, value));
    }
  }

  const active = supportedTuplets(timeSignature, tuplets);
  const anyTuplet = TUPLET_NAMES.some((name) => TUPLET_VALUES.some((value) => active[name][value]));
  const anyValue = NOTE_VALUES.some((key) => subdivisions[key]);
  if (!anyValue && !anyTuplet) subdivisions.quarter = true;

  const intList = params.get('int');
  const intervals: IntervalOptions = intList === null ? { ...base.intervals } : flagsFrom(intList, INTERVAL_TOKENS);

  const noteList = params.get('notes');
  let pitchClasses: PitchClassOptions = { ...base.pitchClasses };
  if (noteList !== null) {
    const named = new Set(noteList.split(SEP));
    const picked = Object.fromEntries(PITCH_CLASSES.map((pc) => [pc, named.has(pc)])) as PitchClassOptions;
    // Every note off loads as all on, like the stored-settings guard (storage.ts)
    pitchClasses = Object.values(picked).some(Boolean)
      ? picked
      : (Object.fromEntries(PITCH_CLASSES.map((pc) => [pc, true])) as PitchClassOptions);
  }

  return {
    tempo,
    timeSignature,
    clef: pick<Clef>(params.get('clef'), CLEFS) ?? base.clef,
    ledgerLines,
    subdivisions,
    tuplets,
    rests: pickFlag(params.get('rests')) ?? base.rests,
    ties: pickFlag(params.get('ties')) ?? base.ties,
    intervals,
    pitchClasses,
    solfegeLabelMode: pick(params.get('labels'), LABEL_MODES) ?? base.solfegeLabelMode,
    // Links from before ADR 0090 carry the compound-only names, which parsePulse maps
    pulse: parsePulse(params.get('pulse')) ?? base.pulse,
    countIn: pickFlag(params.get('countin')) ?? base.countIn,
    // Links from before ADR 0092 have no drone and keep the recipient's
    droneNote: pick(params.get('drone'), DRONE_NOTES) ?? base.droneNote,
    // Links from before ADR 0094 have no tuning and keep the recipient's
    referencePitch: REFERENCE_PITCHES.find((hz) => String(hz) === params.get('a4')) ?? base.referencePitch,
  };
}

import {
  AppSettings,
  Clef,
  ClefPitchConfig,
  IntervalOptions,
  LedgerLineOptions,
  METER,
  MeasureData,
  NoteData,
  PITCH_CLASSES,
  PitchClassOptions,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_PLACEMENTS,
  TUPLET_VALUES,
  TimeSignature,
  TupletCell,
  TupletName,
  TupletOptions,
  TupletValue,
  computeBeatWidth,
  supportedTuplets,
  tupletShape,
  tupletSpan,
} from './types';
import {
  TIE_PROBABILITY,
  applyTies,
  canTieAcrossBarline,
  consolidateRests,
  isPlaced,
  noteSpan,
  placementOf,
} from './ties';

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export interface PartitionItem {
  duration: string;
  beatDuration: number;
  isRest: boolean;
  isTuplet?: boolean;
  tupletGroup?: number;
  tupletNumNotes?: number;
  tupletNotesOccupied?: number;
  /** Beats per unit of the tuplet (one member of an unmerged group). */
  tupletUnit?: number;
  tieStart?: boolean;
  tieEnd?: boolean;
}

/**
 * Silence is a two-state chain over notes and tuplet members (ADR 0066): a rest starts after
 * a sounding item with SILENCE_PROBABILITY and continues after a silent one with
 * SILENCE_CONTINUE_PROBABILITY, so a k-item silence costs 0.1 · 0.5^(k−1), not 0.15^k.
 */
export const SILENCE_PROBABILITY = 0.1;
export const SILENCE_CONTINUE_PROBABILITY = 0.5;

/**
 * The note values a configuration draws from: every enabled base value plus, with dotted
 * on, the dotted value of each enabled base (wd needs whole, hd half, qd quarter, 8d
 * eighth, 16d sixteenth). Ordered longest first (ADR 0065). The breve and dotted breve
 * ride on the whole: only 4/2 places b and only 12/4 bd, and wd fits 12/8, 3/2, 4/2 and
 * the 6/4 family (ADR 0076, 0090). A dotted value only fills a bar beside its
 * shorter partner: 8d needs 16 or 32, 16d needs 32, and qd in 4/4 and 2/4 needs 8 or
 * shorter, so without it the value is in the alphabet but never written (ADR 0066).
 */
export function enabledValues(subdiv: SubdivisionOptions): string[] {
  const dotted = subdiv.dotted !== false;
  const values: string[] = [];
  if (subdiv.whole) values.push('w', ...(dotted ? ['wd'] : []), 'b', ...(dotted ? ['bd'] : []));
  if (subdiv.half) values.push('h', ...(dotted ? ['hd'] : []));
  if (subdiv.quarter) values.push('q', ...(dotted ? ['qd'] : []));
  if (subdiv.eighth) values.push('8', ...(dotted ? ['8d'] : []));
  if (subdiv.sixteenth) values.push('16', ...(dotted ? ['16d'] : []));
  if (subdiv.thirtySecond) values.push('32');
  return values;
}

/** One plain notehead the sampler may write at a grid point. */
interface NoteStep {
  duration: string;
  units: number;
}

/** One tuplet group the sampler may write at a grid point. */
interface TupletStep {
  name: TupletName;
  value: TupletValue;
  units: number;
}

/**
 * Every legal, completable step at each grid point of one bar. The grid is the 32nd: 8
 * units per quarter metric beat, 4 per eighth metric beat (6/8, 9/8, 12/8).
 */
export interface RhythmGrammar {
  unitsPerBeat: number;
  barUnits: number;
  /** The values in play, including the beat-unit fallback when it was needed. */
  values: ReadonlySet<string>;
  notes: readonly NoteStep[][];
  tuplets: readonly TupletStep[][];
}

interface GrammarDraft extends RhythmGrammar {
  complete: boolean;
  /** Values and tuplet cells that occur in at least one complete bar. */
  used: ReadonlySet<string>;
}

function buildGrammar(ts: TimeSignature, values: readonly string[], cells: readonly TupletCell[]): GrammarDraft {
  const unitsPerBeat = 32 / METER[ts].beatValue;
  const barUnits = METER[ts].beatsPerMeasure * unitsPerBeat;
  const allNotes: NoteStep[][] = [];
  const allTuplets: TupletStep[][] = [];
  for (let u = 0; u < barUnits; u++) {
    const offset = u / unitsPerBeat;
    allNotes.push(
      values.flatMap((duration) => {
        const span = noteSpan(ts, duration);
        return span !== null && placementOf(ts, offset, span) !== null
          ? [{ duration, units: Math.round(span * unitsPerBeat) }]
          : [];
      })
    );
    allTuplets.push(
      cells.flatMap((cell) => {
        const placement = TUPLET_PLACEMENTS[ts][cell];
        const [name, value] = cell.split(':') as [TupletName, TupletValue];
        const units = Math.round(tupletSpan(ts, name, value) * unitsPerBeat);
        return placement && u + units <= barUnits && isPlaced(offset, placement) ? [{ name, value, units }] : [];
      })
    );
  }

  // Backward pass: from which grid points the bar can still be filled exactly
  const completable = new Array<boolean>(barUnits + 1).fill(false);
  completable[barUnits] = true;
  for (let u = barUnits - 1; u >= 0; u--) {
    completable[u] =
      allNotes[u].some((s) => completable[u + s.units]) || allTuplets[u].some((s) => completable[u + s.units]);
  }
  const notes = allNotes.map((steps, u) => steps.filter((s) => completable[u + s.units]));
  const tuplets = allTuplets.map((steps, u) => steps.filter((s) => completable[u + s.units]));

  // Forward pass: which values and cells some complete bar actually uses
  const used = new Set<string>();
  const reached = new Array<boolean>(barUnits + 1).fill(false);
  reached[0] = completable[0];
  for (let u = 0; u < barUnits; u++) {
    if (!reached[u]) continue;
    for (const s of notes[u]) {
      used.add(s.duration);
      reached[u + s.units] = true;
    }
    for (const s of tuplets[u]) {
      used.add(`${s.name}:${s.value}`);
      reached[u + s.units] = true;
    }
  }

  return { unitsPerBeat, barUnits, values: new Set(values), notes, tuplets, complete: completable[0], used };
}

const grammarMemo = new Map<string, RhythmGrammar>();
const GRAMMAR_MEMO_LIMIT = 64;

/**
 * Rhythm grammar of a configuration, memoized. When the enabled values cannot fill a bar
 * (whole notes only in 3/4), or when the beat unit would make an enabled value or cell
 * reachable that otherwise is not (q in 4/4 with half and dotted only, for the hd), the
 * metric beat's value (q; 8 in 6/8, 9/8, 12/8) joins the values. Nothing else is ever added (ADR 0065).
 */
export function rhythmGrammar(ts: TimeSignature, subdiv: SubdivisionOptions, tuplets?: TupletOptions): RhythmGrammar {
  const active = tuplets && supportedTuplets(ts, tuplets);
  const cells: TupletCell[] = [];
  for (const name of TUPLET_NAMES) {
    for (const value of TUPLET_VALUES) {
      if (active?.[name][value]) cells.push(`${name}:${value}`);
    }
  }
  let values = enabledValues(subdiv);
  // Nothing selected at all: quarter notes
  if (values.length === 0 && cells.length === 0) values = enabledValues({ ...subdiv, quarter: true });

  const key = `${ts}|${values.join(',')}|${cells.join(',')}`;
  const memo = grammarMemo.get(key);
  if (memo) return memo;

  let grammar = buildGrammar(ts, values, cells);
  const beatUnit = METER[ts].beatValue === 8 ? '8' : 'q';
  if (!values.includes(beatUnit)) {
    const unused = [...values, ...cells].filter((k) => !grammar.used.has(k));
    if (!grammar.complete || unused.length > 0) {
      const widened = buildGrammar(ts, [...values, beatUnit], cells);
      if (!grammar.complete || unused.some((k) => widened.used.has(k))) grammar = widened;
    }
  }

  if (grammarMemo.size >= GRAMMAR_MEMO_LIMIT) grammarMemo.clear();
  grammarMemo.set(key, grammar);
  return grammar;
}

/** Tuplet members by base value and length in tuplet units (one notehead each). */
const TUPLET_MEMBERS: Record<TupletValue, Record<number, string>> = {
  '1/4': { 1: 'q', 2: 'h', 3: 'hd', 4: 'w' },
  '1/8': { 1: '8', 2: 'q', 3: 'qd', 4: 'h', 6: 'hd' },
  '1/16': { 1: '16', 2: '8', 3: '8d', 4: 'q', 6: 'qd' },
};

/** Member lengths a tuplet rest may take: undotted, like every other rest. */
const TUPLET_REST_UNITS: ReadonlySet<number> = new Set([1, 2, 4]);

/**
 * Member value of `units` tuplet units, or null when it is not one enabled notehead. A
 * single unit is always allowed (the cell itself is enabled); a longer member needs its
 * value enabled, so dotted members need dotted on.
 */
function tupletMember(value: TupletValue, units: number, values: ReadonlySet<string>): string | null {
  const duration = TUPLET_MEMBERS[value][units];
  if (duration === undefined) return null;
  return units === 1 || values.has(duration) ? duration : null;
}

const compositionMemo = new Map<string, number[][][]>();

/**
 * Every way to split an n-unit tuplet into at least two members that are each one enabled
 * notehead, grouped by member count (index 0 holds the shortest splits). n ≤ 7, so there
 * are at most 2^6 = 64 compositions; memoized per cell value and allowed member lengths.
 */
export function tupletCompositions(n: number, value: TupletValue, values: ReadonlySet<string>): number[][][] {
  const lengths = Object.keys(TUPLET_MEMBERS[value])
    .map(Number)
    .filter((units) => units < n && tupletMember(value, units, values) !== null);
  const key = `${value}|${n}|${lengths.join(',')}`;
  const memo = compositionMemo.get(key);
  if (memo) return memo;

  const byCount = new Map<number, number[][]>();
  const extend = (prefix: number[], rest: number): void => {
    if (rest === 0) {
      if (prefix.length < 2) return;
      const list = byCount.get(prefix.length) ?? [];
      list.push(prefix);
      byCount.set(prefix.length, list);
      return;
    }
    for (const units of lengths) {
      if (units <= rest) extend([...prefix, units], rest - units);
    }
  };
  extend([], n);
  const grouped = [...byCount.keys()].sort((a, b) => a - b).map((count) => byCount.get(count) ?? []);
  compositionMemo.set(key, grouped);
  return grouped;
}

/** Member lengths of one tuplet: a uniform member count, then a uniform composition (ADR 0066). */
export function drawTupletMembers(n: number, value: TupletValue, values: ReadonlySet<string>): number[] {
  return pick(pick(tupletCompositions(n, value, values)));
}

// Diatonic pitch pools (C Major / A Minor baseline), derived per clef from the bottom staff line.
// Diatonic step arithmetic: step = octave * 7 + letter index (c = 0 ... b = 6).
const LETTERS = 'cdefgab';

function toStep(key: string): number {
  const [letter, octave] = key.split('/');
  return Number(octave) * 7 + LETTERS.indexOf(letter);
}

function toKey(step: number): string {
  return `${LETTERS[((step % 7) + 7) % 7]}/${Math.floor(step / 7)}`;
}

export const CLEF_PITCH_RANGES: Record<Clef, ClefPitchConfig> = {
  treble: { bottomLine: 'e/4', defaultAnchor: 'c/4', restPitch: 'b/4' }, // Staff E4–F5
  soprano: { bottomLine: 'c/4', defaultAnchor: 'c/4', restPitch: 'g/4' }, // Staff C4–D5
  'mezzo-soprano': { bottomLine: 'a/3', defaultAnchor: 'c/4', restPitch: 'e/4' }, // Staff A3–B4
  alto: { bottomLine: 'f/3', defaultAnchor: 'c/4', restPitch: 'c/4' }, // Staff F3–G4
  tenor: { bottomLine: 'd/3', defaultAnchor: 'c/4', restPitch: 'a/3' }, // Staff D3–E4
  'baritone-f': { bottomLine: 'b/2', defaultAnchor: 'c/3', restPitch: 'f/3' }, // Staff B2–C4
  'baritone-c': { bottomLine: 'b/2', defaultAnchor: 'c/3', restPitch: 'f/3' }, // Staff B2–C4
  bass: { bottomLine: 'g/2', defaultAnchor: 'c/3', restPitch: 'd/3' }, // Staff G2–A3
};

/**
 * Inclusive diatonic step bounds of a clef's pitch pool. n ledger lines on a side reach the
 * space beyond the n-th ledger line (2n + 1 steps past the outer staff line), so 0 still
 * allows the space just outside the staff. At 3/3 the pool is 23 notes, at 0/0 it is 11.
 */
export function pitchBounds(clef: Clef, ledger: LedgerLineOptions): { low: number; high: number } {
  const bottom = toStep(CLEF_PITCH_RANGES[clef].bottomLine);
  return {
    low: bottom - (2 * ledger.below + 1),
    high: bottom + 8 + (2 * ledger.above + 1),
  };
}

/**
 * Ascending absolute diatonic steps of a clef's pool whose letter is a selected pitch class
 * (ADR 0070). No classes (or none selected) means every step in the bounds.
 */
export function pitchSteps(clef: Clef, ledger: LedgerLineOptions, classes?: PitchClassOptions): number[] {
  const { low, high } = pitchBounds(clef, ledger);
  const all = Array.from({ length: high - low + 1 }, (_, i) => low + i);
  if (classes === undefined || !PITCH_CLASSES.some((pc) => classes[pc])) return all;
  return all.filter((step) => classes[PITCH_CLASSES[((step % 7) + 7) % 7]]);
}

/** Ascending diatonic pitch pool (VexFlow keys) for a clef, ledger-line and note setting. */
export function pitchPool(clef: Clef, ledger: LedgerLineOptions, classes?: PitchClassOptions): string[] {
  return pitchSteps(clef, ledger, classes).map(toKey);
}

/** A selected melodic move: a diatonic step count (0 = unison) or any leap of a 9th or more. */
type IntervalChoice = number | '9+';

/** Interval toggles in move order: index = diatonic steps for unison … octave, then 9+. */
export const INTERVAL_KEYS = [
  'unison',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'octave',
  'ninthPlus',
] as const satisfies readonly (keyof IntervalOptions)[];

const choiceOf = (index: number): IntervalChoice => (index === 8 ? '9+' : index);

/** The interval toggles as moves; nothing selected falls back to seconds and thirds. */
function selectedIntervals(intervals: IntervalOptions): IntervalChoice[] {
  const choices = INTERVAL_KEYS.flatMap((key, i) => (intervals[key] ? [choiceOf(i)] : []));
  return choices.length > 0 ? choices : [1, 2];
}

/** Whether a diatonic distance is one move of a choice (9+: a 9th or more). */
function isMove(choice: IntervalChoice, distance: number): boolean {
  return choice === '9+' ? distance >= 8 : distance === choice;
}

/** Pool indices one move of `choice` above and below `idx`, each side nearest first. */
function targetsOf(idx: number, choice: IntervalChoice, steps: readonly number[]): { up: number[]; down: number[] } {
  const up: number[] = [];
  const down: number[] = [];
  if (choice === 0) return { up: [idx], down: [] };
  for (let j = idx + 1; j < steps.length; j++) if (isMove(choice, steps[j] - steps[idx])) up.push(j);
  for (let j = idx - 1; j >= 0; j--) if (isMove(choice, steps[idx] - steps[j])) down.push(j);
  return { up, down };
}

/** Pool indices one move away from `idx` (unison counts). */
function movesFrom(idx: number, choices: readonly IntervalChoice[], steps: readonly number[]): number[] {
  const targets = new Set<number>();
  for (const c of choices) {
    const { up, down } = targetsOf(idx, c, steps);
    for (const j of [...up, ...down]) targets.add(j);
  }
  return [...targets];
}

/** Pool indices with at least one move (unison counts). */
function livePitches(choices: readonly IntervalChoice[], steps: readonly number[]): number[] {
  return steps.map((_, i) => i).filter((i) => movesFrom(i, choices, steps).length > 0);
}

/** The intervals a walk over `steps` actually uses (ADR 0070). */
export interface EffectiveIntervals {
  /** Moves the walk draws from. */
  choices: IntervalChoice[];
  /** Interval toggles no pair of pool pitches spans: they cannot occur with these notes. */
  dormant: (keyof IntervalOptions)[];
  /** True when no selected move joins two pool pitches, so every move that does is used. */
  fallback: boolean;
}

/**
 * Single source of truth for the generator and the Settings UI. A class is realizable when
 * some pair of pool pitches spans it (unison always is). The walk uses the selected
 * realizable classes; when the selection asks for motion but none of its moving classes
 * joins two pool pitches, every realizable moving class is used instead, like the
 * "nothing selected → 2nds & 3rds" rule. Unison only stays unison only. With the full
 * diatonic pool (≥ 11 pitches) every class is realizable, so choices equal the selection.
 */
export function effectiveIntervals(intervals: IntervalOptions, steps: readonly number[]): EffectiveIntervals {
  const span = steps.length > 0 ? steps[steps.length - 1] - steps[0] : 0;
  const distances = new Set<number>();
  for (let i = 0; i < steps.length; i++) {
    for (let j = i + 1; j < steps.length && steps[j] - steps[i] <= 7; j++) distances.add(steps[j] - steps[i]);
  }
  const realizable = (c: IntervalChoice): boolean => (c === '9+' ? span >= 8 : c === 0 || distances.has(c));

  const selected = selectedIntervals(intervals);
  let choices = selected.filter(realizable);
  let fallback = false;
  const moving = (c: IntervalChoice): boolean => c !== 0;
  if (selected.some(moving) && !choices.some(moving)) {
    fallback = true;
    const all = INTERVAL_KEYS.map((_, i) => choiceOf(i));
    choices = [...choices, ...all.filter((c) => moving(c) && realizable(c))];
  }
  // A one-pitch pool can only repeat its note
  if (choices.length === 0) choices = [0];
  const dormant = INTERVAL_KEYS.filter((_, i) => !realizable(choiceOf(i)));
  return { choices, dormant, fallback };
}

/** Index of the pool pitch nearest `step`, the lower one on a tie. */
function nearestIndex(steps: readonly number[], step: number): number {
  let best = 0;
  for (let i = 1; i < steps.length; i++) {
    if (Math.abs(steps[i] - step) < Math.abs(steps[best] - step)) best = i;
  }
  return best;
}

/** startIndex over already-resolved moves. */
function startFrom(choices: readonly IntervalChoice[], clef: Clef, steps: readonly number[]): number {
  const anchor = nearestIndex(steps, toStep(CLEF_PITCH_RANGES[clef].defaultAnchor));
  const live = livePitches(choices, steps);
  const seen = new Set<number>([anchor]);
  const queue = [anchor];
  while (queue.length > 0) {
    const idx = queue.shift() as number;
    for (const next of movesFrom(idx, choices, steps)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return live.includes(anchor) && live.every((i) => seen.has(i)) ? anchor : pick(live);
}

/**
 * First pitch of a session, as an index into `steps` (ADR 0066, 0070). The pool pitch
 * nearest the clef anchor (the clamped anchor when every note is on) when its component of
 * the move graph holds every live pitch, which keeps ADR 0006's tonal reference for every
 * connected setup. Otherwise (thirds only reach the lines or the spaces, unison only never
 * moves) a uniformly random live pitch, so every component and every melody within it has
 * P > 0 per session. Every move is reversible (a move by k between two pool pitches is a
 * move by k back; a 9+ leap leaves a 9+ leap back), so a live start never reaches a pitch
 * without a move.
 */
export function startIndex(intervals: IntervalOptions, clef: Clef, steps: readonly number[]): number {
  return startFrom(effectiveIntervals(intervals, steps).choices, clef, steps);
}

/** Last note of the previously generated measure, source of an incoming barline tie. */
interface MeasureTail {
  measureIndex: number;
  beatOffset: number;
  duration: string;
  beatWidth: number;
  width: number;
}

export class MusicGenerator {
  /** Absolute diatonic step of the last sampled pitch (null until the session's first note). */
  private lastStep: number | null = null;
  private tupletCounter: number = 0;
  private consecutiveUnisons: number = 0;
  private isFirstNoteOfSession: boolean = true;
  /** Next measure's rhythm, composed one bar early so a barline tie sees both notes. */
  private lookahead: PartitionItem[] | null = null;
  private tail: MeasureTail | null = null;
  private lastSoundingPitch: string | null = null;
  /** Whether the last note or tuplet member was silent: the state of the rest chain. */
  private lastSilent: boolean = false;

  constructor() {
    this.resetPitch();
  }

  public resetPitch(): void {
    this.tupletCounter = 0;
    this.consecutiveUnisons = 0;
    this.isFirstNoteOfSession = true;
    this.lookahead = null;
    this.tail = null;
    this.lastSoundingPitch = null;
    this.lastStep = null;
    this.lastSilent = false;
  }

  /** One step of the two-state rest chain (ADR 0066). */
  private drawSilent(): boolean {
    this.lastSilent = Math.random() < (this.lastSilent ? SILENCE_CONTINUE_PROBABILITY : SILENCE_PROBABILITY);
    return this.lastSilent;
  }

  /**
   * Generates a procedurally composed measure satisfying metric linearity and rhythm/melody rules.
   * With ties on, the following measure's rhythm is composed as a lookahead so the barline
   * pair (last note here, first note there) can be tied with both notes known.
   */
  public generateMeasure(measureIndex: number, settings: AppSettings, startBeat: number): MeasureData {
    const { timeSignature, clef, subdivisions, tuplets, ties, intervals, ledgerLines, pitchClasses } = settings;
    // At most 23 pitches: resolved once per measure (ADR 0070)
    const steps = pitchSteps(clef, ledgerLines, pitchClasses);
    const { choices } = effectiveIntervals(intervals, steps);
    const { beatsPerMeasure, beatValue } = METER[timeSignature];
    const beatWidth = computeBeatWidth(subdivisions, timeSignature, tuplets);
    const measureWidth = beatsPerMeasure * beatWidth;

    const rawRhythms = this.lookahead ?? this.composeRhythm(settings);
    this.lookahead = null;

    // An incoming barline tie survives only if the previous bar was generated right before
    // this one (the buffer skips measures after a throttled background tab)
    const tail = this.tail;
    const first = rawRhythms[0];
    if (first.tieEnd && (tail === null || measureIndex !== tail.measureIndex + 1)) {
      first.tieEnd = false;
    }

    if (ties) {
      this.lookahead = this.composeRhythm(settings);
      const last = rawRhythms[rawRhythms.length - 1];
      const next = this.lookahead[0];
      if (canTieAcrossBarline(last, next) && Math.random() < TIE_PROBABILITY) {
        last.tieStart = true;
        next.tieEnd = true;
      }
    }

    const notes: NoteData[] = [];

    let currentOffset = 0;
    for (const item of rawRhythms) {
      let pitch: string;
      if (item.isRest) {
        // A whole rest hangs from the fourth line, two steps above the other rests; the
        // breve rest stands on the middle line, filling the space up to the fourth (ADR 0090)
        const restStep = toStep(CLEF_PITCH_RANGES[clef].restPitch);
        pitch = toKey(item.duration === 'w' || item.duration === 'wd' ? restStep + 2 : restStep);
      } else if (item.tieEnd && this.lastSoundingPitch !== null) {
        // Tied note strictly maintains the pitch of the note it is tied from
        pitch = this.lastSoundingPitch;
      } else if (this.isFirstNoteOfSession || this.lastStep === null) {
        this.isFirstNoteOfSession = false;
        // Pool pitch nearest the anchor (treble with 0 ledger lines below starts on D4), or a
        // random live pitch when the anchor cannot reach the whole pool
        this.lastStep = steps[startFrom(choices, clef, steps)];
        pitch = toKey(this.lastStep);
      } else {
        pitch = this.sampleNextPitch(choices, clef, this.lastStep, steps);
      }

      if (!item.isRest) {
        this.lastSoundingPitch = pitch;
      }

      notes.push({
        keys: [pitch],
        duration: item.duration,
        isRest: item.isRest,
        isTuplet: item.isTuplet,
        tupletGroup: item.tupletGroup,
        tupletNumNotes: item.tupletNumNotes,
        tupletNotesOccupied: item.tupletNotesOccupied,
        tieStart: item.tieStart,
        tieEnd: item.tieEnd,
        beatOffset: currentOffset,
        beatDuration: item.beatDuration,
      });

      currentOffset += item.beatDuration;
    }

    const measure: MeasureData = {
      index: measureIndex,
      notes,
      clef,
      timeSignature,
      beatsPerMeasure,
      beatValue,
      beatWidth,
      width: measureWidth,
      startBeat,
    };
    if (notes[0].tieEnd && tail !== null) {
      measure.tieIn = {
        beatOffset: tail.beatOffset,
        duration: tail.duration,
        beatWidth: tail.beatWidth,
        measureWidth: tail.width,
      };
    }

    const lastNote = notes[notes.length - 1];
    this.tail = {
      measureIndex,
      beatOffset: lastNote.beatOffset,
      duration: lastNote.duration,
      beatWidth,
      width: measureWidth,
    };

    return measure;
  }

  /**
   * Markov random-walk step over the pool `steps` (ascending diatonic steps of the selected
   * notes). Only moves with a target from the current pitch are drawn (weights renormalize
   * over them), so every in-range move keeps P > 0 and no interval is ever mislabeled by
   * clamping. The walk is symmetric: up and down are equally likely whenever both exist
   * (ADR 0065). The walk starts on a live pitch (startIndex) and every move is reversible,
   * so some move always exists. With every note on, `steps` is contiguous and the draws
   * (and their Math.random() order) are those of the index walk before ADR 0070.
   */
  private sampleNextPitch(
    choices: readonly IntervalChoice[],
    clef: Clef,
    lastStep: number,
    steps: readonly number[]
  ): string {
    const currentIdx = nearestIndex(steps, lastStep);
    const commit = (idx: number): string => {
      this.lastStep = steps[idx];
      return toKey(this.lastStep);
    };

    // Feasibility: keep moves with at least one target from the current pitch. With the
    // default ±3 pool (23 notes) and every note on, nothing is ever removed.
    const active = choices
      .map((choice) => ({ choice, ...targetsOf(currentIdx, choice, steps) }))
      .filter((m) => m.up.length + m.down.length > 0);

    if (active.length === 0) {
      // Unreachable from a live start; guards a pool or interval change without a reset
      this.consecutiveUnisons = 0;
      return commit(startFrom(choices, clef, steps));
    }

    // Pick an interval step size from the active set. Unison is softly down-weighted
    // by 1 / (1 + run length) against weight 1 for every moving interval, so long
    // repeated-note runs grow rarer but never become impossible (P > 0).
    const weights = active.map((m) => (m.choice === 0 ? 1 / (1 + this.consecutiveUnisons) : 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * totalWeight;
    let chosen = active[active.length - 1];
    for (let i = 0; i < active.length; i++) {
      r -= weights[i];
      if (r < 0) {
        chosen = active[i];
        break;
      }
    }

    if (chosen.choice === 0) {
      this.consecutiveUnisons++;
      return commit(currentIdx);
    }

    this.consecutiveUnisons = 0;

    if (chosen.choice === '9+') {
      // Ninth and plus: a direction with a compound leap, then any of its leaps uniformly
      const directions: number[][] = [];
      if (chosen.up.length > 0) directions.push(chosen.up);
      if (chosen.down.length > 0) directions.push(chosen.down);
      return commit(pick(pick(directions)));
    }

    // A fixed step lands on at most one pitch per side. Both exist: a fair coin.
    // Feasibility alone keeps the walk in range, so no inward bias is applied and the
    // edge notes stay as reachable as the middle
    if (chosen.up.length > 0 && chosen.down.length > 0) {
      return commit(Math.random() < 0.5 ? chosen.up[0] : chosen.down[0]);
    }
    return commit(chosen.up.length > 0 ? chosen.up[0] : chosen.down[0]);
  }

  /**
   * Composes one bar's rhythm: the grammar-driven sampler, then rests, then (with ties on)
   * the within-measure tie grammar (ties.ts). Each step is a uniform draw over the plain
   * values legal and completable at that grid point plus one aggregate "tuplet" option, so
   * every legal bar has P > 0 and no figure is buried by the number of enabled tuplets.
   */
  private composeRhythm(settings: AppSettings): PartitionItem[] {
    const { timeSignature: ts, subdivisions, tuplets, rests, ties } = settings;
    const grammar = rhythmGrammar(ts, subdivisions, tuplets);
    const items: PartitionItem[] = [];
    let u = 0;
    while (u < grammar.barUnits) {
      const notes = grammar.notes[u];
      const groups = grammar.tuplets[u];
      const k = Math.floor(Math.random() * (notes.length + (groups.length > 0 ? 1 : 0)));
      if (k < notes.length) {
        const step = notes[k];
        items.push({
          duration: step.duration,
          beatDuration: step.units / grammar.unitsPerBeat,
          isRest: rests && this.drawSilent(),
        });
        u += step.units;
      } else {
        const step = pick(groups);
        items.push(...this.makeTupletItems(ts, step, grammar, rests));
        u += step.units;
      }
    }
    const spelled = rests ? consolidateRests(items, ts, grammar.values) : items;
    return ties ? applyTies(spelled, ts) : spelled;
  }

  /**
   * One tuplet group. Its n units are split into members (ADR 0066): a member count drawn
   * uniformly among the feasible ones, then one composition with that many members, each one
   * enabled notehead, drawn uniformly. Members then step the rest chain (only undotted ones
   * may be silent), redrawn from the state before the group until not all are silent.
   * Adjacent silent members are written as the longest undotted rest (ADR 0065).
   */
  private makeTupletItems(
    ts: TimeSignature,
    step: TupletStep,
    grammar: RhythmGrammar,
    allowRests: boolean
  ): PartitionItem[] {
    const { notes: n, inTimeOf } = tupletShape(ts, step.name, step.value);
    const unit = step.units / grammar.unitsPerBeat / n;
    const values = grammar.values;

    const members = drawTupletMembers(n, step.value, values);

    const before = this.lastSilent;
    let silent: boolean[];
    do {
      this.lastSilent = before;
      silent = members.map((m) => {
        if (allowRests && TUPLET_REST_UNITS.has(m)) return this.drawSilent();
        this.lastSilent = false;
        return false;
      });
    } while (silent.every(Boolean));

    const parts: { units: number; isRest: boolean }[] = [];
    for (let i = 0; i < members.length; ) {
      if (!silent[i]) {
        parts.push({ units: members[i], isRest: false });
        i++;
        continue;
      }
      // Longest run of silent members that one enabled rest spells
      let best = 1;
      let units = 0;
      for (let j = i; j < members.length && silent[j]; j++) {
        units += members[j];
        if (TUPLET_REST_UNITS.has(units) && tupletMember(step.value, units, values) !== null) best = j - i + 1;
      }
      parts.push({ units: members.slice(i, i + best).reduce((a, b) => a + b, 0), isRest: true });
      i += best;
    }

    const tupletGroup = ++this.tupletCounter;
    return parts.map(({ units, isRest }) => ({
      duration: TUPLET_MEMBERS[step.value][units],
      beatDuration: units * unit,
      isRest,
      isTuplet: true,
      tupletGroup,
      tupletNumNotes: n,
      tupletNotesOccupied: inTimeOf,
      tupletUnit: unit,
    }));
  }
}

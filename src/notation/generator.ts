import {
  AppSettings,
  Clef,
  ClefPitchConfig,
  IntervalOptions,
  LedgerLineOptions,
  METER,
  MeasureData,
  NoteData,
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
  BAR_REST,
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

/** Probability that a note (or a tuplet member) is written as a rest when rests are on. */
export const SILENCE_PROBABILITY = 0.15;

/** Probability that two adjacent tuplet units sound as one member (3[q 8]). */
export const TUPLET_MERGE_PROBABILITY = 0.2;

/**
 * The note values a configuration draws from: every enabled base value plus, with dotted
 * on, the dotted value of each enabled base (hd needs half, qd quarter, 8d eighth, 16d
 * sixteenth). Ordered longest first (ADR 0065).
 */
export function enabledValues(subdiv: SubdivisionOptions): string[] {
  const dotted = subdiv.dotted !== false;
  const values: string[] = [];
  if (subdiv.whole) values.push('w');
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
 * units per quarter beat in simple meters, 4 per eighth beat in 6/8.
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
  const unitsPerBeat = ts === '6/8' ? 4 : 8;
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
 * beat unit (q; 8 in 6/8) joins the values. Nothing else is ever added (ADR 0065).
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
  const beatUnit = ts === '6/8' ? '8' : 'q';
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

/** Ascending diatonic pitch pool (VexFlow keys) for a clef and ledger-line setting. */
export function pitchPool(clef: Clef, ledger: LedgerLineOptions): string[] {
  const { low, high } = pitchBounds(clef, ledger);
  return Array.from({ length: high - low + 1 }, (_, i) => toKey(low + i));
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
  }

  /**
   * Generates a procedurally composed measure satisfying metric linearity and rhythm/melody rules.
   * With ties on, the following measure's rhythm is composed as a lookahead so the barline
   * pair (last note here, first note there) can be tied with both notes known.
   */
  public generateMeasure(measureIndex: number, settings: AppSettings, startBeat: number): MeasureData {
    const { timeSignature, clef, subdivisions, tuplets, ties, intervals, ledgerLines } = settings;
    const { low, high } = pitchBounds(clef, ledgerLines);
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
        // A whole rest hangs from the fourth line, two steps above the other rests
        const restStep = toStep(CLEF_PITCH_RANGES[clef].restPitch);
        pitch = toKey(item.duration === BAR_REST ? restStep + 2 : restStep);
      } else if (item.tieEnd && this.lastSoundingPitch !== null) {
        // Tied note strictly maintains the pitch of the note it is tied from
        pitch = this.lastSoundingPitch;
      } else if (this.isFirstNoteOfSession || this.lastStep === null) {
        this.isFirstNoteOfSession = false;
        // Anchor clamped into the pool (treble with 0 ledger lines below starts on D4)
        const anchor = toStep(CLEF_PITCH_RANGES[clef].defaultAnchor);
        this.lastStep = Math.max(low, Math.min(high, anchor));
        pitch = toKey(this.lastStep);
      } else {
        pitch = this.sampleNextPitch(intervals, this.lastStep, low, high);
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
   * Markov random-walk step over the diatonic pool [low, high]. Only interval choices that
   * fit in at least one direction are drawn (weights renormalize over them), so every
   * in-range move keeps P > 0 and no interval is ever mislabeled by clamping. The walk is
   * symmetric: up and down are equally likely whenever both fit (ADR 0065).
   */
  private sampleNextPitch(
    intervals: IntervalOptions,
    lastStep: number,
    low: number,
    high: number
  ): string {
    const rangeLen = high - low + 1;
    const currentIdx = Math.max(0, Math.min(rangeLen - 1, lastStep - low));
    const upRoom = rangeLen - 1 - currentIdx;
    const downRoom = currentIdx;
    const commit = (idx: number): string => {
      this.lastStep = low + idx;
      return toKey(this.lastStep);
    };

    // Collect all allowed diatonic steps from user-selected toggle checkboxes
    type IntervalChoice = number | '9+';
    const candidateChoices: IntervalChoice[] = [];
    if (intervals.unison) candidateChoices.push(0);
    if (intervals.second) candidateChoices.push(1);
    if (intervals.third) candidateChoices.push(2);
    if (intervals.fourth) candidateChoices.push(3);
    if (intervals.fifth) candidateChoices.push(4);
    if (intervals.sixth) candidateChoices.push(5);
    if (intervals.seventh) candidateChoices.push(6);
    if (intervals.octave) candidateChoices.push(7);
    if (intervals.ninthPlus) candidateChoices.push('9+');

    // Fallback if all checkboxes are unchecked: default to seconds and thirds to avoid mono-interval exercises
    const selectedChoices = candidateChoices.length > 0 ? candidateChoices : [1, 2];

    // Feasibility: keep choices that fit in at least one direction from the current pitch.
    // With the default ±3 pool (23 notes) nothing is ever removed.
    const fits = (c: IntervalChoice): boolean =>
      c === '9+' ? Math.max(upRoom, downRoom) >= 8 : c <= upRoom || c <= downRoom;
    const activeChoices = selectedChoices.filter(fits);

    if (activeChoices.length === 0) {
      // Tiny pool + wide intervals only (e.g. octaves at 0/0 from mid-staff): move by the
      // largest step that fits, toward the side with more room
      this.consecutiveUnisons = 0;
      const direction = upRoom === downRoom ? pick([1, -1]) : upRoom > downRoom ? 1 : -1;
      return commit(currentIdx + direction * (direction === 1 ? upRoom : downRoom));
    }

    // Pick an interval step size from the active set. Unison is softly down-weighted
    // by 1 / (1 + run length) against weight 1 for every moving interval, so long
    // repeated-note runs grow rarer but never become impossible (P > 0).
    const weights = activeChoices.map((c) => (c === 0 ? 1 / (1 + this.consecutiveUnisons) : 1));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let r = Math.random() * totalWeight;
    let chosen: IntervalChoice = activeChoices[activeChoices.length - 1];
    for (let i = 0; i < activeChoices.length; i++) {
      r -= weights[i];
      if (r < 0) {
        chosen = activeChoices[i];
        break;
      }
    }

    if (chosen === 0) {
      this.consecutiveUnisons++;
      return commit(currentIdx);
    }

    this.consecutiveUnisons = 0;

    let chosenStep: number;
    let direction: number;

    if (chosen === '9+') {
      // Ninth and plus: every compound leap from a 9th (8 steps) up to the range edge
      const directions: number[] = [];
      if (upRoom >= 8) directions.push(1);
      if (downRoom >= 8) directions.push(-1);
      direction = pick(directions);
      const maxStep = direction === 1 ? upRoom : downRoom;
      chosenStep = 8 + Math.floor(Math.random() * (maxStep - 7));
    } else {
      chosenStep = chosen;
      const canGoUp = chosenStep <= upRoom;
      const canGoDown = chosenStep <= downRoom;

      if (canGoUp && canGoDown) {
        // Both directions fit: a fair coin. Feasibility alone keeps the walk in range, so
        // no inward bias is applied and the edge notes stay as reachable as the middle
        direction = Math.random() < 0.5 ? 1 : -1;
      } else if (canGoUp) {
        direction = 1;
      } else {
        direction = -1;
      }
    }

    return commit(currentIdx + direction * chosenStep);
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
          isRest: rests && Math.random() < SILENCE_PROBABILITY,
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
   * One tuplet group. Its n units are merged into members (each inner boundary
   * independently with TUPLET_MERGE_PROBABILITY), redrawn until every member is one enabled
   * notehead and there are at least two; members may then be silent, never all of them.
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

    let members: number[];
    do {
      members = [1];
      for (let i = 1; i < n; i++) {
        if (Math.random() < TUPLET_MERGE_PROBABILITY) members[members.length - 1]++;
        else members.push(1);
      }
    } while (members.length < 2 || members.some((m) => tupletMember(step.value, m, values) === null));

    let silent: boolean[];
    do {
      silent = members.map((m) => allowRests && TUPLET_REST_UNITS.has(m) && Math.random() < SILENCE_PROBABILITY);
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

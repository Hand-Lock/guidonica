import {
  AppSettings,
  Clef,
  ClefPitchConfig,
  IntervalOptions,
  METER,
  MeasureData,
  NoteData,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletOptions,
  computeBeatWidth,
  supportedTuplets,
} from './types';
import { TIE_PROBABILITY, applyTies, canTieAcrossBarline } from './ties';

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
  tupletBracketed?: boolean;
  tupletRatioed?: boolean;
  tieStart?: boolean;
  tieEnd?: boolean;
}

// Diatonic scales (C Major / A Minor baseline) per clef reaching 3 ledger lines outside staff both up and down.
// In every clef, the note pool spans 23 diatonic notes: from the space below the 3rd ledger line below,
// to the space above the 3rd ledger line above.
export const CLEF_PITCH_RANGES: Record<Clef, ClefPitchConfig> = {
  treble: {
    // Staff lines: E4 to F5.
    // 3 ledger lines below: F3 (space E3). 3 ledger lines above: E6 (space F6). Center line: B4.
    pitches: [
      'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5', 'g/5', 'a/5', 'b/5', 'c/6',
      'd/6', 'e/6', 'f/6',
    ],
    defaultAnchor: 'c/4',
    restPitch: 'b/4',
  },
  soprano: {
    // Staff lines: C4 to D5.
    // 3 ledger lines below: D3 (space C3). 3 ledger lines above: C6 (space D6). Center line: G4.
    pitches: [
      'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4',
      'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5', 'g/5', 'a/5',
      'b/5', 'c/6', 'd/6',
    ],
    defaultAnchor: 'c/4',
    restPitch: 'g/4',
  },
  'mezzo-soprano': {
    // Staff lines: A3 to B4.
    // 3 ledger lines below: B2 (space A2). 3 ledger lines above: A5 (space B5). Center line: E4.
    pitches: [
      'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4',
      'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5',
      'g/5', 'a/5', 'b/5',
    ],
    defaultAnchor: 'c/4',
    restPitch: 'e/4',
  },
  alto: {
    // Staff lines: F3 to G4.
    // 3 ledger lines below: G2 (space F2). 3 ledger lines above: F5 (space G5). Center line: C4.
    pitches: [
      'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3',
      'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'd/5',
      'e/5', 'f/5', 'g/5',
    ],
    defaultAnchor: 'c/4',
    restPitch: 'c/4',
  },
  tenor: {
    // Staff lines: D3 to E4.
    // 3 ledger lines below: E2 (space D2). 3 ledger lines above: D5 (space E5). Center line: A3.
    pitches: [
      'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3',
      'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4',
      'c/5', 'd/5', 'e/5',
    ],
    defaultAnchor: 'c/4',
    restPitch: 'a/3',
  },
  'baritone-f': {
    // Staff lines: B2 to C4.
    // 3 ledger lines below: C2 (space B1). 3 ledger lines above: B4 (space C5). Center line: F3.
    pitches: [
      'b/1', 'c/2', 'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3',
      'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5',
    ],
    defaultAnchor: 'c/3',
    restPitch: 'f/3',
  },
  'baritone-c': {
    // Staff lines: B2 to C4.
    // 3 ledger lines below: C2 (space B1). 3 ledger lines above: B4 (space C5). Center line: F3.
    pitches: [
      'b/1', 'c/2', 'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3',
      'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5',
    ],
    defaultAnchor: 'c/3',
    restPitch: 'f/3',
  },
  bass: {
    // Staff lines: G2 to A3.
    // 3 ledger lines below: A1 (space G1). 3 ledger lines above: G4 (space A4). Center line: D3.
    pitches: [
      'g/1', 'a/1', 'b/1', 'c/2', 'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2',
      'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4',
      'f/4', 'g/4', 'a/4',
    ],
    defaultAnchor: 'c/3',
    restPitch: 'd/3',
  },
};

/** Human-readable range label for the clef hint, derived from the pitch pool bounds. */
export const CLEF_RANGE_DISPLAY = Object.fromEntries(
  Object.entries(CLEF_PITCH_RANGES).map(([clef, { pitches }]) => {
    const label = (p: string): string => p.replace('/', '').toUpperCase();
    return [clef, `${label(pitches[0])} – ${label(pitches[pitches.length - 1])} (±3 ledger lines)`];
  })
) as Record<Clef, string>;

/** Last note of the previously generated measure, source of an incoming barline tie. */
interface MeasureTail {
  measureIndex: number;
  beatOffset: number;
  duration: string;
  beatWidth: number;
  width: number;
}

export class MusicGenerator {
  private lastPitchIndex: Map<Clef, number> = new Map();
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
    for (const clef of Object.keys(CLEF_PITCH_RANGES) as Clef[]) {
      const config = CLEF_PITCH_RANGES[clef];
      const anchorIdx = config.pitches.indexOf(config.defaultAnchor);
      this.lastPitchIndex.set(clef, anchorIdx >= 0 ? anchorIdx : Math.floor(config.pitches.length / 2));
    }
  }

  /**
   * Generates a procedurally composed measure satisfying metric linearity and rhythm/melody rules.
   * With ties on, the following measure's rhythm is composed as a lookahead so the barline
   * pair (last note here, first note there) can be tied with both notes known.
   */
  public generateMeasure(measureIndex: number, settings: AppSettings, startBeat: number): MeasureData {
    const { timeSignature, clef, subdivisions, tuplets, ties, intervals } = settings;
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
        pitch = CLEF_PITCH_RANGES[clef].restPitch;
      } else if (item.tieEnd && this.lastSoundingPitch !== null) {
        // Tied note strictly maintains the pitch of the note it is tied from
        pitch = this.lastSoundingPitch;
      } else if (this.isFirstNoteOfSession) {
        this.isFirstNoteOfSession = false;
        const config = CLEF_PITCH_RANGES[clef];
        pitch = config.defaultAnchor;
        const anchorIdx = config.pitches.indexOf(config.defaultAnchor);
        this.lastPitchIndex.set(clef, anchorIdx >= 0 ? anchorIdx : Math.floor(config.pitches.length / 2));
      } else {
        pitch = this.sampleNextPitch(clef, intervals);
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
        tupletBracketed: item.tupletBracketed,
        tupletRatioed: item.tupletRatioed,
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

  private sampleNextPitch(clef: Clef, intervals: IntervalOptions): string {
    const config = CLEF_PITCH_RANGES[clef];
    const range = config.pitches;
    const rangeLen = range.length;
    const currentIdx = this.lastPitchIndex.get(clef) ?? Math.floor(rangeLen / 2);

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
    const activeChoices = candidateChoices.length > 0 ? candidateChoices : [1, 2];

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
      return range[currentIdx];
    }

    this.consecutiveUnisons = 0;

    let chosenStep: number;
    let direction: number;

    if (chosen === '9+') {
      // Ninth and plus: every compound leap from a 9th (8 steps) up to the range edge
      const upRoom = rangeLen - 1 - currentIdx;
      const downRoom = currentIdx;
      const directions: number[] = [];
      if (upRoom >= 8) directions.push(1);
      if (downRoom >= 8) directions.push(-1);
      direction = directions.length > 0 ? pick(directions) : upRoom >= downRoom ? 1 : -1;

      const maxStep = direction === 1 ? upRoom : downRoom;
      chosenStep = maxStep >= 8 ? 8 + Math.floor(Math.random() * (maxStep - 7)) : maxStep;
    } else {
      chosenStep = chosen;
      const canGoUp = currentIdx + chosenStep < rangeLen;
      const canGoDown = currentIdx - chosenStep >= 0;

      if (canGoUp && canGoDown) {
        // Both directions fit within the 3-ledger-line clef range.
        // Apply boundary bias towards staff center when approaching range limits:
        const margin = 4;
        if (currentIdx >= rangeLen - margin) {
          // High register: 85% descend
          direction = Math.random() < 0.85 ? -1 : 1;
        } else if (currentIdx <= margin) {
          // Low register: 85% ascend
          direction = Math.random() < 0.85 ? 1 : -1;
        } else {
          // Middle staff register: 50/50
          direction = Math.random() < 0.5 ? 1 : -1;
        }
      } else if (canGoUp) {
        direction = 1;
      } else {
        direction = -1;
      }
    }

    const nextIdx = Math.max(0, Math.min(rangeLen - 1, currentIdx + direction * chosenStep));
    this.lastPitchIndex.set(clef, nextIdx);
    return range[nextIdx];
  }

  /**
   * Checks if any tuplet combination is active in settings.
   */
  private hasActiveTuplets(tuplets?: TupletOptions): boolean {
    if (!tuplets) return false;
    for (const name of TUPLET_NAMES) {
      for (const val of TUPLET_VALUES) {
        if (tuplets[name]?.[val]) return true;
      }
    }
    return false;
  }

  /**
   * Helper to generate an array of notes belonging to a single tuplet group.
   */
  private makeTupletItems(
    numNotes: number,
    notesOccupied: number,
    duration: string,
    totalBeatDuration: number,
    bracketed?: boolean,
    ratioed?: boolean
  ): PartitionItem[] {
    const tupletId = ++this.tupletCounter;
    const noteBeatDuration = totalBeatDuration / numNotes;
    const items: PartitionItem[] = [];

    for (let i = 0; i < numNotes; i++) {
      items.push({
        duration,
        beatDuration: noteBeatDuration,
        isRest: false,
        isTuplet: true,
        tupletGroup: tupletId,
        tupletNumNotes: numNotes,
        tupletNotesOccupied: notesOccupied,
        tupletBracketed: bracketed,
        tupletRatioed: ratioed,
      });
    }

    return items;
  }

  /**
   * Partitions the metric beats of a measure into rhythms strictly summing to beatsPerMeasure.
   * Employs an ergodic metric partition tree guaranteeing that every valid musical combination
   * of active settings has a non-zero probability of being generated, then applies the
   * within-measure tie grammar (ties.ts) when ties are on.
   */
  private composeRhythm(settings: AppSettings): PartitionItem[] {
    const { timeSignature: ts, subdivisions, tuplets, rests, ties } = settings;
    // Only cells meaningful in this meter participate (TUPLET_SUPPORT)
    const activeTuplets = tuplets && supportedTuplets(ts, tuplets);
    const items = this.partitionMeasure(ts, subdivisions, activeTuplets, rests);
    return ties ? applyTies(items, ts) : items;
  }

  private partitionMeasure(
    ts: TimeSignature,
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean
  ): PartitionItem[] {
    const hasAnySubdiv =
      subdiv.whole ||
      subdiv.half ||
      subdiv.quarter ||
      subdiv.eighth ||
      subdiv.sixteenth;
    const hasAnyTuplet = this.hasActiveTuplets(tuplets);

    // Fallback: if absolutely nothing is selected, default to quarter notes
    const effectiveSubdiv = !hasAnySubdiv && !hasAnyTuplet ? { ...subdiv, quarter: true } : subdiv;
    const isDotted = effectiveSubdiv.dotted !== false;

    if (ts === '6/8') {
      return this.partitionCompoundMeasure(effectiveSubdiv, tuplets, allowRests, isDotted);
    }

    if (ts === '3/4') {
      return this.partitionThreeFourMeasure(effectiveSubdiv, tuplets, allowRests, isDotted);
    }

    if (ts === '2/4') {
      return this.partitionTwoBeats(effectiveSubdiv, tuplets, allowRests, isDotted);
    }

    // 4/4 meter
    return this.partitionFourFourMeasure(effectiveSubdiv, tuplets, allowRests, isDotted);
  }

  /**
   * Compound 6/8 meter partitioning (6 eighth-note pulses total).
   */
  private partitionCompoundMeasure(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    // 1. Full-measure dotted half note (6 eighth-note beats)
    if (subdiv.half && isDotted && Math.random() < 0.18) {
      return [
        {
          duration: 'hd',
          beatDuration: 6,
          isRest: allowRests && Math.random() < 0.1,
        },
      ];
    }

    // 2. Full-measure duple tuplets: 2 or 4 quarters in the time of 3 (the whole bar)
    if (tuplets?.duplet['1/4'] && Math.random() < 0.3) {
      return this.makeTupletItems(2, 3, 'q', 6, true);
    }
    if (tuplets?.quadruplet['1/4'] && Math.random() < 0.3) {
      return this.makeTupletItems(4, 3, 'q', 6, true);
    }

    // 3. Two compound groups of 3 eighth-note beats each (beats 0..2 and beats 3..5)
    const result: PartitionItem[] = [];
    for (let group = 0; group < 2; group++) {
      const groupItems = this.partitionCompoundGroup(subdiv, tuplets, allowRests, isDotted);
      result.push(...groupItems);
    }
    return result;
  }

  /**
   * Partitions a single compound group (3 eighth-note beats) in 6/8 meter.
   * Generates qd, q+8, 8+q, 8+8+8, sixteenth permutations, and compound tuplets.
   */
  private partitionCompoundGroup(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    const candidates: Array<() => PartitionItem[]> = [];

    // Candidate 1: Dotted quarter note (qd = 3 eighths)
    // ONLY if quarter is active AND dotted is active
    if (subdiv.quarter && isDotted) {
      candidates.push(() => [
        {
          duration: 'qd',
          beatDuration: 3,
          isRest: allowRests && Math.random() < 0.15,
        },
      ]);
    }

    // Candidate 2: Quarter + Eighth (q + 8 = 2 + 1 eighths)
    if (subdiv.quarter && (subdiv.eighth || allowRests)) {
      candidates.push(() => {
        const rest1 = allowRests && Math.random() < 0.15;
        const rest2 = allowRests && (Math.random() < 0.15 || !subdiv.eighth);
        return [
          { duration: 'q', beatDuration: 2, isRest: rest1 },
          { duration: '8', beatDuration: 1, isRest: rest2 },
        ];
      });
    }

    // Candidate 3: Eighth + Quarter (8 + q = 1 + 2 eighths)
    if (subdiv.quarter && (subdiv.eighth || allowRests)) {
      candidates.push(() => {
        const rest1 = allowRests && (Math.random() < 0.15 || !subdiv.eighth);
        const rest2 = allowRests && Math.random() < 0.15;
        return [
          { duration: '8', beatDuration: 1, isRest: rest1 },
          { duration: 'q', beatDuration: 2, isRest: rest2 },
        ];
      });
    }

    // Candidate 4: Quarter + Two Sixteenths (q + 16 + 16 = 2 + 0.5 + 0.5 eighths)
    if (subdiv.quarter && subdiv.sixteenth) {
      candidates.push(() => {
        const rest1 = allowRests && Math.random() < 0.15;
        const rest2 = allowRests && Math.random() < 0.12;
        const rest3 = allowRests && Math.random() < 0.12;
        return [
          { duration: 'q', beatDuration: 2, isRest: rest1 },
          { duration: '16', beatDuration: 0.5, isRest: rest2 },
          { duration: '16', beatDuration: 0.5, isRest: rest3 },
        ];
      });
    }

    // Candidate 5: Two Sixteenths + Quarter (16 + 16 + q = 0.5 + 0.5 + 2 eighths)
    if (subdiv.quarter && subdiv.sixteenth) {
      candidates.push(() => {
        const rest1 = allowRests && Math.random() < 0.12;
        const rest2 = allowRests && Math.random() < 0.12;
        const rest3 = allowRests && Math.random() < 0.15;
        return [
          { duration: '16', beatDuration: 0.5, isRest: rest1 },
          { duration: '16', beatDuration: 0.5, isRest: rest2 },
          { duration: 'q', beatDuration: 2, isRest: rest3 },
        ];
      });
    }

    // Candidate 6: Eighth-level subdivisions (three eighth units: 1 + 1 + 1)
    if (subdiv.eighth || subdiv.sixteenth) {
      candidates.push(() => {
        const items: PartitionItem[] = [];
        let beat = 0;
        while (beat < 3) {
          if (tuplets?.triplet['1/16'] && Math.random() < 0.35) {
            items.push(...this.makeTupletItems(3, 2, '16', 1));
            beat++;
          } else if (subdiv.sixteenth && isDotted && beat <= 1 && Math.random() < 0.25) {
            // Dotted eighth + sixteenth (1.5 + 0.5 = 2 eighth beats)
            const r1 = allowRests && Math.random() < 0.12;
            const r2 = allowRests && Math.random() < 0.12;
            items.push(
              { duration: '8d', beatDuration: 1.5, isRest: r1 },
              { duration: '16', beatDuration: 0.5, isRest: r2 }
            );
            beat += 2;
          } else if (subdiv.sixteenth && (Math.random() < 0.45 || !subdiv.eighth)) {
            const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 2) : -1;
            items.push(
              { duration: '16', beatDuration: 0.5, isRest: restIdx === 0 },
              { duration: '16', beatDuration: 0.5, isRest: restIdx === 1 }
            );
            beat++;
          } else {
            const isRest = allowRests && Math.random() < 0.18;
            items.push({ duration: '8', beatDuration: 1, isRest });
            beat++;
          }
        }
        return items;
      });
    }

    // Candidate 7: Compound Tuplets (Duplet 1/8 = 2:3, Quadruplet 1/8 = 4:3)
    if (tuplets?.duplet['1/8']) {
      candidates.push(() => this.makeTupletItems(2, 3, '8', 3));
    }
    if (tuplets?.quadruplet['1/8']) {
      candidates.push(() => this.makeTupletItems(4, 3, '8', 3));
    }
    // Duple sixteenth tuplets on each dotted-eighth half of the group (1.5 eighths each):
    // duplet = 2 sixteenths in the time of 3, quadruplet = 4 sixteenths in the time of 3
    if (tuplets?.duplet['1/16']) {
      candidates.push(() => [
        ...this.makeTupletItems(2, 3, '16', 1.5),
        ...this.makeTupletItems(2, 3, '16', 1.5),
      ]);
    }
    if (tuplets?.quadruplet['1/16']) {
      candidates.push(() => [
        ...this.makeTupletItems(4, 3, '16', 1.5),
        ...this.makeTupletItems(4, 3, '16', 1.5),
      ]);
    }

    if (candidates.length === 0) {
      // Safe fallback: 3 eighth notes
      return [
        { duration: '8', beatDuration: 1, isRest: false },
        { duration: '8', beatDuration: 1, isRest: false },
        { duration: '8', beatDuration: 1, isRest: false },
      ];
    }

    const generator = candidates[Math.floor(Math.random() * candidates.length)];
    return generator();
  }

  /**
   * Partitions a single metric beat (1.0 quarter beat) in simple meters.
   */
  private partitionSingleBeat(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    const candidates: Array<() => PartitionItem[]> = [];

    // 1. Quarter note (1 beat)
    if (subdiv.quarter) {
      candidates.push(() => [
        {
          duration: 'q',
          beatDuration: 1,
          isRest: allowRests && Math.random() < 0.18,
        },
      ]);
    }

    // 2. Two eighth notes (0.5 + 0.5)
    if (subdiv.eighth) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.2 ? Math.floor(Math.random() * 2) : -1;
        return [
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 0 },
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 1 },
        ];
      });
    }

    // 3. Dotted eighth + sixteenth (0.75 + 0.25)
    if (subdiv.eighth && subdiv.sixteenth && isDotted) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 2) : -1;
        return [
          { duration: '8d', beatDuration: 0.75, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 1 },
        ];
      });
    }

    // 4. Sixteenth + dotted eighth (0.25 + 0.75) - Scotch snap
    if (subdiv.eighth && subdiv.sixteenth && isDotted) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 2) : -1;
        return [
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 0 },
          { duration: '8d', beatDuration: 0.75, isRest: restIdx === 1 },
        ];
      });
    }

    // 5. Four sixteenth notes (0.25 x 4)
    if (subdiv.sixteenth) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 4) : -1;
        return [
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 1 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 2 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 3 },
        ];
      });
    }

    // 6. Eighth + two sixteenths (0.5 + 0.25 + 0.25)
    if (subdiv.eighth && subdiv.sixteenth) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 3) : -1;
        return [
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 1 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 2 },
        ];
      });
    }

    // 7. Two sixteenths + eighth (0.25 + 0.25 + 0.5)
    if (subdiv.eighth && subdiv.sixteenth) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 3) : -1;
        return [
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 1 },
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 2 },
        ];
      });
    }

    // 8. Syncopated sixteenth + eighth + sixteenth (0.25 + 0.5 + 0.25)
    if (subdiv.eighth && subdiv.sixteenth) {
      candidates.push(() => {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 3) : -1;
        return [
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 0 },
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 1 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 2 },
        ];
      });
    }

    // 9. Single-beat tuplets
    if (tuplets?.triplet['1/8']) {
      candidates.push(() => this.makeTupletItems(3, 2, '8', 1));
    }
    if (tuplets?.quintuplet['1/16']) {
      candidates.push(() => this.makeTupletItems(5, 4, '16', 1));
    }
    if (tuplets?.sextuplet['1/16']) {
      candidates.push(() => this.makeTupletItems(6, 4, '16', 1));
    }
    if (tuplets?.septuplet['1/16']) {
      candidates.push(() => this.makeTupletItems(7, 4, '16', 1));
    }
    if (tuplets?.triplet['1/16']) {
      candidates.push(() => [
        ...this.makeTupletItems(3, 2, '16', 0.5),
        ...this.makeTupletItems(3, 2, '16', 0.5),
      ]);
    }

    if (candidates.length === 0) {
      return [{ duration: 'q', beatDuration: 1, isRest: false }];
    }

    const generator = candidates[Math.floor(Math.random() * candidates.length)];
    return generator();
  }

  /**
   * Partitions a 2-beat hyperbeat (2.0 quarter beats) in simple meters.
   */
  private partitionTwoBeats(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    const candidates: Array<() => PartitionItem[]> = [];

    // 1. Half note (2 beats)
    if (subdiv.half) {
      candidates.push(() => [
        {
          duration: 'h',
          beatDuration: 2,
          isRest: allowRests && Math.random() < 0.15,
        },
      ]);
    }

    // 2. Dotted quarter + eighth (1.5 + 0.5 beats)
    if (subdiv.quarter && subdiv.eighth && isDotted) {
      candidates.push(() => {
        const rest1 = allowRests && Math.random() < 0.15;
        const rest2 = allowRests && Math.random() < 0.15;
        return [
          { duration: 'qd', beatDuration: 1.5, isRest: rest1 },
          { duration: '8', beatDuration: 0.5, isRest: rest2 },
        ];
      });
    }

    // 3. Eighth + dotted quarter (0.5 + 1.5 beats) - Syncopated dotted quarter
    if (subdiv.quarter && subdiv.eighth && isDotted) {
      candidates.push(() => {
        const rest1 = allowRests && Math.random() < 0.15;
        const rest2 = allowRests && Math.random() < 0.15;
        return [
          { duration: '8', beatDuration: 0.5, isRest: rest1 },
          { duration: 'qd', beatDuration: 1.5, isRest: rest2 },
        ];
      });
    }

    // 4. Syncopation: eighth + quarter + eighth (0.5 + 1.0 + 0.5)
    if (subdiv.eighth && subdiv.quarter) {
      candidates.push(() => {
        const r1 = allowRests && Math.random() < 0.12;
        const r2 = allowRests && Math.random() < 0.12;
        const r3 = allowRests && Math.random() < 0.12;
        return [
          { duration: '8', beatDuration: 0.5, isRest: r1 },
          { duration: 'q', beatDuration: 1.0, isRest: r2 },
          { duration: '8', beatDuration: 0.5, isRest: r3 },
        ];
      });
    }

    // 5. 2-Beat Tuplets
    if (tuplets?.triplet['1/4']) {
      candidates.push(() => this.makeTupletItems(3, 2, 'q', 2, true));
    }
    if (tuplets?.quintuplet['1/8']) {
      candidates.push(() => this.makeTupletItems(5, 4, '8', 2));
    }
    if (tuplets?.sextuplet['1/8']) {
      candidates.push(() => this.makeTupletItems(6, 4, '8', 2));
    }
    if (tuplets?.septuplet['1/8']) {
      candidates.push(() => this.makeTupletItems(7, 4, '8', 2));
    }

    // 6. Two independent 1-beat slices (1 + 1)
    // Double-weighted so individual beat subdivisions participate actively
    candidates.push(() => [
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
    ]);
    candidates.push(() => [
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
    ]);

    const generator = candidates[Math.floor(Math.random() * candidates.length)];
    return generator();
  }

  /**
   * Partitions a 3/4 measure (3 quarter beats total).
   */
  private partitionThreeFourMeasure(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    // 1. Full measure dotted half note (3 beats) - ONLY if dotted is active and half/whole is active
    if ((subdiv.half || subdiv.whole) && isDotted && Math.random() < 0.25) {
      return [
        {
          duration: 'hd',
          beatDuration: 3,
          isRest: allowRests && Math.random() < 0.1,
        },
      ];
    }

    // 2. 3-beat tuplets
    if (tuplets?.quadruplet['1/4'] && Math.random() < 0.35) {
      return this.makeTupletItems(4, 3, 'q', 3, true);
    }
    if (tuplets?.duplet['1/4'] && Math.random() < 0.35) {
      return this.makeTupletItems(2, 3, 'q', 3, true);
    }
    if (tuplets?.quadruplet['1/8'] && Math.random() < 0.35) {
      return this.makeTupletItems(4, 6, '8', 3, false);
    }

    // 3. Sample uniformly between metric structures. All three are always offered:
    // partitionTwoBeats falls back to 1+1, so no configuration can dead-end, and 2-beat
    // figures (h, qd 8, 8 q 8, triplet ¼...) are reachable on either beat 1 or beat 2.
    // Structure A: 2 beats + 1 beat (e.g. h + q, qd+8 + q, etc.)
    // Structure B: 1 beat + 2 beats (e.g. q + h, q + 8 q 8, etc.)
    // Structure C: 1 beat + 1 beat + 1 beat
    const structure = pick(['2+1', '1+2', '1+1+1'] as const);

    if (structure === '2+1') {
      return [
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted),
        ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ];
    }

    if (structure === '1+2') {
      return [
        ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted),
      ];
    }

    return [
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
    ];
  }

  /**
   * Partitions a 4/4 measure (4 quarter beats total).
   */
  private partitionFourFourMeasure(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean
  ): PartitionItem[] {
    // 1. Full measure whole note (4 beats)
    if (subdiv.whole && Math.random() < 0.22) {
      return [
        {
          duration: 'w',
          beatDuration: 4,
          isRest: allowRests && Math.random() < 0.1,
        },
      ];
    }

    // 2. Full measure 4-beat tuplets
    if (tuplets?.quintuplet['1/4'] && Math.random() < 0.35) {
      return this.makeTupletItems(5, 4, 'q', 4, true);
    }
    if (tuplets?.sextuplet['1/4'] && Math.random() < 0.35) {
      return this.makeTupletItems(6, 4, 'q', 4, true);
    }
    if (tuplets?.septuplet['1/4'] && Math.random() < 0.35) {
      return this.makeTupletItems(7, 4, 'q', 4, true);
    }

    // 3. Dotted half note patterns (3 + 1 or 1 + 3) if dotted is active and half note is active.
    // The remaining single beat may be any single-beat figure, not only a quarter.
    if (subdiv.half && isDotted && Math.random() < 0.2) {
      const restHD = allowRests && Math.random() < 0.1;
      if (Math.random() < 0.5) {
        // hd + 1 beat (beats 0..3 + beat 3)
        return [
          { duration: 'hd', beatDuration: 3, isRest: restHD },
          ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
        ];
      } else {
        // 1 beat + hd (beat 0 + beats 1..4)
        return [
          ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
          { duration: 'hd', beatDuration: 3, isRest: restHD },
        ];
      }
    }

    // 4. Default 4/4 metric partition, chosen uniformly:
    //    2+2   : two 2-beat hyperbeats (beats 0..2 and 2..4)
    //    1+2+1 : Gould's tolerated syncopation [1 beat, h, 1 beat] (q h q). Every other
    //            figure straddling the middle of the bar (q qd 8, 8 q 8 on beats 2-3...)
    //            must show beat 3, so it is reached via 2+2 plus a middle tie (ties.ts).
    //            Without `half` the branch falls back to 2+2.
    if (!subdiv.half || Math.random() < 0.5) {
      return [
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted),
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted),
      ];
    }
    return [
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      { duration: 'h', beatDuration: 2, isRest: allowRests && Math.random() < 0.15 },
      ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
    ];
  }
}

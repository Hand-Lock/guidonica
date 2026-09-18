import {
  AppSettings,
  Clef,
  ClefPitchConfig,
  IntervalOptions,
  MeasureData,
  NoteData,
  SubdivisionOptions,
  TUPLET_NAMES,
  TUPLET_VALUES,
  TimeSignature,
  TupletOptions,
  computeBeatWidth,
} from './types';

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
    minPitch: 'e/3',
    maxPitch: 'f/6',
    defaultAnchor: 'c/4',
  },
  bass: {
    // Staff lines: G2 to A3.
    // 3 ledger lines below: A1 (space G1). 3 ledger lines above: G4 (space A4). Center line: D3.
    pitches: [
      'g/1', 'a/1', 'b/1', 'c/2', 'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2',
      'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4',
      'f/4', 'g/4', 'a/4',
    ],
    minPitch: 'g/1',
    maxPitch: 'a/4',
    defaultAnchor: 'c/3',
  },
  alto: {
    // Staff lines: F3 to G4.
    // 3 ledger lines below: G2 (space F2). 3 ledger lines above: F5 (space G5). Center line: C4.
    pitches: [
      'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3',
      'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4', 'c/5', 'd/5',
      'e/5', 'f/5', 'g/5',
    ],
    minPitch: 'f/2',
    maxPitch: 'g/5',
    defaultAnchor: 'c/4',
  },
  tenor: {
    // Staff lines: D3 to E4.
    // 3 ledger lines below: E2 (space D2). 3 ledger lines above: D5 (space E5). Center line: A3.
    pitches: [
      'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3',
      'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4', 'b/4',
      'c/5', 'd/5', 'e/5',
    ],
    minPitch: 'd/2',
    maxPitch: 'e/5',
    defaultAnchor: 'c/4',
  },
};

export class MusicGenerator {
  private lastPitchIndex: Map<Clef, number> = new Map();
  private tupletCounter: number = 0;
  private consecutiveUnisons: number = 0;
  private isFirstNoteOfSession: boolean = true;

  constructor() {
    this.resetPitch();
  }

  public resetPitch(): void {
    this.tupletCounter = 0;
    this.consecutiveUnisons = 0;
    this.isFirstNoteOfSession = true;
    for (const clef of ['treble', 'bass', 'alto', 'tenor'] as Clef[]) {
      const config = CLEF_PITCH_RANGES[clef];
      const anchorIdx = config.pitches.indexOf(config.defaultAnchor);
      this.lastPitchIndex.set(clef, anchorIdx >= 0 ? anchorIdx : Math.floor(config.pitches.length / 2));
    }
  }

  /**
   * Generates a procedurally composed measure satisfying metric linearity and rhythm/melody rules.
   */
  public generateMeasure(measureIndex: number, settings: AppSettings, startBeat: number): MeasureData {
    const { timeSignature, clef, subdivisions, tuplets, rests, ties, intervals } = settings;
    const { beatsPerMeasure, beatValue } = this.getMeterConfig(timeSignature);
    const beatWidth = computeBeatWidth(subdivisions, timeSignature, tuplets);
    const measureWidth = beatsPerMeasure * beatWidth;

    const rawRhythms = this.partitionRhythm(
      timeSignature,
      beatsPerMeasure,
      subdivisions,
      tuplets,
      rests,
      ties
    );
    const notes: NoteData[] = [];

    let currentOffset = 0;
    let prevPitch: string | null = null;
    for (const item of rawRhythms) {
      let pitch: string;
      if (item.isRest) {
        pitch = this.getRestDefaultPitch(clef);
      } else if (item.tieEnd && prevPitch !== null) {
        // Tied note strictly maintains the pitch of the note it is tied from
        pitch = prevPitch;
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
        prevPitch = pitch;
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

    return {
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
  }

  private getMeterConfig(ts: TimeSignature): { beatsPerMeasure: number; beatValue: number } {
    switch (ts) {
      case '2/4': return { beatsPerMeasure: 2, beatValue: 4 };
      case '3/4': return { beatsPerMeasure: 3, beatValue: 4 };
      case '4/4': return { beatsPerMeasure: 4, beatValue: 4 };
      case '6/8': return { beatsPerMeasure: 6, beatValue: 8 };
    }
  }

  private getRestDefaultPitch(clef: Clef): string {
    switch (clef) {
      case 'treble': return 'b/4';
      case 'bass': return 'd/3';
      case 'alto': return 'c/4';
      case 'tenor': return 'a/3';
    }
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

    // Pick an interval step size from the active set
    let chosen: IntervalChoice;
    if (activeChoices.includes(0) && this.consecutiveUnisons >= 2 && activeChoices.some((c) => c !== 0)) {
      // Avoid excessive repeated notes (> 2) when moving intervals are available
      const nonZeroChoices = activeChoices.filter((c) => c !== 0);
      chosen = nonZeroChoices[Math.floor(Math.random() * nonZeroChoices.length)];
    } else {
      chosen = activeChoices[Math.floor(Math.random() * activeChoices.length)];
    }

    if (chosen === 0) {
      this.consecutiveUnisons++;
      return range[currentIdx];
    }

    this.consecutiveUnisons = 0;

    let chosenStep: number;
    let direction: number;

    if (chosen === '9+') {
      // Ninth and plus: compound leaps (diatonic step >= 8)
      const canGoUp = currentIdx + 8 < rangeLen;
      const canGoDown = currentIdx - 8 >= 0;

      if (canGoUp && canGoDown) {
        const margin = 4;
        if (currentIdx >= rangeLen - margin) {
          direction = -1;
        } else if (currentIdx <= margin) {
          direction = 1;
        } else {
          direction = Math.random() < 0.5 ? 1 : -1;
        }
      } else if (canGoUp) {
        direction = 1;
      } else {
        direction = -1;
      }

      const maxStep = direction === 1 ? rangeLen - 1 - currentIdx : currentIdx;
      // Compound intervals: 9th (8 steps), 10th (9 steps), 11th (10 steps), 12th (11 steps)
      const compoundCandidates = [8, 9, 10, 11].filter((s) => s <= maxStep);
      chosenStep =
        compoundCandidates.length > 0
          ? compoundCandidates[Math.floor(Math.random() * compoundCandidates.length)]
          : 8;
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
   * of active settings has a non-zero probability of being generated.
   */
  private partitionRhythm(
    ts: TimeSignature,
    beatsPerMeasure: number,
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    allowTies: boolean = false
  ): PartitionItem[] {
    const hasAnySubdiv =
      subdiv.whole ||
      subdiv.half ||
      subdiv.quarter ||
      subdiv.eighth ||
      subdiv.sixteenth ||
      Boolean(subdiv.triplets);
    const hasAnyTuplet = this.hasActiveTuplets(tuplets);

    // Fallback: if absolutely nothing is selected, default to quarter notes
    const effectiveSubdiv = !hasAnySubdiv && !hasAnyTuplet ? { ...subdiv, quarter: true } : subdiv;
    const isDotted = effectiveSubdiv.dotted !== false;

    if (ts === '6/8') {
      return this.partitionCompoundMeasure(effectiveSubdiv, tuplets, allowRests, isDotted, allowTies);
    }

    if (ts === '3/4') {
      return this.partitionThreeFourMeasure(effectiveSubdiv, tuplets, allowRests, isDotted, allowTies);
    }

    if (ts === '2/4') {
      return this.partitionTwoBeats(effectiveSubdiv, tuplets, allowRests, isDotted, allowTies);
    }

    // 4/4 meter
    return this.partitionFourFourMeasure(effectiveSubdiv, tuplets, allowRests, isDotted, allowTies);
  }

  /**
   * Compound 6/8 meter partitioning (6 eighth-note pulses total).
   */
  private partitionCompoundMeasure(
    subdiv: SubdivisionOptions,
    tuplets: TupletOptions | undefined,
    allowRests: boolean,
    isDotted: boolean,
    allowTies: boolean
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

    // 2. Full-measure tied dotted quarters across compound groups (qd ~ qd)
    if (allowTies && subdiv.quarter && isDotted && Math.random() < 0.18) {
      return [
        { duration: 'qd', beatDuration: 3, isRest: false, tieStart: true },
        { duration: 'qd', beatDuration: 3, isRest: false, tieEnd: true },
      ];
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
    if (tuplets?.triplet['1/8'] || subdiv.triplets) {
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
    isDotted: boolean,
    allowTies: boolean
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

    // 5. Tied Quarters across beats (q ~ q)
    if (allowTies && subdiv.quarter) {
      candidates.push(() => [
        { duration: 'q', beatDuration: 1.0, isRest: false, tieStart: true },
        { duration: 'q', beatDuration: 1.0, isRest: false, tieEnd: true },
      ]);
    }

    // 6. 2-Beat Tuplets
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

    // 7. Two independent 1-beat slices (1 + 1)
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
    isDotted: boolean,
    allowTies: boolean
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

    // 3. Sample between metric structures:
    // Structure A: 2 beats + 1 beat (e.g. h + q, qd+8 + q, etc.)
    // Structure B: 1 beat + 2 beats (e.g. q + h, q + qd+8, etc.) - unblocks q + h!
    // Structure C: 1 beat + 1 beat + 1 beat
    const structureChoices: Array<'2+1' | '1+2' | '1+1+1'> = ['1+1+1'];
    if (subdiv.half || (subdiv.quarter && subdiv.eighth && isDotted)) {
      structureChoices.push('2+1');
      structureChoices.push('1+2');
    }

    const structure = structureChoices[Math.floor(Math.random() * structureChoices.length)];

    if (structure === '2+1') {
      return [
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted, allowTies),
        ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
      ];
    }

    if (structure === '1+2') {
      return [
        ...this.partitionSingleBeat(subdiv, tuplets, allowRests, isDotted),
        ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted, allowTies),
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
    isDotted: boolean,
    allowTies: boolean
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

    // 3. Dotted half note patterns (3 + 1 or 1 + 3) if dotted is active and half note is active
    if (subdiv.half && isDotted && subdiv.quarter && Math.random() < 0.2) {
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

    // 4. Default 4/4 metric partition: two 2-beat hyperbeats (beats 0..2 and beats 2..4)
    return [
      ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted, allowTies),
      ...this.partitionTwoBeats(subdiv, tuplets, allowRests, isDotted, allowTies),
    ];
  }
}

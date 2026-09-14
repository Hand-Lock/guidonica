import {
  AppSettings,
  Clef,
  ClefPitchConfig,
  IntervalOptions,
  MeasureData,
  NoteData,
  SubdivisionOptions,
  TimeSignature,
  computeBeatWidth,
} from './types';

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
    const { timeSignature, clef, subdivisions, rests, intervals } = settings;
    const { beatsPerMeasure, beatValue } = this.getMeterConfig(timeSignature);
    const beatWidth = computeBeatWidth(subdivisions, timeSignature);
    const measureWidth = beatsPerMeasure * beatWidth;

    const rawRhythms = this.partitionRhythm(timeSignature, beatsPerMeasure, subdivisions, rests);
    const notes: NoteData[] = [];

    let currentOffset = 0;
    for (const item of rawRhythms) {
      let pitch: string;
      if (item.isRest) {
        pitch = this.getRestDefaultPitch(clef);
      } else if (this.isFirstNoteOfSession) {
        this.isFirstNoteOfSession = false;
        const config = CLEF_PITCH_RANGES[clef];
        pitch = config.defaultAnchor;
        const anchorIdx = config.pitches.indexOf(config.defaultAnchor);
        this.lastPitchIndex.set(clef, anchorIdx >= 0 ? anchorIdx : Math.floor(config.pitches.length / 2));
      } else {
        pitch = this.sampleNextPitch(clef, intervals);
      }

      notes.push({
        keys: [pitch],
        duration: item.duration,
        isRest: item.isRest,
        isTuplet: item.isTuplet,
        tupletGroup: item.tupletGroup,
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
   * Partitions the metric beats of a measure into rhythms strictly summing to beatsPerMeasure.
   */
  private partitionRhythm(
    ts: TimeSignature,
    beatsPerMeasure: number,
    subdiv: SubdivisionOptions,
    allowRests: boolean
  ): Array<{ duration: string; beatDuration: number; isRest: boolean; isTuplet?: boolean; tupletGroup?: number }> {
    const result: Array<{ duration: string; beatDuration: number; isRest: boolean; isTuplet?: boolean; tupletGroup?: number }> = [];

    // Fallback if all checkboxes are unchecked: default to quarter notes
    const hasAnySubdiv = subdiv.whole || subdiv.half || subdiv.quarter || subdiv.eighth || subdiv.sixteenth || subdiv.triplets;
    const effectiveSubdiv = hasAnySubdiv ? subdiv : { ...subdiv, quarter: true };

    if (ts === '6/8') {
      // 6/8 compound meter: 6 eighth-note beats grouped into 2 dotted-quarter groups (beats 0-2 and beats 3-5)
      for (let group = 0; group < 2; group++) {
        const groupRhythms = this.partitionCompoundGroup(effectiveSubdiv, allowRests);
        result.push(...groupRhythms);
      }
      return result;
    }

    // Standard simple meters (4/4, 3/4, 2/4)
    let remainingBeats = beatsPerMeasure;
    let currentBeatIndex = 0;

    // Check if whole note is allowed and can fit
    if (effectiveSubdiv.whole && remainingBeats >= 4 && currentBeatIndex === 0 && Math.random() < 0.25) {
      result.push({
        duration: 'w',
        beatDuration: 4,
        isRest: allowRests && Math.random() < 0.1,
      });
      return result;
    }

    // In 3/4 meter, allow dotted half note (3 beats) filling the full measure
    if (ts === '3/4' && (effectiveSubdiv.half || effectiveSubdiv.whole) && currentBeatIndex === 0 && Math.random() < 0.3) {
      result.push({
        duration: 'hd',
        beatDuration: 3,
        isRest: allowRests && Math.random() < 0.1,
      });
      return result;
    }

    while (remainingBeats > 0) {
      // Check if half note is allowed and aligns with metric boundaries (e.g., beats 0 or 2 in 4/4)
      const canDoHalf = effectiveSubdiv.half && remainingBeats >= 2 && (currentBeatIndex % 2 === 0);
      if (canDoHalf && Math.random() < 0.35) {
        result.push({
          duration: 'h',
          beatDuration: 2,
          isRest: allowRests && Math.random() < 0.15,
        });
        remainingBeats -= 2;
        currentBeatIndex += 2;
        continue;
      }

      // Fill a single metric beat (1 quarter beat)
      const beatItems = this.partitionSingleBeat(effectiveSubdiv, allowRests);
      result.push(...beatItems);
      remainingBeats -= 1;
      currentBeatIndex += 1;
    }

    return result;
  }

  private partitionSingleBeat(
    subdiv: SubdivisionOptions,
    allowRests: boolean
  ): Array<{ duration: string; beatDuration: number; isRest: boolean; isTuplet?: boolean; tupletGroup?: number }> {
    const candidates: Array<'quarter' | 'eighth' | 'sixteenth' | 'triplet'> = [];
    if (subdiv.quarter) candidates.push('quarter');
    if (subdiv.eighth) candidates.push('eighth');
    if (subdiv.sixteenth) candidates.push('sixteenth');
    if (subdiv.triplets) candidates.push('triplet');

    if (candidates.length === 0) {
      candidates.push('quarter');
    }

    const choice = candidates[Math.floor(Math.random() * candidates.length)];

    switch (choice) {
      case 'quarter':
        return [
          {
            duration: 'q',
            beatDuration: 1,
            isRest: allowRests && Math.random() < 0.18,
          },
        ];
      case 'eighth': {
        const restIdx = allowRests && Math.random() < 0.2 ? Math.floor(Math.random() * 2) : -1;
        return [
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 0 },
          { duration: '8', beatDuration: 0.5, isRest: restIdx === 1 },
        ];
      }
      case 'sixteenth': {
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 4) : -1;
        return [
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 1 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 2 },
          { duration: '16', beatDuration: 0.25, isRest: restIdx === 3 },
        ];
      }
      case 'triplet': {
        const tupletId = ++this.tupletCounter;
        // Sight reading triplets typically do not include rests
        return [
          { duration: '8', beatDuration: 1 / 3, isRest: false, isTuplet: true, tupletGroup: tupletId },
          { duration: '8', beatDuration: 1 / 3, isRest: false, isTuplet: true, tupletGroup: tupletId },
          { duration: '8', beatDuration: 1 / 3, isRest: false, isTuplet: true, tupletGroup: tupletId },
        ];
      }
    }
  }

  private partitionCompoundGroup(
    subdiv: SubdivisionOptions,
    allowRests: boolean
  ): Array<{ duration: string; beatDuration: number; isRest: boolean; isTuplet?: boolean; tupletGroup?: number }> {
    // A compound group in 6/8 is 3 eighth-note beats (total 3 beats in our eighth-based beat count)
    // Options: 3 eighth notes, or 1 dotted quarter note (takes all 3 eighths)
    const canDoDottedQuarter = subdiv.quarter && Math.random() < 0.35;
    if (canDoDottedQuarter) {
      // In 6/8, a dotted quarter has duration 'qd' or 'q' with dot
      // In our beatDuration where 1 beat = 1 eighth, dotted quarter is 3 beats
      return [
        {
          duration: 'qd',
          beatDuration: 3,
          isRest: allowRests && Math.random() < 0.15,
        },
      ];
    }

    // 3 eighth notes (with potential sixteenth-note subdivisions)
    const result: Array<{ duration: string; beatDuration: number; isRest: boolean; isTuplet?: boolean; tupletGroup?: number }> = [];
    for (let beat = 0; beat < 3; beat++) {
      if (subdiv.sixteenth && Math.random() < 0.4) {
        // Two 16th notes fill 1 eighth-note beat
        const restIdx = allowRests && Math.random() < 0.15 ? Math.floor(Math.random() * 2) : -1;
        result.push(
          { duration: '16', beatDuration: 0.5, isRest: restIdx === 0 },
          { duration: '16', beatDuration: 0.5, isRest: restIdx === 1 }
        );
      } else {
        const isRest = allowRests && Math.random() < 0.2;
        result.push({ duration: '8', beatDuration: 1, isRest });
      }
    }
    return result;
  }
}

import {
  AppSettings,
  Clef,
  MeasureData,
  NoteData,
  SubdivisionOptions,
  TimeSignature,
  BEAT_WIDTH,
} from './types';

// Diatonic scales (C Major / A Minor baseline) per clef (standard staff lines +/- 2 ledger lines)
const CLEF_PITCH_RANGES: Record<Clef, { pitches: string[]; defaultAnchor: string }> = {
  treble: {
    // Range: A3 (2 ledger lines below) to C6 (2 ledger lines above). Center line B4.
    pitches: [
      'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4',
      'a/4', 'b/4', 'c/5', 'd/5', 'e/5', 'f/5', 'g/5',
      'a/5', 'b/5', 'c/6',
    ],
    defaultAnchor: 'c/4',
  },
  bass: {
    // Range: C2 (2 ledger lines below) to E4 (2 ledger lines above). Center line D3.
    pitches: [
      'c/2', 'd/2', 'e/2', 'f/2', 'g/2', 'a/2', 'b/2',
      'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3', 'b/3',
      'c/4', 'd/4', 'e/4',
    ],
    defaultAnchor: 'c/3',
  },
  alto: {
    // Range: B2 to D5. Center line C4.
    pitches: [
      'b/2', 'c/3', 'd/3', 'e/3', 'f/3', 'g/3', 'a/3',
      'b/3', 'c/4', 'd/4', 'e/4', 'f/4', 'g/4', 'a/4',
      'b/4', 'c/5', 'd/5',
    ],
    defaultAnchor: 'c/4',
  },
  tenor: {
    // Range: G2 to B4. Center line A3.
    pitches: [
      'g/2', 'a/2', 'b/2', 'c/3', 'd/3', 'e/3', 'f/3',
      'g/3', 'a/3', 'b/3', 'c/4', 'd/4', 'e/4', 'f/4',
      'g/4', 'a/4', 'b/4',
    ],
    defaultAnchor: 'c/3',
  },
};

export class MusicGenerator {
  private lastPitchIndex: Map<Clef, number> = new Map();
  private tupletCounter: number = 0;

  constructor() {
    this.resetPitch();
  }

  public resetPitch(): void {
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
    const measureWidth = beatsPerMeasure * BEAT_WIDTH;

    const rawRhythms = this.partitionRhythm(timeSignature, beatsPerMeasure, subdivisions, rests);
    const notes: NoteData[] = [];

    let currentOffset = 0;
    for (const item of rawRhythms) {
      const pitch = item.isRest ? this.getRestDefaultPitch(clef) : this.sampleNextPitch(clef, intervals);

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

  private sampleNextPitch(clef: Clef, intervals: AppSettings['intervals']): string {
    const range = CLEF_PITCH_RANGES[clef].pitches;
    const rangeLen = range.length;
    let currentIdx = this.lastPitchIndex.get(clef) ?? Math.floor(rangeLen / 2);

    // Determine allowed step sizes
    let stepSize: number;
    switch (intervals) {
      case 'seconds':
        stepSize = 1;
        break;
      case 'thirds':
        stepSize = Math.random() < 0.5 ? 1 : 2;
        break;
      case 'octaves': {
        const rand = Math.random();
        if (rand < 0.4) stepSize = 1;
        else if (rand < 0.7) stepSize = 2;
        else if (rand < 0.85) stepSize = 4; // Fifth
        else stepSize = 7; // Octave
        break;
      }
      case 'any': {
        const steps = [1, 2, 3, 4, 5, 6, 7];
        stepSize = steps[Math.floor(Math.random() * steps.length)];
        break;
      }
    }

    // Boundary bias: if close to top or bottom, strongly bias inward
    let direction: number;
    const margin = 3;
    if (currentIdx >= rangeLen - margin) {
      // Near top: 85% descend
      direction = Math.random() < 0.85 ? -1 : 1;
    } else if (currentIdx <= margin) {
      // Near bottom: 85% ascend
      direction = Math.random() < 0.85 ? 1 : -1;
    } else {
      direction = Math.random() < 0.5 ? 1 : -1;
    }

    let nextIdx = currentIdx + direction * stepSize;

    // Hard clamp to range
    if (nextIdx >= rangeLen) {
      nextIdx = rangeLen - 1 - (nextIdx - rangeLen);
    }
    if (nextIdx < 0) {
      nextIdx = Math.abs(nextIdx);
    }
    nextIdx = Math.max(0, Math.min(rangeLen - 1, nextIdx));

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

    // 3 eighth notes
    const restIdx = allowRests && Math.random() < 0.2 ? Math.floor(Math.random() * 3) : -1;
    return [
      { duration: '8', beatDuration: 1, isRest: restIdx === 0 },
      { duration: '8', beatDuration: 1, isRest: restIdx === 1 },
      { duration: '8', beatDuration: 1, isRest: restIdx === 2 },
    ];
  }
}

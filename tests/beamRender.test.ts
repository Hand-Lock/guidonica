import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';
import { Beam } from 'vexflow/core';
import { MeasureRenderer } from '../src/notation/renderer';
import { MeasureData, NOTE_START_OFFSET, NoteData } from '../src/notation/types';

describe('Sixteenth pairs beside unbeamable notes keep their beam (ADR 0064)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  let beamDraw: MockInstance<Beam['draw']>;

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      const noop = (): void => {};
      return new Proxy(
        {
          canvas: this,
          getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
          measureText: () => ({ width: 10 }),
          createLinearGradient: () => ({ addColorStop: noop }),
          getLineDash: () => [],
        } as Record<string | symbol, unknown>,
        { get: (target, key) => (key in target ? target[key] : noop), set: () => true }
      ) as unknown as CanvasRenderingContext2D;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    beamDraw = vi.spyOn(Beam.prototype, 'draw');
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  /** A 4/4 bar built from `durations` laid end to end. */
  function measure(durations: [string, number][]): MeasureData {
    let offset = 0;
    const notes: NoteData[] = durations.map(([duration, beats]) => {
      const note: NoteData = { keys: ['b/4'], duration, isRest: false, beatOffset: offset, beatDuration: beats };
      offset += beats;
      return note;
    });
    return {
      index: 0,
      notes,
      clef: 'treble',
      timeSignature: '4/4',
      beatsPerMeasure: 4,
      beatValue: 4,
      beatWidth: 120,
      width: NOTE_START_OFFSET + 4 * 120,
      startBeat: 0,
    };
  }

  it('beams 16 16 before a qd, after it, and before a q', () => {
    // 16 16 qd | 16 16 q 16 16: three beamed pairs
    new MeasureRenderer().renderMeasure(
      measure([
        ['16', 0.25], ['16', 0.25], ['qd', 1.5],
        ['16', 0.25], ['16', 0.25], ['q', 1], ['16', 0.25], ['16', 0.25],
      ]),
      'light'
    );
    const beamed = (beamDraw.mock.contexts as Beam[]).map((beam) => beam.getNotes().map((n) => n.getDuration()));
    expect(beamed).toEqual([['16', '16'], ['16', '16'], ['16', '16']]);
  });
});

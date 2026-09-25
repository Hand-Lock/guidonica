import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StaveNote, StaveTie } from 'vexflow';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer, tieAnchorRightX } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { AppSettings, MeasureData, NOTE_START_OFFSET, TimeSignature } from '../src/notation/types';

const SIMPLE_BEATS: Record<string, number> = {
  w: 4, hd: 3, h: 2, qd: 1.5, q: 1, '8d': 0.75, '8': 0.5, '16': 0.25,
};

function measure(notes: MeasureData['notes'], extra: Partial<MeasureData> = {}): MeasureData {
  return {
    index: 0,
    notes,
    clef: 'treble',
    timeSignature: '4/4',
    beatsPerMeasure: 4,
    beatValue: 4,
    beatWidth: 110,
    width: 440,
    startBeat: 0,
    ...extra,
  };
}

describe('Cross-barline tie rendering', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

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
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  it('renders generated measures with incoming and outgoing ties in every meter', () => {
    const renderer = new MeasureRenderer();
    for (const ts of ['4/4', '3/4', '2/4', '6/8'] as TimeSignature[]) {
      const settings: AppSettings = {
        ...structuredClone(DEFAULT_APP_SETTINGS),
        timeSignature: ts,
        subdivisions: { whole: true, half: true, quarter: true, eighth: true, sixteenth: true, dotted: true },
        ties: true,
      };
      const generator = new MusicGenerator();
      let incoming = 0;
      for (let m = 0; m < 200; m++) {
        const data = generator.generateMeasure(m, settings, m * 6);
        if (data.tieIn) incoming++;
        expect(renderer.renderMeasure(data, 'light', 'solfege').width).toBeGreaterThan(0);
      }
      expect(incoming).toBeGreaterThan(0);
    }
  });

  it('both halves of a barline tie meet the notes exactly (seamless join)', () => {
    const renderer = new MeasureRenderer();
    const calls: Array<{ note: StaveNote | undefined; firstX: number; lastX: number }> = [];
    const original = StaveTie.prototype.renderTie;
    vi.spyOn(StaveTie.prototype, 'renderTie').mockImplementation(function (
      this: StaveTie,
      params: Parameters<StaveTie['renderTie']>[0]
    ) {
      calls.push({ note: this.getNotes().firstNote as StaveNote | undefined, firstX: params.firstX, lastX: params.lastX });
      original.call(this, params);
    });

    for (const duration of Object.keys(SIMPLE_BEATS)) {
      const beatOffset = 4 - SIMPLE_BEATS[duration];
      const keys = ['g/4'];
      const out = measure([{ keys, duration, isRest: false, tieStart: true, beatOffset, beatDuration: SIMPLE_BEATS[duration] }]);
      calls.length = 0;
      renderer.renderMeasure(out, 'light', 'none');
      expect(calls).toHaveLength(1);
      const outNote = calls[0].note;
      expect(outNote).toBeDefined();
      if (!outNote) continue;
      expect(calls[0].firstX).toBeCloseTo(outNote.getTieRightX(), 9);
      expect(calls[0].firstX).toBeCloseTo(tieAnchorRightX(beatOffset, duration, 110), 9);
      const outLastX = calls[0].lastX;

      const incoming = measure(
        [{ keys, duration: 'q', isRest: false, tieEnd: true, beatOffset: 0, beatDuration: 1 }, { keys, duration: 'hd', isRest: false, beatOffset: 1, beatDuration: 3 }],
        { tieIn: { beatOffset, duration, beatWidth: 110, measureWidth: 440 } }
      );
      calls.length = 0;
      renderer.renderMeasure(incoming, 'light', 'none');
      expect(calls).toHaveLength(1);
      const inNote = calls[0].note;
      if (!inNote) continue;
      // Same curve, shifted by one measure width
      expect(calls[0].firstX).toBeCloseTo(outNote.getTieRightX() - 440, 9);
      expect(calls[0].lastX).toBeCloseTo(inNote.getTieLeftX(), 9);
      expect(outLastX - 440).toBeCloseTo(calls[0].lastX, 9);
      expect(inNote.getTieLeftX()).toBeCloseTo(NOTE_START_OFFSET, 9);
    }
  });
});

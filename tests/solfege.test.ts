import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Stem, StaveNote } from 'vexflow';
import {
  ITALIAN_SOLFEGE_SYLLABLES,
  MEASURE_CANVAS_HEIGHT,
  NOTE_LETTER_NAMES,
  SOLFEGE_SYLLABLES,
  STAVE_TOP_LINE_Y,
} from '../src/notation/types';
import { CLEF_PITCH_RANGES } from '../src/notation/generator';
import { MeasureRenderer, SOLFEGE_LABEL_OFFSET, solfegeLabelAnchor } from '../src/notation/renderer';
import type { MeasureData } from '../src/notation/types';

describe('Solfège and Note Label Geometry', () => {
  it('maps all 7 natural diatonic pitches to correct Anglo-American Solfège syllables (with Ti)', () => {
    expect(SOLFEGE_SYLLABLES['c']).toBe('Do');
    expect(SOLFEGE_SYLLABLES['d']).toBe('Re');
    expect(SOLFEGE_SYLLABLES['e']).toBe('Mi');
    expect(SOLFEGE_SYLLABLES['f']).toBe('Fa');
    expect(SOLFEGE_SYLLABLES['g']).toBe('Sol');
    expect(SOLFEGE_SYLLABLES['a']).toBe('La');
    expect(SOLFEGE_SYLLABLES['b']).toBe('Ti');
  });

  it('maps all 7 natural diatonic pitches to correct Italian Solfège syllables (with Si instead of Ti)', () => {
    expect(ITALIAN_SOLFEGE_SYLLABLES['c']).toBe('Do');
    expect(ITALIAN_SOLFEGE_SYLLABLES['d']).toBe('Re');
    expect(ITALIAN_SOLFEGE_SYLLABLES['e']).toBe('Mi');
    expect(ITALIAN_SOLFEGE_SYLLABLES['f']).toBe('Fa');
    expect(ITALIAN_SOLFEGE_SYLLABLES['g']).toBe('Sol');
    expect(ITALIAN_SOLFEGE_SYLLABLES['a']).toBe('La');
    expect(ITALIAN_SOLFEGE_SYLLABLES['b']).toBe('Si');
  });

  it('maps all 7 natural diatonic pitches to correct uppercase Letter names', () => {
    expect(NOTE_LETTER_NAMES['c']).toBe('C');
    expect(NOTE_LETTER_NAMES['d']).toBe('D');
    expect(NOTE_LETTER_NAMES['e']).toBe('E');
    expect(NOTE_LETTER_NAMES['f']).toBe('F');
    expect(NOTE_LETTER_NAMES['g']).toBe('G');
    expect(NOTE_LETTER_NAMES['a']).toBe('A');
    expect(NOTE_LETTER_NAMES['b']).toBe('B');
  });

  it('ensures MEASURE_CANVAS_HEIGHT is 220px to prevent clipping', () => {
    expect(MEASURE_CANVAS_HEIGHT).toBe(220);
    expect(STAVE_TOP_LINE_Y).toBe(80);
    // Staff lines span from Y=80 to Y=120
    const staveBottomLineY = STAVE_TOP_LINE_Y + 40;
    expect(staveBottomLineY).toBe(120);
    // Clearance below bottom stave line must be at least 80px
    expect(MEASURE_CANVAS_HEIGHT - staveBottomLineY).toBeGreaterThanOrEqual(80);
  });

  it('anchors labels on the notehead center, opposite the stem, at a fixed offset', () => {
    const up = solfegeLabelAnchor(100, 112, 110, Stem.UP);
    expect(up.x).toBe(106);
    expect(up.y).toBe(110 + SOLFEGE_LABEL_OFFSET);
    const down = solfegeLabelAnchor(100, 112, 90, Stem.DOWN);
    expect(down.x).toBe(106);
    expect(down.y).toBe(90 - SOLFEGE_LABEL_OFFSET);
  });

  it('verifies all pitches across all clefs have valid Solfège and Italian Solfège mappings', () => {
    const clefs = [
      'treble',
      'soprano',
      'mezzo-soprano',
      'alto',
      'tenor',
      'baritone-f',
      'baritone-c',
      'bass',
    ] as const;
    for (const clef of clefs) {
      const pitchList = CLEF_PITCH_RANGES[clef].pitches;
      expect(pitchList.length).toBeGreaterThan(0);
      for (const pitch of pitchList) {
        const letter = pitch.split('/')[0].toLowerCase();
        expect(SOLFEGE_SYLLABLES[letter]).toBeDefined();
        expect(ITALIAN_SOLFEGE_SYLLABLES[letter]).toBeDefined();
        expect(NOTE_LETTER_NAMES[letter]).toBeDefined();
      }
    }
  });
});

type Matrix = [number, number, number, number, number, number];

/** 2D context stub that tracks the transform so draws can be mapped to device pixels. */
function trackingContext(canvas: HTMLCanvasElement, onText: (text: string, x: number, y: number, m: Matrix) => void) {
  let m: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const noop = (): void => {};
  const target: Record<string | symbol, unknown> = {
    canvas,
    get current(): Matrix {
      return m;
    },
    getTransform: () => ({ a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }),
    setTransform: (a: number | DOMMatrix2DInit, b = 0, c = 0, d = 1, e = 0, f = 0) => {
      m = typeof a === 'number' ? [a, b, c, d, e, f] : [a.a ?? 1, a.b ?? 0, a.c ?? 0, a.d ?? 1, a.e ?? 0, a.f ?? 0];
    },
    scale: (sx: number, sy: number) => {
      m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]];
    },
    translate: (tx: number, ty: number) => {
      m = [m[0], m[1], m[2], m[3], m[0] * tx + m[2] * ty + m[4], m[1] * tx + m[3] * ty + m[5]];
    },
    save: () => stack.push(m),
    restore: () => {
      m = stack.pop() ?? m;
    },
    fillText: (text: string, x: number, y: number) => onText(text, x, y, m),
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    getLineDash: () => [],
  };
  return new Proxy(target, {
    get: (t, key) => (key in t ? t[key] : noop),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D & { current: Matrix };
}

describe('Solfège labels at devicePixelRatio 2 (drift regression)', () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const labels: Array<{ text: string; deviceX: number; deviceY: number }> = [];
  const heads: Array<{ deviceCenterX: number; deviceY: number }> = [];

  beforeEach(() => {
    labels.length = 0;
    heads.length = 0;
    vi.stubGlobal('devicePixelRatio', 2);
    const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D & { current: Matrix }>();
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string) {
      if (contextId !== '2d') return null;
      let ctx = contexts.get(this);
      if (!ctx) {
        ctx = trackingContext(this, (text, x, y, mat) => {
          if (/^[A-Za-z]+$/.test(text)) {
            labels.push({ text, deviceX: mat[0] * x + mat[2] * y + mat[4], deviceY: mat[1] * x + mat[3] * y + mat[5] });
          }
        });
        contexts.set(this, ctx);
      }
      return ctx;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const originalDrawHeads = StaveNote.prototype.drawNoteHeads;
    vi.spyOn(StaveNote.prototype, 'drawNoteHeads').mockImplementation(function (this: StaveNote) {
      // VexFlow measures text on scratch canvases, so read the note's own context
      const ctx2D = (this.checkContext() as unknown as { context2D?: { current?: Matrix } }).context2D;
      const mat = ctx2D?.current;
      if (mat && !this.isRest()) {
        const cx = (this.getNoteHeadBeginX() + this.getNoteHeadEndX()) / 2;
        const y = this.getYs()[0];
        heads.push({ deviceCenterX: mat[0] * cx + mat[2] * y + mat[4], deviceY: mat[1] * cx + mat[3] * y + mat[5] });
      }
      originalDrawHeads.call(this);
    });
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('centers every label on its notehead in device pixels at increasing beat offsets', () => {
    const renderer = new MeasureRenderer();
    renderer.setDpr(2);
    const keys = ['c/4', 'e/4', 'g/4', 'b/4', 'd/5', 'f/5', 'a/5', 'c/6'];
    const data: MeasureData = {
      index: 0,
      notes: keys.map((k, i) => ({ keys: [k], duration: '8', isRest: false, beatOffset: i * 0.5, beatDuration: 0.5 })),
      clef: 'treble',
      timeSignature: '4/4',
      beatsPerMeasure: 4,
      beatValue: 4,
      beatWidth: 110,
      width: 440,
      startBeat: 0,
    };
    renderer.renderMeasure(data, 'light', 'letters');

    expect(labels.map((l) => l.text)).toEqual(['C', 'E', 'G', 'B', 'D', 'F', 'A', 'C']);
    expect(heads).toHaveLength(keys.length);
    // Device scale of VexFlow's drawing (its resize dpr × our dpr·zoom)
    const scale = Math.abs(heads[1].deviceCenterX - heads[0].deviceCenterX) / 55;
    for (let i = 0; i < keys.length; i++) {
      expect(labels[i].deviceX).toBeCloseTo(heads[i].deviceCenterX, 6);
      expect(Math.abs(labels[i].deviceY - heads[i].deviceY)).toBeGreaterThanOrEqual(SOLFEGE_LABEL_OFFSET * scale - 1e-6);
    }
  });
});

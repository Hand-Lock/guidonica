import { describe, it, expect, vi } from 'vitest';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { AppSettings, MeasureData, RenderedMeasure, computeBeatWidth, getBeatsPerMeasure } from '../src/notation/types';
import { beatX, noteSpace } from '../src/notation/spacing';
import { mulberry32 } from '../src/notation/random';
import en from '../src/i18n/locales/en';
import { noteLabels } from '../src/i18n';

vi.mock('../src/notation/fonts', () => ({ isMusicFontReady: () => true }));

describe('MeasureBuffer.rerender', () => {
  it('re-rasterizes kept measures without touching the generator', () => {
    const generator = new MusicGenerator();
    const renderMeasure = vi.fn(
      (data: MeasureData): RenderedMeasure => ({
        data,
        canvas: document.createElement('canvas'),
        width: data.width,
        height: 1,
      })
    );
    const renderer = { renderMeasure } as unknown as MeasureRenderer;
    const buffer = new MeasureBuffer(generator, renderer, noteLabels);
    const settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);

    buffer.ensureAhead(0, 12, settings);
    const before = buffer.getMeasures().map((m) => m.data);
    expect(before.length).toBeGreaterThan(0);

    const generateSpy = vi.spyOn(generator, 'generateMeasure');
    const resetSpy = vi.spyOn(generator, 'resetPitch');
    renderMeasure.mockClear();

    buffer.rerender({ ...settings, theme: 'dark', solfegeLabelMode: 'letters', labelsAfterPlaying: true });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
    expect(renderMeasure).toHaveBeenCalledTimes(before.length);
    for (const call of renderMeasure.mock.calls) {
      expect((call as unknown[]).slice(1)).toEqual(['dark', en.noteNames.letters, true]);
    }
    // Same MeasureData objects: the music under the playhead is unchanged
    expect(buffer.getMeasures().map((m) => m.data)).toEqual(before);
    buffer.getMeasures().forEach((m, i) => expect(m.data).toBe(before[i]));
  });
});

describe('MeasureBuffer label layers (ADR 0112)', () => {
  it('releases a bar\'s label canvas with its note canvas on eviction', () => {
    const layers: HTMLCanvasElement[] = [];
    const renderMeasure = vi.fn((data: MeasureData): RenderedMeasure => {
      const layer = document.createElement('canvas');
      layer.width = 40;
      layer.height = 20;
      layers.push(layer);
      return { data, canvas: document.createElement('canvas'), width: data.width, height: 1, labelLayer: { canvas: layer, labels: [] } };
    });
    const buffer = new MeasureBuffer(new MusicGenerator(), { renderMeasure } as unknown as MeasureRenderer, noteLabels);
    const settings: AppSettings = { ...structuredClone(DEFAULT_APP_SETTINGS), solfegeLabelMode: 'syllables', labelsAfterPlaying: true };
    const beats = getBeatsPerMeasure(settings.timeSignature);
    buffer.ensureAhead(0, 3 * beats, settings);
    expect((renderMeasure.mock.calls[0] as unknown[])[3]).toBe(true);
    const first = layers[0];
    buffer.evictBefore(beats + 0.5);
    expect(first.width).toBe(0);
    expect(first.height).toBe(0);
    expect(layers[1].width).toBe(40);
    buffer.reset();
    for (const layer of layers) expect(layer.width).toBe(0);
  });
});

describe('MeasureBuffer.ensureAhead measure limit (ADR 0091)', () => {
  const makeBuffer = () => {
    const renderMeasure = vi.fn(
      (data: MeasureData): RenderedMeasure => ({
        data,
        canvas: document.createElement('canvas'),
        width: data.width,
        height: 1,
      })
    );
    const buffer = new MeasureBuffer(new MusicGenerator(), { renderMeasure } as unknown as MeasureRenderer, () => null);
    return { buffer, renderMeasure };
  };
  const settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
  const beats = getBeatsPerMeasure(settings.timeSignature);

  it('renders at most maxMeasures per call and reports the shortfall', () => {
    const { buffer, renderMeasure } = makeBuffer();
    expect(buffer.ensureAhead(0, 4 * beats, settings, 1)).toBe(true);
    expect(renderMeasure).toHaveBeenCalledTimes(1);
    expect(buffer.getEndBeat()).toBe(beats);
  });

  it('fills the whole lookahead by default', () => {
    const { buffer, renderMeasure } = makeBuffer();
    expect(buffer.ensureAhead(0, 4 * beats, settings)).toBe(false);
    expect(renderMeasure).toHaveBeenCalledTimes(4);
    expect(buffer.getEndBeat()).toBe(4 * beats);
  });
});

describe('MeasureBuffer views (ADR 0109)', () => {
  const makeBuffer = (seed = 7) => {
    const renderMeasure = vi.fn(
      (data: MeasureData): RenderedMeasure => ({
        data,
        canvas: document.createElement('canvas'),
        width: data.width,
        height: 1,
      })
    );
    const generator = new MusicGenerator(mulberry32(seed));
    const buffer = new MeasureBuffer(generator, { renderMeasure } as unknown as MeasureRenderer, () => null);
    return { buffer, generator, renderMeasure };
  };
  const busy = (view: AppSettings['view']): AppSettings => {
    const s: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);
    s.subdivisions.sixteenth = true;
    s.tuplets.triplet['1/8'] = true;
    s.view = view;
    return s;
  };
  const linear = (s: AppSettings) => computeBeatWidth(s.subdivisions, s.timeSignature, s.tuplets);

  it('generates the same music in either view, in the generator order', () => {
    const steady = makeBuffer();
    const squishy = makeBuffer();
    steady.buffer.ensureAhead(0, 24, busy('steady'));
    squishy.buffer.ensureAhead(0, 24, busy('squishy'));
    const direct = new MusicGenerator(mulberry32(7));
    const s = busy('steady');
    const beats = getBeatsPerMeasure(s.timeSignature);
    const a = steady.buffer.getMeasures();
    const b = squishy.buffer.getMeasures();
    const n = Math.min(a.length, b.length);
    expect(n).toBeGreaterThan(3);
    for (let i = 0; i < n; i++) {
      const expected = direct.generateMeasure(i, s, i * beats).notes;
      expect(a[i].data.notes).toEqual(expected);
      expect(b[i].data.notes).toEqual(expected);
    }
  });

  it('lays steady bars out linearly and squishy bars no wider, agreeing on each barline slope', () => {
    const steady = makeBuffer();
    const s = busy('steady');
    steady.buffer.ensureAhead(0, 24, s);
    for (const m of steady.buffer.getMeasures()) {
      expect(m.data.beatWidth).toBe(linear(s));
      expect(m.data.width).toBe(m.data.beatsPerMeasure * linear(s));
      expect(m.data.knots).toBeUndefined();
    }

    const squishy = makeBuffer();
    const q = busy('squishy');
    squishy.buffer.ensureAhead(0, 48, q);
    const bars = squishy.buffer.getMeasures().map((m) => m.data);
    const widths = new Set(bars.map((d) => d.width));
    expect(widths.size).toBeGreaterThan(1);
    bars.forEach((d, i) => {
      expect(d.width).toBeLessThanOrEqual(d.beatsPerMeasure * linear(q) + 1e-9);
      if (i > 0) {
        const prev = bars[i - 1];
        // Each barline joins at one speed: both bars compute the same slope there
        expect(prev.knots?.slopes[prev.notes.length]).toBe(d.knots?.slopes[0]);
      }
    });
  });

  it('covers the lookahead in tape pixels, never more than a linear tape needs', () => {
    const { buffer } = makeBuffer();
    const q = busy('squishy');
    expect(buffer.covers(0, 12, q)).toBe(false);
    expect(buffer.ensureAhead(0, 12, q)).toBe(false);
    expect(buffer.covers(0, 12, q)).toBe(true);
    const ahead = buffer.getMeasures().reduce((sum, m) => sum + m.data.width, 0);
    expect(ahead).toBeGreaterThanOrEqual(12 * linear(q));
    // Squishy beats are never wider, so the beats covered are at least the linear ones
    expect(buffer.getEndBeat()).toBeGreaterThanOrEqual(12);
  });

  it('re-lays the kept bars out on a view switch, keeping their notes', () => {
    const { buffer, generator, renderMeasure } = makeBuffer();
    const s = busy('steady');
    buffer.ensureAhead(0, 24, s);
    const notes = buffer.getMeasures().map((m) => m.data.notes);
    const widths = buffer.getMeasures().map((m) => m.data.width);
    const generateSpy = vi.spyOn(generator, 'generateMeasure');
    renderMeasure.mockClear();

    buffer.rerender(busy('squishy'));
    expect(generateSpy).not.toHaveBeenCalled();
    expect(renderMeasure).toHaveBeenCalledTimes(notes.length);
    buffer.getMeasures().forEach((m, i) => expect(m.data.notes).toBe(notes[i]));
    expect(buffer.getMeasures().map((m) => m.data.width)).not.toEqual(widths);

    buffer.rerender(s);
    expect(buffer.getMeasures().map((m) => m.data.width)).toEqual(widths);
  });

  it('drops the pending bar on reset, so the next bar is bar 0 again', () => {
    const { buffer } = makeBuffer();
    const q = busy('squishy');
    buffer.ensureAhead(0, 12, q);
    buffer.reset();
    expect(buffer.getMeasures()).toHaveLength(0);
    buffer.ensureAhead(0, 4, q, 1);
    expect(buffer.getMeasures()[0].data.index).toBe(0);
    expect(buffer.getMeasures()[0].data.startBeat).toBe(0);
    // No laid-out predecessor: the first bar's entry slope is its first note's own secant
    const first = buffer.getMeasures()[0].data;
    const n = first.notes[0];
    expect(first.knots?.slopes[0]).toBeCloseTo(noteSpace(n.beatDuration, q, q.timeSignature) / n.beatDuration, 12);
  });

  it('evicts bars whose right edge has left the stage, by pixels', () => {
    const { buffer } = makeBuffer();
    const q = busy('squishy');
    buffer.ensureAhead(0, 48, q);
    const bars = buffer.getMeasures().map((m) => m.data);
    const third = bars[2];
    // Playhead one beat into the third bar, and less room behind it than that beat's x
    const beat = third.startBeat + 1;
    const behind = beatX(third, 1);
    buffer.evictLeftOf(beat, behind - 1);
    expect(buffer.getMeasures()[0].data.index).toBe(third.index);
    buffer.evictLeftOf(beat, 1e9);
    expect(buffer.getMeasures()[0].data.index).toBe(third.index);
  });
});

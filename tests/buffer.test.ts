import { describe, it, expect, vi } from 'vitest';
import { MeasureBuffer } from '../src/scroller/buffer';
import { MusicGenerator } from '../src/notation/generator';
import { MeasureRenderer } from '../src/notation/renderer';
import { DEFAULT_APP_SETTINGS } from '../src/storage';
import { AppSettings, MeasureData, RenderedMeasure } from '../src/notation/types';

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
    const buffer = new MeasureBuffer(generator, renderer);
    const settings: AppSettings = structuredClone(DEFAULT_APP_SETTINGS);

    buffer.ensureAhead(0, 12, settings);
    const before = buffer.getMeasures().map((m) => m.data);
    expect(before.length).toBeGreaterThan(0);

    const generateSpy = vi.spyOn(generator, 'generateMeasure');
    const resetSpy = vi.spyOn(generator, 'resetPitch');
    renderMeasure.mockClear();

    buffer.rerender({ ...settings, theme: 'dark', solfegeLabelMode: 'letters' });

    expect(generateSpy).not.toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();
    expect(renderMeasure).toHaveBeenCalledTimes(before.length);
    for (const call of renderMeasure.mock.calls) {
      expect((call as unknown[]).slice(1)).toEqual(['dark', 'letters']);
    }
    // Same MeasureData objects: the music under the playhead is unchanged
    expect(buffer.getMeasures().map((m) => m.data)).toEqual(before);
    buffer.getMeasures().forEach((m, i) => expect(m.data).toBe(before[i]));
  });
});

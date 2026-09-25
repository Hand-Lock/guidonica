import { AppSettings, RenderedMeasure, getBeatsPerMeasure } from '../notation/types';
import { MusicGenerator } from '../notation/generator';
import { MeasureRenderer } from '../notation/renderer';
import { isMusicFontReady } from '../notation/fonts';

export class MeasureBuffer {
  private measures: RenderedMeasure[] = [];
  private nextMeasureIndex: number = 0;
  private nextMeasureStartBeat: number = 0;

  private generator: MusicGenerator;
  private renderer: MeasureRenderer;

  constructor(generator: MusicGenerator, renderer: MeasureRenderer) {
    this.generator = generator;
    this.renderer = renderer;
  }

  public getMeasures(): readonly RenderedMeasure[] {
    return this.measures;
  }

  /**
   * Resets the ring buffer and musical generator state.
   */
  public reset(): void {
    // Drop canvas references for GC
    for (const m of this.measures) {
      m.canvas.width = 0;
      m.canvas.height = 0;
    }
    this.measures = [];
    this.nextMeasureIndex = 0;
    this.nextMeasureStartBeat = 0;
    this.generator.resetPitch();
  }

  /**
   * Re-rasterizes the kept measures with the renderer's current zoom/DPR and the
   * given visual settings (theme, solfège). The musical content (MeasureData) and
   * the generator state are untouched, so the notes under the playhead never change.
   */
  public rerender(settings: AppSettings): void {
    if (!isMusicFontReady()) {
      return;
    }
    this.measures = this.measures.map((m) => {
      m.canvas.width = 0;
      m.canvas.height = 0;
      return this.renderer.renderMeasure(m.data, settings.theme, settings.solfegeLabelMode);
    });
  }

  /**
   * Ensures measures are rendered far enough ahead of the viewport playhead.
   * Includes background-tab catch-up protection to avoid large loops.
   */
  public ensureAhead(
    currentGlobalBeat: number,
    lookaheadBeats: number,
    settings: AppSettings
  ): void {
    // Avoid rendering measures with blank fallback glyphs if music fonts are still decoding
    if (!isMusicFontReady()) {
      return;
    }

    // If the browser tab was throttled in the background and currentGlobalBeat jumped ahead,
    // skip rendering offscreen measures that would be immediately discarded.
    const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);

    if (this.nextMeasureStartBeat < currentGlobalBeat - 2) {
      const skippedMeasures = Math.floor(
        (currentGlobalBeat - 2 - this.nextMeasureStartBeat) / beatsPerMeasure
      );
      if (skippedMeasures > 0) {
        this.nextMeasureIndex += skippedMeasures;
        this.nextMeasureStartBeat += skippedMeasures * beatsPerMeasure;
      }
    }

    const targetBeat = currentGlobalBeat + lookaheadBeats;

    while (this.nextMeasureStartBeat < targetBeat) {
      const measureData = this.generator.generateMeasure(
        this.nextMeasureIndex,
        settings,
        this.nextMeasureStartBeat
      );

      const rendered = this.renderer.renderMeasure(
        measureData,
        settings.theme,
        settings.solfegeLabelMode
      );
      this.measures.push(rendered);

      this.nextMeasureIndex++;
      this.nextMeasureStartBeat += measureData.beatsPerMeasure;
    }
  }

  /**
   * Evicts measures that have completely scrolled offscreen to the left.
   * Prevents memory leaks and maintains constant heap size in infinite scrolling.
   */
  public evictBefore(minVisibleGlobalBeat: number): void {
    let removeCount = 0;

    for (let i = 0; i < this.measures.length; i++) {
      const m = this.measures[i];
      const measureEndBeat = m.data.startBeat + m.data.beatsPerMeasure;
      if (measureEndBeat < minVisibleGlobalBeat) {
        removeCount++;
        // Clear canvas dimensions to release backing store
        m.canvas.width = 0;
        m.canvas.height = 0;
      } else {
        break;
      }
    }

    if (removeCount > 0) {
      this.measures.splice(0, removeCount);
    }
  }
}

import { AppSettings, RenderedMeasure } from '../notation/types';
import { MusicGenerator } from '../notation/generator';
import { MeasureRenderer } from '../notation/renderer';

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
   * Ensures measures are rendered far enough ahead of the viewport playhead.
   */
  public ensureAhead(
    currentGlobalBeat: number,
    lookaheadBeats: number,
    settings: AppSettings,
    dpr: number = window.devicePixelRatio || 1
  ): void {
    const targetBeat = currentGlobalBeat + lookaheadBeats;

    while (this.nextMeasureStartBeat < targetBeat) {
      const measureData = this.generator.generateMeasure(
        this.nextMeasureIndex,
        settings,
        this.nextMeasureStartBeat
      );

      const rendered = this.renderer.renderMeasure(measureData, dpr);
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

  /**
   * Returns measures that intersect the visible viewport beat range.
   */
  public getVisibleMeasures(startBeat: number, endBeat: number): RenderedMeasure[] {
    return this.measures.filter((m) => {
      const mStart = m.data.startBeat;
      const mEnd = mStart + m.data.beatsPerMeasure;
      return mEnd >= startBeat && mStart <= endBeat;
    });
  }
}

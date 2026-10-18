import {
  AppSettings,
  MeasureData,
  NOTE_START_OFFSET,
  NoteNames,
  RenderedMeasure,
  SolfegeLabelMode,
  ViewMode,
  computeBeatWidth,
  getBeatsPerMeasure,
} from '../notation/types';
import { beatX, spaceMeasure } from '../notation/spacing';
import { MusicGenerator } from '../notation/generator';
import { MeasureRenderer } from '../notation/renderer';
import { isMusicFontReady } from '../notation/fonts';

/**
 * The note-name table for a label mode, indexed c d e f g a b, or null for no labels.
 * The app resolves it from the UI language; an embedder passes its own (ADR 0104).
 */
export type LabelResolver = (mode: SolfegeLabelMode) => readonly string[] | null;

/** A fixed-language resolver over a locale's `noteNames`, e.g. `labelResolver(it.noteNames)`. */
export function labelResolver(names: NoteNames): LabelResolver {
  return (mode) => (mode === 'none' ? null : mode === 'syllables' ? names.syllables : names.letters);
}

export class MeasureBuffer {
  private measures: RenderedMeasure[] = [];
  private nextMeasureIndex: number = 0;
  private nextMeasureStartBeat: number = 0;
  /**
   * The next bar to render, generated one bar early: a bar's squishy exit ramp depends on
   * the bar after it (ADR 0109). The generator is still called once per bar, in order.
   */
  private pending: MeasureData | null = null;
  /** The last bar laid out, the entry side of the next one. */
  private lastLaidOut: MeasureData | null = null;
  /** The view the kept measures are laid out for. */
  private view: ViewMode = 'steady';

  private generator: MusicGenerator;
  private renderer: MeasureRenderer;
  private labels: LabelResolver;

  constructor(generator: MusicGenerator, renderer: MeasureRenderer, labels: LabelResolver) {
    this.generator = generator;
    this.renderer = renderer;
    this.labels = labels;
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
    this.pending = null;
    this.lastLaidOut = null;
    this.generator.resetPitch();
  }

  /**
   * Re-rasterizes the kept measures with the renderer's current zoom/DPR and the
   * given visual settings (theme, solfège). The musical content (the notes) and the
   * generator state are untouched, so the notes under the playhead never change. A new
   * view lays the kept bars out again first; the first kept bar has no laid-out
   * predecessor, so it gets no entry ramp and its incoming tie keeps the old spacing
   * until it scrolls off (ADR 0109).
   */
  public rerender(settings: AppSettings): void {
    if (!isMusicFontReady()) {
      return;
    }
    const view = settings.view ?? 'steady';
    if (view !== this.view) {
      this.view = view;
      let prev: MeasureData | null = null;
      for (let i = 0; i < this.measures.length; i++) {
        const next = i + 1 < this.measures.length ? this.measures[i + 1].data : this.pending;
        prev = spaceMeasure(this.measures[i].data, prev, next, view, settings);
        this.measures[i] = { ...this.measures[i], data: prev };
      }
      if (prev) this.lastLaidOut = prev;
    }
    this.measures = this.measures.map((m) => {
      m.canvas.width = 0;
      m.canvas.height = 0;
      return this.renderer.renderMeasure(m.data, settings.theme, this.labels(settings.solfegeLabelMode));
    });
  }

  /** Global beat where the next measure to render would start: the buffer covers up to here. */
  public getEndBeat(): number {
    return this.nextMeasureStartBeat;
  }

  /**
   * Tape pixels (measure units) from `beat` to the end of the rendered measures; negative
   * when the buffer ends before `beat`, counted at `linearBeatWidth` per missing beat.
   */
  private pixelsAhead(beat: number, linearBeatWidth: number): number {
    const measures = this.measures;
    let ahead = 0;
    for (let i = measures.length - 1; i >= 0; i--) {
      const data = measures[i].data;
      if (data.startBeat <= beat) {
        if (beat >= data.startBeat + data.beatsPerMeasure && i === measures.length - 1) break;
        return ahead + data.width - (beatX(data, data.timeSignature, beat - data.startBeat) - NOTE_START_OFFSET);
      }
      ahead += data.width;
    }
    if (measures.length > 0 && beat < measures[0].data.startBeat) {
      return ahead + (measures[0].data.startBeat - beat) * linearBeatWidth;
    }
    return (this.nextMeasureStartBeat - beat) * linearBeatWidth;
  }

  /**
   * Whether the rendered measures reach `lookaheadBeats` past `beat`. The lookahead is
   * measured in tape pixels at the session's linear beat width: a squishy beat is never
   * wider, so the stage stays covered in either view (ADR 0109).
   */
  public covers(beat: number, lookaheadBeats: number, settings: AppSettings): boolean {
    const linear = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
    return this.pixelsAhead(beat, linear) >= lookaheadBeats * linear;
  }

  /**
   * Ensures measures are rendered far enough ahead of the viewport playhead, at most
   * `maxMeasures` of them per call so idle-time callers can spread VexFlow work across
   * frames (ADR 0091). Includes background-tab catch-up protection to avoid large loops.
   * Returns true while the buffer still falls short of the target.
   */
  public ensureAhead(
    currentGlobalBeat: number,
    lookaheadBeats: number,
    settings: AppSettings,
    maxMeasures: number = Infinity
  ): boolean {
    // Avoid rendering measures with blank fallback glyphs if music fonts are still decoding
    if (!isMusicFontReady()) {
      return false;
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
        this.pending = null;
        this.lastLaidOut = null;
      }
    }

    // A view switch the caller has not re-rendered for: lay the kept bars out for it first
    const view = settings.view ?? 'steady';
    if (view !== this.view) this.rerender(settings);
    const linear = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
    const target = lookaheadBeats * linear;

    for (let count = 0; count < maxMeasures && this.pixelsAhead(currentGlobalBeat, linear) < target; count++) {
      const measureData =
        this.pending ?? this.generator.generateMeasure(this.nextMeasureIndex, settings, this.nextMeasureStartBeat);
      this.pending = this.generator.generateMeasure(
        this.nextMeasureIndex + 1,
        settings,
        this.nextMeasureStartBeat + measureData.beatsPerMeasure
      );
      const laidOut = spaceMeasure(measureData, this.lastLaidOut, this.pending, view, settings);
      this.lastLaidOut = laidOut;

      const rendered = this.renderer.renderMeasure(
        laidOut,
        settings.theme,
        this.labels(settings.solfegeLabelMode)
      );
      this.measures.push(rendered);

      this.nextMeasureIndex++;
      this.nextMeasureStartBeat += measureData.beatsPerMeasure;
    }
    return this.pixelsAhead(currentGlobalBeat, linear) < target;
  }

  /**
   * Evicts measures lying wholly more than `pixelsBehind` tape pixels (measure units) left
   * of `beat`: the scroller passes playheadX / zoom, so a bar goes as soon as its right edge
   * leaves the stage, in either view (ADR 0109). Bars before a gap in the tape (a skipped
   * background stretch) go too.
   */
  public evictLeftOf(beat: number, pixelsBehind: number): void {
    const measures = this.measures;
    let k = measures.length - 1;
    while (k > 0 && measures[k].data.startBeat > beat) k--;
    if (k <= 0) return;
    const anchor = measures[k].data;
    // Distance from `beat` back to the right edge of measures[i - 1]
    let behind = beatX(anchor, anchor.timeSignature, beat - anchor.startBeat);
    let keep = k;
    while (keep > 0 && behind <= pixelsBehind) {
      const prev = measures[keep - 1].data;
      if (prev.startBeat + prev.beatsPerMeasure !== measures[keep].data.startBeat) break;
      behind += prev.width;
      keep--;
    }
    this.evictFirst(keep);
  }

  /**
   * Evicts measures that have completely scrolled offscreen to the left, by beat. Kept for
   * embedders; the scroller evicts by pixels with evictLeftOf.
   * Prevents memory leaks and maintains constant heap size in infinite scrolling.
   */
  public evictBefore(minVisibleGlobalBeat: number): void {
    let removeCount = 0;
    for (const m of this.measures) {
      if (m.data.startBeat + m.data.beatsPerMeasure >= minVisibleGlobalBeat) break;
      removeCount++;
    }
    this.evictFirst(removeCount);
  }

  private evictFirst(count: number): void {
    for (let i = 0; i < count; i++) {
      // Clear canvas dimensions to release backing store
      const m = this.measures[i];
      m.canvas.width = 0;
      m.canvas.height = 0;
    }
    if (count > 0) {
      this.measures.splice(0, count);
    }
  }
}

import {
  AppSettings,
  MeasureData,
  NOTE_START_OFFSET,
  NoteNames,
  RenderedMeasure,
  SolfegeLabelMode,
  ViewMode,
  canvasTheme,
  computeBeatWidth,
  getBeatsPerMeasure,
} from '../notation/types';
import { beatX, spaceMeasure } from '../notation/spacing';
import { MusicGenerator } from '../notation/generator';
import { MeasureRenderer } from '../notation/renderer';
import { isMusicFontReady } from '../notation/fonts';
import { PageSystem, closeLine, findSystem, fitsLine, lineAvailable, lineDistance } from './page';

/** A closed page line whose justified bars are still being rendered, one per call. */
interface QueuedLine {
  bars: MeasureData[];
  system: PageSystem;
}

/**
 * The note-name table for a label mode, indexed c d e f g a b, or null for no labels.
 * The app resolves it from the UI language; an embedder passes its own (ADR 0104).
 */
export type LabelResolver = (mode: SolfegeLabelMode) => readonly string[] | null;

/** A fixed-language resolver over a locale's `noteNames`, e.g. `labelResolver(it.noteNames)`. */
export function labelResolver(names: NoteNames): LabelResolver {
  return (mode) => (mode === 'none' ? null : mode === 'syllables' ? names.syllables : names.letters);
}

/** Clears a bar's canvases' dimensions to release their backing stores for GC. */
function release(m: RenderedMeasure): void {
  m.canvas.width = 0;
  m.canvas.height = 0;
  if (m.labelLayer) {
    m.labelLayer.canvas.width = 0;
    m.labelLayer.canvas.height = 0;
  }
}

/** Ink of a bar whose renderer reports none: the staff alone. */
const STAFF_INK_TOP = 80;
const STAFF_INK_BOTTOM = 120;

export class MeasureBuffer {
  private measures: RenderedMeasure[] = [];
  private nextMeasureIndex: number = 0;
  private nextMeasureStartBeat: number = 0;
  /**
   * The next bar to render, generated one bar early: a bar's squishy exit slope depends on
   * the bar after it (ADR 0109). The generator is still called once per bar, in order.
   */
  private pending: MeasureData | null = null;
  /** The last bar laid out, the entry side of the next one. */
  private lastLaidOut: MeasureData | null = null;
  /** The view the kept measures are laid out for. */
  private view: ViewMode = 'steady';

  // Page view (ADR 0110): `measures` holds the rendered bars of the complete lines in
  // `systems`, in order; a closed line's bars wait in `queued` until each is rendered, and
  // the bars after them, laid out at their natural width, wait in `open` for their line.
  private systems: PageSystem[] = [];
  private queued: QueuedLine | null = null;
  private open: MeasureData[] = [];
  /** Page width in measure units, set by the scroller; lines break to fit it. */
  private pageWidth = 0;
  /** Whether the kept lines were broken for another page width. */
  private pageDirty = false;

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

  /** The complete page lines, aligned with getMeasures() (ADR 0110). Empty in the tape views. */
  public getSystems(): readonly PageSystem[] {
    return this.systems;
  }

  /**
   * Sets the page width (measure units) lines break to. A change re-breaks the kept bars on
   * the next ensureRows; sub-unit changes are ignored.
   */
  public setPageWidth(width: number): void {
    if (Math.abs(width - this.pageWidth) <= 0.5) return;
    this.pageWidth = width;
    this.pageDirty = true;
  }

  /**
   * Resets the ring buffer and musical generator state.
   */
  public reset(): void {
    // Drop canvas references for GC
    for (const m of this.measures) release(m);
    this.measures = [];
    this.nextMeasureIndex = 0;
    this.nextMeasureStartBeat = 0;
    this.pending = null;
    this.lastLaidOut = null;
    this.clearPage();
    this.generator.resetPitch();
  }

  private clearPage(): void {
    this.systems = [];
    this.queued = null;
    this.open = [];
  }

  /**
   * Re-rasterizes the kept measures with the renderer's current zoom/DPR and the
   * given visual settings (theme, solfège). The musical content (the notes) and the
   * generator state are untouched, so the notes under the playhead never change. A new
   * view lays the kept bars out again first; the first kept bar has no laid-out
   * predecessor, so its entry slope is one-sided and its incoming tie keeps the old spacing
   * until it scrolls off (ADR 0109).
   */
  public rerender(settings: AppSettings): void {
    if (!isMusicFontReady()) {
      return;
    }
    const view = settings.view ?? 'steady';
    if (view === 'page') {
      this.relayoutPage(settings);
      return;
    }
    if (this.view === 'page') {
      // Back to the tape: every generated bar, rendered or not, joins it in order
      const bars = this.pageBars();
      this.releaseAll();
      this.view = view;
      let prev: MeasureData | null = null;
      for (let i = 0; i < bars.length; i++) {
        prev = spaceMeasure(bars[i], prev, i + 1 < bars.length ? bars[i + 1] : this.pending, view, settings);
        this.measures.push(this.render(prev, settings));
      }
      if (prev) this.lastLaidOut = prev;
      return;
    }
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
      release(m);
      return this.render(m.data, settings);
    });
  }

  /** Rasterizes a laid-out bar with the settings' theme and labels (ADR 0112). */
  private render(data: MeasureData, settings: AppSettings): RenderedMeasure {
    return this.renderer.renderMeasure(
      data,
      canvasTheme(settings.theme, settings.contrast),
      this.labels(settings.solfegeLabelMode),
      settings.labelsAfterPlaying ?? false
    );
  }

  /** The kept page bars in order: the rendered lines', the queued line's, then the open ones. */
  private pageBars(): MeasureData[] {
    const bars = this.measures.map((m) => m.data);
    if (this.queued) bars.push(...this.queued.bars);
    bars.push(...this.open);
    return bars;
  }

  /** Releases every rendered bar's canvas and drops the page state; the bars are kept by the caller. */
  private releaseAll(): void {
    for (const m of this.measures) release(m);
    this.measures = [];
    this.clearPage();
  }

  /**
   * Breaks the kept bars into page lines again (ADR 0110), from the first kept one, for the
   * current page width: each bar is laid out at its natural width, lines are packed and
   * justified, and the complete lines are rendered now, keeping the first line's y. Ink
   * changes with labels, so every line's y is set again. The bars after the last complete
   * line stay open; the notes are never changed.
   */
  private relayoutPage(settings: AppSettings): void {
    const firstY = this.systems.length > 0 ? this.systems[0].y : 0;
    const bars = this.pageBars();
    this.releaseAll();
    this.view = 'page';
    this.pageDirty = false;
    let prev: MeasureData | null = null;
    for (let i = 0; i < bars.length; i++) {
      const next = i + 1 < bars.length ? bars[i + 1] : this.pending;
      prev = spaceMeasure(bars[i], prev, next, 'page', settings);
      this.addToLine(prev, settings);
      while (this.queued) this.renderQueued(settings, firstY);
    }
    if (prev) this.lastLaidOut = prev;
  }

  /**
   * Adds a bar at its natural page width to the open line, first closing that line when the
   * bar would overflow it, or when it does not follow the line's last bar (a skipped
   * stretch). A lone bar wider than the line stays: its line is compressed to fit.
   */
  private addToLine(natural: MeasureData, settings: AppSettings): void {
    const open = this.open;
    if (open.length > 0) {
      const last = open[open.length - 1];
      const contiguous = natural.index === last.index + 1 && natural.startBeat === last.startBeat + last.beatsPerMeasure;
      let used = 0;
      for (const d of open) used += d.width;
      const available = lineAvailable(this.pageWidth, this.headerFor(open[0], settings));
      if (!contiguous || !fitsLine(used, natural.width, available)) this.closeOpen(settings);
    }
    this.open.push(natural);
  }

  /** The header width of a line starting with `first`: the meter only on bar 0's line. */
  private headerFor(first: MeasureData, settings: AppSettings): number {
    return this.renderer.systemHeaderWidth(first.clef, first.index === 0 ? first.timeSignature : null, settings.meterSigns);
  }

  /** Justifies the open line and queues its bars for rendering. */
  private closeOpen(settings: AppSettings): void {
    const open = this.open;
    if (open.length === 0) return;
    const first = open[0];
    const last = open[open.length - 1];
    const header = this.headerFor(first, settings);
    const bars = closeLine(open, lineAvailable(this.pageWidth, header));
    this.open = [];
    this.queued = {
      bars,
      system: {
        firstIndex: first.index,
        count: bars.length,
        startBeat: first.startBeat,
        endBeat: last.startBeat + last.beatsPerMeasure,
        header,
        meter: first.index === 0,
        y: 0,
        prevY: 0,
        inkTop: Infinity,
        inkBottom: -Infinity,
      },
    };
  }

  /**
   * Renders the queued line's next bar; after its last bar the line is complete and takes
   * its y from the line above, or `firstY` as the first line.
   */
  private renderQueued(settings: AppSettings, firstY: number): void {
    const queued = this.queued;
    if (!queued) return;
    const data = queued.bars.shift();
    if (data) {
      const rendered = this.render(data, settings);
      this.measures.push(rendered);
      const ink = rendered.ink ?? { top: STAFF_INK_TOP, bottom: STAFF_INK_BOTTOM };
      queued.system.inkTop = Math.min(queued.system.inkTop, ink.top);
      queued.system.inkBottom = Math.max(queued.system.inkBottom, ink.bottom);
    }
    if (queued.bars.length > 0) return;
    const system = queued.system;
    const above = this.systems[this.systems.length - 1];
    if (above) {
      system.prevY = above.y;
      system.y = above.y + lineDistance(above.inkBottom, system.inkTop);
    } else {
      system.prevY = firstY;
      system.y = firstY;
    }
    this.systems.push(system);
    this.queued = null;
  }

  /**
   * Whether complete lines reach `rows` lines below the one playing at `vb` (ADR 0110).
   */
  public coversRows(vb: number, rows: number): boolean {
    const systems = this.systems;
    if (systems.length === 0) return false;
    const a = findSystem(systems, vb);
    if (vb >= systems[a].endBeat) return false;
    return systems.length - 1 - a >= rows;
  }

  /**
   * Page view's ensureAhead (ADR 0110): renders bars until complete lines reach `rowsBelow`
   * lines below the one playing at `vb`, at most `maxMeasures` renders per call (ADR 0091).
   * Bars are generated one ahead, in order, exactly as on the tape. Returns true while the
   * page still falls short.
   */
  public ensureRows(vb: number, rowsBelow: number, settings: AppSettings, maxMeasures: number = Infinity): boolean {
    if (!isMusicFontReady()) {
      return false;
    }
    if (this.nextMeasureStartBeat < vb - 2) {
      const beatsPerMeasure = getBeatsPerMeasure(settings.timeSignature);
      const skipped = Math.floor((vb - 2 - this.nextMeasureStartBeat) / beatsPerMeasure);
      if (skipped > 0) {
        this.releaseAll();
        this.nextMeasureIndex += skipped;
        this.nextMeasureStartBeat += skipped * beatsPerMeasure;
        this.pending = null;
        this.lastLaidOut = null;
      }
    }
    if (this.view !== 'page' || this.pageDirty) this.relayoutPage(settings);

    const firstY = this.systems.length > 0 ? this.systems[0].y : 0;
    let count = 0;
    while (count < maxMeasures && !this.coversRows(vb, rowsBelow)) {
      if (this.queued) {
        this.renderQueued(settings, firstY);
        count++;
        continue;
      }
      const measureData =
        this.pending ?? this.generator.generateMeasure(this.nextMeasureIndex, settings, this.nextMeasureStartBeat);
      this.pending = this.generator.generateMeasure(
        this.nextMeasureIndex + 1,
        settings,
        this.nextMeasureStartBeat + measureData.beatsPerMeasure
      );
      const natural = spaceMeasure(measureData, this.lastLaidOut, this.pending, 'page', settings);
      this.lastLaidOut = natural;
      this.nextMeasureIndex++;
      this.nextMeasureStartBeat += measureData.beatsPerMeasure;
      this.addToLine(natural, settings);
    }
    return !this.coversRows(vb, rowsBelow);
  }

  /**
   * Evicts the page lines more than `rowsAbove` above the line playing at `vb`: the played
   * lines kept above the reading line (ADR 0110). Their canvases are released.
   */
  public evictRowsBefore(vb: number, rowsAbove: number): void {
    const a = findSystem(this.systems, vb);
    const keepFrom = a - rowsAbove;
    if (keepFrom <= 0) return;
    let bars = 0;
    for (let i = 0; i < keepFrom; i++) bars += this.systems[i].count;
    this.systems.splice(0, keepFrom);
    this.evictFirst(bars);
  }

  /**
   * Global beat where the next measure to generate would start. In page view this counts
   * the bars waiting in the queued and open lines, which are not rendered yet.
   */
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
        return ahead + data.width - (beatX(data, beat - data.startBeat) - NOTE_START_OFFSET);
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
    // A page is filled by lines, not tape pixels: one line below the playing one at least
    if ((settings.view ?? 'steady') === 'page') return this.ensureRows(currentGlobalBeat, 1, settings, maxMeasures);

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

      this.measures.push(this.render(laidOut, settings));

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
    let behind = beatX(anchor, beat - anchor.startBeat);
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
    for (let i = 0; i < count; i++) release(this.measures[i]);
    if (count > 0) {
      this.measures.splice(0, count);
    }
  }
}

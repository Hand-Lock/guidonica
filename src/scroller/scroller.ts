import {
  AppSettings,
  CANVAS_PALETTE,
  CanvasPalette,
  Clef,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MEASURE_CANVAS_HEIGHT,
  MIN_PLAYHEAD_X,
  MIN_ZOOM,
  NOTE_START_OFFSET,
  PINNED_HEADER_FADE_WIDTH,
  PINNED_HEADER_MASK_WIDTH,
  PINNED_HEADER_OFFSET_X,
  PINNED_HEADER_TOTAL_MARGIN,
  PINNED_HEADER_WIDTH,
  ResolvedTheme,
  STAVE_TOP_LINE_Y,
  TimeSignature,
  computeBeatWidth,
  resolveTheme,
} from '../notation/types';
import { MetronomeEngine } from '../audio/metronome';
import { MeasureBuffer } from './buffer';
import { MeasureRenderer } from '../notation/renderer';
import { isMusicFontReady } from '../notation/fonts';

/**
 * Measures past the right edge are rendered in idle time, between frames, up to this
 * many beats ahead; a frame only renders synchronously when the buffer would otherwise
 * fall short of the edge plus one beat (ADR 0091).
 */
const IDLE_LOOKAHEAD_BEATS = 6;
const FRAME_LOOKAHEAD_BEATS = 1;

export class ScrollerView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: MeasureBuffer;
  private metronome: MetronomeEngine;
  private renderer: MeasureRenderer;
  private getSettings: () => AppSettings;
  private frameCallback: (() => void) | null = null;
  private resizeCallback: (() => void) | null = null;

  private dpr: number = 1;
  private zoom: number = DEFAULT_ZOOM;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private playheadX: number = 0;
  private staveTopY: number = 0;
  private measureDrawY: number = 0;

  // Cached pinned clef + time signature canvas
  private pinnedClefCanvas: HTMLCanvasElement | null = null;
  private cachedClef: Clef | null = null;
  private cachedTimeSignature: TimeSignature | null = null;
  private cachedClefTheme: string | null = null;

  // Gradients cached per geometry and palette: no per-frame allocations (ADR 0091)
  private playheadGradient: CanvasGradient | null = null;
  private fadeGradient: CanvasGradient | null = null;
  private gradientPalette: CanvasPalette | null = null;

  // Pending idle-time measure render, cancelled by stopLoop/destroy (ADR 0091)
  private cancelIdleRender: (() => void) | null = null;

  private rafId: number | null = null;
  private isLoopRunning: boolean = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    buffer: MeasureBuffer,
    metronome: MetronomeEngine,
    renderer: MeasureRenderer,
    getSettings: () => AppSettings
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Failed to obtain 2D rendering context for Scroller canvas.');
    }
    this.ctx = context;
    this.buffer = buffer;
    this.metronome = metronome;
    this.renderer = renderer;
    this.getSettings = getSettings;
    this.zoom = getSettings().zoom || DEFAULT_ZOOM;

    this.updateDimensions();
    // Observe the wrapper, not the window: collapsing the settings drawer resizes the
    // canvas area without any window resize. The window listener only catches dpr
    // changes (dragging to a monitor of different density) the observer cannot see.
    const parent = this.canvas.parentElement;
    if (parent && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.handleResize);
      this.resizeObserver.observe(parent);
      window.addEventListener('resize', this.handleDprChange);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  public destroy(): void {
    this.stopLoop();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('resize', this.handleDprChange);
  }

  public invalidatePinnedClef(): void {
    this.pinnedClefCanvas = null;
    this.cachedClef = null;
    this.cachedTimeSignature = null;
    this.cachedClefTheme = null;
    this.invalidateGradients();
  }

  private invalidateGradients(): void {
    this.playheadGradient = null;
    this.fadeGradient = null;
    this.gradientPalette = null;
  }

  public setZoom(zoom: number): void {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    if (this.zoom === clamped) return;
    this.zoom = clamped;
    this.updateDimensions();
    this.invalidatePinnedClef();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public getViewportWidth(): number {
    return this.viewportWidth;
  }

  private handleDprChange = (): void => {
    if ((window.devicePixelRatio || 1) !== this.dpr) this.handleResize();
  };

  private handleResize = (): void => {
    const previousDpr = this.dpr;
    this.updateDimensions();
    this.invalidatePinnedClef(); // Invalidate cached clef for potential dpr changes
    if (this.dpr !== previousDpr) {
      // Moved to a monitor with a different pixel density: cached canvases would blit blurry
      this.buffer.rerender(this.getSettings());
    }
    this.resizeCallback?.();
    this.renderFrame();
  };

  public updateDimensions(): void {
    this.dpr = window.devicePixelRatio || 1;
    const parent = this.canvas.parentElement;
    let width = window.innerWidth;
    let height = window.innerHeight - 60;
    if (parent) {
      // Content box, not border box: the wrapper pads by the notch insets (ADR 0056)
      const rect = parent.getBoundingClientRect();
      const style = getComputedStyle(parent);
      width = rect.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      height = rect.height - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
    }

    this.viewportWidth = Math.max(300, Math.floor(width));
    this.viewportHeight = Math.max(220, Math.floor(height));

    this.canvas.width = Math.floor(this.viewportWidth * this.dpr);
    this.canvas.height = Math.floor(this.viewportHeight * this.dpr);
    this.canvas.style.width = `${this.viewportWidth}px`;
    this.canvas.style.height = `${this.viewportHeight}px`;
    this.renderer.setDpr(this.dpr);

    // Playhead fixed at 22% of viewport width with minimum clearance of pinned header fade margin
    const minPlayheadX = Math.round(MIN_PLAYHEAD_X * this.zoom);
    this.playheadX = Math.max(minPlayheadX, Math.round(this.viewportWidth * 0.22));

    // Center the 5 stave lines vertically around viewport center
    const centerY = Math.round(this.viewportHeight / 2);
    const lineSpacing = Math.round(10 * this.zoom);
    // Line 0 is at -2 * lineSpacing from center (since center is line 2)
    this.staveTopY = centerY - 2 * lineSpacing;
    // Measure canvas line 0 is at 80 * zoom from measure canvas top (STAVE_TOP_LINE_Y = 80)
    this.measureDrawY = centerY - Math.round(100 * this.zoom);
    this.invalidateGradients();
  }

  public startLoop(): void {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    const loop = (now: DOMHighResTimeStamp): void => {
      if (!this.isLoopRunning) return;
      // Advance the frame-locked audio clock once per vsync, before anything reads it (ADR 0089)
      this.metronome.tick(now);
      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  /**
   * Registers a hook invoked at the end of every rendered frame. Lets UI that must
   * follow the audio clock (beat indicator) ride the single rAF loop instead of
   * spawning its own timers.
   */
  public onFrame(callback: (() => void) | null): void {
    this.frameCallback = callback;
  }

  /**
   * Registers a hook invoked after the stage has been re-measured (rotation, drawer
   * collapse, fullscreen, dpr change). Runs once getViewportWidth() already reports the
   * new size, unlike a window resize listener, which fires before layout.
   */
  public onResize(callback: (() => void) | null): void {
    this.resizeCallback = callback;
  }

  public stopLoop(): void {
    this.isLoopRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.cancelIdleRender?.();
    this.cancelIdleRender = null;
  }

  /** Beats between the playhead and the right edge of the stage. */
  private beatsToRightEdge(beatWidth: number): number {
    return (this.viewportWidth - this.playheadX) / (beatWidth * this.zoom);
  }

  /**
   * Renders the measures beyond the right edge one per idle period, so VexFlow layout
   * and rasterization never land inside an animation frame (ADR 0091). requestIdleCallback
   * where available, else a zero-delay timeout (Safari): both only schedule work, every
   * beat position still comes from the audio clock.
   */
  private scheduleIdleRender(): void {
    if (this.cancelIdleRender) return;
    const run = (): void => {
      this.cancelIdleRender = null;
      const settings = this.getSettings();
      const beatWidth = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
      const short = this.buffer.ensureAhead(
        this.metronome.getVisualBeat(),
        this.beatsToRightEdge(beatWidth) + IDLE_LOOKAHEAD_BEATS,
        settings,
        1
      );
      if (short) this.scheduleIdleRender();
    };
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 200 });
      this.cancelIdleRender = () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(run, 0);
      this.cancelIdleRender = () => clearTimeout(id);
    }
  }

  /**
   * Primary high-performance rendering frame:
   * Uses AudioContext.currentTime single source of truth clock and GPU-accelerated blitting.
   */
  public renderFrame(overrideSettings?: AppSettings): void {
    const settings = overrideSettings ?? this.getSettings();
    if (settings.zoom !== undefined && settings.zoom !== this.zoom) {
      this.setZoom(settings.zoom);
    }
    const ctx = this.ctx;
    const dpr = this.dpr;
    const zoom = this.zoom;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const resolvedTheme = resolveTheme(settings.theme);
    const palette = CANVAS_PALETTE[resolvedTheme];

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear viewport with theme-aware background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, w, h);

    // 2. Draw continuous stationary staff lines across the entire viewport
    this.drawStaffLines(ctx, 0, w, palette);

    // 3. Obtain visual beat position from hardware audio clock (waits at 0 during count-in)
    const visualBeat = this.metronome.getVisualBeat();
    const activeBeatWidth = computeBeatWidth(
      settings.subdivisions,
      settings.timeSignature,
      settings.tuplets
    );

    // 4. Update ring buffer: the stage must be covered now, the lookahead beyond it is
    //    rendered between frames (ADR 0091); then evict offscreen measures
    const edgeBeats = this.beatsToRightEdge(activeBeatWidth);
    this.buffer.ensureAhead(visualBeat, edgeBeats + FRAME_LOOKAHEAD_BEATS, settings);
    if (isMusicFontReady() && this.buffer.getEndBeat() < visualBeat + edgeBeats + IDLE_LOOKAHEAD_BEATS) {
      this.scheduleIdleRender();
    }

    const minVisibleBeat = visualBeat - this.playheadX / (activeBeatWidth * zoom) - 2;
    this.buffer.evictBefore(minVisibleBeat);

    // 5. Blit visible measures from ring-buffer with subpixel floating-point positioning
    const measures = this.buffer.getMeasures();
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i];
      // Subpixel screen X: noteheads cross playhead at their exact fractional beat time
      const measureScreenX =
        this.playheadX - NOTE_START_OFFSET * zoom + (m.data.startBeat - visualBeat) * (m.data.beatWidth * zoom);

      if (measureScreenX + m.width >= 0 && measureScreenX <= w) {
        ctx.drawImage(
          m.canvas,
          0,
          0,
          m.canvas.width,
          m.canvas.height,
          measureScreenX,
          this.measureDrawY,
          m.width,
          m.height
        );
      }
    }

    // 6. Draw pinned clef & time signature at the left margin with clean gradient fade
    this.drawPinnedClef(ctx, settings.clef, settings.timeSignature, h, resolvedTheme);

    // 7. Draw fixed playhead guide line in high-contrast red accent (when enabled)
    if (settings.showPlayhead !== false) {
      this.drawPlayhead(ctx, h, palette);
    }

    ctx.restore();

    this.frameCallback?.();
  }

  private drawStaffLines(
    ctx: CanvasRenderingContext2D,
    fromX: number,
    toX: number,
    palette: CanvasPalette
  ): void {
    ctx.strokeStyle = palette.staff;
    ctx.lineWidth = 1;
    ctx.beginPath();

    const lineSpacing = Math.round(10 * this.zoom);
    const startY = Math.round(this.staveTopY);
    for (let line = 0; line < 5; line++) {
      const y = startY + line * lineSpacing + 0.5;
      ctx.moveTo(fromX, y);
      ctx.lineTo(toX, y);
    }

    ctx.stroke();
  }

  /**
   * Draws a clean stationary viewport (staff lines and playhead) without
   * attempting to render or blit notation glyphs before fonts are ready.
   */
  public renderEmptyFrame(overrideSettings?: AppSettings): void {
    const settings = overrideSettings ?? this.getSettings();
    if (settings.zoom !== undefined && settings.zoom !== this.zoom) {
      this.setZoom(settings.zoom);
    }
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.viewportWidth;
    const h = this.viewportHeight;
    const palette = CANVAS_PALETTE[resolveTheme(settings.theme)];

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, w, h);

    this.drawStaffLines(ctx, 0, w, palette);
    if (settings.showPlayhead !== false) {
      this.drawPlayhead(ctx, h, palette);
    }

    ctx.restore();
  }

  private drawPinnedClef(
    ctx: CanvasRenderingContext2D,
    clef: Clef,
    timeSignature: TimeSignature,
    height: number,
    theme: ResolvedTheme
  ): void {
    if (!isMusicFontReady()) {
      return;
    }

    if (
      !this.pinnedClefCanvas ||
      this.cachedClef !== clef ||
      this.cachedTimeSignature !== timeSignature ||
      this.cachedClefTheme !== theme
    ) {
      this.pinnedClefCanvas = this.renderer.renderPinnedClef(clef, timeSignature, theme);
      this.cachedClef = clef;
      this.cachedTimeSignature = timeSignature;
      this.cachedClefTheme = theme;
    }

    const zoom = this.zoom;
    const headerX = PINNED_HEADER_OFFSET_X * zoom;
    const maskSolidWidth = PINNED_HEADER_MASK_WIDTH * zoom;
    const fadeWidth = PINNED_HEADER_FADE_WIDTH * zoom;
    const totalMargin = PINNED_HEADER_TOTAL_MARGIN * zoom;

    // Full-height solid mask behind pinned header to prevent ledger lines/stems poking out
    const palette = CANVAS_PALETTE[theme];
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, maskSolidWidth, height);

    // Graceful horizontal fade from solid to transparent so scrolling notes disappear smoothly
    if (this.gradientPalette !== palette) this.invalidateGradients();
    if (!this.fadeGradient) {
      this.fadeGradient = ctx.createLinearGradient(maskSolidWidth, 0, totalMargin, 0);
      this.fadeGradient.addColorStop(0, `rgba(${palette.backgroundRgb}, 1)`);
      this.fadeGradient.addColorStop(1, `rgba(${palette.backgroundRgb}, 0)`);
      this.gradientPalette = palette;
    }
    ctx.fillStyle = this.fadeGradient;
    ctx.fillRect(maskSolidWidth, 0, fadeWidth, height);

    // Re-draw staff lines across the masked & faded margin
    this.drawStaffLines(ctx, 0, totalMargin, palette);

    // Draw the pinned clef + time signature glyphs
    ctx.drawImage(
      this.pinnedClefCanvas,
      0,
      0,
      this.pinnedClefCanvas.width,
      this.pinnedClefCanvas.height,
      headerX,
      this.measureDrawY,
      PINNED_HEADER_WIDTH * zoom,
      MEASURE_CANVAS_HEIGHT * zoom
    );
  }

  private drawPlayhead(ctx: CanvasRenderingContext2D, height: number, palette: CanvasPalette): void {
    const zoom = this.zoom;
    const x = Math.round(this.playheadX) + 0.5;

    // Subtle background glow behind playhead line
    if (this.gradientPalette !== palette) this.invalidateGradients();
    if (!this.playheadGradient) {
      const gradient = ctx.createLinearGradient(x, 0, x, height);
      gradient.addColorStop(0, `rgba(${palette.playheadRgb}, 0)`);
      gradient.addColorStop(0.3, `rgba(${palette.playheadRgb}, 0.08)`);
      gradient.addColorStop(0.5, `rgba(${palette.playheadRgb}, 0.18)`);
      gradient.addColorStop(0.7, `rgba(${palette.playheadRgb}, 0.08)`);
      gradient.addColorStop(1, `rgba(${palette.playheadRgb}, 0)`);
      this.playheadGradient = gradient;
      this.gradientPalette = palette;
    }

    ctx.fillStyle = this.playheadGradient;
    ctx.fillRect(x - 3, 0, 7, height);

    // Crisp playhead line spanning staff lines + clearance
    const topY = this.staveTopY - 35 * zoom;
    const bottomY = this.staveTopY + 75 * zoom;
    ctx.strokeStyle = palette.playhead;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();

    // Accent pointers at top and bottom of playhead line
    ctx.fillStyle = palette.playhead;

    const triW = 4 * Math.min(1.2, Math.max(0.75, zoom));
    const triH = 8 * Math.min(1.2, Math.max(0.75, zoom));

    // Top triangle
    ctx.beginPath();
    ctx.moveTo(x - triW, topY);
    ctx.lineTo(x + triW, topY);
    ctx.lineTo(x, topY + triH);
    ctx.closePath();
    ctx.fill();

    // Bottom triangle
    ctx.beginPath();
    ctx.moveTo(x - triW, bottomY);
    ctx.lineTo(x + triW, bottomY);
    ctx.lineTo(x, bottomY - triH);
    ctx.closePath();
    ctx.fill();
  }
}

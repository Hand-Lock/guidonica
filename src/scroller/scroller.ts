import {
  AppSettings,
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

export class ScrollerView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: MeasureBuffer;
  private metronome: MetronomeEngine;
  private renderer: MeasureRenderer;
  private getSettings: () => AppSettings;

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

  private rafId: number | null = null;
  private isLoopRunning: boolean = false;

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
    window.addEventListener('resize', this.handleResize);
  }

  public destroy(): void {
    this.stopLoop();
    window.removeEventListener('resize', this.handleResize);
  }

  public invalidatePinnedClef(): void {
    this.pinnedClefCanvas = null;
    this.cachedClef = null;
    this.cachedTimeSignature = null;
    this.cachedClefTheme = null;
  }

  public invalidatePinnedHeader(): void {
    this.invalidatePinnedClef();
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

  private handleResize = (): void => {
    this.updateDimensions();
    this.invalidatePinnedClef(); // Invalidate cached clef for potential dpr changes
    this.renderFrame();
  };

  public updateDimensions(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight - 60,
    };

    this.viewportWidth = Math.max(300, Math.floor(rect.width));
    this.viewportHeight = Math.max(220, Math.floor(rect.height));

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
  }

  public startLoop(): void {
    if (this.isLoopRunning) return;
    this.isLoopRunning = true;

    const loop = (): void => {
      if (!this.isLoopRunning) return;
      this.renderFrame();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public stopLoop(): void {
    this.isLoopRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
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
    const isDark = resolvedTheme === 'dark';

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear viewport with theme-aware background
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw continuous stationary staff lines across the entire viewport
    this.drawStationaryStaffLines(ctx, w, isDark);

    // 3. Obtain visual beat position from hardware audio clock (waits at 0 during count-in)
    const visualBeat = this.metronome.getVisualBeat();
    const activeBeatWidth = computeBeatWidth(
      settings.subdivisions,
      settings.timeSignature,
      settings.tuplets
    );

    // 4. Update ring buffer: pre-render upcoming measures and evict offscreen ones
    const lookaheadBeats = (w - this.playheadX) / (activeBeatWidth * zoom) + 6;
    this.buffer.ensureAhead(visualBeat, lookaheadBeats, settings);

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
    this.drawPinnedClef(ctx, settings.clef, settings.timeSignature, h, isDark, resolvedTheme);

    // 7. Draw fixed playhead guide line in high-contrast red accent
    this.drawPlayhead(ctx, h);

    ctx.restore();
  }

  private drawStationaryStaffLines(
    ctx: CanvasRenderingContext2D,
    width: number,
    isDark: boolean = false
  ): void {
    ctx.strokeStyle = isDark ? '#475569' : '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();

    const lineSpacing = Math.round(10 * this.zoom);
    const startY = Math.round(this.staveTopY);
    for (let line = 0; line < 5; line++) {
      const y = startY + line * lineSpacing + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
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
    const resolvedTheme = resolveTheme(settings.theme);
    const isDark = resolvedTheme === 'dark';

    ctx.save();
    ctx.scale(dpr, dpr);

    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    this.drawStationaryStaffLines(ctx, w, isDark);
    this.drawPlayhead(ctx, h);

    ctx.restore();
  }

  private drawPinnedClef(
    ctx: CanvasRenderingContext2D,
    clef: Clef,
    timeSignature: TimeSignature,
    height: number,
    isDark: boolean,
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
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, maskSolidWidth, height);

    // Graceful horizontal fade from solid to transparent so scrolling notes disappear smoothly
    const fadeGrad = ctx.createLinearGradient(maskSolidWidth, 0, totalMargin, 0);
    fadeGrad.addColorStop(0, isDark ? 'rgba(15, 23, 42, 1)' : 'rgba(255, 255, 255, 1)');
    fadeGrad.addColorStop(1, isDark ? 'rgba(15, 23, 42, 0)' : 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = fadeGrad;
    ctx.fillRect(maskSolidWidth, 0, fadeWidth, height);

    // Re-draw staff lines across the masked & faded margin
    ctx.strokeStyle = isDark ? '#475569' : '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const lineSpacing = Math.round(10 * zoom);
    const startY = Math.round(this.staveTopY);
    for (let line = 0; line < 5; line++) {
      const y = startY + line * lineSpacing + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(totalMargin, y);
    }
    ctx.stroke();

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

  private drawPlayhead(ctx: CanvasRenderingContext2D, height: number): void {
    const zoom = this.zoom;
    const x = Math.round(this.playheadX) + 0.5;

    // Subtle background glow behind playhead line
    const gradient = ctx.createLinearGradient(x, 0, x, height);
    gradient.addColorStop(0, 'rgba(220, 38, 38, 0)');
    gradient.addColorStop(0.3, 'rgba(220, 38, 38, 0.08)');
    gradient.addColorStop(0.5, 'rgba(220, 38, 38, 0.18)');
    gradient.addColorStop(0.7, 'rgba(220, 38, 38, 0.08)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - 3, 0, 7, height);

    // Crisp playhead line spanning staff lines + clearance
    const topY = this.staveTopY - 35 * zoom;
    const bottomY = this.staveTopY + 75 * zoom;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();

    // Accent pointers at top and bottom of playhead line
    ctx.fillStyle = '#dc2626';

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

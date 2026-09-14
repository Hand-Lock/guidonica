import { AppSettings, BEAT_WIDTH, Clef, NOTE_START_OFFSET, STAVE_CANVAS_Y } from '../notation/types';
import { MetronomeEngine } from '../audio/metronome';
import { MeasureBuffer } from './buffer';
import { MeasureRenderer } from '../notation/renderer';

export class ScrollerView {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: MeasureBuffer;
  private metronome: MetronomeEngine;
  private renderer: MeasureRenderer;

  private dpr: number = 1;
  private viewportWidth: number = 0;
  private viewportHeight: number = 0;
  private playheadX: number = 0;
  private staveTopY: number = 0;
  private measureDrawY: number = 0;

  // Cached pinned clef canvas
  private pinnedClefCanvas: HTMLCanvasElement | null = null;
  private cachedClef: Clef | null = null;

  private rafId: number | null = null;
  private isLoopRunning: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    buffer: MeasureBuffer,
    metronome: MetronomeEngine,
    renderer: MeasureRenderer
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

    this.updateDimensions();
    window.addEventListener('resize', this.handleResize);
  }

  public destroy(): void {
    this.stopLoop();
    window.removeEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.updateDimensions();
    this.pinnedClefCanvas = null; // Invalidate cached clef for potential dpr changes
    this.renderFrame();
  };

  public updateDimensions(): void {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement?.getBoundingClientRect() ?? {
      width: window.innerWidth,
      height: window.innerHeight - 60,
    };

    this.viewportWidth = Math.max(300, Math.floor(rect.width));
    this.viewportHeight = Math.max(180, Math.floor(rect.height));

    this.canvas.width = Math.floor(this.viewportWidth * this.dpr);
    this.canvas.height = Math.floor(this.viewportHeight * this.dpr);
    this.canvas.style.width = `${this.viewportWidth}px`;
    this.canvas.style.height = `${this.viewportHeight}px`;

    // Playhead fixed at 22% of viewport width (leaves room for clef on left, generous reading distance on right)
    this.playheadX = Math.round(this.viewportWidth * 0.22);

    // Center the 5 stave lines vertically
    const centerY = Math.round(this.viewportHeight / 2);
    // 5 lines spaced by 10px span 40px total (lines at 0, 10, 20, 30, 40)
    this.staveTopY = centerY - 20;
    this.measureDrawY = this.staveTopY - STAVE_CANVAS_Y;
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
  public renderFrame(settings?: AppSettings): void {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const w = this.viewportWidth;
    const h = this.viewportHeight;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear viewport with clean white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // 2. Draw continuous stationary staff lines across the entire viewport
    this.drawStationaryStaffLines(ctx, w);

    // 3. Obtain current beat from hardware audio clock
    const currentGlobalBeat = this.metronome.getCurrentGlobalBeat();

    // 4. Update ring buffer: pre-render upcoming measures and evict offscreen ones
    if (settings) {
      const lookaheadBeats = ((w - this.playheadX) / BEAT_WIDTH) + 6;
      this.buffer.ensureAhead(currentGlobalBeat, lookaheadBeats, settings, dpr);

      const minVisibleBeat = currentGlobalBeat - (this.playheadX / BEAT_WIDTH) - 2;
      this.buffer.evictBefore(minVisibleBeat);
    }

    // 5. Blit visible measures from ring-buffer
    const measures = this.buffer.getMeasures();
    for (let i = 0; i < measures.length; i++) {
      const m = measures[i];
      // Screen X where measure's left edge aligns so that noteheads cross playhead at their exact beat time
      const measureScreenX =
        this.playheadX - NOTE_START_OFFSET + (m.data.startBeat - currentGlobalBeat) * BEAT_WIDTH;

      if (measureScreenX + m.width >= 0 && measureScreenX <= w) {
        ctx.drawImage(
          m.canvas,
          0,
          0,
          m.canvas.width,
          m.canvas.height,
          Math.round(measureScreenX),
          Math.round(this.measureDrawY),
          m.width,
          m.height
        );
      }
    }

    // 6. Draw pinned clef at the left margin
    this.drawPinnedClef(ctx, settings?.clef ?? 'treble');

    // 7. Draw fixed playhead guide line in high-contrast red accent
    this.drawPlayhead(ctx, h);

    ctx.restore();
  }

  private drawStationaryStaffLines(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let line = 0; line < 5; line++) {
      const y = Math.round(this.staveTopY + line * 10) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
  }

  private drawPinnedClef(ctx: CanvasRenderingContext2D, clef: Clef): void {
    if (!this.pinnedClefCanvas || this.cachedClef !== clef) {
      this.pinnedClefCanvas = this.renderer.renderPinnedClef(clef, this.dpr);
      this.cachedClef = clef;
    }

    const clefX = 24;
    // Subtly shade behind clef so scrolling notes don't visually clutter the reference clef
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(0, this.staveTopY - 25, clefX + 70, 90);

    // Re-draw staff lines under the clef
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let line = 0; line < 5; line++) {
      const y = Math.round(this.staveTopY + line * 10) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(clefX + 70, y);
    }
    ctx.stroke();

    ctx.drawImage(
      this.pinnedClefCanvas,
      0,
      0,
      this.pinnedClefCanvas.width,
      this.pinnedClefCanvas.height,
      clefX,
      Math.round(this.measureDrawY),
      80,
      this.pinnedClefCanvas.height / this.dpr
    );
  }

  private drawPlayhead(ctx: CanvasRenderingContext2D, height: number): void {
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

    // Crisp playhead line
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, this.staveTopY - 35);
    ctx.lineTo(x, this.staveTopY + 75);
    ctx.stroke();

    // Accent pointers at top and bottom of playhead line
    ctx.fillStyle = '#dc2626';

    // Top triangle
    ctx.beginPath();
    ctx.moveTo(x - 4, this.staveTopY - 35);
    ctx.lineTo(x + 4, this.staveTopY - 35);
    ctx.lineTo(x, this.staveTopY - 27);
    ctx.closePath();
    ctx.fill();

    // Bottom triangle
    ctx.beginPath();
    ctx.moveTo(x - 4, this.staveTopY + 75);
    ctx.lineTo(x + 4, this.staveTopY + 75);
    ctx.lineTo(x, this.staveTopY + 67);
    ctx.closePath();
    ctx.fill();
  }
}

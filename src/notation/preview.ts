import { MusicGenerator } from './generator';
import { MeasureRenderer } from './renderer';
import { noteLabels } from '../i18n';
import { PreviewWindow, previewWindow } from '../presets';
import {
  AppSettings,
  CANVAS_PALETTE,
  Clef,
  MeasureData,
  NOTE_START_OFFSET,
  RenderedMeasure,
  STAVE_TOP_LINE_Y,
  ThemeMode,
  computeBeatWidth,
  resolveTheme,
} from './types';

/**
 * Static notation thumbnails for the onboarding intro (ADR 0050). They are composited
 * from the same offscreen measure canvases the scroller blits, so a preview is a real
 * sample of the unchanged generator within the given settings' Ω.
 */

/** Notation scale of the level strips (the app's zoom is untouched: own renderer). */
const STRIP_SCALE = 0.42;
/** Logical strip width in CSS px; CSS crops it on the right to the card width. */
const STRIP_WIDTH = 640;
/** Vertical crop of the 220-unit measure canvas: room for ledger lines, stems and labels (height mirrored in style.css). */
const STRIP_CROP_TOP = 12;
const STRIP_CROP_BOTTOM = 196;
/** Header units the clef + time signature occupy before the first bar. */
const STRIP_HEADER_ADVANCE = 88;
/** Units trimmed from the first bar so the strip opens without a left barline. */
const FIRST_BARLINE_TRIM = 3;
/** Upper bound on generated bars, whatever the bar width. */
const STRIP_MAX_MEASURES = 12;
/** Fraction of the card width left unfaded (mirrors the mask-image stop in style.css). */
const STRIP_FADE_START = 0.8;
/** Strips tried per card before drawing the last one anyway (ADR 0052). */
const MAX_PREVIEW_ATTEMPTS = 32;
/** Strip x of the first bar's left edge, right after the pinned header. */
const STRIP_START_X = (STRIP_HEADER_ADVANCE - FIRST_BARLINE_TRIM) * STRIP_SCALE;

/** Clef icons are larger than the strips: a lone glyph must read at a glance. */
const ICON_SCALE = 0.5;
/** Clef icon window in header-canvas units: a short staff fragment around the glyph (size mirrored in style.css). */
const ICON_CROP_X = 8;
const ICON_WIDTH = 56;
const ICON_CROP_TOP = 56;
const ICON_CROP_BOTTOM = 148;

const renderer = new MeasureRenderer();

function currentDpr(): number {
  return Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
}

/**
 * Points the shared renderer at `scale`, sizes `target`'s bitmap for CSS size
 * `width × height` and returns a CSS-px context.
 */
function prepare(
  target: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number
): CanvasRenderingContext2D | null {
  const dpr = currentDpr();
  renderer.setDpr(dpr);
  renderer.setZoom(scale);
  target.width = Math.max(1, Math.round(width * dpr));
  target.height = Math.max(1, Math.round(height * dpr));
  const ctx = target.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Five staff lines from `fromX` to `toX`, with the measure canvas's top line at `topY`. */
function drawStaff(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  toX: number,
  topY: number,
  scale: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1 / currentDpr(), scale);
  ctx.beginPath();
  for (let line = 0; line < 5; line++) {
    const y = topY + line * 10 * scale;
    ctx.moveTo(fromX, y);
    ctx.lineTo(toX, y);
  }
  ctx.stroke();
}

/** Zeroes a canvas's backing store so its pixels can be collected. */
export function releasePreview(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** Consecutive bars from a fresh generator until the strip is full (data only, no layout). */
function generateStrip(settings: AppSettings): MeasureData[] {
  const generator = new MusicGenerator();
  const measures: MeasureData[] = [];
  let x = STRIP_START_X;
  let startBeat = 0;
  for (let i = 0; i < STRIP_MAX_MEASURES && x < STRIP_WIDTH; i++) {
    const data = generator.generateMeasure(i, settings, startBeat);
    measures.push(data);
    x += data.width * STRIP_SCALE; // Equals the rendered width
    startBeat += data.beatsPerMeasure;
  }
  return measures;
}

/**
 * Draws a freshly generated excerpt for `settings` into `target`: pinned header, then
 * consecutive bars from a fresh generator until the strip is full, so barline ties and
 * every other rule behave exactly as in the scroller. With `accept`, strips are drawn as
 * data and re-rolled until the unfaded part of the card passes it (ADR 0052); after
 * MAX_PREVIEW_ATTEMPTS the last strip, still a valid sample, is drawn.
 */
export function renderLevelPreview(
  target: HTMLCanvasElement,
  settings: AppSettings,
  accept?: (window: PreviewWindow) => boolean
): void {
  // Spacing is linear: a note at strip beat b sits at STRIP_START_X + (NOTE_START_OFFSET + b · W_beat) · scale
  const visibleWidth = Math.min(target.clientWidth || STRIP_WIDTH, STRIP_WIDTH) * STRIP_FADE_START;
  const beatWidth = computeBeatWidth(settings.subdivisions, settings.timeSignature, settings.tuplets);
  const visibleBeats =
    (visibleWidth - STRIP_START_X - NOTE_START_OFFSET * STRIP_SCALE) / (beatWidth * STRIP_SCALE);
  let measures = generateStrip(settings);
  for (let attempt = 1; accept && attempt < MAX_PREVIEW_ATTEMPTS; attempt++) {
    if (accept(previewWindow(measures, visibleBeats))) break;
    measures = generateStrip(settings);
  }

  const height = (STRIP_CROP_BOTTOM - STRIP_CROP_TOP) * STRIP_SCALE;
  const ctx = prepare(target, STRIP_WIDTH, height, STRIP_SCALE);
  if (!ctx) return;
  const palette = CANVAS_PALETTE[resolveTheme(settings.theme)];
  const offsetY = -STRIP_CROP_TOP * STRIP_SCALE;

  drawStaff(ctx, 0, STRIP_WIDTH, offsetY + STAVE_TOP_LINE_Y * STRIP_SCALE, STRIP_SCALE, palette.staff);

  const header = renderer.renderPinnedClef(settings.clef, settings.timeSignature, settings.theme);
  ctx.drawImage(header, 0, offsetY, header.width / currentDpr(), header.height / currentDpr());
  releasePreview(header);

  let x = STRIP_START_X;
  measures.forEach((data, i) => {
    const measure: RenderedMeasure = renderer.renderMeasure(data, settings.theme, noteLabels(settings.solfegeLabelMode));
    ctx.save();
    if (i === 0) {
      // The opening bar starts right after the header, which needs no barline
      ctx.beginPath();
      ctx.rect(STRIP_START_X + FIRST_BARLINE_TRIM * STRIP_SCALE, 0, STRIP_WIDTH, height);
      ctx.clip();
    }
    ctx.drawImage(measure.canvas, x, offsetY, measure.width, measure.height);
    ctx.restore();
    releasePreview(measure.canvas);
    x += measure.width;
  });
}

/** Draws `clef` alone on a short staff fragment, so alto and tenor C clefs read apart. */
export function renderClefIcon(target: HTMLCanvasElement, clef: Clef, theme: ThemeMode): void {
  const width = ICON_WIDTH * ICON_SCALE;
  const height = (ICON_CROP_BOTTOM - ICON_CROP_TOP) * ICON_SCALE;
  const ctx = prepare(target, width, height, ICON_SCALE);
  if (!ctx) return;
  const palette = CANVAS_PALETTE[resolveTheme(theme)];
  const offsetX = -ICON_CROP_X * ICON_SCALE;
  const offsetY = -ICON_CROP_TOP * ICON_SCALE;

  drawStaff(ctx, 0, width, offsetY + STAVE_TOP_LINE_Y * ICON_SCALE, ICON_SCALE, palette.staff);

  const header = renderer.renderPinnedClef(clef, null, theme);
  ctx.drawImage(header, offsetX, offsetY, header.width / currentDpr(), header.height / currentDpr());
  releasePreview(header);
}

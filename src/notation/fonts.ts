/**
 * Web font readiness and synchronization utilities for musical notation rendering.
 *
 * VexFlow 5 utilizes standard SMuFL web fonts (Bravura for musical glyphs,
 * Academico for alphanumeric score text) via the browser's FontFace API.
 * When measures or clefs are drawn onto an HTML5 2D Canvas before these fonts
 * have fully decoded and mounted in the font subsystem, the canvas engine
 * rasterizes missing character glyphs (blank rectangular tofu), which are then
 * permanently baked into offscreen canvas bitmaps.
 */

/**
 * Synchronously checks whether the musical glyph font (Bravura) is loaded
 * and available to the HTML5 2D Canvas rasterizer.
 */
export function isMusicFontReady(): boolean {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return true;
  }
  return document.fonts.check('20px Bravura');
}

/**
 * Asynchronously awaits full readiness of the Bravura and Academico fonts.
 * Guarantees that subsequent VexFlow canvas rendering operations will not
 * produce missing glyph rectangles.
 */
export async function waitForMusicFonts(): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return;
  }

  // Fast-path: return immediately if both notation and text fonts are already verified
  if (document.fonts.check('20px Bravura') && document.fonts.check('20px Academico')) {
    return;
  }

  try {
    // Explicitly prompt the browser font engine to resolve Bravura and Academico
    await Promise.all([
      document.fonts.load('20px Bravura'),
      document.fonts.load('20px Academico'),
      document.fonts.ready,
    ]);
  } catch {
    // Fallback if specific font load throws: wait for document.fonts.ready with safety timeout
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);
  }

  // Verification poll: ensure the font rasterizer has committed Bravura to the font set
  const maxWaitMs = 2000;
  const startTime = performance.now();
  while (!isMusicFontReady() && performance.now() - startTime < maxWaitMs) {
    await new Promise<void>((resolve) => setTimeout(resolve, 16));
  }
}

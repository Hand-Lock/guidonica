/**
 * The engine entry point, `guidonica/engine` (ADR 0104): generation, rendering, scrolling and
 * audio, without the app's storage, UI language or build constants. Re-exports only; anything
 * exported here is public API for embedders, and changing it is a breaking change.
 */

// Generation
export { MusicGenerator } from './notation/generator';
export { mulberry32 } from './notation/random';
export type { Random } from './notation/random';

// Notation
export { MeasureRenderer } from './notation/renderer';
export { MUSIC_FONT_FAMILY, isMusicFontReady, waitForMusicFonts } from './notation/fonts';
export {
  beatX,
  spaceMeasure,
  spacingWidth,
  squishyBeatWidth,
  tupletCell,
  typicalBarWidth,
} from './notation/spacing';
export type { BeatSpacing } from './notation/spacing';

// Scroller
export { MeasureBuffer, labelResolver } from './scroller/buffer';
export type { LabelResolver } from './scroller/buffer';
export { ScrollerView } from './scroller/scroller';
export type { FixedViewport } from './scroller/scroller';

// Audio
export { MetronomeEngine } from './audio/metronome';
export type { BeatInfo } from './audio/metronome';
export { clickAccent, clickTrack, scheduleClicks } from './audio/click';
export type { Click, ClickTrackOptions } from './audio/click';
export { createMixer } from './audio/output';
export type { Mixer } from './audio/output';
export { createDroneVoice, droneFrequency } from './audio/drone';
export type { DroneVoice } from './audio/drone';

// Settings, meters and musical types
export * from './notation/types';

// Level presets
export * from './presets';

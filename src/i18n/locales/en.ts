// Reference dictionary (ADR 0059): its shape defines `Messages`, and index.html's
// English shell text must match it (tests/i18n.test.ts). Every other locale is typed
// `Messages`, so a missing or extra key is a compile error.

import type { TupletName, TupletValue } from '../../notation/types';
import type { IntroClef, LevelId } from '../../presets';

type LevelText = Record<LevelId, { name: string; description: string }>;
type IntroClefText = Record<IntroClef, { name: string; description: string }>;

const LINK = 'target="_blank" rel="noopener noreferrer" class="link-external"';

const en = {
  docTitle: 'Guidonica — Sight-Reading & Solfège Engine',
  brandTagline: 'Sight-Reading & Solfège Engine',
  brandBadge: 'SOLFÈGE',

  // Header
  playPauseAria: 'Play or pause',
  start: 'Start',
  pause: 'Pause',
  resume: 'Resume',
  reset: 'Reset',
  resetAria: 'Reset session',
  resetTitle: 'Reset (R / Esc)',
  tempo: 'Tempo',
  tempoNumberAria: 'Tempo numeric input in BPM',
  tempoSliderAria: 'Tempo slider in BPM',
  countInBadge: 'COUNT-IN',
  aboutToggle: 'About & License',
  fullscreenToggle: 'Toggle full screen',
  fullscreenExit: 'Exit full screen',
  levelPresets: 'Level presets',
  levelCustom: 'Custom',
  levelAria: (name: string) => `Level: ${name}. Choose a level preset`,
  settings: 'Settings',
  settingsAria: 'Toggle settings menu',
  themeButtonTitle: (mode: string, next: string) => `Theme: ${mode} - Click for ${next}`,
  themeButtonAria: (mode: string) => `Theme: ${mode}. Click to cycle theme.`,
  themeAutoResolved: (resolved: string) => `Auto (OS: ${resolved})`,

  // Staff
  sectionStaff: 'Staff',
  clef: 'Clef',
  clefAria: 'Select musical clef',
  clefTreble: 'Treble (G)',
  clefSoprano: 'Soprano (C1)',
  clefMezzoSoprano: 'Mezzo-Soprano (C2)',
  clefAlto: 'Alto (C3)',
  clefTenor: 'Tenor (C4)',
  clefBaritoneF: 'Baritone (F3)',
  clefBaritoneC: 'Baritone (C5)',
  clefBass: 'Bass (F)',
  ledgerLines: 'Ledger lines',
  ledgerAbove: 'Ledger lines above the staff',
  ledgerBelow: 'Ledger lines below the staff',
  rangeTitle: 'Pitch range (C4 = middle C)',
  meter: 'Meter',
  meterAria: 'Select musical time signature',
  pulse68: '6/8 Pulse',
  pulse68Aria: '6/8 Meter pulse grouping',
  pulse68Two: '2 Beats (♩.)',
  pulse68Six: '6 Beats (♪)',

  // Rhythm
  sectionRhythm: 'Rhythm',
  noteValues: 'Note values',
  valueQuarter: 'Quarter',
  valueEighth: 'Eighth',
  valueHalf: 'Half',
  valueWhole: 'Whole',
  valueSixteenth: '16th',
  valueThirtySecond: '32nd',
  dotted: 'Dotted',
  dottedTitle: 'Dotted Notes (hd, qd, 8d, 16d)',
  tupletsFigures: 'Tuplets & figures',
  tuplets: 'Tuplets',
  tupletsToggleTitle: 'Configure n-tuplets and subdivisions',
  rests: 'Rests',
  ties: 'Ties',
  tiesTitle: 'Tied notes across beats and barlines',
  tupletsMenuAria: 'Tuplet configuration menu',
  tupletsHeading: 'Tuplet Subdivisions',
  clearAll: 'Clear all',
  clearAllTitle: 'Uncheck all tuplets',
  tupletsCloseAria: 'Close tuplet menu',
  tupletCorner: 'n-Tuplet',
  tupletColQuarter: 'Quarter Note (1/4) Tuplets',
  tupletColEighth: 'Eighth Note (1/8) Tuplets',
  tupletColSixteenth: 'Sixteenth Note (1/16) Tuplets',
  tupletsFooter: 'Select any n-tuplet and note value combinations to stream procedurally.',
  tupletNames: {
    duplet: 'Duplet',
    triplet: 'Triplet',
    quadruplet: 'Quadruplet',
    quintuplet: 'Quintuplet',
    sextuplet: 'Sextuplet',
    septuplet: 'Septuplet',
  } as Record<TupletName, string>,
  /** Plural note-value names, for "3 eighths in the time of 2". */
  tupletValuePlurals: { '1/4': 'quarters', '1/8': 'eighths', '1/16': 'sixteenths' } as Record<TupletValue, string>,
  tupletCell: (name: string, notes: number, values: string, inTimeOf: number) =>
    `${name} · ${notes} ${values} in the time of ${inTimeOf}`,
  /** Span in beats: 0.5 and up, in half-beat steps. */
  tupletBeats: (beats: number) => `${beats === 0.5 ? '½' : beats} ${beats > 1 ? 'beats' : 'beat'}`,
  tupletUnavailable: (meter: string) => `Not available in ${meter}`,

  // Melody
  sectionMelody: 'Melody',
  intervals: 'Intervals',
  intervalUnison: 'Unison',
  intervalSecond: '2nd',
  intervalThird: '3rd',
  intervalFourth: '4th',
  intervalFifth: '5th',
  intervalSixth: '6th',
  intervalSeventh: '7th',
  intervalOctave: '8ve',
  intervalNinthPlus: '9+',
  intervalUnisonTitle: 'Unison (1st) - Same pitch / repeated note',
  intervalSecondTitle: 'Second (2nd) - 1 step',
  intervalThirdTitle: 'Third (3rd) - 2 steps / skip',
  intervalFourthTitle: 'Fourth (4th) - 3 steps',
  intervalFifthTitle: 'Fifth (5th) - 4 steps',
  intervalSixthTitle: 'Sixth (6th) - 5 steps',
  intervalSeventhTitle: 'Seventh (7th) - 6 steps',
  intervalOctaveTitle: 'Octave (8ve) - 7 steps / octave leap',
  intervalNinthPlusTitle: 'Ninth and plus (9+) - Compound intervals (8+ steps)',

  // Practice
  sectionPractice: 'Practice',
  language: 'Language',
  labels: 'Labels',
  labelsAria: 'Note labels / Solfège overlay',
  labelsNone: 'None',
  labelsSyllables: 'Syllables (Do Re Mi)',
  labelsLetters: 'Letters (C D E)',
  assists: 'Assists',
  countIn: 'Count-In',
  playhead: 'Playhead',
  playheadTitle: 'Toggle stationary red playhead visibility (Shortcut: P)',
  click: 'Click',
  clickAria: 'Metronome click timbre',
  clickElectronic: 'Electronic',
  clickWoodblock: 'Woodblock',
  volume: 'Volume',
  muteAria: 'Mute or unmute metronome',
  muteTitle: 'Mute/Unmute',
  volumeAria: 'Metronome volume',
  theme: 'Theme',
  themeAria: 'Visual color theme',
  themeAuto: 'Auto (OS)',
  themeLight: 'Light',
  themeDark: 'Dark',

  // Stage
  canvasAria: 'Streaming sight-reading music notation canvas',
  zoomPillAria: 'Notation zoom controls',
  zoomOut: 'Zoom out',
  zoomOutTitle: 'Zoom out (−10%)',
  zoomResetAria: 'Auto-fit zoom to screen',
  zoomResetTitle: 'Reset zoom to auto-fit',
  zoomIn: 'Zoom in',
  zoomInTitle: 'Zoom in (+10%)',
  zoomAuto: (pct: number) => `Zoom: ${pct}% (Auto)`,
  zoomManual: (pct: number) => `Zoom: ${pct}% (Click to reset to Auto)`,
  landscapeTitle: 'Best in landscape',
  landscapeBody: 'Rotate your device for a wider staff and more notes ahead.',
  landscapeDismissAria: 'Dismiss landscape tip',
  dismiss: 'Dismiss',

  // Footer
  keyPlayPause: 'Play/Pause',
  keyZoom: 'Zoom',
  keyAutoZoom: 'Auto Zoom',
  licenseInfo: 'License & Info',
  githubTitle: 'View Source Code on GitHub (AGPL-3.0-or-later)',

  // About
  aboutTitle: 'About Guidonica',
  closeDialog: 'Close dialog',
  aboutTaglineHtml:
    "High-performance, client-only web tool for sight-reading and solfège practice. Inspired by Guido d'Arezzo's <em>manus guidonica</em> and historic musical pedagogy, Guidonica continuously streams procedurally generated music notation across a fixed playhead in synchronization with a Web Audio synthesized metronome.",
  metaAuthor: 'Author',
  metaLicense: 'License',
  strictCopyleft: '(Strict Copyleft)',
  metaCopyright: 'Copyright',
  metaRepository: 'Repository',
  copyleftHeading: 'Strict Copyleft (AGPLv3)',
  copyleftHtml:
    'This software is free and open-source under the <strong>GNU Affero General Public License v3.0 or later</strong>. You are free to run, study, and modify it. In accordance with Section 13, any modified version deployed as a service over a computer network must make its complete source code available to all users.',
  thanksHeading: 'Third-Party Acknowledgements',
  thanksHtml: `Music notation layout and rendering powered by <a href="https://github.com/vexflow/vexflow" ${LINK}>VexFlow 5</a> (MIT License). Music glyphs from <a href="https://github.com/steinbergmedia/bravura" ${LINK}>Bravura</a> © Steinberg Media Technologies GmbH (SIL Open Font License 1.1), shipped as the renamed subset “Guidonica Notation”.`,
  viewLicense: 'View Full LICENSE',
  close: 'Close',

  // Intro
  introWelcome: 'Welcome to Guidonica',
  introChooseLevel: 'Choose your level',
  introTagline:
    'Pick your level and Guidonica loads matching practice material. Every option stays adjustable in Settings.',
  introLevelQuestion: "What's your level?",
  skip: 'Skip',
  cancel: 'Cancel',
  next: 'Next',
  introClefQuestion: 'Which clef would you like to read?',
  introClefNote: 'Soprano, mezzo-soprano and baritone clefs are in Settings → Staff.',
  back: 'Back',
  startPractising: 'Start practising',
  levels: {
    beginner: { name: 'Beginner', description: 'Steps & skips · whole to quarter notes · solfège labels · 50 BPM' },
    elementary: { name: 'Elementary', description: 'Up to 4ths · eighths, dots & rests · 60 BPM' },
    intermediate: { name: 'Intermediate', description: 'Up to 5ths · ties & eighth-note triplets · 72 BPM' },
    advanced: { name: 'Advanced', description: 'Up to the octave · sixteenths & triplets · 80 BPM' },
    virtuoso: { name: 'Virtuoso', description: 'Any leap · 32nds & every tuplet · 92 BPM' },
  } as LevelText,
  introClefs: {
    treble: { name: 'Treble', description: 'G clef · voice, violin, flute, piano right hand' },
    bass: { name: 'Bass', description: 'F clef · cello, bassoon, trombone, piano left hand' },
    alto: { name: 'Alto', description: 'C clef on the middle line · viola' },
    tenor: { name: 'Tenor', description: 'C clef on the fourth line · upper cello & bassoon' },
  } as IntroClefText,

  /** Note names indexed by c d e f g a b. Syllables keep the tonic sol-fa Ti. */
  noteNames: {
    syllables: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'],
    letters: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  },
  /** Octave convention of the range hint (see formatPitch in ../index.ts). */
  pitchNotation: 'scientific' as PitchNotation,
};

/** scientific: C4 = middle C · franco-belgian: Do3 = middle C · helmholtz: c¹ = middle C. */
export type PitchNotation = 'scientific' | 'franco-belgian' | 'helmholtz';

export type Messages = typeof en;
export default en;

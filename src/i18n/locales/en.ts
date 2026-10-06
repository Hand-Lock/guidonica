// Reference dictionary (ADR 0059): its shape defines `Messages`, and index.html's
// English shell text must match it (tests/i18n.test.ts). Every other locale is typed
// `Messages`, so a missing or extra key is a compile error.

import type { TimeSignature, TupletName, TupletValue } from '../../notation/types';
import type { IntroClef, LevelId } from '../../presets';
import type { TipId } from '../../tips';

type LevelText = Record<LevelId, { name: string; description: string }>;
type IntroClefText = Record<IntroClef, { name: string; description: string }>;
type IntroMeterText = Record<TimeSignature, string>;
type TipText = Record<TipId, { title: string; body: string }>;

const LINK = 'target="_blank" rel="noopener noreferrer" class="link-external"';

const en = {
  docTitle: 'Guidonica — Sight-Reading & Solfège Practice',
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
  compoundPulse: 'Pulse',
  compoundPulseAria: 'Compound meter pulse grouping',
  compoundPulseDotted: 'Dotted quarter (♩.)',
  compoundPulseEighth: 'Eighth (♪)',

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
  dottedTitle: 'Dotted Notes (wd in 12/8, hd, qd, 8d, 16d). 8d needs 16ths or 32nds, 16d needs 32nds',
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
  pitchClasses: 'Notes',
  pitchClassesTitle: 'Notes to read, in every octave of the range',
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
  intervalDormant: 'Cannot occur between the selected notes',
  intervalsFallback: 'No selected interval joins two of the selected notes, so every interval that does is used.',

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
  tipsToggle: 'Tips',
  tipsTitle: 'A short tip about Guidonica each time you open it',
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

  // Exercise link (ADR 0085)
  shareGroup: 'Share',
  shareButton: 'Exercise link',
  shareTitle: 'Send these exercise settings as a link. Language, theme and sound stay with each user.',
  shareText: 'Practise this sight-reading exercise on Guidonica',
  shareCopied: 'Link copied. Whoever opens it practises with these settings.',
  shareCopyPrompt: 'Copy this exercise link:',

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
  inAppTitle: 'Landscape in your browser',
  inAppBody: "This app can't rotate. Open Guidonica in your browser from the ⋯ menu.",
  dismiss: 'Dismiss',

  // Rotating tips (ADR 0087)
  tipDismissAria: 'Dismiss tip',
  tips: {
    levels: { title: 'Level presets', body: 'The level button in the header sets notes, rhythms, intervals and tempo in one click, from Beginner to Virtuoso.' },
    labels: { title: 'Note names', body: 'Show syllables or letters under the notes in Settings → Practice → Labels.' },
    keys: { title: 'Keyboard shortcuts', body: 'Space plays and pauses, R resets, P hides the playhead, ↑ and ↓ change the tempo, + and − zoom.' },
    pinch: { title: 'Pinch to zoom', body: 'Pinch the staff with two fingers to zoom. Tap the percentage to go back to auto zoom.' },
    clefs: { title: 'Eight clefs', body: 'Settings → Staff has the treble, bass and C clefs and both baritones, with ledger lines above and below.' },
    notes: { title: 'Fewer notes', body: 'In Settings → Melody → Notes, keep only the notes you are learning. They appear in every octave of the range.' },
    tuplets: { title: 'Tuplets', body: 'Add triplets, quintuplets and other tuplets in Settings → Rhythm → Tuplets.' },
    share: { title: 'Exercise links', body: 'Settings → Practice → Exercise link sends these settings to a student or a friend.' },
    restsTies: { title: 'Rests and ties', body: 'Turn on Rests and Ties in Settings → Rhythm for more realistic rhythms.' },
    pulse: { title: 'Compound pulse', body: 'In 6/8, 9/8 and 12/8 the click can follow the dotted quarter or every eighth: Settings → Staff → Pulse.' },
    install: { title: 'Works offline', body: 'After one visit Guidonica works without a connection. Add it to your home screen or install it from the browser menu.' },
    playhead: { title: 'Read without the playhead', body: 'Turn off Playhead in Settings → Practice → Assists to read without the red line.' },
    whatsNew: { title: "What's new", body: 'Every release brings something new. The release notes are always in About.' },
    follow: { title: 'Follow Guidonica', body: 'New releases and practice ideas on Bluesky, Mastodon and Instagram.' },
    support: { title: 'Support Guidonica', body: 'Guidonica is free, with no ads and no tracking. A tip on Ko-fi funds its development.' },
  } as TipText,

  // Footer
  keyPlayPause: 'Play/Pause',
  keyZoom: 'Zoom',
  keyAutoZoom: 'Auto Zoom',
  licenseInfo: 'License & Info',
  githubTitle: 'View Source Code on GitHub (AGPL-3.0-or-later)',
  blueskyTitle: 'Guidonica on Bluesky (@guidonica.it)',
  mastodonTitle: 'Guidonica on Mastodon (@guidonica@mastodon.social)',
  instagramTitle: 'Guidonica on Instagram (@guidonica.it)',

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
  metaFollow: 'Follow',
  metaPrivacy: 'Privacy',
  privacyNote: 'No accounts, no cookies, no tracking: nothing leaves your device.',
  metaVersion: 'Version',
  whatsNewButton: "What's new",
  nightly: 'Nightly',

  // What's new (ADR 0078)
  whatsNewTitle: "What's new",
  unreleased: 'Unreleased',
  fullChangelog: 'Full changelog on GitHub ↗',
  changeKinds: {
    added: 'New',
    changed: 'Changed',
    fixed: 'Fixed',
    removed: 'Removed',
    security: 'Security',
  },

  copyleftHeading: 'Strict Copyleft (AGPLv3)',
  copyleftHtml:
    'This software is free and open-source under the <strong>GNU Affero General Public License v3.0 or later</strong>. You are free to run, study, and modify it. In accordance with Section 13, any modified version deployed as a service over a computer network must make its complete source code available to all users.',
  trademarkHeading: 'Trademarks',
  trademarkHtml: `Guidonica™ and the Guidonian Hand logo are trademarks of A. C. Lo Cascio. The AGPL covers the code, not the brand: modified versions must use a different name and logo (see the <a href="https://github.com/Hand-Lock/guidonica/blob/main/TRADEMARKS.md" ${LINK}>trademark policy</a>).`,
  madeHeading: 'How Guidonica is made',
  madeBody:
    "Guidonica is designed, tested and maintained by A. C. Lo Cascio, who writes much of its code with an AI coding assistant (Anthropic's Claude) and reviews every change. No AI runs inside the app: exercises come from a random generator whose rules are documented in the source, and the metronome is synthesized live in your browser.",
  donate: 'Support',
  donateTitle: 'Support Guidonica',
  donateBody:
    "Guidonica is free, with no ads and no tracking. If it helps your practice, a voluntary tip funds its development. Tips unlock nothing: it's simply a thank-you.",
  donateCta: 'Leave a tip on Ko-fi',
  thanksHeading: 'Third-Party Acknowledgements',
  thanksHtml: `Music notation layout and rendering powered by <a href="https://github.com/vexflow/vexflow" ${LINK}>VexFlow 5</a> (MIT License). Music glyphs from <a href="https://github.com/steinbergmedia/bravura" ${LINK}>Bravura</a> © Steinberg Media Technologies GmbH (SIL Open Font License 1.1), shipped as the renamed subset “Guidonica Notation”. Text set in <a href="https://github.com/huertatipografica/Alegreya" ${LINK}>Alegreya</a> and <a href="https://github.com/huertatipografica/Alegreya-Sans" ${LINK}>Alegreya Sans</a> (SIL Open Font License 1.1) and <a href="https://design.ubuntu.com/font" ${LINK}>Ubuntu Mono</a> (Ubuntu Font Licence 1.0), served from this site.`,
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
  introMeterQuestion: 'Which time signature would you like to read?',
  back: 'Back',
  startPractising: 'Start practising',
  levels: {
    beginner: { name: 'Beginner', description: 'Do re mi sol la · steps & skips · whole to quarter notes · solfège labels · 60 BPM' },
    elementary: { name: 'Elementary', description: 'All notes · up to 5ths & octaves · eighths, dots & rests · 70 BPM' },
    intermediate: { name: 'Intermediate', description: 'Up to the octave · sixteenths, ties & eighth triplets · 80 BPM' },
    advanced: { name: 'Advanced', description: 'Any leap · 32nds & triplets · 90 BPM' },
    virtuoso: { name: 'Virtuoso', description: 'Everything · every tuplet · 120 BPM' },
  } as LevelText,
  introClefs: {
    treble: { name: 'Treble', description: 'G clef · voice, violin, flute, piano right hand' },
    bass: { name: 'Bass', description: 'F clef · cello, bassoon, trombone, piano left hand' },
    alto: { name: 'Alto', description: 'C clef on the middle line · viola' },
    tenor: { name: 'Tenor', description: 'C clef on the fourth line · upper cello & bassoon' },
  } as IntroClefText,
  introMeters: {
    '4/4': 'Simple quadruple · four quarter-note beats',
    '3/4': 'Simple triple · three quarter-note beats',
    '2/4': 'Simple duple · two quarter-note beats',
    '6/8': 'Compound duple · two dotted-quarter beats of three eighths',
    '9/8': 'Compound triple · three dotted-quarter beats of three eighths',
    '12/8': 'Compound quadruple · four dotted-quarter beats of three eighths',
  } as IntroMeterText,

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

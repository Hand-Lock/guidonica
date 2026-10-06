// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - High-Performance Procedural Sight-Reading Engine
// Copyright (C) 2026 A. C. Lo Cascio

import {
  AppSettings,
  BeatAccent,
  Clef,
  CompoundPulseMode,
  DEFAULT_TUPLET_OPTIONS,
  DEFAULT_ZOOM,
  IntervalOptions,
  MAX_ZOOM,
  MIN_ZOOM,
  PITCH_CLASSES,
  ResolvedTheme,
  SolfegeLabelMode,
  SoundProfile,
  TUPLET_NAMES,
  TUPLET_VALUES,
  ThemeMode,
  TimeSignature,
  TupletName,
  TupletOptions,
  TupletValue,
  ZOOM_STEP,
  ZoomMode,
  clampTempo,
  computeOptimalZoom,
  getBeatsPerMeasure,
  isCompound,
  isTupletSupported,
  resolveTheme,
  stageFitsStaff,
  subscribeSystemTheme,
  tempoMarking,
  tupletShape,
} from './notation/types';
import { globalState, SessionState } from './state';
import { MetronomeEngine } from './audio/metronome';
import { INTERVAL_KEYS, MusicGenerator, effectiveIntervals, pitchSteps } from './notation/generator';
import { MeasureRenderer } from './notation/renderer';
import { releasePreview, renderClefIcon, renderLevelPreview, renderMeterIcon } from './notation/preview';
import { MeasureBuffer } from './scroller/buffer';
import { ScrollerView } from './scroller/scroller';
import { isMusicFontReady, waitForMusicFonts } from './notation/fonts';
import { ScreenWakeLockController } from './utils/wakeLock';
import { bindRovingKeys, setRadioSelection } from './utils/radioGroup';
import { registerServiceWorker } from './utils/serviceWorker';
import { isPortraitLockedInAppBrowser } from './utils/inAppBrowser';
import {
  ENDONYMS,
  Language,
  SUPPORTED_LANGUAGES,
  applyDom,
  formatRange,
  getLanguage,
  isLanguage,
  loadLocale,
  pitchClassNames,
  t,
} from './i18n';

/** Tooltip of each interval chip, to which a dormant chip appends why (ADR 0070). */
const INTERVAL_TITLE_KEYS = {
  unison: 'intervalUnisonTitle',
  second: 'intervalSecondTitle',
  third: 'intervalThirdTitle',
  fourth: 'intervalFourthTitle',
  fifth: 'intervalFifthTitle',
  sixth: 'intervalSixthTitle',
  seventh: 'intervalSeventhTitle',
  octave: 'intervalOctaveTitle',
  ninthPlus: 'intervalNinthPlusTitle',
} as const satisfies Record<keyof IntervalOptions, string>;
import {
  dismissOrientationTip,
  hasStoredSettings,
  isOnboarded,
  isOrientationTipDismissed,
  loadSeenVersion,
  loadTipCount,
  markOnboarded,
  saveSeenVersion,
  saveTipCount,
} from './storage';
import { Tip, TipContext, pickTip } from './tips';
import {
  APP_VERSION,
  NOTES_LOADERS,
  ReleaseNotes,
  bootAction,
  releasesToShow,
  renderReleaseNotes,
  versionHref,
  versionLabel,
} from './whatsNew';
import { Exercise, decodeExercise, exerciseUrl } from './share';
import {
  INTRO_CLEFS,
  INTRO_METERS,
  IntroClef,
  LEVEL_PRESETS,
  LevelId,
  acceptsPreview,
  buildPresetSettings,
  buildPreviewSettings,
  levelIndex,
  matchLevel,
} from './presets';

interface WebKitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean; // iOS Safari home-screen apps
}

interface WebKitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export const FULLSCREEN_ENTER_PATH = 'M2.5 5.5V2.5h3 M13.5 5.5V2.5h-3 M2.5 10.5v3h3 M13.5 10.5v3h-3';
export const FULLSCREEN_EXIT_PATH = 'M5.5 2.5v3h-3 M10.5 2.5v3h3 M5.5 13.5v-3h-3 M10.5 13.5v-3h3';

class GuidonicaApp {
  private metronome: MetronomeEngine;
  private generator: MusicGenerator;
  private renderer: MeasureRenderer;
  private buffer: MeasureBuffer;
  private scroller: ScrollerView;
  private wakeLock: ScreenWakeLockController = new ScreenWakeLockController();
  private lastBeatIndex: number | null = null;
  private isAutoPaused: boolean = false;
  private fontInitPromise: Promise<void> | null = null;

  // DOM Elements - Playback & Tempo
  private btnPlayPause: HTMLButtonElement;
  private btnLabel: HTMLElement;
  private btnReset: HTMLButtonElement;
  private tempoSlider: HTMLInputElement;
  private tempoNumber: HTMLInputElement;
  private tempoTerm: HTMLElement | null;
  private countInBadge: HTMLElement;
  private beatDotsContainer: HTMLElement;

  // Primary Header Utilities
  private btnThemeToggle: HTMLButtonElement;
  private btnFullscreenToggle: HTMLButtonElement;
  private btnDrawerToggle: HTMLButtonElement;
  private btnLevelToggle: HTMLButtonElement | null;
  private levelSyncedSettings: Readonly<AppSettings> | null = null;
  private controlsDrawer: HTMLElement;

  // Drawer Configuration Elements
  private selectTimeSig: HTMLSelectElement;
  private groupCompoundPulse: HTMLElement;
  private selectCompoundPulse: HTMLSelectElement;
  private selectClef: HTMLSelectElement;
  private clefRangeHint: HTMLElement;
  private selectLedgerAbove: HTMLSelectElement;
  private selectLedgerBelow: HTMLSelectElement;
  private toggleRests: HTMLInputElement;
  private toggleCountIn: HTMLInputElement;
  private togglePlayhead: HTMLInputElement;
  private toggleTips: HTMLInputElement;
  private tipNotice: HTMLElement | null;
  /** The tip on screen this visit (ADR 0087); null once hidden. */
  private currentTip: Tip | null = null;
  private selectSolfegeMode: HTMLSelectElement;
  private selectLanguage: HTMLSelectElement | null;
  private selectSoundProfile: HTMLSelectElement;
  private selectTheme: HTMLSelectElement;
  private volumeSlider: HTMLInputElement;
  private btnVolumeMute: HTMLButtonElement;

  // Floating On-Canvas Zoom Pill
  private canvasZoomPill: HTMLElement;
  private btnPillZoomOut: HTMLButtonElement;
  private btnPillZoomReset: HTMLButtonElement;
  private pillZoomText: HTMLElement;
  private btnPillZoomIn: HTMLButtonElement;


  // Notes, Intervals & Subdivisions
  private noteCheckboxes: HTMLInputElement[]; // Indexed like PITCH_CLASSES
  private intervalsFallbackHint: HTMLElement;
  private intervalUnison: HTMLInputElement;
  private intervalSecond: HTMLInputElement;
  private intervalThird: HTMLInputElement;
  private intervalFourth: HTMLInputElement;
  private intervalFifth: HTMLInputElement;
  private intervalSixth: HTMLInputElement;
  private intervalSeventh: HTMLInputElement;
  private intervalOctave: HTMLInputElement;
  private intervalNinthPlus: HTMLInputElement;
  private intervalCheckboxes: HTMLInputElement[];

  private subdivQuarter: HTMLInputElement;
  private subdivEighth: HTMLInputElement;
  private subdivHalf: HTMLInputElement;
  private subdivWhole: HTMLInputElement;
  private subdivSixteenth: HTMLInputElement;
  private subdivThirtySecond: HTMLInputElement;
  private subdivDotted: HTMLInputElement;
  private subdivCheckboxes: HTMLInputElement[];
  private toggleTies: HTMLInputElement;

  // Tuplets
  private btnTupletsToggle: HTMLButtonElement;
  private tupletsBadge: HTMLElement;
  private tupletsPopover: HTMLElement;
  private btnTupletsClear: HTMLButtonElement;
  private btnTupletsClose: HTMLButtonElement;
  private tupletCheckboxes: HTMLInputElement[];

  // About & License Modal
  private modalAbout: HTMLDialogElement | null;
  private btnAboutToggle: HTMLButtonElement | null;
  private btnAboutClose: HTMLButtonElement | null;
  private btnAboutDismiss: HTMLButtonElement | null;
  private btnFooterAbout: HTMLButtonElement | null;

  // What's new (ADR 0078)
  private modalWhatsNew: HTMLDialogElement | null;
  private whatsNewBody: HTMLElement | null;

  // Level, clef & meter intro (ADRs 0049, 0071)
  private modalIntro: HTMLDialogElement | null;
  private introStepLevel: HTMLElement | null;
  private introStepClef: HTMLElement | null;
  private introStepMeter: HTMLElement | null;
  private btnIntroNext: HTMLButtonElement | null;
  private introLevelButtons: HTMLButtonElement[] = [];
  private introClefButtons: HTMLButtonElement[] = [];
  private introMeterButtons: HTMLButtonElement[] = [];
  private introLanguageButtons: HTMLButtonElement[] = [];
  private introFirstVisit: boolean = false;
  private introLevel: LevelId | null = null;
  private introClef: Clef = 'treble';
  private introMeter: TimeSignature = '4/4';
  private introLevelPreviews = new Map<LevelId, HTMLCanvasElement>();
  private introClefIcons = new Map<Clef, HTMLCanvasElement>();
  private introMeterIcons = new Map<TimeSignature, HTMLCanvasElement>();
  /** Clef and meter the level strips were last drawn in; null when they hold no pixels. */
  private introPreviewClef: Clef | null = null;
  private introPreviewMeter: TimeSignature | null = null;

  constructor(shared: Exercise | null) {
    // 0. First visit? Decide before hydration can persist any settings
    const firstVisit = !isOnboarded() && !hasStoredSettings();
    // A shared exercise link replaces the intro's level choice (ADR 0085)
    if (shared) {
      globalState.updateSettings(shared);
      markOnboarded();
    }
    const showIntro = firstVisit && !shared;

    // 1. Query all UI DOM elements
    this.btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
    this.btnLabel = this.btnPlayPause.querySelector('.btn-label') as HTMLElement;
    this.btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
    this.tempoSlider = document.getElementById('tempo-slider') as HTMLInputElement;
    this.tempoNumber = document.getElementById('tempo-number') as HTMLInputElement;
    this.tempoTerm = document.getElementById('tempo-term');
    this.countInBadge = document.getElementById('count-in-badge') as HTMLElement;
    this.beatDotsContainer = document.getElementById('beat-dots') as HTMLElement;

    this.btnThemeToggle = document.getElementById('btn-theme-toggle') as HTMLButtonElement;
    this.btnFullscreenToggle = document.getElementById('btn-fullscreen-toggle') as HTMLButtonElement;
    this.btnDrawerToggle = document.getElementById('btn-drawer-toggle') as HTMLButtonElement;
    this.btnLevelToggle = document.getElementById('btn-level-toggle') as HTMLButtonElement | null;
    this.controlsDrawer = document.getElementById('controls-drawer') as HTMLElement;

    this.selectTimeSig = document.getElementById('select-time-signature') as HTMLSelectElement;
    this.groupCompoundPulse = document.getElementById('group-compound-pulse') as HTMLElement;
    this.selectCompoundPulse = document.getElementById('select-compound-pulse') as HTMLSelectElement;
    this.selectClef = document.getElementById('select-clef') as HTMLSelectElement;
    this.clefRangeHint = document.getElementById('clef-range-hint') as HTMLElement;
    this.selectLedgerAbove = document.getElementById('select-ledger-above') as HTMLSelectElement;
    this.selectLedgerBelow = document.getElementById('select-ledger-below') as HTMLSelectElement;
    this.toggleRests = document.getElementById('toggle-rests') as HTMLInputElement;
    this.toggleTies = document.getElementById('toggle-ties') as HTMLInputElement;
    this.toggleCountIn = document.getElementById('toggle-count-in') as HTMLInputElement;
    this.togglePlayhead = document.getElementById('toggle-playhead') as HTMLInputElement;
    this.toggleTips = document.getElementById('toggle-tips') as HTMLInputElement;
    this.tipNotice = document.getElementById('tip-notice');
    this.selectSolfegeMode = document.getElementById('select-solfege-mode') as HTMLSelectElement;
    this.selectLanguage = document.getElementById('select-language') as HTMLSelectElement | null;
    this.selectSoundProfile = document.getElementById('select-sound-profile') as HTMLSelectElement;
    this.selectTheme = document.getElementById('select-theme') as HTMLSelectElement;
    this.volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
    this.btnVolumeMute = document.getElementById('btn-volume-mute') as HTMLButtonElement;

    this.canvasZoomPill = document.getElementById('canvas-zoom-pill') as HTMLElement;
    this.btnPillZoomOut = document.getElementById('btn-pill-zoom-out') as HTMLButtonElement;
    this.btnPillZoomReset = document.getElementById('btn-pill-zoom-reset') as HTMLButtonElement;
    this.pillZoomText = document.getElementById('pill-zoom-text') as HTMLElement;
    this.btnPillZoomIn = document.getElementById('btn-pill-zoom-in') as HTMLButtonElement;

    this.noteCheckboxes = PITCH_CLASSES.map((pc) => document.getElementById(`note-${pc}`) as HTMLInputElement);
    this.intervalsFallbackHint = document.getElementById('intervals-fallback-hint') as HTMLElement;

    this.intervalUnison = document.getElementById('interval-unison') as HTMLInputElement;
    this.intervalSecond = document.getElementById('interval-second') as HTMLInputElement;
    this.intervalThird = document.getElementById('interval-third') as HTMLInputElement;
    this.intervalFourth = document.getElementById('interval-fourth') as HTMLInputElement;
    this.intervalFifth = document.getElementById('interval-fifth') as HTMLInputElement;
    this.intervalSixth = document.getElementById('interval-sixth') as HTMLInputElement;
    this.intervalSeventh = document.getElementById('interval-seventh') as HTMLInputElement;
    this.intervalOctave = document.getElementById('interval-octave') as HTMLInputElement;
    this.intervalNinthPlus = document.getElementById('interval-ninth-plus') as HTMLInputElement;

    this.intervalCheckboxes = [
      this.intervalUnison,
      this.intervalSecond,
      this.intervalThird,
      this.intervalFourth,
      this.intervalFifth,
      this.intervalSixth,
      this.intervalSeventh,
      this.intervalOctave,
      this.intervalNinthPlus,
    ];

    this.subdivQuarter = document.getElementById('subdiv-quarter') as HTMLInputElement;
    this.subdivEighth = document.getElementById('subdiv-eighth') as HTMLInputElement;
    this.subdivHalf = document.getElementById('subdiv-half') as HTMLInputElement;
    this.subdivWhole = document.getElementById('subdiv-whole') as HTMLInputElement;
    this.subdivSixteenth = document.getElementById('subdiv-sixteenth') as HTMLInputElement;
    this.subdivThirtySecond = document.getElementById('subdiv-thirty-second') as HTMLInputElement;
    this.subdivDotted = document.getElementById('subdiv-dotted') as HTMLInputElement;

    this.subdivCheckboxes = [
      this.subdivQuarter,
      this.subdivEighth,
      this.subdivHalf,
      this.subdivWhole,
      this.subdivSixteenth,
      this.subdivThirtySecond,
      this.subdivDotted,
    ];

    this.btnTupletsToggle = document.getElementById('btn-tuplets-toggle') as HTMLButtonElement;
    this.tupletsBadge = document.getElementById('tuplets-badge') as HTMLElement;
    this.tupletsPopover = document.getElementById('tuplets-popover') as HTMLElement;
    this.btnTupletsClear = document.getElementById('btn-tuplets-clear') as HTMLButtonElement;
    this.btnTupletsClose = document.getElementById('btn-tuplets-close') as HTMLButtonElement;
    this.tupletCheckboxes = Array.from(
      this.tupletsPopover.querySelectorAll<HTMLInputElement>('input[data-tuplet]')
    );

    this.modalAbout = document.getElementById('modal-about') as HTMLDialogElement | null;
    this.btnAboutToggle = document.getElementById('btn-about-toggle') as HTMLButtonElement | null;
    this.btnAboutClose = document.getElementById('btn-about-close') as HTMLButtonElement | null;
    this.btnAboutDismiss = document.getElementById('btn-about-dismiss') as HTMLButtonElement | null;
    this.btnFooterAbout = document.getElementById('btn-footer-about') as HTMLButtonElement | null;
    this.modalWhatsNew = document.getElementById('modal-whats-new') as HTMLDialogElement | null;
    this.whatsNewBody = document.getElementById('whats-new-body');

    this.modalIntro = document.getElementById('modal-intro') as HTMLDialogElement | null;
    this.introStepLevel = document.getElementById('intro-step-level');
    this.introStepClef = document.getElementById('intro-step-clef');
    this.introStepMeter = document.getElementById('intro-step-meter');
    this.btnIntroNext = document.getElementById('btn-intro-next') as HTMLButtonElement | null;

    const canvas = document.getElementById('scroller-canvas') as HTMLCanvasElement;

    // 2. Initialize engines with stored settings
    const initialSettings = globalState.settings;
    this.metronome = new MetronomeEngine(initialSettings.tempo, initialSettings.timeSignature);
    this.metronome.setVolume(initialSettings.volume);
    this.metronome.setMuted(initialSettings.isMuted);
    this.metronome.setSoundProfile(initialSettings.soundProfile);
    this.metronome.setCompoundPulse(initialSettings.compoundPulse);

    this.generator = new MusicGenerator();
    this.renderer = new MeasureRenderer();
    this.renderer.setZoom(initialSettings.zoom || DEFAULT_ZOOM);
    this.buffer = new MeasureBuffer(this.generator, this.renderer);
    this.scroller = new ScrollerView(
      canvas,
      this.buffer,
      this.metronome,
      this.renderer,
      () => globalState.settings
    );
    this.scroller.setZoom(initialSettings.zoom || DEFAULT_ZOOM);

    // 3. Hydrate UI elements from stored settings
    this.hydrateUI(initialSettings);
    this.syncLevelButton(globalState.settings);

    // 4. Setup event wiring and subscriptions
    this.bindEvents();
    this.bindAboutModalEvents();
    this.bindShareEvents();
    this.bindWhatsNewEvents();
    this.bindTipEvents();
    this.updateVersionInfo();
    this.bindIntroModalEvents();
    this.bindKeyboardShortcuts();
    this.bindAudioEvents();
    this.bindLifecycleEvents();
    this.renderBeatDots(initialSettings.timeSignature);

    // 5. Initial idle frame (stationary staff lines & playhead)
    this.scroller.renderEmptyFrame();

    // 6. Subscribe to state changes for UI sync
    globalState.subscribe((state) => this.syncUI(state));
    this.syncUI(globalState.getState());

    // 7. Asynchronously await musical font readiness before generating notation measures
    this.fontInitPromise = this.initFonts();

    // 8. New visitors pick a level & clef (no AudioContext involved; audio waits for Start)
    if (showIntro) {
      this.openIntro(true);
    }

    // 9. Returning visitors see the release notes they missed; new ones never do (ADR 0078)
    const boot = bootAction(firstVisit, loadSeenVersion(), APP_VERSION);
    if (boot.kind === 'store') saveSeenVersion(APP_VERSION);
    else if (boot.kind === 'show') void this.openWhatsNew(boot.since);

    // 10. Returning visitors get one rotating tip, never over the intro or What's new (ADR 0087)
    if (!firstVisit && !shared && boot.kind !== 'show') this.showBootTip();
  }

  private hydrateUI(settings: typeof globalState.settings): void {
    // Apply theme to DOM and sync controls
    const resolved = resolveTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', resolved);
    this.updateThemeUI(settings.theme, resolved);

    // Tempo
    this.tempoSlider.value = String(settings.tempo);
    this.tempoNumber.value = String(settings.tempo);
    this.updateTempoTerm(settings.tempo);

    // Time signature & compound pulse
    this.selectTimeSig.value = settings.timeSignature;
    this.groupCompoundPulse.classList.toggle('hidden', !isCompound(settings.timeSignature));
    this.selectCompoundPulse.value = settings.compoundPulse;

    // Clef, ledger lines & range hint
    this.selectClef.value = settings.clef;
    this.selectLedgerAbove.value = String(settings.ledgerLines.above);
    this.selectLedgerBelow.value = String(settings.ledgerLines.below);
    this.updateClefRangeHint();

    // Rests, Ties, Count-In & Playhead
    this.toggleRests.checked = settings.rests;
    this.toggleTies.checked = settings.ties;
    this.toggleCountIn.checked = settings.countIn;
    this.togglePlayhead.checked = settings.showPlayhead !== false;
    this.toggleTips.checked = settings.showTips;

    // Sound & Display overlays
    this.selectSolfegeMode.value = settings.solfegeLabelMode;
    if (this.selectLanguage) this.selectLanguage.value = getLanguage();
    this.selectSoundProfile.value = settings.soundProfile;
    this.volumeSlider.value = String(settings.volume);
    this.updateMuteUI(settings.isMuted);

    // Intervals
    this.intervalUnison.checked = settings.intervals.unison;
    this.intervalSecond.checked = settings.intervals.second;
    this.intervalThird.checked = settings.intervals.third;
    this.intervalFourth.checked = settings.intervals.fourth;
    this.intervalFifth.checked = settings.intervals.fifth;
    this.intervalSixth.checked = settings.intervals.sixth;
    this.intervalSeventh.checked = settings.intervals.seventh;
    this.intervalOctave.checked = settings.intervals.octave;
    this.intervalNinthPlus.checked = settings.intervals.ninthPlus;

    // Notes (ADR 0070)
    PITCH_CLASSES.forEach((pc, i) => {
      this.noteCheckboxes[i].checked = settings.pitchClasses[pc];
    });
    this.updatePitchClassLabels();
    this.updateMelodyAvailability();

    // Subdivisions
    this.subdivQuarter.checked = settings.subdivisions.quarter;
    this.subdivEighth.checked = settings.subdivisions.eighth;
    this.subdivHalf.checked = settings.subdivisions.half;
    this.subdivWhole.checked = settings.subdivisions.whole;
    this.subdivSixteenth.checked = settings.subdivisions.sixteenth;
    this.subdivThirtySecond.checked = settings.subdivisions.thirtySecond === true;
    this.subdivDotted.checked = settings.subdivisions.dotted !== false;

    // Tuplets
    for (const cb of this.tupletCheckboxes) {
      const tName = cb.dataset.tuplet as TupletName | undefined;
      const tVal = cb.dataset.value as TupletValue | undefined;
      if (tName && tVal && settings.tuplets[tName]) {
        cb.checked = settings.tuplets[tName][tVal];
      }
    }
    this.applyTupletAvailability(settings.timeSignature);

    // Zoom
    const isAuto = settings.zoomMode === 'auto';
    const effectiveZoom = isAuto ? this.getEffectiveAutoZoom() : (settings.zoom || DEFAULT_ZOOM);
    this.applyZoom(effectiveZoom, isAuto ? 'auto' : 'manual');
  }

  private getEffectiveAutoZoom(): number {
    const viewportWidth = this.scroller ? this.scroller.getViewportWidth() : window.innerWidth;
    const settings = globalState.settings;
    return computeOptimalZoom(
      viewportWidth,
      settings.subdivisions,
      settings.timeSignature,
      settings.tuplets
    );
  }

  private syncAutoZoom(): void {
    const optimal = this.getEffectiveAutoZoom();
    this.applyZoom(optimal, 'auto');
  }

  private updateZoomUI(mode: ZoomMode, zoomVal: number): void {
    const isAuto = mode === 'auto';
    this.btnPillZoomReset.classList.toggle('active', isAuto);
    const pct = Math.round(zoomVal * 100);
    this.btnPillZoomReset.title = isAuto ? t().zoomAuto(pct) : t().zoomManual(pct);
  }

  private applyZoom(val: number, mode?: ZoomMode): void {
    const quantized = Math.round(val * 10) / 10;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
    const nextMode: ZoomMode = mode ?? 'manual';
    const percentStr = `${Math.round(clamped * 100)}%`;
    this.pillZoomText.textContent = percentStr;

    this.updateZoomUI(nextMode, clamped);

    if (globalState.settings.zoom === clamped && globalState.settings.zoomMode === nextMode) {
      return;
    }

    globalState.updateSettings({ zoom: clamped, zoomMode: nextMode });
    this.renderer.setZoom(clamped);
    this.scroller.setZoom(clamped);
    this.rerenderBuffer();
  }

  private adjustZoom(delta: number): void {
    const current = globalState.settings.zoom || DEFAULT_ZOOM;
    this.applyZoom(current + delta, 'manual');
  }

  private updateThemeUI(theme: ThemeMode, resolved: ResolvedTheme): void {
    // The button holds all three vector glyphs; CSS shows the one matching data-mode
    this.btnThemeToggle.dataset.mode = theme;
    const m = t();
    const names: Record<ThemeMode, string> = {
      auto: m.themeAutoResolved(resolved === 'dark' ? m.themeDark : m.themeLight),
      light: m.themeLight,
      dark: m.themeDark,
    };
    // Cycle: auto → dark → light → auto
    const next: Record<ThemeMode, string> = { auto: m.themeDark, dark: m.themeLight, light: m.themeAuto };
    this.btnThemeToggle.title = m.themeButtonTitle(names[theme], next[theme]);
    this.btnThemeToggle.setAttribute('aria-label', m.themeButtonAria(names[theme]));
    if (this.selectTheme) {
      this.selectTheme.value = theme;
    }
  }

  private syncFullscreenGlyph(): void {
    const doc = document as WebKitDocument;
    const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
    const iconPath = this.btnFullscreenToggle.querySelector<SVGPathElement>('#fullscreen-icon-path');
    if (iconPath) {
      iconPath.setAttribute('d', isFs ? FULLSCREEN_EXIT_PATH : FULLSCREEN_ENTER_PATH);
    }
    const label = isFs ? t().fullscreenExit : t().fullscreenToggle;
    this.btnFullscreenToggle.setAttribute('aria-label', label);
    this.btnFullscreenToggle.title = label;
  }

  private applyTheme(nextTheme: ThemeMode): void {
    const resolved = resolveTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', resolved);
    this.updateThemeUI(nextTheme, resolved);
    globalState.updateSettings({ theme: nextTheme });
    this.rerenderBuffer();
  }

  private async initFonts(): Promise<void> {
    await waitForMusicFonts();
    this.resetBuffer();
  }

  /**
   * Shares the current exercise as a link (ADR 0085): the system share sheet where there is
   * one, else the clipboard. The confirmation stays until the settings next change.
   */
  private bindShareEvents(): void {
    const button = document.getElementById('btn-share-exercise');
    const status = document.getElementById('share-status');
    if (!button || !status) return;
    let sharedSettings: Readonly<AppSettings> | null = null;
    globalState.subscribe((state) => {
      if (sharedSettings && state.settings !== sharedSettings) {
        sharedSettings = null;
        status.classList.add('hidden');
      }
    });
    button.addEventListener('click', async () => {
      const m = t();
      const url = exerciseUrl(globalState.settings, location.href);
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'Guidonica', text: m.shareText, url });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        status.textContent = m.shareCopied;
        status.classList.remove('hidden');
        sharedSettings = globalState.settings;
      } catch {
        window.prompt(m.shareCopyPrompt, url);
      }
    });
  }

  private bindEvents(): void {
    this.btnPlayPause.addEventListener('click', () => {
      this.btnPlayPause.blur();
      this.togglePlayback();
    });

    this.btnReset.addEventListener('click', () => {
      this.btnReset.blur();
      this.resetSession();
    });

    // Theme Toggle: Cycles auto -> dark -> light -> auto
    this.btnThemeToggle.addEventListener('click', () => {
      this.btnThemeToggle.blur();
      const currentTheme = globalState.settings.theme;
      let nextTheme: ThemeMode;
      if (currentTheme === 'auto') {
        nextTheme = 'dark';
      } else if (currentTheme === 'dark') {
        nextTheme = 'light';
      } else {
        nextTheme = 'auto';
      }
      this.applyTheme(nextTheme);
    });

    // Theme Select dropdown in settings drawer
    this.selectTheme.addEventListener('change', () => {
      const nextTheme = this.selectTheme.value as ThemeMode;
      this.applyTheme(nextTheme);
    });

    // Cross-Platform OS color scheme watcher
    subscribeSystemTheme((isDark) => {
      if (globalState.settings.theme === 'auto') {
        const resolved: ResolvedTheme = isDark ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolved);
        this.updateThemeUI('auto', resolved);
        this.rerenderBuffer();
      }
    });

    // Fullscreen Capability Detection & Auto-Hide
    if (!this.isFullscreenSupported()) {
      this.btnFullscreenToggle.classList.add('hidden');
      this.btnFullscreenToggle.setAttribute('aria-hidden', 'true');
      this.btnFullscreenToggle.tabIndex = -1;
    } else {
      this.btnFullscreenToggle.addEventListener('click', () => {
        this.btnFullscreenToggle.blur();
        const doc = document as WebKitDocument;
        const docEl = document.documentElement as WebKitElement;
        const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

        if (!isFs) {
          if (docEl.requestFullscreen) {
            void docEl.requestFullscreen().catch(() => {});
          } else if (docEl.webkitRequestFullscreen) {
            void docEl.webkitRequestFullscreen();
          }
        } else {
          if (doc.exitFullscreen) {
            void doc.exitFullscreen().catch(() => {});
          } else if (doc.webkitExitFullscreen) {
            void doc.webkitExitFullscreen();
          }
        }
      });

      const syncFullscreenGlyph = (): void => this.syncFullscreenGlyph();
      document.addEventListener('fullscreenchange', syncFullscreenGlyph);
      document.addEventListener('webkitfullscreenchange', syncFullscreenGlyph);
    }

    // Settings drawer: an in-flow card row on wide screens (open by default while the
    // staff still fits), an overlay sheet on narrow ones (closed by default, dismissed
    // by tapping the staff)
    const wideLayout = window.matchMedia?.('(min-width: 961px)');
    this.openDrawerByDefault(wideLayout?.matches === true);
    wideLayout?.addEventListener?.('change', (e) => this.openDrawerByDefault(e.matches));
    this.btnDrawerToggle.addEventListener('click', () => {
      this.setDrawerOpen(!this.controlsDrawer.classList.contains('open'));
    });

    // Tempo controls
    this.tempoSlider.addEventListener('input', (e) => {
      this.setTempo(Number((e.target as HTMLInputElement).value));
    });

    // While typing, only commit values already inside the valid range
    this.tempoNumber.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (val === clampTempo(val)) {
        this.setTempo(val);
      }
    });

    this.tempoNumber.addEventListener('change', (e) => {
      this.setTempo(Number((e.target as HTMLInputElement).value));
    });

    // Time Signature
    this.selectTimeSig.addEventListener('change', (e) => {
      const ts = (e.target as HTMLSelectElement).value as TimeSignature;
      this.groupCompoundPulse.classList.toggle('hidden', !isCompound(ts));
      this.metronome.setTimeSignature(ts);
      this.renderBeatDots(ts);
      globalState.updateSettings({ timeSignature: ts });
      this.applyTupletAvailability(ts);
      if (this.getBaseSubdivCount() === 0 && this.getActiveTupletCount() === 0) {
        this.subdivQuarter.checked = true;
        globalState.updateSettings({
          subdivisions: { ...globalState.settings.subdivisions, quarter: true },
        });
      }
      this.resetSession();
    });

    // Compound pulse
    this.selectCompoundPulse.addEventListener('change', (e) => {
      const pulse = (e.target as HTMLSelectElement).value as CompoundPulseMode;
      this.metronome.setCompoundPulse(pulse);
      globalState.updateSettings({ compoundPulse: pulse });
    });

    // Clef
    this.selectClef.addEventListener('change', (e) => {
      const clef = (e.target as HTMLSelectElement).value as Clef;
      globalState.updateSettings({ clef });
      this.updateClefRangeHint();
      this.resetSession();
    });

    // Ledger lines above / below the staff
    const onLedgerChange = (): void => {
      globalState.updateSettings({
        ledgerLines: {
          above: Number(this.selectLedgerAbove.value),
          below: Number(this.selectLedgerBelow.value),
        },
      });
      this.updateClefRangeHint();
      this.resetSession();
    };
    this.selectLedgerAbove.addEventListener('change', onLedgerChange);
    this.selectLedgerBelow.addEventListener('change', onLedgerChange);

    // Count-In
    this.toggleCountIn.addEventListener('change', () => {
      globalState.updateSettings({ countIn: this.toggleCountIn.checked });
    });

    // Playhead Visibility Toggle
    this.togglePlayhead.addEventListener('change', () => {
      const show = this.togglePlayhead.checked;
      globalState.updateSettings({ showPlayhead: show });
      this.renderIfIdle();
    });

    // Solfege Labels Mode
    this.selectSolfegeMode.addEventListener('change', (e) => {
      const mode = (e.target as HTMLSelectElement).value as SolfegeLabelMode;
      globalState.updateSettings({ solfegeLabelMode: mode });
      this.updatePitchClassLabels();
      this.rerenderBuffer();
    });

    // UI language & note naming (ADR 0059)
    this.selectLanguage?.addEventListener('change', (e) => {
      const lang = (e.target as HTMLSelectElement).value;
      if (isLanguage(lang)) void this.changeLanguage(lang);
    });

    // Sound Profile (Timbre)
    this.selectSoundProfile.addEventListener('change', (e) => {
      const profile = (e.target as HTMLSelectElement).value as SoundProfile;
      this.metronome.setSoundProfile(profile);
      globalState.updateSettings({ soundProfile: profile });
    });

    // Volume & Mute
    this.volumeSlider.addEventListener('input', (e) => {
      const vol = parseFloat((e.target as HTMLInputElement).value);
      this.metronome.setVolume(vol);
      globalState.updateSettings({ volume: vol });
    });

    this.btnVolumeMute.addEventListener('click', () => {
      const nextMuted = !globalState.settings.isMuted;
      this.metronome.setMuted(nextMuted);
      this.updateMuteUI(nextMuted);
      globalState.updateSettings({ isMuted: nextMuted });
    });

    // Responsive Auto-Zoom: follow the stage's measured size (ADR 0055)
    this.scroller.onResize(() => {
      if (globalState.settings.zoomMode === 'auto') {
        this.syncAutoZoom();
      }
    });

    // Floating On-Canvas Zoom Pill
    this.btnPillZoomOut.addEventListener('click', (e) => {
      e.stopPropagation();
      this.btnPillZoomOut.blur();
      this.adjustZoom(-ZOOM_STEP);
    });

    this.btnPillZoomIn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.btnPillZoomIn.blur();
      this.adjustZoom(ZOOM_STEP);
    });

    this.btnPillZoomReset.addEventListener('click', (e) => {
      e.stopPropagation();
      this.btnPillZoomReset.blur();
      this.syncAutoZoom();
    });

    // Portrait phone tip: CSS decides when it shows (ADR 0055); JS only remembers dismissal
    const orientationNotice = document.getElementById('orientation-notice');
    const btnOrientationDismiss = document.getElementById('btn-orientation-dismiss');
    if (orientationNotice) {
      if (isOrientationTipDismissed()) orientationNotice.hidden = true;
      // Instagram, Facebook and Threads can't rotate: point to the system browser (ADR 0083)
      if (isPortraitLockedInAppBrowser(navigator.userAgent)) {
        const title = orientationNotice.querySelector<HTMLElement>('strong[data-i18n]');
        const body = orientationNotice.querySelector<HTMLElement>('span[data-i18n]');
        if (title && body) {
          title.dataset.i18n = 'inAppTitle';
          body.dataset.i18n = 'inAppBody';
          applyDom(orientationNotice);
        }
      }
      btnOrientationDismiss?.addEventListener('click', (e) => {
        e.stopPropagation();
        orientationNotice.hidden = true;
        dismissOrientationTip();
      });
    }

    // Canvas Two-Finger Pinch-to-Zoom
    const canvas = document.getElementById('scroller-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.bindCanvasPinchZoom(canvas);
      canvas.addEventListener('pointerdown', () => {
        if (wideLayout?.matches !== true && this.controlsDrawer.classList.contains('open')) {
          this.setDrawerOpen(false);
        }
      });
    }

    // Intervals: ensure at least one interval remains checked
    const handleIntervalChange = (e: Event): void => {
      const checkedCount = this.intervalCheckboxes.filter((cb) => cb.checked).length;
      const target = e.target as HTMLInputElement;

      if (checkedCount === 0) {
        target.checked = true;
        return;
      }

      globalState.updateSettings({
        intervals: {
          unison: this.intervalUnison.checked,
          second: this.intervalSecond.checked,
          third: this.intervalThird.checked,
          fourth: this.intervalFourth.checked,
          fifth: this.intervalFifth.checked,
          sixth: this.intervalSixth.checked,
          seventh: this.intervalSeventh.checked,
          octave: this.intervalOctave.checked,
          ninthPlus: this.intervalNinthPlus.checked,
        },
      });
      this.updateMelodyAvailability();
      this.resetSession();
    };

    for (const cb of this.intervalCheckboxes) {
      cb.addEventListener('change', handleIntervalChange);
    }

    // Notes: ensure at least one note remains checked (ADR 0070)
    const handleNoteChange = (e: Event): void => {
      if (!this.noteCheckboxes.some((cb) => cb.checked)) {
        (e.target as HTMLInputElement).checked = true;
        return;
      }
      const pitchClasses = { ...globalState.settings.pitchClasses };
      PITCH_CLASSES.forEach((pc, i) => {
        pitchClasses[pc] = this.noteCheckboxes[i].checked;
      });
      globalState.updateSettings({ pitchClasses });
      this.updateClefRangeHint();
      this.resetSession();
    };

    for (const cb of this.noteCheckboxes) {
      cb.addEventListener('change', handleNoteChange);
    }

    // Subdivisions: ensure at least one base subdivision or tuplet remains checked
    const handleSubdivChange = (e: Event): void => {
      const baseCheckedCount = this.getBaseSubdivCount();
      const activeTupletCount = this.getActiveTupletCount();
      const target = e.target as HTMLInputElement;

      if (baseCheckedCount === 0 && activeTupletCount === 0) {
        target.checked = true;
        return;
      }

      globalState.updateSettings({
        subdivisions: {
          quarter: this.subdivQuarter.checked,
          eighth: this.subdivEighth.checked,
          half: this.subdivHalf.checked,
          whole: this.subdivWhole.checked,
          sixteenth: this.subdivSixteenth.checked,
          thirtySecond: this.subdivThirtySecond.checked,
          dotted: this.subdivDotted.checked,
        },
      });
      this.resetSession();
    };

    for (const cb of this.subdivCheckboxes) {
      cb.addEventListener('change', handleSubdivChange);
    }

    // Tuplets menu and matrix checkboxes
    this.bindTupletEvents();

    // Rests
    this.toggleRests.addEventListener('change', () => {
      globalState.updateSettings({ rests: this.toggleRests.checked });
      this.resetSession();
    });

    // Ties
    this.toggleTies.addEventListener('change', () => {
      globalState.updateSettings({ ties: this.toggleTies.checked });
      this.resetSession();
    });
  }

  private bindTupletEvents(): void {
    this.btnTupletsToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleTupletsPopover();
    });

    this.btnTupletsClose.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTupletsPopover();
    });

    this.btnTupletsClear.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearAllTuplets();
    });

    this.tupletsPopover.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.addEventListener('click', (e) => {
      if (
        !this.tupletsPopover.classList.contains('hidden') &&
        !this.tupletsPopover.contains(e.target as Node) &&
        !this.btnTupletsToggle.contains(e.target as Node)
      ) {
        this.closeTupletsPopover();
      }
    });

    for (const cb of this.tupletCheckboxes) {
      cb.addEventListener('change', () => {
        this.handleTupletChange();
      });
    }
  }

  private toggleTupletsPopover(): void {
    const isHidden = this.tupletsPopover.classList.contains('hidden');
    if (isHidden) {
      this.openTupletsPopover();
    } else {
      this.closeTupletsPopover();
    }
  }

  private openTupletsPopover(): void {
    this.tupletsPopover.classList.remove('hidden');
    // The desktop overlay is capped to the room below it; the ≤960 accordion scrolls with the sheet
    if (getComputedStyle(this.tupletsPopover).position === 'absolute') {
      const room = window.innerHeight - this.tupletsPopover.getBoundingClientRect().top - 12;
      this.tupletsPopover.style.maxHeight = `${Math.max(160, Math.floor(room))}px`;
    } else {
      this.tupletsPopover.style.maxHeight = '';
    }
    this.btnTupletsToggle.classList.add('open');
    this.btnTupletsToggle.setAttribute('aria-expanded', 'true');
  }

  private closeTupletsPopover(): void {
    this.tupletsPopover.classList.add('hidden');
    this.btnTupletsToggle.classList.remove('open');
    this.btnTupletsToggle.setAttribute('aria-expanded', 'false');
  }

  /** Counts checked tuplet cells that the current meter can actually generate. */
  private getActiveTupletCount(): number {
    return this.tupletCheckboxes.filter((cb) => cb.checked && !cb.disabled).length;
  }

  /**
   * Disables tuplet cells the generator cannot realise in `ts` (see TUPLET_SUPPORT).
   * The stored checked state is preserved so it reactivates when switching back.
   */
  private applyTupletAvailability(ts: TimeSignature): void {
    const m = t();
    for (const cb of this.tupletCheckboxes) {
      const tName = cb.dataset.tuplet as TupletName | undefined;
      const tVal = cb.dataset.value as TupletValue | undefined;
      const supported = !!tName && !!tVal && isTupletSupported(ts, tName, tVal);
      cb.disabled = !supported;
      const label = cb.closest('label');
      if (label && tName && tVal) {
        label.title = supported ? this.tupletTitle(ts, tName, tVal) : m.tupletUnavailable(ts);
      }
    }
    this.tupletsPopover.querySelectorAll<HTMLElement>('tr[data-row]').forEach((row) => {
      const name = row.dataset.row as TupletName | undefined;
      const header = row.querySelector('.th-row');
      if (name && header && name in m.tupletNames) {
        header.textContent = `${m.tupletNames[name]} (${tupletShape(ts, name, '1/4').notes})`;
      }
    });
    this.updateTupletsUI();
  }

  /** "Triplet · 3 eighths in the time of 2 (1 beat)"; spans off the half-beat grid are omitted. */
  private tupletTitle(ts: TimeSignature, name: TupletName, value: TupletValue): string {
    const m = t();
    const { notes, inTimeOf, beats } = tupletShape(ts, name, value);
    const base = m.tupletCell(m.tupletNames[name], notes, m.tupletValuePlurals[value], inTimeOf);
    return Number.isInteger(beats * 2) ? `${base} (${m.tupletBeats(beats)})` : base;
  }

  private getTupletOptionsFromUI(): TupletOptions {
    const options: TupletOptions = structuredClone(DEFAULT_TUPLET_OPTIONS);

    for (const cb of this.tupletCheckboxes) {
      const tupletName = cb.dataset.tuplet as TupletName | undefined;
      const tupletValue = cb.dataset.value as TupletValue | undefined;
      if (tupletName && tupletValue && options[tupletName]) {
        options[tupletName][tupletValue] = cb.checked;
      }
    }

    return options;
  }

  private updateTupletsUI(): void {
    const count = this.getActiveTupletCount();
    this.tupletsBadge.textContent = String(count);
    if (count > 0) {
      this.tupletsBadge.classList.remove('hidden');
      this.btnTupletsToggle.classList.add('has-active');
    } else {
      this.tupletsBadge.classList.add('hidden');
      this.btnTupletsToggle.classList.remove('has-active');
    }
  }

  private getBaseSubdivCount(): number {
    return [
      this.subdivQuarter,
      this.subdivEighth,
      this.subdivHalf,
      this.subdivWhole,
      this.subdivSixteenth,
      this.subdivThirtySecond,
    ].filter((cb) => cb.checked).length;
  }

  private handleTupletChange(): void {
    const activeTupletCount = this.getActiveTupletCount();
    const baseSubdivCount = this.getBaseSubdivCount();

    if (activeTupletCount === 0 && baseSubdivCount === 0) {
      this.subdivQuarter.checked = true;
      globalState.updateSettings({
        subdivisions: {
          ...globalState.settings.subdivisions,
          quarter: true,
        },
      });
    }

    const tuplets = this.getTupletOptionsFromUI();
    globalState.updateSettings({ tuplets });
    this.updateTupletsUI();
    this.resetSession();
  }

  private clearAllTuplets(): void {
    for (const cb of this.tupletCheckboxes) {
      cb.checked = false;
    }

    const baseSubdivCount = this.getBaseSubdivCount();
    if (baseSubdivCount === 0) {
      this.subdivQuarter.checked = true;
      globalState.updateSettings({
        subdivisions: {
          ...globalState.settings.subdivisions,
          quarter: true,
        },
      });
    }

    const tuplets = this.getTupletOptionsFromUI();
    globalState.updateSettings({ tuplets });
    this.updateTupletsUI();
    this.resetSession();
  }

  private bindAboutModalEvents(): void {
    const openModal = () => {
      if (this.modalAbout && typeof this.modalAbout.showModal === 'function') {
        this.modalAbout.showModal();
      }
    };

    const closeModal = () => {
      if (this.modalAbout && this.modalAbout.open) {
        this.modalAbout.close();
      }
    };

    this.btnAboutToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal();
    });

    this.btnFooterAbout?.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal();
    });

    this.btnAboutClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });

    this.btnAboutDismiss?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeModal();
    });

    // Close when clicking outside the dialog content (on the native backdrop)
    this.modalAbout?.addEventListener('click', (e) => {
      if (e.target === this.modalAbout) {
        closeModal();
      }
    });
  }

  /**
   * Shows the next tip in the rotation, unless tips are off or the portrait landscape
   * tip is on screen. Only a shown tip advances the stored count (ADR 0087).
   */
  private showBootTip(): void {
    const notice = this.tipNotice;
    if (!notice || !globalState.settings.showTips) return;
    const orientation = document.getElementById('orientation-notice');
    if (orientation && getComputedStyle(orientation).display !== 'none') return;
    const count = loadTipCount();
    this.currentTip = pickTip(count, this.tipContext());
    saveTipCount(count + 1);
    this.renderTip();
    notice.hidden = false;
  }

  private tipContext(): TipContext {
    const media = (query: string): boolean => window.matchMedia?.(query).matches === true;
    return {
      settings: globalState.settings,
      touch: media('(pointer: coarse)'),
      keyboard: media('(hover: hover) and (pointer: fine)'),
      standalone: media('(display-mode: standalone)') || (navigator as StandaloneNavigator).standalone === true,
    };
  }

  /** Writes the current tip in the active language and shows its one action. */
  private renderTip(): void {
    const tip = this.currentTip;
    if (!tip) return;
    const m = t();
    const title = document.getElementById('tip-title');
    const text = document.getElementById('tip-text');
    const action = document.getElementById('btn-tip-action');
    const kofi = document.getElementById('tip-kofi');
    const social = document.getElementById('tip-social');
    if (title) title.textContent = m.tips[tip.id].title;
    if (text) text.textContent = m.tips[tip.id].body;
    const kind = tip.action?.kind;
    const label =
      kind === 'settings' ? m.settings : kind === 'levels' ? m.levelPresets : kind === 'whatsNew' ? m.whatsNewButton : null;
    if (action) {
      action.hidden = label === null;
      action.textContent = label ?? '';
    }
    if (kofi) kofi.hidden = kind !== 'kofi';
    if (social) social.hidden = kind !== 'social';
  }

  /** Hides the tip for the rest of the visit. */
  private hideTip(): void {
    if (!this.tipNotice || this.tipNotice.hidden) return;
    this.tipNotice.hidden = true;
    this.currentTip = null;
  }

  private bindTipEvents(): void {
    this.toggleTips.addEventListener('change', () => {
      globalState.updateSettings({ showTips: this.toggleTips.checked });
      if (!this.toggleTips.checked) this.hideTip();
    });
    document.getElementById('btn-tip-dismiss')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideTip();
    });
    document.getElementById('btn-tip-action')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = this.currentTip?.action;
      this.hideTip();
      if (action?.kind === 'settings') {
        this.closeTupletsPopover();
        this.setDrawerOpen(true);
        document.querySelector(`.section-${action.section}`)?.scrollIntoView({ block: 'nearest' });
      } else if (action?.kind === 'levels') {
        this.closeTupletsPopover();
        this.openIntro(false);
      } else if (action?.kind === 'whatsNew') {
        void this.openWhatsNew(null);
      }
    });
    // External links open in a new tab; the tip has done its job
    document.getElementById('tip-kofi')?.addEventListener('click', () => this.hideTip());
    document.getElementById('tip-social')?.addEventListener('click', () => this.hideTip());
  }

  private bindWhatsNewEvents(): void {
    const dialog = this.modalWhatsNew;
    if (!dialog) return;
    const close = (): void => {
      if (dialog.open) dialog.close();
    };
    document.getElementById('btn-whats-new')?.addEventListener('click', (e) => {
      e.stopPropagation();
      void this.openWhatsNew(null);
    });
    document.getElementById('btn-whats-new-close')?.addEventListener('click', close);
    document.getElementById('btn-whats-new-dismiss')?.addEventListener('click', close);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) close();
    });
    // Escape, buttons and backdrop all end here: the shown notes count as seen
    dialog.addEventListener('close', () => saveSeenVersion(APP_VERSION));
  }

  /**
   * Shows the releases after `since` in the active language, or with null the full
   * history (Unreleased on top in nightly). A notes chunk that cannot load (offline and
   * not cached) skips the boot popup without marking the notes seen.
   */
  private async openWhatsNew(since: string | null): Promise<void> {
    const dialog = this.modalWhatsNew;
    const body = this.whatsNewBody;
    if (!dialog || !body || dialog.open || typeof dialog.showModal !== 'function') return;
    const lang = getLanguage();
    let notes: ReleaseNotes[];
    try {
      notes = (await NOTES_LOADERS[lang]()).default;
    } catch {
      return;
    }
    const releases = since === null ? notes : releasesToShow(notes, since, APP_VERSION);
    if (releases.length === 0) {
      if (since !== null) saveSeenVersion(APP_VERSION);
      return;
    }
    if (dialog.open) return;
    renderReleaseNotes(body, releases, t(), lang);
    body.scrollTop = 0;
    dialog.showModal();
  }

  /** About's version row: the release, or the nightly build and its commit (ADR 0078). */
  private updateVersionInfo(): void {
    const link = document.getElementById('about-version') as HTMLAnchorElement | null;
    if (!link) return;
    link.textContent = versionLabel(t());
    link.href = versionHref();
  }

  private bindIntroModalEvents(): void {
    const levelContainer = document.getElementById('intro-level-options');
    const clefContainer = document.getElementById('intro-clef-options');
    const meterContainer = document.getElementById('intro-meter-options');
    if (!this.modalIntro || !levelContainer || !clefContainer || !meterContainer) return;

    const m = t();
    this.introLevelButtons = this.buildIntroOptions(
      levelContainer,
      LEVEL_PRESETS.map((p) => ({ value: p.id, ...m.levels[p.id], preview: 'strip' })),
      (value) => {
        this.introLevel = value as LevelId;
        if (this.btnIntroNext) this.btnIntroNext.disabled = false;
      },
      (value, canvas) => this.introLevelPreviews.set(value as LevelId, canvas)
    );
    this.introClefButtons = this.buildIntroOptions(
      clefContainer,
      INTRO_CLEFS.map((clef) => ({ value: clef, ...m.introClefs[clef], preview: 'icon' })),
      (value) => {
        this.introClef = value as Clef;
      },
      (value, canvas) => this.introClefIcons.set(value as Clef, canvas)
    );
    // A meter card is named by its time signature; the locale describes it
    this.introMeterButtons = this.buildIntroOptions(
      meterContainer,
      INTRO_METERS.map((ts) => ({ value: ts, name: ts, description: m.introMeters[ts], preview: 'icon' })),
      (value) => {
        this.introMeter = value as TimeSignature;
      },
      (value, canvas) => this.introMeterIcons.set(value as TimeSignature, canvas)
    );
    this.buildIntroLanguages();

    const closeIntro = (): void => {
      if (this.modalIntro?.open) this.modalIntro.close();
    };

    this.btnLevelToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTupletsPopover();
      this.openIntro(false);
    });
    document.getElementById('btn-intro-close')?.addEventListener('click', closeIntro);
    document.getElementById('btn-intro-skip')?.addEventListener('click', closeIntro);
    this.btnIntroNext?.addEventListener('click', () => this.showIntroStep('clef'));
    document.getElementById('btn-intro-back')?.addEventListener('click', () => {
      // Show the step first: a hidden card reports clientWidth 0 to the window check
      this.showIntroStep('level');
      // Level examples follow the clef and meter picked on the later steps
      if (
        this.introPreviewClef !== null &&
        (this.introPreviewClef !== this.introClef || this.introPreviewMeter !== this.introMeter)
      ) {
        this.renderIntroLevelPreviews();
      }
    });
    document.getElementById('btn-intro-clef-next')?.addEventListener('click', () => this.showIntroStep('meter'));
    document.getElementById('btn-intro-meter-back')?.addEventListener('click', () => this.showIntroStep('clef'));
    document.getElementById('btn-intro-start')?.addEventListener('click', () => {
      if (this.introLevel) {
        this.applyLevelPreset(this.introLevel, this.introClef, this.introMeter);
      }
      closeIntro();
    });

    // Close on the native backdrop; Esc closes natively. Every exit counts as onboarded.
    this.modalIntro.addEventListener('click', (e) => {
      if (e.target === this.modalIntro) closeIntro();
    });
    this.modalIntro.addEventListener('close', () => {
      markOnboarded();
      // `close` is dispatched as a task: skip if the intro was reopened meanwhile
      if (!this.modalIntro?.open) this.releaseIntroPreviews();
    });
  }

  /**
   * Builds a roving-tabindex radiogroup of option cards inside `container`. An item with
   * a `preview` gets a decorative notation canvas, handed to `onPreview` (ADR 0050).
   */
  private buildIntroOptions(
    container: HTMLElement,
    items: readonly { value: string; name: string; description: string; preview?: 'strip' | 'icon' }[],
    onSelect: (value: string) => void,
    onPreview?: (value: string, canvas: HTMLCanvasElement) => void
  ): HTMLButtonElement[] {
    const buttons = items.map((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'intro-option';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.dataset.value = item.value;
      const name = document.createElement('span');
      name.className = 'intro-option-name';
      name.textContent = item.name;
      const desc = document.createElement('span');
      desc.className = 'intro-option-desc';
      desc.textContent = item.description;
      if (item.preview === 'icon') {
        // Clef or meter glyph first, then the text column
        const text = document.createElement('span');
        text.className = 'intro-option-text';
        text.append(name, desc);
        btn.append(this.createIntroPreview('intro-option-icon', item.value, onPreview), text);
      } else {
        btn.append(name, desc);
        if (item.preview === 'strip') {
          btn.append(this.createIntroPreview('intro-option-preview', item.value, onPreview));
        }
      }
      container.appendChild(btn);
      return btn;
    });

    // Radio semantics: focus always follows the selection
    const select = (btn: HTMLButtonElement): void => {
      setRadioSelection(buttons, btn.dataset.value ?? null);
      btn.focus();
      onSelect(btn.dataset.value ?? '');
    };

    for (const btn of buttons) {
      btn.addEventListener('click', () => select(btn));
    }
    bindRovingKeys(container, buttons, select);

    setRadioSelection(buttons, null);
    return buttons;
  }

  /** First-visit language chips (endonyms); picking one re-translates the dialog live (ADR 0059). */
  private buildIntroLanguages(): void {
    const container = document.getElementById('intro-language-options');
    if (!container) return;
    const buttons = SUPPORTED_LANGUAGES.map((lang) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'intro-language';
      btn.setAttribute('role', 'radio');
      btn.lang = lang;
      btn.dataset.value = lang;
      btn.textContent = ENDONYMS[lang];
      container.appendChild(btn);
      return btn;
    });
    const select = (btn: HTMLButtonElement): void => {
      const lang = btn.dataset.value;
      if (!isLanguage(lang)) return;
      setRadioSelection(buttons, lang);
      btn.focus();
      void this.changeLanguage(lang);
    };
    for (const btn of buttons) {
      btn.addEventListener('click', () => select(btn));
    }
    bindRovingKeys(container, buttons, select);
    setRadioSelection(buttons, getLanguage());
    this.introLanguageButtons = buttons;
  }

  /** Re-labels the intro cards and title in the active language. */
  private translateIntro(): void {
    const m = t();
    const label = (btn: HTMLButtonElement, text: { name: string; description: string }): void => {
      const name = btn.querySelector('.intro-option-name');
      const desc = btn.querySelector('.intro-option-desc');
      if (name) name.textContent = text.name;
      if (desc) desc.textContent = text.description;
    };
    for (const btn of this.introLevelButtons) {
      const id = btn.dataset.value as LevelId;
      if (id in m.levels) label(btn, m.levels[id]);
    }
    for (const btn of this.introClefButtons) {
      const clef = btn.dataset.value as IntroClef;
      if (clef in m.introClefs) label(btn, m.introClefs[clef]);
    }
    for (const btn of this.introMeterButtons) {
      const ts = btn.dataset.value as TimeSignature;
      if (ts in m.introMeters) label(btn, { name: ts, description: m.introMeters[ts] });
    }
    const title = document.getElementById('intro-title-text');
    const skip = document.getElementById('btn-intro-skip');
    if (title) title.textContent = this.introFirstVisit ? m.introWelcome : m.introChooseLevel;
    if (skip) skip.textContent = this.introFirstVisit ? m.skip : m.cancel;
  }

  /**
   * Persists the language, loads its dictionary and re-runs every text updater. A
   * superseded or failed load leaves the UI in the language that is actually active.
   */
  private async changeLanguage(lang: Language): Promise<void> {
    let loaded = false;
    try {
      loaded = await loadLocale(lang);
    } catch {
      loaded = false;
    }
    if (!loaded) {
      if (this.selectLanguage) this.selectLanguage.value = getLanguage();
      return;
    }
    globalState.updateSettings({ language: lang });
    this.applyTranslations();
  }

  /** Static text by data-i18n attributes, then every dynamic label (ADR 0059). */
  private applyTranslations(): void {
    applyDom(document);
    const settings = globalState.settings;
    if (this.selectLanguage) this.selectLanguage.value = getLanguage();
    setRadioSelection(this.introLanguageButtons, getLanguage());
    this.syncUI(globalState.getState());
    this.syncLevelButton(settings, true);
    this.updateZoomUI(settings.zoomMode, settings.zoom || DEFAULT_ZOOM);
    this.updateThemeUI(settings.theme, resolveTheme(settings.theme));
    this.syncFullscreenGlyph();
    this.applyTupletAvailability(settings.timeSignature);
    this.updateClefRangeHint();
    this.updatePitchClassLabels();
    this.translateIntro();
    this.updateVersionInfo();
    this.renderTip();
    if (settings.solfegeLabelMode !== 'none') {
      this.rerenderBuffer();
      // The Beginner strip shows note labels too
      if (this.modalIntro?.open && this.introPreviewClef !== null) this.renderIntroLevelPreviews();
    }
  }

  private createIntroPreview(
    className: string,
    value: string,
    onPreview?: (value: string, canvas: HTMLCanvasElement) => void
  ): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.className = className;
    // Decorative: the card text already describes the option
    canvas.setAttribute('aria-hidden', 'true');
    releasePreview(canvas);
    onPreview?.(value, canvas);
    return canvas;
  }

  /** Fresh examples of every level in the chosen clef and meter, plus the clef and meter icons. */
  private renderIntroPreviews(): void {
    this.renderIntroLevelPreviews();
    const theme = globalState.settings.theme;
    for (const [clef, canvas] of this.introClefIcons) {
      renderClefIcon(canvas, clef, theme);
    }
    for (const [ts, canvas] of this.introMeterIcons) {
      renderMeterIcon(canvas, ts, theme);
    }
  }

  /** Each strip samples its level's representation (ADR 0051), filtered by its signature (ADR 0052). */
  private renderIntroLevelPreviews(): void {
    for (const [level, canvas] of this.introLevelPreviews) {
      const settings = { ...globalState.settings, ...buildPreviewSettings(level, this.introClef, this.introMeter) };
      renderLevelPreview(canvas, settings, (w) => acceptsPreview(level, w));
    }
    this.introPreviewClef = this.introClef;
    this.introPreviewMeter = this.introMeter;
  }

  private releaseIntroPreviews(): void {
    for (const canvas of this.introLevelPreviews.values()) releasePreview(canvas);
    for (const canvas of this.introClefIcons.values()) releasePreview(canvas);
    for (const canvas of this.introMeterIcons.values()) releasePreview(canvas);
    this.introPreviewClef = null;
    this.introPreviewMeter = null;
  }

  /** First visit welcomes and offers Skip; a reopen from the header is a plain level picker. */
  private openIntro(firstVisit: boolean): void {
    if (!this.modalIntro || typeof this.modalIntro.showModal !== 'function') return;
    this.introFirstVisit = firstVisit;
    this.translateIntro();
    const languages = document.getElementById('intro-language-options');
    if (languages) languages.hidden = !firstVisit;
    setRadioSelection(this.introLanguageButtons, getLanguage());
    const settings = globalState.settings;
    this.introLevel = matchLevel(settings);
    this.introClef = (INTRO_CLEFS as readonly Clef[]).includes(settings.clef) ? settings.clef : 'treble';
    this.introMeter = INTRO_METERS.includes(settings.timeSignature) ? settings.timeSignature : '4/4';
    setRadioSelection(this.introLevelButtons, this.introLevel);
    setRadioSelection(this.introClefButtons, this.introClef);
    setRadioSelection(this.introMeterButtons, this.introMeter);
    if (this.btnIntroNext) this.btnIntroNext.disabled = this.introLevel === null;
    if (!this.modalIntro.open) this.modalIntro.showModal();
    this.showIntroStep('level');
    // On a first visit the intro opens before the music font has loaded: wait to avoid tofu
    void this.fontInitPromise?.then(() => {
      if (this.modalIntro?.open) this.renderIntroPreviews();
    });
  }

  private showIntroStep(step: 'level' | 'clef' | 'meter'): void {
    if (!this.introStepLevel || !this.introStepClef || !this.introStepMeter) return;
    this.introStepLevel.hidden = step !== 'level';
    this.introStepClef.hidden = step !== 'clef';
    this.introStepMeter.hidden = step !== 'meter';
    const buttons = {
      level: this.introLevelButtons,
      clef: this.introClefButtons,
      meter: this.introMeterButtons,
    }[step];
    const checked = buttons.find((b) => b.getAttribute('aria-checked') === 'true');
    (checked ?? buttons[0]?.parentElement)?.focus();
  }

  /** Loads a level preset with the chosen clef and meter; only user-visible settings change. */
  private applyLevelPreset(level: LevelId, clef: Clef, meter: TimeSignature): void {
    globalState.updateSettings(buildPresetSettings(level, clef, meter));
    const s = globalState.settings;
    this.metronome.setTempo(s.tempo);
    this.metronome.setTimeSignature(s.timeSignature);
    this.renderBeatDots(s.timeSignature);
    this.hydrateUI(s); // Syncs every control, tuplet availability and auto zoom
    this.resetSession(); // Stops playback and regenerates the buffer
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Leave browser/OS chords (Cmd+R reload, Ctrl +/- zoom, Alt menus) untouched
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // If a modal (About, What's new, level intro) is open, ignore global app shortcuts
      if (this.modalAbout?.open || this.modalIntro?.open || this.modalWhatsNew?.open) {
        return;
      }

      // If popover is open, Escape should dismiss it first
      if (e.code === 'Escape' && !this.tupletsPopover.classList.contains('hidden')) {
        e.preventDefault();
        this.closeTupletsPopover();
        return;
      }

      // Prevent rapid fire on key-repeat for action triggers
      if (e.repeat && (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Escape')) {
        return;
      }

      const target = e.target as HTMLElement;

      // Crucial Fix: When focus is on a checkbox or radio button, preserve native Space key behavior!
      if (target.tagName === 'INPUT') {
        const input = target as HTMLInputElement;
        if (input.type === 'checkbox' || input.type === 'radio') {
          return; // Native checkbox toggle
        }
        if (e.code === 'Space') {
          e.preventDefault();
          this.togglePlayback();
          return;
        }
        if (e.code === 'Escape') {
          input.blur();
          this.resetSession();
          return;
        }
        return;
      }

      if (target.tagName === 'SELECT') {
        if (e.code === 'Escape') {
          target.blur();
          this.resetSession();
          return;
        }
        return;
      }

      if (target.tagName === 'BUTTON' && e.code === 'Space') {
        e.preventDefault();
        target.blur();
        this.togglePlayback();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayback();
      } else if (e.code === 'KeyR' || e.code === 'Escape') {
        e.preventDefault();
        this.resetSession();
      } else if (e.code === 'KeyP') {
        e.preventDefault();
        const nextVal = !(globalState.settings.showPlayhead !== false);
        this.togglePlayhead.checked = nextVal;
        globalState.updateSettings({ showPlayhead: nextVal });
        this.renderIfIdle();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const delta = e.shiftKey ? 1 : 5;
        this.setTempo(globalState.settings.tempo + delta);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const delta = e.shiftKey ? -1 : -5;
        this.setTempo(globalState.settings.tempo + delta);
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        this.adjustZoom(ZOOM_STEP);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        this.adjustZoom(-ZOOM_STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        this.syncAutoZoom();
      }
    });
  }

  private bindCanvasPinchZoom(canvas: HTMLCanvasElement): void {
    let initialDistance: number | null = null;
    let initialZoom: number = DEFAULT_ZOOM;

    const getDistance = (touch1: Touch, touch2: Touch): number => {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    canvas.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          initialDistance = getDistance(e.touches[0], e.touches[1]);
          initialZoom = globalState.settings.zoom || DEFAULT_ZOOM;
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (e.touches.length === 2 && initialDistance !== null && initialDistance > 0) {
          e.preventDefault();
          const currentDistance = getDistance(e.touches[0], e.touches[1]);
          const scaleFactor = currentDistance / initialDistance;
          const targetZoom = Math.round(initialZoom * scaleFactor * 10) / 10;
          this.applyZoom(targetZoom, 'manual');
        }
      },
      { passive: false }
    );

    const endPinch = (): void => {
      initialDistance = null;
    };

    canvas.addEventListener('touchend', endPinch);
    canvas.addEventListener('touchcancel', endPinch);
  }

  private setTempo(bpm: number): void {
    const next = clampTempo(bpm);
    this.tempoSlider.value = String(next);
    this.tempoNumber.value = String(next);
    this.updateTempoTerm(next);
    this.metronome.setTempo(next);
    globalState.updateSettings({ tempo: next });
    this.renderIfIdle();
  }

  private updateTempoTerm(bpm: number): void {
    if (this.tempoTerm) {
      this.tempoTerm.textContent = tempoMarking(bpm);
    }
  }

  private updateMuteUI(isMuted: boolean): void {
    // Speaker / muted glyphs are swapped by CSS on the .muted class
    this.btnVolumeMute.classList.toggle('muted', isMuted);
    this.btnVolumeMute.setAttribute('aria-pressed', String(isMuted));
  }

  private setDrawerOpen(isOpen: boolean): void {
    this.controlsDrawer.classList.toggle('open', isOpen);
    this.btnDrawerToggle.setAttribute('aria-expanded', String(isOpen));
  }

  /**
   * Opens the in-flow desktop drawer, then closes it again when it would leave the
   * stage shorter than the measure canvas at the current zoom (ADR 0054). Reads
   * layout once, at init and on breakpoint changes only.
   */
  private openDrawerByDefault(wide: boolean): void {
    this.setDrawerOpen(wide);
    if (!wide) return;
    const stage = document.querySelector<HTMLElement>('.canvas-wrapper');
    if (stage && !stageFitsStaff(stage.clientHeight, this.scroller.getZoom())) {
      this.setDrawerOpen(false);
    }
  }

  /** Repaints a single frame when the rAF loop is not running (paused/stopped). */
  private renderIfIdle(): void {
    if (globalState.playbackState === 'paused' || globalState.playbackState === 'stopped') {
      this.renderIdleFrame();
    }
  }

  private renderIdleFrame(): void {
    if (isMusicFontReady()) {
      this.scroller.renderFrame();
    } else {
      this.scroller.renderEmptyFrame();
    }
  }

  private bindAudioEvents(): void {
    this.scroller.onFrame(() => this.syncBeatIndicator());

    // Handle OS-level audio interruptions (system sleep, Bluetooth disconnect, phone call)
    this.metronome.onInterruption(() => {
      if (globalState.playbackState === 'playing' || globalState.playbackState === 'counting-in') {
        this.pausePlayback();
      }
    });
  }

  private bindLifecycleEvents(): void {
    // 1. Page Visibility API: Auto-pause when tab is hidden, minimized, or device locked
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (globalState.playbackState === 'playing' || globalState.playbackState === 'counting-in') {
          this.isAutoPaused = true;
          this.pausePlayback();
        }
      } else {
        // Tab returned to foreground
        if (this.isAutoPaused) {
          this.isAutoPaused = false;
          // Render current paused frame cleanly
          this.renderIdleFrame();
        }
      }
    });

    // 2. Pagehide & Freeze (Page Lifecycle API / background tab memory saver)
    window.addEventListener('pagehide', () => {
      if (globalState.playbackState === 'playing' || globalState.playbackState === 'counting-in') {
        this.isAutoPaused = true;
        this.pausePlayback();
      }
    });

    document.addEventListener('freeze', () => {
      if (globalState.playbackState === 'playing' || globalState.playbackState === 'counting-in') {
        this.isAutoPaused = true;
        this.pausePlayback();
      }
    });
  }

  private async startPlayback(): Promise<void> {
    if (!isMusicFontReady() && this.fontInitPromise) {
      await this.fontInitPromise;
    }
    const hasCountIn = globalState.settings.countIn;
    globalState.setPlaybackState(hasCountIn ? 'counting-in' : 'playing');
    this.metronome.start(hasCountIn);
    this.scroller.startLoop();
    void this.wakeLock.acquire();
  }

  private pausePlayback(): void {
    globalState.setPlaybackState('paused');
    this.metronome.pause();
    this.scroller.stopLoop();
    void this.wakeLock.release();
  }

  private async resumePlayback(): Promise<void> {
    if (!isMusicFontReady() && this.fontInitPromise) {
      await this.fontInitPromise;
    }
    const nextState = this.metronome.isCountingIn() ? 'counting-in' : 'playing';
    globalState.setPlaybackState(nextState);
    this.metronome.resume();
    this.scroller.startLoop();
    void this.wakeLock.acquire();
  }

  private async togglePlayback(): Promise<void> {
    // Unlock audio synchronously while the user gesture is still active
    this.metronome.unlock();
    const state = globalState.playbackState;
    if (state === 'stopped') {
      await this.startPlayback();
    } else if (state === 'counting-in' || state === 'playing') {
      this.pausePlayback();
    } else if (state === 'paused') {
      await this.resumePlayback();
    }
  }

  /** Lowest and highest selected pitch, then the interval chips that depend on the pool. */
  private updateClefRangeHint(): void {
    const { clef, ledgerLines, pitchClasses } = globalState.settings;
    const steps = pitchSteps(clef, ledgerLines, pitchClasses);
    this.clefRangeHint.textContent = formatRange(steps[0], steps[steps.length - 1]);
    this.clefRangeHint.title = t().rangeTitle;
    this.updateMelodyAvailability();
  }

  /** Notes chip names: the Labels table, else the national convention (ADR 0070). */
  private updatePitchClassLabels(): void {
    const names = pitchClassNames(globalState.settings.solfegeLabelMode);
    this.noteCheckboxes.forEach((cb, i) => {
      const label = cb.nextElementSibling;
      if (label) label.textContent = names[i];
    });
  }

  /**
   * Dims the interval chips no pair of selected notes spans (they stay clickable) and shows
   * the fallback hint when the walk uses every joining interval instead (ADR 0070).
   */
  private updateMelodyAvailability(): void {
    const { clef, ledgerLines, pitchClasses, intervals } = globalState.settings;
    const { dormant, fallback } = effectiveIntervals(intervals, pitchSteps(clef, ledgerLines, pitchClasses));
    const m = t();
    INTERVAL_KEYS.forEach((key, i) => {
      const label = this.intervalCheckboxes[i].closest('label');
      if (!label) return;
      const isDormant = dormant.includes(key);
      label.classList.toggle('is-dormant', isDormant);
      const title = m[INTERVAL_TITLE_KEYS[key]];
      label.title = isDormant ? `${title} · ${m.intervalDormant}` : title;
    });
    this.intervalsFallbackHint.classList.toggle('hidden', !fallback);
  }

  private resetSession(): void {
    this.isAutoPaused = false;
    this.metronome.stop();
    this.scroller.stopLoop();
    void this.wakeLock.release();
    globalState.setPlaybackState('stopped');

    if (globalState.settings.zoomMode === 'auto') {
      const optimal = this.getEffectiveAutoZoom();
      this.applyZoom(optimal, 'auto');
    }

    this.resetBuffer();
    this.resetBeatDots();
  }

  /** Visual-only change (theme, solfège, zoom): re-rasterize without regenerating music. */
  private rerenderBuffer(): void {
    this.scroller.invalidatePinnedClef();
    this.buffer.rerender(globalState.settings);
    this.renderIdleFrame();
  }

  /** Musical reset: discards generated measures and restarts the generator. */
  private resetBuffer(): void {
    this.scroller.invalidatePinnedClef();
    this.buffer.reset();
    if (!isMusicFontReady()) {
      this.scroller.renderEmptyFrame();
      return;
    }
    const settings = globalState.settings;
    const initialBeat = this.metronome.getVisualBeat();
    this.buffer.ensureAhead(initialBeat, 16, settings);
    this.scroller.renderFrame(settings);
  }

  /** One LED per metric beat; compound meters group them in threes, beat-start LEDs full size (ADR 0076). */
  private renderBeatDots(ts: TimeSignature): void {
    this.beatDotsContainer.innerHTML = '';
    const compound = isCompound(ts);
    this.beatDotsContainer.classList.toggle('compound', compound);
    const dotsCount = getBeatsPerMeasure(ts);

    for (let i = 1; i <= dotsCount; i++) {
      const dot = document.createElement('div');
      dot.className = compound && (i - 1) % 3 !== 0 ? 'beat-dot sub' : 'beat-dot';
      dot.dataset.beat = String(i);
      this.beatDotsContainer.appendChild(dot);
    }
  }

  /**
   * Polled once per rendered frame: derives the audible beat from the hardware
   * clock and updates the indicator only when the integer beat changes.
   */
  private syncBeatIndicator(): void {
    const info = this.metronome.getBeatInfo();
    const beatIndex = info ? info.beatIndex : null;
    if (beatIndex === this.lastBeatIndex) return;
    this.lastBeatIndex = beatIndex;

    if (!info) {
      this.resetBeatDots();
      return;
    }

    globalState.setBeat(info.beatNumber, info.isDownbeat, info.isCountIn);
    if (!info.isCountIn && globalState.playbackState === 'counting-in') {
      globalState.setPlaybackState('playing');
    }
    this.highlightBeatDot(info.beatNumber, info.accent);
  }

  /** Lights one LED in its accent colour: ruby downbeat, orange middle pulse, Olo weak beat (ADR 0072). */
  private highlightBeatDot(beatNumber: number, accent: BeatAccent): void {
    const dots = this.beatDotsContainer.querySelectorAll('.beat-dot');
    dots.forEach((dot) => dot.classList.remove('active', 'downbeat', 'secondary'));

    const target = this.beatDotsContainer.querySelector(`[data-beat="${beatNumber}"]`);
    if (target) {
      target.classList.add('active');
      if (accent === 'primary') {
        target.classList.add('downbeat');
      } else if (accent === 'secondary') {
        target.classList.add('secondary');
      }
    }
  }

  private resetBeatDots(): void {
    this.lastBeatIndex = null;
    const dots = this.beatDotsContainer.querySelectorAll('.beat-dot');
    dots.forEach((dot) => dot.classList.remove('active', 'downbeat', 'secondary'));
  }

  /** Sizes the header dumbbell's plates and names the matching preset, or Custom (ADR 0053, 0073). */
  private syncLevelButton(settings: Readonly<AppSettings>, force: boolean = false): void {
    // updateSettings replaces the object: identity skips the beat-rate notifications
    if (!this.btnLevelToggle || (settings === this.levelSyncedSettings && !force)) return;
    this.levelSyncedSettings = settings;
    const index = levelIndex(settings);
    const m = t();
    const name = index === 0 ? m.levelCustom : m.levels[LEVEL_PRESETS[index - 1].id].name;
    this.btnLevelToggle.dataset.level = String(index);
    this.btnLevelToggle.setAttribute('aria-label', m.levelAria(name));
    const label = this.btnLevelToggle.querySelector('.btn-label');
    if (label) label.textContent = name;
  }

  private syncUI(state: SessionState): void {
    this.syncLevelButton(state.settings);
    if (state.playbackState !== 'stopped') this.hideTip();

    if (state.playbackState === 'counting-in' || state.playbackState === 'playing') {
      this.btnLabel.textContent = t().pause;
      this.btnPlayPause.classList.add('playing');
    } else if (state.playbackState === 'paused') {
      this.btnLabel.textContent = t().resume;
      this.btnPlayPause.classList.remove('playing');
    } else {
      this.btnLabel.textContent = t().start;
      this.btnPlayPause.classList.remove('playing');
    }

    if (state.isCountIn) {
      this.countInBadge.classList.remove('hidden');
    } else {
      this.countInBadge.classList.add('hidden');
    }
  }

  /**
   * Evaluates if the current browser and device environment supports the W3C Fullscreen API
   * for arbitrary HTML elements. Returns false on iPhone/iPod, sandboxed iframes, or non-supporting browsers.
   */
  private isFullscreenSupported(): boolean {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return false;
    }

    // 1. Explicit exclusion of iPhone and iPod touch (Apple disallows DOM element fullscreen on iOS phones)
    const ua = window.navigator.userAgent || '';
    if (/iPhone|iPod/i.test(ua)) {
      return false;
    }

    // 2. Document-level permission or policy restrictions (e.g. sandboxed iframe without allow="fullscreen")
    const doc = document as WebKitDocument;
    if ('fullscreenEnabled' in document && !document.fullscreenEnabled) {
      return false;
    }
    if ('webkitFullscreenEnabled' in doc && !doc.webkitFullscreenEnabled) {
      return false;
    }

    // 3. Executable method check on document.documentElement
    const docEl = document.documentElement as WebKitElement;
    return (
      typeof docEl.requestFullscreen === 'function' ||
      typeof docEl.webkitRequestFullscreen === 'function'
    );
  }
}

/**
 * The exercise in the address bar, if any (ADR 0085). The fragment is removed once read,
 * so a reload or bookmark keeps the changes made after opening the link.
 */
function takeSharedExercise(): Exercise | null {
  const exercise = decodeExercise(location.hash, globalState.settings);
  if (exercise) history.replaceState(history.state, '', location.pathname + location.search);
  return exercise;
}

/**
 * Loads the stored or detected language before the app builds its UI. The head script
 * hides the page for non-English languages; it is shown again even if the chunk fails,
 * in which case the English shell stays (ADR 0059).
 */
async function bootstrap(): Promise<void> {
  const shared = takeSharedExercise();
  try {
    await loadLocale(globalState.settings.language);
  } catch {
    // Keep English
  }
  try {
    applyDom(document);
    new GuidonicaApp(shared);
  } finally {
    document.documentElement.removeAttribute('data-i18n-pending');
  }
  // An exercise link opened in a tab already running the app changes only the fragment
  window.addEventListener('hashchange', () => {
    if (decodeExercise(location.hash, globalState.settings)) location.reload();
  });
  registerServiceWorker();
}

// Bootstrap application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  void bootstrap();
});

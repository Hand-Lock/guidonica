// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - High-Performance Procedural Sight-Reading Engine
// Copyright (C) 2026 A. C. Lo Cascio

import {
  Clef,
  DEFAULT_TUPLET_OPTIONS,
  DEFAULT_ZOOM,
  MAX_ZOOM,
  MIN_ZOOM,
  Pulse68Mode,
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
  isTupletSupported,
  resolveTheme,
  subscribeSystemTheme,
} from './notation/types';
import { globalState, SessionState } from './state';
import { MetronomeEngine } from './audio/metronome';
import { CLEF_RANGE_DISPLAY, MusicGenerator } from './notation/generator';
import { MeasureRenderer } from './notation/renderer';
import { MeasureBuffer } from './scroller/buffer';
import { ScrollerView } from './scroller/scroller';
import { isMusicFontReady, waitForMusicFonts } from './notation/fonts';
import { ScreenWakeLockController } from './utils/wakeLock';

interface WebKitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
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
  private btnIcon: HTMLElement;
  private btnReset: HTMLButtonElement;
  private tempoSlider: HTMLInputElement;
  private tempoNumber: HTMLInputElement;
  private bpmDisplay: HTMLElement;
  private countInBadge: HTMLElement;
  private beatDotsContainer: HTMLElement;

  // Primary Header Utilities
  private btnThemeToggle: HTMLButtonElement;
  private themeIcon: HTMLElement;
  private btnFullscreenToggle: HTMLButtonElement;
  private btnDrawerToggle: HTMLButtonElement;
  private controlsDrawer: HTMLElement;

  // Drawer Configuration Elements
  private selectTimeSig: HTMLSelectElement;
  private groupPulse68: HTMLElement;
  private selectPulse68: HTMLSelectElement;
  private selectClef: HTMLSelectElement;
  private clefRangeHint: HTMLElement;
  private toggleRests: HTMLInputElement;
  private toggleCountIn: HTMLInputElement;
  private togglePlayhead: HTMLInputElement;
  private selectSolfegeMode: HTMLSelectElement;
  private selectSoundProfile: HTMLSelectElement;
  private selectTheme: HTMLSelectElement;
  private volumeSlider: HTMLInputElement;
  private btnVolumeMute: HTMLButtonElement;
  private zoomSlider: HTMLInputElement;
  private zoomDisplay: HTMLElement;
  private btnZoomOut: HTMLButtonElement;
  private btnZoomIn: HTMLButtonElement;
  private btnZoomReset: HTMLButtonElement;

  // Floating On-Canvas Zoom Pill
  private canvasZoomPill: HTMLElement;
  private btnPillZoomOut: HTMLButtonElement;
  private btnPillZoomReset: HTMLButtonElement;
  private pillZoomText: HTMLElement;
  private btnPillZoomIn: HTMLButtonElement;


  // Intervals & Subdivisions
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
  private btnDrawerAbout: HTMLButtonElement | null;
  private btnFooterAbout: HTMLButtonElement | null;

  constructor() {
    // 1. Query all UI DOM elements
    this.btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
    this.btnLabel = this.btnPlayPause.querySelector('.btn-label') as HTMLElement;
    this.btnIcon = this.btnPlayPause.querySelector('.btn-icon') as HTMLElement;
    this.btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
    this.tempoSlider = document.getElementById('tempo-slider') as HTMLInputElement;
    this.tempoNumber = document.getElementById('tempo-number') as HTMLInputElement;
    this.bpmDisplay = document.getElementById('bpm-display') as HTMLElement;
    this.countInBadge = document.getElementById('count-in-badge') as HTMLElement;
    this.beatDotsContainer = document.getElementById('beat-dots') as HTMLElement;

    this.btnThemeToggle = document.getElementById('btn-theme-toggle') as HTMLButtonElement;
    this.themeIcon = document.getElementById('theme-icon') as HTMLElement;
    this.btnFullscreenToggle = document.getElementById('btn-fullscreen-toggle') as HTMLButtonElement;
    this.btnDrawerToggle = document.getElementById('btn-drawer-toggle') as HTMLButtonElement;
    this.controlsDrawer = document.getElementById('controls-drawer') as HTMLElement;

    this.selectTimeSig = document.getElementById('select-time-signature') as HTMLSelectElement;
    this.groupPulse68 = document.getElementById('group-pulse-68') as HTMLElement;
    this.selectPulse68 = document.getElementById('select-pulse-68') as HTMLSelectElement;
    this.selectClef = document.getElementById('select-clef') as HTMLSelectElement;
    this.clefRangeHint = document.getElementById('clef-range-hint') as HTMLElement;
    this.toggleRests = document.getElementById('toggle-rests') as HTMLInputElement;
    this.toggleTies = document.getElementById('toggle-ties') as HTMLInputElement;
    this.toggleCountIn = document.getElementById('toggle-count-in') as HTMLInputElement;
    this.togglePlayhead = document.getElementById('toggle-playhead') as HTMLInputElement;
    this.selectSolfegeMode = document.getElementById('select-solfege-mode') as HTMLSelectElement;
    this.selectSoundProfile = document.getElementById('select-sound-profile') as HTMLSelectElement;
    this.selectTheme = document.getElementById('select-theme') as HTMLSelectElement;
    this.volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
    this.btnVolumeMute = document.getElementById('btn-volume-mute') as HTMLButtonElement;
    this.zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement;
    this.zoomDisplay = document.getElementById('zoom-display') as HTMLElement;
    this.btnZoomOut = document.getElementById('btn-zoom-out') as HTMLButtonElement;
    this.btnZoomIn = document.getElementById('btn-zoom-in') as HTMLButtonElement;
    this.btnZoomReset = document.getElementById('btn-zoom-reset') as HTMLButtonElement;

    this.canvasZoomPill = document.getElementById('canvas-zoom-pill') as HTMLElement;
    this.btnPillZoomOut = document.getElementById('btn-pill-zoom-out') as HTMLButtonElement;
    this.btnPillZoomReset = document.getElementById('btn-pill-zoom-reset') as HTMLButtonElement;
    this.pillZoomText = document.getElementById('pill-zoom-text') as HTMLElement;
    this.btnPillZoomIn = document.getElementById('btn-pill-zoom-in') as HTMLButtonElement;

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
    this.subdivDotted = document.getElementById('subdiv-dotted') as HTMLInputElement;

    this.subdivCheckboxes = [
      this.subdivQuarter,
      this.subdivEighth,
      this.subdivHalf,
      this.subdivWhole,
      this.subdivSixteenth,
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
    this.btnDrawerAbout = document.getElementById('btn-drawer-about') as HTMLButtonElement | null;
    this.btnFooterAbout = document.getElementById('btn-footer-about') as HTMLButtonElement | null;

    const canvas = document.getElementById('scroller-canvas') as HTMLCanvasElement;

    // 2. Initialize engines with stored settings
    const initialSettings = globalState.settings;
    this.metronome = new MetronomeEngine(initialSettings.tempo, initialSettings.timeSignature);
    this.metronome.setVolume(initialSettings.volume);
    this.metronome.setMuted(initialSettings.isMuted);
    this.metronome.setSoundProfile(initialSettings.soundProfile);
    this.metronome.setPulse68(initialSettings.pulse68);

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

    // 4. Setup event wiring and subscriptions
    this.bindEvents();
    this.bindAboutModalEvents();
    this.bindKeyboardShortcuts();
    this.bindAudioEvents();
    this.bindLifecycleEvents();
    this.renderBeatDots(initialSettings.timeSignature);

    // 5. Initial idle frame (stationary staff lines & playhead)
    this.scroller.renderEmptyFrame();

    // 6. Subscribe to state changes for UI sync
    globalState.subscribe((state) => this.syncUI(state));

    // 7. Asynchronously await musical font readiness before generating notation measures
    this.fontInitPromise = this.initFonts();
  }

  private hydrateUI(settings: typeof globalState.settings): void {
    // Apply theme to DOM and sync controls
    const resolved = resolveTheme(settings.theme);
    document.documentElement.setAttribute('data-theme', resolved);
    this.updateThemeUI(settings.theme, resolved);

    // Tempo
    this.tempoSlider.value = String(settings.tempo);
    this.tempoNumber.value = String(settings.tempo);
    this.bpmDisplay.textContent = String(settings.tempo);

    // Time signature & 6/8 pulse
    this.selectTimeSig.value = settings.timeSignature;
    this.groupPulse68.classList.toggle('hidden', settings.timeSignature !== '6/8');
    this.selectPulse68.value = settings.pulse68;

    // Clef & hint
    this.selectClef.value = settings.clef;
    this.clefRangeHint.textContent = CLEF_RANGE_DISPLAY[settings.clef];

    // Rests, Ties, Count-In & Playhead
    this.toggleRests.checked = settings.rests;
    this.toggleTies.checked = settings.ties;
    this.toggleCountIn.checked = settings.countIn;
    this.togglePlayhead.checked = settings.showPlayhead !== false;

    // Sound & Display overlays
    this.selectSolfegeMode.value = settings.solfegeLabelMode;
    this.selectSoundProfile.value = settings.soundProfile;
    this.volumeSlider.value = String(settings.volume);
    this.btnVolumeMute.textContent = settings.isMuted ? '🔇' : '🔊';

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

    // Subdivisions
    this.subdivQuarter.checked = settings.subdivisions.quarter;
    this.subdivEighth.checked = settings.subdivisions.eighth;
    this.subdivHalf.checked = settings.subdivisions.half;
    this.subdivWhole.checked = settings.subdivisions.whole;
    this.subdivSixteenth.checked = settings.subdivisions.sixteenth;
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
    this.btnZoomReset.classList.toggle('active', isAuto);
    this.btnZoomReset.title = isAuto
      ? `Auto-fit active (${Math.round(zoomVal * 100)}%) - click to recalculate`
      : `Auto-fit zoom to screen (resets to ${Math.round(this.getEffectiveAutoZoom() * 100)}%)`;
    this.btnPillZoomReset.title = isAuto
      ? `Zoom: ${Math.round(zoomVal * 100)}% (Auto)`
      : `Zoom: ${Math.round(zoomVal * 100)}% (Click to reset to Auto)`;
  }

  private applyZoom(val: number, mode?: ZoomMode): void {
    const quantized = Math.round(val * 10) / 10;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
    const nextMode: ZoomMode = mode ?? 'manual';
    const percentStr = `${Math.round(clamped * 100)}%`;
    this.zoomSlider.value = String(Math.round(clamped * 100));
    this.zoomDisplay.textContent = percentStr;
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
    if (theme === 'auto') {
      this.themeIcon.textContent = '🌓';
      this.btnThemeToggle.title = `Theme: Auto (OS: ${resolved === 'dark' ? 'Dark' : 'Light'}) - Click for Dark`;
      this.btnThemeToggle.setAttribute(
        'aria-label',
        `Theme: Auto (OS: ${resolved}). Click to cycle theme.`
      );
    } else if (theme === 'dark') {
      this.themeIcon.textContent = '🌙';
      this.btnThemeToggle.title = 'Theme: Dark - Click for Light';
      this.btnThemeToggle.setAttribute('aria-label', 'Theme: Dark. Click to cycle theme.');
    } else {
      this.themeIcon.textContent = '☀️';
      this.btnThemeToggle.title = 'Theme: Light - Click for Auto (OS)';
      this.btnThemeToggle.setAttribute('aria-label', 'Theme: Light. Click to cycle theme.');
    }
    if (this.selectTheme) {
      this.selectTheme.value = theme;
    }
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

      const syncFullscreenGlyph = (): void => {
        const doc = document as WebKitDocument;
        const isFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
        const iconPath = this.btnFullscreenToggle.querySelector<SVGPathElement>('#fullscreen-icon-path');
        if (iconPath) {
          iconPath.setAttribute('d', isFs ? FULLSCREEN_EXIT_PATH : FULLSCREEN_ENTER_PATH);
        }
        const label = isFs ? 'Exit full screen' : 'Toggle full screen';
        this.btnFullscreenToggle.setAttribute('aria-label', label);
        this.btnFullscreenToggle.title = label;
      };

      document.addEventListener('fullscreenchange', syncFullscreenGlyph);
      document.addEventListener('webkitfullscreenchange', syncFullscreenGlyph);
    }

    // Mobile Settings Drawer Toggle
    this.btnDrawerToggle.addEventListener('click', () => {
      const isOpen = this.controlsDrawer.classList.toggle('open');
      this.btnDrawerToggle.setAttribute('aria-expanded', String(isOpen));
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
      this.groupPulse68.classList.toggle('hidden', ts !== '6/8');
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

    // 6/8 Pulse
    this.selectPulse68.addEventListener('change', (e) => {
      const pulse = (e.target as HTMLSelectElement).value as Pulse68Mode;
      this.metronome.setPulse68(pulse);
      globalState.updateSettings({ pulse68: pulse });
    });

    // Clef
    this.selectClef.addEventListener('change', (e) => {
      const clef = (e.target as HTMLSelectElement).value as Clef;
      this.clefRangeHint.textContent = CLEF_RANGE_DISPLAY[clef];
      globalState.updateSettings({ clef });
      this.resetSession();
    });

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
      this.rerenderBuffer();
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
      this.btnVolumeMute.textContent = nextMuted ? '🔇' : '🔊';
      globalState.updateSettings({ isMuted: nextMuted });
    });

    // Responsive Auto-Zoom Resizing
    window.addEventListener('resize', () => {
      if (globalState.settings.zoomMode === 'auto') {
        this.syncAutoZoom();
      }
    });

    // Zoom Controls (Settings Drawer)
    this.zoomSlider.addEventListener('input', (e) => {
      const percent = Number((e.target as HTMLInputElement).value);
      this.applyZoom(percent / 100, 'manual');
    });

    this.btnZoomOut.addEventListener('click', () => {
      this.adjustZoom(-ZOOM_STEP);
    });

    this.btnZoomIn.addEventListener('click', () => {
      this.adjustZoom(ZOOM_STEP);
    });

    this.btnZoomReset.addEventListener('click', () => {
      this.btnZoomReset.blur();
      this.syncAutoZoom();
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

    // Canvas Two-Finger Pinch-to-Zoom
    const canvas = document.getElementById('scroller-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.bindCanvasPinchZoom(canvas);
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
      this.resetSession();
    };

    for (const cb of this.intervalCheckboxes) {
      cb.addEventListener('change', handleIntervalChange);
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
    for (const cb of this.tupletCheckboxes) {
      const tName = cb.dataset.tuplet as TupletName | undefined;
      const tVal = cb.dataset.value as TupletValue | undefined;
      const supported = !!tName && !!tVal && isTupletSupported(ts, tName, tVal);
      cb.disabled = !supported;
      const label = cb.closest('label');
      if (label) {
        label.dataset.baseTitle ??= label.title;
        label.title = supported ? label.dataset.baseTitle : `Not available in ${ts}`;
      }
    }
    this.updateTupletsUI();
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

    this.btnDrawerAbout?.addEventListener('click', (e) => {
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

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Leave browser/OS chords (Cmd+R reload, Ctrl +/- zoom, Alt menus) untouched
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      // If About modal is open, ignore global app shortcuts
      if (this.modalAbout && this.modalAbout.open) {
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
    this.bpmDisplay.textContent = String(next);
    this.metronome.setTempo(next);
    globalState.updateSettings({ tempo: next });
    this.renderIfIdle();
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

  private renderBeatDots(ts: TimeSignature): void {
    this.beatDotsContainer.innerHTML = '';
    const dotsCount = getBeatsPerMeasure(ts);

    for (let i = 1; i <= dotsCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
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
    this.highlightBeatDot(info.beatNumber, info.isDownbeat);
  }

  private highlightBeatDot(beatNumber: number, isDownbeat: boolean): void {
    const dots = this.beatDotsContainer.querySelectorAll('.beat-dot');
    dots.forEach((dot) => dot.classList.remove('active', 'downbeat'));

    const target = this.beatDotsContainer.querySelector(`[data-beat="${beatNumber}"]`);
    if (target) {
      target.classList.add('active');
      if (isDownbeat) {
        target.classList.add('downbeat');
      }
    }
  }

  private resetBeatDots(): void {
    this.lastBeatIndex = null;
    const dots = this.beatDotsContainer.querySelectorAll('.beat-dot');
    dots.forEach((dot) => dot.classList.remove('active', 'downbeat'));
  }

  private syncUI(state: SessionState): void {
    if (state.playbackState === 'counting-in' || state.playbackState === 'playing') {
      this.btnLabel.textContent = 'Pause';
      this.btnIcon.textContent = '⏸';
      this.btnPlayPause.classList.add('playing');
    } else if (state.playbackState === 'paused') {
      this.btnLabel.textContent = 'Resume';
      this.btnIcon.textContent = '▶';
      this.btnPlayPause.classList.remove('playing');
    } else {
      this.btnLabel.textContent = 'Start';
      this.btnIcon.textContent = '▶';
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

// Bootstrap application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new GuidonicaApp();
});

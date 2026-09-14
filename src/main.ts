import { CLEF_RANGE_DISPLAY, Clef, TimeSignature } from './notation/types';
import { globalState, SessionState } from './state';
import { MetronomeEngine } from './audio/metronome';
import { MusicGenerator } from './notation/generator';
import { MeasureRenderer } from './notation/renderer';
import { MeasureBuffer } from './scroller/buffer';
import { ScrollerView } from './scroller/scroller';

class SolfegeScrollerApp {
  private metronome: MetronomeEngine;
  private generator: MusicGenerator;
  private renderer: MeasureRenderer;
  private buffer: MeasureBuffer;
  private scroller: ScrollerView;

  // DOM Elements
  private btnPlayPause: HTMLButtonElement;
  private btnLabel: HTMLElement;
  private btnIcon: HTMLElement;
  private btnReset: HTMLButtonElement;
  private tempoSlider: HTMLInputElement;
  private tempoNumber: HTMLInputElement;
  private bpmDisplay: HTMLElement;
  private selectTimeSig: HTMLSelectElement;
  private selectClef: HTMLSelectElement;
  private clefRangeHint: HTMLElement;
  private toggleRests: HTMLInputElement;
  private countInBadge: HTMLElement;
  private beatDotsContainer: HTMLElement;

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
  private subdivTriplets: HTMLInputElement;
  private subdivCheckboxes: HTMLInputElement[];

  constructor() {
    // 1. Query all UI DOM elements
    this.btnPlayPause = document.getElementById('btn-play-pause') as HTMLButtonElement;
    this.btnLabel = this.btnPlayPause.querySelector('.btn-label') as HTMLElement;
    this.btnIcon = this.btnPlayPause.querySelector('.btn-icon') as HTMLElement;
    this.btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
    this.tempoSlider = document.getElementById('tempo-slider') as HTMLInputElement;
    this.tempoNumber = document.getElementById('tempo-number') as HTMLInputElement;
    this.bpmDisplay = document.getElementById('bpm-display') as HTMLElement;
    this.selectTimeSig = document.getElementById('select-time-signature') as HTMLSelectElement;
    this.selectClef = document.getElementById('select-clef') as HTMLSelectElement;
    this.clefRangeHint = document.getElementById('clef-range-hint') as HTMLElement;
    this.toggleRests = document.getElementById('toggle-rests') as HTMLInputElement;
    this.countInBadge = document.getElementById('count-in-badge') as HTMLElement;
    this.beatDotsContainer = document.getElementById('beat-dots') as HTMLElement;

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
    this.subdivTriplets = document.getElementById('subdiv-triplets') as HTMLInputElement;

    this.subdivCheckboxes = [
      this.subdivQuarter,
      this.subdivEighth,
      this.subdivHalf,
      this.subdivWhole,
      this.subdivSixteenth,
      this.subdivTriplets,
    ];

    const canvas = document.getElementById('scroller-canvas') as HTMLCanvasElement;

    // 2. Initialize engines
    const initialSettings = globalState.settings;
    this.metronome = new MetronomeEngine(initialSettings.tempo, initialSettings.timeSignature);
    this.generator = new MusicGenerator();
    this.renderer = new MeasureRenderer();
    this.buffer = new MeasureBuffer(this.generator, this.renderer);
    this.scroller = new ScrollerView(
      canvas,
      this.buffer,
      this.metronome,
      this.renderer,
      () => globalState.settings
    );

    // 3. Setup event wiring and subscriptions
    this.bindEvents();
    this.bindKeyboardShortcuts();
    this.bindAudioEvents();
    this.renderBeatDots(initialSettings.timeSignature);

    // 4. Initial buffer fill and idle frame (anchored to count-in offset)
    this.resetBuffer();

    // 5. Subscribe to state changes for UI sync
    globalState.subscribe((state) => this.syncUI(state));
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

    // Tempo controls
    const applyTempo = (val: number): void => {
      const clamped = Math.max(30, Math.min(240, val));
      this.tempoSlider.value = String(clamped);
      this.tempoNumber.value = String(clamped);
      this.bpmDisplay.textContent = String(clamped);
      this.metronome.setTempo(clamped);
      globalState.updateSettings({ tempo: clamped });
    };

    this.tempoSlider.addEventListener('input', (e) => {
      applyTempo(Number((e.target as HTMLInputElement).value));
    });

    // Live update when typing in number input
    this.tempoNumber.addEventListener('input', (e) => {
      const val = Number((e.target as HTMLInputElement).value);
      if (val >= 30 && val <= 240) {
        this.tempoSlider.value = String(val);
        this.bpmDisplay.textContent = String(val);
        this.metronome.setTempo(val);
        globalState.updateSettings({ tempo: val });
      }
    });

    this.tempoNumber.addEventListener('change', (e) => {
      applyTempo(Number((e.target as HTMLInputElement).value));
    });

    // Time Signature
    this.selectTimeSig.addEventListener('change', (e) => {
      const ts = (e.target as HTMLSelectElement).value as TimeSignature;
      this.metronome.setTimeSignature(ts);
      this.renderBeatDots(ts);
      globalState.updateSettings({ timeSignature: ts });
      this.resetSession();
    });

    // Clef
    this.selectClef.addEventListener('change', (e) => {
      const clef = (e.target as HTMLSelectElement).value as Clef;
      this.clefRangeHint.textContent = CLEF_RANGE_DISPLAY[clef];
      globalState.updateSettings({ clef });
      this.resetSession();
    });

    // Intervals: ensure at least one interval remains checked
    const handleIntervalChange = (e: Event): void => {
      const checkedCount = this.intervalCheckboxes.filter((cb) => cb.checked).length;
      const target = e.target as HTMLInputElement;

      if (checkedCount === 0) {
        // Prevent unchecking the sole active interval
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

    // Subdivisions: ensure at least one subdivision remains checked
    const handleSubdivChange = (e: Event): void => {
      const checkedCount = this.subdivCheckboxes.filter((cb) => cb.checked).length;
      const target = e.target as HTMLInputElement;

      if (checkedCount === 0) {
        // Prevent unchecking the sole active subdivision
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
          triplets: this.subdivTriplets.checked,
        },
      });
      this.resetSession();
    };

    for (const cb of this.subdivCheckboxes) {
      cb.addEventListener('change', handleSubdivChange);
    }

    // Rests
    this.toggleRests.addEventListener('change', () => {
      globalState.updateSettings({ rests: this.toggleRests.checked });
      this.resetSession();
    });
  }

  private bindKeyboardShortcuts(): void {
    window.addEventListener('keydown', (e) => {
      // Prevent rapid fire on key-repeat for action triggers
      if (e.repeat && (e.code === 'Space' || e.code === 'KeyR' || e.code === 'Escape')) {
        return;
      }

      const target = e.target as HTMLElement;

      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        if (e.code === 'Space') {
          e.preventDefault();
          this.togglePlayback();
          return;
        }
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
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        const delta = e.shiftKey ? 1 : 5;
        this.adjustTempo(delta);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        const delta = e.shiftKey ? -1 : -5;
        this.adjustTempo(delta);
      }
    });
  }

  private adjustTempo(delta: number): void {
    const current = globalState.settings.tempo;
    const next = Math.max(30, Math.min(240, current + delta));
    this.tempoSlider.value = String(next);
    this.tempoNumber.value = String(next);
    this.bpmDisplay.textContent = String(next);
    this.metronome.setTempo(next);
    globalState.updateSettings({ tempo: next });
  }

  private bindAudioEvents(): void {
    this.metronome.onBeat((event) => {
      globalState.setBeat(event.beatNumber, event.isDownbeat, event.isCountIn);

      // Transition from count-in to playing when count-in concludes
      if (!event.isCountIn && globalState.playbackState === 'counting-in') {
        globalState.setPlaybackState('playing');
      }

      this.highlightBeatDot(event.beatNumber, event.isDownbeat);
    });
  }

  private togglePlayback(): void {
    const state = globalState.playbackState;

    if (state === 'stopped') {
      globalState.setPlaybackState('counting-in');
      this.metronome.start(true);
      this.scroller.startLoop();
    } else if (state === 'counting-in' || state === 'playing') {
      globalState.setPlaybackState('paused');
      this.metronome.pause();
      this.scroller.stopLoop();
    } else if (state === 'paused') {
      globalState.setPlaybackState('playing');
      this.metronome.resume();
      this.scroller.startLoop();
    }
  }

  private resetSession(): void {
    this.metronome.stop();
    this.scroller.stopLoop();
    globalState.setPlaybackState('stopped');

    this.resetBuffer();
    this.resetBeatDots();
  }

  private resetBuffer(): void {
    this.buffer.reset();
    const settings = globalState.settings;
    const initialBeat = this.metronome.getCurrentGlobalBeat();
    this.buffer.ensureAhead(initialBeat, 16, settings);
    this.scroller.renderFrame(settings);
  }

  private renderBeatDots(ts: TimeSignature): void {
    this.beatDotsContainer.innerHTML = '';
    const dotsCount = ts === '6/8' ? 6 : ts === '3/4' ? 3 : ts === '2/4' ? 2 : 4;

    for (let i = 1; i <= dotsCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'beat-dot';
      dot.dataset.beat = String(i);
      this.beatDotsContainer.appendChild(dot);
    }
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
}

// Bootstrap application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  new SolfegeScrollerApp();
});

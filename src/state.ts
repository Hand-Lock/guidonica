import { AppSettings, PlaybackState, TimeSignature, Clef } from './notation/types';

export interface SessionState {
  settings: AppSettings;
  playbackState: PlaybackState;
  currentBeat: number; // 1-based beat indicator
  isDownbeat: boolean;
  isCountIn: boolean;
}

export type StateListener = (state: SessionState) => void;

export class AppState {
  private state: SessionState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = {
      settings: {
        tempo: 60,
        timeSignature: '4/4',
        clef: 'treble',
        subdivisions: {
          whole: true,
          half: true,
          quarter: true,
          eighth: true,
          sixteenth: false,
          triplets: false,
        },
        rests: false,
        intervals: {
          unison: false,
          second: true,
          third: true,
          fourth: false,
          fifth: false,
          sixth: false,
          seventh: false,
          octave: false,
          ninthPlus: false,
        },
      },
      playbackState: 'stopped',
      currentBeat: 1,
      isDownbeat: true,
      isCountIn: false,
    };
  }

  public getState(): Readonly<SessionState> {
    return this.state;
  }

  public get settings(): Readonly<AppSettings> {
    return this.state.settings;
  }

  public get playbackState(): PlaybackState {
    return this.state.playbackState;
  }

  public updateSettings(partial: Partial<AppSettings>): void {
    const prevMeter = this.state.settings.timeSignature;
    this.state = {
      ...this.state,
      settings: {
        ...this.state.settings,
        ...partial,
      },
    };

    // If time signature changed, reset current beat counter to 1
    if (partial.timeSignature && partial.timeSignature !== prevMeter) {
      this.state.currentBeat = 1;
      this.state.isDownbeat = true;
    }

    this.notify();
  }

  public setPlaybackState(playbackState: PlaybackState): void {
    if (this.state.playbackState === playbackState) return;
    this.state = {
      ...this.state,
      playbackState,
      isCountIn: playbackState === 'counting-in',
    };
    if (playbackState === 'stopped') {
      this.state.currentBeat = 1;
      this.state.isDownbeat = true;
      this.state.isCountIn = false;
    }
    this.notify();
  }

  public setBeat(beat: number, isDownbeat: boolean, isCountIn: boolean): void {
    this.state = {
      ...this.state,
      currentBeat: beat,
      isDownbeat,
      isCountIn,
    };
    this.notify();
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }
}

export const globalState = new AppState();

import { TimeSignature } from '../notation/types';

export interface BeatEvent {
  beatNumber: number; // 1-based index within the measure
  isDownbeat: boolean;
  isCountIn: boolean;
  time: number;
}

export type BeatCallback = (event: BeatEvent) => void;

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private tempo: number = 60;
  private timeSignature: TimeSignature = '4/4';

  private beatsPerMeasure: number = 4;
  private secondsPerBeat: number = 1.0;

  // Scheduling state
  private timerId: number | null = null;
  private nextBeatTime: number = 0;
  private scheduledBeatCount: number = 0; // Cumulative scheduled beats
  private measureZeroStartTime: number = 0;
  private pausedElapsedSeconds: number = 0;
  private countInBeatsTotal: number = 0;
  private hasCountIn: boolean = true;

  // Lookahead settings
  private readonly lookaheadMs: number = 25;
  private readonly scheduleAheadSeconds: number = 0.1;

  // Listeners
  private beatCallbacks: Set<BeatCallback> = new Set();

  constructor(initialTempo: number = 60, initialTimeSignature: TimeSignature = '4/4') {
    this.tempo = initialTempo;
    this.timeSignature = initialTimeSignature;
    this.updateMeterParams();
  }

  public onBeat(callback: BeatCallback): () => void {
    this.beatCallbacks.add(callback);
    return () => {
      this.beatCallbacks.delete(callback);
    };
  }

  private ensureAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setTempo(bpm: number): void {
    if (bpm < 30) bpm = 30;
    if (bpm > 240) bpm = 240;
    if (this.tempo === bpm) return;

    if (this.isRunning && !this.isPaused && this.ctx) {
      // Re-anchor timing seamlessly on tempo change
      const currentElapsed = this.getElapsedPlaybackSeconds();
      this.tempo = bpm;
      this.updateMeterParams();
      this.measureZeroStartTime = this.ctx.currentTime - currentElapsed;
      this.nextBeatTime = this.ctx.currentTime;
    } else {
      this.tempo = bpm;
      this.updateMeterParams();
    }
  }

  public setTimeSignature(ts: TimeSignature): void {
    if (this.timeSignature === ts) return;
    this.timeSignature = ts;
    this.updateMeterParams();
  }

  private updateMeterParams(): void {
    switch (this.timeSignature) {
      case '2/4':
        this.beatsPerMeasure = 2;
        this.secondsPerBeat = 60 / this.tempo;
        break;
      case '3/4':
        this.beatsPerMeasure = 3;
        this.secondsPerBeat = 60 / this.tempo;
        break;
      case '4/4':
        this.beatsPerMeasure = 4;
        this.secondsPerBeat = 60 / this.tempo;
        break;
      case '6/8':
        this.beatsPerMeasure = 6;
        // In 6/8, compound meter: 6 eighth-note beats.
        // If tempo is dotted-quarter BPM: eighth = (60 / tempo) / 3
        // If tempo is quarter BPM: eighth = (60 / tempo) * 0.5
        this.secondsPerBeat = (60 / this.tempo) * 0.5;
        break;
    }
  }

  public start(countIn: boolean = true): void {
    const ctx = this.ensureAudioContext();
    this.stop();

    this.isRunning = true;
    this.isPaused = false;
    this.hasCountIn = countIn;
    this.countInBeatsTotal = countIn ? this.beatsPerMeasure : 0;

    const startTime = ctx.currentTime + 0.05;
    this.nextBeatTime = startTime;
    this.scheduledBeatCount = 0;
    this.pausedElapsedSeconds = 0;

    this.measureZeroStartTime = startTime + this.countInBeatsTotal * this.secondsPerBeat;

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused || !this.ctx) return;
    this.isPaused = true;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.pausedElapsedSeconds = this.getElapsedPlaybackSeconds();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused || !this.ctx) return;
    void this.ctx.resume();
    this.isPaused = false;

    this.measureZeroStartTime = this.ctx.currentTime - this.pausedElapsedSeconds;
    this.nextBeatTime = this.ctx.currentTime + 0.02;

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.scheduledBeatCount = 0;
    this.pausedElapsedSeconds = 0;
  }

  private scheduler(): void {
    if (!this.ctx || !this.isRunning || this.isPaused) return;

    while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadSeconds) {
      const beatTime = this.nextBeatTime;
      const isCountIn = this.hasCountIn && this.scheduledBeatCount < this.countInBeatsTotal;

      let beatNumber: number;
      let isDownbeat: boolean;

      if (isCountIn) {
        beatNumber = (this.scheduledBeatCount % this.beatsPerMeasure) + 1;
        isDownbeat = beatNumber === 1;
      } else {
        const playbackBeatIndex = this.scheduledBeatCount - this.countInBeatsTotal;
        beatNumber = (playbackBeatIndex % this.beatsPerMeasure) + 1;
        isDownbeat = beatNumber === 1;
      }

      this.scheduleClick(beatTime, isDownbeat, this.timeSignature === '6/8' && beatNumber === 4);
      this.dispatchBeat(beatNumber, isDownbeat, isCountIn, beatTime);

      this.scheduledBeatCount++;
      this.nextBeatTime += this.secondsPerBeat;
    }
  }

  private scheduleClick(time: number, isDownbeat: boolean, isCompoundSubaccent: boolean = false): void {
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';

    let freq = 800;
    let gainLevel = 0.7;

    if (isDownbeat) {
      freq = 1300;
      gainLevel = 1.0;
    } else if (isCompoundSubaccent) {
      freq = 1050;
      gainLevel = 0.85;
    }

    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(gainLevel, time);
    // Smooth exponential decay over 35 milliseconds
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.04);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Safe disposal
      }
    };
  }

  private dispatchBeat(beatNumber: number, isDownbeat: boolean, isCountIn: boolean, audioTime: number): void {
    if (!this.ctx) return;
    const delayMs = Math.max(0, (audioTime - this.ctx.currentTime) * 1000);

    window.setTimeout(() => {
      if (!this.isRunning) return;
      const event: BeatEvent = {
        beatNumber,
        isDownbeat,
        isCountIn,
        time: audioTime,
      };
      for (const cb of this.beatCallbacks) {
        cb(event);
      }
    }, delayMs);
  }

  public getAudioTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  public getSecondsPerBeat(): number {
    return this.secondsPerBeat;
  }

  public getBeatsPerMeasure(): number {
    return this.beatsPerMeasure;
  }

  public getMeasureZeroStartTime(): number {
    return this.measureZeroStartTime;
  }

  /**
   * Returns elapsed seconds relative to Measure 0.
   * During count-in, this value will be negative (-countInDuration to 0).
   */
  public getElapsedPlaybackSeconds(): number {
    if (!this.isRunning) return 0;
    if (this.isPaused) return this.pausedElapsedSeconds;
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.measureZeroStartTime;
  }

  /**
   * Returns current fractional beat position relative to Measure 0.
   * At beat 0 of Measure 0, this returns 0.
   */
  public getCurrentGlobalBeat(): number {
    if (this.secondsPerBeat <= 0) return 0;
    return this.getElapsedPlaybackSeconds() / this.secondsPerBeat;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }
}

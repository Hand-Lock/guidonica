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
  private masterGainNode: GainNode | null = null;
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

  // Beat dispatch tracking
  private pendingBeatTimeouts: Set<number> = new Set();
  private beatCallbacks: Set<BeatCallback> = new Set();

  constructor(initialTempo: number = 60, initialTimeSignature: TimeSignature = '4/4') {
    this.tempo = initialTempo;
    this.timeSignature = initialTimeSignature;
    this.updateMeterParams();

    // Re-trigger scheduler when tab visibility returns to prevent background throttling gap
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  public destroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close();
    }
  }

  private handleVisibilityChange = (): void => {
    if (!document.hidden && this.isRunning && !this.isPaused) {
      this.scheduler();
    }
  };

  public onBeat(callback: BeatCallback): () => void {
    this.beatCallbacks.add(callback);
    return () => {
      this.beatCallbacks.delete(callback);
    };
  }

  private ensureAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setTempo(bpm: number): void {
    const clamped = Math.max(30, Math.min(240, bpm));
    if (this.tempo === clamped) return;

    if (this.isRunning && !this.isPaused && this.ctx) {
      // Re-anchor timing seamlessly on tempo change so current fractional beat position remains continuous
      const currentBeat = this.getCurrentGlobalBeat();
      this.tempo = clamped;
      this.updateMeterParams();
      this.measureZeroStartTime = this.ctx.currentTime - currentBeat * this.secondsPerBeat;

      // Accurately align to the next unplayed beat boundary to avoid duplicate or clashing clicks
      const nextGlobalBeatIndex = Math.ceil(
        (this.ctx.currentTime + 0.02 - this.measureZeroStartTime) / this.secondsPerBeat
      );
      this.nextBeatTime = this.measureZeroStartTime + nextGlobalBeatIndex * this.secondsPerBeat;
      this.scheduledBeatCount = nextGlobalBeatIndex + this.countInBeatsTotal;
    } else {
      this.tempo = clamped;
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
        // In 6/8 compound meter, 6 eighth-note beats.
        // At tempo = 60 BPM (quarter BPM), eighth note = 0.5s (120 eighths per minute)
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

    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(1, ctx.currentTime);
    }

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

    // Immediately silence any queued audio clicks
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    // Cancel all pending visual beat dispatches
    this.clearPendingBeatTimeouts();

    this.pausedElapsedSeconds = this.getElapsedPlaybackSeconds();
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused || !this.ctx) return;
    void this.ctx.resume();
    this.isPaused = false;

    // Unmute master gain
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(1, this.ctx.currentTime);
    }

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

    // Silence master gain immediately
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    this.clearPendingBeatTimeouts();
    this.scheduledBeatCount = 0;
    this.pausedElapsedSeconds = 0;
  }

  private clearPendingBeatTimeouts(): void {
    for (const timeoutId of this.pendingBeatTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.pendingBeatTimeouts.clear();
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
    if (!this.ctx || !this.masterGainNode) return;

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
    gain.connect(this.masterGainNode);

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

    const timeoutId = window.setTimeout(() => {
      this.pendingBeatTimeouts.delete(timeoutId);
      if (!this.isRunning || this.isPaused) return;

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

    this.pendingBeatTimeouts.add(timeoutId);
  }

  /**
   * Returns elapsed seconds relative to Measure 0.
   * When stopped or during count-in, this value is negative (-countInDuration to 0).
   */
  public getElapsedPlaybackSeconds(): number {
    if (!this.isRunning) {
      return this.hasCountIn ? -this.beatsPerMeasure * this.secondsPerBeat : 0;
    }
    if (this.isPaused) return this.pausedElapsedSeconds;
    if (!this.ctx) return 0;
    return this.ctx.currentTime - this.measureZeroStartTime;
  }

  /**
   * Returns current fractional beat position relative to Measure 0.
   * At beat 0 of Measure 0, this returns 0.
   * When stopped with count-in enabled, this returns -beatsPerMeasure.
   */
  public getCurrentGlobalBeat(): number {
    if (!this.isRunning) {
      return this.hasCountIn ? -this.beatsPerMeasure : 0;
    }
    if (this.secondsPerBeat <= 0) return 0;
    return this.getElapsedPlaybackSeconds() / this.secondsPerBeat;
  }
}

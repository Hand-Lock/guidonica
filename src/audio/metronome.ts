import {
  AudioSessionType,
  METER,
  Pulse68Mode,
  SoundProfile,
  TimeSignature,
  clampTempo,
} from '../notation/types';

/** Beat currently being heard, derived from the hardware audio clock (no timers). */
export interface BeatInfo {
  beatIndex: number; // Global integer beat (negative during count-in)
  beatNumber: number; // 1-based index within the measure
  isDownbeat: boolean;
  isCountIn: boolean;
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private tempo: number = 60;
  private timeSignature: TimeSignature = '4/4';

  private volume: number = 0.8;
  private isMuted: boolean = false;
  private soundProfile: SoundProfile = 'woodblock';
  private pulse68: Pulse68Mode = 'dotted-quarter';

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

  private interruptionCallbacks: Set<() => void> = new Set();

  constructor(initialTempo: number = 60, initialTimeSignature: TimeSignature = '4/4') {
    this.tempo = initialTempo;
    this.timeSignature = initialTimeSignature;
    this.updateMeterParams();

    // Default to 'ambient' so non-essential sounds/UI respect silent mode and don't interrupt other audio
    this.setAudioSessionCategory('ambient');
  }

  /**
   * Dynamically configures the platform audio session (W3C AudioSession API on iOS/WebKit).
   * - 'ambient': Respects hardware silent switch (muted), mixes with background apps (used when idle/paused/stopped).
   * - 'playback': Overrides hardware silent switch (audible), prioritizes media playback (used during active practice).
   */
  private setAudioSessionCategory(category: AudioSessionType): void {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator && navigator.audioSession) {
      try {
        navigator.audioSession.type = category;
      } catch {
        // Ignored if platform restricts dynamic audio session mutation
      }
    }
  }

  /**
   * Returns current W3C audioSession type if supported, or null.
   */
  public getAudioSessionType(): AudioSessionType | null {
    if (typeof navigator !== 'undefined' && 'audioSession' in navigator && navigator.audioSession) {
      return navigator.audioSession.type;
    }
    return null;
  }

  public destroy(): void {
    this.stop();
    this.setAudioSessionCategory('ambient');
    this.interruptionCallbacks.clear();
    if (this.ctx) {
      this.ctx.onstatechange = null;
      if (this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    }
  }

  /**
   * Subscribes to OS-level audio interruptions (e.g. system sleep, headphone disconnection, incoming call).
   */
  public onInterruption(callback: () => void): () => void {
    this.interruptionCallbacks.add(callback);
    return () => {
      this.interruptionCallbacks.delete(callback);
    };
  }

  private handleAudioContextStateChange = (): void => {
    if (!this.ctx) return;
    const state = this.ctx.state as string;
    if (state === 'suspended' || state === 'interrupted') {
      if (this.isRunning && !this.isPaused) {
        for (const cb of this.interruptionCallbacks) {
          cb();
        }
      }
    }
  };

  /**
   * Synchronously creates/resumes the AudioContext. Must be called directly inside
   * a user gesture handler, before any `await`, so the browser's transient user
   * activation is still valid (Safari/iOS drop it across microtask boundaries).
   */
  public unlock(): void {
    this.ensureAudioContext();
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.ctx) {
      const AudioCtxClass =
        typeof window !== 'undefined'
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
        this.ctx.onstatechange = this.handleAudioContextStateChange;
        this.masterGainNode = this.ctx.createGain();
        this.masterGainNode.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setTempo(bpm: number): void {
    const clamped = clampTempo(bpm);
    if (this.tempo === clamped) return;

    if (this.isRunning && !this.isPaused && this.ctx) {
      // Re-anchor timing seamlessly on tempo change so current fractional beat position remains continuous
      const currentBeat = this.getCurrentGlobalBeat();
      this.tempo = clamped;
      this.updateMeterParams();
      this.measureZeroStartTime = this.audibleTime() - currentBeat * this.secondsPerBeat;

      // Accurately align to the next unplayed beat boundary to avoid duplicate or clashing clicks
      const nextGlobalBeatIndex = Math.ceil(
        (this.ctx.currentTime + 0.02 - this.measureZeroStartTime) / this.secondsPerBeat
      );
      this.nextBeatTime = this.measureZeroStartTime + nextGlobalBeatIndex * this.secondsPerBeat;
      this.scheduledBeatCount = Math.max(0, nextGlobalBeatIndex + this.countInBeatsTotal);
    } else if (this.isRunning && this.isPaused) {
      // Preserve current fractional beat position when tempo changes while paused
      const currentBeat = this.getCurrentGlobalBeat();
      this.tempo = clamped;
      this.updateMeterParams();
      this.pausedElapsedSeconds = currentBeat * this.secondsPerBeat;
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
    const meter = METER[this.timeSignature];
    this.beatsPerMeasure = meter.beatsPerMeasure;
    this.secondsPerBeat = (60 / this.tempo) * meter.secondsPerBeatFactor;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateMasterGain();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateMasterGain();
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public setSoundProfile(profile: SoundProfile): void {
    this.soundProfile = profile;
  }

  public getSoundProfile(): SoundProfile {
    return this.soundProfile;
  }

  public setPulse68(mode: Pulse68Mode): void {
    this.pulse68 = mode;
  }

  public getPulse68(): Pulse68Mode {
    return this.pulse68;
  }

  private updateMasterGain(): void {
    if (this.masterGainNode && this.ctx && this.isRunning && !this.isPaused) {
      const targetGain = this.isMuted ? 0 : this.volume;
      this.masterGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
    }
  }

  public start(countIn: boolean = true): void {
    const ctx = this.ensureAudioContext();
    this.stop();

    this.isRunning = true;
    this.isPaused = false;
    this.hasCountIn = countIn;
    this.countInBeatsTotal = countIn ? this.beatsPerMeasure : 0;

    // Ensure session category is playback while running
    this.setAudioSessionCategory('playback');
    this.updateMasterGain();

    if (!ctx) return;

    const startTime = ctx.currentTime + 0.05;
    this.nextBeatTime = startTime;
    this.scheduledBeatCount = 0;
    this.pausedElapsedSeconds = 0;

    this.measureZeroStartTime = startTime + this.countInBeatsTotal * this.secondsPerBeat;

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
    this.scheduler();
  }

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    // Snapshot the *audible* position so resume continues exactly where the ear left off
    this.pausedElapsedSeconds = this.getElapsedPlaybackSeconds();
    this.isPaused = true;
    this.setAudioSessionCategory('ambient');
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Immediately silence any queued audio clicks
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.setAudioSessionCategory('playback');
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    this.isPaused = false;

    // Unmute master gain to target volume
    this.updateMasterGain();

    const currentAudioTime = this.ctx ? this.ctx.currentTime : 0;
    this.measureZeroStartTime = this.audibleTime() - this.pausedElapsedSeconds;

    // Accurately align to the next unplayed beat boundary to avoid duplicate or clashing clicks
    const nextGlobalBeatIndex = Math.ceil(
      (currentAudioTime + 0.02 - this.measureZeroStartTime) / this.secondsPerBeat
    );
    this.nextBeatTime = this.measureZeroStartTime + nextGlobalBeatIndex * this.secondsPerBeat;
    this.scheduledBeatCount = Math.max(0, nextGlobalBeatIndex + this.countInBeatsTotal);

    this.timerId = window.setInterval(() => {
      this.scheduler();
    }, this.lookaheadMs);
    this.scheduler();
  }

  public stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    this.setAudioSessionCategory('ambient');
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    // Silence master gain immediately
    if (this.masterGainNode && this.ctx) {
      this.masterGainNode.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    }

    this.scheduledBeatCount = 0;
    this.pausedElapsedSeconds = 0;
  }

  private scheduler(): void {
    if (!this.ctx || !this.isRunning || this.isPaused) return;

    while (this.nextBeatTime < this.ctx.currentTime + this.scheduleAheadSeconds) {
      const beatTime = this.nextBeatTime;
      const isCountIn = this.hasCountIn && this.scheduledBeatCount < this.countInBeatsTotal;

      const beatIndex = isCountIn
        ? this.scheduledBeatCount
        : this.scheduledBeatCount - this.countInBeatsTotal;
      const beatNumber = (beatIndex % this.beatsPerMeasure) + 1;

      const isCompound68 = this.timeSignature === '6/8' && this.pulse68 === 'dotted-quarter';
      const shouldClick = !isCompound68 || beatNumber === 1 || beatNumber === 4;

      if (shouldClick) {
        this.scheduleClick(
          beatTime,
          beatNumber === 1,
          this.timeSignature === '6/8' && beatNumber === 4
        );
      }


      this.scheduledBeatCount++;
      this.nextBeatTime += this.secondsPerBeat;
    }
  }

  private scheduleClick(
    time: number,
    isDownbeat: boolean,
    isCompoundSubaccent: boolean = false
  ): void {
    if (!this.ctx || !this.masterGainNode) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (this.soundProfile === 'woodblock') {
      // Woodblock: sine wave with rapid downward pitch sweep
      osc.type = 'sine';
      let freqStart = 1100;
      let freqEnd = 550;
      let gainLevel = 0.9;

      if (isDownbeat) {
        freqStart = 1600;
        freqEnd = 800;
        gainLevel = 1.0;
      } else if (isCompoundSubaccent) {
        freqStart = 1350;
        freqEnd = 675;
        gainLevel = 0.95;
      }

      osc.frequency.setValueAtTime(freqStart, time);
      osc.frequency.exponentialRampToValueAtTime(freqEnd, time + 0.025);

      gain.gain.setValueAtTime(gainLevel, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.025);

      osc.connect(gain);
      gain.connect(this.masterGainNode);

      osc.start(time);
      osc.stop(time + 0.03);
    } else {
      // Electronic triangle click
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
    }

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // Safe disposal
      }
    };
  }

  /**
   * Output latency of the audio device (seconds): the delay between a sample's
   * context time and when it leaves the speaker (large on Bluetooth).
   */
  private outputLatency(): number {
    if (!this.ctx) return 0;
    return this.ctx.outputLatency || this.ctx.baseLatency || 0;
  }

  /** Context time of the sample currently reaching the listener's ear. */
  private audibleTime(): number {
    return this.ctx ? this.ctx.currentTime - this.outputLatency() : 0;
  }

  /**
   * Returns elapsed seconds relative to Measure 0.
   * When stopped, returns 0.
   * During count-in, this value is negative (-countInDuration to 0).
   * Compensated for output latency so visuals track what is *heard*, not what
   * has merely been handed to the audio device.
   */
  public getElapsedPlaybackSeconds(): number {
    if (!this.isRunning) return 0;
    if (this.isPaused) return this.pausedElapsedSeconds;
    if (!this.ctx) return 0;
    return this.audibleTime() - this.measureZeroStartTime;
  }

  /**
   * Returns current fractional beat position relative to Measure 0.
   * At beat 0 of Measure 0, this returns 0.
   * During count-in, this returns negative fractional beats (-beatsPerMeasure to 0).
   */
  public getCurrentGlobalBeat(): number {
    if (!this.isRunning) return 0;
    if (this.secondsPerBeat <= 0) return 0;
    return this.getElapsedPlaybackSeconds() / this.secondsPerBeat;
  }

  /**
   * Returns current visual scroll beat position.
   * Clamped to >= 0 so during count-in the score waits in place at Measure 0.
   */
  public getVisualBeat(): number {
    return Math.max(0, this.getCurrentGlobalBeat());
  }

  /**
   * Returns the beat currently being heard, derived purely from the hardware clock,
   * or null when stopped or before the first click has sounded. Polled once per
   * rAF frame by the UI: no independent timers, so the indicator cannot drift.
   */
  public getBeatInfo(): BeatInfo | null {
    if (!this.isRunning) return null;
    const beatIndex = Math.floor(this.getCurrentGlobalBeat());
    if (beatIndex < -this.countInBeatsTotal) return null;
    const n = this.beatsPerMeasure;
    const beatNumber = (((beatIndex % n) + n) % n) + 1;
    return {
      beatIndex,
      beatNumber,
      isDownbeat: beatNumber === 1,
      isCountIn: beatIndex < 0,
    };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  public getIsPaused(): boolean {
    return this.isPaused;
  }

  public isCountingIn(): boolean {
    if (!this.isRunning) return false;
    return this.hasCountIn && this.getCurrentGlobalBeat() < 0;
  }
}

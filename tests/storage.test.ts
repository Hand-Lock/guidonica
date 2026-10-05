import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_APP_SETTINGS, STORAGE_KEY, loadStoredSettings, saveStoredSettings } from '../src/storage';
import { AppSettings, resolveTheme } from '../src/notation/types';

describe('storage module', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns default settings when storage is empty', () => {
    const loaded = loadStoredSettings();
    expect(loaded).toEqual(DEFAULT_APP_SETTINGS);
    expect(loaded.soundProfile).toBe('woodblock');
    expect(loaded.theme).toBe('auto');
    expect(loaded.zoom).toBe(1.0);
    expect(loaded.zoomMode).toBe('auto');
    expect(loaded.showPlayhead).toBe(true);
  });

  it('persists and reloads modified settings accurately', () => {
    const custom: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      tempo: 144,
      clef: 'bass',
      timeSignature: '3/4',
      soundProfile: 'triangle',
      theme: 'dark',
      volume: 0.5,
      isMuted: true,
      solfegeLabelMode: 'syllables',
      zoom: 0.75,
      zoomMode: 'manual',
      showPlayhead: false,
    };

    saveStoredSettings(custom);
    const loaded = loadStoredSettings();

    expect(loaded.tempo).toBe(144);
    expect(loaded.clef).toBe('bass');
    expect(loaded.timeSignature).toBe('3/4');
    expect(loaded.soundProfile).toBe('triangle');
    expect(loaded.theme).toBe('dark');
    expect(loaded.volume).toBe(0.5);
    expect(loaded.isMuted).toBe(true);
    expect(loaded.solfegeLabelMode).toBe('syllables');
    expect(loaded.zoom).toBe(0.75);
    expect(loaded.zoomMode).toBe('manual');
    expect(loaded.showPlayhead).toBe(false);
  });

  it('clamps zoom setting between MIN_ZOOM (0.3) and MAX_ZOOM (1.5)', () => {
    // Zoom too low
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ zoom: 0.1 })
    );
    expect(loadStoredSettings().zoom).toBe(0.3);

    // Zoom too high
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ zoom: 2.5 })
    );
    expect(loadStoredSettings().zoom).toBe(1.5);

    // Invalid NaN / non-number zoom fallback to 1.0
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ zoom: 'invalid' })
    );
    expect(loadStoredSettings().zoom).toBe(1.0);
  });

  it('gracefully recovers and merges when stored JSON is partial or corrupt', () => {
    window.localStorage.setItem('solfege_scroller_settings_v1', 'not valid json!!!');
    const loadedCorrupt = loadStoredSettings();
    expect(loadedCorrupt).toEqual(DEFAULT_APP_SETTINGS);
    expect(loadedCorrupt.soundProfile).toBe('woodblock');
    expect(loadedCorrupt.theme).toBe('auto');

    // Partial settings
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 92 })
    );
    const loadedPartial = loadStoredSettings();
    expect(loadedPartial.tempo).toBe(92);
    expect(loadedPartial.clef).toBe(DEFAULT_APP_SETTINGS.clef);
    expect(loadedPartial.soundProfile).toBe('woodblock');
    expect(loadedPartial.theme).toBe('auto');
    expect(loadedPartial.subdivisions).toEqual(DEFAULT_APP_SETTINGS.subdivisions);
  });

  it('migrates the legacy italian label mode to syllables', () => {
    const legacy = {
      ...DEFAULT_APP_SETTINGS,
      solfegeLabelMode: 'italian',
      soundProfile: 'woodblock',
      theme: 'auto',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
    const loaded = loadStoredSettings();

    expect(loaded.solfegeLabelMode).toBe('syllables');
    expect(loaded.soundProfile).toBe('woodblock');
    expect(loaded.theme).toBe('auto');
  });

  it('migrates legacy v1 storage with light theme and triangle click to auto and woodblock', () => {
    // Legacy v1 with light theme & triangle click (the old hardcoded defaults)
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 110, theme: 'light', soundProfile: 'triangle', clef: 'bass' })
    );
    const migratedLight = loadStoredSettings();
    expect(migratedLight.tempo).toBe(110);
    expect(migratedLight.clef).toBe('bass');
    expect(migratedLight.theme).toBe('auto');
    expect(migratedLight.soundProfile).toBe('woodblock');

    window.localStorage.clear();

    // Legacy v1 with dark theme (explicit user choice in v1)
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 80, theme: 'dark' })
    );
    const migratedDark = loadStoredSettings();
    expect(migratedDark.tempo).toBe(80);
    expect(migratedDark.theme).toBe('dark');
    expect(migratedDark.soundProfile).toBe('woodblock');

    window.localStorage.clear();

    // Explicit v2 choices (e.g. user chose electronic click and light theme in v2)
    window.localStorage.setItem(
      'solfege_scroller_settings_v2',
      JSON.stringify({ tempo: 100, theme: 'light', soundProfile: 'triangle' })
    );
    const v2Loaded = loadStoredSettings();
    expect(v2Loaded.theme).toBe('light');
    expect(v2Loaded.soundProfile).toBe('triangle');

    window.localStorage.clear();

    // Primary guidonica_settings_v1 key persistence
    saveStoredSettings({ ...DEFAULT_APP_SETTINGS, tempo: 130 });
    expect(window.localStorage.getItem('guidonica_settings_v1')).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem('guidonica_settings_v1')!).tempo).toBe(130);

    // guidonica_settings_v1 takes precedence over legacy keys if both exist
    window.localStorage.setItem(
      'solfege_scroller_settings_v2',
      JSON.stringify({ tempo: 75 })
    );
    const primaryLoaded = loadStoredSettings();
    expect(primaryLoaded.tempo).toBe(130);
  });

  it('correctly resolves explicit and auto themes', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    // In node/vitest environment, window.matchMedia defaults to false or mocked
    const resolvedAuto = resolveTheme('auto');
    expect(['light', 'dark']).toContain(resolvedAuto);
  });

  it('persists and validates all 8 Setticlavio clefs, falling back to default for invalid clef values', () => {
    const allClefs = [
      'treble',
      'soprano',
      'mezzo-soprano',
      'alto',
      'tenor',
      'baritone-f',
      'baritone-c',
      'bass',
    ] as const;

    for (const clef of allClefs) {
      window.localStorage.clear();
      saveStoredSettings({ ...DEFAULT_APP_SETTINGS, clef });
      const loaded = loadStoredSettings();
      expect(loaded.clef).toBe(clef);
    }

    // Invalid clef fallback
    window.localStorage.clear();
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ clef: 'nonexistent-clef' })
    );
    const fallbackLoaded = loadStoredSettings();
    expect(fallbackLoaded.clef).toBe(DEFAULT_APP_SETTINGS.clef);
  });

  it('migrates the legacy 6/8-only pulse68 key to compoundPulse (ADR 0076)', () => {
    window.localStorage.setItem('guidonica_settings_v1', JSON.stringify({ timeSignature: '12/8', pulse68: 'eighth' }));
    const legacy = loadStoredSettings();
    expect(legacy.timeSignature).toBe('12/8');
    expect(legacy.compoundPulse).toBe('eighth');
    expect(Object.keys(legacy)).not.toContain('pulse68');
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ timeSignature: '9/8', compoundPulse: 'dotted-quarter', pulse68: 'eighth' })
    );
    expect(loadStoredSettings().compoundPulse).toBe('dotted-quarter');
  });

  it('falls back per-field on corrupt or out-of-range values', () => {
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({
        timeSignature: '5/4',
        tempo: 'fast',
        volume: 7,
        compoundPulse: 42,
        clef: 'banjo',
        subdivisions: { quarter: 'yes', eighth: false },
        intervals: null,
        tuplets: { triplet: { '1/8': 1, '1/4': true } },
        injected: { evil: true },
      })
    );
    const loaded = loadStoredSettings();
    expect(loaded.timeSignature).toBe(DEFAULT_APP_SETTINGS.timeSignature);
    expect(loaded.tempo).toBe(DEFAULT_APP_SETTINGS.tempo);
    expect(loaded.volume).toBe(1);
    expect(loaded.compoundPulse).toBe(DEFAULT_APP_SETTINGS.compoundPulse);
    expect(loaded.clef).toBe(DEFAULT_APP_SETTINGS.clef);
    expect(loaded.subdivisions.quarter).toBe(DEFAULT_APP_SETTINGS.subdivisions.quarter);
    expect(loaded.subdivisions.eighth).toBe(false);
    expect(loaded.intervals).toEqual(DEFAULT_APP_SETTINGS.intervals);
    expect(loaded.tuplets.triplet['1/8']).toBe(false);
    expect(loaded.tuplets.triplet['1/4']).toBe(true);
    expect(Object.keys(loaded)).not.toContain('injected');
    expect(Object.keys(loaded.subdivisions).sort()).toEqual(
      Object.keys(DEFAULT_APP_SETTINGS.subdivisions).sort()
    );
  });

  it('clamps stored tempo to the metronome range', () => {
    window.localStorage.setItem('guidonica_settings_v1', JSON.stringify({ tempo: 999 }));
    expect(loadStoredSettings().tempo).toBe(240);
  });

  it('migrates the removed subdivisions.triplets flag to the 1/8 triplet cell', () => {
    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ subdivisions: { quarter: true, triplets: true } })
    );
    const loaded = loadStoredSettings();
    expect(loaded.tuplets.triplet['1/8']).toBe(true);
    expect(Object.keys(loaded.subdivisions)).not.toContain('triplets');
  });

  it('validates ledger lines: defaults to 3/3, rounds and clamps to 0–3', () => {
    window.localStorage.setItem('guidonica_settings_v1', JSON.stringify({ clef: 'bass' }));
    expect(loadStoredSettings().ledgerLines).toEqual({ above: 3, below: 3 });

    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ ledgerLines: { above: 1.6, below: -4 } })
    );
    expect(loadStoredSettings().ledgerLines).toEqual({ above: 2, below: 0 });

    window.localStorage.setItem(
      'guidonica_settings_v1',
      JSON.stringify({ ledgerLines: { above: 'many', below: 9 } })
    );
    expect(loadStoredSettings().ledgerLines).toEqual({ above: 3, below: 3 });
  });

  it('never shares nested default objects with the returned settings', () => {
    const a = loadStoredSettings();
    a.tuplets.triplet['1/4'] = true;
    a.intervals.unison = true;
    a.pitchClasses.c = false;
    expect(DEFAULT_APP_SETTINGS.tuplets.triplet['1/4']).toBe(false);
    expect(DEFAULT_APP_SETTINGS.intervals.unison).toBe(false);
    expect(DEFAULT_APP_SETTINGS.pitchClasses.c).toBe(true);
  });

  it('validates pitch classes: all on by default, per-note fallback, all off loads as all on (ADR 0070)', () => {
    const ALL = { c: true, d: true, e: true, f: true, g: true, a: true, b: true };
    expect(loadStoredSettings().pitchClasses).toEqual(ALL);

    saveStoredSettings({ ...DEFAULT_APP_SETTINGS, pitchClasses: { ...ALL, f: false, b: false } });
    expect(loadStoredSettings().pitchClasses).toEqual({ ...ALL, f: false, b: false });

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pitchClasses: { c: false, d: 'no', x: false } }));
    expect(loadStoredSettings().pitchClasses).toEqual({ ...ALL, c: false });

    const none = { c: false, d: false, e: false, f: false, g: false, a: false, b: false };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pitchClasses: none }));
    expect(loadStoredSettings().pitchClasses).toEqual(ALL);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ pitchClasses: 'cde' }));
    expect(loadStoredSettings().pitchClasses).toEqual(ALL);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_APP_SETTINGS, loadStoredSettings, saveStoredSettings } from '../src/storage';
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
      solfegeLabelMode: 'solfege',
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
    expect(loaded.solfegeLabelMode).toBe('solfege');
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

  it('persists and reloads italian solfege label mode and auto theme accurately', () => {
    const custom: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      solfegeLabelMode: 'italian',
      soundProfile: 'woodblock',
      theme: 'auto',
    };

    saveStoredSettings(custom);
    const loaded = loadStoredSettings();

    expect(loaded.solfegeLabelMode).toBe('italian');
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
});

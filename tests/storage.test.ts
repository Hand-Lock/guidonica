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
  });

  it('persists and reloads modified settings accurately', () => {
    const custom: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      tempo: 144,
      clef: 'bass',
      timeSignature: '3/4',
      theme: 'dark',
      volume: 0.5,
      isMuted: true,
      solfegeLabelMode: 'solfege',
    };

    saveStoredSettings(custom);
    const loaded = loadStoredSettings();

    expect(loaded.tempo).toBe(144);
    expect(loaded.clef).toBe('bass');
    expect(loaded.timeSignature).toBe('3/4');
    expect(loaded.theme).toBe('dark');
    expect(loaded.volume).toBe(0.5);
    expect(loaded.isMuted).toBe(true);
    expect(loaded.solfegeLabelMode).toBe('solfege');
  });

  it('gracefully recovers and merges when stored JSON is partial or corrupt', () => {
    window.localStorage.setItem('solfege_scroller_settings_v1', 'not valid json!!!');
    const loadedCorrupt = loadStoredSettings();
    expect(loadedCorrupt).toEqual(DEFAULT_APP_SETTINGS);

    // Partial settings
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 92 })
    );
    const loadedPartial = loadStoredSettings();
    expect(loadedPartial.tempo).toBe(92);
    expect(loadedPartial.clef).toBe(DEFAULT_APP_SETTINGS.clef);
    expect(loadedPartial.subdivisions).toEqual(DEFAULT_APP_SETTINGS.subdivisions);
  });

  it('persists and reloads italian solfege label mode and auto theme accurately', () => {
    const custom: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      solfegeLabelMode: 'italian',
      theme: 'auto',
    };

    saveStoredSettings(custom);
    const loaded = loadStoredSettings();

    expect(loaded.solfegeLabelMode).toBe('italian');
    expect(loaded.theme).toBe('auto');
  });

  it('migrates legacy v1 storage with light theme to auto, while preserving explicit dark theme', () => {
    // Legacy v1 with light theme (the old hardcoded default)
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 110, theme: 'light', clef: 'bass' })
    );
    const migratedLight = loadStoredSettings();
    expect(migratedLight.tempo).toBe(110);
    expect(migratedLight.clef).toBe('bass');
    expect(migratedLight.theme).toBe('auto');

    window.localStorage.clear();

    // Legacy v1 with dark theme (explicit user choice in v1)
    window.localStorage.setItem(
      'solfege_scroller_settings_v1',
      JSON.stringify({ tempo: 80, theme: 'dark' })
    );
    const migratedDark = loadStoredSettings();
    expect(migratedDark.tempo).toBe(80);
    expect(migratedDark.theme).toBe('dark');
  });

  it('correctly resolves explicit and auto themes', () => {
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
    // In node/vitest environment, window.matchMedia defaults to false or mocked
    const resolvedAuto = resolveTheme('auto');
    expect(['light', 'dark']).toContain(resolvedAuto);
  });
});

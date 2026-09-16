import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_APP_SETTINGS, loadStoredSettings, saveStoredSettings } from '../src/storage';
import { AppSettings } from '../src/notation/types';

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
});

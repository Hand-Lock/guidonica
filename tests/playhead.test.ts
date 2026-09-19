import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../src/state';
import { loadStoredSettings, saveStoredSettings, STORAGE_KEY } from '../src/storage';
import { DEFAULT_APP_SETTINGS } from '../src/storage';

describe('Playhead visibility setting', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to showPlayhead: true in initial state and default settings', () => {
    expect(DEFAULT_APP_SETTINGS.showPlayhead).toBe(true);

    const appState = new AppState();
    expect(appState.settings.showPlayhead).toBe(true);
  });

  it('updates state and notifies subscribers when showPlayhead is toggled', () => {
    const appState = new AppState();
    let notifiedValue: boolean | undefined;

    appState.subscribe((state) => {
      notifiedValue = state.settings.showPlayhead;
    });

    appState.updateSettings({ showPlayhead: false });
    expect(appState.settings.showPlayhead).toBe(false);
    expect(notifiedValue).toBe(false);

    appState.updateSettings({ showPlayhead: true });
    expect(appState.settings.showPlayhead).toBe(true);
    expect(notifiedValue).toBe(true);
  });

  it('persists showPlayhead preference in localStorage', () => {
    const appState = new AppState();
    appState.updateSettings({ showPlayhead: false });

    // Verify localStorage was written
    const storedRaw = window.localStorage.getItem(STORAGE_KEY);
    expect(storedRaw).not.toBeNull();
    const parsed = JSON.parse(storedRaw!);
    expect(parsed.showPlayhead).toBe(false);

    // Verify reloading from stored settings
    const loaded = loadStoredSettings();
    expect(loaded.showPlayhead).toBe(false);
  });

  it('gracefully handles non-boolean or missing showPlayhead values in storage', () => {
    // Non-boolean string
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showPlayhead: 'yes' }));
    expect(loadStoredSettings().showPlayhead).toBe(true);

    // Non-boolean number
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ showPlayhead: 123 }));
    expect(loadStoredSettings().showPlayhead).toBe(true);

    // Missing key
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ tempo: 80 }));
    expect(loadStoredSettings().showPlayhead).toBe(true);
  });
});

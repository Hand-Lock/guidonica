import { describe, it, expect, afterEach, vi } from 'vitest';
import { POINTER_QUERY, isPhysicalKeyEvent, watchKeyboard } from '../src/utils/keyboard';

/** A MediaQueryList stand-in whose `matches` the test flips and announces. */
class FakeMedia extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }
  set(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');

function stubMedia(matches: boolean): FakeMedia {
  const media = new FakeMedia(matches);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => {
      expect(query).toBe(POINTER_QUERY);
      return media;
    }),
  });
  return media;
}

function press(target: EventTarget, init: KeyboardEventInit = { key: 'a' }): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

/** Records every guess; `last()` is the current one. */
function watch(): { calls: boolean[]; last: () => boolean | undefined } {
  const calls: boolean[] = [];
  watchKeyboard((likely) => calls.push(likely));
  return { calls, last: () => calls[calls.length - 1] };
}

afterEach(() => {
  if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
  else delete (window as { matchMedia?: unknown }).matchMedia;
  document.body.replaceChildren();
});

describe('watchKeyboard', () => {
  it('is likely with a mouse or trackpad', () => {
    stubMedia(true);
    expect(watch().calls).toEqual([true]);
  });

  it('is unlikely on touch only, until a physical key is pressed', () => {
    stubMedia(false);
    const w = watch();
    expect(w.calls).toEqual([false]);
    press(document.body);
    expect(w.calls).toEqual([false, true]);
    press(document.body);
    expect(w.calls).toEqual([false, true]);
  });

  it('ignores keys an on-screen keyboard can send', () => {
    stubMedia(false);
    const w = watch();
    const input = document.createElement('input');
    input.type = 'number';
    document.body.append(input);
    press(input);
    press(document.body, { key: 'Unidentified' });
    press(document.body, { key: 'a', isComposing: true });
    expect(w.calls).toEqual([false]);
  });

  it('follows a mouse attached or detached', () => {
    const media = stubMedia(false);
    const w = watch();
    media.set(true);
    expect(w.last()).toBe(true);
    media.set(false);
    expect(w.last()).toBe(false);
  });

  it('stays likely after a key press when the mouse goes away', () => {
    const media = stubMedia(true);
    const w = watch();
    press(document.body);
    media.set(false);
    expect(w.last()).toBe(true);
  });

  it('assumes a keyboard without matchMedia', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: undefined });
    expect(watch().calls).toEqual([true]);
  });
});

describe('isPhysicalKeyEvent', () => {
  const on = (el: HTMLElement, init: KeyboardEventInit = { key: 'a' }): boolean => {
    document.body.append(el);
    let result = false;
    el.addEventListener('keydown', (e) => (result = isPhysicalKeyEvent(e)));
    press(el, init);
    return result;
  };

  it('accepts keys on non-editable targets', () => {
    expect(on(document.createElement('button'))).toBe(true);
    for (const type of ['checkbox', 'radio', 'range']) {
      const input = document.createElement('input');
      input.type = type;
      expect(on(input)).toBe(true);
    }
  });

  it('rejects editable targets', () => {
    expect(on(document.createElement('input'))).toBe(false);
    expect(on(document.createElement('textarea'))).toBe(false);
    expect(on(document.createElement('select'))).toBe(false);
  });
});

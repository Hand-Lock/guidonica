/**
 * Guesses whether a physical keyboard is at hand (ADR 0106). No web API reports one, so two
 * signals stand in: a mouse or trackpad (desktops, laptops, an iPad with a Magic Keyboard),
 * and a key press that only a physical keyboard could have sent.
 */

/** Any fine pointer or hovering input: a touch-only phone or tablet fails it. */
export const POINTER_QUERY = '(any-pointer: fine), (any-hover: hover)';

/**
 * True for a key press from a physical keyboard. On-screen keyboards only send keys to
 * editable fields, and Android's report `Unidentified` while composing.
 */
export function isPhysicalKeyEvent(e: KeyboardEvent): boolean {
  if (e.isComposing || e.key === 'Unidentified') return false;
  const target = e.target;
  if (target instanceof HTMLInputElement) {
    return target.type === 'checkbox' || target.type === 'radio' || target.type === 'range';
  }
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return false;
  return !(target instanceof HTMLElement && target.isContentEditable);
}

/**
 * Calls `onChange` now and whenever the guess changes: a mouse attached or detached, or the
 * first physical key press, which keeps it true for the session. Without matchMedia the
 * guess is true, so nothing keyboard-related is ever wrongly hidden.
 */
export function watchKeyboard(onChange: (likely: boolean) => void): void {
  const media = window.matchMedia?.(POINTER_QUERY);
  let keySeen = false;
  const update = (): void => onChange(keySeen || !media || media.matches);
  update();
  media?.addEventListener?.('change', update);
  const onKey = (e: KeyboardEvent): void => {
    if (!isPhysicalKeyEvent(e)) return;
    keySeen = true;
    window.removeEventListener('keydown', onKey, true);
    update();
  };
  window.addEventListener('keydown', onKey, true);
}

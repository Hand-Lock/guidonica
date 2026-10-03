// Roving-tabindex radiogroup helpers shared by the intro's option cards and language
// chips (ADR 0049, ADR 0059): one tab stop per group, arrows move focus and selection.

/** Marks `value` as checked; the checked item (or the first) is the group's tab stop. */
export function setRadioSelection(buttons: readonly HTMLButtonElement[], value: string | null): void {
  const hasMatch = buttons.some((b) => b.dataset.value === value);
  buttons.forEach((btn, i) => {
    const checked = btn.dataset.value === value;
    btn.setAttribute('aria-checked', String(checked));
    btn.tabIndex = checked || (!hasMatch && i === 0) ? 0 : -1;
  });
}

/**
 * Arrow, Home and End keys move through `buttons` and select the focused one. The
 * container takes focus itself while nothing is selected, so no item shows a misleading ring.
 */
export function bindRovingKeys(
  container: HTMLElement,
  buttons: readonly HTMLButtonElement[],
  select: (btn: HTMLButtonElement) => void
): void {
  container.tabIndex = -1;
  container.addEventListener('keydown', (e) => {
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = index;
    if (index < 0 && document.activeElement !== container) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % buttons.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (Math.max(index, 0) - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    else return;
    e.preventDefault();
    buttons[next].focus();
    select(buttons[next]);
  });
}

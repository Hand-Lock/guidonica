// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Roving-tabindex tablist (ADR 0097)
// Copyright (C) 2026 A. C. Lo Cascio

import { bindRovingKeys } from './radioGroup';

/**
 * Shows the tab whose `data-tab` is `id` and hides the others' panels (`aria-controls`).
 * The selected tab is the list's only tab stop. Returns false if no tab matches.
 */
export function selectTab(tabs: readonly HTMLButtonElement[], id: string): boolean {
  if (!tabs.some((tab) => tab.dataset.tab === id)) return false;
  for (const tab of tabs) {
    const selected = tab.dataset.tab === id;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    const panelId = tab.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (panel) panel.hidden = !selected;
  }
  return true;
}

/**
 * Binds a `role="tablist"`: a click or the arrow, Home and End keys select a tab
 * (automatic activation, the panels are already in the DOM). Returns the select function.
 */
export function bindTabs(list: HTMLElement, onSelect?: (id: string) => void): (id: string) => boolean {
  const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const select = (id: string): boolean => {
    const changed = selectTab(tabs, id);
    if (changed) onSelect?.(id);
    return changed;
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab.dataset.tab ?? ''));
  }
  bindRovingKeys(list, tabs, (tab) => select(tab.dataset.tab ?? ''));
  return select;
}

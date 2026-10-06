// SPDX-License-Identifier: AGPL-3.0-or-later
// Guidonica - Service Worker Registration (ADR 0063)
// Copyright (C) 2026 A. C. Lo Cascio

/// <reference types="vite/client" />

/**
 * Registers the offline worker in production builds only. Waits for `load` so it never
 * competes with first-load bandwidth; failures leave the app working online as before.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const register = (): void => {
    // sw.js sits at the app root, one level above this chunk in assets/, on both channels;
    // the language pages in /it/ etc. register the same worker (ADR 0086). Ignored by Vite,
    // which would otherwise look for the file at build time.
    const url = new URL(/* @vite-ignore */ '../sw.js', import.meta.url);
    navigator.serviceWorker.register(url).catch(() => {
      // Offline support is optional
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

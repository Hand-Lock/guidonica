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
    // Relative URL: the default scope is the app directory on both hosts.
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support is optional
    });
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

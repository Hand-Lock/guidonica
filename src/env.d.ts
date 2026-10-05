// Build-time constants and module types defined by the channel plugin in vite.config.ts (ADR 0078).

/** package.json `version`: the CalVer release, or the release a nightly build is based on. */
declare const __APP_VERSION__: string;
declare const __APP_CHANNEL__: 'release' | 'nightly';
/** Short commit hash of the built checkout ('' outside git). */
declare const __APP_COMMIT__: string;
/** Commit date (YYYY-MM-DD) of the built checkout ('' outside git). */
declare const __APP_BUILD_DATE__: string;

/** A changelog file as in-app notes: user-facing sections, plain-text bullets. */
declare module '*.md?notes' {
  const notes: import('./whatsNew').ReleaseNotes[];
  export default notes;
}

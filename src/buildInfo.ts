// Build stamp surfaced in the UI so we can confirm which build is loaded. Values are injected
// at build time by Vite `define` (see vite.config.ts) and refresh on every build.

export const APP_VERSION = __APP_VERSION__;
export const BUILD_COMMIT = __BUILD_COMMIT__;
export const BUILD_TIME = __BUILD_TIME__;

/** Visible build number, e.g. "v1.7.0". Commit + time stay available (e.g. for the hover title). */
export const BUILD_LABEL = `v${APP_VERSION}`;

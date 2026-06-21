// Build stamp surfaced in the UI so we can confirm which build is loaded. Values are injected
// at build time by Vite `define` (see vite.config.ts) and refresh on every build.

export const APP_VERSION = __APP_VERSION__;
export const BUILD_COMMIT = __BUILD_COMMIT__;
export const BUILD_TIME = __BUILD_TIME__;

/** Compact label, e.g. "v1.0.0 · 0dd7264 · Jun 22, 14:32". */
export const BUILD_LABEL = `v${APP_VERSION} · ${BUILD_COMMIT} · ${new Date(BUILD_TIME).toLocaleString([], {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})}`;

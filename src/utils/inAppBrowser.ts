// Escape hatch for embedded ("in-app") browsers. FloodedArea auto-posts reports to X and Facebook,
// so most inbound taps open the site inside those apps' own WebView rather than Chrome or Safari.
// Google refuses its Identity Services in an embedded webview (the `disallowed_useragent` policy),
// so the sign-in button simply never renders there. This module names the host app for the message
// and, on Android, hands the URL off to the system browser where sign-in works normally.
//
// Detection here only *words* the help panel — LoginView triggers it off the button failing to lay
// out, never off the user agent, so a false positive can't hide a working sign-in button.

import { detectHelpBucket } from './locationHelp';

/** Which app's in-app browser we're inside, `generic` for an unrecognised webview, else null. */
export type InAppApp = 'x' | 'facebook' | 'messenger' | 'instagram' | 'tiktok' | 'generic' | null;

/** Human-readable name for the host app — interpolated into the help copy. */
export function inAppLabel(app: InAppApp): string | null {
  switch (app) {
    case 'x': return 'X';
    case 'facebook': return 'Facebook';
    case 'messenger': return 'Messenger';
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    default: return null;
  }
}

/** Best-effort guess at the embedding app. Returns null for a normal standalone browser. */
export function detectInAppBrowser(): InAppApp {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;

  if (/Twitter|TwitterAndroid/i.test(ua)) return 'x';
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/.test(ua)) return /Messenger|MESSENGER/.test(ua) ? 'messenger' : 'facebook';
  if (/Instagram/i.test(ua)) return 'instagram';
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) return 'tiktok';

  const bucket = detectHelpBucket();
  // Android tags every WebView-hosted page with "; wv)" — Chrome and Samsung Internet never carry it.
  if (bucket === 'android' && /;\s*wv\)/.test(ua)) return 'generic';
  // iOS in-app browsers are WKWebViews: they keep the platform tokens but drop Safari's own marker,
  // which every real iOS browser (Safari, Chrome/CriOS, Firefox/FxiOS) includes.
  if (bucket === 'ios' && !/Safari\//.test(ua) && !/CriOS\/|FxiOS\/|EdgiOS\//.test(ua)) return 'generic';

  return null;
}

/** Whether this platform can be handed off programmatically (Android only). */
export function canOpenInSystemBrowser(): boolean {
  return detectHelpBucket() === 'android';
}

/**
 * Android: hand the *current* URL (path and query included, so a report deep-link survives) to the
 * user's default browser via an intent: URI. Deliberately no `package=` clause — pinning Chrome
 * fails outright on a device that doesn't have it, whereas an unpinned intent resolves to whatever
 * browser the user actually uses. `browser_fallback_url` keeps a device that can't resolve the
 * intent on the page it was already showing instead of on an error.
 *
 * Returns false when there's nothing to try (iOS has no equivalent API), so the caller can show
 * written steps instead.
 */
export function openInSystemBrowser(): boolean {
  if (!canOpenInSystemBrowser()) return false;
  const { host, pathname, search, href } = window.location;
  window.location.href =
    `intent://${host}${pathname}${search}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(href)};end`;
  return true;
}

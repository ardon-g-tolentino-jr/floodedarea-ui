// Picks the right "how to enable location" instructions for the user's browser/OS. When the
// Geolocation permission is denied, the steps to re-grant it differ a lot by platform (a desktop
// address-bar toggle vs. the iOS Settings app), so we detect a coarse bucket and map it to an
// ordered list of i18n step keys rendered by LocationHelpModal.

import type { MsgKey } from '../i18n';

export type HelpBucket = 'ios' | 'android' | 'chromium' | 'firefox' | 'safari' | 'generic';

/** Best-effort platform/browser bucket from the user agent. Falls back to `generic`. */
export function detectHelpBucket(): HelpBucket {
  if (typeof navigator === 'undefined') return 'generic';
  const ua = navigator.userAgent;

  // iPadOS 13+ reports a Mac UA, so also treat touch-capable "Macintosh" as iOS.
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document);
  if (isIOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Firefox\//.test(ua)) return 'firefox';

  const isChromium = /Chrome\/|Chromium\/|Edg\/|OPR\//.test(ua);
  if (isChromium) return 'chromium';
  if (/Safari\//.test(ua)) return 'safari';
  return 'generic';
}

const STEPS: Record<HelpBucket, MsgKey[]> = {
  chromium: ['locHelp.chromium.1', 'locHelp.chromium.2', 'locHelp.chromium.3'],
  firefox: ['locHelp.firefox.1', 'locHelp.firefox.2', 'locHelp.firefox.3'],
  safari: ['locHelp.safari.1', 'locHelp.safari.2', 'locHelp.safari.3'],
  ios: ['locHelp.ios.1', 'locHelp.ios.2', 'locHelp.ios.3'],
  android: ['locHelp.android.1', 'locHelp.android.2', 'locHelp.android.3'],
  generic: ['locHelp.generic.1', 'locHelp.generic.2', 'locHelp.generic.3'],
};

/** Ordered i18n step keys to show for a given bucket. */
export function locationHelpSteps(bucket: HelpBucket): MsgKey[] {
  return STEPS[bucket];
}

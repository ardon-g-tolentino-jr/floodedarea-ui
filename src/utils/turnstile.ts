// Cloudflare Turnstile helper for guest anti-abuse. CAPTCHA is OPTIONAL: when
// VITE_TURNSTILE_SITE_KEY is unset (local/mock dev), captchaEnabled() is false and the report
// flow proceeds with no widget — mirroring how VITE_GOOGLE_CLIENT_ID gates Google SSO. The
// backend likewise only enforces the token for guest submissions when its secret is set.
//
// We use the explicit-render API and show a visible Managed widget in the report form (see
// components/TurnstileWidget.tsx), so a challenge can appear when Cloudflare flags a user.

export const TURNSTILE_SITE_KEY = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim();

/** True when a Turnstile site key is configured (so guest submits should carry a token). */
export function captchaEnabled(): boolean {
  return TURNSTILE_SITE_KEY.length > 0;
}

export interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
  reset: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

/** Load the Turnstile script once and resolve with the global API. Rejects if it fails to load. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('turnstile loaded but global missing'));
    };
    s.onerror = () => {
      scriptPromise = null; // allow a retry on next mount
      reject(new Error('turnstile failed to load'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

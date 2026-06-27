// Cloudflare Turnstile helper for guest anti-abuse. CAPTCHA is OPTIONAL: when
// VITE_TURNSTILE_SITE_KEY is unset (local/mock dev), getCaptchaToken() resolves to undefined and
// the report flow proceeds unhindered — mirroring how VITE_GOOGLE_CLIENT_ID gates Google SSO. The
// backend likewise only enforces the token for guest submissions when it too is configured. This
// helper is defensive: it never throws, so a CAPTCHA hiccup can't block a flood report.

const SITE_KEY = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim();

/** True when a Turnstile site key is configured (so guest submits should carry a token). */
export function captchaEnabled(): boolean {
  return SITE_KEY.length > 0;
}

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (idOrEl: string | HTMLElement, opts?: Record<string, unknown>) => void;
  remove: (id: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('turnstile failed to load'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Obtain a one-time CAPTCHA token, or undefined when CAPTCHA is disabled/unavailable. Renders an
 * invisible widget, executes it, and resolves with the token (or undefined after an 8s timeout).
 */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!SITE_KEY) return undefined;
  try {
    await loadScript();
    const api = window.turnstile;
    if (!api) return undefined;
    return await new Promise<string | undefined>((resolve) => {
      const holder = document.createElement('div');
      holder.style.display = 'none';
      document.body.appendChild(holder);
      let widgetId: string | undefined;
      const cleanup = () => {
        try {
          if (widgetId) api.remove(widgetId);
        } catch {
          /* ignore */
        }
        holder.remove();
      };
      const timer = window.setTimeout(() => {
        cleanup();
        resolve(undefined);
      }, 8000);
      const done = (token?: string) => {
        window.clearTimeout(timer);
        cleanup();
        resolve(token);
      };
      try {
        widgetId = api.render(holder, {
          sitekey: SITE_KEY,
          size: 'invisible',
          callback: (token: string) => done(token),
          'error-callback': () => done(undefined),
        });
        api.execute(widgetId);
      } catch {
        done(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

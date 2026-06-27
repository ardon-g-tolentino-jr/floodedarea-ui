import React from 'react';
import { captchaEnabled, loadTurnstile, TURNSTILE_SITE_KEY } from '../utils/turnstile';

interface TurnstileWidgetProps {
  /** Fires with the solved token, or null when it expires/errors (so callers can re-gate submit). */
  onToken: (token: string | null) => void;
}

/**
 * Renders a Cloudflare Turnstile (Managed) widget. Auto-solves silently for most users and shows
 * an interactive challenge only when Cloudflare flags the visitor. Renders nothing when Turnstile
 * is not configured (captchaEnabled() === false).
 */
const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({ onToken }) => {
  const holder = React.useRef<HTMLDivElement>(null);
  const widgetId = React.useRef<string | null>(null);
  // Keep the latest callback without re-running the render effect.
  const onTokenRef = React.useRef(onToken);
  onTokenRef.current = onToken;

  React.useEffect(() => {
    if (!captchaEnabled()) return;
    let cancelled = false;
    void loadTurnstile()
      .then((api) => {
        if (cancelled || !holder.current || widgetId.current) return;
        widgetId.current = api.render(holder.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (window.turnstile && widgetId.current) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* ignore */
        }
      }
      widgetId.current = null;
    };
  }, []);

  if (!captchaEnabled()) return null;
  return <div ref={holder} style={{ marginTop: 2, minHeight: 65 }} />;
};

export default TurnstileWidget;

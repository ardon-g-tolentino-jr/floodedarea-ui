// Builds the contextual Share message. Pure: the caller passes the page URL and live data,
// so this stays side-effect-free (no window/navigator access) per the utils/ convention.

import type { AlertLevel, FloodReport } from '../types';
import type { EnrichedReport } from './viewModel';
import { SEV_META, TREND_META } from './floodMeta';

const APP_NAME = 'FloodedArea';

/** The application's official Facebook page — surfaced in the Share dialog and appended to the
 *  copyable share message so it travels with every share. */
export const FB_PAGE_URL = 'https://www.facebook.com/share/1DLEBjCZDi/';

/** Facebook brand glyph (24×24 fill path) — shared by every "Follow us on Facebook" affordance
 *  (ShareModal's network grid, SupportModal's follow row) so there's one copy of the SVG path. */
export const FB_GLYPH_PATH =
  'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z';

/** Follow-us line appended to the full share text (clipboard / WhatsApp / email / native share). */
const FB_FOLLOW = `\n📘 Follow us on Facebook: ${FB_PAGE_URL}`;

/**
 * Deep-link to a specific flood report — opens the app focused on that report (App.tsx reads the
 * `report` query param on load). Caller passes `origin` (e.g. `window.location.origin`) to keep
 * this pure per the utils/ convention.
 */
export function buildReportUrl(origin: string, reportId: number): string {
  return `${origin}/?report=${reportId}`;
}

/** One-line pitch tail reused by both message variants. */
const PITCH =
  `${APP_NAME} — live crowd-sourced flood map for the Philippines: real-time reports, ` +
  `evac centers, road conditions & SOS rescue.`;

const ALERT_NOTE: Record<AlertLevel, string> = {
  red: 'a RED rainfall warning is up',
  orange: 'an ORANGE rainfall warning is up',
  yellow: 'a yellow rainfall advisory is up',
};

export interface ShareInputs {
  /** The signed-in user's own still-active report, if any. */
  myReport: EnrichedReport | null;
  /** Live (non-expired) report count right now. */
  activeCount: number;
  /** Most-severe active alert level, if any. */
  alertLevel: AlertLevel | null;
  /** window.location.href — passed in to keep this pure. */
  url: string;
}

export interface ShareText {
  title: string;
  /** Message body WITHOUT the URL — for share intents that take the link as a separate field (X, Telegram). */
  body: string;
  /** Full message: body + the URL on its own line — for clipboard, native share, WhatsApp, email. */
  text: string;
}

/** "3 active flood reports nearby" / "1 active flood report nearby" / "" when none. */
function activityClause(activeCount: number, exclSelf: boolean): string {
  const n = exclSelf ? Math.max(0, activeCount - 1) : activeCount;
  if (n <= 0) return '';
  return ` ${n} active flood report${n === 1 ? '' : 's'} nearby.`;
}

export function buildShareText({ myReport, activeCount, alertLevel, url }: ShareInputs): ShareText {
  if (myReport) {
    // Snapshot of the reporter's own situation.
    const where = myReport.district ? `${myReport.name} (${myReport.district})` : myReport.name;
    const trend = myReport.trend === 'rising' || myReport.trend === 'receding'
      ? `, ${TREND_META[myReport.trend].label.toLowerCase()}`
      : '';
    const body =
      `⚠️ I just reported ${myReport.sev.label.toUpperCase()} flooding on ${where} — ` +
      `~${myReport.depthCm} cm${trend}.${activityClause(activeCount, true)}\n\n` +
      `Track live flood conditions on ${PITCH}`;
    return { title: `Flood update — ${APP_NAME}`, body, text: `${body}\n${url}${FB_FOLLOW}` };
  }

  // Visitor / no active report: an enticing pitch sweetened with live stats.
  let stats = '';
  if (activeCount > 0) {
    stats =
      ` ${activeCount} active report${activeCount === 1 ? '' : 's'} right now` +
      (alertLevel ? ` and ${ALERT_NOTE[alertLevel]}` : '') +
      ' 👀';
  } else if (alertLevel) {
    stats = ` Right now ${ALERT_NOTE[alertLevel]} 👀`;
  }
  const body = `🌊 ${PITCH}${stats}`;
  return { title: `${APP_NAME} — live flood map`, body, text: `${body}\n${url}${FB_FOLLOW}` };
}

/** Share message for a SPECIFIC report (used by the per-report "Share to Facebook" action). Reuses
 *  the reporter-snapshot wording so any report — not just the caller's own — reads naturally. */
export function buildReportShareText(report: FloodReport, activeCount: number, url: string): ShareText {
  const where = report.district ? `${report.name} (${report.district})` : report.name;
  const trend = report.trend === 'rising' || report.trend === 'receding'
    ? `, ${TREND_META[report.trend].label.toLowerCase()}`
    : '';
  const body =
    `⚠️ ${SEV_META[report.severity].label.toUpperCase()} flooding reported on ${where} — ` +
    `~${report.depthCm} cm${trend}.${activityClause(activeCount, true)}\n\n` +
    `Track live flood conditions on ${PITCH}`;
  return { title: `Flood update — ${APP_NAME}`, body, text: `${body}\n${url}${FB_FOLLOW}` };
}

/** A single social-network share target. `href` opens that network's web (or app) composer. */
export interface ShareLink {
  key: 'facebook' | 'x' | 'whatsapp' | 'telegram' | 'email';
  label: string;
  /** Brand color used for the button. */
  color: string;
  href: string;
}

/**
 * Crawler-facing share URL for a specific report: the backend endpoint that returns this report's
 * Open Graph tags (severity/depth/location as the preview description) and whose `og:url` points back
 * to the human deep-link. Facebook/X scrape THIS so their card shows the report's own details —
 * `<origin>/?report=<id>` can't, because the static site only serves the generic site-wide OG to
 * crawlers. `apiBase` is the public API origin (`import.meta.env.VITE_API_URL` in prod).
 */
export function buildReportOgUrl(apiBase: string, reportId: number): string {
  return `${apiBase}/reports/${reportId}/share`;
}

/** Builds the per-network share URLs. Pure — the component renders these as plain links.
 *  `body` (no URL) is used where the network takes the link as its own param; `text` (with URL)
 *  where everything goes in one free-text field.
 *
 *  `ogUrl` (optional) is the URL card-building crawlers should scrape for the link preview; it
 *  defaults to `url`. Pass the per-report `buildReportOgUrl(...)` so Facebook/X preview the report's
 *  own details. The text-based networks (WhatsApp/Telegram/email) keep the clean human `url` — the
 *  report details already ride in their message text. */
export function buildShareLinks(
  { url, body, text, ogUrl }: { url: string; body: string; text: string; ogUrl?: string }
): ShareLink[] {
  const u = encodeURIComponent(url);
  const scrape = encodeURIComponent(ogUrl ?? url); // what FB/X fetch to build the preview card
  const b = encodeURIComponent(body);
  const full = encodeURIComponent(text);
  const subject = encodeURIComponent(`${APP_NAME} — live flood map for the Philippines`);
  return [
    // Facebook & X build their card by scraping the given URL's OG/Twitter tags — point them at the
    // backend share endpoint so the card carries the report's details (its og:url returns humans to
    // the deep-link). Text-based networks keep the clean human URL; the details are in their text.
    { key: 'facebook', label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${scrape}` },
    { key: 'x', label: 'X', color: '#000000', href: `https://twitter.com/intent/tweet?text=${b}&url=${scrape}` },
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${full}` },
    { key: 'telegram', label: 'Telegram', color: '#229ED9', href: `https://t.me/share/url?url=${u}&text=${b}` },
    { key: 'email', label: 'Email', color: '#64748B', href: `mailto:?subject=${subject}&body=${full}` },
  ];
}

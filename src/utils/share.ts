// Builds the contextual Share message. Pure: the caller passes the page URL and live data,
// so this stays side-effect-free (no window/navigator access) per the utils/ convention.

import type { AlertLevel, FloodReport } from '../types';
import type { EnrichedReport } from './viewModel';
import { SEV_META, TREND_META } from './floodMeta';

const APP_NAME = 'FloodedArea';

/** The application's official Facebook page — surfaced in the Share dialog and appended to the
 *  copyable share message so it travels with every share. */
export const FB_PAGE_URL = 'https://www.facebook.com/share/1DLEBjCZDi/';

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

/** Builds the per-network share URLs. Pure — the component renders these as plain links.
 *  `body` (no URL) is used where the network takes the link as its own param; `text` (with URL)
 *  where everything goes in one free-text field. */
export function buildShareLinks({ url, body, text }: { url: string; body: string; text: string }): ShareLink[] {
  const u = encodeURIComponent(url);
  const b = encodeURIComponent(body);
  const full = encodeURIComponent(text);
  const subject = encodeURIComponent(`${APP_NAME} — live flood map for the Philippines`);
  return [
    // Facebook's sharer only accepts the URL; it builds its own preview from the page's OG tags.
    { key: 'facebook', label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'x', label: 'X', color: '#000000', href: `https://twitter.com/intent/tweet?text=${b}&url=${u}` },
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${full}` },
    { key: 'telegram', label: 'Telegram', color: '#229ED9', href: `https://t.me/share/url?url=${u}&text=${b}` },
    { key: 'email', label: 'Email', color: '#64748B', href: `mailto:?subject=${subject}&body=${full}` },
  ];
}

// Builds the contextual Share message. Pure: the caller passes the page URL and live data,
// so this stays side-effect-free (no window/navigator access) per the utils/ convention.

import type { AlertLevel, FloodReport, Severity, Trend } from '../types';
import type { EnrichedReport } from './viewModel';
import { localityParts } from './viewModel';
import { ROAD_META, SEV_META, SEV_RANK, TREND_META } from './floodMeta';

const APP_NAME = 'FloodedArea';

/** X (Twitter) counts every URL as this many characters regardless of its real length, budgeted
 *  against the 280-char tweet limit. Single copy — shared by the admin incident caption preview
 *  (AdminReportIncidentModal) and the flood digest below. */
export const X_URL_COST = 23;
export const X_LIMIT = 280;

/** The application's official Facebook page — surfaced in the Share dialog and appended to the
 *  copyable share message so it travels with every share. */
export const FB_PAGE_URL = 'https://www.facebook.com/share/1DLEBjCZDi/';

/** The canonical public origin (matches index.html's `og:url`). Used where a link is baked into
 *  text the user will paste somewhere public — `window.location.origin` is right for in-app share
 *  intents but would hand out `http://localhost:5176` when composing from a dev build. */
export const SITE_URL = 'https://floodedarea.com';

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

/** Tail for the per-report share message. Shorter than PITCH (X's 280-char budget), invites the
 *  reader to report and not just watch, and ends on a colon so the URL that follows reads as the
 *  address. Names the domain so a reader who never clicks still knows where to go. */
const REPORT_PITCH =
  'Track or report live flood conditions on FloodedArea.com — live crowd-sourced flood map:';

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

/** Share message for a SPECIFIC report (used by the detail card's "Share Report" action). Mirrors the
 *  reporter-snapshot wording so any report — not just the caller's own — reads naturally, but closes
 *  with REPORT_PITCH rather than PITCH. */
export function buildReportShareText(report: FloodReport, activeCount: number, url: string): ShareText {
  const where = report.district ? `${report.name} (${report.district})` : report.name;
  const trend = report.trend === 'rising' || report.trend === 'receding'
    ? `, ${TREND_META[report.trend].label.toLowerCase()}`
    : '';
  const body =
    `⚠️ ${SEV_META[report.severity].label.toUpperCase()} flooding reported on ${where} — ` +
    `~${report.depthCm} cm${trend}.${activityClause(activeCount, true)}\n\n` +
    REPORT_PITCH;
  return { title: `Flood update — ${APP_NAME}`, body, text: `${body}\n${url}${FB_FOLLOW}` };
}

/** Pre-create form values the admin "Report incident" modal has on hand — no report id yet, so the
 *  caller sends this caption body and the backend appends the deep link once the report is saved. */
export interface IncidentCaptionInputs {
  name: string;
  district: string;
  severity: Severity;
  depthCm: number;
  trend: Trend;
}

/** Caption body (no URL) for the admin auto-post preview, wording matched to `buildReportShareText`
 *  so a citizen sees the same voice whether the report was shared by hand or auto-posted. */
export function buildIncidentCaption({ name, district, severity, depthCm, trend }: IncidentCaptionInputs): string {
  const where = district ? `${name} (${district})` : name;
  const trendTxt = trend === 'rising' || trend === 'receding' ? `, ${TREND_META[trend].label.toLowerCase()}` : '';
  return `⚠️ ${SEV_META[severity].label.toUpperCase()} flooding reported on ${where} — ~${depthCm} cm${trendTxt}.\n\n${REPORT_PITCH}`;
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

// ── Admin "Flood Digest" — one consolidated post covering every active report ──────────────────

/** Caps so a big flood event doesn't produce a wall of text: the long-form body shows at most this
 *  many cities, and at most this many reports per city (worst-first within each), with "…and N
 *  more" lines standing in for anything past the cap. The X tally is uncapped by these — it has
 *  its own char-budget trim below. */
const DIGEST_MAX_CITIES = 6;
const DIGEST_MAX_REPORTS_PER_CITY = 4;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "10 Aug 2026" — day-month-year, independent of locale/ICU data so the digest header renders the
 *  same in every browser (unlike toLocaleDateString, whose day/month order varies by locale). */
function digestDateLabel(now: Date): string {
  return `${now.getDate()} ${MONTH_SHORT[now.getMonth()]} ${now.getFullYear()}`;
}

function digestTimeLabel(d: Date): string {
  return d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

/** One report's line in the long-form digest: "Commonwealth Ave — HIGH, ~65cm, rising, impassable
 *  (2:10 PM)". Trend/road clauses only appear when they say something ("steady"/"passable" are the
 *  unremarkable defaults) — same convention as buildReportShareText. */
function digestReportLine(r: EnrichedReport): string {
  const trendTxt = r.trend === 'rising' || r.trend === 'receding' ? `, ${TREND_META[r.trend].label.toLowerCase()}` : '';
  const roadTxt = r.road === 'impassable' || r.road === 'risky' ? `, ${ROAD_META[r.road].label.toLowerCase()}` : '';
  const time = digestTimeLabel(new Date(r.reportedAt ?? r.createdAt));
  return `${r.name} — ${SEV_META[r.severity].label.toUpperCase()}, ~${r.depthCm}cm${trendTxt}${roadTxt} (${time})`;
}

interface DigestCityGroup {
  city: string;
  reports: EnrichedReport[]; // sorted worst-first: SEV_RANK desc, then depthCm desc
}

/** Groups reports by locality and sorts both the cities (worst SEV_RANK first, then report count,
 *  then name) and each city's reports (worst SEV_RANK first, then depthCm) — the ordering rule the
 *  long-form body and the X tally both build on. */
function groupByCity(reports: EnrichedReport[]): DigestCityGroup[] {
  const byCity = new Map<string, EnrichedReport[]>();
  for (const r of reports) {
    const { city } = localityParts(r.district);
    const bucket = byCity.get(city);
    if (bucket) bucket.push(r);
    else byCity.set(city, [r]);
  }
  const groups: DigestCityGroup[] = Array.from(byCity, ([city, reps]) => ({
    city,
    reports: [...reps].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.depthCm - a.depthCm),
  }));
  groups.sort((a, b) => {
    const worstA = Math.max(...a.reports.map((r) => SEV_RANK[r.severity]));
    const worstB = Math.max(...b.reports.map((r) => SEV_RANK[r.severity]));
    return worstB - worstA || b.reports.length - a.reports.length || a.city.localeCompare(b.city);
  });
  return groups;
}

export interface FloodDigest {
  /** Full multi-line digest — Facebook composer / clipboard. */
  text: string;
  /** Condensed variant sized for X (no URL — the caller passes it as intent's `url` param). */
  xBody: string;
  /** The same variant WITH the link inline — for pasting into X's composer by hand, which is the
   *  only way to attach an image (intent/tweet can't carry one). Costs exactly `xCharCount`: X
   *  bills any URL at X_URL_COST regardless of its real length, which is the budget `xBody` was
   *  already trimmed against — so this is guaranteed <= X_LIMIT too. */
  xCopyText: string;
  /** What xBody will actually cost on X: xBody.length + 1 (newline) + X_URL_COST. Always <= X_LIMIT. */
  xCharCount: number;
  reportCount: number;
  cityCount: number;
}

/** X's per-city tally + single worst-report line, trimmed to X_LIMIT. Degrades gracefully: drops
 *  trailing cities from the tally first, then drops the "Worst:" line, then hard-truncates — so the
 *  string actually sent to the intent never reports over budget. */
function buildDigestXBody(now: Date, reportCount: number, groups: DigestCityGroup[], worst: EnrichedReport): { xBody: string; xCharCount: number } {
  const time = digestTimeLabel(now);
  const header = `🌊 FLOOD WATCH ${time} — ${reportCount} active report${reportCount === 1 ? '' : 's'}: `;
  const worstLine = `Worst: ${worst.name}, ${localityParts(worst.district).city} — ${SEV_META[worst.severity].label.toUpperCase()} ~${worst.depthCm}cm${
    worst.trend === 'rising' || worst.trend === 'receding' ? `, ${TREND_META[worst.trend].label.toLowerCase()}` : ''
  }.`;
  const cost = (s: string): number => s.length + 1 + X_URL_COST; // +1 for the newline the intent inserts before its url param
  const compose = (tally: string[], includeWorst: boolean): string => {
    const line1 = `${header}${tally.join(', ')}.`;
    return includeWorst ? `${line1}\n${worstLine}` : line1;
  };

  let tally = groups.map((g) => `${g.city} (${g.reports.length})`);
  let body = compose(tally, true);
  while (cost(body) > X_LIMIT && tally.length > 1) {
    tally = tally.slice(0, -1);
    body = compose(tally, true);
  }
  if (cost(body) > X_LIMIT) body = compose(tally, false); // drop the Worst: line
  if (cost(body) > X_LIMIT) {
    // Still over — hard-truncate to whatever fits the budget exactly.
    const maxLen = Math.max(0, X_LIMIT - 1 - X_URL_COST);
    body = `${body.slice(0, Math.max(0, maxLen - 1))}…`;
  }
  return { xBody: body, xCharCount: cost(body) };
}

/**
 * Builds the admin "Flood Digest" — one consolidated post covering every currently-active flood
 * report, grouped by city and ordered worst-first. Pure: caller passes `now` and `url` per the
 * utils/ convention (no Date.now()/window access in here).
 *
 * `reports` should be the caller's already-filtered active list (`!expired`) — this function does
 * not filter by status/TTL itself, it only composes text from what it's given.
 */
export function buildFloodDigest(reports: EnrichedReport[], now: Date, url: string): FloodDigest {
  const reportCount = reports.length;
  const dateLabel = digestDateLabel(now);
  const timeLabel = digestTimeLabel(now);
  const header = `🌊 FLOOD WATCH — ${dateLabel}, ${timeLabel}`;

  if (reportCount === 0) {
    const body = `${header}\n\nNo active flood reports right now.`;
    const xBody = `🌊 FLOOD WATCH ${timeLabel} — No active flood reports right now.`;
    return {
      text: `${body}\n${url}${FB_FOLLOW}`,
      xBody,
      xCopyText: `${xBody}\n${SITE_URL}`,
      xCharCount: xBody.length + 1 + X_URL_COST,
      reportCount: 0,
      cityCount: 0,
    };
  }

  const groups = groupByCity(reports);
  const cityCount = groups.length;
  const shownCities = groups.slice(0, DIGEST_MAX_CITIES);
  const extraCities = groups.length - shownCities.length;

  const lines: string[] = [header, ''];
  for (const g of shownCities) {
    lines.push(g.city.toUpperCase());
    const shownReports = g.reports.slice(0, DIGEST_MAX_REPORTS_PER_CITY);
    for (const r of shownReports) lines.push(`• ${digestReportLine(r)}`);
    const moreInCity = g.reports.length - shownReports.length;
    if (moreInCity > 0) lines.push(`…and ${moreInCity} more in this area`);
    lines.push('');
  }
  if (extraCities > 0) {
    lines.push(`…and ${extraCities} more ${extraCities === 1 ? 'city' : 'cities'}`);
    lines.push('');
  }
  lines.push(`${reportCount} active flood report${reportCount === 1 ? '' : 's'} right now.`);

  // "Worst" is the single most severe report overall (SEV_RANK, then depth) — independent of the
  // city sort's count-based tiebreak, so a deeper HIGH report in a quieter city still wins here.
  const worst = [...reports].sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.depthCm - a.depthCm)[0];
  const { xBody, xCharCount } = buildDigestXBody(now, reportCount, groups, worst);

  return {
    text: `${lines.join('\n')}\n${url}${FB_FOLLOW}`,
    xBody,
    xCopyText: `${xBody}\n${SITE_URL}`,
    xCharCount,
    reportCount,
    cityCount,
  };
}

// Builds the contextual Share message. Pure: the caller passes the page URL and live data,
// so this stays side-effect-free (no window/navigator access) per the utils/ convention.

import type { AlertLevel } from '../types';
import type { EnrichedReport } from './viewModel';
import { TREND_META } from './floodMeta';

const APP_NAME = 'FloodedArea';

/** One-line pitch tail reused by both message variants. */
const PITCH =
  `${APP_NAME} — live crowd-sourced flood map for Metro Manila & Rizal: real-time reports, ` +
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
    const text =
      `⚠️ I just reported ${myReport.sev.label.toUpperCase()} flooding on ${where} — ` +
      `~${myReport.depthCm} cm${trend}.${activityClause(activeCount, true)}\n\n` +
      `Track live flood conditions on ${PITCH}\n${url}`;
    return { title: `Flood update — ${APP_NAME}`, text };
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
  const text = `🌊 ${PITCH}${stats}\n${url}`;
  return { title: `${APP_NAME} — live flood map`, text };
}

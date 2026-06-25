// Lightweight app-wide internationalization. English is the default; Filipino (Tagalog) is the
// alternative. The user picks a language once at sign-in (LoginView) and it's remembered in
// localStorage. Implemented as a tiny module-level store + a useSyncExternalStore hook rather than
// React Context/Redux (per the project's "no global store" convention) so any component can call
// useI18n() for translations without threading props through the tree.

import { useSyncExternalStore } from 'react';
import type { Road, Severity, Trend } from './types';

export type Lang = 'en' | 'fil';

const STORAGE_KEY = 'baha_lang_v1';

function loadLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'fil' ? 'fil' : 'en';
  } catch {
    return 'en';
  }
}

let currentLang: Lang = loadLang();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return currentLang;
}

/** Whether the user has explicitly chosen a language before (so we only prompt once). */
export function hasChosenLang(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage blocked — language still applies for this session */
  }
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** All translatable component labels. Add a key here, then reference it via t('key'). */
const MESSAGES = {
  // ── Common ──
  'common.close': { en: 'Close', fil: 'Isara' },
  'common.cancel': { en: 'Cancel', fil: 'Kanselahin' },
  'common.prev': { en: 'Prev', fil: 'Nakaraan' },
  'common.next': { en: 'Next', fil: 'Susunod' },

  // ── Language picker (LoginView) ──
  'lang.label': { en: 'Language', fil: 'Wika' },
  'lang.hint': { en: 'You can change this later by signing in again.', fil: 'Mababago mo ito sa muling pag-sign in.' },
  'lang.en': { en: 'English', fil: 'Ingles' },
  'lang.fil': { en: 'Filipino', fil: 'Filipino' },

  // ── Login view ──
  'login.subtitle': { en: 'Sign in to report & get help', fil: 'Mag-sign in para mag-ulat at humingi ng tulong' },
  'login.intro': { en: 'Sign in with your Google account. A FloodedArea account is created automatically on first use.', fil: 'Mag-sign in gamit ang iyong Google account. Awtomatikong gagawa ng FloodedArea account sa unang paggamit.' },
  'login.verifying': { en: 'Verifying…', fil: 'Bineberipika…' },
  'login.notConfigured': { en: 'Google SSO isn’t configured. Set VITE_GOOGLE_CLIENT_ID to enable sign-in.', fil: 'Hindi naka-configure ang Google SSO. Itakda ang VITE_GOOGLE_CLIENT_ID para paganahin ang sign-in.' },

  // ── TopBar ──
  'topbar.region': { en: 'Philippines', fil: 'Pilipinas' },
  'topbar.share': { en: 'Share', fil: 'Ibahagi' },
  'topbar.report': { en: 'Report flood', fil: 'Mag-ulat ng baha' },
  'topbar.signIn': { en: 'Sign in', fil: 'Mag-sign in' },
  'topbar.signOut': { en: 'Sign out', fil: 'Mag-sign out' },
  'topbar.more': { en: 'More', fil: 'Higit pa' },
  'topbar.dashboard': { en: 'Flood dashboard', fil: 'Dashboard ng baha' },
  'topbar.waterLevels': { en: 'Water levels', fil: 'Lalim ng tubig' },
  'topbar.rescue': { en: 'Rescue requests', fil: 'Mga hiling ng rescue' },
  'topbar.support': { en: 'About & support', fil: 'Tungkol at suporta' },
  'topbar.features': { en: 'What’s in this app', fil: 'Mga features ng app' },
  'topbar.admin': { en: 'Admin', fil: 'Admin' },
  'topbar.adminConsole': { en: 'Admin console', fil: 'Admin console' },
  'topbar.response': { en: 'Response', fil: 'Tugon' },
  'topbar.responseConsole': { en: 'Response console', fil: 'Response console' },

  // ── Sidebar ──
  'sidebar.safetyStatus': { en: 'YOUR SAFETY STATUS', fil: 'IYONG KALAGAYAN SA KALIGTASAN' },
  'sidebar.updatedLive': { en: 'Updated live', fil: 'Live na update' },
  'sidebar.filters': { en: 'FILTERS', fil: 'MGA FILTER' },
  'sidebar.roads': { en: 'ROADS', fil: 'MGA KALSADA' },
  'sidebar.affectedArea': { en: 'AFFECTED AREA', fil: 'APEKTADONG LUGAR' },
  'sidebar.monitoringArea': { en: 'MONITORING AREA', fil: 'BINABANTAYANG LUGAR' },
  'sidebar.now': { en: 'Now', fil: 'Ngayon' },
  'sidebar.shelters': { en: 'Shelters', fil: 'Mga silungan' },
  'sidebar.floodedRoads': { en: 'Flooded roads', fil: 'Binahang kalsada' },
  'sidebar.searchRoads': { en: 'Search roads by condition', fil: 'Maghanap ng kalsada ayon sa kondisyon' },
  'sidebar.nearby': { en: 'Nearby', fil: 'Malapit' },
  'sidebar.liveActivity': { en: 'Live activity', fil: 'Live na aktibidad' },
  'sidebar.high': { en: 'high', fil: 'mataas' },
  'sidebar.activeReports': { en: 'active reports nearby', fil: 'aktibong ulat sa paligid' },
  'sidebar.roadImpassable': { en: 'impassable', fil: 'hindi madaanan' },
  'sidebar.road': { en: 'road', fil: 'kalsada' },
  'sidebar.roadsPlural': { en: 'roads', fil: 'mga kalsada' },
  'sidebar.floodAlerts': { en: 'Flood alerts', fil: 'Mga babala sa baha' },
  'sidebar.alertsOn': { en: 'On · new floods within', fil: 'Naka-on · bagong baha sa loob ng' },
  'sidebar.alertsOff': { en: 'Off · get notified about new floods nearby', fil: 'Naka-off · ipaalam ang bagong baha sa paligid' },
  'sidebar.edit': { en: 'Edit', fil: 'I-edit' },
  'sidebar.setUp': { en: 'Set up', fil: 'I-set up' },
  'sidebar.totalVisits': { en: 'total visits', fil: 'kabuuang bisita' },
  'sidebar.noReports': { en: 'No reports match the active filters.', fil: 'Walang ulat na tumutugma sa mga filter.' },

  // ── Report list item ──
  'report.yours': { en: 'YOURS', fil: 'IYO' },
  'report.kmAway': { en: 'km away', fil: 'km ang layo' },
  'report.confirmed': { en: 'confirmed', fil: 'nakumpirma' },
  'report.left': { en: 'left', fil: 'natitira' },

  // ── Severity ──
  'sev.high': { en: 'High', fil: 'Mataas' },
  'sev.medium': { en: 'Medium', fil: 'Katamtaman' },
  'sev.low': { en: 'Low', fil: 'Mababa' },

  // ── Road condition (full + short) ──
  'road.impassable': { en: 'Impassable', fil: 'Hindi madaanan' },
  'road.impassable.short': { en: 'Impassable', fil: 'Di madaanan' },
  'road.risky': { en: 'Risky for cars', fil: 'Delikado sa sasakyan' },
  'road.risky.short': { en: 'Risky', fil: 'Delikado' },
  'road.passable': { en: 'Passable', fil: 'Madaanan' },
  'road.passable.short': { en: 'Passable', fil: 'Madaanan' },

  // ── Trend ──
  'trend.rising': { en: 'Rising', fil: 'Tumataas' },
  'trend.receding': { en: 'Receding', fil: 'Humuhupa' },
  'trend.steady': { en: 'Steady', fil: 'Tatag' },

  // ── Flood dashboard ──
  'dash.title': { en: 'Flood dashboard', fil: 'Dashboard ng baha' },
  'dash.subtitle': { en: 'Live road closures & reports · Metro Manila & Rizal', fil: 'Live na saradong kalsada at ulat · Metro Manila at Rizal' },
  'dash.closuresNear': { en: 'Road closures near a location', fil: 'Mga saradong kalsada malapit sa lugar' },
  'dash.searchPlaceholder': { en: 'Search a barangay, street or landmark…', fil: 'Maghanap ng barangay, kalye o landmark…' },
  'dash.searching': { en: 'Searching…', fil: 'Naghahanap…' },
  'dash.impactRadius': { en: 'Impact radius', fil: 'Sakop na radius' },
  'dash.searchPrompt': { en: 'Search a location to see possible road closures within its impact radius.', fil: 'Maghanap ng lugar para makita ang mga posibleng saradong kalsada sa loob ng sakop nito.' },
  'dash.noClosures': { en: 'No road closures reported within', fil: 'Walang naiulat na saradong kalsada sa loob ng' },
  'dash.ofThisLocation': { en: 'of this location.', fil: 'ng lugar na ito.' },
  'dash.possible': { en: 'possible', fil: 'posibleng' },
  'dash.closure': { en: 'closure', fil: 'saradong kalsada' },
  'dash.closures': { en: 'closures', fil: 'saradong kalsada' },
  'dash.within': { en: 'within', fil: 'sa loob ng' },
  'dash.away': { en: 'away', fil: 'ang layo' },
  'dash.est': { en: 'est.', fil: 'tantya' },
  'dash.report': { en: 'report', fil: 'ulat' },
  'dash.reports': { en: 'reports', fil: 'ulat' },
  'dash.inferred': { en: 'inferred', fil: 'tinantya' },
  'dash.reports12h': { en: 'Reports in the last 12 hours', fil: 'Mga ulat sa nakaraang 12 oras' },
  'dash.orderedByDepth': { en: 'Ordered by deepest water', fil: 'Ayon sa pinakamalalim na tubig' },
  'dash.noRecent': { en: 'No flood reports in the last 12 hours.', fil: 'Walang ulat ng baha sa nakaraang 12 oras.' },
  'dash.colCity': { en: 'City / Area', fil: 'Lungsod / Lugar' },
  'dash.colDistrict': { en: 'District', fil: 'Distrito' },
  'dash.colReport': { en: 'Report', fil: 'Ulat' },
  'dash.colWaterLevel': { en: 'Water level', fil: 'Lalim ng tubig' },
  'dash.colReported': { en: 'Reported', fil: 'Naiulat' },
  'dash.rows': { en: 'Rows', fil: 'Hanay' },
  'dash.showing': { en: 'Showing', fil: 'Ipinapakita' },
  'dash.of': { en: 'of', fil: 'ng' },
  'dash.page': { en: 'Page', fil: 'Pahina' },
} as const;

export type MsgKey = keyof typeof MESSAGES;

export function translate(lang: Lang, key: MsgKey): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return lang === 'fil' ? entry.fil : entry.en;
}

// Typed helpers for the domain enums — translate a severity/road/trend value to its label in one
// call. The template-literal keys are statically known to exist in MESSAGES.
export function sevLabel(lang: Lang, sev: Severity): string {
  return translate(lang, `sev.${sev}`);
}
export function roadLabel(lang: Lang, road: Road): string {
  return translate(lang, `road.${road}`);
}
export function roadShort(lang: Lang, road: Road): string {
  return translate(lang, `road.${road}.short`);
}
export function trendLabel(lang: Lang, trend: Trend): string {
  return translate(lang, `trend.${trend}`);
}

/** React hook: current language + a memo-free translator + the setter. Re-renders on language change. */
export function useI18n(): { lang: Lang; t: (key: MsgKey) => string; setLang: (l: Lang) => void } {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t: (key: MsgKey) => translate(lang, key), setLang };
}

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
  'topbar.share': { en: 'Share', fil: 'Share' },
  'topbar.report': { en: 'Report flood', fil: 'Mag-ulat ng baha' },
  'topbar.signIn': { en: 'Sign in', fil: 'Mag-sign in' },
  'topbar.signOut': { en: 'Sign out', fil: 'Mag-sign out' },
  'topbar.more': { en: 'More', fil: 'Higit pa' },
  'topbar.dashboard': { en: 'Flood dashboard', fil: 'Dashboard ng baha' },
  'topbar.waterLevels': { en: 'Water levels', fil: 'Lalim ng tubig' },
  'topbar.rescue': { en: 'Rescue requests', fil: 'Mga hiling ng rescue' },
  'topbar.support': { en: 'About & support', fil: 'Tungkol at suporta' },
  'topbar.features': { en: 'What’s in this app', fil: 'Mga features ng app' },
  'topbar.feedback': { en: 'Community feedback', fil: 'Feedback ng komunidad' },
  'topbar.admin': { en: 'Admin', fil: 'Admin' },
  'topbar.adminConsole': { en: 'Admin console', fil: 'Admin console' },
  'topbar.response': { en: 'Response', fil: 'Tugon' },
  'topbar.responseConsole': { en: 'Response console', fil: 'Response console' },
  'topbar.floodDigest': { en: 'Flood digest', fil: 'Buod ng baha' },
  'topbar.nearbyAlerts': { en: 'Nearby flood alerts', fil: 'Mga babala sa malapit na baha' },

  // ── Sidebar ──
  'sidebar.updatedLive': { en: 'Updated live', fil: 'Live na update' },
  'sidebar.affectedArea': { en: 'AFFECTED AREA', fil: 'APEKTADONG LUGAR' },
  'sidebar.monitoringArea': { en: 'MONITORING AREA', fil: 'BINABANTAYANG LUGAR' },

  // ── Sidebar control strip (accordion chips above the report tabs) ──
  'sidebar.panelTrip': { en: 'Trip', fil: 'Biyahe' },
  'sidebar.panelFilters': { en: 'Filters', fil: 'Filter' },
  'sidebar.panelArea': { en: 'My area', fil: 'Lugar ko' },
  'sidebar.showOnMap': { en: 'SHOW ON MAP', fil: 'IPAKITA SA MAPA' },
  'sidebar.roadCondition': { en: 'ROAD CONDITION', fil: 'KONDISYON NG KALSADA' },
  'sidebar.now': { en: 'Now', fil: 'Ngayon' },
  'sidebar.shelters': { en: 'Shelters', fil: 'Mga silungan' },
  'sidebar.floodedRoads': { en: 'Flooded roads', fil: 'Binahang kalsada' },
  'sidebar.searchRoads': { en: 'Search roads by condition', fil: 'Maghanap ng kalsada ayon sa kondisyon' },
  'sidebar.nearby': { en: 'Nearby', fil: 'Malapit' },
  'sidebar.liveActivity': { en: 'Live activity', fil: 'Live na aktibidad' },
  'sidebar.archive': { en: 'Archive', fil: 'Archive' },
  'sidebar.high': { en: 'high', fil: 'mataas' },
  // Kept short so the summary row stays on one line in the 386px sidebar.
  'sidebar.activeShort': { en: 'active', fil: 'aktibo' },
  'sidebar.roadImpassable': { en: 'impassable', fil: 'di-madaanan' },
  'sidebar.floodAlerts': { en: 'Nearby flood alerts', fil: 'Mga babala sa malapit na baha' },
  'sidebar.alertsOn': { en: 'On · new floods near you within', fil: 'Naka-on · bagong baha malapit sa iyo sa loob ng' },
  'sidebar.alertsOff': { en: 'Off · get notified about new floods near you', fil: 'Naka-off · ipaalam ang bagong baha malapit sa iyo' },
  'sidebar.edit': { en: 'Edit', fil: 'I-edit' },
  'sidebar.setUp': { en: 'Set up', fil: 'I-set up' },
  'sidebar.totalVisits': { en: 'total visits', fil: 'kabuuang bisita' },
  'sidebar.noReports': { en: 'No reports match the active filters.', fil: 'Walang ulat na tumutugma sa mga filter.' },
  'sidebar.noArchive': { en: 'No past reports yet.', fil: 'Wala pang mga nakaraang ulat.' },

  // ── Sidebar descriptions / affected-area readout ──
  'sidebar.affectedDesc': { en: 'Each report’s ring grows with its water depth. Drag to project how much higher the water rises — the dashed rings show how far flooding could spread.', fil: 'Lumalaki ang bilog ng bawat ulat ayon sa lalim ng tubig. I-drag para tantyahin kung gaano pa tataas ang tubig — ipinapakita ng mga putol-putol na bilog kung gaano kalayo maaaring kumalat ang baha.' },
  'sidebar.monitorDesc': { en: 'The dashed blue circle on the map around you. Drag to set how far out to keep watch for flooding.', fil: 'Ang putol-putol na asul na bilog sa mapa sa paligid mo. I-drag para itakda kung gaano kalayo babantayan ang baha.' },
  'sidebar.affectedAt': { en: 'At', fil: 'Sa' },
  'sidebar.affectedSpread': { en: 'a typical flooded zone spreads', fil: 'kumakalat ang karaniwang binahang lugar nang' },
  'sidebar.affectedWider': { en: 'wider', fil: 'na mas malawak' },
  'sidebar.theArea': { en: 'the area', fil: 'ng lugar' },

  // ── Safety status banner ──
  'status.inFloodZone': { en: 'IN FLOOD ZONE', fil: 'NASA LUGAR NG BAHA' },
  'status.inFloodZoneTitle': { en: 'You are in a flood-affected area', fil: 'Nasa apektadong lugar ka ng baha' },
  'status.inFloodZoneLine': { en: '{sev} flooding at {name} — about {depth} cm.', fil: '{sev} na baha sa {name} — humigit-kumulang {depth} cm.' },
  'status.inFloodZoneSub': { en: 'Move to higher ground and never wade through fast-moving water.', fil: 'Lumipat sa mas mataas na lugar at huwag kailanman tatawid sa mabilis na agos ng tubig.' },
  'status.stayAlert': { en: 'STAY ALERT', fil: 'MAG-INGAT' },
  'status.stayAlertTitle': { en: 'Flooding is close by', fil: 'Malapit na ang baha' },
  'status.stayAlertLine': { en: 'Nearest flooding is ~{km} km away at {name} ({sev}{rising}).', fil: 'Ang pinakamalapit na baha ay ~{km} km ang layo sa {name} ({sev}{rising}).' },
  'status.stayAlertSub': { en: 'Plan an alternate route and keep checking before you travel.', fil: 'Magplano ng ibang ruta at patuloy na magsuri bago maglakbay.' },
  'status.rising': { en: ', rising', fil: ', tumataas' },
  'status.clear': { en: 'CLEAR', fil: 'LIGTAS' },
  'status.clearTitle': { en: 'No flooding near you', fil: 'Walang baha malapit sa iyo' },
  'status.clearLine': { en: 'There are no reports within 2.5 km of your location.', fil: 'Walang ulat sa loob ng 2.5 km mula sa iyong lokasyon.' },
  'status.clearSub': { en: 'Conditions change fast in heavy rain — keep this open to stay updated.', fil: 'Mabilis magbago ang kalagayan sa malakas na ulan — panatilihing bukas ito para sa mga update.' },
  'status.etaAtArea': { en: 'Water from {name} is at your area and still rising.', fil: 'Ang tubig mula sa {name} ay nasa lugar mo na at patuloy pang tumataas.' },
  'status.etaReach': { en: 'At the current rate, flooding from {name} could reach you in ~{lo}–{hi} hr (rough estimate).', fil: 'Sa kasalukuyang bilis, maaaring umabot sa iyo ang baha mula sa {name} sa loob ng ~{lo}–{hi} oras (tantya lamang).' },

  // ── Notify modal ──
  'notify.subtitle': { en: 'Get notified when a new flood is reported near you', fil: 'Mapaalalahanan kapag may bagong baha na naiulat malapit sa iyo' },
  'notify.master': { en: 'Notify me about new reports near me', fil: 'Abisuhan ako tungkol sa mga bagong ulat malapit sa akin' },
  'notify.criteria': { en: 'From other people, matching the criteria below', fil: 'Mula sa ibang tao, na tumutugma sa pamantayan sa ibaba' },
  'notify.withinDistance': { en: 'WITHIN DISTANCE', fil: 'SA LOOB NG LAYO' },
  'notify.forLevels': { en: 'FOR THESE LEVELS', fil: 'PARA SA MGA ANTAS NA ITO' },
  'notify.permGranted': { en: 'Browser notifications are on — you’ll be alerted even when this tab is in the background.', fil: 'Naka-on ang mga abiso ng browser — aabisuhan ka kahit nasa background ang tab na ito.' },
  'notify.permDenied': { en: 'Browser notifications are blocked in your browser settings. You’ll still see in-app alerts while FloodedArea is open.', fil: 'Naka-block ang mga abiso ng browser sa iyong settings. Makikita mo pa rin ang mga in-app na abiso habang bukas ang FloodedArea.' },
  'notify.permUnsupported': { en: 'This browser can’t show system notifications. You’ll still see in-app alerts while FloodedArea is open.', fil: 'Hindi maipapakita ng browser na ito ang mga system notification. Makikita mo pa rin ang mga in-app na abiso habang bukas ang FloodedArea.' },
  'notify.permDefault': { en: 'Turn the toggle on to allow notifications and get alerts even when this tab is in the background.', fil: 'I-on ang toggle para payagan ang mga abiso at makatanggap kahit nasa background ang tab na ito.' },
  'notify.alertTitleOne': { en: 'New flood reported nearby', fil: 'May bagong baha na naiulat malapit sa iyo' },
  'notify.alertTitleMany': { en: '{n} new flood reports near you', fil: '{n} bagong ulat ng baha malapit sa iyo' },

  // ── Alert modal source chip — distinguishes which of the three alert systems fired ──
  'alert.sourceNearby': { en: 'Nearby', fil: 'Malapit' },
  'alert.sourceTrip': { en: 'Trip', fil: 'Biyahe' },
  'alert.sourceWeather': { en: 'Weather', fil: 'Panahon' },
  'alert.sourceZone': { en: 'Zone', fil: 'Zone' },

  // ── Share modal ──
  'share.title': { en: 'Help your neighbors stay safe', fil: 'Tulungan ang iyong mga kapitbahay na manatiling ligtas' },
  'share.subtitle': { en: 'Share FloodedArea · Philippines', fil: 'Share FloodedArea · Pilipinas' },
  'share.intro': { en: 'FloodedArea works best when the whole neighborhood is watching. Every person you invite adds another set of eyes on the water — and another voice that can warn others in time.', fil: 'Pinakamabisa ang FloodedArea kapag nagbabantay ang buong kapitbahayan. Bawat taong iniimbita mo ay nagdaragdag ng isa pang tagamasid sa tubig — at isa pang boses na makakapagbabala sa iba nang maaga.' },
  'share.clearerMap': { en: 'More people, a clearer map', fil: 'Mas maraming tao, mas malinaw na mapa' },
  'share.liveReportsOne': { en: '{n} live report is already helping people decide where it’s safe right now. ', fil: '{n} live na ulat ang tumutulong na sa mga tao na magpasya kung saan ligtas ngayon. ' },
  'share.liveReportsMany': { en: '{n} live reports are already helping people decide where it’s safe right now. ', fil: '{n} live na ulat ang tumutulong na sa mga tao na magpasya kung saan ligtas ngayon. ' },
  'share.impact': { en: 'More neighbors means more reports, faster — your share could be the heads-up that keeps a family out of dangerous water.', fil: 'Mas maraming kapitbahay, mas maraming ulat nang mabilis — maaaring ang share mo ang babalang magliligtas sa isang pamilya mula sa mapanganib na tubig.' },
  'share.viaApps': { en: 'Share via your apps…', fil: 'I-share sa iyong mga app…' },
  'share.orDirectly': { en: 'Or share directly', fil: 'O direktang i-share' },
  'share.directly': { en: 'Share directly', fil: 'Direktang i-share' },
  'share.shareOn': { en: 'Share on', fil: 'I-share sa' },
  'share.copyLink': { en: 'Copy link', fil: 'Kopyahin ang link' },
  'share.copyMessage': { en: 'Copy message', fil: 'Kopyahin ang mensahe' },
  'share.linkCopied': { en: 'Link copied to clipboard', fil: 'Nakopya ang link sa clipboard' },
  'share.messageCopied': { en: 'Message copied — paste it anywhere', fil: 'Nakopya ang mensahe — i-paste kahit saan' },
  'share.thanks': { en: 'Salamat for spreading the word — stay safe out there. 💙', fil: 'Salamat sa pagpapakalat — mag-ingat lagi. 💙' },
  'share.followFb': { en: 'Follow us on Facebook', fil: 'I-follow kami sa Facebook' },

  // ── SOS / rescue modal ──
  'sos.title': { en: 'Emergency help', fil: 'Tulong sa emergency' },
  'sos.disclaimerBold': { en: 'Use only when activated.', fil: 'Gamitin lamang kapag aktibo.' },
  'sos.disclaimer': { en: 'Send a rescue request only when your local government (LGU / DRRMO) has announced this feature is active for your area. Otherwise, call a hotline below or 911 — requests sent at other times may not be monitored.', fil: 'Magpadala lamang ng rescue request kapag inanunsyo ng inyong lokal na pamahalaan (LGU / DRRMO) na aktibo ang feature na ito para sa inyong lugar. Kung hindi, tumawag sa hotline sa ibaba o sa 911 — maaaring hindi mabantayan ang mga request na ipinadala sa ibang oras.' },
  'sos.ack': { en: 'My LGU / DRRMO has announced this feature is active for my area.', fil: 'Inanunsyo ng aking LGU / DRRMO na aktibo ang feature na ito para sa aking lugar.' },
  'sos.send': { en: 'Send rescue request with my location', fil: 'Magpadala ng rescue request kasama ang aking lokasyon' },
  'sos.sending': { en: 'Sending your location…', fil: 'Ipinapadala ang iyong lokasyon…' },
  'sos.callHotline': { en: 'CALL A HOTLINE', fil: 'TUMAWAG SA HOTLINE' },
  'sos.danger911': { en: 'If you are in immediate danger, move to the highest safe floor and call 911.', fil: 'Kung nasa agarang panganib ka, pumunta sa pinakamataas na ligtas na palapag at tumawag sa 911.' },

  // ── Location / GPS ──
  'loc.unavailable': { en: 'Location isn’t available on this device.', fil: 'Hindi available ang lokasyon sa device na ito.' },
  'loc.denied': { en: 'Location permission denied — enable it in your browser settings.', fil: 'Tinanggihan ang pahintulot sa lokasyon — paganahin ito sa iyong browser settings.' },
  'loc.failed': { en: 'Couldn’t get your location. Please try again.', fil: 'Hindi makuha ang iyong lokasyon. Pakisubukang muli.' },
  'loc.found': { en: 'Location found (±{m} m).', fil: 'Nahanap ang lokasyon (±{m} m).' },
  'loc.approx': { en: 'Location is approximate (±{m} m) — search your address instead.', fil: 'Tinatantya lang ang lokasyon (±{m} m) — hanapin na lang ang iyong address.' },
  'loc.searchAction': { en: 'Search', fil: 'Hanapin' },
  'loc.enableHelp': { en: 'How to enable', fil: 'Paano i-enable' },

  // ── "How to enable location" help modal ──
  'locHelp.title': { en: 'Turn on location', fil: 'I-on ang lokasyon' },
  'locHelp.intro': { en: 'FloodedArea uses your location to center the map and place your reports accurately. It looks blocked right now — here’s how to allow it.', fil: 'Ginagamit ng FloodedArea ang iyong lokasyon para i-gitna ang mapa at tumpak na mailagay ang iyong mga ulat. Mukhang naka-block ito ngayon — narito kung paano ito payagan.' },
  'locHelp.stepsFor': { en: 'STEPS FOR YOUR BROWSER', fil: 'MGA HAKBANG PARA SA IYONG BROWSER' },
  'locHelp.tryAgain': { en: 'Try again', fil: 'Subukang muli' },
  'locHelp.privacy': { en: 'Your location stays on your device — it’s only sent when you submit a report or an SOS.', fil: 'Nananatili sa iyong device ang lokasyon — ipinapadala lamang ito kapag nagsumite ka ng ulat o SOS.' },

  // Desktop Chrome / Edge / Brave / Opera
  'locHelp.chromium.1': { en: 'Click the lock or tune icon at the left of the address bar.', fil: 'I-click ang lock o tune na icon sa kaliwa ng address bar.' },
  'locHelp.chromium.2': { en: 'Find “Location” and switch it to “Allow”.', fil: 'Hanapin ang “Location” at gawing “Allow”.' },
  'locHelp.chromium.3': { en: 'Reload the page, then tap “Try again”.', fil: 'I-reload ang pahina, pagkatapos ay i-tap ang “Subukang muli”.' },

  // Desktop Firefox
  'locHelp.firefox.1': { en: 'Click the lock icon at the left of the address bar.', fil: 'I-click ang lock na icon sa kaliwa ng address bar.' },
  'locHelp.firefox.2': { en: 'Under Permissions, clear the block on “Access your location”.', fil: 'Sa ilalim ng Permissions, alisin ang block sa “Access your location”.' },
  'locHelp.firefox.3': { en: 'Reload the page and choose “Allow” when asked.', fil: 'I-reload ang pahina at piliin ang “Allow” kapag tinanong.' },

  // Desktop Safari (macOS)
  'locHelp.safari.1': { en: 'Open Safari → Settings → Websites → Location.', fil: 'Buksan ang Safari → Settings → Websites → Location.' },
  'locHelp.safari.2': { en: 'Set this website to “Allow”.', fil: 'Gawing “Allow” ang website na ito.' },
  'locHelp.safari.3': { en: 'Also enable System Settings → Privacy & Security → Location Services → Safari.', fil: 'I-enable din ang System Settings → Privacy & Security → Location Services → Safari.' },

  // iOS (iPhone / iPad)
  'locHelp.ios.1': { en: 'Open the iOS Settings app → Privacy & Security → Location Services and turn it on.', fil: 'Buksan ang iOS Settings app → Privacy & Security → Location Services at i-on ito.' },
  'locHelp.ios.2': { en: 'Scroll to your browser (Safari or Chrome) and set it to “While Using the App”.', fil: 'Mag-scroll sa iyong browser (Safari o Chrome) at gawing “While Using the App”.' },
  'locHelp.ios.3': { en: 'Return here and tap “Try again”.', fil: 'Bumalik dito at i-tap ang “Subukang muli”.' },

  // Android (Chrome)
  'locHelp.android.1': { en: 'Tap the lock icon next to the address bar → Permissions → Location → Allow.', fil: 'I-tap ang lock na icon katabi ng address bar → Permissions → Location → Allow.' },
  'locHelp.android.2': { en: 'Make sure the phone’s Location is on (Settings → Location).', fil: 'Tiyaking naka-on ang Location ng telepono (Settings → Location).' },
  'locHelp.android.3': { en: 'Reload the page and tap “Try again”.', fil: 'I-reload ang pahina at i-tap ang “Subukang muli”.' },

  // Unknown browser — generic guidance
  'locHelp.generic.1': { en: 'Open your browser’s site settings for this page.', fil: 'Buksan ang site settings ng iyong browser para sa pahinang ito.' },
  'locHelp.generic.2': { en: 'Set the Location permission to “Allow”.', fil: 'Gawing “Allow” ang permission para sa Location.' },
  'locHelp.generic.3': { en: 'Reload the page, then tap “Try again”.', fil: 'I-reload ang pahina, pagkatapos ay i-tap ang “Subukang muli”.' },

  // ── Report-mode hint ──
  'report.hintTap': { en: 'Tap the map where it’s flooding', fil: 'I-tap ang mapa kung saan may baha' },
  'report.hintAtYou': { en: 'Reporting at your location — tap the map or search an address to fine-tune', fil: 'Nag-uulat sa iyong lokasyon — i-tap ang mapa o maghanap ng address para iayos' },
  'report.hintAtYouAcc': { en: 'Reporting near your location (±{m} m) — tap the map or search an address to fine-tune', fil: 'Nag-uulat malapit sa iyong lokasyon (±{m} m) — i-tap ang mapa o maghanap ng address para iayos' },
  'report.hintLocating': { en: 'Finding your location…', fil: 'Hinahanap ang iyong lokasyon…' },
  'report.hintNoFix': { en: 'We couldn’t find your location — tap the map or search your address to place your report.', fil: 'Hindi namin mahanap ang iyong lokasyon — i-tap ang mapa o hanapin ang iyong address para mailagay ang ulat.' },
  'report.hintWeak': { en: 'Your location is rough (±{m} m) — tap the map or search to place the pin exactly.', fil: 'Magaspang ang iyong lokasyon (±{m} m) — i-tap ang mapa o maghanap para tumpak na mailagay ang pin.' },
  'report.enableLoc': { en: 'Enable location', fil: 'I-enable ang lokasyon' },
  'report.chooseHow': { en: 'How do you want to report?', fil: 'Paano mo gustong mag-ulat?' },
  'report.optionDetailedSub': { en: 'Pin the spot, add details', fil: 'Markahan ang lugar, magdagdag ng detalye' },
  'report.optionQuick': { en: 'Quick report', fil: 'Mabilisang ulat' },
  'report.optionQuickSub': { en: 'Just say how deep it is', fil: 'Sabihin lang kung gaano kalalim' },
  'report.addDetails': { en: '› Add details', fil: '› Magdagdag ng detalye' },
  'report.hideDetails': { en: '‹ Hide details', fil: '‹ Itago ang detalye' },

  // ── Quick report (in-transit) ──
  'quick.safety': { en: 'Passenger reports only — don’t tap while driving.', fil: 'Para sa pasahero lang — huwag i-tap habang nagmamaneho.' },
  'quick.locating': { en: 'Locating…', fil: 'Hinahanap ang lokasyon…' },
  'quick.howBad': { en: 'How bad is the flooding here?', fil: 'Gaano kalala ang baha dito?' },
  'quick.done': { en: 'Done', fil: 'Tapos na' },
  'quick.posting': { en: 'Posting…', fil: 'Pino-post…' },
  'quick.reported': { en: 'Reported flooding here ✓', fil: 'Naiulat ang baha dito ✓' },
  'quick.undo': { en: 'Undo', fil: 'I-undo' },
  'quick.undone': { en: 'Report removed.', fil: 'Tinanggal ang ulat.' },
  'quick.voiceSay': { en: 'Say: high / medium / low', fil: 'Sabihin: mataas / katamtaman / mababa' },
  'quick.voiceTap': { en: 'Voice Report', fil: 'Ulat sa Boses' },
  'quick.voiceListening': { en: 'Listening…', fil: 'Nakikinig…' },
  'quick.voiceNoMatch': { en: 'Didn’t catch that — try again or tap a level', fil: 'Hindi na-gets — subukang muli o pumili ng antas' },
  'quick.voiceError': { en: 'Voice input isn’t available right now — tap a level instead.', fil: 'Hindi gumagana ang boses ngayon — pumili na lang ng antas.' },
  'quick.voiceSpokenHigh': { en: 'Reported high flood here', fil: 'Naiulat ang mataas na baha dito' },
  'quick.voiceSpokenMedium': { en: 'Reported medium flood here', fil: 'Naiulat ang katamtamang baha dito' },
  'quick.voiceSpokenLow': { en: 'Reported low flood here', fil: 'Naiulat ang mababang baha dito' },

  // ── Report list item ──
  'report.yours': { en: 'YOURS', fil: 'IYO' },
  'report.kmAway': { en: 'km away', fil: 'km ang layo' },
  'report.confirmed': { en: 'confirmed', fil: 'nakumpirma' },
  'report.unverified': { en: 'unverified', fil: 'hindi beripikado' },
  'report.system': { en: 'System report', fil: 'Ulat ng sistema' },
  'report.left': { en: 'left', fil: 'natitira' },
  'report.expired': { en: 'expired', fil: 'tapos na' },
  'report.confirmCta': { en: "I'm seeing this too — confirm", fil: 'Nakikita ko rin ito — kumpirmahin' },
  'report.confirming': { en: 'Confirming…', fil: 'Kinukumpirma…' },

  // ── Severity ──
  'sev.high': { en: 'High', fil: 'Mataas' },
  'sev.medium': { en: 'Medium', fil: 'Katamtaman' },
  'sev.low': { en: 'Low', fil: 'Mababa' },

  // ── Water-level real-world reference (body scale) — depthReference() bands in floodMeta.ts ──
  'depthRef.soles': { en: 'Over the soles', fil: 'Lampas talampakan' },
  'depthRef.ankle': { en: 'Ankle-deep', fil: 'Hanggang bukong-bukong' },
  'depthRef.shin': { en: 'Shin-deep', fil: 'Hanggang lulod' },
  'depthRef.knee': { en: 'Knee-deep', fil: 'Hanggang tuhod' },
  'depthRef.thigh': { en: 'Thigh-deep', fil: 'Hanggang hita' },
  'depthRef.waist': { en: 'Waist-deep', fil: 'Hanggang baywang' },
  'depthRef.chest': { en: 'Chest-deep', fil: 'Hanggang dibdib' },
  'depthRef.neck': { en: 'Neck-deep', fil: 'Hanggang leeg' },
  'depthRef.overhead': { en: "Over an adult's head", fil: 'Lampas sa ulo' },
  // ── Vehicle cues — depthReference() cues; thresholds mirror the road passability limits ──
  'depthVeh.curb': { en: 'About curb height', fil: 'Mga taas ng bangketa' },
  'depthVeh.halfTire': { en: 'Up to half a car tire', fil: 'Hanggang kalahati ng gulong' },
  'depthVeh.stall': { en: 'Most cars stall', fil: 'Tumitigil ang karamihan ng sasakyan' },
  'depthVeh.float': { en: 'Vehicles float or stall', fil: 'Lumulutang o tumitigil ang sasakyan' },

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
  'dash.subtitle': { en: 'Live road closures & reports · Philippines', fil: 'Live na saradong kalsada at ulat · Pilipinas' },
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

  // ── Live activity ticker ──
  'ticker.live': { en: 'LIVE', fil: 'LIVE' },
  'ticker.newest': { en: 'Newest', fil: 'Pinakabago' },
  'ticker.floodIn': { en: '{sev} flood — {district}', fil: '{sev} na baha — {district}' },

  // ── Guest sign-in nudges ──
  'guest.nudgeBody': { en: 'Browsing as guest — your reports show as ⚠ unverified until others confirm them.', fil: 'Naka-browse bilang guest — lalabas ang mga ulat mo bilang ⚠ hindi beripikado hanggang sa kumpirmahin ito ng iba.' },
  'guest.signInGoogle': { en: 'Sign in with Google', fil: 'Mag-sign in gamit ang Google' },
  'guest.defaultReason': { en: 'Sign in to verify your reports and unlock more features.', fil: 'Mag-sign in para ma-verify ang iyong mga ulat at ma-unlock ang higit pang features.' },
  'guest.quickNudge': { en: 'Posted as guest — sign in to verify your reports.', fil: 'Na-post bilang guest — mag-sign in para ma-verify ang iyong mga ulat.' },
  'guest.keepBrowsing': { en: 'Keep browsing as guest', fil: 'Magpatuloy bilang guest' },

  // ── Evacuation center detail card ──
  'evac.center': { en: 'Evacuation center', fil: 'Evacuation center' },
  'evac.minWalk': { en: 'min walk', fil: 'minutong lakad' },
  'evac.kmAway': { en: 'km away', fil: 'km ang layo' },
  'evac.directions': { en: 'Directions', fil: 'Direksyon' },
  'evac.call': { en: 'Call', fil: 'Tumawag' },
  'evac.hotline': { en: 'Hotline:', fil: 'Hotline:' },

  // ── Trip monitoring ──
  'trip.title': { en: 'MY TRIP', fil: 'AKING BIYAHE' },
  'trip.start': { en: 'Start trip', fil: 'Simulan ang biyahe' },
  'trip.end': { en: 'End trip', fil: 'Tapusin ang biyahe' },
  'trip.addStop': { en: '+ Add stop', fil: '+ Magdagdag ng hinto' },
  'trip.stopStart': { en: 'start', fil: 'simula' },
  'trip.stopDestination': { en: 'destination', fil: 'destinasyon' },
  'trip.clear': { en: 'clear', fil: 'ligtas' },
  'trip.reportsOne': { en: '1 report', fil: '1 ulat' },
  'trip.reportsMany': { en: '{n} reports', fil: '{n} ulat' },
  'trip.empty': { en: 'Add the places you’ll pass through and we’ll warn you the moment flooding is reported near any of them.', fil: 'Idagdag ang mga lugar na dadaanan mo at bibigyan ka namin ng babala sa sandaling may maiulat na baha malapit sa alinman sa kanila.' },
  'trip.desc': { en: 'Watching every stop along your route — even while this tab is in the background.', fil: 'Binabantayan ang bawat hinto sa iyong ruta — kahit nasa background ang tab na ito.' },
  'trip.independentNote': { en: 'Trip alerts stay on while a trip is running, even if Nearby flood alerts are off.', fil: 'Mananatiling naka-on ang mga babala sa biyahe habang tumatakbo ito, kahit naka-off ang Mga babala sa malapit na baha.' },
  'trip.keepOpen': { en: 'Keep this tab open so alerts keep coming.', fil: 'Panatilihing bukas ang tab na ito para tuloy ang mga abiso.' },
  'trip.started': { en: 'Trip started — watching {n} stops.', fil: 'Nagsimula ang biyahe — binabantayan ang {n} hinto.' },
  'trip.ended': { en: 'Trip ended. Your stops are saved for next time.', fil: 'Tapos na ang biyahe. Nakasave ang iyong mga hinto para sa susunod.' },
  'trip.clearStops': { en: 'Clear stops', fil: 'Burahin ang mga hinto' },
  'trip.maxReached': { en: 'Up to {n} stops', fil: 'Hanggang {n} hinto' },
  'trip.duplicate': { en: 'That place is already a stop on this trip.', fil: 'Nasa listahan na ng hinto ang lugar na iyon.' },
  'trip.addedFlooded': { en: 'Heads up — {n} flood report(s) already near this stop.', fil: 'Paalala — may {n} ulat ng baha na malapit sa hintong ito.' },
  'trip.remove': { en: 'Remove', fil: 'Alisin' },
  'trip.moveUp': { en: 'Move up', fil: 'Iangat' },
  'trip.moveDown': { en: 'Move down', fil: 'Ibaba' },
  'trip.alertRadius': { en: 'ALERT RADIUS', fil: 'SAKOP NG BABALA' },
  'trip.onRoad': { en: 'on {road}', fil: 'sa {road}' },
  'trip.viewOnMap': { en: 'View on map', fil: 'Tingnan sa mapa' },
  'trip.addTitle': { en: 'Add a stop', fil: 'Magdagdag ng hinto' },
  'trip.addSubtitle': { en: 'Search a place, use your location, or tap the map', fil: 'Maghanap ng lugar, gamitin ang iyong lokasyon, o i-tap ang mapa' },
  'trip.searchPlaceholder': { en: 'Search a barangay, street or landmark…', fil: 'Maghanap ng barangay, kalye o landmark…' },
  'trip.useCurrent': { en: 'Current', fil: 'Kasalukuyan' },
  'trip.stopLabel': { en: 'STOP NAME', fil: 'PANGALAN NG HINTO' },
  'trip.adjustHint': { en: 'Drag the pin or tap the map to adjust.', fil: 'I-drag ang pin o i-tap ang mapa para iayos.' },
  'trip.saveStop': { en: 'Add stop', fil: 'Idagdag ang hinto' },
  'trip.alertTitleOne': { en: 'Flooding on your trip', fil: 'May baha sa iyong biyahe' },
  'trip.alertTitleMany': { en: '{n} new floods on your trip', fil: '{n} bagong baha sa iyong biyahe' },
  'trip.alertBodyOne': { en: '{sev} flooding reported near {stop} — {name}, about {depth} cm deep.', fil: '{sev} na baha ang naiulat malapit sa {stop} — {name}, humigit-kumulang {depth} cm ang lalim.' },
  'trip.alertBodyMany': { en: '{n} new floods reported near stops on your trip. The worst is {sev} at {name}.', fil: '{n} bagong baha ang naiulat malapit sa mga hinto ng iyong biyahe. Ang pinakamalala ay {sev} sa {name}.' },

  // ── Flood-prone zones (admin-pinned advisory pins + manual warn) ──
  'zone.warnTitle': { en: 'Send a flood warning', fil: 'Magpadala ng babala sa baha' },
  'zone.warnBody': { en: 'This broadcasts a warning for this zone to everyone nearby, right now.', fil: 'Ipapadala nito ngayon din ang babala para sa zone na ito sa lahat ng malapit.' },
  'zone.advisory': { en: 'Reach is proximity-limited — only people within roughly this zone’s radius will see it.', fil: 'Limitado ang saklaw nito sa lugar — makikita lang ito ng mga taong nasa loob ng radius ng zone na ito.' },
  'zone.sendWarning': { en: 'Send warning', fil: 'Ipadala ang babala' },
  'zone.lastWarned': { en: 'Last warned', fil: 'Huling binalaan' },
  'zone.legend': { en: 'Flood-prone zone', fil: 'Zone na madalas bahain' },
} as const;

export type MsgKey = keyof typeof MESSAGES;

export function translate(lang: Lang, key: MsgKey): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return lang === 'fil' ? entry.fil : entry.en;
}

/** Translate a key and substitute {placeholder} tokens from `params`. */
export function tFormat(lang: Lang, key: MsgKey, params: Record<string, string | number>): string {
  let s = translate(lang, key);
  for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  return s;
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

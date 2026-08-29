import React from 'react';
import type { AuthState } from '../../hooks/useAuth';
import type { GeoResult } from '../../api/geocode';
import { BUILD_COMMIT, BUILD_LABEL, BUILD_TIME } from '../../buildInfo';
import { useI18n } from '../../i18n';
import { useTheme, type ThemeChoice } from '../../theme';
import ReportOptions from './ReportOptions';
import SearchBox, { type SearchBoxHandle } from './SearchBox';

interface TopBarProps {
  isMobile: boolean;
  auth: AuthState | null;
  /** Report flood / Quick report — picked from the chooser popover under this button. */
  onChooseReport: (target: 'report' | 'quick') => void;
  /** Remembered preference — orders/highlights the two ReportOptions. */
  reportPref: 'report' | 'quick';
  onShare: () => void;
  onSOS: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onSearchSelect: (r: GeoResult) => void;
  /** User's current location — softly biases location-search results toward nearby places (worldwide). */
  searchNear?: { lat: number; lng: number };
  /** Lets App focus the location search imperatively (e.g. from a "search instead" toast). */
  searchRef?: React.Ref<SearchBoxHandle>;
  onNotify: () => void;
  notifyOn: boolean;
  onDashboard: () => void;
  onWaterChart: () => void;
  onRescueChart: () => void;
  onSupport: () => void;
  isAdmin: boolean;
  onAdmin: () => void;
  onResponse: () => void;
  onReportIncident: () => void;
  /** Opens the admin "Quick flood report" page — the bulk hotspot reporter. */
  onQuickReport: () => void;
  /** Opens the admin "Flood digest" modal — the consolidated all-active-reports social post. */
  onFloodDigest: () => void;
  onShowFeatures: () => void;
  onShowFeedback: () => void;
}

/** Shared style for the square 40×40 icon buttons in the action row. */
const ICON_BTN: React.CSSProperties = {
  width: 40,
  height: 40,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--bw-line)',
  background: 'var(--bw-surface)',
  borderRadius: 11,
  fontSize: 16,
  cursor: 'pointer',
};

/** A row in the mobile "More" overflow menu. */
const MenuItem: React.FC<{ icon: string; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', textAlign: 'left', padding: '10px 12px', border: 0, background: 'transparent', borderRadius: 9, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: 'var(--bw-ink)' }}
  >
    <span style={{ fontSize: 16, width: 22, textAlign: 'center', flex: 'none' }}>{icon}</span>
    {label}
  </button>
);

const TopBar: React.FC<TopBarProps> = ({
  isMobile,
  auth,
  onChooseReport,
  reportPref,
  onShare,
  onSOS,
  onSignIn,
  onSignOut,
  onSearchSelect,
  searchNear,
  searchRef,
  onNotify,
  notifyOn,
  onDashboard,
  onWaterChart,
  onRescueChart,
  onSupport,
  isAdmin,
  onAdmin,
  onResponse,
  onQuickReport,
  onReportIncident,
  onFloodDigest,
  onShowFeatures,
  onShowFeedback,
}) => {
  const { t } = useI18n();
  const { choice: themeChoice, resolved: themeResolved, setChoice: setThemeChoice } = useTheme();
  const initials = auth ? auth.name.trim().charAt(0).toUpperCase() || '?' : '';

  /** Translated label for a theme choice — used for both the aria-label and the mobile menu row. */
  const themeModeLabel = (c: ThemeChoice): string =>
    c === 'light' ? t('theme.light') : c === 'dark' ? t('theme.dark') : t('theme.system');

  // Desktop-only "Report flood" chooser — a small popover anchored beneath the button, offering
  // the same two ReportOptions as the mobile FAB fan-out (App.tsx has no floating button on desktop).
  const [reportPickerOpen, setReportPickerOpen] = React.useState(false);
  const reportBtnRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!reportPickerOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (reportBtnRef.current && !reportBtnRef.current.contains(e.target as Node)) setReportPickerOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [reportPickerOpen]);

  // Desktop-only theme (System/Light/Dark) popover — same anchored-popover + document-mousedown-
  // close pattern as the report chooser above. Three modes don't fit one icon unambiguously, so the
  // button opens a small list instead of cycling directly (unlike the mobile menu row below, which
  // has no room for a submenu and cycles on tap instead).
  const [themePickerOpen, setThemePickerOpen] = React.useState(false);
  const themeBtnRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!themePickerOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (themeBtnRef.current && !themeBtnRef.current.contains(e.target as Node)) setThemePickerOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [themePickerOpen]);
  const THEME_OPTIONS: { value: ThemeChoice; icon: string }[] = [
    { value: 'system', icon: '🖥️' },
    { value: 'light', icon: '☀️' },
    { value: 'dark', icon: '🌙' },
  ];
  const THEME_CYCLE: ThemeChoice[] = ['system', 'light', 'dark'];
  const nextThemeChoice = (c: ThemeChoice): ThemeChoice => THEME_CYCLE[(THEME_CYCLE.indexOf(c) + 1) % THEME_CYCLE.length];

  // On mobile the secondary actions collapse into this overflow menu so the bar fits any viewport.
  const [menuOpen, setMenuOpen] = React.useState(false);
  // When the mobile location search expands, it takes over the row and the action cluster hides.
  const [searchExpanded, setSearchExpanded] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  // The ⋯ trigger sits mid-cluster (notify/SOS/auth to its right), so a menu right-anchored under it
  // overflows the left viewport edge on a phone and clips the icons. We pin the dropdown to the
  // viewport's right edge (position: fixed) below the button, measuring the button's bottom on open.
  const moreBtnRef = React.useRef<HTMLButtonElement>(null);
  const [menuTop, setMenuTop] = React.useState(56);
  const toggleMenu = (): void => {
    if (!menuOpen) {
      const r = moreBtnRef.current?.getBoundingClientRect();
      if (r) setMenuTop(r.bottom + 8);
    }
    setMenuOpen((o) => !o);
  };
  React.useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);
  const runAndClose = (fn: () => void) => (): void => { setMenuOpen(false); fn(); };

  // Notify, SOS and the auth control stay visible at every width; share/charts/support fold into
  // the overflow menu on mobile and sit inline on desktop.
  const notifyBtn = (
    <button
      onClick={onNotify}
      title={t('topbar.nearbyAlerts')}
      aria-label={t('topbar.nearbyAlerts')}
      style={{ ...ICON_BTN, position: 'relative', border: `1px solid ${notifyOn ? 'var(--bw-tint-info-border)' : 'var(--bw-line)'}`, background: notifyOn ? 'var(--bw-tint-info)' : 'var(--bw-surface)' }}
    >
      🔔
      {notifyOn && (
        <span style={{ position: 'absolute', top: 7, right: 8, width: 8, height: 8, borderRadius: '50%', background: 'var(--bw-primary)', border: '2px solid var(--bw-surface)' }} />
      )}
    </button>
  );

  const sosBtn = (
    <button
      onClick={onSOS}
      style={{ display: 'flex', alignItems: 'center', flex: 'none', height: 40, padding: '0 16px', border: 0, background: 'var(--bw-danger)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-on-accent)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,.32)' }}
    >
      SOS
    </button>
  );

  const adminBtn = isAdmin ? (
    <button
      onClick={onAdmin}
      title="Admin console"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-primary)', cursor: 'pointer' }}
    >
      ⚙ {!isMobile && t('topbar.admin')}
    </button>
  ) : null;

  // Response console — ADMIN-only triage/dispatch dashboard. Rose-tinted to read as ops/emergency,
  // distinct from the blue Admin button.
  const responseBtn = isAdmin ? (
    <button
      onClick={onResponse}
      title="Response console — triage & dispatch"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid var(--bw-tint-rose-border)', background: 'var(--bw-tint-rose)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-on-tint-rose)', cursor: 'pointer' }}
    >
      🚑 {!isMobile && t('topbar.response')}
    </button>
  ) : null;

  // Quick flood report — admin-only bulk hotspot reporter. Amber-tinted to read as the "act now
  // during an event" affordance, distinct from the blue Admin console and rose Response console.
  // Must exist here AND in the mobile overflow menu below: the menu only renders under isMobile,
  // so a menu-only entry is invisible on desktop.
  const quickReportBtn = isAdmin ? (
    <button
      onClick={onQuickReport}
      title="Quick flood report — post known hotspots in one pass"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid var(--bw-tint-warn-border)', background: 'var(--bw-tint-warn)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-on-tint-warn)', cursor: 'pointer' }}
    >
      ⚡ {!isMobile && t('topbar.quick')}
    </button>
  ) : null;

  // Flood digest — admin-only, one-click consolidated post covering every active report. Sky-tinted
  // to read as a social/sharing affordance (matches the Share button family), distinct from the
  // blue Admin console and rose Response console.
  const digestBtn = isAdmin ? (
    <button
      onClick={onFloodDigest}
      title="Post flood digest — all active reports to Facebook & X"
      style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 6, height: 40, padding: '0 14px', border: '1px solid var(--bw-tint-info-border)', background: 'var(--bw-tint-info)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-primary-deep)', cursor: 'pointer' }}
    >
      📣 {!isMobile && t('topbar.floodDigest')}
    </button>
  ) : null;

  const authCluster = auth ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
      <div
        title={`${auth.name} · ${auth.role}`}
        style={{ width: 34, height: 34, borderRadius: '50%', background: auth.picture ? `center/cover url(${auth.picture})` : 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))', color: 'var(--bw-on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flex: 'none' }}
      >
        {!auth.picture && initials}
      </div>
      {!isMobile && (
        <button
          onClick={onSignOut}
          style={{ border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', borderRadius: 9, padding: '7px 11px', fontSize: 12.5, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
        >
          {t('topbar.signOut')}
        </button>
      )}
    </div>
  ) : (
    <button
      onClick={onSignIn}
      style={{ flex: 'none', height: 40, padding: '0 15px', border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
    >
      {t('topbar.signIn')}
    </button>
  );

  return (
    <div
      style={{
        flex: 'none',
        height: 62,
        display: 'flex',
        alignItems: 'center',
        gap: isMobile ? 9 : 16,
        padding: isMobile ? '0 12px' : '0 20px',
        background: 'var(--bw-surface)',
        borderBottom: '1px solid var(--bw-line)',
        zIndex: 40,
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 'none' }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            background: 'linear-gradient(150deg,var(--bw-primary),var(--bw-primary-deep))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(3,105,161,.3)',
            flex: 'none',
          }}
        >
          {/* Rain + flood mark — mirrors public/favicon.svg */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <g stroke="var(--bw-on-accent)" strokeWidth="1.8" strokeLinecap="round">
              <line x1="8" y1="4" x2="6.6" y2="7.8" />
              <line x1="12" y1="3.2" x2="10.6" y2="7" />
              <line x1="16" y1="4" x2="14.6" y2="7.8" />
            </g>
            <path d="M0 13 q 3.5 -3 7 0 t 7 0 t 7 0 t 7 0 V24 H0 Z" fill="var(--bw-on-accent)" fillOpacity="0.5" />
            <path d="M0 16 q 3.5 -3 7 0 t 7 0 t 7 0 t 7 0 V24 H0 Z" fill="var(--bw-on-accent)" />
          </svg>
        </div>
        {/* The wordmark + sublines are hidden on mobile to free up room for the action row. */}
        {!isMobile && (
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>FloodedArea</div>
            <div style={{ fontSize: 11, color: 'var(--bw-muted)', fontWeight: 600 }}>{t('topbar.region')}</div>
            <button
              onClick={onShowFeatures}
              title={`See all features · build ${BUILD_COMMIT} · ${new Date(BUILD_TIME).toLocaleString()}`}
              style={{
                border: 0,
                background: 'transparent',
                padding: 0,
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                color: 'var(--bw-faint)',
                whiteSpace: 'nowrap',
                marginTop: 1,
                cursor: 'pointer',
                textDecoration: 'underline',
                textDecorationStyle: 'dotted',
                textUnderlineOffset: 2,
              }}
            >
              {BUILD_LABEL}
            </button>
          </div>
        )}
      </div>

      {/* Location search */}
      <SearchBox ref={searchRef} isMobile={isMobile} onSelect={onSearchSelect} onExpandedChange={setSearchExpanded} near={searchNear} />

      {/* The action cluster yields the whole row to the search field while it's expanded on mobile. */}
      {!(isMobile && searchExpanded) && (
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 9, marginLeft: 'auto' }}>
        {isMobile ? (
          <>
            {/* Overflow menu for secondary actions */}
            <div ref={menuRef} style={{ position: 'relative', flex: 'none' }}>
              <button
                ref={moreBtnRef}
                onClick={toggleMenu}
                title={t('topbar.more')}
                aria-label={t('topbar.more')}
                aria-expanded={menuOpen}
                style={{ ...ICON_BTN, background: menuOpen ? 'var(--bw-bg-subtle)' : 'var(--bw-surface)' }}
              >
                ⋯
              </button>
              {menuOpen && (
                <div
                  style={{ position: 'fixed', top: menuTop, right: 12, zIndex: 1400, minWidth: 212, maxWidth: 'calc(100vw - 24px)', background: 'var(--bw-surface-raised)', border: '1px solid var(--bw-line)', borderRadius: 12, boxShadow: '0 12px 34px rgba(15,23,42,.18)', overflow: 'hidden', padding: 6 }}
                >
                  <MenuItem icon="📊" label={t('topbar.dashboard')} onClick={runAndClose(onDashboard)} />
                  <MenuItem icon="⤴" label={t('topbar.share')} onClick={runAndClose(onShare)} />
                  <MenuItem icon="📈" label={t('topbar.waterLevels')} onClick={runAndClose(onWaterChart)} />
                  <MenuItem icon="🛟" label={t('topbar.rescue')} onClick={runAndClose(onRescueChart)} />
                  <MenuItem icon="💙" label={t('topbar.support')} onClick={runAndClose(onSupport)} />
                  <MenuItem icon="💬" label={t('topbar.feedback')} onClick={runAndClose(onShowFeedback)} />
                  <MenuItem icon="✨" label={t('topbar.features')} onClick={runAndClose(onShowFeatures)} />
                  {/* Appearance — cycles System → Light → Dark on tap (no room here for the
                      desktop popover's list); current mode is baked into the label since MenuItem
                      has no on-state prop. */}
                  <MenuItem
                    icon={themeResolved === 'dark' ? '🌙' : '☀️'}
                    label={`${t('theme.appearance')}: ${themeModeLabel(themeChoice)}`}
                    onClick={runAndClose(() => setThemeChoice(nextThemeChoice(themeChoice)))}
                  />
                  {/* Admin-only actions live in the menu on mobile so the bar never overflows. */}
                  {isAdmin && <MenuItem icon="⚡" label={t('topbar.quickReport')} onClick={runAndClose(onQuickReport)} />}
                  {isAdmin && <MenuItem icon="🚑" label={t('topbar.responseConsole')} onClick={runAndClose(onResponse)} />}
                  {isAdmin && <MenuItem icon="📣" label={t('topbar.floodDigest')} onClick={runAndClose(onFloodDigest)} />}
                  {isAdmin && <MenuItem icon="⚙" label={t('topbar.adminConsole')} onClick={runAndClose(onAdmin)} />}
                  {/* Sign out — the avatar-only auth cluster hides it on mobile (no room for the
                      inline button), so it must live here or a mobile user can never sign out. */}
                  {auth && (
                    <>
                      <div style={{ margin: '6px 4px', borderTop: '1px solid var(--bw-line-soft)' }} />
                      <div style={{ padding: '6px 12px 2px', fontSize: 11, fontWeight: 700, color: 'var(--bw-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {auth.name}
                      </div>
                      <MenuItem icon="⏻" label={t('topbar.signOut')} onClick={runAndClose(onSignOut)} />
                    </>
                  )}
                </div>
              )}
            </div>
            {notifyBtn}
            {sosBtn}
            {authCluster}
          </>
        ) : (
          <>
            <button
              onClick={onShare}
              style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 7, height: 40, padding: '0 15px', border: '1px solid var(--bw-line)', background: 'var(--bw-surface)', borderRadius: 11, fontSize: 13, fontWeight: 700, color: 'var(--bw-ink-soft)', cursor: 'pointer' }}
            >
              <span style={{ fontSize: 14 }}>⤴</span> {t('topbar.share')}
            </button>

            <button onClick={onDashboard} title="Flood dashboard" aria-label="Flood dashboard" style={ICON_BTN}>
              📊
            </button>

            <button onClick={onWaterChart} title="Water levels over time" aria-label="Water levels over time" style={ICON_BTN}>
              📈
            </button>

            <button onClick={onRescueChart} title="Rescue requests by district" aria-label="Rescue requests by district" style={ICON_BTN}>
              🛟
            </button>

            {notifyBtn}

            <button onClick={onShowFeedback} title="Community feedback — suggest & vote" aria-label="Community feedback" style={ICON_BTN}>
              💬
            </button>

            <button onClick={onSupport} title="About FloodedArea & support" aria-label="About FloodedArea & support" style={ICON_BTN}>
              💙
            </button>

            {/* Appearance (System/Light/Dark) — desktop popover, reusing the report chooser's
                anchored-popover + document-mousedown-close pattern above. The icon reflects the
                *resolved* theme; aria-label names the current mode. */}
            <div ref={themeBtnRef} style={{ position: 'relative', flex: 'none' }}>
              <button
                onClick={() => setThemePickerOpen((o) => !o)}
                title={`${t('theme.appearance')}: ${themeModeLabel(themeChoice)}`}
                aria-label={`${t('theme.appearance')}: ${themeModeLabel(themeChoice)}`}
                aria-haspopup="true"
                aria-expanded={themePickerOpen}
                style={{ ...ICON_BTN, background: themePickerOpen ? 'var(--bw-bg-subtle)' : 'var(--bw-surface)' }}
              >
                {themeResolved === 'dark' ? '🌙' : '☀️'}
              </button>
              {themePickerOpen && (
                <div style={{ position: 'absolute', top: 48, right: 0, zIndex: 1200, animation: 'popIn .14s ease-out' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      width: 168,
                      background: 'var(--bw-surface-raised)',
                      borderRadius: 13,
                      boxShadow: '0 12px 34px rgba(15,23,42,.28)',
                      border: '1px solid var(--bw-line)',
                      overflow: 'hidden',
                      padding: 5,
                    }}
                  >
                    <div style={{ padding: '6px 9px 4px', fontSize: 10.5, fontWeight: 800, letterSpacing: '.02em', textTransform: 'uppercase', color: 'var(--bw-muted)' }}>
                      {t('theme.appearance')}
                    </div>
                    {THEME_OPTIONS.map((opt) => {
                      const active = themeChoice === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { setThemeChoice(opt.value); setThemePickerOpen(false); }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            width: '100%',
                            textAlign: 'left',
                            padding: '8px 9px',
                            border: 0,
                            borderRadius: 9,
                            background: active ? 'var(--bw-tint-info)' : 'transparent',
                            cursor: 'pointer',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: active ? 'var(--bw-primary-deep)' : 'var(--bw-ink)',
                          }}
                        >
                          <span style={{ fontSize: 14, width: 18, textAlign: 'center', flex: 'none' }}>{opt.icon}</span>
                          {themeModeLabel(opt.value)}
                          {active && <span style={{ marginLeft: 'auto', fontSize: 12 }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {sosBtn}

            {/* Admins post system reports via the incident modal (AdminReportIncidentModal), so the
                primary button skips the Detailed/Quick chooser popover entirely for them — that
                citizen-only flow (ReportOptions below) never opens under isAdmin. */}
            <div ref={reportBtnRef} style={{ position: 'relative', flex: 'none' }}>
              <button
                onClick={() => (isAdmin ? onReportIncident() : setReportPickerOpen((o) => !o))}
                aria-expanded={isAdmin ? undefined : reportPickerOpen}
                aria-haspopup={isAdmin ? undefined : 'true'}
                style={{ display: 'flex', alignItems: 'center', flex: 'none', gap: 8, height: 40, padding: '0 17px', border: 0, background: 'var(--bw-primary)', borderRadius: 11, fontSize: 13, fontWeight: 800, color: 'var(--bw-on-accent)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14,165,233,.32)' }}
              >
                <span style={{ fontSize: 16, fontWeight: 700 }}>+</span> {t('topbar.report')}
              </button>
              {!isAdmin && reportPickerOpen && (
                <div style={{ position: 'absolute', top: 48, right: 0, zIndex: 1200, animation: 'popIn .14s ease-out' }}>
                  <ReportOptions
                    preferred={reportPref}
                    onChoose={(target) => { setReportPickerOpen(false); onChooseReport(target); }}
                  />
                </div>
              )}
            </div>

            {quickReportBtn}
            {responseBtn}
            {digestBtn}
            {adminBtn}
            {authCluster}
          </>
        )}
      </div>
      )}
    </div>
  );
};

export default TopBar;

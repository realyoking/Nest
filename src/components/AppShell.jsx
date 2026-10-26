import UsageMeter from './UsageMeter.jsx';
import { Suspense, useEffect, useRef, useState } from 'react';
import { PullToRefresh, SwipeBack } from './Gestures.jsx';
import { isIosStandalone } from '../lib/use-gestures.js';
import { useSeason, SeasonBadge } from '../lib/season-hook.js';
import { migrateLegacy } from '../lib/google.js';
import { InstallBanner } from './InstallGuide.jsx';
import { enablePushOnThisDevice, permission, setResubscribeHook, startLocalChecks } from '../lib/push.js';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import AccountMenu from './AccountMenu.jsx';
import { initSeen } from '../lib/whatsnew.js';
import { latestEntry } from '../data/changelog.js';
import { BrandLogo } from '../brand.jsx';
import { iconPath, useAppIcon, validChoice, hasDeviceChoice, saveChoice } from '../lib/icons.js';
import Icon from './Icon.jsx';
import { Avatar, LangSwitch, useToast } from './ui.jsx';
import { familySettings } from '../lib/nestie.js';
import { setFamilySeasonDefault } from '../lib/seasons.js';
import { EVT as SEASON_EVT } from '../lib/season-hook.js';
import { EVT_DONE as BG_DONE } from '../lib/bg-tasks.js';
import { inQuietHours } from '../lib/prefs.js';
import { useI18n } from '../lib/i18n.jsx';
import { useSession } from '../lib/session.jsx';
import { useBe } from '../lib/be-context.jsx';
import { usePluginTabs } from './PluginSettings.jsx';
import { useAppConfig, flagForPath, PATH_FLAG } from '../lib/appconfig.jsx';
import Announcements, { BlockScreen } from './Announcements.jsx';
import { RegionGate } from './RegionGate.jsx';
import { hkFeatures, normRegion, setActiveRegion } from '../lib/regions/index.js';
// Run 11: pages that only make sense in Hong Kong (live MTR / KMB data).
export const HK_ONLY = ['transport'];
function InAppNotice({ n, onClose, onOpen }) {
  if (!n) return null;
  return (
    <div className="inapp" role="alert">
      <button className="inapp-main" onClick={onOpen}><Icon name="bell" size={18} /><span><b>{n.title}</b><small>{n.body}</small></span></button>
      <button className="inapp-x" aria-label="×" onClick={onClose}><Icon name="x" size={16} /></button>
    </div>
  );
}

export const NAV = [
  ['', 'home', 'home'], ['agent', 'chat', 'agent'], ['tutor', 'book', 'tutor'], ['quiz', 'cards', 'quiz'],
  ['memory', 'brain', 'memory'], ['files', 'folder', 'files'], ['reminders', 'bell', 'reminders'], ['calendar', 'calendar', 'calendar'], ['transport', 'train', 'transport'], ['subscriptions', 'receipt', 'subs'], ['family', 'users', 'family'],
  ['connections', 'plug', 'connections'], ['store', 'puzzle', 'store'], ['usage', 'gauge', 'usage'], ['settings', 'gear', 'settings'],
];
const TABS = ['', 'agent', 'tutor', 'reminders'];

export default function AppShell() {
  const { be } = useBe();
  const { t, lang, uiLang } = useI18n();
  const s = useSession();
  const { demo } = useBe();
  const ac = useAppConfig();
  // Admin default theme applies until the user picks one themselves (profile prefs.theme unset).
  const theme = s.profile?.prefs?.theme ? s.prefs.theme : (ac.loaded ? ac.defaults?.theme || s.prefs.theme : s.prefs.theme);
  const appIcon = useAppIcon();
  // New device: adopt the icon saved on the profile (device choice wins once made).
  useEffect(() => { if (!demo && validChoice(s.prefs.appIcon) && !hasDeviceChoice() && s.prefs.appIcon !== appIcon.choice) saveChoice(s.prefs.appIcon); }, [s.prefs.appIcon, demo]); // eslint-disable-line react-hooks/exhaustive-deps
  // Move an older single-account Google session token into the multi-account list (once).
  useEffect(() => { if (!demo && s.profile && s.user) migrateLegacy(s.profile, s.user.uid).catch(() => {}); }, [demo, s.profile, s.user]);
  // Theme applies to the signed-in app only (never the public pages or the landing demo).
  useEffect(() => {
    if (demo) return;
    const root = document.documentElement;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    // A theme plugin can force a scheme (root.dataset.plugScheme, set by src/lib/plugins/runtime.jsx).
    const apply = () => { root.dataset.theme = root.dataset.plugScheme || (theme === 'dark' || (theme === 'system' && mq.matches) ? 'dark' : 'light'); };
    apply(); mq.addEventListener?.('change', apply); window.addEventListener('nest:theme-reapply', apply);
    return () => { mq.removeEventListener?.('change', apply); window.removeEventListener('nest:theme-reapply', apply); delete root.dataset.theme; };
  }, [theme, demo]);
  // In-app reminder alert, once per browser session (respects the setting and quiet hours).
  const toast = useToast();
  useEffect(() => {
    if (demo || !s.prefs.notifyReminders || inQuietHours(s.prefs) || !s.reminders.length) return;
    const key = `nest.alerted.${s.user.uid}`;
    if (sessionStorage.getItem(key)) return;
    const now = Date.now();
    const open = s.reminders.filter((r) => !r.done && r.dueAt && (!r.memberId || r.memberId === s.user.uid));
    const overdue = open.filter((r) => r.dueAt < now && now - r.dueAt < 3 * 864e5).length;
    const soon = open.filter((r) => r.dueAt >= now && r.dueAt - now < 2 * 3600e3).length;
    sessionStorage.setItem(key, '1');
    if (soon) toast(t('shell.dueSoon', { n: soon })); else if (overdue) toast(t('shell.overdue', { n: overdue }));
  }, [s.reminders.length, demo]);
  // What's new: one toast per new version per device (a fresh device just records the version).
  useEffect(() => {
    if (demo) return;
    if (initSeen() && !sessionStorage.getItem('nest.wnToast')) {
      sessionStorage.setItem('nest.wnToast', '1');
      const e = latestEntry();
      toast(t('changelog.toast', { title: (e[lang] || e['zh-Hant']).title }), 'ok', { duration: 8000, action: { label: t('changelog.view'), onClick: () => navigate('/app/changelog') } });
    }
  }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps
  // System notifications while the app is open (the server cron only runs daily on the Hobby plan).
  const sRef = useRef(s); sRef.current = s;
  useEffect(() => (demo ? undefined : startLocalChecks(() => sRef.current, t)), [demo, lang]);
  // Browser rotated the push subscription: re-register silently (permission already granted).
  useEffect(() => {
    if (demo) return;
    setResubscribeHook(() => { if (sRef.current.prefs.pushEnabled && permission() === 'granted') enablePushOnThisDevice(be.getIdToken).catch(() => {}); });
    return () => setResubscribeHook(null);
  }, [demo]);
  // Remember the chosen language on the profile (the AI and future devices follow it).
  useEffect(() => { if (!demo && s.profile && s.prefs.lang !== uiLang) s.savePrefs({ lang: uiLang }).catch(() => {}); }, [uiLang, demo]); // Run 14: the selected language (was the legacy 2-way lang)
  const loc = useLocation();
  const navigate = useNavigate();
  const ptabs = usePluginTabs();
  const to = (p) => `/app${p ? '/' + p : ''}`;
  // The More tab stays selected on More and on every page that is not one of the other tabs (iOS Settings style).
  const moreActive = !TABS.some((p) => (p ? loc.pathname.startsWith(to(p)) : loc.pathname === '/app'));
  // Push / pop transitions between More and the pages opened from it.
  const fromMore = !!loc.state?.fromMore;
  const motion = fromMore ? 'push-in' : loc.state?.pop ? 'pop-in' : 'route-in';
  // Feature flags (admin config): hidden from navigation; a direct link shows 「此功能暫時停用」 (server refuses too).
  const region = normRegion(s.profile?.region);
  useEffect(() => { setActiveRegion(region); }, [region]);
  const navOn = (p) => (!PATH_FLAG[p] || ac.flag(PATH_FLAG[p])) && (!HK_ONLY.includes(p) || hkFeatures(region));
  const NAVX = NAV.filter(([p]) => navOn(p));
  const TABSX = TABS.filter((p) => navOn(p));
  const offFlag = flagForPath(loc.pathname);
  const pageOff = offFlag && !ac.flag(offFlag);
  const myName = s.me?.displayName || s.user?.displayName || '';
  const myEmail = s.user?.email || s.profile?.email || '';

  // In-app banner for reminders that fire while Nest is open (src/lib/push.js inApp()).
  const [notice, setNotice] = useState(null);
  const nav = useNavigate();
  // Run 23: family default for holiday themes (before useSeason reads it) + "reply ready" toast for chats left mid-reply.
  const famHoliday = familySettings(s.family).holidayTheme;
  if (!demo) setFamilySeasonDefault(famHoliday);
  useEffect(() => { if (!demo) { try { window.dispatchEvent(new Event(SEASON_EVT)); } catch {} } }, [famHoliday, demo]);
  useEffect(() => {
    if (demo) return undefined;
    const f = (e) => {
      const fs = familySettings(sRef.current.family);
      toast(t('r23.progress.done', { name: fs.nestieName, title: e.detail?.title || t('agent.untitled') }), 'ok', { duration: 8000, action: { label: t('r23.progress.view'), onClick: () => nav(`/app/agent/${e.detail.cid}`) } });
    };
    window.addEventListener(BG_DONE, f);
    return () => window.removeEventListener(BG_DONE, f);
  }, [demo, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const season = useSeason();
  // Run 22: pull-to-refresh (not on chat pages, which scroll inside their own panel, and never in the landing's live demo) + swipe-back on pages opened from
  // More, only in the iOS home-screen app (Safari / Android have their own back swipe).
  const chatPage = /^\/app\/(agent|tutor|studio)/.test(loc.pathname);
  const [iosApp] = useState(() => isIosStandalone());
  const refresh = async () => { s.refreshPlan?.(); window.dispatchEvent(new Event('nest:refresh')); };
  useEffect(() => {
    const on = (e) => { setNotice(e.detail); clearTimeout(on.tm); on.tm = setTimeout(() => setNotice(null), 15000); };
    window.addEventListener('nest:inapp', on);
    return () => window.removeEventListener('nest:inapp', on);
  }, []);
  if (!demo && ac.maintenance?.on) return <BlockScreen kind="maintenance" message={ac.maintenance.msg?.[s.prefs.lang] || ac.maintenance.msg?.['zh-Hant'] || ''} />;
  if (!demo && ac.suspended && !ac.admin) return <BlockScreen kind="suspended" />;
  if (!demo && ac.signupBlocked && !ac.admin) return <BlockScreen kind="signup" />;
  // Existing users without a region choose one once (required); the demo profile always has one.
  if (!demo && s.profile && !region) return <RegionGate />;
  return (
    <div className={`shell fs-${s.prefs.fontSize}`}>
      <PullToRefresh onRefresh={refresh} enabled={!chatPage && !demo} label={t('common.loading')} />
      <SwipeBack enabled={fromMore && iosApp && !demo} onBack={() => navigate('/app/more', { state: { pop: true } })} />
      <InAppNotice n={notice} onClose={() => setNotice(null)} onOpen={() => { if (notice?.url) nav(notice.url); setNotice(null); }} />
      <aside className="side">
        <div className="side-top">
          <Link to="/app" className="side-logo"><BrandLogo lang={lang} tile={iconPath(appIcon.id, 'mark-64.png')} />{season && <Suspense fallback={null}><SeasonBadge season={season} /></Suspense>}</Link>
          <LangSwitch compact />
        </div>
        <div className="side-scroll">
        <Link to="/app/family" className="side-fam">
          <Avatar name={s.family?.name || ''} size={34} />
          <span><b>{s.family?.name}</b><small>{t('family.limit', { n: s.members.length, max: s.plan.members })}</small></span>
        </Link>
        <nav>
          {NAVX.map(([p, icon, k]) => (
            <NavLink key={k} to={to(p)} end={p === ''}><Icon name={icon} size={19} />{t(`app.nav.${k}`)}</NavLink>
          ))}
          {ptabs.map((x) => <NavLink key={`p-${x.id}`} to={to(x.path)}><Icon name={x.icon} size={19} />{x.label}</NavLink>)}
        </nav>
        <div className="side-foot">
          <Link to="/app/usage" className="side-usage">
            <UsageMeter compact />
          </Link>
        </div>
        </div>
        <div className="side-bottom">
          <div className="row side-acct">
            <AccountMenu name={myName} email={myEmail} onSignOut={() => be.signOut()} placement="up" className="side-am">
              <span className="side-me"><Avatar name={myName} src={s.myPhoto} size={28} /><span className="side-me-name">{myName}</span><Icon name="more" size={18} stroke={3} /></span>
            </AccountMenu>
          </div>
        </div>
      </aside>

      <div className="main">
        {!demo && ac.maintenance?.bypass && <div className="adm-bypass" role="status">{t('acfg.bypass')}</div>}
        {!demo && <Announcements />}
        <div className="mtop">
          {fromMore
            ? <button type="button" className="mtop-back" onClick={() => navigate('/app/more', { state: { pop: true } })}><Icon name="chevronRight" size={20} stroke={2.5} className="icon-flip" />{t('more.back')}</button>
            : <Link to="/app" className="mtop-logo"><BrandLogo size={24} lang={lang} tile={iconPath(appIcon.id, 'mark-64.png')} />{season && <Suspense fallback={null}><SeasonBadge season={season} /></Suspense>}</Link>}
          <div className="row" style={{ gap: 2 }}>
            <LangSwitch compact />
            <AccountMenu name={myName} email={myEmail} onSignOut={() => be.signOut()} placement="down" />
          </div>
        </div>
        <div className={`main-in ${motion}`} key={loc.pathname.split('/').slice(0, 3).join('/')}>
          {!demo && loc.pathname === '/app' && <InstallBanner />}
          {pageOff ? <BlockScreen kind="feature" /> : <Outlet />}
        </div>
      </div>

      <nav className="tabbar">
        {TABSX.map((p) => {
          const n = NAV.find((x) => x[0] === p);
          return <NavLink key={p} to={to(p)} end={p === ''}><Icon name={n[1]} size={22} />{t(`app.nav.${n[2]}`)}</NavLink>;
        })}
        <NavLink to="/app/more" className={() => (moreActive ? 'active' : '')} aria-current={moreActive ? 'page' : undefined}><Icon name="more" size={22} stroke={3} />{t('app.nav.more')}</NavLink>
      </nav>
    </div>
  );
}

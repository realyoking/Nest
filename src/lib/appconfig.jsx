// Admin-managed app config on the client (Run 8b): feature flags, maintenance, sign-up switch, default language / theme,
// and this user's announcements — from GET /api/app/config (api/_admin.js). The server enforces everything again
// (flags, maintenance, suspension); this only shapes the UI. Refreshes on start, every 10 min and when the app returns
// to the foreground. Fails open (defaults) when the request fails, so a network hiccup never hides features.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { readConfig, publicConfig } from './admin-config.js';
import { useSession } from './session.jsx';
import { pathLang, useI18n } from './i18n.jsx';
import { detectLang } from './langs.js';
import * as be from './backend.js';
import { SIGNED_OUT_KEY } from './gate-errors.js';

const Ctx = createContext(null);
const DEF = { ...publicConfig({}), announcements: [], suspended: false, signupBlocked: false, admin: false, loaded: false };

// Feature for an /app path (nav + route guard).
export const PATH_FLAG = { agent: 'aiChat', tutor: 'tutor', quiz: 'quiz', store: 'pluginStore', studio: 'studio', transport: 'transport' };
export const flagForPath = (pathname) => PATH_FLAG[String(pathname || '').replace(/^\/app\/?/, '').split('/')[0]] || null;

export function AppConfigProvider({ children }) {
  const s = useSession();
  const { uiLang, setLang } = useI18n();
  const [st, setSt] = useState(DEF);
  const uid = s.user?.uid || '';
  const busy = useRef(false);
  const load = useCallback(async () => {
    if (busy.current) return; busy.current = true;
    try {
      const token = uid ? await be.getIdToken().catch(() => '') : '';
      const r = await fetch(`/api/app/config?lang=${encodeURIComponent(uiLang || 'zh-Hant')}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      const d = await r.json();
      if (d && d.flags) setSt({ ...DEF, ...d, flags: readConfig({ flags: d.flags }).flags, announcements: Array.isArray(d.announcements) ? d.announcements : [], loaded: true });
    } catch { setSt((x) => ({ ...x, loaded: true })); } finally { busy.current = false; }
  }, [uid, uiLang]);
  useEffect(() => { load(); const iv = setInterval(load, 10 * 60e3); const f = () => document.visibilityState === 'visible' && load(); document.addEventListener('visibilitychange', f); return () => { clearInterval(iv); document.removeEventListener('visibilitychange', f); }; }, [load]);
  useEffect(() => { const f = () => load(); window.addEventListener('nest:config-reload', f); return () => window.removeEventListener('nest:config-reload', f); }, [load]);
  // A gated server answer (src/lib/gate-errors.js reportGate): session_revoked → sign out on this device and explain on
  // the sign-in page; anything else → re-read the config so the block screen / hidden nav matches the server.
  useEffect(() => {
    const f = (ev) => {
      const code = ev.detail?.code;
      if (code === 'session_revoked') {
        try { sessionStorage.setItem(SIGNED_OUT_KEY, code); } catch {}
        Promise.resolve(be.signOut()).catch(() => {});
        return;
      }
      if (code === 'account_disabled') setSt((x) => ({ ...x, suspended: true }));
      else if (code === 'maintenance') setSt((x) => ({ ...x, maintenance: { ...(x.maintenance || {}), on: true, msg: ev.detail?.message ? { 'zh-Hant': ev.detail.message, 'zh-Hans': ev.detail.message, en: ev.detail.message } : x.maintenance?.msg || {} } }));
      else if (code === 'signup_closed') setSt((x) => ({ ...x, signupBlocked: true }));
      load();
    };
    window.addEventListener('nest:gate', f); return () => window.removeEventListener('nest:gate', f);
  }, [load]);
  // Admin default language: only for a device + account that never chose one (no saved nest.lang, no profile prefs.lang).
  useEffect(() => {
    if (!st.loaded || !st.defaults?.lang) return;
    let saved = null; try { saved = localStorage.getItem('nest.lang'); } catch {}
    // Run 12: a localized URL (/en/, /zh-hant/, /zh-hans/) always wins — live /en/ turned Chinese on fresh devices.
    if (pathLang()) return;
    // Run 14: '/' follows the browser language when it is one of the 12 (the admin default is only for unmatched browsers).
    if (detectLang(undefined, '')) return;
    if (!saved && !s.profile?.prefs?.lang && st.defaults.lang !== uiLang) setLang(st.defaults.lang, { silent: true });
  }, [st.loaded, st.defaults?.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const event = useCallback(async (id, ev) => {
    if (ev === 'dismiss' || ev === 'never') setSt((x) => ({ ...x, announcements: x.announcements.filter((a) => a.id !== id) }));
    if (ev === 'seen') { const k = `nest.annSeen.${id}`; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1'); } catch {} }
    if (!uid) return;
    try { const token = await be.getIdToken(); await fetch('/api/app/ann', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ id, ev }) }); } catch {}
  }, [uid]);
  const value = useMemo(() => ({ ...st, flag: (k) => st.admin || st.flags?.[k] !== false, reload: load, event }), [st, load, event]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAppConfig() {
  return useContext(Ctx) || { ...DEF, flag: () => true, reload: () => {}, event: () => {} };
}

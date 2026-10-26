// Plugin runtime: installed plugins (users/{uid}.plugins, owner-only profile), their bundles (server, cached per device),
// theme application (sanitized CSS variables / whitelisted fonts / Nest-built backgrounds only), tabs, Home widgets,
// background automations, and the postMessage host for sandboxed iframes.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from '../session.jsx';
import { useBe } from '../be-context.jsx';
import { useI18n } from '../i18n.jsx';
import { useToast } from '../../components/ui.jsx';
import { buildSrcdoc, SANDBOX_FLAGS } from './sandbox.js';
import { validateMessage, gate, RateLimiter, pluginStorage } from './bridge.js';
import { themeFor, settingsValues, newPermissions, pName, LIMITS } from './manifest.js';
import { sanitizeTheme, mergeThemes, backgroundCss, fontStack, FONTS, THEME_VARS } from './theme.js';
import * as API from './api.js';
import { loadEvents } from '../calendar.js';
import { streamChat } from '../ai.js';
import { plainMemories } from '../memory.js';
import { listSubs } from '../subs-api.js';
import { hkGet, goItemKey } from '../hk.js';
import { stationName } from '../transit.js';
import { shapeMemories, shapeQuiz, shapeNotices, shapeBills, shapeTransport, logKey, logEntry, pruneLog } from './data.js';
import { PluginAskHost } from '../../components/PluginAsk.jsx';

const Ctx = createContext({ ready: false, list: [], active: [], tabs: [], widgets: [], installed: {}, bundles: {}, enabled: false });
export const usePlugins = () => useContext(Ctx);

const cacheKey = (uid) => `nest.plug.b.${uid}`;
const jsThemeKey = (uid, pid) => `nest.plug.jst.${uid}.${pid}`;
const storeNs = (uid, pid) => `nest.plug.s.${uid}.${pid}`;
// Reminder ids a plugin created (it may only update / delete those).
const ownKey = (uid, pid) => `nest.plug.own.${uid}.${pid}`;
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const rand = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, '0')).join('');

export function PluginProvider({ children }) {
  const { be, demo } = useBe();
  const s = useSession();
  const uid = s.user?.uid;
  const enabled = !demo && !!uid;
  const installed = useMemo(() => (enabled ? s.profile?.plugins || {} : {}), [enabled, s.profile?.plugins]);
  const [bundles, setBundles] = useState(() => (uid ? readJSON(cacheKey(uid), {}) : {}));
  const [ready, setReady] = useState(false);
  const [jsThemes, setJsThemes] = useState({});
  const [tabTitles, setTabTitles] = useState({});
  const ids = Object.keys(installed).sort().join(',');

  // Fetch bundles for everything installed (approved live version, or the creator's own draft for dev installs).
  const refresh = useCallback(async () => {
    if (!enabled) return;
    const want = Object.entries(installed).map(([id, x]) => ({ id, dev: !!x?.dev, v: x?.v }));
    if (!want.length) { setBundles({}); setReady(true); return; }
    try {
      const { bundles: got } = await API.fetchBundles(want);
      setBundles((cur) => {
        const next = { ...cur };
        for (const [id, b] of Object.entries(got || {})) next[id] = b;
        for (const id of Object.keys(next)) if (!installed[id]) delete next[id];
        try { localStorage.setItem(cacheKey(uid), JSON.stringify(next)); } catch {}
        return next;
      });
    } catch {} finally { setReady(true); }
  }, [enabled, ids, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!enabled) return undefined;
    const f = () => setJsThemes(Object.fromEntries(Object.keys(installed).map((pid) => [pid, readJSON(jsThemeKey(uid, pid), null)]).filter(([, v]) => v)));
    f(); window.addEventListener('nest:plugin-theme', f);
    return () => window.removeEventListener('nest:plugin-theme', f);
  }, [enabled, ids, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(() => Object.entries(installed).map(([id, st]) => {
    const b = bundles[id];
    const m = b?.manifest || null;
    const needs = m ? newPermissions(m, st?.perms || [], st?.denied || []) : [];
    const status = !b ? 'loading' : b.removed ? 'removed' : needs.length ? 'needs_approval' : st?.on === false ? 'off' : 'on';
    return { id, state: st || {}, bundle: b, manifest: m, status, needs, settings: m ? settingsValues(m, st?.settings || {}) : {} };
  }).sort((a, b) => (a.state.at || 0) - (b.state.at || 0)), [installed, bundles]);
  const active = useMemo(() => list.filter((p) => p.status === 'on'), [list]);

  // ---- theme ----
  const theme = useMemo(() => mergeThemes(active.flatMap((p) => [themeFor(p.manifest, p.settings), jsThemes[p.id] ? sanitizeTheme(jsThemes[p.id], p.manifest.capabilities) : null])), [active, jsThemes]);
  const themeSig = JSON.stringify(theme);
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.documentElement;
    const set = [];
    for (const [k, v] of Object.entries(theme.vars || {})) if (THEME_VARS[k]) { root.style.setProperty(k, v); set.push(k); }
    for (const [prop, f] of [['--font', theme.font], ['--display', theme.headingFont || theme.font]]) {
      const stack = f && fontStack(f);
      if (stack) { root.style.setProperty(prop, stack); set.push(prop); }
    }
    for (const f of [theme.font, theme.headingFont]) {
      if (f && FONTS[f] && !document.getElementById(`plugfont-${f.replace(/\W/g, '')}`)) {
        const l = document.createElement('link'); l.rel = 'stylesheet'; l.id = `plugfont-${f.replace(/\W/g, '')}`;
        l.href = `https://fonts.googleapis.com/css2?family=${FONTS[f]}&display=swap`; document.head.appendChild(l);
      }
    }
    const bg = backgroundCss(theme.background);
    if (bg) { root.style.setProperty('--plug-bg', bg); root.classList.add('plug-bg'); set.push('--plug-bg'); }
    if (theme.scheme) { root.dataset.plugScheme = theme.scheme; root.dataset.theme = theme.scheme; }
    return () => {
      set.forEach((k) => root.style.removeProperty(k));
      root.classList.remove('plug-bg');
      if (root.dataset.plugScheme) { delete root.dataset.plugScheme; window.dispatchEvent(new Event('nest:theme-reapply')); }
    };
  }, [themeSig, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- actions ----
  const toast = useToast();
  const writeState = (id, patch) => be.saveProfile(uid, { plugins: { [id]: { ...(installed[id] || {}), ...patch } } });
  const install = useCallback(async (id, opts = {}) => {
    const r = await API.installPlugin(id, opts);
    setBundles((cur) => { const next = { ...cur, [id]: r.bundle }; try { localStorage.setItem(cacheKey(uid), JSON.stringify(next)); } catch {} return next; });
    await be.saveProfile(uid, { plugins: { [id]: { on: true, v: r.bundle.v, perms: r.granted || [], settings: installed[id]?.settings || {}, at: installed[id]?.at || Date.now(), dev: !!opts.dev } } });
    return r;
  }, [uid, installed]); // eslint-disable-line react-hooks/exhaustive-deps
  const uninstall = useCallback(async (id) => {
    await API.uninstallPlugin(id).catch(() => {});
    await be.deleteProfileKeys(uid, [`plugins.${id}`]);
    try { localStorage.removeItem(storeNs(uid, id)); localStorage.removeItem(jsThemeKey(uid, id)); } catch {}
    window.dispatchEvent(new Event('nest:plugin-theme'));
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const setOn = (id, on) => writeState(id, { on });
  // Revoke / re-allow single permissions (implied ones too). The bridge gate refuses revoked ones.
  const setDenied = (id, denied) => writeState(id, { denied: [...new Set(denied)].slice(0, 40) });
  const setSettings = (id, values) => {
    const m = bundles[id]?.manifest;
    return be.saveProfile(uid, { plugins: { [id]: { ...(installed[id] || {}), settings: settingsValues(m, values) } } });
  };

  const tabs = useMemo(() => active.filter((p) => p.manifest.capabilities.includes('tab')).map((p) => ({ id: p.id, title: tabTitles[p.id] || p.manifest.tab?.title, titleZh: tabTitles[p.id] || p.manifest.tab?.titleZh, icon: p.manifest.tab?.icon || 'sparkle' })), [active, tabTitles]);
  const widgets = useMemo(() => active.filter((p) => p.manifest.capabilities.includes('widget')), [active]);
  const autos = useMemo(() => active.filter((p) => p.manifest.capabilities.includes('automation')), [active]);
  // Confirmation / photo sheets shown by Nest itself (never inside the plugin's iframe). ask(spec) → Promise.
  const [asks, setAsks] = useState([]);
  const ask = useCallback((spec) => new Promise((resolve, reject) => {
    setAsks((l) => { if (l.length >= 3) { reject(new Error('busy')); return l; } return [...l, { ...spec, key: rand(), resolve, reject }]; });
  }), []);
  const closeAsk = (key) => setAsks((l) => l.filter((x) => x.key !== key));
  // Activity log (owner-only profile map): what a plugin wrote and when — shown in Settings → the plugin.
  const logWrite = useCallback(async (pid, method, summary) => {
    if (!enabled) return;
    const k = logKey();
    try {
      await be.saveProfile(uid, { pluginLog: { [k]: logEntry(pid, method, summary) } });
      const old = pruneLog({ ...(s.profile?.pluginLog || {}), [k]: { at: Date.now() } }, 100);
      if (old.length) await be.deleteProfileKeys(uid, old.map((x) => `pluginLog.${x}`));
    } catch {}
  }, [enabled, uid, s.profile?.pluginLog]); // eslint-disable-line react-hooks/exhaustive-deps
  const value = { enabled, ready, list, active, tabs, widgets, installed, bundles, install, uninstall, setOn, setDenied, setSettings, refresh, setTabTitle: (id, t) => setTabTitles((x) => ({ ...x, [id]: t })), toast, ask, logWrite };
  return (
    <Ctx.Provider value={value}>
      {children}
      {asks[0] && <PluginAskHost key={asks[0].key} spec={asks[0]} onDone={(v) => { asks[0].resolve(v); closeAsk(asks[0].key); }} onCancel={() => { asks[0].reject(new Error('cancelled')); closeAsk(asks[0].key); }} />}
      {enabled && autos.map((p) => <AutomationRunner key={`${p.id}:${p.bundle.v}`} p={p} />)}
    </Ctx.Provider>
  );
}

// Automations run headless once per app session (≤ 30 s), e.g. a reminder pack that creates the next reminders.
function AutomationRunner({ p }) {
  const s = useSession();
  const key = `nest.plug.ran.${s.user?.uid}.${p.id}.${p.bundle.v}`;
  const [run, setRun] = useState(() => !sessionStorage.getItem(key));
  useEffect(() => {
    if (!run) return undefined;
    sessionStorage.setItem(key, '1');
    const t = setTimeout(() => setRun(false), 30e3);
    return () => clearTimeout(t);
  }, [run]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!run) return null;
  return <SandboxFrame p={p} surface="background" hidden />;
}

// First snapshot of a watch* subscription, then unsubscribe (≤ 6 s).
const once = (subscribe) => new Promise((resolve) => {
  let off = null; let done = false;
  const fin = (v) => { if (done) return; done = true; resolve(v || []); setTimeout(() => { try { off?.(); } catch {} }, 0); };
  off = subscribe(fin);
  setTimeout(() => fin([]), 6000);
});
const whenText = (ev) => {
  if (!ev?.start) return '';
  const o = ev.allDay ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' };
  try { return new Intl.DateTimeFormat('zh-HK', { timeZone: 'Asia/Hong_Kong', ...o }).format(new Date(ev.start)); } catch { return ''; }
};
// Sample data for the Studio preview (the preview never reads the creator's real records or accounts).
const SAMPLE = {
  memory: [{ id: 'm1', text: '小明對花生敏感', tag: 'health', at: Date.now() - 864e5, mine: false }],
  study: [{ topic: 'Fractions', score: 8, total: 10, at: Date.now() - 864e5 }],
  notices: [{ kind: 'notice', title: '家長日回條', date: new Date(Date.now() + 3 * 864e5 + 8 * 3600e3).toISOString().slice(0, 10), time: '', needsReply: true, done: false }],
  bills: { subscriptions: [{ service: 'Netflix', amount: 93, currency: 'HKD', cycle: 'monthly', renewDate: new Date(Date.now() + 5 * 864e5 + 8 * 3600e3).toISOString().slice(0, 10) }], bills: [{ payee: 'CLP 中電', amount: 412.5, date: new Date(Date.now() + 9 * 864e5 + 8 * 3600e3).toISOString().slice(0, 10), paid: false }] },
  transport: [{ type: 'bus', company: 'KMB', route: '1A', stop: 'Sample stop', to: 'Star Ferry', minutes: [3, 11, 19], status: 'ok' }],
  gmail: [{ from: 'School Office', subject: 'Parents’ day reply slip', snippet: 'Please return the reply slip by Friday.', date: Date.now() - 3600e3, unread: true }],
  classroom: [{ course: 'S3 English', title: 'Book report', due: Date.now() + 2 * 864e5, late: false }],
};

// Hash a uid per plugin so plugins never see real ids.
const shortId = (pid, uid) => { let h = 2166136261; for (const c of `${pid}|${uid}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const currentVars = () => {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const k of [...Object.keys(THEME_VARS), '--font', '--display']) { const v = cs.getPropertyValue(k).trim(); if (v) out[k] = v; }
  return out;
};

// One sandboxed plugin surface. sandbox="allow-scripts" only — NEVER allow-same-origin.
export function SandboxFrame({ p, surface, hidden = false, className = '', minHeight = 60, maxHeight = 480, fill = false, preview = false, previewBundle, onEvent }) {
  const { be, demo } = useBe();
  const s = useSession();
  const { lang, t } = useI18n();
  const toast = useToast();
  const plug = usePlugins();
  const ref = useRef(null);
  const loads = useRef(0);
  const [killed, setKilled] = useState(false);
  const [h, setH] = useState(p?.manifest?.widget?.height || minHeight);
  const bundle = previewBundle || p.bundle;
  const manifest = bundle.manifest;
  const settings = p.settings || settingsValues(manifest, {});
  const granted = preview ? (p.granted || []) : (p.state?.perms || []);
  // Permissions the user revoked in Settings (implied ones included) — the gate blocks them.
  const denied = preview ? [] : (Array.isArray(p.state?.denied) ? p.state.denied : []);
  // Network domains only when `network` was granted and not revoked (CSP connect-src / img-src).
  const domains = (manifest.permissions || []).includes('network') && (preview || granted.includes('network')) && !denied.includes('network') ? (manifest.network?.domains || []) : [];
  const uid = s.user?.uid || 'anon';
  const channel = useMemo(rand, [bundle, surface]);
  const scheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  const ctx = useMemo(() => ({ lang, surface, scheme, pluginId: manifest.id, settings, preview }), [lang, surface, scheme, manifest.id, JSON.stringify(settings), preview]); // eslint-disable-line react-hooks/exhaustive-deps
  const srcdoc = useMemo(() => buildSrcdoc(bundle, { channel, context: ctx, vars: currentVars(), origin: location.origin, domains }), [bundle, channel, ctx, domains.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loads.current = 0; setKilled(false); }, [srcdoc]);
  const limiter = useMemo(() => new RateLimiter(), [bundle]);
  const storage = useMemo(() => pluginStorage(preview ? sessionStorage : localStorage, preview ? `nest.plug.preview.${manifest.id}` : storeNs(uid, manifest.id), LIMITS.storage), [uid, manifest.id, preview]);
  const live = useRef({}); live.current = { s, plug, toast, lang };

  useEffect(() => {
    const reply = (msg) => { try { ref.current?.contentWindow?.postMessage({ nest: 1, ch: channel, ...msg }, '*'); } catch {} };
    const askOk = async (kind, info) => {
      const ok = await live.current.plug.ask({ kind, name: pName(manifest, live.current.lang), icon: manifest.icon, info }).catch(() => false);
      if (!ok) throw new Error('cancelled');
    };
    const handlers = {
      'context.get': () => ctx,
      'settings.get': () => settings,
      'ui.resize': ({ height }) => { if (!fill) setH(Math.max(minHeight, Math.min(maxHeight, height))); return true; },
      'ui.toast': ({ text }) => { if (text) live.current.toast(`${pName(manifest, live.current.lang)}: ${text}`); return true; },
      'ui.addTab': ({ title }) => { if (!preview && title) live.current.plug.setTabTitle?.(manifest.id, title); return true; },
      'theme.set': (th) => {
        const clean = sanitizeTheme(th, manifest.capabilities);
        if (preview) { onEvent?.('theme', clean); return clean; }
        localStorage.setItem(jsThemeKey(uid, manifest.id), JSON.stringify(clean)); window.dispatchEvent(new Event('nest:plugin-theme')); return clean;
      },
      'theme.reset': () => { if (!preview) { localStorage.removeItem(jsThemeKey(uid, manifest.id)); window.dispatchEvent(new Event('nest:plugin-theme')); } else onEvent?.('theme', null); return true; },
      'storage.get': ({ key }) => storage.get(key),
      'storage.set': ({ key, value }) => storage.set(key, value),
      'storage.remove': ({ key }) => storage.remove(key),
      'storage.keys': () => storage.keys(),
      'reminders.list': () => live.current.s.reminders.slice(0, 60).map((r) => ({ id: r.id, title: r.title, dueAt: r.dueAt ? +new Date(r.dueAt) : null, done: !!r.done })),
      'reminders.create': async ({ title, dueAt }) => {
        if (preview || demo || !live.current.s.family) { onEvent?.('reminder', { title, dueAt }); return { id: 'preview', preview: true }; }
        const dk = `nest.plug.rc.${uid}.${manifest.id}.${new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10)}`;
        const n = Number(localStorage.getItem(dk) || 0);
        if (n >= 30) throw new Error('daily_limit');
        const r = await be.addReminder(live.current.s.family.id, { title: title.slice(0, 120), dueAt: dueAt ? new Date(dueAt) : null, memberId: uid });
        localStorage.setItem(dk, String(n + 1));
        if (r?.id) { const own = readJSON(ownKey(uid, manifest.id), []); own.push(r.id); localStorage.setItem(ownKey(uid, manifest.id), JSON.stringify(own.slice(-200))); }
        return { id: r?.id || '' };
      },
      'reminders.update': async ({ id, fields }) => {
        if (preview || demo || !live.current.s.family) { onEvent?.('reminder', { id, ...fields }); return true; }
        if (!readJSON(ownKey(uid, manifest.id), []).includes(id)) throw new Error('not_own_reminder');
        const data = {};
        if (fields.title !== undefined) data.title = fields.title;
        if (fields.dueAt !== undefined) data.dueAt = fields.dueAt ? new Date(fields.dueAt) : null;
        if (fields.done !== undefined) data.done = fields.done;
        await be.updateReminder(live.current.s.family.id, id, data);
        return true;
      },
      'reminders.delete': async ({ id }) => {
        if (preview || demo || !live.current.s.family) { onEvent?.('reminder', { id, deleted: true }); return true; }
        const own = readJSON(ownKey(uid, manifest.id), []);
        if (!own.includes(id)) throw new Error('not_own_reminder');
        await be.deleteReminder(live.current.s.family.id, id);
        localStorage.setItem(ownKey(uid, manifest.id), JSON.stringify(own.filter((x) => x !== id)));
        return true;
      },
      'weather.get': async () => {
        const r = await fetch(`/api/hk/weather?lang=${live.current.lang === 'en' ? 'en' : 'tc'}`);
        if (!r.ok) throw new Error('weather_unavailable');
        const j = await r.json();
        const out = JSON.stringify(j); return out.length > 12000 ? JSON.parse(JSON.stringify({ now: j.now || j.current || null, forecast: (j.forecast || []).slice?.(0, 3) || null })) : j;
      },
      'ai.ask': async ({ prompt }) => {
        if (demo || be.MOCK) return { text: live.current.lang === 'en' ? '(Nest AI answers here.)' : '（Nest AI 會在這裏回答。）' };
        try {
          const text = await streamChat({ mode: 'assist', lang: live.current.lang, messages: [{ role: 'user', content: prompt }], context: { plugin: pName(manifest, 'en').slice(0, 40) }, onDelta: () => {} });
          return { text: String(text || '').slice(0, 4000) };
        } catch (e) { throw new Error(['limit_reached', 'account_disabled', 'maintenance', 'feature_disabled', 'session_revoked', 'signup_closed'].includes(e?.code) ? e.code : 'ai_error'); }
      },
      'location.get': () => new Promise((res, rej) => {
        if (!navigator.geolocation) { rej(new Error('location_unavailable')); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => res({ lat: Math.round(pos.coords.latitude * 100) / 100, lng: Math.round(pos.coords.longitude * 100) / 100, accuracyKm: 1 }),
          (e) => rej(new Error(e?.code === 1 ? 'location_denied' : 'location_unavailable')),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60e3 },
        );
      }),
      'clipboard.write': async ({ text }) => { await navigator.clipboard.writeText(text); live.current.toast(live.current.lang === 'en' ? 'Copied' : '已複製'); return true; },
      'links.open': ({ url }) => {
        const host = new URL(url).hostname;
        const ok = window.confirm(live.current.lang === 'en' ? `${pName(manifest, 'en')} wants to open ${host}.\n\n${url}` : `「${pName(manifest, live.current.lang)}」想開啟 ${host}。\n\n${url}`);
        if (!ok) throw new Error('cancelled');
        window.open(url, '_blank', 'noopener,noreferrer');
        return true;
      },
      'calendar.list': async ({ days }) => {
        if (preview || be.MOCK) return [];
        const now = Date.now();
        const r = await loadEvents(live.current.s.profile, now, now + days * 864e5);
        return (r.events || []).slice(0, 60).map((e) => ({ title: String(e.title || e.summary || '').slice(0, 120), start: e.startMs, end: e.endMs, allDay: !!e.allDay }));
      },
      // ---- data permissions (2026-10-18): minimal scoped data; writes confirmed + logged; account data via Nest's server ----
      'calendar.create': async (ev) => {
        if (preview || demo || be.MOCK) { onEvent?.('calendar.create', ev); return { id: 'preview', preview: true }; }
        await askOk('calendar.create', { title: ev.title, when: whenText(ev), place: ev.location });
        const r = await API.pluginData(manifest.id, 'calendar.create', ev);
        return { id: r.id };
      },
      'calendar.update': async ({ id, fields }) => {
        if (preview || demo || be.MOCK) { onEvent?.('calendar.update', { id, ...fields }); return true; }
        await API.pluginData(manifest.id, 'calendar.update', { id, fields });
        return true;
      },
      'calendar.delete': async ({ id }) => {
        if (preview || demo || be.MOCK) { onEvent?.('calendar.delete', { id }); return true; }
        await askOk('calendar.delete', {});
        await API.pluginData(manifest.id, 'calendar.delete', { id });
        return true;
      },
      'memory.list': ({ limit }) => (preview ? SAMPLE.memory : shapeMemories(plainMemories(live.current.s, live.current.s.prefs?.chatMemory !== false), limit, manifest.id)),
      'memory.add': async ({ text, tag }) => {
        if (preview || demo || !live.current.s.family) { onEvent?.('memory.add', { text, tag }); return { id: 'preview', preview: true }; }
        await askOk('memory.add', { text });
        const r = await be.addMemory(live.current.s.family.id, { text, ...(tag ? { tag } : {}), byPlugin: manifest.id });
        live.current.plug.logWrite?.(manifest.id, 'memory.add', text);
        return { id: r?.id || '' };
      },
      'study.list': async ({ limit }) => (preview || !live.current.s.family ? SAMPLE.study : shapeQuiz(await once((cb) => be.watchQuizResults(live.current.s.family.id, uid, cb)), limit)),
      'notices.list': async ({ limit }) => (preview || !live.current.s.family ? SAMPLE.notices : shapeNotices(await once((cb) => be.watchInbox(live.current.s.family.id, uid, cb)), limit)),
      'bills.list': async ({ limit }) => {
        if (preview || !live.current.s.family) return SAMPLE.bills;
        const [subs, inbox] = await Promise.all([listSubs({ demo }).catch(() => []), once((cb) => be.watchInbox(live.current.s.family.id, uid, cb))]);
        return shapeBills(subs, inbox, limit);
      },
      'transport.get': async () => {
        const items = live.current.s.profile?.hk?.goOut?.items || [];
        if (preview || be.MOCK) return SAMPLE.transport;
        if (!items.length) return [];
        const eta = await hkGet('eta', { items: items.slice(0, 6).map(goItemKey).join(',') }, { maxAge: 15e3 }).catch(() => ({}));
        return shapeTransport(items, eta, { keyOf: goItemKey, stationName, lang: live.current.lang });
      },
      'gmail.summary': async ({ limit }) => (preview || demo || be.MOCK ? { items: SAMPLE.gmail.slice(0, limit) } : { items: (await API.pluginData(manifest.id, 'gmail.summary', { limit })).items || [] }),
      'classroom.list': async ({ limit, days }) => (preview || demo || be.MOCK ? { items: SAMPLE.classroom.slice(0, limit) } : { items: (await API.pluginData(manifest.id, 'classroom.list', { limit, days })).items || [] }),
      'media.pickPhoto': async ({ maxSize, camera }) => {
        const r = await live.current.plug.ask({ kind: 'photo', name: pName(manifest, live.current.lang), icon: manifest.icon, maxSize, camera });
        return r;
      },
      'members.list': () => live.current.s.members.map((m) => ({ id: shortId(manifest.id, m.uid), initial: String(m.displayName || '?').trim().slice(0, 1).toUpperCase(), role: m.role === 'parent' ? 'parent' : 'student', isMe: m.uid === uid })),
      'notify.show': ({ title, body }) => { window.dispatchEvent(new CustomEvent('nest:inapp', { detail: { title: `${pName(manifest, live.current.lang)} · ${title}`, body } })); return true; },
    };
    const onMsg = async (e) => {
      // Only this iframe, and only an opaque (sandboxed) origin.
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      if (e.origin !== 'null') return;
      const v = validateMessage(e.data, channel);
      if (v.ignore) return;
      if (!v.ok) { reply({ id: v.id, ok: false, error: v.error }); return; }
      const g = gate(v.method, { manifest, granted, denied, surface });
      if (g) { reply({ id: v.id, ok: false, error: g }); return; }
      if (!limiter.take(v.method)) { reply({ id: v.id, ok: false, error: 'rate_limited' }); return; }
      if (typeof handlers[v.method] !== 'function') { reply({ id: v.id, ok: false, error: 'not_supported' }); return; }
      try { reply({ id: v.id, ok: true, result: await handlers[v.method](v.params) }); }
      catch (err) { reply({ id: v.id, ok: false, error: String(err?.message || 'error').slice(0, 60) }); }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [channel, manifest, JSON.stringify(granted), JSON.stringify(denied), surface, storage, limiter, ctx, preview]); // eslint-disable-line react-hooks/exhaustive-deps

  if (killed) return <p className="plug-killed small">{t('plug.killed')}</p>;
  return (
    <iframe
      ref={ref}
      title={pName(manifest, lang)}
      className={`plug-frame ${fill ? 'fill' : ''} ${className}`}
      sandbox={SANDBOX_FLAGS}
      srcDoc={srcdoc}
      referrerPolicy="no-referrer"
      allow=""
      style={hidden ? { display: 'none' } : fill ? undefined : { height: h }}
      aria-hidden={hidden || undefined}
      // A sandboxed document can still navigate ITSELF; the second load event means it left its srcdoc → tear it down.
      onLoad={() => { loads.current += 1; if (loads.current > 1) setKilled(true); }}
    />
  );
}

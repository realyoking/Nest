import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useBe } from './be-context.jsx';
import { prefsOf } from './prefs.js';
import { dayKey, weekKey, planOf, pctOf, nextDayReset, nextWeekReset, PLANS } from './plans.js';
import { pingPlan } from './promo.js';
import { effectivePlan, planLabelParts, parsePlanHeader } from './plan-resolve.js';
import { useI18n, LANG_IDS } from './i18n.jsx';
import { avatarSrc } from './avatar.js';
import { insightLines } from './insights.js';
import { dueTag } from './chatctx.js';
import { plainMemories, knowledgeLines, personalLines } from './memory.js';
import { fetchBadges, profileMe } from './plugins/api.js';
import { cachedGithub } from './github.js';

// Admin entry points are shown only when the server says so: GET /api/admin/whoami re-checks the verified email
// against NEST_ADMIN_EMAILS server-side and answers 404 to everyone else. No admin address is shipped in the bundle.
export const OFFICIAL_ADMIN_EMAIL = 'nest@official.heynest.invalid';
const ADMIN_CACHE = 'nest.adm.'; // sessionStorage cache of the server's answer per uid (avoids a flicker on reload)

const Ctx = createContext(null);

// ONE effective-plan resolution for every badge and limit in the app — the same module the server uses
// (src/lib/plan-resolve.js). Re-exported here for older imports.
export { effectivePlan };

export function SessionProvider({ children }) {
  const { be, demo } = useBe();
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  const [family, setFamily] = useState(undefined);
  const [members, setMembers] = useState([]);
  const EMPTY = { count: 0, perMember: {} };
  const [uDay, setUDay] = useState(EMPTY);
  const [uWeek, setUWeek] = useState(EMPTY);
  // Usage docs are keyed by Hong Kong day / ISO week; re-key when the clock crosses midnight HKT.
  const [dk, setDk] = useState(dayKey);
  useEffect(() => { const i = setInterval(() => setDk(dayKey()), 30000); return () => clearInterval(i); }, []);
  const [reminders, setReminders] = useState([]);
  const [memories, setMemories] = useState([]);

  useEffect(() => be.onAuth((u) => { setUser(u || null); if (!u) { setProfile(null); setFamily(null); } }), []);
  // Run 18: the Firebase user object is mutated in place by reload() (emailVerified) — bump a nonce so gates re-render.
  // Server-checked admin flag (see OFFICIAL_ADMIN_EMAIL above). Only verified, non-demo, real-backend users ask.
  const [srvAdmin, setSrvAdmin] = useState(false);
  useEffect(() => {
    const uid = user?.uid;
    if (demo || be.MOCK || !uid || user.emailVerified !== true || !be.getIdToken) { setSrvAdmin(false); return undefined; }
    let live = true;
    const key = ADMIN_CACHE + uid;
    let cached = null;
    try { cached = sessionStorage.getItem(key); } catch { /* storage blocked */ }
    setSrvAdmin(cached === '1');
    if (cached !== null) return undefined;
    (async () => {
      try {
        const token = await be.getIdToken();
        const r = await fetch('/api/admin/whoami', { headers: { authorization: `Bearer ${token}` } });
        if (!live) return;
        const ok = r.ok;
        setSrvAdmin(ok);
        if (ok || r.status === 404 || r.status === 401) { try { sessionStorage.setItem(key, ok ? '1' : '0'); } catch { /* ignore */ } }
      } catch { if (live) setSrvAdmin(false); }
    })();
    return () => { live = false; };
  }, [user?.uid, user?.emailVerified, demo]);
  const [userNonce, setUserNonce] = useState(0);
  useEffect(() => { const f = () => setUserNonce((n) => n + 1); window.addEventListener('nest:user-reloaded', f); return () => window.removeEventListener('nest:user-reloaded', f); }, []);
  // Run 23b: hard reload of /app sometimes stayed on the boot splash (a first snapshot that never arrived).
  // Watchdog: still loading 6 s after sign-in → re-subscribe (at most twice).
  const [subNonce, setSubNonce] = useState(0);
  useEffect(() => {
    if (!user) return;
    setProfile(undefined);
    return be.watchProfile(user.uid, (p) => setProfile(p || {}));
  }, [user?.uid, subNonce]);
  const fid = profile?.familyId || null;
  useEffect(() => {
    if (!user || profile === undefined) return;
    if (!fid) { setFamily(null); setMembers([]); return; }
    setFamily(undefined);
    const offs = [
      be.watchFamily(fid, (f) => setFamily(f && (f.memberIds || []).includes(user.uid) ? f : null), () => setFamily(null)),
      be.watchMembers(fid, setMembers),
      be.watchReminders(fid, setReminders),
      be.watchMemories(fid, setMemories),
    ];
    return () => offs.forEach((o) => o && o());
  }, [user?.uid, fid, profile === undefined, subNonce]);
  const stuck = !!user && (profile === undefined || (!!fid && family === undefined));
  useEffect(() => {
    if (!stuck || subNonce >= 2) return undefined;
    const tm = setTimeout(() => setSubNonce((n) => n + 1), 6000);
    return () => clearTimeout(tm);
  }, [stuck, subNonce]);
  // Language: saved on the profile (prefs.lang) whenever the user picks one; a device without a saved choice adopts the profile's.
  const { setLang: setUiLang } = useI18n() || {};
  useEffect(() => {
    if (demo || !user) return undefined;
    const f = (e) => { if (LANG_IDS.includes(e.detail)) be.saveProfile(user.uid, { prefs: { lang: e.detail } }).catch(() => {}); };
    window.addEventListener('nest:lang', f);
    return () => window.removeEventListener('nest:lang', f);
  }, [user?.uid, demo]);
  useEffect(() => {
    const pl = profile?.prefs?.lang;
    let has = true; try { has = !!localStorage.getItem('nest.lang'); } catch {}
    if (!demo && !has && LANG_IDS.includes(pl)) setUiLang?.(pl, { silent: true });
  }, [profile?.prefs?.lang, demo]);
  // Effective plan from the server (beta gift / admin grant → Pro for the whole family until a date).
  // Cached per family so the banner shows instantly; refreshed on load and after a claim (refreshPlan).
  const [planInfo, setPlanInfo] = useState(null);
  const [planNonce, setPlanNonce] = useState(0);
  useEffect(() => {
    if (demo || be.MOCK || !user || !fid || !be.getIdToken) { setPlanInfo(null); return; }
    const ck = `nest.plan.${fid}`;
    // Cached answer shows instantly, but only if it is still valid (an expired grant in the cache is ignored).
    try { const c = JSON.parse(localStorage.getItem(ck) || 'null'); setPlanInfo(c && c.plan ? c : null); } catch { setPlanInfo(null); }
    let live = true; let tries = 0; let retryT = 0;
    const ask = () => pingPlan(be.getIdToken).then((d) => {
      if (!live) return;
      const v = { plan: d.plan, source: d.source, until: d.until, base: d.base, betaUntil: d.betaUntil, grantUntil: d.grantUntil, ended: d.ended, attToday: Number(d.attToday) || 0, attDay: dk, at: Date.now() };
      setPlanInfo(v); try { localStorage.setItem(ck, JSON.stringify(v)); } catch {}
    }).catch(() => {
      // Never fall back to a guessed plan: retry a few times; only then the family's own plan is shown.
      if (!live) return;
      if (++tries < 4) retryT = setTimeout(ask, 2000 * tries); // after that the plan stays "…" until the next focus / poll
    });
    ask();
    const again = () => { if (document.visibilityState === 'visible') setPlanNonce((n) => n + 1); };
    document.addEventListener('visibilitychange', again);
    // Grant / gift changes (admin, beta claim, expiry) show up within 10 minutes even if the tab never loses focus.
    const poll = setInterval(again, 10 * 60e3);
    // Every /api/chat answer carries the server's resolution (x-nest-plan) → instant sync after a grant change.
    const onHdr = (e) => {
      const x = parsePlanHeader(e.detail); if (!x || !live) return;
      setPlanInfo((p) => { const v = { ...(p || {}), ...x, at: Date.now() }; try { localStorage.setItem(ck, JSON.stringify(v)); } catch {} return v; });
    };
    window.addEventListener('nest:plan', onHdr);
    window.addEventListener('nest:promo', again);
    return () => { live = false; clearTimeout(retryT); clearInterval(poll); document.removeEventListener('visibilitychange', again); window.removeEventListener('nest:plan', onHdr); window.removeEventListener('nest:promo', again); };
  }, [user?.uid, fid, planNonce, demo]);
  // Unified public profile (handle / verified) + verified badges of family members. Demo (landing) never calls the API.
  const [badges, setBadges] = useState({});
  const [pubProfile, setPubProfile] = useState(undefined);
  const [profNonce, setProfNonce] = useState(0);
  const memberKey = members.map((m) => m.uid).sort().join(',');
  useEffect(() => {
    if (demo || !user) { setBadges({}); return undefined; }
    let live = true;
    fetchBadges([user.uid, ...members.map((m) => m.uid)]).then((b) => { if (live) setBadges(b || {}); }).catch(() => {});
    return () => { live = false; };
  }, [user?.uid, memberKey, profNonce, demo]);
  useEffect(() => {
    if (demo || !user) { setPubProfile(null); return undefined; }
    let live = true;
    profileMe().then((d) => { if (live) setPubProfile(d.profile || null); }).catch(() => { if (live) setPubProfile(null); });
    return () => { live = false; };
  }, [user?.uid, profNonce, demo]);
  useEffect(() => {
    if (!user || !fid) return;
    const offs = [be.watchUsage(fid, dk, setUDay), be.watchUsage(fid, weekKey(), setUWeek)];
    return () => offs.forEach((o) => o && o());
  }, [user?.uid, fid, dk]);

  const value = useMemo(() => {
    let status = 'loading';
    if (user === null) status = 'out';
    else if (user && profile !== undefined && family !== undefined) status = family && profile.onboarded ? 'ready' : 'onboarding';
    const me = members.find((m) => m.uid === user?.uid);
    const eff = effectivePlan(family, planInfo, Date.now(), { assumeKnown: demo || !!be.MOCK });
    const { basePlan, plan, gift } = eff;
    const memberName = (uid) => members.find((m) => m.uid === uid)?.displayName || '';
    // Profile pictures: own one from the owner-only profile copy when present (works even if the member-doc write
    // was refused), everyone else's from their member doc.
    const myPhoto = profile && typeof profile.avatar === 'string' ? avatarSrc(profile.avatar) : avatarSrc(me?.photoURL);
    const photoOf = (uid) => (uid && uid === user?.uid ? myPhoto : avatarSrc(members.find((m) => m.uid === uid)?.photoURL));
    const isAdmin = !demo && !!user && ((user.emailVerified === true && srvAdmin) || String(user.email || '').toLowerCase() === OFFICIAL_ADMIN_EMAIL
      || (be.MOCK && typeof localStorage !== 'undefined' && localStorage.getItem('nest.mock.admin') === '1')); // mock screenshots only
    // Usage is shown as percentages only.
    const usage = {
      dayPct: pctOf(uDay.count || 0, plan.daily), weekPct: pctOf(uWeek.count || 0, plan.weekly),
      dayReset: nextDayReset(), weekReset: nextWeekReset(),
      weekTotal: uWeek.count || 0, weekPerMember: uWeek.perMember || {},
    };
    const prefs = prefsOf(profile);
    const savePrefs = (patch) => be.saveProfile(user.uid, { prefs: patch });
    const attToday = planInfo && planInfo.attDay === dk ? planInfo.attToday || 0 : 0;
    const isVerified = (uid) => !!badges[uid]?.v;
    const handleOf = (uid) => badges[uid]?.h || '';
    const refreshProfile = (p) => { if (p !== undefined) setPubProfile(p); setProfNonce((n) => n + 1); };
    return { status, user, profile, family, members, me, usage, attToday, reminders, memories, plan, basePlan, gift, planEff: eff, planKnown: eff.known, planLabel: (t) => planLabelParts(eff, t), refreshPlan: () => setPlanNonce((n) => n + 1), memberName, myPhoto, photoOf, isAdmin, prefs, savePrefs, isOwner: family?.ownerId === user?.uid,
      isVerified, handleOf, pubProfile, refreshProfile };
  }, [user, userNonce, profile, family, members, uDay, uWeek, dk, reminders, memories, be, planInfo, demo, badges, pubProfile, srvAdmin]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSession = () => useContext(Ctx);

// Context block the AI uses about this family.
export function aiContext(s, extra = {}) {
  // Dates go out as [[due:…]] tags; /api/chat turns them into "OVERDUE by 2 days" / "due in 2 days" on the server clock.
  const fmt = (d) => (d ? dueTag(d) : 'no date');
  const by = (m) => (m.createdBy && s.memberName(m.createdBy) ? ` (saved by ${s.memberName(m.createdBy)})` : '');
  const remember = s.prefs?.chatMemory !== false;
  return {
    family: s.family ? `${s.family.name}. Members: ${s.members.map((m) => `${m.displayName} (${m.role})`).join(', ')}` : '',
    me: s.me ? `${s.me.displayName} (${s.me.role})` : '',
    meBirthday: /^\d{4}-\d{2}-\d{2}$/.test(s.me?.birthday || '') ? s.me.birthday : '',
    memories: plainMemories(s, remember).map((m) => `${m.text}${by(m)}${m.about ? ` (about ${s.memberName(m.about) || m.about})` : ''}${m.cat ? ` [${m.cat}]` : ''}${m.exp ? ` (until ${m.exp})` : ''}`),
    knowledge: knowledgeLines(s),
    insights: insightLines(s),
    personal: remember ? personalLines(s.profile) : [],
    reminders: s.reminders.filter((r) => !r.done).sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity))
      .map((r) => `${r.title} — due ${fmt(r.dueAt)}${r.memberId ? ` — for ${s.memberName(r.memberId)}` : ''}`),
    ...extra,
  };
}

// Richer context for the agent: ids it can act on, members, current settings and connections.
export function agentContext(s, extra = {}) {
  const fmt = (d) => (d ? dueTag(d) : 'no date');
  const by = (m) => (m.createdBy && s.memberName(m.createdBy) ? ` (saved by ${s.memberName(m.createdBy)})` : '');
  const base = aiContext(s, extra);
  return {
    ...base,
    memories: plainMemories(s, s.prefs?.chatMemory !== false).slice(0, 80).map((m) => `[id:${m.id}] ${m.text}${by(m)}${m.about ? ` (about ${s.memberName(m.about) || m.about})` : ''}${m.cat ? ` [${m.cat}]` : ''}${m.tag ? ` (#${m.tag})` : ''}${m.exp ? ` (until ${m.exp})` : ''}`),
    reminders: [...s.reminders].sort((a, b) => (a.done - b.done) || ((a.dueAt || Infinity) - (b.dueAt || Infinity))).slice(0, 60)
      .map((r) => `[id:${r.id}] ${r.done ? '(done) ' : ''}${r.title} — due ${fmt(r.dueAt)} — for ${r.memberId ? s.memberName(r.memberId) : 'everyone'}`),
    members: s.members.map((m) => `[id:${m.uid}] ${m.displayName} (${m.role}${m.uid === s.family?.ownerId ? ', owner' : ''}${m.uid === s.user?.uid ? ', this is the user' : ''})`),
    isOwner: !!s.isOwner,
    settings: s.prefs,
    connectedSources: ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'].filter((g) => s.profile?.connections?.[g]),
    // GitHub (Run 13): only whether it is connected + the login — never a token (the browser never has one).
    github: (() => { const g = cachedGithub(); return g?.connected ? { connected: true, login: String(g.login || '').slice(0, 39) } : null; })(),
  };
}

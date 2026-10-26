// Admin-managed app configuration + announcements (Run 8b, 2026-10-19). Pure code shared by the server (api/_admin.js,
// api/chat.js, api/_plugins.js) and the client (AppConfig provider, admin panel) — unit-tested in test/admin.test.mjs.
//
// Storage (server only): the config doc of the system account nest-config@system.heynest.invalid (users/{uid}, readable
// only by that account), announcement images in nest-media@… , counts in the index doc (annStats). Per-user
// "dismissed / don't show again" lives on the user's own profile (users/{uid}.annState.{id}).
// The AI model is NOT configurable: it is always agnes-3.0-flash (MODEL below is informational and never read from config).

export const MODEL = 'agnes-3.0-flash';

// Feature flags. true = on. Enforced on the server (chat.js / _plugins.js / ops.js) and mirrored in the client UI.
export const FLAGS = {
  aiChat: { def: true, zh: 'AI 助理', en: 'AI Assistant' },
  tutor: { def: true, zh: '功課導師', en: 'Homework tutor' },
  quiz: { def: true, zh: '溫習測驗', en: 'Revision quiz' },
  wikipedia: { def: true, zh: '網上搜尋（事實及最新資料）', en: 'Web search (facts & latest info)' },
  visuals: { def: true, zh: '互動圖表及畫圖', en: 'Visuals and drawing' },
  attachments: { def: true, zh: '附件（相片／文件）', en: 'Attachments (photos / files)' },
  pluginStore: { def: true, zh: '插件商店', en: 'Plugin Store' },
  studio: { def: true, zh: '創作工作室', en: 'Creator Studio' },
  memoryFromChats: { def: true, zh: '從對話記住', en: 'Memory from chats' },
  transport: { def: true, zh: '交通', en: 'Transport' },
  github: { def: true, zh: 'GitHub 連接', en: 'GitHub connection' },
};
export const FLAG_KEYS = Object.keys(FLAGS);
export const PLAN_IDS = ['free', 'starter', 'pro'];
export const LANGS = ['zh-Hant', 'zh-Hans', 'en'];
export const THEMES = ['system', 'light', 'dark'];

export const DEFAULT_CONFIG = Object.freeze({
  flags: Object.fromEntries(FLAG_KEYS.map((k) => [k, FLAGS[k].def])),
  maintenance: { on: false, msg: { 'zh-Hant': '', 'zh-Hans': '', en: '' }, until: null },
  ai: { limits: {}, promptAdd: '' }, // limits: { free: {daily, weekly}, … } overrides (empty = plan defaults)
  signup: { open: true, closedAt: null },
  defaults: { lang: 'zh-Hant', theme: 'system' },
  rev: 0,
});

const s = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n) : '');
const int = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
const ms = (v) => { const x = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(x) && x > 0 ? x : null; };

// Full config with defaults filled in (anything unknown dropped).
export function readConfig(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const flags = { ...DEFAULT_CONFIG.flags };
  for (const k of FLAG_KEYS) if (typeof r.flags?.[k] === 'boolean') flags[k] = r.flags[k];
  const msg = {}; for (const l of LANGS) msg[l] = s(r.maintenance?.msg?.[l], 400);
  const limits = {};
  for (const p of PLAN_IDS) {
    const d = int(r.ai?.limits?.[p]?.daily, 1, 100000); const w = int(r.ai?.limits?.[p]?.weekly, 1, 700000);
    if (d || w) limits[p] = { ...(d ? { daily: d } : {}), ...(w ? { weekly: w } : {}) };
  }
  return {
    flags,
    maintenance: { on: r.maintenance?.on === true, msg, until: ms(r.maintenance?.until) },
    ai: { limits, promptAdd: s(r.ai?.promptAdd, 1500) },
    signup: { open: r.signup?.open !== false, closedAt: r.signup?.open === false ? ms(r.signup?.closedAt) : null },
    defaults: { lang: LANGS.includes(r.defaults?.lang) ? r.defaults.lang : 'zh-Hant', theme: THEMES.includes(r.defaults?.theme) ? r.defaults.theme : 'system' },
    rev: int(r.rev, 0, 1e9) || 0,
  };
}

// An admin patch → the next stored config (validated). `model` / `aiModel` keys are ignored on purpose.
export function applyConfigPatch(cur, patch = {}, now = Date.now()) {
  const c = readConfig(cur);
  const p = patch && typeof patch === 'object' ? patch : {};
  const next = JSON.parse(JSON.stringify(c));
  if (p.flags && typeof p.flags === 'object') for (const k of FLAG_KEYS) if (typeof p.flags[k] === 'boolean') next.flags[k] = p.flags[k];
  if (p.maintenance && typeof p.maintenance === 'object') {
    if (typeof p.maintenance.on === 'boolean') next.maintenance.on = p.maintenance.on;
    if (p.maintenance.msg) for (const l of LANGS) if (typeof p.maintenance.msg[l] === 'string') next.maintenance.msg[l] = s(p.maintenance.msg[l], 400);
    if ('until' in p.maintenance) next.maintenance.until = ms(p.maintenance.until);
  }
  if (p.ai && typeof p.ai === 'object') {
    if (typeof p.ai.promptAdd === 'string') next.ai.promptAdd = s(p.ai.promptAdd, 1500);
    if (p.ai.limits && typeof p.ai.limits === 'object') {
      for (const pl of PLAN_IDS) {
        const v = p.ai.limits[pl];
        if (v === null) { delete next.ai.limits[pl]; continue; }
        if (!v || typeof v !== 'object') continue;
        const d = int(v.daily, 1, 100000); const w = int(v.weekly, 1, 700000);
        if (d || w) next.ai.limits[pl] = { ...(d ? { daily: d } : {}), ...(w ? { weekly: w } : {}) }; else delete next.ai.limits[pl];
      }
    }
  }
  if (p.signup && typeof p.signup.open === 'boolean') { next.signup.open = p.signup.open; next.signup.closedAt = p.signup.open ? null : (c.signup.open ? now : c.signup.closedAt || now); }
  if (p.defaults) {
    if (LANGS.includes(p.defaults.lang)) next.defaults.lang = p.defaults.lang;
    if (THEMES.includes(p.defaults.theme)) next.defaults.theme = p.defaults.theme;
  }
  next.rev = (c.rev || 0) + 1;
  return next;
}

// Effective limits for a plan (admin override over the plan's own numbers).
export function limitsFor(plan, cfg) {
  const o = readConfig(cfg).ai.limits[plan?.id] || {};
  return { ...plan, daily: o.daily || plan.daily, weekly: o.weekly || plan.weekly };
}

// Public part of the config (what /api/app/config sends to every client).
export function publicConfig(cfg, { admin = false } = {}) {
  const c = readConfig(cfg);
  return { flags: c.flags, maintenance: { on: c.maintenance.on && !admin, msg: c.maintenance.msg, until: c.maintenance.until, bypass: c.maintenance.on && admin }, signup: { open: c.signup.open }, defaults: c.defaults, rev: c.rev };
}

// Which mode → which flag (server enforcement in api/chat.js).
export const MODE_FLAG = { chat: 'aiChat', tutor: 'tutor', quiz: 'quiz' };
export const flagOn = (cfg, k) => readConfig(cfg).flags[k] !== false;

// ---------------- announcements ----------------
export const ANN_STYLES = ['modal', 'banner', 'toast'];
export const ANN_AUDIENCE = ['all', 'plan', 'lang', 'new', 'user'];
export const ANN_MAX = 40;
const URL_OK = /^(https:\/\/[^\s<>"']{3,400}|\/(app|beta|pricing)(\/[^\s<>"']{0,200})?)$/;

// Admin input → stored announcement (or { error }).
export function cleanAnnouncement(a = {}, { now = Date.now(), by = '' } = {}) {
  const id = /^[a-z0-9]{6,24}$/.test(a.id || '') ? a.id : null;
  const text = {};
  for (const l of LANGS) {
    const t = a.text?.[l] || {};
    text[l] = { title: s(t.title, 120), body: s(t.body, 4000), cta: s(t.cta, 40) };
  }
  if (!text['zh-Hant'].title && !text.en.title) return { error: 'title_required' };
  const style = ANN_STYLES.includes(a.style) ? a.style : 'modal';
  const aud = a.audience && typeof a.audience === 'object' ? a.audience : {};
  const type = ANN_AUDIENCE.includes(aud.type) ? aud.type : 'all';
  const audience = { type };
  if (type === 'plan') { audience.plans = (Array.isArray(aud.plans) ? aud.plans : [aud.plan]).filter((p) => PLAN_IDS.includes(p)); if (!audience.plans.length) return { error: 'bad_audience' }; }
  if (type === 'lang') { audience.langs = (Array.isArray(aud.langs) ? aud.langs : [aud.lang]).filter((l) => LANGS.includes(l)); if (!audience.langs.length) return { error: 'bad_audience' }; }
  if (type === 'new') audience.days = int(aud.days, 1, 365) || 7;
  if (type === 'user') {
    audience.users = (Array.isArray(aud.users) ? aud.users : [aud.user]).map((x) => s(x, 160).trim().toLowerCase()).filter((x) => /^[A-Za-z0-9]{10,128}$/i.test(x) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).slice(0, 50);
    if (!audience.users.length) return { error: 'bad_audience' };
  }
  const start = ms(a.start) || null; const end = ms(a.end) || null;
  if (start && end && end <= start) return { error: 'bad_schedule' };
  const link = s(a.link, 400).trim();
  if (link && !URL_OK.test(link)) return { error: 'bad_link' };
  const status = ['draft', 'live', 'paused'].includes(a.status) ? a.status : 'draft';
  return {
    ann: {
      id, text, style, audience, start, end, link, status,
      dismissible: a.dismissible !== false, neverAgain: a.neverAgain !== false,
      priority: int(a.priority, 0, 100) ?? 50,
      img: /^[a-z0-9]{6,24}$/.test(a.img || '') ? a.img : (a.img === true ? true : null), // media id (set by the server)
      updatedAt: now, updatedBy: s(by, 120), createdAt: ms(a.createdAt) || now,
    },
  };
}

// u = { uid, email, plan, lang, createdAt }. state = the user's own annState ({ id: { d: dismissedAt, n: neverAgain } }).
export function annEligible(a, u = {}, now = Date.now()) {
  if (!a || a.status !== 'live') return false;
  if (a.start && now < a.start) return false;
  if (a.end && now >= a.end) return false;
  const au = a.audience || { type: 'all' };
  switch (au.type) {
    case 'all': return true;
    case 'plan': return (au.plans || []).includes(u.plan || 'free');
    case 'lang': return (au.langs || []).includes(u.lang || 'zh-Hant');
    case 'new': return !!u.createdAt && now - u.createdAt <= (au.days || 7) * 864e5;
    case 'user': return (au.users || []).some((x) => x === String(u.uid || '').toLowerCase() || x === String(u.email || '').toLowerCase());
    default: return false;
  }
}
// Announcements to show now, highest priority first. A dismissed one stays hidden for this session/day; "don't show
// again" hides it for good. A non-dismissible one always shows (it cannot be closed).
export function pickAnnouncements(list = [], u = {}, state = {}, now = Date.now()) {
  return (list || []).filter((a) => annEligible(a, u, now)).filter((a) => {
    const st = state?.[a.id];
    if (!a.dismissible) return true;
    if (st?.n) return false;
    if (st?.d && now - st.d < 20 * 3600e3) return false; // dismissed: back after ~a day unless "don't show again"
    return true;
  }).sort((a, b) => (b.priority || 0) - (a.priority || 0) || (b.updatedAt || 0) - (a.updatedAt || 0));
}
// The announcement text in the user's language (fallback zh-Hant → en).
export function annText(a, lang = 'zh-Hant') {
  const t = a?.text || {};
  const pick = (l) => (t[l]?.title ? t[l] : null);
  return pick(lang) || (lang === 'zh-Hans' ? pick('zh-Hant') : null) || pick('zh-Hant') || pick('en') || { title: '', body: '', cta: '' };
}
// What the client gets (no audience internals, no editor fields).
export function publicAnn(a) {
  return { id: a.id, text: a.text, style: a.style, link: a.link, dismissible: a.dismissible, neverAgain: a.neverAgain, priority: a.priority, img: a.img && a.img !== true ? a.img : null, start: a.start, end: a.end };
}

// ---------------- promo codes ----------------
// codes[CODE] = { months, max, plan:'pro', disabled, expires, note, at, by, uses: { fid: { uid, at, until } } }
// The built-in BETA code keeps its own ledger (promos.beta) — it can be disabled for NEW claims only; claims, counts
// and existing gifts are never edited here.
export function cleanCode(c = {}) {
  const code = s(c.code, 24).trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(code)) return { error: 'bad_code' };
  const months = int(c.months, 1, 24) || 1;
  const max = int(c.max, 1, 10000) || 10;
  const expires = ms(c.expires) || null;
  return { code, def: { months, max, plan: 'pro', disabled: c.disabled === true, expires, note: s(c.note, 200) } };
}
export function codeState(def, now = Date.now()) {
  const used = Object.keys(def?.uses || {}).length;
  const max = Number(def?.max || 0);
  return { used, max, remaining: Math.max(0, max - used), open: !def?.disabled && used < max && (!def?.expires || now < def.expires) };
}

// ---------------- request gate (server) ----------------
// One check for every signed-in, non-admin API call: maintenance → suspended → revoked sessions → signup closed →
// feature flag. c = verified ID-token claims ({uid, iat}); ledger = the server ledger doc; cfg = stored config.
// Returns null (allowed) or { status, error, message? }.
export function gateCaller({ c, ledger = {}, cfg = {}, admin = false, feature = null, lang = 'zh-Hant' } = {}) {
  const conf = readConfig(cfg);
  if (admin) return null; // admins bypass maintenance + flags (they still see what users see in the admin preview)
  if (conf.maintenance.on) return { status: 503, error: 'maintenance', message: conf.maintenance.msg[lang] || conf.maintenance.msg['zh-Hant'] || conf.maintenance.msg.en || '' };
  const uid = c?.uid;
  if (uid && ledger?.disabled?.[uid]) return { status: 403, error: 'account_disabled' };
  const rv = Number(ledger?.revoked?.[uid]?.at || ledger?.revoked?.[uid] || 0);
  if (uid && rv && Number(c?.iat || 0) * 1000 < rv) return { status: 401, error: 'session_revoked' };
  if (uid && ledger?.signupBlocked?.[uid]) return { status: 403, error: 'signup_closed' };
  if (feature && conf.flags[feature] === false) return { status: 403, error: 'feature_disabled', feature };
  return null;
}

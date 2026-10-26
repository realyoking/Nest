import { env } from '../env.js';
// Real Google connections, several Google accounts per Nest user (e.g. a personal Gmail + a school account).
// - Tokens: short-lived access tokens per account in sessionStorage (`nest.gtokens`, ~55 min). Refresh tokens: encrypted
//   (AES-256-GCM, server key) in users/{uid}.googleVault, exchanged by /api/google/token — see the OAuth section below.
// - Metadata in the owner-only profile users/{uid}:
//     googleAccounts: [{ email, name, photo, scopes[], addedAt }]          (one entry per Google account, keyed by email)
//     serviceAccounts: { gmail: [email…], googlecalendar: […], googleclassroom: […], googledrive: […] }
//     connections: { gmail: true, … }                                     (service on/off, unchanged for older code)
// - Older single-account sessions (`nest.gtoken`) are migrated by migrateLegacy().
import { APP_HOSTS, APP_ORIGIN } from '../site.js';
import { addGoogleAccount, MOCK, saveProfile, currentUser } from './backend.js';
import { reportGate, isGateError } from './gate-errors.js';
import { deadlinesFromClassroom } from './push.js';
import { dueTag } from './chatctx.js';

export const GOOGLE_SCOPES = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  googlecalendar: ['https://www.googleapis.com/auth/calendar.readonly'],
  googleclassroom: ['https://www.googleapis.com/auth/classroom.courses.readonly', 'https://www.googleapis.com/auth/classroom.coursework.me.readonly'],
  googledrive: ['https://www.googleapis.com/auth/drive.readonly'],
};
export const GOOGLE_IDS = Object.keys(GOOGLE_SCOPES);
// Requested when connecting but not required for a service to count as live (older grants lack them).
const EXTRA_SCOPES = { googleclassroom: ['https://www.googleapis.com/auth/classroom.announcements.readonly'], googlecalendar: ['https://www.googleapis.com/auth/calendar.events'] };
// Calendar tab writes (create / edit / delete) need calendar.events (or the full calendar scope).
export const canWriteCalendar = (email) => MOCK || (getTokens()[lc(email)]?.scopes || []).some((x) => x === `${AUTH}calendar.events` || x === `${AUTH}calendar`);
const KEY = 'nest.gtokens';
const LEGACY = 'nest.gtoken';
const TTL = 55 * 60 * 1000;
const lc = (e) => String(e || '').trim().toLowerCase();

// ---- tokens (session only) ----
function readTokens() { try { return JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function writeTokens(m) { sessionStorage.setItem(KEY, JSON.stringify(m)); window.dispatchEvent(new Event('nest:gtokens')); }
export function getTokens() {
  const now = Date.now();
  return Object.fromEntries(Object.entries(readTokens()).filter(([, v]) => v && v.exp > now));
}
export const tokenFor = (email) => (MOCK ? { token: `mock-${lc(email)}`, scopes: [] } : getTokens()[lc(email)] || null);
// True when some account has a live access token, or a stored refresh token that can produce one.
export const hasAnyToken = (profile) => MOCK || Object.keys(getTokens()).length > 0 || vaultOf(profile).length > 0;
export function clearToken(email) {
  if (!email) { sessionStorage.removeItem(KEY); sessionStorage.removeItem(LEGACY); window.dispatchEvent(new Event('nest:gtokens')); return; }
  const m = readTokens(); delete m[lc(email)]; writeTokens(m);
}
// Google reports some scopes under another name than the one requested: classroom.coursework.me.readonly comes back as
// classroom.student-submissions.me.readonly (the root cause of Classroom showing "needs re-authorising" forever).
// Broader scopes also cover the read-only ones.
const AUTH = 'https://www.googleapis.com/auth/';
const SCOPE_EQUIV = {
  [`${AUTH}classroom.coursework.me.readonly`]: [`${AUTH}classroom.student-submissions.me.readonly`, `${AUTH}classroom.coursework.me`, `${AUTH}classroom.student-submissions.me`],
  [`${AUTH}classroom.courses.readonly`]: [`${AUTH}classroom.courses`],
  [`${AUTH}drive.readonly`]: [`${AUTH}drive`],
  [`${AUTH}gmail.readonly`]: [`${AUTH}gmail.modify`, 'https://mail.google.com/'],
  [`${AUTH}calendar.readonly`]: [`${AUTH}calendar`],
};
const hasScope = (scopes, x) => scopes.includes(x) || (SCOPE_EQUIV[x] || []).some((y) => scopes.includes(y));
const covers = (scopes, id) => !scopes?.length || GOOGLE_SCOPES[id].every((x) => hasScope(scopes, x));
// Services whose scopes this account's live token does not carry (granular consent can leave some unticked).
export function missingFor(email) {
  if (MOCK) return [];
  const t = getTokens()[lc(email)];
  if (!t || !t.scopes?.length) return [];
  return GOOGLE_IDS.filter((id) => !covers(t.scopes, id));
}

// ---- profile helpers ----
export const accountsOf = (profile) => (Array.isArray(profile?.googleAccounts) ? profile.googleAccounts : []).filter((a) => a?.email);
// Accounts chosen for a service. Older profiles without serviceAccounts fall back to every linked account.
export function selectedFor(profile, id) {
  if (!profile?.connections?.[id]) return [];
  const all = accountsOf(profile).map((a) => a.email);
  const sel = profile?.serviceAccounts?.[id];
  return Array.isArray(sel) ? sel.filter((e) => all.includes(e)) : all;
}
// Is this account's token live and does it carry the service's scopes?
export function accountLive(email, id) {
  const t = tokenFor(email);
  return !!t && (MOCK || !id || covers(t.scopes, id));
}
export const serviceLive = (profile, id) => selectedFor(profile, id).some((e) => accountLive(e, id));

async function tokenInfo(token) {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// ---- Google OAuth for connectors (independent of the Firebase login) ----
// Server-side authorization-code flow (since 2026-10-17): /api/oauth/start (Firebase ID token) returns the Google URL
// (access_type=offline, prompt=consent select_account, include_granted_scopes, response_type=code). Google redirects to
// <origin>/api/oauth/callback, which exchanges the code with the client secret (Vercel env only), encrypts the refresh
// token for this uid + account (AES-256-GCM) and sends { email, name, photo, scopes, enc, token } back in the fragment of
// /oauth-callback.html → popup: postMessage to the opener; iOS / standalone PWA: localStorage + return to the app.
// The app stores `enc` in its own profile users/{uid}.googleVault.<key>; /api/google/token turns it into fresh access
// tokens whenever needed, so connections survive app reinstalls and new devices (sign in → profile → tokens).
// Every app hostname (HOSTS) has its callback registered on the OAuth web client.
export const OAUTH_CLIENT_ID = env('VITE_GOOGLE_CLIENT_ID'); // your Google OAuth web client (.env.example)
export const OAUTH_ORIGIN = APP_ORIGIN; // src/site.js (nesty.cyou once AUTH_ON_SITE)
export const HOSTS = APP_HOSTS;
const PENDING = 'nest.oauth.pending';
const RESULT = 'nest.oauth.result';

export const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function oauthError(code) { return Object.assign(new Error(code), { code: `oauth/${code}` }); }
// Shared access check answers (maintenance / suspended / revoked / signup closed) keep their plain code for gateErrorText.
function gateOr(j, status) {
  if (isGateError(j)) { const err = Object.assign(new Error(j.error), { code: j.error, status, ...(j.message ? { gateMessage: j.message } : {}) }); reportGate(err); return err; }
  return Object.assign(oauthError(j.error || `http_${status}`), { status });
}

async function idToken() {
  const u = currentUser();
  if (!u) throw oauthError('signed_out');
  return u.getIdToken();
}
async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${await idToken()}` }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw gateOr(j, r.status);
  return j;
}

// Map key of an account inside profile.googleVault ("g" + 24 hex of sha256(email)), same as the server's vaultKey().
async function vaultKey(email) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(lc(email)));
  return 'g' + Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('').slice(0, 24);
}
// One entry per email (the newest wins if an older key is still around).
export const vaultOf = (profile) => {
  const by = new Map();
  for (const v of Object.values(profile?.googleVault || {})) {
    if (!v?.email || !v?.enc) continue;
    const e = lc(v.email); const cur = by.get(e);
    if (!cur || String(v.at || '') > String(cur.at || '')) by.set(e, v);
  }
  return [...by.values()];
};
const vaultAt = (profile, email) => String(vaultOf(profile).find((v) => lc(v.email) === lc(email))?.at || '');
export const hasVault = (profile, email) => vaultOf(profile).some((v) => lc(v.email) === lc(email));

// Turn the callback's fragment into a stored access token + account metadata.
// nest=3&saved=1 → the server already saved the account (googleAccounts, serviceAccounts, googleVault) to the profile.
// Otherwise (nest=2 / save failed) the app writes the encrypted refresh token itself.
async function finishFromHash(hash) {
  const h = new URLSearchParams(String(hash || '').replace(/^#/, ''));
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch {}
  localStorage.removeItem(PENDING);
  if (h.get('error')) throw Object.assign(oauthError(h.get('error') === 'access_denied' ? 'access_denied' : h.get('error')), { detail: h.get('detail') || '' });
  const v3 = h.get('nest') === '3';
  if (!v3 && (!pending || h.get('state') !== pending.state || Date.now() - pending.at > 15 * 60e3)) throw oauthError('state_mismatch');
  if (!v3 && h.get('nest') !== '2') throw oauthError('no_token');
  const email = lc(h.get('email'));
  if (!email) throw oauthError('no_email');
  const scopes = String(h.get('scopes') || '').split(' ').filter(Boolean);
  const token = h.get('token');
  const saved = h.get('saved') === '1';
  const at = h.get('at') || new Date().toISOString();
  if (token) {
    const exp = Date.now() + Math.min(TTL, (Number(h.get('expires_in')) || 3300) * 1000);
    const m = readTokens(); m[email] = { token, scopes, exp, at: saved ? at : '' }; writeTokens(m);
  }
  failed.delete(email);
  const acct = { email, name: h.get('name') || '', photo: h.get('photo') || '', scopes, enc: saved ? '' : h.get('enc') || '', vaultKey: await vaultKey(email) };
  const select = pending?.select?.length ? pending.select : String(h.get('sel') || '').split(' ').filter(Boolean);
  return { acct, select, ret: pending?.ret, saved, missing: String(h.get('missing') || '').split(' ').filter(Boolean) };
}

// Start the flow. Always asks Google for every connector scope (one consent covers Gmail, Calendar, Classroom, Drive).
// Resolves { acct, select, saved } in popup mode; in redirect mode the page navigates away (never resolves) — the server
// saves the account either way, and the profile listener + ensureTokens pick it up when the app is visible again.
export async function addAccount({ ids = GOOGLE_IDS, select = [], hint, ret } = {}) {
  const scopes = [...new Set(GOOGLE_IDS.flatMap((id) => [...(GOOGLE_SCOPES[id] || []), ...(EXTRA_SCOPES[id] || [])]))];
  if (MOCK) {
    const r = await addGoogleAccount(scopes, { hint });
    const m = readTokens(); m[lc(r.email)] = { token: r.token, scopes, exp: Date.now() + TTL }; writeTokens(m);
    return { acct: { email: lc(r.email), name: r.name || '', photo: '', scopes }, select };
  }
  if (!HOSTS.includes(location.hostname)) { location.href = `${OAUTH_ORIGIN}/app/connections`; return new Promise(() => {}); }
  const useRedirect = isStandalone() || isIOS();
  // Open the popup inside the click (before any await) so it is not blocked.
  let w = useRedirect ? null : window.open('about:blank', 'nest-oauth', 'width=500,height=680,menubar=no,toolbar=no');
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
  let url;
  try {
    const u = currentUser(); if (!u) throw oauthError('signed_out');
    const tok = await u.getIdToken(true); // fresh (≈60 min): the sealed state carries it so the callback can save server-side
    const r = await fetch('/api/oauth/start', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ select, hint, nonce: state }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw gateOr(j, r.status);
    url = j.url;
  } catch (e) { try { w?.close(); } catch {} throw e; }
  const back = ret || location.pathname + location.search;
  localStorage.setItem(PENDING, JSON.stringify({ state, select, ret: back, at: Date.now() }));
  const redirect = () => { location.assign(url); return new Promise(() => {}); };
  if (useRedirect || !w || w.closed) return redirect();
  try { w.location.href = url; } catch { return redirect(); }
  return new Promise((resolve, reject) => {
    let done = false;
    let bc = null;
    const handle = (hash) => {
      if (done) return; done = true; cleanup();
      localStorage.removeItem(RESULT);
      finishFromHash(hash).then(resolve, reject);
    };
    const onMsg = (e) => { if (e.origin === location.origin && e.data?.type === 'nest-oauth') handle(e.data.hash); };
    try {
      bc = new BroadcastChannel('nest-oauth');
      // Google's pages set COOP, so the popup usually loses window.opener: it reaches us over BroadcastChannel instead.
      bc.onmessage = (e) => { if (e.data?.type === 'nest-oauth') { try { bc.postMessage({ type: 'nest-oauth-ack' }); } catch {} handle(e.data.hash); } };
    } catch {}
    // Popup closed: give the message a moment, then fall back to a result left in localStorage, else cancelled.
    const iv = setInterval(() => {
      if (!w.closed || done) return;
      clearInterval(iv);
      setTimeout(() => { if (done) return; const h = localStorage.getItem(RESULT); if (h) handle(h); else { done = true; cleanup(); reject(oauthError('popup_closed')); } }, 800);
    }, 500);
    function cleanup() { window.removeEventListener('message', onMsg); clearInterval(iv); try { bc?.close(); } catch {} }
    window.addEventListener('message', onMsg);
  });
}

// After a full-page redirect: finish the pending result (if any) and save the account on the profile.
// Returns { acct } or null; throws oauth/* codes.
let consuming = false;
export async function consumeOAuthReturn(profile, uid) {
  if (consuming || !uid) return null;
  const hash = localStorage.getItem(RESULT);
  if (!hash) return null;
  consuming = true;
  try {
    localStorage.removeItem(RESULT);
    const r = await finishFromHash(hash);
    if (!r.saved) await saveProfile(uid, withAccount(profile, r.acct, r.select));
    return r;
  } finally { consuming = false; }
}

// ---- persistent tokens: refresh tokens live encrypted in the profile, access tokens come from /api/google/token ----
const failed = new Map(); // email → { why, detail, at, vat }  (refresh failed for vault entry `vat` → the UI offers 重新授權)
let inflight = null;
const failFor = (profile, e) => { const f = failed.get(e); return f && f.vat === vaultAt(profile, e) ? f : null; };
export const failInfo = (profile, email) => failFor(profile, lc(email));
// Make sure every account with a stored refresh token has a live access token for its CURRENT vault entry. Never throws.
// A token minted from an older vault entry (before a re-authorisation) is replaced, so new scopes show up at once.
export async function ensureTokens(profile, { force = false } = {}) {
  if (MOCK || !profile || !currentUser()) return;
  const live = getTokens();
  const now = Date.now();
  const linked = accountsOf(profile).map((a) => lc(a.email));
  const want = vaultOf(profile).map((v) => lc(v.email)).filter((e) => linked.includes(e)).filter((e) => {
    const t = live[e]; const vat = vaultAt(profile, e);
    const fresh = t && t.exp - now > 5 * 60e3 && (!t.at || !vat || t.at === vat);
    if (fresh && !force) return false;
    const f = failFor(profile, e);
    return force || !(f && now - f.at < 60e3);
  });
  if (!want.length) return;
  if (inflight) { await inflight; if (!force) return ensureTokens(profile); }
  inflight = (async () => {
    try {
      const r = await api('/api/google/token', { emails: want });
      const m = readTokens();
      for (const [e, t] of Object.entries(r.tokens || {})) { m[lc(e)] = { token: t.token, scopes: t.scopes || [], at: t.at || '', exp: Date.now() + Math.min(TTL, (t.expiresIn || 3300) * 1000) }; failed.delete(lc(e)); }
      for (const [e, why] of Object.entries(r.failed || {})) { failed.set(lc(e), { why, detail: r.details?.[e] || '', at: Date.now(), vat: vaultAt(profile, e) }); delete m[lc(e)]; }
      writeTokens(m);
    } catch (e) {
      want.forEach((x) => failed.set(x, { why: e.status === 503 ? 'not_configured' : 'network', detail: e.message || '', at: Date.now(), vat: vaultAt(profile, x) }));
      window.dispatchEvent(new Event('nest:gtokens'));
    }
  })();
  try { await inflight; } finally { inflight = null; }
}
// 'live' | 'missing' (connected, but this service's permission was not granted) | 'loading' | 'reauth'
export function accountStatus(profile, email, id) {
  const e = lc(email);
  const t = MOCK ? tokenFor(e) : getTokens()[e];
  if (t) return !id || MOCK || covers(t.scopes, id) ? 'live' : 'missing';
  if (MOCK) return 'reauth';
  if (!hasVault(profile, e)) return 'reauth';
  if (failFor(profile, e)) return 'reauth';
  return 'loading';
}
// Diagnostics: per account refresh result + one tiny read per service with Google's own error text.
export const diagnose = () => api('/api/google/status', {});
// Accounts connected before 2026-10-17 (short-lived tokens only) need one reconnect to become persistent.
export const legacyAccounts = (profile) => (MOCK ? [] : accountsOf(profile).filter((a) => !hasVault(profile, a.email)));

// Remove an account: revoke + delete its stored refresh token on the server, then drop it from the profile.
export async function removeAccount(profile, uid, email) {
  clearToken(email);
  failed.delete(lc(email));
  if (!MOCK) await api('/api/google/disconnect', { email }).catch(() => {});
  await saveProfile(uid, withoutAccount(profile, email));
}

// Friendly, localised message key for connector / sign-in errors.
export function oauthErrorKey(e) {
  const c = String(e?.code || e?.message || '');
  if (/access_denied|popup_closed|popup-closed|cancelled-popup/.test(c)) return 'cancelled';
  if (/admin_policy|org_internal|disallowed|unauthorized_client|invalid_client/.test(c)) return 'blocked';
  if (/state_mismatch|no_token/.test(c)) return 'expired';
  if (/no_email/.test(c)) return 'noEmail';
  if (/network/.test(c)) return 'network';
  return 'generic';
}

// Profile patch that adds/updates an account and (optionally) selects it for services.
export function withAccount(profile, acct, selectIds = []) {
  const list = accountsOf(profile).filter((a) => a.email !== acct.email);
  const prev = accountsOf(profile).find((a) => a.email === acct.email);
  const scopes = [...new Set([...(prev?.scopes || []), ...(acct.scopes || [])])];
  const googleAccounts = [...list, { email: acct.email, name: acct.name || prev?.name || '', photo: acct.photo || prev?.photo || '', scopes, addedAt: prev?.addedAt || new Date().toISOString() }]
    .sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
  const serviceAccounts = { ...(profile?.serviceAccounts || {}) };
  const connections = { ...(profile?.connections || {}) };
  for (const id of GOOGLE_IDS) if (!Array.isArray(serviceAccounts[id])) serviceAccounts[id] = selectedFor(profile, id);
  for (const id of selectIds) {
    serviceAccounts[id] = [...new Set([...(serviceAccounts[id] || []), acct.email])];
    connections[id] = true;
  }
  const out = { googleAccounts, serviceAccounts, connections };
  // Encrypted refresh token (only /api/google/* can decrypt it). setDoc merge keeps the other accounts' entries.
  if (acct.enc && acct.vaultKey) out.googleVault = { [acct.vaultKey]: { email: acct.email, enc: acct.enc, scopes, at: new Date().toISOString() } };
  return out;
}
export function withoutAccount(profile, email) {
  const googleAccounts = accountsOf(profile).filter((a) => a.email !== email);
  const serviceAccounts = {}; const connections = { ...(profile?.connections || {}) };
  for (const id of GOOGLE_IDS) {
    serviceAccounts[id] = selectedFor(profile, id).filter((e) => e !== email);
    if (connections[id] && !serviceAccounts[id].length) connections[id] = false;
  }
  return { googleAccounts, serviceAccounts, connections };
}
export function withSelection(profile, id, emails) {
  const serviceAccounts = { ...(profile?.serviceAccounts || {}) };
  for (const g of GOOGLE_IDS) if (!Array.isArray(serviceAccounts[g])) serviceAccounts[g] = selectedFor(profile, g);
  serviceAccounts[id] = emails;
  return { serviceAccounts, connections: { ...(profile?.connections || {}), [id]: emails.length > 0 } };
}

// One-time migration of the old single-account session token into the accounts list.
let migrating = false;
export async function migrateLegacy(profile, uid) {
  if (MOCK || migrating || !uid || !profile) return;
  let old = null;
  try { old = JSON.parse(sessionStorage.getItem(LEGACY) || 'null'); } catch {}
  if (!old?.token) return;
  migrating = true;
  try {
    sessionStorage.removeItem(LEGACY);
    if (old.exp <= Date.now()) return;
    const info = await tokenInfo(old.token);
    const email = lc(info?.email || currentUser()?.providerData?.find((x) => x.providerId === 'google.com')?.email);
    if (!email) return;
    const scopes = info?.scope ? info.scope.split(' ') : (old.ids || []).flatMap((id) => GOOGLE_SCOPES[id] || []);
    const m = readTokens(); m[email] = { token: old.token, scopes, exp: old.exp }; writeTokens(m);
    if (!accountsOf(profile).some((a) => a.email === email)) {
      const enabled = GOOGLE_IDS.filter((id) => profile.connections?.[id]);
      await saveProfile(uid, withAccount(profile, { email, scopes }, enabled));
    }
  } finally { migrating = false; }
}

// Gmail snippets arrive HTML-escaped ("You&#39;re"). Decode named, decimal and hex entities to plain text.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™', zwnj: '', zwj: '' };
export function decodeEntities(s = '') {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    const v = NAMED[e.toLowerCase()];
    return v === undefined ? m : v;
  }).replace(/[\u200b-\u200d\u034f\u00ad\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}
const clean = (s) => decodeEntities(s);

async function g(url, token) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: ctl.signal });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw Object.assign(new Error(`google_${r.status}`), { status: r.status, message: String(j.error?.message || '').slice(0, 200) });
    }
    return r.json();
  } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { status: 0, message: 'timeout' }); throw e; }
  finally { clearTimeout(timer); }
}

const MOCK_DATA = {
  gmail: [{ title: '秋季旅行通知及回條：請家長細閱活動安排、集合時間及所需物品，並於限期前交回回條', sub: '聖保羅小學 · You&#39;re receiving this because we&#39;ve updated the autumn trip details &amp; the reply slip is due on 23 October.', date: new Date() }, { title: '十月份午膳費繳費提示', sub: '午膳供應商 · 請於 10 月 18 日前繳交', date: new Date() }],
  googlecalendar: [{ title: '家長日', sub: '10 月 25 日 14:00', date: new Date() }, { title: '鋼琴課', sub: '星期六 10:00', date: new Date() }],
  googleclassroom: [{ title: '數學工作紙 5B', sub: '數學 · 10 月 21 日到期', date: new Date() }],
  googledrive: [{ title: '常識科專題報告', sub: '2 小時前修改', date: new Date() }],
};

const MOCK_SCHOOL_MAIL = [{ title: '中三級數學測驗範圍', sub: '數學科 陳老師 · 測驗日期為 10 月 24 日，範圍為第三至第五章。', date: new Date() }];
export async function fetchGoogle(id, token) {
  if (MOCK) return (id === 'gmail' && String(token).includes('school') ? MOCK_SCHOOL_MAIL : MOCK_DATA[id] || []).map((i) => ({ ...i, title: clean(i.title), sub: clean(i.sub) }));
  if (id === 'gmail') {
    const l = await g('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=12&q=newer_than:14d -category:promotions -category:social', token);
    const msgs = await Promise.all((l.messages || []).slice(0, 12).map((m) =>
      g(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, token).catch(() => null)));
    return msgs.filter(Boolean).map((m) => {
      const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
      const from = clean((h.from || '').replace(/<.*>/, '').replace(/"/g, ''));
      return { title: clean(h.subject) || '(no subject)', sub: `${from} · ${clean(m.snippet)}`.slice(0, 220), date: new Date(Number(m.internalDate)) };
    });
  }
  if (id === 'googlecalendar') {
    const now = new Date().toISOString();
    const max = new Date(Date.now() + 21 * 864e5).toISOString();
    const l = await g(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${max}&maxResults=15&singleEvents=true&orderBy=startTime`, token);
    return (l.items || []).map((e) => {
      const start = new Date(e.start?.dateTime || e.start?.date);
      return { title: clean(e.summary) || '(untitled)', sub: start.toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: e.start?.dateTime ? 'short' : undefined }) + (e.location ? ` · ${e.location}` : ''), date: start, allDay: !e.start?.dateTime };
    });
  }
  if (id === 'googleclassroom') {
    const c = await g('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=10', token);
    const out = [];
    await Promise.all((c.courses || []).slice(0, 8).map(async (course) => {
      const w = await g(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=10&orderBy=dueDate%20desc`, token).catch(() => ({}));
      (w.courseWork || []).forEach((cw) => {
        const due = cw.dueDate ? new Date(Date.UTC(cw.dueDate.year, cw.dueDate.month - 1, cw.dueDate.day, cw.dueTime?.hours || 15, cw.dueTime?.minutes || 59)) : null;
        if (!due || due > new Date(Date.now() - 2 * 864e5)) out.push({ title: clean(cw.title), sub: `${clean(course.name)}${due ? ' · due ' + due.toLocaleDateString('en-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium' }) : ''}`, date: due });
      });
    }));
    const sorted = out.sort((a, b) => (a.date || Infinity) - (b.date || Infinity)).slice(0, 15);
    return sorted;
  }
  if (id === 'googledrive') {
    const l = await g('https://www.googleapis.com/drive/v3/files?pageSize=10&orderBy=modifiedTime%20desc&fields=files(id,name,modifiedTime,webViewLink)', token);
    return (l.files || []).map((f) => ({ title: clean(f.name), sub: new Date(f.modifiedTime).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong', dateStyle: 'medium', timeStyle: 'short' }), date: new Date(f.modifiedTime), href: f.webViewLink }));
  }
  return [];
}

// Items for one service from every selected account, each tagged with `account`. Accounts without a live token are
// listed in `expired`; per-account API errors in `errors` ({ email, status }).
export async function fetchService(profile, id) {
  await ensureTokens(profile);
  const emails = selectedFor(profile, id);
  const items = []; const expired = []; const errors = []; const missing = [];
  await Promise.all(emails.map(async (email) => {
    if (!accountLive(email, id)) { (accountStatus(profile, email, id) === 'missing' ? missing : expired).push(email); return; }
    try {
      const list = await fetchGoogle(id, tokenFor(email).token);
      list.forEach((i) => items.push({ ...i, account: email }));
    } catch (e) {
      if (e.status === 401) { clearToken(email); failed.set(lc(email), { why: 'revoked', detail: e.message || '', at: Date.now(), vat: vaultAt(profile, email) }); expired.push(email); } else errors.push({ email, status: e.status || 0, message: e.message || '' });
    }
  }));
  items.sort((a, b) => (id === 'googleclassroom' || id === 'googlecalendar'
    ? (a.date || Infinity) - (b.date || Infinity) : (b.date || 0) - (a.date || 0)));
  if (id === 'googleclassroom' && items.length) cacheDeadlines(items);
  return { items, expired, errors, emails, missing };
}
// Upcoming Classroom deadlines (all selected accounts) cached on the owner-only profile for the daily push cron,
// which has no Google tokens of its own. ≤ once per 30 min.
function cacheDeadlines(items) {
  const u = currentUser();
  if (!u || MOCK || Date.now() - (+sessionStorage.getItem('nest.dlAt') || 0) < 30 * 60e3) return;
  sessionStorage.setItem('nest.dlAt', String(Date.now()));
  saveProfile(u.uid, { deadlines: deadlinesFromClassroom(items), deadlinesAt: new Date() }).catch(() => {});
}

// Inputs for the daily brief (src/lib/brief.js): the selected accounts per service and their live access tokens.
export async function briefInputs(profile) {
  await ensureTokens(profile);
  const selection = Object.fromEntries(GOOGLE_IDS.map((id) => [id, selectedFor(profile, id)]));
  const tokens = Object.fromEntries(Object.entries(getTokens()).map(([e, t]) => [e, t.token]));
  return { selection, tokens };
}

// Text block of connected data for the agent's context, every item labelled with the account it came from.
let ctxCache = { key: '', at: 0, text: '' };
// Chat speed: the connected-account context is cached ~10 min per device. peek → the cached text (or null when cold),
// so a chat turn never waits for Google; warm() starts a background refresh (Agent page mount / after each turn).
const ctxKey = (enabledIds, profile) => enabledIds.map((id) => `${id}:${selectedFor(profile, id).join('+')}`).join(',') + Object.values(getTokens()).map((t) => t.token.slice(-6)).join('');
export function peekConnected(enabledIds, profile) {
  const k = ctxKey(enabledIds, profile);
  return ctxCache.key === k && Date.now() - ctxCache.at < 10 * 60e3 ? ctxCache.text : null;
}
let warming = null;
export function warmConnected(enabledIds, profile) {
  if (!enabledIds.length || warming || peekConnected(enabledIds, profile) !== null) return warming;
  warming = connectedContext(enabledIds, profile).catch(() => '').finally(() => { warming = null; });
  return warming;
}
export async function connectedContext(enabledIds, profile, { fresh = false } = {}) {
  if (fresh) ctxCache = { key: '', at: 0, text: '' };
  const key = enabledIds.map((id) => `${id}:${selectedFor(profile, id).join('+')}`).join(',') + Object.values(getTokens()).map((t) => t.token.slice(-6)).join('');
  if (ctxCache.key === key && Date.now() - ctxCache.at < 10 * 60e3) return ctxCache.text;
  const text = await buildContext(enabledIds, profile);
  ctxCache = { key, at: Date.now(), text };
  return text;
}
async function buildContext(enabledIds, profile) {
  await ensureTokens(profile);
  if (!hasAnyToken(profile)) return '';
  const labels = { gmail: 'Recent emails', googlecalendar: 'Upcoming calendar events', googleclassroom: 'Classroom coursework', googledrive: 'Recent Drive files' };
  const parts = await Promise.all(enabledIds.map(async (id) => {
    try {
      const { items } = await fetchService(profile, id);
      if (!items.length) return '';
      // Deadlines / event times as tags → api/chat.js resolves them to "OVERDUE by N days" / "due in N days" (HK).
      const when = (i) => (i.date instanceof Date && !Number.isNaN(i.date.getTime()) && (id === 'googleclassroom' || id === 'googlecalendar') ? ` — ${dueTag(i.date, id === 'googleclassroom' ? 'due' : 'when', id === 'googlecalendar' && !!i.allDay)}` : '');
      return `${labels[id]} (account in brackets):\n` + items.slice(0, 12).map((i) => `- [${i.account}] ${i.title} — ${String(i.sub || '').replace(/ · due [^·]*$/, '')}${when(i)}`).join('\n');
    } catch { return ''; }
  }));
  return parts.filter(Boolean).join('\n\n');
}

import { TEST_DOMAIN_SRC, adminEmails } from '../src/lib/test-domains.js';
import { IS_UPSTREAM, SITE } from '../src/site.js';
// Shared server code for the beta promo, plan resolution and the admin panel (Nest 巢).
// Edge-compatible (fetch + WebCrypto + jose only).
//
// Server-only storage ("ledgers"). Without a service account the server cannot bypass Firestore rules, so it keeps
// its own data in the profile docs of two system Firebase Auth accounts. The live rule `match /users/{uid}` lets only
// that uid read/write the doc, so nothing here is readable by any app user:
//   nest-ledger@system.heynest.invalid → users/{ledgerUid}: promos.beta {max, claimed, claims{fid}, uids{uid}},
//                                         grants{fid: {until, by, at, note}}, disabled{uid}, log[≤300]
//   nest-index@system.heynest.invalid  → users/{indexUid}:  u{uid} (users seen by /api/promo/ping), f{fid} (families),
//                                         act{d-YYYY-MM-DD: {uid: true}}, m{d-YYYY-MM-DD: {mode: n}} (AI messages),
//                                         wl{id: {p, b, at}} (waitlist sign-ups since 2026-10-18)
// Their passwords are HMAC(NEST_LEDGER_SECRET, which) — one sensitive Vercel env var; the accounts self-provision.
// With FIREBASE_SERVICE_ACCOUNT set, the admin panel also lists every Auth user / family (bypasses rules) and can
// disable accounts; the ledgers are still used for promo, grants and the admin log.
import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from 'jose';
import { firebaseConfig } from '../src/firebase-config.js';

export const PROJECT = () => process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
export const DOCS = () => `projects/${PROJECT()}/databases/(default)/documents`;
const FS = 'https://firestore.googleapis.com/v1';
const IDT = 'https://identitytoolkit.googleapis.com/v1';
// Referer sent with Identity Toolkit calls (for API keys restricted by HTTP referrer).
const ORIGIN = process.env.NEST_API_REFERER || (IS_UPSTREAM ? 'https://heynest.vercel.app' : SITE);
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
// Admin allowlist: NEST_ADMIN_EMAILS (server) or VITE_ADMIN_EMAILS, comma-separated verified emails. Empty = no email admins.
export const ADMIN_EMAILS = adminEmails();
export const PROMO_MAX = 10;
export const LEDGER_EMAILS = { ledger: 'nest-ledger@system.heynest.invalid', index: 'nest-index@system.heynest.invalid', config: 'nest-config@system.heynest.invalid', media: 'nest-media@system.heynest.invalid' };
// Test + system accounts: never eligible for the beta promo, excluded from admin stats (rows tagged "Test").
export const TEST_EMAIL_RE = new RegExp(`@(${TEST_DOMAIN_SRC}|system\\.heynest\\.invalid)$`, 'i');
export const isTestEmail = (e) => TEST_EMAIL_RE.test(String(e || '').trim());

export const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
});

// ---------- caller identity ----------
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${PROJECT()}`, audience: PROJECT() });
  return {
    uid: payload.sub, token, email: String(payload.email || '').toLowerCase(), emailVerified: payload.email_verified === true,
    name: payload.name || '', provider: payload.firebase?.sign_in_provider || '', iat: Number(payload.iat) || 0,
  };
}
export async function callerOf(req) {
  const a = req.headers.get('authorization') || '';
  if (!a.startsWith('Bearer ')) return null;
  try { return await verifyToken(a.slice(7)); } catch { return null; }
}
// Pure allowlist check (unit-tested): verified email on the allowlist, and not one of the system accounts.
// Official @nest account. Admin by pinned uid (NEST_OFFICIAL_UID) + email, so it
// needs no email verification (the address is not a real mailbox). Never deleted by cleanup; tagged "official", not a real user.
export const OFFICIAL = { email: 'nest@official.heynest.invalid', get uid() { return process.env.NEST_OFFICIAL_UID || ''; }, handle: 'nest' };
export const isOfficialClaims = (c) => !!c && !!OFFICIAL.uid && c.uid === OFFICIAL.uid && String(c.email || '').toLowerCase() === OFFICIAL.email;
export const isOfficialEmail = (e) => String(e || '').trim().toLowerCase() === OFFICIAL.email;
export const isAdminClaims = (c) => !!c && ((c.emailVerified === true && ADMIN_EMAILS.includes(String(c.email || '').toLowerCase())) || isOfficialClaims(c));

// ---------- Firestore value codec ----------
export function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)])) } };
}
export function dec(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return Date.parse(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)]));
  if ('referenceValue' in v) return v.referenceValue;
  return null;
}
export const decFields = (f) => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
// Field path segment quoting (`a`.`b-c`).
export const fp = (...segs) => segs.map((s) => '`' + String(s).replace(/[`\\]/g, (m) => '\\' + m) + '`').join('.');
// Nested fields object for an update of one path: nest(['a','b'], v) → { a: {mapValue:{fields:{b: enc(v)}}} }
export function nest(segs, v) {
  if (segs.length === 1) return { [segs[0]]: enc(v) };
  return { [segs[0]]: { mapValue: { fields: nest(segs.slice(1), v) } } };
}
function mergeFields(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (out[k]?.mapValue && v.mapValue) out[k] = { mapValue: { fields: mergeFields(out[k].mapValue.fields || {}, v.mapValue.fields || {}) } };
    else out[k] = v;
  }
  return out;
}
// One update write setting several paths (absent value = delete that path).
export function pathsWrite(docName, entries) {
  let fields = {};
  const mask = [];
  for (const [segs, v] of entries) {
    mask.push(fp(...segs));
    if (v !== undefined) fields = mergeFields(fields, nest(segs, v));
  }
  return { update: { name: docName, fields }, updateMask: { fieldPaths: mask } };
}

// ---------- Firestore REST ----------
const authH = (token) => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json', referer: `${ORIGIN}/` });
export const docName = (path) => `${DOCS()}/${path}`;
export async function fsGet(path, token, transaction) {
  const r = await fetch(`${FS}/${docName(path)}${transaction ? `?transaction=${encodeURIComponent(transaction)}` : ''}`, { headers: authH(token) });
  if (r.status === 404) return null;
  if (!r.ok) { const e = new Error(`firestore get ${r.status}`); e.status = r.status; throw e; }
  const d = await r.json();
  return { data: decFields(d.fields), updateTime: d.updateTime, createTime: d.createTime };
}
// Read only some fields (Run 12: one blob out of a ~900 KB shard). fieldPaths are already-quoted paths (fp()).
export async function fsGetMask(path, token, fieldPaths) {
  const q = fieldPaths.map((f) => `mask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fetch(`${FS}/${docName(path)}?${q}`, { headers: authH(token) });
  if (r.status === 404) return null;
  if (!r.ok) { const e = new Error(`firestore get ${r.status}`); e.status = r.status; throw e; }
  const d = await r.json();
  return { data: decFields(d.fields), updateTime: d.updateTime };
}
// (unused with client auth; kept for service-account use)
export async function fsBegin(token) {
  const r = await fetch(`${FS}/${DOCS()}:beginTransaction`, { method: 'POST', headers: authH(token), body: JSON.stringify({ options: { readWrite: {} } }) });
  if (!r.ok) { const e = new Error(`firestore begin ${r.status}`); e.status = r.status; throw e; }
  return (await r.json()).transaction;
}
export async function fsCommit(writes, token, transaction) {
  const r = await fetch(`${FS}/${DOCS()}:commit`, { method: 'POST', headers: authH(token), body: JSON.stringify({ writes, ...(transaction ? { transaction } : {}) }) });
  if (r.ok) return { ok: true };
  const t = await r.text();
  let status = '';
  try { status = JSON.parse(t)?.error?.status || ''; } catch {}
  return { ok: false, code: r.status, status, text: t.slice(0, 300) };
}
export async function fsRollback(transaction, token) {
  await fetch(`${FS}/${DOCS()}:rollback`, { method: 'POST', headers: authH(token), body: JSON.stringify({ transaction }) }).catch(() => {});
}
// COUNT() of a subcollection (rules apply with a user token).
export async function fsCount(parentPath, collectionId, token, where) {
  const q = { from: [{ collectionId }] };
  if (where) q.where = { fieldFilter: { field: { fieldPath: where[0] }, op: 'EQUAL', value: enc(where[1]) } };
  const r = await fetch(`${FS}/${docName(parentPath)}:runAggregationQuery`, {
    method: 'POST', headers: authH(token),
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: q, aggregations: [{ alias: 'n', count: {} }] } }),
  });
  if (!r.ok) return null;
  const d = await r.json();
  return Number(d?.[0]?.result?.aggregateFields?.n?.integerValue ?? 0);
}

// ---------- system ledger accounts ----------
async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const sessions = {};
async function idt(op, body) {
  const r = await fetch(`${IDT}/accounts:${op}?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json', referer: `${ORIGIN}/` }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, d };
}
export async function ledgerSession(which = 'ledger') {
  const c = sessions[which];
  if (c && c.exp > Date.now() + 120e3) return c;
  const secret = process.env.NEST_LEDGER_SECRET;
  if (!secret) throw Object.assign(new Error('ledger_not_configured'), { status: 503 });
  // Run 13: 'github' = server-only store of encrypted GitHub tokens (api/_github.js).
  // Run 12: blog store accounts — 'blog' (post index) and 'blob-N' (shards for post bodies + images, ≤ ~900 KB each).
  const email = LEDGER_EMAILS[which] || (/^(blog|blob-\d{1,3}|github)$/.test(which) ? `nest-${which}@system.heynest.invalid` : null);
  if (!email) throw Object.assign(new Error('ledger_unknown'), { status: 500 });
  const password = 'L' + (await hmacHex(secret, `nest-ledger-v1|${which}`)).slice(0, 40);
  let r = await idt('signInWithPassword', { email, password, returnSecureToken: true });
  if (!r.ok && /EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/.test(r.d?.error?.message || '')) {
    const up = await idt('signUp', { email, password, returnSecureToken: true });
    r = up.ok ? up : await idt('signInWithPassword', { email, password, returnSecureToken: true });
  }
  if (!r.ok || !r.d.idToken) throw Object.assign(new Error(`ledger_signin_failed ${r.d?.error?.message || ''}`), { status: 503 });
  const s = { token: r.d.idToken, uid: r.d.localId, exp: Date.now() + Number(r.d.expiresIn || 3600) * 1000 };
  sessions[which] = s;
  return s;
}
export const ledgerPath = (s) => `users/${s.uid}`;

let ledgerCache = null;
export async function readLedger({ maxAge = 30e3, which = 'ledger' } = {}) {
  if (which === 'ledger' && ledgerCache && Date.now() - ledgerCache.at < maxAge) return ledgerCache.data;
  const s = await ledgerSession(which);
  const d = (await fsGet(ledgerPath(s), s.token))?.data || {};
  if (which === 'ledger') ledgerCache = { at: Date.now(), data: d };
  return d;
}
export const dropLedgerCache = () => { ledgerCache = null; };

// Read-modify-write of the ledger doc as an atomic compare-and-set: read the doc + its updateTime, commit with the
// precondition currentDocument.updateTime (or exists:false). Any concurrent write changes updateTime, so the commit
// fails with FAILED_PRECONDITION and we re-read and retry. (Client-auth REST may not open readWrite transactions —
// beginTransaction returns PERMISSION_DENIED — and this optimistic form is what the Firebase client SDKs do.)
// mutate(doc) returns { entries: [[segs, value]...], result } or { result } for no write.
export async function ledgerTx(mutate, { which = 'ledger', session, tries = 25 } = {}) {
  const s = session || await ledgerSession(which);
  let last;
  for (let i = 0; i < tries; i++) {
    const cur = await fsGet(ledgerPath(s), s.token);
    const out = await mutate(cur?.data || {});
    if (!out.entries?.length) return out.result;
    const w = pathsWrite(docName(ledgerPath(s)), out.entries);
    w.currentDocument = cur ? { updateTime: cur.updateTime } : { exists: false };
    const r = await fsCommit([w], s.token);
    if (r.ok) { if (which === 'ledger') dropLedgerCache(); return out.result; }
    last = r;
    if (!(r.code === 409 || r.status === 'ABORTED' || r.status === 'FAILED_PRECONDITION' || r.status === 'ALREADY_EXISTS' || r.status === 'NOT_FOUND')) {
      throw Object.assign(new Error(`ledger_commit ${r.code} ${r.status}`), { status: 502 });
    }
    await new Promise((res) => setTimeout(res, 30 + Math.random() * 60 * Math.min(i + 1, 6)));
  }
  throw Object.assign(new Error(`ledger_contention ${last?.status || ''}`), { status: 503 });
}
// Fire-and-forget style writes (no read) to a ledger doc.
export async function ledgerWrite(entries, which = 'index') {
  const s = await ledgerSession(which);
  return fsCommit([pathsWrite(docName(ledgerPath(s)), entries)], s.token);
}
export async function indexIncrement(segs, n = 1) {
  const s = await ledgerSession('index');
  return fsCommit([{ transform: { document: docName(ledgerPath(s)), fieldTransforms: [{ fieldPath: fp(...segs), increment: { integerValue: String(n) } }] } }], s.token);
}

// ---------- promo ----------
export function addMonths(ms, months = 1) {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // Jan 31 + 1 month → Feb 28/29
  return d.getTime();
}
export function promoState(doc, key = 'beta') {
  const p = doc?.promos?.[key] || {};
  const claims = p.claims || {};
  const max = Number(p.max || PROMO_MAX);
  const claimed = Object.keys(claims).length;
  return { key, max, claimed, remaining: Math.max(0, max - claimed), open: claimed < max, claims, uids: p.uids || {} };
}
// The atomic claim. One family once, one user once; never more than max.
export async function claimPromo({ key = 'beta', fid, uid, now = Date.now(), months = 1, max = PROMO_MAX, session }) {
  if (!fid || !uid) throw Object.assign(new Error('bad_claim'), { status: 400 });
  return ledgerTx((doc) => {
    const st = promoState(doc, key);
    const cap = Number(doc?.promos?.[key]?.max || max);
    if (st.claims[fid]) return { result: { status: 'already', until: st.claims[fid].until, ...counts(st) } };
    if (st.uids[uid]) return { result: { status: 'already_user', ...counts(st) } };
    if (st.claimed >= cap) return { result: { status: 'full', ...counts(st) } };
    const until = addMonths(now, months);
    const next = {
      max: cap,
      claimed: st.claimed + 1,
      claims: { ...st.claims, [fid]: { uid, at: now, until } },
      uids: { ...st.uids, [uid]: fid },
    };
    return { entries: [[['promos', key], next]], result: { status: 'claimed', until, max: cap, claimed: next.claimed, remaining: cap - next.claimed } };
  }, { session });
}
const counts = (st) => ({ max: st.max, claimed: st.claimed, remaining: st.remaining });

// Release every beta slot held by a test / system account (claimer email, or a family owned by one), using the server
// activity index (u{uid}.e, f{fid}.o) for emails. Idempotent: writes only when something must be released. Also deletes
// admin grants and admin-log entries for those families. Returns the released family ids.
let purgeAt = 0;
export async function purgeTestClaims({ force = false, extraUids = [] } = {}) {
  if (!force && Date.now() - purgeAt < 5 * 60e3) return [];
  purgeAt = Date.now();
  const idx = await readLedger({ which: 'index' }).catch(() => ({}));
  const testUids = new Set([...extraUids, ...Object.entries(idx.u || {}).filter(([, x]) => isTestEmail(x?.e)).map(([u]) => u)]);
  const testFids = new Set(Object.entries(idx.f || {}).filter(([, x]) => testUids.has(x?.o)).map(([f]) => f));
  const gone = await ledgerTx((doc) => {
    const p = doc?.promos?.beta || {};
    const claims = { ...(p.claims || {}) }; const uids = { ...(p.uids || {}) };
    const out = Object.keys(claims).filter((fid) => testFids.has(fid) || testUids.has(claims[fid]?.uid));
    out.forEach((fid) => delete claims[fid]);
    const dropU = Object.keys(uids).filter((u) => testUids.has(u) || out.includes(uids[u]));
    dropU.forEach((u) => delete uids[u]);
    const grants = Object.keys(doc?.grants || {}).filter((f) => testFids.has(f) || out.includes(f));
    if (!out.length && !dropU.length && !grants.length) return { result: [] };
    const entries = [[['promos', 'beta'], { max: Number(p.max || PROMO_MAX), claimed: Object.keys(claims).length, claims, uids }]];
    grants.forEach((f) => entries.push([['grants', f], undefined]));
    const tgt = new Set([...out, ...grants]);
    entries.push([['log'], (doc.log || []).filter((l) => !tgt.has(l?.target))]);
    return { entries, result: [...tgt] };
  });
  // Display-only mirror on the family doc (service account bypasses rules).
  if (gone.length && hasServiceAccount()) {
    const tok = await serviceToken().catch(() => null);
    if (tok) for (const fid of gone) {
      await fetch(`${FS}/${docName(`families/${fid}`)}?updateMask.fieldPaths=betaProUntil&currentDocument.exists=true`, { method: 'PATCH', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify({ fields: {} }) }).catch(() => {});
    }
  }
  return gone;
}

// ---------- plan resolution (server source of truth) ----------
// The ONE resolver shared with the client (src/lib/plan-resolve.js): grant / beta gift with expiry over the family plan.
export { resolvePlan, planHeader } from '../src/lib/plan-resolve.js';

// ---------- service account (optional) ----------
let saCache = null;
export const hasServiceAccount = () => !!process.env.FIREBASE_SERVICE_ACCOUNT;
export async function serviceToken() {
  if (saCache && saCache.exp > Date.now() + 120e3) return saCache.token;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  const sa = JSON.parse(raw);
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/cloud-platform' })
    .setProtectedHeader({ alg: 'RS256', kid: sa.private_key_id, typ: 'JWT' })
    .setIssuer(sa.client_email).setSubject(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw Object.assign(new Error('sa_token_failed'), { status: 502 });
  saCache = { token: d.access_token, exp: Date.now() + Number(d.expires_in || 3600) * 1000 };
  return saCache.token;
}
// Every Auth user (service account only).
export async function listAuthUsers(token, cap = 5000) {
  const out = [];
  let next = '';
  do {
    const r = await fetch(`${IDT}/projects/${PROJECT()}/accounts:batchGet?maxResults=500${next ? `&nextPageToken=${encodeURIComponent(next)}` : ''}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw Object.assign(new Error(`batchGet ${r.status}`), { status: 502 });
    const d = await r.json();
    out.push(...(d.users || []));
    next = d.nextPageToken || '';
  } while (next && out.length < cap);
  return out;
}
export async function setAuthDisabled(token, uid, disabled) {
  const r = await fetch(`${IDT}/projects/${PROJECT()}/accounts:update`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ localId: uid, disableUser: !!disabled }),
  });
  if (!r.ok) throw Object.assign(new Error(`accounts:update ${r.status}`), { status: 502 });
  return true;
}
export async function listCollection(path, token, cap = 2000) {
  const out = [];
  let next = '';
  do {
    const r = await fetch(`${FS}/${DOCS()}/${path}?pageSize=300${next ? `&pageToken=${encodeURIComponent(next)}` : ''}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw Object.assign(new Error(`list ${path} ${r.status}`), { status: 502 });
    const d = await r.json();
    for (const x of d.documents || []) out.push({ id: x.name.split('/').pop(), data: decFields(x.fields), createTime: Date.parse(x.createTime) });
    next = d.nextPageToken || '';
  } while (next && out.length < cap);
  return out;
}

// Hong Kong day key d-YYYY-MM-DD.
export const hkDay = (ms = Date.now()) => {
  const h = new Date(ms + 8 * 3600e3);
  return `d-${h.getUTCFullYear()}-${String(h.getUTCMonth() + 1).padStart(2, '0')}-${String(h.getUTCDate()).padStart(2, '0')}`;
};

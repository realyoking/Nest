import { CONTACT_EMAIL } from '../src/contact.js';
import { toHans } from '../src/lib/hans.js';
// Shared helpers for /api/push/* (Node runtime; files starting with "_" are not deployed as functions).
// - Firebase ID token verification against Google's public JWKS (no admin key).
// - Firestore REST with either the caller's ID token (rules apply) or a service-account token (cron only).
// - Web Push sending with the VAPID keys in Vercel env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT).
// - Notification copy (zh-Hant 書面語 + English) shared by test and cron.
import crypto from 'node:crypto';
import webpush from 'web-push';
import { createRemoteJWKSet, jwtVerify, SignJWT, importPKCS8 } from 'jose';
import { firebaseConfig } from '../src/firebase-config.js';

export const projectId = () => process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const ROOT = () => `projects/${projectId()}/databases/(default)/documents`;
const BASE = () => `https://firestore.googleapis.com/v1/${ROOT()}`;

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

// Returns { uid, token } or null.
export async function verifyCaller(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  const token = /^Bearer\s+(.+)$/i.exec(h)?.[1];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId()}`,
      audience: projectId(),
    });
    if (!payload.sub) return null;
    // email / emailVerified / iat feed the shared access check (api/_gate.js: admin bypass, revoked sessions).
    return { uid: payload.sub, token, email: String(payload.email || '').toLowerCase(), emailVerified: payload.email_verified === true, iat: Number(payload.iat) || 0 };
  } catch { return null; }
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

// ---------- Firestore value encoding ----------
export function fromFs(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFs);
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  return null;
}
export function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
}
const docOf = (d) => ({ id: d.name.split('/').pop(), path: d.name.slice(d.name.indexOf('/documents/') + 11), ...Object.fromEntries(Object.entries(d.fields || {}).map(([k, v]) => [k, fromFs(v)])) });

async function fsFetch(url, token, init = {}) {
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers || {}) } });
  return r;
}
export async function fsGet(path, token) {
  const r = await fsFetch(`${BASE()}/${path}`, token);
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error(`firestore get ${r.status}`), { status: r.status });
  return docOf(await r.json());
}
export async function fsList(path, token, pageSize = 300) {
  const out = []; let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const r = await fsFetch(`${BASE()}/${path}?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, token);
    if (!r.ok) throw Object.assign(new Error(`firestore list ${r.status}`), { status: r.status });
    const j = await r.json();
    (j.documents || []).forEach((d) => out.push(docOf(d)));
    if (!j.nextPageToken) break; pageToken = j.nextPageToken;
  }
  return out;
}
// Set (create or overwrite) only the given fields; `mask` limits the update to those field paths.
export async function fsPatch(path, fields, token, mask) {
  const m = (mask || Object.keys(fields)).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const r = await fsFetch(`${BASE()}/${path}?${m}`, token, { method: 'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFs(v)])) }) });
  if (!r.ok) throw Object.assign(new Error(`firestore patch ${r.status}`), { status: r.status });
  return r.json();
}
// Create-only write (dedupe by doc id): 'created' | 'exists'. Never overwrites a doc the user already acted on.
export async function fsCreate(path, fields, token) {
  const r = await fsFetch(`${BASE()}/${path}?currentDocument.exists=false`, token, { method: 'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined).map(([k, v]) => [k, toFs(v)])) }) });
  if (r.ok) return 'created';
  if (r.status === 409 || r.status === 400) { const j = await r.json().catch(() => ({})); if (/ALREADY_EXISTS|FAILED_PRECONDITION|exists/i.test(JSON.stringify(j))) return 'exists'; }
  throw Object.assign(new Error(`firestore create ${r.status}`), { status: r.status });
}
// Raw document with its updateTime (for compare-and-set).
export async function fsGetRaw(path, token) {
  const r = await fsFetch(`${BASE()}/${path}`, token);
  if (r.status === 404) return { exists: false, data: {}, updateTime: null };
  if (!r.ok) throw Object.assign(new Error(`firestore get ${r.status}`), { status: r.status });
  const j = await r.json();
  return { exists: true, data: Object.fromEntries(Object.entries(j.fields || {}).map(([k, v]) => [k, fromFs(v)])), updateTime: j.updateTime };
}
// Overwrite with a precondition: updateTime (doc unchanged since read) or exists=false. Returns true when written.
export async function fsSetIf(path, fields, token, updateTime) {
  const pre = updateTime ? `currentDocument.updateTime=${encodeURIComponent(updateTime)}` : 'currentDocument.exists=false';
  const r = await fsFetch(`${BASE()}/${path}?${pre}`, token, { method: 'PATCH', body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, toFs(v)])) }) });
  if (r.ok) return true;
  if (r.status === 400 || r.status === 409 || r.status === 412) return false;
  throw Object.assign(new Error(`firestore set ${r.status}`), { status: r.status });
}

// Every user's profile + push subscriptions (service account only).
export async function allSubscribers(token) {
  const users = await fsList('users', token);
  const profiles = new Map(users.map((u) => [u.id, u]));
  const subsByUid = new Map();
  const add = (uid, s) => { if (!s?.endpoint) return; const l = subsByUid.get(uid) || []; if (!l.some((x) => x.endpoint === s.endpoint)) l.push(s); subsByUid.set(uid, l); };
  try { (await fsCollectionGroup('pushSubs', token)).forEach((d) => add(d.path.split('/')[1], { ...d, where: 'subcollection' })); } catch {}
  users.forEach((u) => Object.entries(u.pushSubs || {}).forEach(([id, s]) => add(u.id, { ...s, id, where: 'profile' })));
  return { profiles, subsByUid };
}

export async function fsDelete(path, token) {
  const r = await fsFetch(`${BASE()}/${path}`, token, { method: 'DELETE' });
  if (!r.ok && r.status !== 404) throw Object.assign(new Error(`firestore delete ${r.status}`), { status: r.status });
}
export async function fsCollectionGroup(collectionId, token) {
  const r = await fsFetch(`${BASE()}:runQuery`, token, { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId, allDescendants: true }], limit: 2000 } }) });
  if (!r.ok) throw Object.assign(new Error(`firestore query ${r.status}`), { status: r.status });
  return (await r.json()).filter((x) => x.document).map((x) => docOf(x.document));
}

// ---------- Subscriptions ----------
// Doc id for a subscription: "s" + 24 hex chars of sha256(endpoint). Also a valid map key in field paths.
export const subId = (endpoint) => 's' + crypto.createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 24);
export function cleanSub(s) {
  if (!s || typeof s !== 'object') return null;
  const endpoint = String(s.endpoint || '');
  const p256dh = String(s.keys?.p256dh || ''); const auth = String(s.keys?.auth || '');
  if (!/^https:\/\/[^\s]{10,900}$/.test(endpoint) || !/^[A-Za-z0-9_-]{40,200}={0,2}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,64}={0,2}$/.test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

// All of one user's stored subscriptions: users/{uid}/pushSubs/* plus the profile fallback map users/{uid}.pushSubs.
export async function subsOfUser(uid, token, profile) {
  const out = new Map();
  try { (await fsList(`users/${uid}/pushSubs`, token)).forEach((d) => d.endpoint && out.set(d.endpoint, { ...d, where: 'subcollection', id: d.id })); } catch { /* rules may not allow the subcollection yet */ }
  const p = profile === undefined ? await fsGet(`users/${uid}`, token).catch(() => null) : profile;
  Object.entries(p?.pushSubs || {}).forEach(([id, d]) => { if (d?.endpoint && !out.has(d.endpoint)) out.set(d.endpoint, { ...d, where: 'profile', id }); });
  return { subs: [...out.values()], profile: p };
}
export async function removeSub(uid, sub, token) {
  if (sub.where === 'subcollection') await fsDelete(`users/${uid}/pushSubs/${sub.id}`, token).catch(() => {});
  else await fsPatch(`users/${uid}`, {}, token, [`pushSubs.${sub.id}`]).catch(() => {});
}

// ---------- Web Push ----------
let vapidReady = false;
export function vapidConfigured() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return false;
  if (!vapidReady) { webpush.setVapidDetails(process.env.VAPID_SUBJECT || `mailto:${CONTACT_EMAIL}`, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY); vapidReady = true; }
  return true;
}
// Returns 'ok' | 'gone' (subscription expired: delete it) | 'error'.
export async function pushTo(sub, payload, { urgency = 'normal', TTL = 6 * 3600 } = {}) {
  // 简体中文 users: the zh-Hant templates are converted on the way out (opencc t2cn + wording fixes).
  if (payload?.hans) { const { hans, ...rest } = payload; payload = { ...rest, lang: 'zh-Hans', title: toHans(rest.title), body: toHans(rest.body) }; }
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify(payload), { TTL, urgency });
    return 'ok';
  } catch (e) {
    return e.statusCode === 404 || e.statusCode === 410 ? 'gone' : 'error';
  }
}

// ---------- Service account (cron only) ----------
// FIREBASE_SERVICE_ACCOUNT = the JSON key file from Firebase console → Project settings → Service accounts
// → Generate new private key (raw JSON or base64 of it). Never committed; Vercel env only.
export function serviceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')); } catch { return null; }
}
export async function serviceToken(sa) {
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datastore' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id })
    .setIssuer(sa.client_email).setSubject(sa.client_email).setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!r.ok) throw new Error(`sa token ${r.status}`);
  return (await r.json()).access_token;
}

// ---------- Copy ----------
export const T = {
  'zh-Hant': {
    testTitle: 'Nest 巢 測試通知', testBody: '通知已設定好。之後的提醒、功課及生日通知會在這裏出現。',
    briefTitle: '早安！今日摘要', briefNone: '',
    reminders: (n) => `${n} 項提醒今天到期`, remindersTomorrow: (n) => `${n} 項提醒明天到期`,
    homework: (n) => `${n} 份功課即將到期`, homeworkTomorrow: (n) => `${n} 份功課明天到期`,
    tests: (n) => `${n} 個測驗或考試即將舉行`, testsTomorrow: (n) => `${n} 個測驗或考試在明天`,
    birthday: (names) => `今天是 ${names} 的生日`,
    remTitle: '提醒', hwTitle: '功課限期', testTitle2: '測驗及考試', bdayTitle: '生日', sep: '・', tomorrowTitle: '明天要準備',
  },
  en: {
    testTitle: 'Nest test notification', testBody: 'Notifications are set up. Reminders, homework and birthdays will show up here.',
    briefTitle: 'Good morning — today at a glance', briefNone: '',
    reminders: (n) => `${n} reminder${n > 1 ? 's' : ''} due today`, remindersTomorrow: (n) => `${n} reminder${n > 1 ? 's' : ''} due tomorrow`,
    homework: (n) => `${n} homework item${n > 1 ? 's' : ''} due soon`, homeworkTomorrow: (n) => `${n} homework item${n > 1 ? 's' : ''} due tomorrow`,
    tests: (n) => `${n} test${n > 1 ? 's' : ''} coming up`, testsTomorrow: (n) => `${n} test${n > 1 ? 's' : ''} tomorrow`,
    birthday: (names) => `It is ${names}'s birthday today`,
    remTitle: 'Reminders', hwTitle: 'Homework due', testTitle2: 'Tests', bdayTitle: 'Birthday', sep: ' · ', tomorrowTitle: 'For tomorrow',
  },
};
export const langOf = (l) => (l === 'en' ? 'en' : 'zh-Hant');

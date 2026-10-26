// /api/waitlist (Nest 巢) — waitlist for the paid plans. Payments are NOT live; this only stores interest.
// POST { email, plan: 'starter'|'pro', billing?: 'monthly'|'yearly', note?, lang?, source? }  (+ optional Authorization: Bearer <Firebase ID token>)
//
// Storage, first that works:
//  1. waitlist/{w + sha256(email|plan)[0:32]} — create-only, written through Firestore REST with the caller's ID token
//     (or unauthenticated for logged-out visitors), so firestore.rules apply (`match /waitlist/{id}`: create-only + field
//     validation). The doc id dedupes by email+plan; an existing doc answers { ok, already: true }.
//  2. Fallback while that rule is not published yet:
//     - signed-in: the caller's own profile map users/{uid}.waitlist.{plan} (owner-only rule that is already live).
//     - logged-out: a placeholder Auth account (see placeholderSession) and its own users/{uid}.waitlist.{plan}.
//       Once the waitlist rule is published, step 1 succeeds and this bridge is no longer used.
// Rate limit: simple per-instance memory window per IP and per email (best effort; Edge isolates are not shared).
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { firebaseConfig } from '../src/firebase-config.js';
import { ledgerWrite } from './_ops-lib.js';

export const config = { runtime: 'edge' };

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const DOCS = () => `projects/${PROJECT()}/databases/(default)/documents`;
const FS = 'https://firestore.googleapis.com/v1';
const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PLANS = ['starter', 'pro'];
const ORIGIN = 'https://heynest.vercel.app';

const json = (status, body) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

// ---- rate limit (per isolate) ----
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return arr.length > max;
}

async function sha256hex(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const fv = (v) => (v == null ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : { stringValue: String(v) });
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fv(v)]));

async function commit(writes, token) {
  const url = `${FS}/${DOCS()}:commit${token ? '' : `?key=${firebaseConfig.apiKey}`}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', referer: `${ORIGIN}/`, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ writes }),
  });
  if (r.ok) return { ok: true };
  const text = await r.text();
  let status = '';
  try { status = JSON.parse(text)?.error?.status || ''; } catch {}
  return { ok: false, code: r.status, status };
}

// 1. waitlist/{id}, create-only.
function waitlistWrite(id, data) {
  return {
    update: { name: `${DOCS()}/waitlist/${id}`, fields: fields(data) },
    currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
  };
}
// 2. users/{uid}.waitlist.{plan} (merge; owner-only rule).
function profileWrite(uid, plan, data) {
  return {
    update: { name: `${DOCS()}/users/${uid}`, fields: { waitlist: { mapValue: { fields: { [plan]: { mapValue: { fields: fields(data) } } } } } } },
    updateMask: { fieldPaths: [`waitlist.${plan}`] },
    updateTransforms: [{ fieldPath: `waitlist.${plan}.createdAt`, setToServerValue: 'REQUEST_TIME' }],
  };
}
const isAlready = (r) => r.code === 409 || r.status === 'ALREADY_EXISTS' || r.status === 'FAILED_PRECONDITION';

// Logged-out bridge while the waitlist rule is unpublished: Anonymous sign-in is disabled on the project
// (ADMIN_ONLY_OPERATION), so the function creates a placeholder email/password Auth account whose address is
// derived from the waitlist doc id (wl-<id>@waitlist.heynest.invalid, random password that is never stored)
// and writes its own users/{uid}.waitlist.{plan}. EMAIL_EXISTS means this email+plan already joined.
async function placeholderSession(id) {
  const pw = [...crypto.getRandomValues(new Uint8Array(24))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`, {
    method: 'POST', headers: { 'content-type': 'application/json', referer: `${ORIGIN}/` },
    body: JSON.stringify({ email: `wl-${id}@waitlist.heynest.invalid`, password: pw, returnSecureToken: true }),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok) return { already: String(d?.error?.message || '').startsWith('EMAIL_EXISTS') };
  return d?.idToken && d?.localId ? { token: d.idToken, uid: d.localId } : {};
}

// Wrapper: after a successful join, also count it in the server-only admin index (plan + billing + time, no email).
export default async function handler(req) {
  let body = null;
  try { body = await req.clone().json(); } catch {}
  const res = await store(req);
  if (res.status === 200 && body) {
    try {
      const email = String(body.email || '').trim().toLowerCase();
      const plan = String(body.plan || '');
      const id = 'w' + (await sha256hex(`${email}|${plan}`)).slice(0, 32);
      await Promise.race([ledgerWrite([[['wl', id], { p: plan, b: body.billing === 'yearly' ? 'yearly' : 'monthly', at: Date.now() }]], 'index'), new Promise((r) => setTimeout(r, 1500))]);
    } catch {}
  }
  return res;
}

async function store(req) {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'bad_json' }); }

  const email = String(body?.email || '').trim().toLowerCase();
  const plan = String(body?.plan || '');
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'bad_email' });
  if (!PLANS.includes(plan)) return json(400, { error: 'bad_plan' });
  const note = String(body?.note || '').trim().slice(0, 500);
  const billing = body?.billing === 'yearly' ? 'yearly' : 'monthly';
  const lang = body?.lang === 'en' ? 'en' : 'zh-Hant';
  const source = String(body?.source || 'web').replace(/[^a-z0-9-]/gi, '').slice(0, 32) || 'web';

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  if (limited(`ip:${ip}`, 8, 10 * 60e3) || limited(`em:${email}`, 4, 10 * 60e3)) return json(429, { error: 'rate_limited' });

  // Optional caller identity.
  let uid = null; let token = null;
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    try {
      const { payload } = await jwtVerify(auth.slice(7), JWKS, { issuer: `https://securetoken.google.com/${PROJECT()}`, audience: PROJECT() });
      uid = payload.sub; token = auth.slice(7);
    } catch { return json(401, { error: 'invalid_token' }); }
  }

  const id = 'w' + (await sha256hex(`${email}|${plan}`)).slice(0, 32);
  const data = { email, plan, billing, note, lang, source, uid };

  // 1. The waitlist collection.
  const r1 = await commit([waitlistWrite(id, data)], token);
  if (r1.ok) return json(200, { ok: true, stored: 'waitlist' });
  if (isAlready(r1)) return json(200, { ok: true, already: true, stored: 'waitlist' });

  // 2. Fallbacks that work with the currently published rules.
  if (uid) {
    const r2 = await commit([profileWrite(uid, plan, data)], token);
    if (r2.ok) return json(200, { ok: true, stored: 'profile' });
    return json(503, { error: 'store_failed', detail: `${r1.code}/${r2.code}` });
  }
  const ph = await placeholderSession(id);
  if (ph.already) return json(200, { ok: true, already: true, stored: 'placeholder-profile' });
  if (ph.token) {
    const r3 = await commit([profileWrite(ph.uid, plan, { ...data, uid: null })], ph.token);
    if (r3.ok) return json(200, { ok: true, stored: 'placeholder-profile' });
    return json(503, { error: 'store_failed', detail: `${r1.code}/ph ${r3.code}` });
  }
  return json(503, { error: 'store_failed', detail: `${r1.code}/no-placeholder` });
}

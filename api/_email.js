import { SITE, SITE_HOST, IS_UPSTREAM } from '../src/site.js';
// Run 18 — email verification by 6-digit code + password-reset emails, sent through Resend (api/ops.js routes; no new
// serverless function). vercel.json: /api/app/:op → /api/ops?op=app-:op
//   POST /api/app/verify-send   ID token (email/password, unverified) {lang}  → code email; {ok, cooldown, expiresIn, to}
//   POST /api/app/verify-check  ID token {code}                               → sets emailVerified=true (service account)
//   POST /api/app/reset-send    public {email, lang}                          → reset email linking https://nesty.cyou/auth/action
// Storage: Firestore nestEmailCodes/<uid> and nestEmailCodes/r-<sha256(email)> written ONLY with the service account
// (FIREBASE_SERVICE_ACCOUNT; no client rule matches the collection → clients can never read it). Only an HMAC of the code
// is stored (key NEST_LEDGER_SECRET), with expiry (10 min), attempt counter (5, then a new code is needed), resend cooldown
// (60 s) and a per-hour send cap. Per-IP / per-uid limits in memory on top (best effort per Edge instance).
// Missing RESEND_API_KEY / service account → 503 {error:'email_not_configured'}; the app then falls back to Firebase's own
// sendEmailVerification / sendPasswordResetEmail, so nothing breaks.
import { json, fsGet, fsCommit, docName, enc, serviceToken, hasServiceAccount, sha256hex, PROJECT } from './_ops-lib.js';
import { verifyEmail, resetEmail, emailLang } from './_email-tpl.js';
import { makeCode, cleanCode, sameHex, maskEmail, CODE_TTL_MS, CODE_MAX_ATTEMPTS, RESEND_COOLDOWN_MS, MAX_SENDS_PER_HOUR, EXEMPT_EMAIL_RE } from '../src/lib/email-verify-core.js';

const IDT = 'https://identitytoolkit.googleapis.com/v1';
// Sender (must be a domain verified in your Resend account): NEST_EMAIL_FROM, e.g. "Nest <noreply@example.com>".
// Upstream default keeps the original sender name.
export const FROM = process.env.NEST_EMAIL_FROM || (IS_UPSTREAM ? 'Nesty <noreply@nesty.cyou>' : `Nest <noreply@${SITE_HOST}>`);
const COL = 'nestEmailCodes';

export const emailConfigured = () => !!process.env.RESEND_API_KEY && hasServiceAccount() && !!process.env.NEST_LEDGER_SECRET;

// ---- in-memory limiter (per Edge instance) ----
const buckets = new Map();
export function limited(key, max, windowMs, now = Date.now()) {
  const a = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (a.length >= max) { buckets.set(key, a); return true; }
  a.push(now); buckets.set(key, a);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > 3600e3) buckets.delete(k);
  return false;
}
export const _resetLimits = () => buckets.clear();
const ipOf = (req) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';

async function hmacHex(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
export const codeHash = (uid, code) => hmacHex(process.env.NEST_LEDGER_SECRET || '', `nest-email-code-v1|${uid}|${code}`);

// ---- Resend ----
export async function sendResend({ to, subject, html, text, tag }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text, tags: tag ? [{ name: 'type', value: tag }] : undefined }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.id) throw Object.assign(new Error(`resend ${r.status} ${d?.name || ''}`), { status: 502 });
  return d.id;
}

// ---- Identity Toolkit (service account) ----
async function idtAdmin(path, body, tok) {
  const r = await fetch(`${IDT}/projects/${PROJECT()}/${path}`, { method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}
async function lookupUid(uid, tok) {
  const r = await idtAdmin('accounts:lookup', { localId: [uid] }, tok);
  return r.ok ? r.d.users?.[0] || null : null;
}

const writeDoc = (path, obj, updateTime) => ({
  update: { name: docName(path), fields: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, enc(v)])) },
  currentDocument: updateTime ? { updateTime } : { exists: false }, // optimistic concurrency on every write
});
const sendsInHour = (doc, now) => (Array.isArray(doc?.sends) ? doc.sends : []).filter((t) => now - Number(t) < 3600e3);

// ---------------- verify-send ----------------
export async function verifySend(c, req, body, now = Date.now()) {
  if (!emailConfigured()) return json(503, { error: 'email_not_configured' });
  if (c.provider !== 'password') return json(400, { error: 'not_password_account' });
  if (c.emailVerified) return json(200, { ok: true, verified: true });
  if (!c.email || EXEMPT_EMAIL_RE.test(c.email)) return json(400, { error: 'exempt' });
  if (limited(`vs-ip:${ipOf(req)}`, 12, 10 * 60e3, now)) return json(429, { error: 'rate_limited', retryAfter: 600 });
  const tok = await serviceToken();
  const path = `${COL}/${c.uid}`;
  const cur = await fsGet(path, tok);
  const d = cur?.data || {};
  const wait = Number(d.sentAt || 0) + RESEND_COOLDOWN_MS - now;
  if (wait > 0) return json(429, { error: 'cooldown', retryAfter: Math.ceil(wait / 1000) });
  const sends = sendsInHour(d, now);
  if (sends.length >= MAX_SENDS_PER_HOUR) return json(429, { error: 'too_many_sends', retryAfter: Math.ceil((Number(sends[0]) + 3600e3 - now) / 1000) });
  // Server truth for the address + verified flag (the ID token may be minutes old).
  const u = await lookupUid(c.uid, tok);
  if (!u) return json(404, { error: 'no_user' });
  if (u.emailVerified) return json(200, { ok: true, verified: true });
  const email = String(u.email || c.email).toLowerCase();
  const lang = emailLang(body?.lang);
  const code = makeCode();
  const doc = { h: await codeHash(c.uid, code), exp: now + CODE_TTL_MS, att: 0, sentAt: now, sends: [...sends, now], lang, email };
  const w = await fsCommit([writeDoc(path, doc, cur?.updateTime)], tok);
  if (!w.ok) return json(409, { error: 'busy' });
  const m = verifyEmail({ code, lang });
  try { await sendResend({ to: email, ...m, tag: 'verify' }); } catch { return json(502, { error: 'send_failed' }); }
  return json(200, { ok: true, cooldown: RESEND_COOLDOWN_MS / 1000, expiresIn: CODE_TTL_MS / 1000, to: maskEmail(email) });
}

// ---------------- verify-check ----------------
export async function verifyCheck(c, req, body, now = Date.now()) {
  if (!emailConfigured()) return json(503, { error: 'email_not_configured' });
  if (c.emailVerified) return json(200, { ok: true, verified: true });
  const code = cleanCode(body?.code);
  if (code.length !== 6) return json(400, { error: 'bad_code' });
  if (limited(`vc-uid:${c.uid}`, 20, 10 * 60e3, now) || limited(`vc-ip:${ipOf(req)}`, 40, 10 * 60e3, now)) return json(429, { error: 'rate_limited', retryAfter: 600 });
  const tok = await serviceToken();
  const path = `${COL}/${c.uid}`;
  const cur = await fsGet(path, tok);
  const d = cur?.data;
  if (!d?.h) return json(400, { error: 'no_code' });
  if (now > Number(d.exp || 0)) return json(400, { error: 'expired' });
  if (Number(d.att || 0) >= CODE_MAX_ATTEMPTS) return json(429, { error: 'too_many_attempts' });
  const ok = sameHex(await codeHash(c.uid, code), d.h);
  if (!ok) {
    const att = Number(d.att || 0) + 1;
    // updateTime precondition: parallel guesses can't share one attempt slot.
    const w = await fsCommit([writeDoc(path, { ...d, att }, cur.updateTime)], tok);
    if (!w.ok) return json(409, { error: 'busy' });
    return json(400, att >= CODE_MAX_ATTEMPTS ? { error: 'too_many_attempts', left: 0 } : { error: 'wrong_code', left: CODE_MAX_ATTEMPTS - att });
  }
  // One-time: burn the code first (precondition), then flip the Auth flag.
  const burn = await fsCommit([{ delete: docName(path), currentDocument: { updateTime: cur.updateTime } }], tok);
  if (!burn.ok) return json(409, { error: 'busy' });
  const r = await idtAdmin('accounts:update', { localId: c.uid, emailVerified: true }, tok);
  if (!r.ok) return json(502, { error: 'update_failed' });
  return json(200, { ok: true, verified: true });
}

// ---------------- reset-send (public) ----------------
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
export async function resetSend(req, body, now = Date.now()) {
  if (!emailConfigured()) return json(503, { error: 'email_not_configured' });
  const email = String(body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return json(400, { error: 'bad_email' });
  if (limited(`rs-ip:${ipOf(req)}`, 6, 10 * 60e3, now)) return json(429, { error: 'rate_limited', retryAfter: 600 });
  const lang = emailLang(body?.lang);
  const tok = await serviceToken();
  const path = `${COL}/r-${(await sha256hex(email)).slice(0, 40)}`;
  const cur = await fsGet(path, tok);
  const d = cur?.data || {};
  const wait = Number(d.sentAt || 0) + RESEND_COOLDOWN_MS - now;
  if (wait > 0) return json(429, { error: 'cooldown', retryAfter: Math.ceil(wait / 1000) });
  const sends = sendsInHour(d, now);
  if (sends.length >= MAX_SENDS_PER_HOUR) return json(429, { error: 'too_many_sends', retryAfter: 3600 });
  const w = await fsCommit([writeDoc(path, { sentAt: now, sends: [...sends, now], exp: now + 3600e3 }, cur?.updateTime)], tok);
  if (!w.ok) return json(409, { error: 'busy' });
  if (EXEMPT_EMAIL_RE.test(email)) return json(200, { ok: true }); // never mail the invalid system / test domains
  // Unknown address: same answer as success (no account enumeration). Checked up front (the admin sendOobCode error text
  // for a missing user is not stable).
  const known = await idtAdmin('accounts:lookup', { email: [email] }, tok);
  if (known.ok && !(known.d.users || []).length) return json(200, { ok: true });
  const r = await idtAdmin('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email, returnOobLink: true }, tok);
  if (!r.ok) return /NOT_FOUND/.test(r.d?.error?.message || '') ? json(200, { ok: true }) : json(502, { error: 'oob_failed' });
  const oob = (() => { try { return new URL(r.d.oobLink).searchParams.get('oobCode'); } catch { return null; } })();
  if (!oob) return json(502, { error: 'oob_failed' });
  const link = `${SITE}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(oob)}&lang=${lang}`;
  const m = resetEmail({ link, email, lang });
  try { await sendResend({ to: email, ...m, tag: 'reset' }); } catch { return json(502, { error: 'send_failed' }); }
  return json(200, { ok: true });
}

// Router used by api/ops.js
export async function emailOps(op, req, callerOf) {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const body = await req.json().catch(() => ({}));
  try {
    if (op === 'app-reset-send') return await resetSend(req, body);
    const c = await callerOf(req);
    if (!c) return json(401, { error: 'unauthorized' });
    if (op === 'app-verify-send') return await verifySend(c, req, body);
    if (op === 'app-verify-check') return await verifyCheck(c, req, body);
    return json(404, { error: 'not_found' });
  } catch (e) { return json(e.status || 500, { error: 'server_error' }); }
}

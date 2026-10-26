// Shared helpers for the server-side Google connector flow (/api/oauth/*, /api/google/*). Node runtime.
// Secrets live only in Vercel env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENC_KEY (32 random bytes, base64).
//
// Storage: the refresh token of each connected Google account is encrypted with AES-256-GCM (key TOKEN_ENC_KEY,
// AAD = "nest-gv1|<uid>|<email>", so a blob only decrypts for the user + account it was made for) and kept in the
// owner-only profile doc users/{uid}.googleVault.<key(email)> = { email, enc, scopes, at }. The browser can read the
// blob but never decrypt it; only these functions can. There is no service account, so the callback hands the
// encrypted blob back to the signed-in app, which writes it to its own profile (rules: owner-only, already live).
import { APP_HOSTS, APP_ORIGIN } from '../src/site.js';
import crypto from 'node:crypto';

export const CLIENT_ID = () => process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
const SECRET = () => process.env.GOOGLE_CLIENT_SECRET || '';
export const configured = () => !!(CLIENT_ID() && SECRET() && process.env.TOKEN_ENC_KEY);

// Hostnames the app runs on (src/site.js: the site + any legacy hosts). Each needs
// https://<host>/api/oauth/callback registered on the OAuth web client.
export const HOSTS = APP_HOSTS; // src/site.js (adds nesty.cyou once AUTH_ON_SITE)
export const PRIMARY = APP_ORIGIN;
export function originOf(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  return HOSTS.includes(host) ? `https://${host}` : PRIMARY;
}
export const callbackUri = (origin) => `${origin}/api/oauth/callback`;

const encKey = () => {
  const raw = process.env.TOKEN_ENC_KEY || '';
  const b = Buffer.from(raw, 'base64');
  if (b.length !== 32) throw Object.assign(new Error('enc_key'), { status: 503 });
  return b;
};
const macKey = () => crypto.createHmac('sha256', encKey()).update('nest-oauth-state-v1').digest();
const aad = (uid, email) => Buffer.from(`nest-gv1|${uid}|${email}`);
const b64u = (b) => Buffer.from(b).toString('base64url');

export function encrypt(plain, uid, email) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  c.setAAD(aad(uid, email));
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return 'v1.' + b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}
export function decrypt(blob, uid, email) {
  const s = String(blob || '');
  if (!s.startsWith('v1.')) throw new Error('bad_blob');
  const b = Buffer.from(s.slice(3), 'base64url');
  const d = crypto.createDecipheriv('aes-256-gcm', encKey(), b.subarray(0, 12));
  d.setAAD(aad(uid, email));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

// Map key for an email inside googleVault (emails contain dots, which field paths would split on).
export const vaultKey = (email) => 'g' + crypto.createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 24);

// Signed, short-lived OAuth state: { uid, origin, nonce, exp, ... } — HMAC-SHA256, no storage needed.
export function signState(obj) {
  const body = b64u(JSON.stringify(obj));
  return `${body}.${b64u(crypto.createHmac('sha256', macKey()).update(body).digest())}`;
}
export function readState(state) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', macKey()).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return o.exp > Date.now() ? o : null; } catch { return null; }
}

// Sealed state (v2): AES-256-GCM of the whole JSON (uid, origin, nonce, exp, the caller's Firebase ID token, services to
// select). Google only ever sees ciphertext; the callback can save the account server-side with the ID token, so the
// flow no longer depends on the browser that comes back having the app's localStorage (iOS home-screen apps return in a
// Safari sheet with separate storage; desktop popups lose window.opener because of COOP on accounts.google.com).
export function sealState(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  c.setAAD(Buffer.from('nest-state-v2'));
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return 's2.' + b64u(Buffer.concat([iv, c.getAuthTag(), ct]));
}
export function openState(state) {
  const s = String(state || '');
  if (!s.startsWith('s2.')) return readState(s);
  try {
    const b = Buffer.from(s.slice(3), 'base64url');
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), b.subarray(0, 12));
    d.setAAD(Buffer.from('nest-state-v2'));
    d.setAuthTag(b.subarray(12, 28));
    const o = JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8'));
    return o.exp > Date.now() ? o : null;
  } catch { return null; }
}

// Scopes each connector needs (same as src/lib/google.js GOOGLE_SCOPES). Every consent asks for ALL of them at once.
export const SERVICE_SCOPES = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  googlecalendar: ['https://www.googleapis.com/auth/calendar.readonly'],
  googleclassroom: ['https://www.googleapis.com/auth/classroom.courses.readonly', 'https://www.googleapis.com/auth/classroom.coursework.me.readonly'],
  googledrive: ['https://www.googleapis.com/auth/drive.readonly'],
};
// calendar.events: create / edit / delete in the Calendar tab (requested, not required: read keeps working without it).
export const EXTRA_SCOPES = ['https://www.googleapis.com/auth/classroom.announcements.readonly', 'https://www.googleapis.com/auth/calendar.events'];
export const ALL_SCOPES = [...Object.values(SERVICE_SCOPES).flat(), ...EXTRA_SCOPES];
export const SERVICES = Object.keys(SERVICE_SCOPES);
// Google reports classroom.coursework.me.readonly back as classroom.student-submissions.me.readonly; broader scopes also count.
const A = 'https://www.googleapis.com/auth/';
const SCOPE_EQUIV = {
  [`${A}classroom.coursework.me.readonly`]: [`${A}classroom.student-submissions.me.readonly`, `${A}classroom.coursework.me`, `${A}classroom.student-submissions.me`],
  [`${A}classroom.courses.readonly`]: [`${A}classroom.courses`],
  [`${A}drive.readonly`]: [`${A}drive`],
  [`${A}gmail.readonly`]: [`${A}gmail.modify`, 'https://mail.google.com/'],
  [`${A}calendar.readonly`]: [`${A}calendar`],
};
const hasScope = (scopes, x) => (scopes || []).includes(x) || (SCOPE_EQUIV[x] || []).some((y) => (scopes || []).includes(y));
export const missingServices = (scopes) => SERVICES.filter((id) => !SERVICE_SCOPES[id].every((x) => hasScope(scopes, x)));

async function tokenCall(params) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID(), client_secret: SECRET(), ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `token_${r.status}`), { code: j.error || `token_${r.status}`, status: r.status, detail: String(j.error_description || '').slice(0, 200) });
  return j;
}
export const exchangeCode = (code, redirectUri) => tokenCall({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
export const refreshAccess = (refreshToken) => tokenCall({ grant_type: 'refresh_token', refresh_token: refreshToken });
export async function revoke(token) {
  try { await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }); } catch {}
}
export function idTokenClaims(idToken) {
  try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}
export const apiScopes = (scope) => String(scope || '').split(' ').filter((x) => x.startsWith('https://www.googleapis.com/auth/') && !/userinfo\.(email|profile)$/.test(x));

// Fresh access token for one vault entry. Returns { email, token, scopes, expiresIn } or { email, error }.
export async function accessFor(uid, entry) {
  const email = String(entry?.email || '').toLowerCase();
  if (!entry?.enc) return { email, error: 'no_refresh' };
  let rt;
  try { rt = decrypt(entry.enc, uid, email); } catch { return { email, error: 'reauth', detail: 'stored token could not be decrypted' }; }
  try {
    const j = await refreshAccess(rt);
    return { email, token: j.access_token, scopes: apiScopes(j.scope), expiresIn: Number(j.expires_in) || 3600 };
  } catch (e) {
    return { email, error: e.code === 'invalid_grant' ? 'reauth' : 'refresh_failed', detail: [e.code, e.detail].filter(Boolean).join(': ') };
  }
}
// Hook for the push cron (once FIREBASE_SERVICE_ACCOUNT exists): read users/{uid} with a service-account token and
// call accessFor(uid, entry) for each Object.values(profile.googleVault) to fetch Classroom deadlines server-side.

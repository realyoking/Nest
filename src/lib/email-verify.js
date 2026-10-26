// Run 18 — client for the email-code verification + Resend password-reset ops (api/_email.js via /api/app/*).
// When the server answers 503 email_not_configured (no RESEND_API_KEY), we fall back to Firebase's own emails:
// sendEmailVerification (link) and sendPasswordResetEmail, so sign-up / reset never break.
import * as be from './backend.js';
export { needsVerify } from './email-verify-core.js';

const MOCK_CODE = '246810'; // mock builds only (vite --mode mock); never used against the real server
async function post(path, body, withToken = true) {
  const headers = { 'content-type': 'application/json' };
  if (withToken) { const t = await be.getIdToken(); if (t) headers.authorization = `Bearer ${t}`; }
  let r;
  try { r = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body || {}) }); } catch { return { status: 0, error: 'network' }; }
  const d = await r.json().catch(() => ({}));
  return { status: r.status, ...d };
}
export const userReloaded = () => window.dispatchEvent(new Event('nest:user-reloaded'));

// → { ok, cooldown, to } | { fallback: true } | { verified: true } | { error, retryAfter? }
export async function sendCode(lang) {
  if (be.MOCK) { await new Promise((s) => setTimeout(s, 350)); return { ok: true, cooldown: 60, expiresIn: 600, to: 'm•••@example.com' }; }
  const r = await post('/api/app/verify-send', { lang });
  if (r.status === 503 && r.error === 'email_not_configured') {
    try { await be.sendVerifyFallback(); return { fallback: true }; } catch (e) { return { error: e?.code === 'auth/too-many-requests' ? 'rate_limited' : 'send_failed' }; }
  }
  return r;
}
// → { ok } | { error: 'wrong_code', left } | { error }
export async function checkCode(code) {
  if (be.MOCK) { await new Promise((s) => setTimeout(s, 450)); return code === MOCK_CODE ? { ok: true } : { error: 'wrong_code', left: 4 }; }
  return post('/api/app/verify-check', { code });
}
// After a correct code: refresh the Firebase user + token (emailVerified=true) and let the session re-render.
export async function finishVerified() { try { await be.reloadUser(); } catch { /* the next token refresh picks it up */ } userReloaded(); }
// "I've clicked the link" (fallback mode): true once Firebase reports the address verified.
export async function recheckVerified() { const u = await be.reloadUser().catch(() => null); userReloaded(); return !!u?.emailVerified; }

// Forgot password: branded Resend email linking https://nesty.cyou/auth/action; Firebase default email as the fallback.
export async function resetPasswordEmail(email, lang) {
  if (be.MOCK) return be.resetPassword(email);
  const r = await post('/api/app/reset-send', { email, lang }, false);
  if (r.ok) return true;
  if (r.status === 400 && r.error === 'bad_email') throw Object.assign(new Error('bad_email'), { code: 'auth/invalid-email' });
  if (r.status === 429) throw Object.assign(new Error(r.error), { code: 'auth/too-many-requests' });
  return resetPasswordFallback(email); // 503 not configured, 5xx, network
}
export const resetPasswordFallback = (email) => be.resetPassword(email); // Firebase sendPasswordResetEmail

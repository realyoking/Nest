// Beta promo (client side). The server (/api/ops) owns the counter, the claim and plan resolution.
// A pending code in localStorage only means "bring the user back to /beta" after sign-up, a Google redirect sign-in
// or onboarding. Nothing is ever claimed automatically: the claim is the explicit button on /beta.
export const PROMO_CODE = 'BETA';
import { reportGate } from './gate-errors.js';
const KEY = 'nest.promo';
const RESULT = 'nest.promo.result';
const WEEK = 7 * 864e5;

export function stashPromo(code = PROMO_CODE) {
  try { localStorage.setItem(KEY, JSON.stringify({ code: String(code).toUpperCase(), at: Date.now() })); sessionStorage.setItem(KEY, String(code).toUpperCase()); } catch {}
}
export function pendingPromo() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v && v.code === PROMO_CODE && Date.now() - v.at < WEEK) return v.code;
    if (sessionStorage.getItem(KEY) === PROMO_CODE) return PROMO_CODE;
  } catch {}
  return null;
}
export function clearPromo() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch {} }
export function saveResult(r) { try { sessionStorage.setItem(RESULT, JSON.stringify(r)); } catch {} window.dispatchEvent(new CustomEvent('nest:promo', { detail: r })); }
export function lastResult() { try { return JSON.parse(sessionStorage.getItem(RESULT) || 'null'); } catch { return null; } }

export async function promoStatus() {
  const r = await fetch('/api/promo', { cache: 'no-store' });
  if (!r.ok) throw new Error('status');
  return r.json();
}
async function post(path, getIdToken, body = {}) {
  const token = await getIdToken();
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const err = Object.assign(new Error(d.error || 'error'), { code: d.error || 'error', status: r.status, ...(d.feature ? { feature: d.feature } : {}), ...(d.message ? { gateMessage: d.message } : {}) }); reportGate(err); throw err; }
  return d;
}
export const pingPlan = (getIdToken) => post('/api/promo/ping', getIdToken);
export const claimBeta = (getIdToken) => post('/api/promo/claim', getIdToken, { code: PROMO_CODE });
export const redeemCode = (getIdToken, code) => post('/api/promo/claim', getIdToken, { code: String(code || '').trim().toUpperCase() });

// GET /api/oauth/callback?code&state  — Google redirects here (registered for every app hostname).
// Exchanges the code (client secret stays server-side), encrypts the refresh token for this uid + account and SAVES the
// account straight into users/{uid} (googleAccounts, serviceAccounts, connections, googleVault.<key>) with the caller's
// Firebase ID token carried inside the sealed state (Firestore rules apply: owner-only profile).
// Then it sends the browser to /oauth-callback.html#nest=3&saved=1&… which tells any open Nest window and returns.
// Because the save happens here, it works even when the return lands in a different browser context than the app
// (iOS home-screen app → Safari sheet with separate storage; desktop popup without window.opener).
// If the save fails (e.g. ID token expired) it falls back to handing `enc` to the app (nest=2 path, app writes it).
// GET /api/oauth/callback?health=1 → { configured, client: 'ok'|'invalid'|… }
import { send, fsGet, fsPatch } from '../_push-lib.js';
import { configured, originOf, callbackUri, openState, exchangeCode, encrypt, idTokenClaims, apiScopes, PRIMARY, vaultKey, SERVICES, missingServices } from '../_google-lib.js';

function back(res, origin, params) {
  res.statusCode = 302;
  res.setHeader('cache-control', 'no-store');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('location', `${origin}/oauth-callback.html#${new URLSearchParams(params)}`);
  res.end();
}

async function saveAccount(st, acct) {
  const { uid, idt } = st;
  const profile = (await fsGet(`users/${uid}`, idt)) || {};
  const accounts = (Array.isArray(profile.googleAccounts) ? profile.googleAccounts : []).filter((a) => a && a.email);
  const prev = accounts.find((a) => String(a.email).toLowerCase() === acct.email);
  const now = new Date().toISOString();
  const googleAccounts = [...accounts.filter((a) => String(a.email).toLowerCase() !== acct.email), {
    email: acct.email, name: acct.name || prev?.name || '', photo: acct.photo || prev?.photo || '', scopes: acct.scopes, addedAt: prev?.addedAt || now,
  }].sort((a, b) => String(a.addedAt).localeCompare(String(b.addedAt)));
  const all = googleAccounts.map((a) => a.email);
  const connections = { ...(profile.connections || {}) };
  const serviceAccounts = {};
  for (const id of SERVICES) {
    const cur = profile.serviceAccounts?.[id];
    serviceAccounts[id] = Array.isArray(cur) ? cur.filter((e) => all.includes(e)) : (connections[id] ? accounts.map((a) => String(a.email).toLowerCase()) : []);
  }
  for (const id of st.sel || []) { serviceAccounts[id] = [...new Set([...serviceAccounts[id], acct.email])]; connections[id] = true; }
  const key = vaultKey(acct.email);
  await fsPatch(`users/${uid}`, {
    googleAccounts, serviceAccounts, connections,
    googleVault: { [key]: { email: acct.email, enc: acct.enc, scopes: acct.scopes, missing: missingServices(acct.scopes), at: now } },
    updatedAt: new Date(),
  }, idt, ['googleAccounts', 'serviceAccounts', 'connections', `googleVault.${key}`, 'updatedAt']);
  return now;
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.searchParams;
  if (p.get('health')) {
    if (!configured()) return send(res, 200, { configured: false });
    try { await exchangeCode('4/invalid-health-check', callbackUri(PRIMARY)); return send(res, 200, { configured: true, client: 'unexpected' }); }
    catch (e) { return send(res, 200, { configured: true, client: e.code === 'invalid_grant' ? 'ok' : e.code === 'invalid_client' || e.code === 'unauthorized_client' ? 'invalid' : String(e.code) }); }
  }
  const st = openState(p.get('state'));
  const origin = st?.origin || originOf(req);
  if (!st) return back(res, origin, { error: 'state_mismatch' });
  if (p.get('error')) return back(res, origin, { error: p.get('error'), detail: String(p.get('error_description') || '').slice(0, 200), state: st.n });
  const code = p.get('code');
  if (!code || !configured()) return back(res, origin, { error: code ? 'not_configured' : 'no_code', state: st.n });
  let j;
  try { j = await exchangeCode(code, callbackUri(st.origin)); }
  catch (e) { return back(res, origin, { error: e.code || 'exchange_failed', detail: e.detail || '', state: st.n }); }
  const c = idTokenClaims(j.id_token);
  const email = String(c.email || '').toLowerCase();
  if (!email) return back(res, origin, { error: 'no_email', state: st.n });
  if (!j.refresh_token) return back(res, origin, { error: 'no_refresh', state: st.n });
  const scopes = apiScopes(j.scope);
  const acct = { email, name: c.name || '', photo: c.picture || '', scopes, enc: encrypt(j.refresh_token, st.uid, email) };
  const out = { nest: '3', state: st.n, email, name: acct.name, photo: acct.photo, scopes: scopes.join(' '), token: j.access_token || '', expires_in: String(j.expires_in || 3600), missing: missingServices(scopes).join(' ') };
  if (st.idt) {
    try { out.at = await saveAccount(st, acct); out.saved = '1'; }
    catch (e) { out.saveErr = String(e.status || e.message || 'save_failed'); }
  }
  if (!out.saved) { out.enc = acct.enc; out.sel = (st.sel || []).join(' '); }
  return back(res, origin, out);
}

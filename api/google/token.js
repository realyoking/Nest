// POST /api/google/token  (Authorization: Bearer <Firebase ID token>)  body { emails?: [...] }
// Reads the caller's own profile (users/{uid}, with the caller's token so rules apply), decrypts the stored refresh
// token of each requested connected account and returns fresh access tokens:
// { tokens: { email: { token, scopes, expiresIn, at } }, failed: { email: 'reauth'|'no_refresh'|'refresh_failed' }, details: { email: 'google text' } }
import { send, verifyCaller, readBody, fsGet } from '../_push-lib.js';
import { configured, accessFor } from '../_google-lib.js';
import { accessGate } from '../_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  const gateP = accessGate(me);
  const body = await readBody(req);
  let profile;
  try { profile = await fsGet(`users/${me.uid}`, me.token); } catch (e) { return send(res, 502, { error: 'profile_read', status: e.status || 0 }); }
  { const g = await gateP; if (g) return send(res, g[0], g[1]); }
  const vault = Object.values(profile?.googleVault || {}).filter((v) => v && v.email && v.enc)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))); // newest entry per email wins
  const want = Array.isArray(body.emails) ? body.emails.map((e) => String(e).toLowerCase()) : null;
  const tokens = {}; const failed = {}; const details = {};
  if (want) for (const e of want) if (!vault.some((v) => String(v.email).toLowerCase() === e)) failed[e] = 'no_refresh';
  const seen = new Set();
  const list = vault.filter((v) => { const e = String(v.email).toLowerCase(); if (seen.has(e)) return false; seen.add(e); return !want || want.includes(e); }).slice(0, 10);
  (await Promise.all(list.map(async (v) => ({ ...(await accessFor(me.uid, v)), at: v.at || '' })))).forEach((r) => {
    if (r.token) tokens[r.email] = { token: r.token, scopes: r.scopes, expiresIn: r.expiresIn, at: r.at };
    else { failed[r.email] = r.error; if (r.detail) details[r.email] = r.detail; }
  });
  return send(res, 200, { tokens, failed, details });
}

// POST /api/google/disconnect  (Authorization: Bearer <Firebase ID token>)  body { email }
// Revokes the account's refresh token at Google and deletes users/{uid}.googleVault.<key> (caller's token, rules apply).
import { send, verifyCaller, readBody, fsGet, fsPatch } from '../_push-lib.js';
import { decrypt, revoke, vaultKey } from '../_google-lib.js';
import { accessGate } from '../_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  // Removing one's own connection still works in maintenance / while suspended; a revoked session cannot.
  { const g = await accessGate(me, { soft: ['maintenance', 'account_disabled', 'signup_closed'] }); if (g) return send(res, g[0], g[1]); }
  const email = String((await readBody(req)).email || '').trim().toLowerCase();
  if (!email) return send(res, 400, { error: 'bad_email' });
  let profile = null;
  try { profile = await fsGet(`users/${me.uid}`, me.token); } catch {}
  const entries = Object.entries(profile?.googleVault || {}).filter(([, v]) => String(v?.email || '').toLowerCase() === email);
  let revoked = false;
  for (const [, v] of entries) { try { await revoke(decrypt(v.enc, me.uid, email)); revoked = true; } catch {} }
  const keys = [...new Set([vaultKey(email), ...entries.map(([k]) => k)])];
  try { await fsPatch(`users/${me.uid}`, {}, me.token, keys.map((k) => `googleVault.${k}`)); } catch (e) { return send(res, 502, { error: 'store_failed', revoked }); }
  return send(res, 200, { ok: true, revoked });
}

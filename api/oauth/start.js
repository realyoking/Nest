// POST /api/oauth/start  (Authorization: Bearer <Firebase ID token>)
// body { select?: [serviceIds], hint?, nonce }  →  { url }
// The Google consent URL for the server-side authorization-code flow. It ALWAYS asks for every connector scope at once
// (Gmail, Calendar, Classroom, Drive), access_type=offline + prompt=consent so a refresh token always comes back.
// The state is sealed (AES-GCM) and carries uid, origin, nonce, the services to switch on, and the caller's ID token,
// so /api/oauth/callback can save the account to the user's profile itself — no client storage needed on the way back.
import { send, verifyCaller, readBody } from '../_push-lib.js';
import { CLIENT_ID, configured, originOf, callbackUri, sealState, ALL_SCOPES, SERVICES } from '../_google-lib.js';
import { accessGate } from '../_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  { const g = await accessGate(me); if (g) return send(res, g[0], g[1]); }
  const body = await readBody(req);
  const nonce = String(body.nonce || '').replace(/[^a-f0-9]/gi, '').slice(0, 64);
  if (nonce.length < 16) return send(res, 400, { error: 'bad_nonce' });
  const select = (Array.isArray(body.select) ? body.select : []).filter((s) => SERVICES.includes(s));
  const origin = originOf(req);
  const state = sealState({ uid: me.uid, origin, n: nonce, sel: select, idt: me.token, exp: Date.now() + 20 * 60e3 });
  const q = new URLSearchParams({
    client_id: CLIENT_ID(), redirect_uri: callbackUri(origin), response_type: 'code',
    scope: ['openid', 'email', 'profile', ...ALL_SCOPES].join(' '),
    access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true', state,
  });
  const hint = String(body.hint || '').trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+$/.test(hint)) q.set('login_hint', hint);
  return send(res, 200, { url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
}

// /api/push/subscribe — store or remove this device's Web Push subscription for the signed-in user.
// POST   { subscription, ua }  → writes users/{uid}/pushSubs/{id} with the caller's ID token (rules apply).
//        If the live rules do not allow that path yet, falls back to the owner-only profile map users/{uid}.pushSubs.{id}.
// DELETE ?id=<id>               → removes it from both places.
// GET                           → { publicKey } (VAPID public key; public by design).
import { send, verifyCaller, readBody, cleanSub, subId, fsPatch, fsDelete } from '../_push-lib.js';
import { accessGate } from '../_gate.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return send(res, 200, { publicKey: process.env.VAPID_PUBLIC_KEY || null });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  // Unsubscribing (DELETE) still works in maintenance / while suspended; a revoked session cannot do either.
  { const g = await accessGate(me, { soft: req.method === 'DELETE' ? ['maintenance', 'account_disabled', 'signup_closed'] : [] }); if (g) return send(res, g[0], g[1]); }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || new URL(req.url, 'http://x').searchParams.get('id') || '');
    if (!/^s[0-9a-f]{24}$/.test(id)) return send(res, 400, { error: 'bad_id' });
    await fsDelete(`users/${me.uid}/pushSubs/${id}`, me.token).catch(() => {});
    await fsPatch(`users/${me.uid}`, {}, me.token, [`pushSubs.${id}`]).catch(() => {});
    return send(res, 200, { ok: true });
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const body = await readBody(req);
  const sub = cleanSub(body.subscription);
  if (!sub) return send(res, 400, { error: 'bad_subscription' });
  const id = subId(sub.endpoint);
  const data = { endpoint: sub.endpoint, keys: sub.keys, ua: String(body.ua || req.headers['user-agent'] || '').slice(0, 300), createdAt: new Date() };
  try {
    await fsPatch(`users/${me.uid}/pushSubs/${id}`, data, me.token);
    return send(res, 200, { ok: true, id, stored: 'subcollection' });
  } catch (e) {
    if (e.status !== 403) return send(res, 502, { error: 'store_failed', status: e.status || 0 });
  }
  try {
    await fsPatch(`users/${me.uid}`, { pushSubs: { [id]: data } }, me.token, [`pushSubs.${id}`]);
    return send(res, 200, { ok: true, id, stored: 'profile' });
  } catch (e) {
    return send(res, 502, { error: 'store_failed', status: e.status || 0 });
  }
}

// /api/push/test — sends a test notification to the CALLER's own devices only.
// Auth: Firebase ID token (Bearer). Reads the caller's stored subscriptions with their own token;
// a { subscription } in the body is included too, so the test works before the rules are published.
import { send, verifyCaller, readBody, cleanSub, subsOfUser, removeSub, vapidConfigured, pushTo, T, langOf } from '../_push-lib.js';
import { accessGate } from '../_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  if (!vapidConfigured()) return send(res, 503, { error: 'vapid_missing' });
  { const g = await accessGate(me); if (g) return send(res, g[0], g[1]); }
  const body = await readBody(req);
  const { subs, profile } = await subsOfUser(me.uid, me.token);
  const extra = cleanSub(body.subscription);
  if (extra && !subs.some((s) => s.endpoint === extra.endpoint)) subs.push({ ...extra, where: 'body' });
  if (!subs.length) return send(res, 400, { error: 'no_subscription' });
  const L = T[langOf(body.lang || profile?.prefs?.lang)];
  const payload = { title: L.testTitle, body: L.testBody, url: '/app/settings', tag: 'nest-test', lang: langOf(body.lang || profile?.prefs?.lang) };
  let sent = 0, failed = 0, removed = 0;
  await Promise.all(subs.map(async (s) => {
    const r = await pushTo(s, { ...payload, hans: (body.lang || profile?.prefs?.lang) === 'zh-Hans' });
    if (r === 'ok') sent++; else failed++;
    if (r === 'gone' && s.where !== 'body') { removed++; await removeSub(me.uid, s, me.token); }
  }));
  return send(res, 200, { ok: sent > 0, sent, failed, removed, total: subs.length });
}

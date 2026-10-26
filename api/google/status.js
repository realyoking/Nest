// POST /api/google/status  (Authorization: Bearer <Firebase ID token>)
// Diagnostics for the Connections page: for every stored Google account → refresh result, granted scopes, missing
// services, and one tiny read per service with Google's own error text. Never returns tokens.
import { send, verifyCaller, fsGet } from '../_push-lib.js';
import { configured, accessFor, missingServices } from '../_google-lib.js';
import { accessGate } from '../_gate.js';

const PROBES = {
  gmail: 'https://gmail.googleapis.com/gmail/v1/users/me/profile',
  googlecalendar: 'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1',
  googleclassroom: 'https://classroom.googleapis.com/v1/courses?pageSize=1',
  googledrive: 'https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)',
};
async function probe(url, token) {
  try {
    const r = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, status: r.status, message: String(j.error?.message || j.error_description || j.error || '').slice(0, 240), reason: j.error?.errors?.[0]?.reason || j.error?.status || '' };
  } catch (e) { return { ok: false, status: 0, message: String(e.message || e).slice(0, 120) }; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  if (!configured()) return send(res, 503, { error: 'not_configured' });
  const gateP = accessGate(me);
  let profile;
  try { profile = await fsGet(`users/${me.uid}`, me.token); } catch (e) { return send(res, 502, { error: 'profile_read', status: e.status || 0 }); }
  { const g = await gateP; if (g) return send(res, g[0], g[1]); }
  const vault = Object.values(profile?.googleVault || {}).filter((v) => v && v.email && v.enc)
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  const seen = new Set();
  const linked = (profile?.googleAccounts || []).map((a) => String(a?.email || '').toLowerCase());
  const accounts = await Promise.all(vault.filter((v) => { const e = String(v.email).toLowerCase(); if (seen.has(e)) return false; seen.add(e); return true; }).slice(0, 10).map(async (v) => {
    const r = await accessFor(me.uid, v);
    if (!r.token) return { email: r.email, ok: false, error: r.error, detail: r.detail || '', at: v.at || '' };
    const services = {};
    await Promise.all(Object.entries(PROBES).map(async ([id, url]) => { services[id] = { ...(await probe(url, r.token)), scopeListed: !missingServices(r.scopes).includes(id) }; }));
    return { email: r.email, ok: true, scopes: r.scopes, missing: missingServices(r.scopes), services, at: v.at || '', savedBy: Array.isArray(v.missing) ? 'server' : 'app' };
  }));
  const noVault = linked.filter((e) => e && !seen.has(e));
  return send(res, 200, { accounts, noVault });
}

// Run 19 — GET /api/ops?op=status-all: every server-side check of the public status page (status.nesty.cyou) in ONE
// invocation, run in parallel with a short timeout each. Booleans + checkedAt only (no secrets, no error details).
// Always 200 (so the Vercel CDN caches outages too) — the page reads the booleans, `ok` is the overall flag.
// CDN: vercel-cdn-cache-control max-age=60 + stale-while-revalidate → all visitors share one result, ≈1 invocation/min.
//   app    → service account token + Firestore list families (pageSize=1, name only)
//   ai     → provider GET /v1/models lists agnes-3.0-flash (free, no tokens)
//   push   → VAPID keys set + service account + Firestore list users (pageSize=1, name only)
//   google → OAuth web client: token exchange of a dummy code answers invalid_grant (= client id/secret accepted)
// The old endpoints (/api/promo/health, /api/push/cron?health=1, /api/oauth/callback?health=1, op=status-ai) still work.
import { hasServiceAccount, serviceToken, PROJECT } from './_ops-lib.js';
import { APP_ORIGIN } from '../src/site.js';

export const STATUS_TIMEOUT_MS = 4000;
export const STATUS_HEADERS = {
  'cache-control': 'public, max-age=30',
  'vercel-cdn-cache-control': 'max-age=60, stale-while-revalidate=60',
  'access-control-allow-origin': '*',
};

// Resolves to the check's boolean, or false on throw / timeout (never rejects).
export function within(ms, fn) {
  const ctl = new AbortController();
  let tm;
  const timeout = new Promise((r) => { tm = setTimeout(() => { ctl.abort(); r(false); }, ms); });
  const run = Promise.resolve().then(() => fn(ctl.signal)).then((v) => v === true, () => false);
  return Promise.race([run, timeout]).finally(() => clearTimeout(tm));
}

const fsProbe = async (col, token, signal, f) => {
  const r = await f(`https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents/${col}?pageSize=1&mask.fieldPaths=__name__`, { headers: { authorization: `Bearer ${token}` }, signal });
  return r.ok;
};

export async function statusAll({ env = process.env, f = fetch, saToken = serviceToken, hasSA = hasServiceAccount, ms = STATUS_TIMEOUT_MS, now = () => new Date() } = {}) {
  // One shared service-account token for the app + push checks (cached in _ops-lib for ~1 h).
  let tokP = null;
  const token = () => (tokP ||= hasSA() ? Promise.resolve().then(() => saToken()) : Promise.resolve(null));
  const [app, ai, push, google] = await Promise.all([
    within(ms, async (signal) => { const t = await token(); return !!t && fsProbe('families', t, signal, f); }),
    within(ms, async (signal) => {
      if (!env.AGNES_API_KEY) return false;
      const r = await f('https://apihub.agnes-ai.com/v1/models', { headers: { authorization: `Bearer ${env.AGNES_API_KEY}` }, signal });
      if (!r.ok) return false;
      return ((await r.json()).data || []).some((m) => m?.id === 'agnes-3.0-flash');
    }),
    within(ms, async (signal) => {
      if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
      const t = await token(); return !!t && fsProbe('users', t, signal, f);
    }),
    within(ms, async (signal) => {
      if (!(env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID) || !env.GOOGLE_CLIENT_SECRET || !env.TOKEN_ENC_KEY) return false;
      const r = await f('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal,
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID || env.VITE_GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET, grant_type: 'authorization_code', code: '4/invalid-health-check',
          redirect_uri: `${APP_ORIGIN}/api/oauth/callback`,
        }),
      });
      if (r.ok) return false; // a dummy code must never succeed
      const j = await r.json().catch(() => ({}));
      return j.error === 'invalid_grant';
    }),
  ]);
  return { ok: app && ai && push && google, app, ai, push, google, checkedAt: now().toISOString() };
}

export async function statusAllResponse(req, opts) {
  const body = await statusAll(opts);
  const headers = { 'content-type': 'application/json; charset=utf-8', ...STATUS_HEADERS };
  return new Response(req.method === 'HEAD' ? null : JSON.stringify(body), { status: 200, headers });
}

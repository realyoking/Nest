// Shared access check for the Node-style endpoints (Run 8b wrap-up, 2026-10-19): api/calendar.js, api/push/subscribe.js,
// api/push/test.js, api/google/{token,status,disconnect}.js, api/oauth/start.js. Same rules as chat / plugins / promo
// (src/lib/admin-config.js gateCaller): maintenance (503), account_disabled (403), session_revoked (401),
// signup_closed (403). Admins bypass. NOT used by api/oauth/callback.js (Google redirect, no Firebase token) or
// api/push/cron.js (scheduled job). Fails OPEN when the config / ledger cannot be read, so a storage hiccup never locks
// everyone out. Reads are cached per isolate (config 20 s, ledger 15 s) and start in parallel with the endpoint's own work.
import { readLedger, isAdminClaims } from './_ops-lib.js';
import { gateCaller } from '../src/lib/admin-config.js';

let cfgCache = null;
async function configDoc() {
  if (cfgCache && Date.now() - cfgCache.at < 20e3) return cfgCache.data;
  let data = {};
  try { data = await readLedger({ which: 'config', maxAge: 0 }); } catch { data = cfgCache?.data || {}; }
  cfgCache = { at: Date.now(), data };
  return data;
}

// me: claims from verifyCaller (uid, email, emailVerified, iat). Returns [status, body] or null.
// `soft`: codes that are let through (e.g. disconnect / unsubscribe still work while suspended or in maintenance —
// they only remove the user's own data; a revoked session is never let through).
export async function accessGate(me, { soft = [] } = {}) {
  if (!me?.uid) return null;
  try {
    if (isAdminClaims(me)) return null;
    const [doc, ledger] = await Promise.all([configDoc().catch(() => ({})), readLedger({ maxAge: 15e3 }).catch(() => ({}))]);
    const g = gateCaller({ c: me, ledger, cfg: doc.cfg || {}, admin: false, feature: null, lang: 'zh-Hant' });
    if (!g || soft.includes(g.error)) return null;
    return [g.status, { error: g.error, ...(g.message ? { message: g.message } : {}) }];
  } catch { return null; }
}

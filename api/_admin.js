// Admin config, announcements, promo codes, sessions (Run 8b, 2026-10-19). Served by api/ops.js (no new function):
//   public (any caller, ID token optional)   GET  /api/app/config        → op=app-config   flags, maintenance, signup, defaults,
//                                                                                          + this user's announcements (token) + suspended
//                                             POST /api/app/ann          → op=app-ann      {id, ev: seen|click|dismiss|never}
//                                             GET  /api/app/img?id=…     → op=app-img      announcement image (public, cached)
//   admin only (404 to everyone else)         /api/admin/config | ann | translate | codes | users-search
// Storage: config doc (system account nest-config@…, readable only by that account), images in nest-media@…, counts in
// the index doc (annStats), per-user dismissals on the user's own profile (users/{uid}.annState). Pure logic:
// src/lib/admin-config.js. The AI model is fixed (agnes-3.0-flash) and not part of the config.
import {
  json, fsGet, fsCommit, docName, pathsWrite, ledgerSession, ledgerPath, ledgerTx, readLedger, indexIncrement, hasServiceAccount, serviceToken, listAuthUsers, PROJECT, resolvePlan,
} from './_ops-lib.js';
import {
  readConfig, applyConfigPatch, publicConfig, cleanAnnouncement, pickAnnouncements, publicAnn, cleanCode, codeState, ANN_MAX, MODEL, gateCaller,
} from '../src/lib/admin-config.js';
import { toWritten, toTraditional } from '../src/lib/chatctx.js';
import { toHans } from '../src/lib/hans.js';
import { accountKind } from '../src/lib/profile.js';

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 12);

// ---------- config doc (cached per isolate) ----------
let cfgCache = null;
export async function readConfigDoc({ maxAge = 20e3 } = {}) {
  if (cfgCache && Date.now() - cfgCache.at < maxAge) return cfgCache.data;
  let data = {};
  try { data = await readLedger({ which: 'config', maxAge: 0 }); } catch { data = cfgCache?.data || {}; }
  cfgCache = { at: Date.now(), data };
  return data;
}
export const dropConfigCache = () => { cfgCache = null; };
export async function appConfig() { return readConfig((await readConfigDoc()).cfg); }

// One gate for signed-in non-admin calls (chat / plugins / memory / titles / promo). Fails open if the config doc
// cannot be read (never locks everyone out because of a storage hiccup); suspension still comes from the ledger.
export async function gate(c, { feature = null, admin = false, lang = 'zh-Hant' } = {}) {
  const [doc, ledger] = await Promise.all([readConfigDoc().catch(() => ({})), readLedger({ maxAge: 15e3 }).catch(() => ({}))]);
  const g = gateCaller({ c, ledger, cfg: doc.cfg || {}, admin, feature, lang });
  return g ? json(g.status, { error: g.error, ...(g.message ? { message: g.message } : {}), ...(g.feature ? { feature: g.feature } : {}) }) : null;
}

const logEntry = (c, action, target, detail) => ({ at: Date.now(), by: c.email, action, target: String(target || '').slice(0, 64), detail: String(detail || '').slice(0, 300) });
export async function audit(c, action, target, detail) {
  await ledgerTx((doc) => ({ entries: [[['log'], [logEntry(c, action, target, detail), ...(doc.log || [])].slice(0, 300)]], result: true })).catch(() => {});
}
const configTx = (mutate) => ledgerTx(mutate, { which: 'config' }).then((r) => { dropConfigCache(); return r; });

// ---------- public ----------
async function lookupCreated(idToken) {
  try {
    const { firebaseConfig } = await import('../src/firebase-config.js');
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`, { method: 'POST', headers: { 'content-type': 'application/json', referer: 'https://heynest.vercel.app/' }, body: JSON.stringify({ idToken }) });
    return Number((await r.json()).users?.[0]?.createdAt) || null;
  } catch { return null; }
}
export async function appConfigOp(c, { admin = false, lang = 'zh-Hant' } = {}) {
  const doc = await readConfigDoc();
  const out = publicConfig(doc.cfg, { admin });
  out.admin = !!admin;
  out.model = MODEL;
  if (c) {
    const ledger = await readLedger({ maxAge: 15e3 }).catch(() => ({}));
    out.suspended = !!ledger?.disabled?.[c.uid];
    out.signupBlocked = !!ledger?.signupBlocked?.[c.uid];
    const live = Object.values(doc.ann || {}).filter((a) => a?.status === 'live');
    if (live.length) {
      const prof = (await fsGet(`users/${c.uid}`, c.token).catch(() => null))?.data || {};
      const fid = prof.familyId || null;
      const fam = fid ? (await fsGet(`families/${fid}`, c.token).catch(() => null))?.data : null;
      const plan = resolvePlan(fam?.plan, ledger, fid).id;
      const createdAt = live.some((a) => a.audience?.type === 'new') ? await lookupCreated(c.token) : null;
      const u = { uid: c.uid, email: c.email, plan, lang, createdAt };
      out.announcements = pickAnnouncements(live, u, prof.annState || {}).slice(0, 3).map(publicAnn);
    } else out.announcements = [];
  }
  return json(200, out, { 'cache-control': 'no-store' });
}
const EVENTS = { seen: 'seen', click: 'clicked', dismiss: 'dismissed', never: 'dismissed' };
export async function appAnnEvent(c, body) {
  const id = String(body?.id || ''); const ev = String(body?.ev || '');
  if (!/^[a-z0-9]{6,24}$/.test(id) || !EVENTS[ev]) return json(400, { error: 'bad_event' });
  const doc = await readConfigDoc();
  if (!doc.ann?.[id]) return json(404, { error: 'not_found' });
  const jobs = [indexIncrement(['annStats', id, EVENTS[ev]]).catch(() => {})];
  if (ev === 'never') jobs.push(indexIncrement(['annStats', id, 'never']).catch(() => {}));
  if (ev === 'dismiss' || ev === 'never') {
    jobs.push(fsCommit([{ ...pathsWrite(docName(`users/${c.uid}`), [[['annState', id], { d: Date.now(), n: ev === 'never' }]]), currentDocument: { exists: true } }], c.token).catch(() => {}));
  }
  await Promise.all(jobs);
  return json(200, { ok: true });
}
export async function appImg(id) {
  if (!/^[a-z0-9]{6,24}$/.test(String(id || ''))) return json(404, { error: 'not_found' });
  const media = await readLedger({ which: 'media', maxAge: 0 }).catch(() => ({}));
  const d = String(media?.img?.[id] || '');
  const m = /^data:(image\/(webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(d);
  if (!m) return json(404, { error: 'not_found' });
  const bin = Uint8Array.from(atob(m[3]), (ch) => ch.charCodeAt(0));
  return new Response(bin, { status: 200, headers: { 'content-type': m[1], 'cache-control': 'public, max-age=86400, immutable', 'x-content-type-options': 'nosniff' } });
}

// ---------- admin ----------
export async function adminConfig(c, req) {
  if (req.method === 'GET') {
    const doc = await readConfigDoc({ maxAge: 0 });
    return json(200, { cfg: readConfig(doc.cfg), model: MODEL, modelLocked: true });
  }
  const body = await req.json().catch(() => ({}));
  const patch = body?.patch || {};
  const next = await configTx((doc) => { const n = applyConfigPatch(doc.cfg, patch); return { entries: [[['cfg'], n]], result: n }; });
  const parts = [];
  if (patch.flags) parts.push(`flags ${Object.entries(patch.flags).map(([k, v]) => `${k}=${v ? 'on' : 'off'}`).join(', ')}`);
  if (patch.maintenance && 'on' in patch.maintenance) parts.push(`maintenance ${patch.maintenance.on ? 'ON' : 'off'}`);
  else if (patch.maintenance) parts.push('maintenance message edited');
  if (patch.ai?.limits) parts.push(`AI limits ${JSON.stringify(next.ai.limits)}`);
  if (patch.ai && 'promptAdd' in patch.ai) parts.push(`system-prompt addition ${next.ai.promptAdd ? `(${next.ai.promptAdd.length} chars)` : 'cleared'}`);
  if (patch.signup) parts.push(`signup ${next.signup.open ? 'open' : 'closed'}`);
  if (patch.defaults) parts.push(`defaults ${next.defaults.lang}/${next.defaults.theme}`);
  await audit(c, 'config', 'config', parts.join('; ') || 'config saved');
  return json(200, { ok: true, cfg: next });
}

const IMG_RE = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
export async function adminAnn(c, req) {
  if (req.method === 'GET') {
    const [doc, idx] = await Promise.all([readConfigDoc({ maxAge: 0 }), readLedger({ which: 'index', maxAge: 0 }).catch(() => ({}))]);
    const list = Object.values(doc.ann || {}).map((a) => ({ ...a, stats: { seen: 0, clicked: 0, dismissed: 0, never: 0, ...(idx.annStats?.[a.id] || {}) } }))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return json(200, { announcements: list });
  }
  const body = await req.json().catch(() => ({}));
  const op = String(body?.op || '');
  if (op === 'save') {
    const r = cleanAnnouncement(body.ann || {}, { by: c.email });
    if (r.error) return json(400, { error: r.error });
    const a = r.ann;
    const isNew = !a.id; if (isNew) a.id = rid();
    // image: a new data URL (client-compressed, ≤ 180 KB) → media doc; null → removed; unchanged id → kept
    let imgWrite = null;
    if (typeof body.image === 'string' && body.image) {
      if (!IMG_RE.test(body.image) || body.image.length > 250000) return json(400, { error: 'bad_image' });
      a.img = rid(); imgWrite = [['img', a.img], body.image];
    }
    const prev = await configTx((doc) => {
      const old = doc.ann?.[a.id];
      if (!isNew && !old) return { result: { missing: true } };
      if (isNew && Object.keys(doc.ann || {}).length >= ANN_MAX) return { result: { full: true } };
      if (!imgWrite && body.image !== null && old?.img) a.img = old.img;
      if (body.image === null) a.img = null;
      if (old?.createdAt) a.createdAt = old.createdAt;
      return { entries: [[['ann', a.id], a]], result: { old } };
    });
    if (prev?.missing) return json(404, { error: 'not_found' });
    if (prev?.full) return json(409, { error: 'too_many' });
    if (imgWrite || (prev?.old?.img && prev.old.img !== a.img)) {
      const ent = []; if (imgWrite) ent.push(imgWrite); if (prev?.old?.img && prev.old.img !== a.img) ent.push([['img', prev.old.img], undefined]);
      const s = await ledgerSession('media'); await fsCommit([pathsWrite(docName(ledgerPath(s)), ent)], s.token);
    }
    await audit(c, isNew ? 'ann-create' : 'ann-edit', a.id, `${a.text['zh-Hant'].title || a.text.en.title} · ${a.style} · ${a.status} · audience ${a.audience.type}${a.audience.type === 'user' ? ` (${a.audience.users.length})` : ''}`);
    return json(200, { ok: true, ann: a });
  }
  if (op === 'status' || op === 'delete') {
    const id = String(body?.id || '');
    const status = String(body?.status || '');
    if (op === 'status' && !['draft', 'live', 'paused'].includes(status)) return json(400, { error: 'bad_status' });
    const old = await configTx((doc) => {
      const a = doc.ann?.[id]; if (!a) return { result: null };
      return { entries: [[['ann', id], op === 'delete' ? undefined : { ...a, status, updatedAt: Date.now(), updatedBy: c.email }]], result: a };
    });
    if (!old) return json(404, { error: 'not_found' });
    if (op === 'delete') {
      if (old.img && old.img !== true) { const s = await ledgerSession('media'); await fsCommit([pathsWrite(docName(ledgerPath(s)), [[['img', old.img], undefined]])], s.token).catch(() => {}); }
      const s2 = await ledgerSession('index'); await fsCommit([pathsWrite(docName(ledgerPath(s2)), [[['annStats', id], undefined]])], s2.token).catch(() => {});
    }
    await audit(c, op === 'delete' ? 'ann-delete' : `ann-${status}`, id, old.text?.['zh-Hant']?.title || old.text?.en?.title || id);
    return json(200, { ok: true });
  }
  return json(400, { error: 'bad_op' });
}

// AI translate (agnes-3.0-flash, the only model): one language in → the three app languages out. zh-Hant is HK 書面語.
export async function adminTranslate(c, body) {
  const key = process.env.AGNES_API_KEY;
  if (!key) return json(503, { error: 'not_configured' });
  const src = { title: String(body?.title || '').slice(0, 120), body: String(body?.body || '').slice(0, 4000), cta: String(body?.cta || '').slice(0, 40) };
  if (!src.title.trim() && !src.body.trim()) return json(400, { error: 'empty' });
  const sys = 'Translate this in-app announcement for the Nest family app into three languages. Output ONLY JSON: {"zh-Hant":{"title","body","cta"},"zh-Hans":{"title","body","cta"},"en":{"title","body","cta"}}. zh-Hant = standard Hong Kong written Chinese (書面語, Traditional characters, never Cantonese colloquial words). zh-Hans = Simplified Chinese. Keep markdown (bold, lists, links) exactly, keep names, numbers and URLs unchanged, keep it concise and friendly. An empty field stays empty.';
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 25000);
  try {
    const r = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, stream: false, temperature: 0.2, messages: [{ role: 'system', content: sys }, { role: 'user', content: JSON.stringify(src) }] }) });
    if (!r.ok) return json(502, { error: 'model' });
    const t = String((await r.json()).choices?.[0]?.message?.content || '');
    const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
    const pick = (x) => ({ title: String(x?.title || '').slice(0, 120), body: String(x?.body || '').slice(0, 4000), cta: String(x?.cta || '').slice(0, 40) });
    const zhT = pick(o['zh-Hant']); for (const k of ['title', 'body', 'cta']) zhT[k] = toWritten(toTraditional(zhT[k]));
    const zhS = pick(o['zh-Hans']); for (const k of ['title', 'body', 'cta']) if (!zhS[k] && zhT[k]) zhS[k] = toHans(zhT[k]);
    await audit(c, 'ann-translate', 'translate', `${src.title.slice(0, 60)}`);
    return json(200, { text: { 'zh-Hant': zhT, 'zh-Hans': zhS, en: pick(o.en) }, model: MODEL });
  } catch { return json(502, { error: 'translate_failed' }); } finally { clearTimeout(tm); }
}

// Promo codes. BETA = the built-in beta promo (its ledger promos.beta is NEVER edited here — only new claims can be
// paused with codes.BETA.disabled). Other codes give the family Pro for N months as a ledger grant (never shortening one).
export async function adminCodes(c, req) {
  if (req.method === 'GET') {
    const ledger = await readLedger({ maxAge: 0 });
    const beta = ledger?.promos?.beta || {};
    const codes = Object.entries(ledger?.codes || {}).filter(([k]) => k !== 'BETA').map(([code, d]) => ({ code, ...d, uses: undefined, ...codeState(d) }));
    return json(200, { beta: { code: 'BETA', builtIn: true, claimed: Object.keys(beta.claims || {}).length, max: Number(beta.max || 10), disabled: !!ledger?.codes?.BETA?.disabled }, codes });
  }
  const body = await req.json().catch(() => ({}));
  const op = String(body?.op || '');
  if (op === 'create') {
    const r = cleanCode(body.code || {});
    if (r.error) return json(400, { error: r.error });
    if (r.code === 'BETA') return json(409, { error: 'reserved' });
    const ok = await ledgerTx((doc) => (doc?.codes?.[r.code] ? { result: false } : { entries: [[['codes', r.code], { ...r.def, at: Date.now(), by: c.email, uses: {} }]], result: true }));
    if (!ok) return json(409, { error: 'exists' });
    await audit(c, 'code-create', r.code, `Pro ${r.def.months} month(s), max ${r.def.max}${r.def.expires ? `, until ${new Date(r.def.expires).toISOString()}` : ''}`);
    return json(200, { ok: true });
  }
  if (op === 'disable' || op === 'enable') {
    const code = String(body?.code || '').toUpperCase();
    if (!/^[A-Z0-9-]{3,24}$/.test(code)) return json(400, { error: 'bad_code' });
    // Only the `disabled` field is written (dot path), so BETA claims / counts / uses are untouched.
    const ok = await ledgerTx((doc) => (code !== 'BETA' && !doc?.codes?.[code] ? { result: false } : { entries: [[['codes', code, 'disabled'], op === 'disable']], result: true }));
    if (!ok) return json(404, { error: 'not_found' });
    await audit(c, `code-${op}`, code, op === 'disable' ? 'New claims paused (existing gifts unchanged)' : 'New claims allowed');
    return json(200, { ok: true });
  }
  return json(400, { error: 'bad_op' });
}
// Redeem a non-BETA code (ops.js promoClaim). One use per family; grant until = max(current grant, now) + months.
export async function redeemCode({ code, fid, uid, now = Date.now() }) {
  const { addMonths } = await import('./_ops-lib.js');
  return ledgerTx((doc) => {
    const d = doc?.codes?.[code];
    if (!d) return { result: { status: 'bad_code' } };
    const st = codeState(d, now);
    if (d.uses?.[fid]) return { result: { status: 'already', until: d.uses[fid].until } };
    if (!st.open) return { result: { status: d.disabled ? 'disabled' : st.remaining <= 0 ? 'full' : 'expired' } };
    const g = doc?.grants?.[fid];
    const base = Math.max(now, Number(g?.until) || 0);
    const until = addMonths(base, d.months || 1);
    return {
      entries: [[['codes', code, 'uses', fid], { uid, at: now, until }], [['grants', fid], { until, by: `code:${code}`, at: now, note: `promo code ${code}` }],
        [['log'], [{ at: now, by: 'system', action: 'code-redeem', target: fid, detail: `${code} → Pro until ${new Date(until).toISOString()}` }, ...(doc.log || [])].slice(0, 300)]],
      result: { status: 'claimed', until, remaining: st.remaining - 1 },
    };
  });
}

// Revoke every session of a user: Firebase Auth validSince = now (what Admin SDK revokeRefreshTokens does — refresh
// tokens stop working) + ledger.revoked[uid] so ID tokens issued before now are refused by Nest's APIs at once.
export async function revokeSessions(c, uid) {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid || '')) return json(400, { error: 'bad_target' });
  const now = Date.now();
  let auth = false;
  if (hasServiceAccount()) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT()}/accounts:update`, { method: 'POST', headers: { authorization: `Bearer ${await serviceToken()}`, 'content-type': 'application/json' }, body: JSON.stringify({ localId: uid, validSince: String(Math.floor(now / 1000)) }) });
    if (!r.ok) return json(502, { error: 'auth_update_failed' });
    auth = true;
  }
  await ledgerTx((doc) => ({ entries: [[['revoked', uid], { at: now, by: c.email }], [['log'], [logEntry(c, 'revoke-sessions', uid, auth ? 'All sessions revoked (Firebase refresh tokens + Nest API)' : 'Nest API sessions revoked (no service account)'), ...(doc.log || [])].slice(0, 300)]], result: true }));
  return json(200, { ok: true, auth });
}

// Plugin + store stats for the dashboard (service account; counts only).
export async function pluginStats() {
  if (!hasServiceAccount()) return null;
  const { listCollection } = await import('./_ops-lib.js');
  const tok = await serviceToken();
  const [pl, reps] = await Promise.all([listCollection('nestPlugins', tok).catch(() => []), listCollection('nestPluginReports', tok, 500).catch(() => [])]);
  const live = pl.filter((p) => !p.data.deleted);
  return {
    total: live.length, listed: live.filter((p) => p.data.listed !== false && p.data.review === 'approved').length,
    pending: live.filter((p) => p.data.review === 'pending' || p.data.pendingV || p.data.listingPending).length,
    installs: live.reduce((n, p) => n + (Number(p.data.installs) || 0), 0), openReports: reps.filter((r) => r.data?.status === 'open').length,
  };
}
export { accountKind, listAuthUsers };

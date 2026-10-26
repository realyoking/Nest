// Run 23 server ops (no new Vercel function: routed from api/ops.js through the /api/app/:op rewrite).
//   POST /api/app/today            → op=app-today            {facts}  → {lines:{zh-Hant,en,th}, day, cached}
//   POST /api/app/family-settings  → op=app-family-settings  {patch, role?}  → {ok, settings}
// The 今日 line is generated at most ONCE per Hong Kong day per family: families/{fid}/daily/{day} is created with an
// exists:false precondition BEFORE the model call (a lock), so concurrent members never cause a second Agnes call.
// That collection has no client rule, so only the service account can read / write it.
import { json, fsGet, fsCommit, docName, pathsWrite, enc, hasServiceAccount, serviceToken } from './_ops-lib.js';
import { cleanFacts, todayPrompt, parseToday, fixZh, hkDayOf } from '../src/lib/today.js';
import { familySettings, cleanSettingsPatch, canEditFamily } from '../src/lib/nestie.js';

const AGNES = 'https://apihub.agnes-ai.com/v1/chat/completions';
const MODEL = 'agnes-3.0-flash'; // free model only
export const TODAY_LOCK_MS = 45e3;

async function memberCtx(c, get = fsGet) {
  const prof = (await get(`users/${c.uid}`, c.token))?.data || {};
  const fid = prof.familyId || '';
  if (!fid) return { err: json(403, { error: 'no_family' }) };
  const fam = (await get(`families/${fid}`, c.token).catch(() => null))?.data || null;
  if (!fam || !(fam.memberIds || []).includes(c.uid)) return { err: json(403, { error: 'not_member' }) };
  const me = (await get(`families/${fid}/members/${c.uid}`, c.token).catch(() => null))?.data || null;
  return { fid, fam, me, isOwner: fam.ownerId === c.uid };
}

// Decision helper (unit-tested): what to do with the cached daily doc.
export function todayState(doc, day, now = Date.now()) {
  if (!doc) return 'generate';
  if (doc.day !== day) return 'generate';
  if (doc.lines && (doc.lines.en || doc.lines['zh-Hant'])) return 'cached';
  if (doc.status === 'pending' && now - (doc.at || 0) < TODAY_LOCK_MS) return 'pending';
  if ((doc.tries || 1) >= 3) return 'failed'; // at most 3 model calls per family per day, even if every one fails
  if (doc.status === 'failed' && now - (doc.at || 0) < 10 * 60e3) return 'failed';
  return 'retry'; // failed a while ago or stale lock → one more try
}

// deps are injectable for unit tests (in-memory Firestore with real precondition semantics, fake model).
export async function todayOp(c, body, deps = {}) {
  const { get = fsGet, commit = fsCommit, saToken = serviceToken, hasSa = hasServiceAccount, fetchImpl = fetch, key = process.env.AGNES_API_KEY, now = Date.now } = deps;
  if (!hasSa()) return json(503, { error: 'not_configured' });
  const m = await memberCtx(c, get); if (m.err) return m.err;
  const sa = await saToken();
  const day = hkDayOf(now());
  const path = `families/${m.fid}/daily/${day}`;
  const cur = await get(path, sa).catch(() => null);
  const st = todayState(cur?.data, day, now());
  if (st === 'cached') return json(200, { day, lines: cur.data.lines, cached: true });
  if (st === 'pending') return json(200, { day, pending: true });
  if (st === 'failed') return json(200, { day, failed: true });
  if (!key) return json(200, { day, failed: true });
  // Take the lock: create (generate) or update-if-unchanged (retry). Losing the race → someone else is generating.
  const tries = (cur?.data?.day === day ? Number(cur.data.tries) || 0 : 0) + 1;
  const lockDoc = { day, status: 'pending', at: now(), by: c.uid, tries };
  const lock = await commit([{ update: { name: docName(path), fields: Object.fromEntries(Object.entries(lockDoc).map(([k, v]) => [k, enc(v)])) }, currentDocument: cur ? { updateTime: cur.updateTime } : { exists: false } }], sa);
  if (!lock.ok) return json(200, { day, pending: true });
  const s = familySettings(m.fam);
  const facts = cleanFacts(body?.facts || {});
  let lines = null;
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetchImpl(AGNES, { method: 'POST', signal: ctl.signal, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, stream: false, temperature: 0.4, max_tokens: 260, messages: [{ role: 'user', content: todayPrompt(facts, { name: s.nestieName, personality: s.personality, day }) }] }) });
    if (r.ok) lines = parseToday((await r.json()).choices?.[0]?.message?.content);
  } catch {} finally { clearTimeout(tm); }
  if (lines?.['zh-Hant']) lines['zh-Hant'] = fixZh(lines['zh-Hant']);
  const done = lines ? { day, status: 'ok', at: now(), by: c.uid, tries, lines } : { day, status: 'failed', at: now(), by: c.uid, tries };
  await commit([{ update: { name: docName(path), fields: Object.fromEntries(Object.entries(done).map(([k, v]) => [k, enc(v)])) } }], sa).catch(() => {});
  return lines ? json(200, { day, lines, cached: false }) : json(200, { day, failed: true });
}

// Family-level settings (Nestie name / personality, suggestion level, holiday theme, memory edit, quiet hours, family
// name) and member roles. Owner + adults (parent / grandparent) may change settings; roles only the owner.
export async function familySettingsOp(c, body, deps = {}) {
  const { get = fsGet, commit = fsCommit, saToken = serviceToken, hasSa = hasServiceAccount } = deps;
  const m = await memberCtx(c, get); if (m.err) return m.err;
  if (!canEditFamily({ member: m.me, isOwner: m.isOwner })) return json(403, { error: 'forbidden' });
  const v = cleanSettingsPatch(body?.patch);
  if (!v.ok) return json(400, { error: v.error });
  const { familyName, ...rest } = v.patch;
  if (familyName && !m.isOwner) return json(403, { error: 'owner_only' });
  const entries = Object.entries(rest).map(([k, x]) => [['settings', k], x]);
  if (familyName) entries.push([['name'], familyName]);
  // Service account when configured; otherwise the caller's own token (Firestore rules then allow the owner only).
  const tok = hasSa() ? await saToken() : c.token;
  const w = await commit([{ ...pathsWrite(docName(`families/${m.fid}`), entries), currentDocument: { exists: true } }], tok);
  if (!w.ok) return json(w.code === 403 ? 403 : 502, { error: w.code === 403 ? 'forbidden' : 'write' });
  return json(200, { ok: true, settings: familySettings({ settings: { ...(m.fam.settings || {}), ...rest } }) });
}

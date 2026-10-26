// Native Nest calendar store + reminder dispatcher (Node; used by api/calendar.js and api/push/cron.js).
// Storage (service account; the client never touches these paths, so no rules change is needed):
//   families/{fid}/nestEvents/{id}   event docs (src/lib/nestcal.js shape) + lastFire (ms of the last reminder sent)
//   system/nestFire                   { fires: { k<fid>_<id>: nextFireMs } } — one small index doc the dispatcher reads
// Membership is checked server-side: users/{uid}.familyId must be a family whose memberIds include the caller.
import crypto from 'node:crypto';
import { serviceAccount, serviceToken, fsGet, fsList, fsPatch, fsDelete, fsGetRaw, fsSetIf, subsOfUser, pushTo, removeSub, vapidConfigured, langOf } from './_push-lib.js';
import { prefsOf, inQuietHours } from '../src/lib/prefs.js';
import { cleanNestEvent, firesBetween, nextFire } from '../src/lib/nestcal.js';
import { cleanSub, currentRenewal, decisionPending, nextDecisionFire, deciderOf, CHOICES } from '../src/lib/subs.js';

let tokCache = { at: 0, tok: '' };
export async function saToken() {
  const sa = serviceAccount();
  if (!sa) throw Object.assign(new Error('service_account_missing'), { status: 503 });
  if (Date.now() - tokCache.at < 40 * 60e3 && tokCache.tok) return tokCache.tok;
  tokCache = { at: Date.now(), tok: await serviceToken(sa) };
  return tokCache.tok;
}
// → { fid, family, sa } or throws 403.
export async function familyOfCaller(uid) {
  const sa = await saToken();
  const prof = await fsGet(`users/${uid}`, sa);
  const fid = prof?.familyId;
  if (!fid) throw Object.assign(new Error('no_family'), { status: 403 });
  const family = await fsGet(`families/${fid}`, sa);
  if (!family || !(family.memberIds || []).includes(uid)) throw Object.assign(new Error('not_member'), { status: 403 });
  return { fid, family, sa, prof };
}
const fk = (fid, id) => `k${fid}_${id}`.replace(/[^A-Za-z0-9_]/g, '');
async function setFire(sa, fid, id, at) {
  const k = fk(fid, id);
  if (at) await fsPatch('system/nestFire', { fires: { [k]: at } }, sa, [`fires.${k}`]);
  else await fsPatch('system/nestFire', {}, sa, [`fires.${k}`]);
}

export async function nestList(me) {
  const { fid, sa } = await familyOfCaller(me.uid);
  const docs = await fsList(`families/${fid}/nestEvents`, sa).catch(() => []);
  return { events: docs.map(({ path, lastFire, ...e }) => e) };
}
// extra: server-set fields (e.g. { byPlugin: pid } for plugin-made events — never taken from the client body).
export async function nestWrite(me, body, extra = {}) {
  const { fid, sa, family } = await familyOfCaller(me.uid);
  const action = String(body.action || '');
  const id = String(body.id || '');
  if (action !== 'create' && !/^e[0-9a-f]{20}$/.test(id)) throw Object.assign(new Error('bad_id'), { status: 400 });
  if (action === 'delete') {
    await fsDelete(`families/${fid}/nestEvents/${id}`, sa);
    await setFire(sa, fid, id, null).catch(() => {});
    return { ok: true };
  }
  const ev = cleanNestEvent(body.event || {});
  ev.members = ev.members.filter((u) => (family.memberIds || []).includes(u));
  const now = Date.now();
  const nid = action === 'create' ? 'e' + crypto.randomBytes(10).toString('hex') : id;
  if (action === 'update') {
    const cur = await fsGet(`families/${fid}/nestEvents/${nid}`, sa);
    if (!cur) throw Object.assign(new Error('not_found'), { status: 404 });
  } else if (action !== 'create') throw Object.assign(new Error('bad_action'), { status: 400 });
  const doc = { ...ev, ...(extra.byPlugin ? { byPlugin: String(extra.byPlugin).slice(0, 40) } : {}), id: nid, createdBy: body.createdBy && action === 'update' ? String(body.createdBy).slice(0, 128) : me.uid, updatedBy: me.uid, updatedAt: now, lastFire: now };
  await fsPatch(`families/${fid}/nestEvents/${nid}`, doc, sa);
  await setFire(sa, fid, nid, nextFire(doc, now)).catch(() => {});
  return { ok: true, event: { ...doc, lastFire: undefined } };
}

// ---------- dispatcher ----------
// Sends every reminder whose time is in (lastFire, now]. Claim = compare-and-set on the event doc's updateTime, so
// concurrent dispatchers never double-send. Reminders older than 2 h when first seen are skipped (no stale pings).
let lastRun = 0;
export async function dispatchNest({ force = false } = {}) {
  if (!serviceAccount()) return { ran: false, reason: 'no_service_account' };
  if (!force && Date.now() - lastRun < 45e3) return { ran: false, reason: 'recent' };
  lastRun = Date.now();
  const sa = await saToken();
  const idx = await fsGet('system/nestFire', sa).catch(() => null);
  const now = Date.now();
  const due = Object.entries(idx?.fires || {}).filter(([, at]) => Number(at) && Number(at) <= now + 20e3).slice(0, 40);
  let sent = 0; let handled = 0;
  for (const [k] of due) {
    const m = /^k([A-Za-z0-9]+)_(e[0-9a-f]{20})$/.exec(k);
    if (!m) { await fsPatch('system/nestFire', {}, sa, [`fires.${k}`]).catch(() => {}); continue; }
    const [, fid, id] = m;
    const raw = await fsGetRaw(`families/${fid}/nestEvents/${id}`, sa).catch(() => null);
    if (!raw?.exists) { await setFire(sa, fid, id, null).catch(() => {}); continue; }
    const ev = raw.data;
    const from = Math.max(Number(ev.lastFire) || 0, now - 2 * 3600e3);
    const fires = firesBetween(ev, from, now + 20e3);
    // Claim: write lastFire with the read updateTime as precondition.
    const claimed = await fsSetIf(`families/${fid}/nestEvents/${id}`, { ...ev, lastFire: now + 20e3 }, sa, raw.updateTime).catch(() => false);
    if (!claimed) continue;
    handled++;
    await setFire(sa, fid, id, nextFire(ev, now + 20e3)).catch(() => {});
    if (!fires.length || !vapidConfigured()) continue;
    const fam = await fsGet(`families/${fid}`, sa).catch(() => null);
    const targets = (ev.members?.length ? ev.members : fam?.memberIds || []).filter((u) => (fam?.memberIds || []).includes(u));
    const f = fires[fires.length - 1];
    for (const uid of targets) {
      const { subs, profile } = await subsOfUser(uid, sa).catch(() => ({ subs: [] }));
      const p = prefsOf(profile);
      if (!subs.length || !p.pushEnabled || p.notifyReminders === false || inQuietHours(p)) continue;
      const lang = langOf(p.lang); const hans = p.lang === 'zh-Hans';
      for (const s of subs) {
        const r = await pushTo(s, { title: ev.title, body: whenText(ev, f, lang), url: `/app/calendar?ev=${id}`, tag: `nev-${id}-${f.occ}-${f.minutes}`, lang, hans }, { urgency: 'high', TTL: 3600 });
        if (r === 'ok') sent++;
        if (r === 'gone') await removeSub(uid, s, sa);
      }
    }
  }
  return { ran: true, due: due.length, handled, sent };
}
function whenText(ev, f, lang) {
  const zh = lang !== 'en';
  const hm = new Date(f.occStart + 8 * 3600e3).toISOString().slice(11, 16);
  const lead = f.minutes === 0 ? (zh ? '現在開始' : 'Starting now') : f.minutes < 60 ? (zh ? `${f.minutes} 分鐘後` : `In ${f.minutes} min`) : f.minutes < 1440 ? (zh ? `${f.minutes / 60} 小時後` : `In ${f.minutes / 60} h`) : (zh ? `${f.minutes / 1440} 天後` : `In ${f.minutes / 1440} day(s)`);
  return [lead, ev.allDay ? (zh ? '全日' : 'All day') : hm, ev.location].filter(Boolean).join(' · ');
}

// ---------- family subscriptions (families/{fid}/nestSubs/{id}) + pre-renewal decision push ----------
// Index system/subFire { fires: { k<fid>_<id>: ms } } = when to push the decider (09:00 HKT, 3 days before renewal).
const sk = (fid, id) => `k${fid}_${id}`.replace(/[^A-Za-z0-9_]/g, '');
async function setSubFire(sa, fid, id, at) {
  const k = sk(fid, id);
  if (at) await fsPatch('system/subFire', { fires: { [k]: at } }, sa, [`fires.${k}`]);
  else await fsPatch('system/subFire', {}, sa, [`fires.${k}`]);
}
export async function subsList(me) {
  const { fid, sa } = await familyOfCaller(me.uid);
  const docs = await fsList(`families/${fid}/nestSubs`, sa).catch(() => []);
  return { subs: docs.map(({ path, ...x }) => x) };
}
export async function subsWrite(me, body) {
  const { fid, sa, family } = await familyOfCaller(me.uid);
  const action = String(body.action || '');
  const id = String(body.id || '');
  if (action !== 'create' && !/^s[0-9a-f]{20}$/.test(id)) throw Object.assign(new Error('bad_id'), { status: 400 });
  if (action === 'delete') {
    await fsDelete(`families/${fid}/nestSubs/${id}`, sa);
    await setSubFire(sa, fid, id, null).catch(() => {});
    return { ok: true };
  }
  const path = (x) => `families/${fid}/nestSubs/${x}`;
  if (action === 'decide') {
    const cur = await fsGet(path(id), sa);
    if (!cur) throw Object.assign(new Error('not_found'), { status: 404 });
    const choice = CHOICES.includes(body.choice) ? body.choice : null;
    const renewal = currentRenewal(cur);
    if (!choice || !renewal) throw Object.assign(new Error('bad_action'), { status: 400 });
    const decision = { renewal, choice, by: me.uid, at: Date.now() };
    await fsPatch(path(id), { decision }, sa, ['decision']);
    await setSubFire(sa, fid, id, nextDecisionFire({ ...cur, decision })).catch(() => {});
    return { ok: true, decision };
  }
  if (action === 'used') {
    const cur = await fsGet(path(id), sa);
    if (!cur) throw Object.assign(new Error('not_found'), { status: 404 });
    const lastUsed = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
    await fsPatch(path(id), { lastUsed }, sa, ['lastUsed']);
    return { ok: true, lastUsed };
  }
  const sub = cleanSub(body.sub || {});
  const ids = family.memberIds || [];
  if (sub.member && !ids.includes(sub.member)) sub.member = '';
  if (sub.decider && !ids.includes(sub.decider)) sub.decider = '';
  const nid = action === 'create' ? 's' + crypto.randomBytes(10).toString('hex') : id;
  let prev = {};
  if (action === 'update') { prev = await fsGet(path(nid), sa); if (!prev) throw Object.assign(new Error('not_found'), { status: 404 }); }
  else if (action !== 'create') throw Object.assign(new Error('bad_action'), { status: 400 });
  const doc = { ...sub, id: nid, createdBy: prev.createdBy || me.uid, updatedBy: me.uid, updatedAt: Date.now(), ...(prev.decision ? { decision: prev.decision } : {}), ...(prev.notified ? { notified: prev.notified } : {}) };
  // A changed renewal date resets the "already pushed" marker.
  if (prev.renewDate && prev.renewDate !== doc.renewDate) delete doc.notified;
  await fsPatch(path(nid), doc, sa, Object.keys(doc).concat(prev.notified && !doc.notified ? ['notified'] : []));
  await setSubFire(sa, fid, nid, nextDecisionFire(doc)).catch(() => {});
  return { ok: true, sub: doc };
}
let lastSubRun = 0;
// Push the decider about each renewal ≤ 3 days away that nobody decided yet. Daytime only (08:00–21:59 HKT; their quiet
// hours respected). Claim = compare-and-set on the sub doc (notified = renewal), so concurrent runs never double-send.
export async function dispatchSubs({ force = false } = {}) {
  if (!serviceAccount()) return { ran: false, reason: 'no_service_account' };
  if (!force && Date.now() - lastSubRun < 60e3) return { ran: false, reason: 'recent' };
  lastSubRun = Date.now();
  const hour = new Date(Date.now() + 8 * 3600e3).getUTCHours();
  if (hour < 8 || hour >= 22) return { ran: false, reason: 'night' };
  const sa = await saToken();
  const idx = await fsGet('system/subFire', sa).catch(() => null);
  const now = Date.now();
  const due = Object.entries(idx?.fires || {}).filter(([, at]) => Number(at) && Number(at) <= now + 20e3).slice(0, 30);
  let sent = 0; let notified = 0;
  for (const [k] of due) {
    const m = /^k([A-Za-z0-9]+)_(s[0-9a-f]{20})$/.exec(k);
    if (!m) { await fsPatch('system/subFire', {}, sa, [`fires.${k}`]).catch(() => {}); continue; }
    const [, fid, id] = m;
    const raw = await fsGetRaw(`families/${fid}/nestSubs/${id}`, sa).catch(() => null);
    if (!raw?.exists) { await setSubFire(sa, fid, id, null).catch(() => {}); continue; }
    const sub = raw.data;
    const pend = decisionPending(sub, now);
    if (!pend || sub.notified === pend.renewal) { await setSubFire(sa, fid, id, nextDecisionFire(sub, now)).catch(() => {}); continue; }
    const claimed = await fsSetIf(`families/${fid}/nestSubs/${id}`, { ...sub, notified: pend.renewal }, sa, raw.updateTime).catch(() => false);
    if (!claimed) continue;
    notified++;
    await setSubFire(sa, fid, id, nextDecisionFire({ ...sub, notified: pend.renewal }, now)).catch(() => {});
    const fam = await fsGet(`families/${fid}`, sa).catch(() => null);
    const members = await fsList(`families/${fid}/members`, sa).catch(() => []);
    const decider = deciderOf(sub, fam || {}, members.map((x) => ({ uid: x.uid, role: x.role })));
    if (!decider || !vapidConfigured()) continue;
    const { subs, profile } = await subsOfUser(decider, sa).catch(() => ({ subs: [] }));
    const p = prefsOf(profile);
    if (!subs.length || !p.pushEnabled || inQuietHours(p)) continue;
    const lang = langOf(p.lang); const hans = p.lang === 'zh-Hans'; const zh = lang !== 'en';
    const md = `${+pend.renewal.slice(5, 7)}/${+pend.renewal.slice(8, 10)}`;
    const cost = sub.amount ? ` · HK$${sub.amount}${zh ? { weekly: '/週', monthly: '/月', yearly: '/年' }[sub.cycle] || '' : { weekly: '/wk', monthly: '/mo', yearly: '/yr' }[sub.cycle] || ''}` : '';
    const title = zh ? `家庭決定：${sub.service} ${pend.days === 0 ? '今天' : `${pend.days} 天後`}續訂` : `Family decision: ${sub.service} renews ${pend.days === 0 ? 'today' : `in ${pend.days} day${pend.days > 1 ? 's' : ''}`}`;
    const body = zh ? `${md} 續訂${cost}。保留、商量，還是稍後取消？` : `Renews ${md}${cost}. Keep, discuss, or cancel later?`;
    for (const s of subs) {
      const r = await pushTo(s, { title, body, url: `/app?sub=${id}`, tag: `sub-${id}-${pend.renewal}`, lang, hans }, { urgency: 'normal', TTL: 12 * 3600 });
      if (r === 'ok') sent++;
      if (r === 'gone') await removeSub(decider, s, sa);
    }
  }
  return { ran: true, due: due.length, notified, sent };
}

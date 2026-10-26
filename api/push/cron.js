// /api/push/cron — daily jobs + Hong Kong data + on-demand scan, in ONE function (Hobby plan: 12 functions max, all used).
//
// Vercel Cron (Hobby: once per day per job, ±59 min), `Authorization: Bearer $CRON_SECRET`:
//   ?slot=morning (07:00 HKT): HKO warning check · scan every user's Gmail/Classroom for school notices, tests and bills
//        (api/_auto.js → suggestion cards) · daily brief push (reminders today, homework/tests ≤36 h, birthdays, new notices,
//        bills due in N days / tomorrow / today, public holidays in 3 days / tomorrow; with notifyBrief + Google: model-written).
//   ?slot=evening (19:00 HKT): HKO warning check · "revised yet?" nudges (Yes / Not yet actions) for each test / dictation /
//        homework due tomorrow · what is due tomorrow.
// Public (no auth), rewritten from /api/hk/:op → ?op=hk-:op : warn | weather | holidays | eta | routes | stops | mtr (api/_hk.js).
//   hk-warn also runs the server-side NEW-warning check + family push (so any client load acts as a trigger between crons).
// POST ?op=auto-scan (rewritten from /api/auto/scan), Firebase ID token: scan the caller's own accounts now (throttled 15 min).
// ?health=1 → booleans only.
import { send, serviceAccount, serviceToken, fsList, fsGet, verifyCaller, readBody, removeSub, vapidConfigured, pushTo, T, langOf, allSubscribers } from '../_push-lib.js';
import { prefsOf, inQuietHours } from '../../src/lib/prefs.js';
import { googleBrief, pushBriefText, countsText } from '../_brief-push.js';
import { hkRoute, checkWarnings, fetchHolidays } from '../_hk.js';
import { scanUser } from '../_auto.js';
import { dispatchNest, dispatchSubs } from '../_nest.js';
import { nudgeItems, daysUntil } from '../../src/lib/detect.js';
import { upcomingHolidays } from '../../src/lib/hk.js';

export const config = { maxDuration: 60 };

const hkDay = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const TEST_RE = /測驗|考試|默書|小測|測試|段考|期考|\b(test|exam|quiz|dictation|assessment)s?\b/i;
const toDate = (v) => (v ? new Date(v) : null);

const X = {
  'zh-Hant': {
    notices: (n) => `${n} 份新學校通告`, bills: (n) => `${n} 張新帳單`, tests: (n) => `${n} 個新測驗或默書`,
    billDue: (t, n) => (n === 0 ? `${t} 今天到期` : n === 1 ? `${t} 明天到期` : `${t} ${n} 天後到期`),
    holiday: (name, n) => (n === 1 ? `明天是公眾假期（${name}）` : `${n} 天後是公眾假期（${name}）`),
    nudgeTitle: (k) => (k === 'test' ? '明天測驗／默書' : '明天要交功課'), nudgeBody: (t) => `${t} — 溫習了嗎？`, nudgeBodyHw: (t) => `${t} — 完成了嗎？`,
    yes: '溫習了', yesHw: '完成了', notYet: '還沒有',
  },
  en: {
    notices: (n) => `${n} new school notice${n > 1 ? 's' : ''}`, bills: (n) => `${n} new bill${n > 1 ? 's' : ''}`, tests: (n) => `${n} new test${n > 1 ? 's' : ''}`,
    billDue: (t, n) => (n === 0 ? `${t} due today` : n === 1 ? `${t} due tomorrow` : `${t} due in ${n} days`),
    holiday: (name, n) => (n === 1 ? `Tomorrow is a public holiday (${name})` : `Public holiday in ${n} days (${name})`),
    nudgeTitle: (k) => (k === 'test' ? 'Test tomorrow' : 'Homework due tomorrow'), nudgeBody: (t) => `${t} — revised yet?`, nudgeBodyHw: (t) => `${t} — done yet?`,
    yes: 'Revised', yesHw: 'Done', notYet: 'Not yet',
  },
};
const money = (b, lang) => `${b.payee || (lang === 'en' ? 'Bill' : '帳單')}${b.amount ? ` HK$${Number(b.amount).toLocaleString('en-HK')}` : ''}`;

export default async function handler(req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const op = q.get('op') || '';
  if (op.startsWith('hk-')) return hkRoute(op, q, res);
  if (op === 'auto-scan') return autoScan(req, res, q);
  // ?health=1 (no auth): booleans only — is the service account configured and can it read Firestore? Sends nothing.
  if (q.get('health') === '1') {
    const out = { cronSecret: !!process.env.CRON_SECRET, serviceAccount: false, firestore: false, vapid: vapidConfigured() };
    const sa0 = serviceAccount();
    if (sa0) {
      out.serviceAccount = true;
      try { const tk = await serviceToken(sa0); await fsList('users', tk, 1); out.firestore = true; } catch { out.firestore = false; }
    }
    return send(res, out.serviceAccount && out.firestore && out.vapid ? 200 : 503, out);
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || (req.headers.authorization || '') !== `Bearer ${secret}`) return send(res, 401, { error: 'unauthorized' });
  const sa = serviceAccount();
  if (!sa) return send(res, 503, { error: 'service_account_missing', need: 'Set FIREBASE_SERVICE_ACCOUNT in Vercel env.' });
  if (!vapidConfigured()) return send(res, 503, { error: 'vapid_missing' });
  const slot = q.get('slot') === 'evening' ? 'evening' : 'morning';
  const started = Date.now();

  const nest = await dispatchNest({ force: true }).catch(() => null);
  const subd = await dispatchSubs({ force: true }).catch(() => null);
  const warn = await checkWarnings({ force: true }).catch((e) => ({ error: String(e.message || 'error').slice(0, 60) }));
  const token = await serviceToken(sa);
  const now = new Date();
  const today = hkDay(now);
  const tomorrow = hkDay(new Date(now.getTime() + 864e5));
  const { profiles, subsByUid } = await allSubscribers(token);
  const holidays = { 'zh-Hant': await fetchHolidays('zh-Hant').catch(() => []), en: await fetchHolidays('en').catch(() => []) };

  const famCache = new Map();
  const family = async (fid) => {
    if (!famCache.has(fid)) {
      famCache.set(fid, Promise.all([
        fsList(`families/${fid}/reminders`, token).catch(() => []), fsList(`families/${fid}/members`, token).catch(() => []),
        fsGet(`families/${fid}`, token).catch(() => null), fsList(`families/${fid}/inbox`, token).catch(() => []),
      ]).then(([reminders, members, doc, inbox]) => ({ reminders, members, ownerId: doc?.ownerId || '', inbox })));
    }
    return famCache.get(fid);
  };

  let sent = 0, skipped = 0, removed = 0, scanned = 0, added = 0;
  // Every user in a family (scan even without a push device, so cards are waiting on Home).
  for (const [uid, prof] of profiles) {
    if (!prof.familyId) continue;
    const p = prefsOf(prof);
    const lang = langOf(p.lang); const hans = p.lang === 'zh-Hans'; const L = T[lang]; const XL = X[lang];
    const fam = await family(prof.familyId);
    let fresh = [];
    if (slot === 'morning' && Date.now() - started < 38e3 && Object.keys(prof.googleVault || {}).length && (prof.connections?.gmail || prof.connections?.googleclassroom)) {
      try {
        const r = await scanUser({ uid, prof, members: fam.members, ownerId: fam.ownerId, fsToken: token, now: now.getTime(), days: 2, lang });
        fresh = r.added; scanned++; added += r.added.length;
      } catch {}
    }
    const subs = subsByUid.get(uid) || [];
    if (!subs.length || !p.pushEnabled || inQuietHours(p, now)) { skipped++; continue; }

    const mine = fam.reminders.filter((r) => !r.done && r.dueAt && (!r.memberId || r.memberId === uid));
    const remToday = mine.filter((r) => hkDay(toDate(r.dueAt)) === today);
    const remTomorrow = mine.filter((r) => hkDay(toDate(r.dueAt)) === tomorrow);
    const dl = (prof.deadlines || []).filter((d) => d?.dueAt);
    const hw = dl.filter((d) => !(d.kind === 'test' || TEST_RE.test(d.title || '')));
    const tests = [...dl.filter((d) => d.kind === 'test' || TEST_RE.test(d.title || '')), ...mine.filter((r) => TEST_RE.test(r.title || ''))];
    const soon = (d) => { const k = hkDay(toDate(d.dueAt)); return k === today || k === tomorrow; };
    const isTomorrow = (d) => hkDay(toDate(d.dueAt)) === tomorrow;
    const bdayOf = (m) => m.birthday || profiles.get(m.uid)?.birthday || '';
    const bdays = fam.members.filter((m) => bdayOf(m) && String(bdayOf(m)).slice(5) === today.slice(5)).map((m) => m.displayName).filter(Boolean);
    const myInbox = fam.inbox.filter((i) => i.uid === uid);

    const notes = [];
    if (slot === 'morning') {
      const parts = [];
      if (p.notifyReminders && remToday.length) parts.push(['rem', L.remTitle, L.reminders(remToday.length), '/app/reminders']);
      if (p.notifyHomework && hw.filter(soon).length) parts.push(['hw', L.hwTitle, L.homework(hw.filter(soon).length), '/app']);
      if (p.notifyTests && tests.filter(soon).length) parts.push(['test', L.testTitle2, L.tests(tests.filter(soon).length), '/app']);
      if (p.notifyBirthdays && bdays.length) parts.push(['bday', L.bdayTitle, L.birthday(bdays.join(lang === 'en' ? ', ' : '、')), '/app/family']);
      if (p.notifyNotices !== false && fresh.length) {
        const n = (k) => fresh.filter((x) => x.kind === k).length;
        const bits = [n('notice') && XL.notices(n('notice')), n('bill') && XL.bills(n('bill')), (n('test') + n('homework')) && XL.tests(n('test') + n('homework'))].filter(Boolean);
        if (bits.length) parts.push(['auto', L.briefTitle, bits.join(L.sep), '/app']);
      }
      if (p.notifyBills !== false) {
        const lead = Number(p.billLead) || 3;
        myInbox.filter((i) => i.kind === 'bill' && i.date && !['paid', 'dismissed'].includes(i.status)).forEach((b) => {
          const n = daysUntil(b.date, now.getTime());
          if (n === lead || n === 1 || n === 0) parts.push(['bill', lang === 'en' ? 'Bills & fees' : '帳單及費用', XL.billDue(money(b, lang), n), '/app']);
        });
      }
      upcomingHolidays(holidays[lang], now.getTime(), 4).filter((h) => h.inDays === 1 || h.inDays === 3).forEach((h) => parts.push(['hol', lang === 'en' ? 'Public holiday' : '公眾假期', XL.holiday(h.name, h.inDays), '/app/calendar']));
      let gb = null;
      if (p.notifyBrief && Date.now() - started < 45e3) { try { gb = await googleBrief(uid, prof); } catch { gb = null; } }
      if (p.notifyBrief && gb) {
        const extra = parts.map((x) => x[2]).join(L.sep);
        const body = (await pushBriefText(lang, gb.text, extra)) || [extra, countsText(lang, gb.counts)].filter(Boolean).join(L.sep);
        if (body) notes.push({ title: L.briefTitle, body, url: '/app', tag: `brief-${today}` });
      } else if (p.notifyBrief && parts.length) notes.push({ title: L.briefTitle, body: parts.map((x) => x[2]).join(L.sep), url: '/app', tag: `brief-${today}` });
      else parts.forEach(([k, title, body, url], i) => notes.push({ title, body, url, tag: `${k}-${today}-${i}` }));
    } else {
      // "Revised yet?" nudges, one per item (max 3), with Yes / Not yet actions (Android / desktop; iOS opens the app).
      let work = [];
      if ((p.notifyTests || p.notifyHomework) && prof.connections?.googleclassroom && Date.now() - started < 45e3) {
        try { const gb = await googleBrief(uid, prof, ['googleclassroom']); work = (gb?.data?.googleclassroom || []).flatMap((a) => a.items?.work || []); } catch {}
      }
      const items = nudgeItems({ work, deadlines: dl, inbox: myInbox, reminders: fam.reminders }, tomorrow, uid)
        .filter((n) => (n.kind === 'test' ? p.notifyTests : p.notifyHomework) && prof.nudges?.[n.key]?.a !== 'yes').slice(0, 3);
      items.forEach((n) => notes.push({
        title: XL.nudgeTitle(n.kind), body: n.kind === 'test' ? XL.nudgeBody(n.title) : XL.nudgeBodyHw(n.title), url: `/app?nudge=${n.key}`, tag: `nudge-${n.key}`,
        actions: [{ action: 'yes', title: n.kind === 'test' ? XL.yes : XL.yesHw }, { action: 'later', title: XL.notYet }],
      }));
      const partsT = [];
      if (p.notifyReminders && remTomorrow.length) partsT.push(L.remindersTomorrow(remTomorrow.length));
      if (!items.length && p.notifyHomework && hw.filter(isTomorrow).length) partsT.push(L.homeworkTomorrow(hw.filter(isTomorrow).length));
      if (!items.length && p.notifyTests && tests.filter(isTomorrow).length) partsT.push(L.testsTomorrow(tests.filter(isTomorrow).length));
      if (partsT.length) notes.push({ title: L.tomorrowTitle, body: partsT.join(L.sep), url: '/app/reminders', tag: `tomorrow-${today}` });
    }
    if (!notes.length) { skipped++; continue; }
    for (const s of subs) {
      let gone = false;
      for (const n of notes) {
        const r = await pushTo(s, { ...n, lang, hans });
        if (r === 'ok') sent++;
        if (r === 'gone') { removed++; gone = true; await removeSub(uid, s, token); break; }
      }
      if (gone) continue;
    }
  }
  return send(res, 200, { ok: true, slot, users: subsByUid.size, sent, skipped, removed, scanned, added, warn: { pushed: warn?.pushed || 0, new: warn?.new || [] }, nest: nest?.sent || 0, subDecisions: subd?.sent || 0, ms: Date.now() - started });
}

// POST /api/auto/scan — the caller's own accounts, read with their ID token (Firestore rules apply to every write).
async function autoScan(req, res, q) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  const prof = await fsGet(`users/${me.uid}`, me.token).catch(() => null);
  if (!prof?.familyId) return send(res, 200, { ok: true, added: [], skipped: 'no_family' });
  const last = prof.autoScanAt ? Date.parse(prof.autoScanAt) : 0;
  const minGap = body?.force ? 2 * 60e3 : 15 * 60e3;
  if (Date.now() - last < minGap) return send(res, 200, { ok: true, added: [], skipped: 'recent', at: last });
  const [members, famDoc] = await Promise.all([fsList(`families/${prof.familyId}/members`, me.token).catch(() => []), fsGet(`families/${prof.familyId}`, me.token).catch(() => null)]);
  const r = await scanUser({ uid: me.uid, prof, members, ownerId: famDoc?.ownerId || '', fsToken: me.token, days: 3, lang: body?.lang === 'en' ? 'en' : 'zh-Hant' });
  return send(res, 200, { ok: true, added: r.added, scanned: r.scanned, errors: r.errors.map((e) => ({ source: e.source || '', error: String(e.error) })), at: Date.now() });
}

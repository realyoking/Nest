import './_env.mjs';
// Unit tests: nestcal, intent, insights, memory, subscriptions, chat date labels / greetings, transit.
// node --test test/v8.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanNestEvent, occurrences, firesBetween, nextFire, nestCalendarEvents } from '../src/lib/nestcal.js';
import { parseIntent, parseWhen, cardWhen, parseCardBlock, stripCardBlock } from '../src/lib/intent.js';
import { computeInsights, preferredReminderTime } from '../src/lib/insights.js';
import { plainMemories, entitiesOf, personContext, upcomingNotes, chatMemList } from '../src/lib/memory.js';
import { cleanSub, currentRenewal, decisionPending, nextDecisionFire, deciderOf, monthlyTotal, groupByMember, usageHint, cancelReminderAt, discussReminderAt, daysUntil } from '../src/lib/subs.js';
import { detectSub, subItem } from '../src/lib/detect.js';
import { dueStatus, annotateDates, dueTag, ageOf, isGreeting, hkNow } from '../src/lib/chatctx.js';
import { findStations, planMtr, trainServes, trainsForLeg, transportQuery } from '../src/lib/transit.js';

const NOW = Date.parse('2026-10-18T14:30:00+08:00'); // Sunday
const HK = (s) => Date.parse(`${s}+08:00`);
const hm = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

// ---------- nestcal ----------
test('nestcal: clean + validation', () => {
  assert.throws(() => cleanNestEvent({ title: '' }), /bad_event/);
  const e = cleanNestEvent({ title: ' 家長日 ', allDay: true, start: '2026-10-20' });
  assert.equal(e.title, '家長日'); assert.equal(e.end, '2026-10-21'); assert.equal(e.repeat, 'none');
  const r = cleanNestEvent({ title: 'x', start: '2026-10-20T10:00:00+08:00', end: '2026-10-20T11:00:00+08:00', reminders: [60, 10, 10, 99999], members: ['ok_1', 'bad uid'] });
  assert.deepEqual(r.reminders, [10, 60]); assert.deepEqual(r.members, ['ok_1']);
});
test('nestcal: weekly recurrence + until, monthly skips short months', () => {
  const w = { title: 'Piano', allDay: false, start: '2026-10-05T10:00:00+08:00', end: '2026-10-05T11:00:00+08:00', repeat: 'weekly', until: '2026-10-26', reminders: [] };
  const occ = occurrences(w, HK('2026-10-01T00:00:00'), HK('2026-12-01T00:00:00'));
  assert.deepEqual(occ.map((o) => hm(o.startMs)), ['2026-10-05 10:00', '2026-10-12 10:00', '2026-10-19 10:00', '2026-10-26 10:00']);
  const m = { title: 'Rent', allDay: true, start: '2026-01-31', end: '2026-02-01', repeat: 'monthly', reminders: [] };
  const mo = occurrences(m, HK('2026-01-01T00:00:00'), HK('2026-06-01T00:00:00'));
  assert.deepEqual(mo.map((o) => hm(o.startMs).slice(0, 10)), ['2026-01-31', '2026-03-31', '2026-05-31']);
});
test('nestcal: reminder fire times (timed + all-day at 09:00) and nextFire', () => {
  const e = { title: 'Dentist', allDay: false, start: '2026-10-19T15:00:00+08:00', end: '2026-10-19T16:00:00+08:00', repeat: 'none', reminders: [60, 1440] };
  const f = firesBetween(e, NOW, HK('2026-10-20T00:00:00'));
  assert.deepEqual(f.map((x) => [hm(x.at), x.minutes]), [['2026-10-18 15:00', 1440], ['2026-10-19 14:00', 60]]);
  assert.equal(hm(nextFire(e, NOW)), '2026-10-18 15:00');
  const a = { title: 'Trip', allDay: true, start: '2026-10-20', end: '2026-10-21', repeat: 'none', reminders: [0] };
  assert.equal(hm(nextFire(a, NOW)), '2026-10-20 09:00');
  assert.equal(nextFire({ ...e, reminders: [] }, NOW), null);
  const cal = nestCalendarEvents([{ ...e, id: 'e1' }], NOW, HK('2026-10-25T00:00:00'));
  assert.equal(cal.length, 1); assert.equal(cal[0].calKey, 'nest|events'); assert.equal(cal[0].editable, true);
});

// ---------- intent ----------
test('intent: 「明天要交午餐費」 → reminder tomorrow', () => {
  const c = parseIntent('明天要交午餐費', 'zh-Hant', NOW, { defaultTime: '18:00' });
  assert.equal(c.type, 'reminder'); assert.equal(c.date, '2026-10-19'); assert.equal(c.time, '18:00'); assert.match(c.title, /午餐費/);
  assert.equal(cardWhen(c), '10/19 18:00');
});
test('intent: questions give no card; memory / shopping / events', () => {
  assert.equal(parseIntent('明天有甚麼功課？', 'zh-Hant', NOW), null);
  assert.equal(parseIntent('Hi lol', 'en', NOW), null);
  assert.equal(parseIntent('記住 嫲嫲對花生敏感', 'zh-Hant', NOW).type, 'memory');
  assert.equal(parseIntent('買牛奶', 'zh-Hant', NOW).type, 'shopping');
  const ev = parseIntent('逢星期六上午10點鋼琴課', 'zh-Hant', NOW);
  assert.equal(ev.type, 'event'); assert.equal(ev.repeat, 'weekly'); assert.equal(ev.time, '10:00'); assert.equal(ev.date, '2026-10-24');
});
test('intent: parseWhen weekdays and times', () => {
  assert.equal(parseWhen('下星期三下午三點半', NOW).date, '2026-10-21');
  assert.equal(parseWhen('下星期三下午三點半', NOW).time, '15:30');
  assert.equal(parseWhen('tomorrow 7pm', NOW).time, '19:00');
  assert.equal(parseWhen('後天', NOW).date, '2026-10-20');
  assert.deepEqual(parseCardBlock('ok ```nest-card {"type":"reminder","title":"x"}```'), { type: 'reminder', title: 'x' });
  assert.equal(stripCardBlock('hi ```nest-card {"a":1}```'), 'hi');
});

// ---------- insights ----------
test('insights: preferred reminder time + recurring pattern', () => {
  const uid = 'u1';
  const mk = (d, title = '練琴') => ({ createdBy: uid, title, dueAt: new Date(HK(`${d}T20:00:00`)) });
  const reminders = [mk('2026-09-26'), mk('2026-10-03'), mk('2026-10-10'), mk('2026-10-17'), { createdBy: uid, title: '交表', dueAt: new Date(HK('2026-10-14T09:00:00')) }];
  const ins = computeInsights({ uid, reminders, now: NOW });
  const rt = ins.find((x) => x.key === 'reminderTime');
  assert.equal(rt.data.time, '20:00'); assert.ok(rt.confidence > 0.4 && rt.confidence <= 0.95);
  const rec = ins.find((x) => x.key === 'recurring');
  assert.equal(rec.data.weekday, 6); assert.match(rec.text, /星期六/);
  assert.equal(preferredReminderTime({ user: { uid }, memories: [{ kind: 'insight', memberId: uid, key: 'reminderTime', confidence: 0.6, data: { time: '20:00' } }] }), '20:00');
  assert.equal(preferredReminderTime({ user: { uid }, memories: [{ kind: 'insight', memberId: uid, key: 'reminderTime', confidence: 0.2, data: { time: '20:00' } }] }), '');
  assert.deepEqual(computeInsights({ uid, reminders: reminders.slice(0, 2), now: NOW }), []);
});

// ---------- memory ----------
test('memory: toggle off hides chat-derived memory; entities; person context', () => {
  const s = {
    user: { uid: 'u1' }, members: [{ uid: 'u1', displayName: 'Mia' }], memberName: () => 'Mia',
    memories: [{ id: 'a', text: '家用 wifi 密碼在雪櫃' }, { id: 'b', kind: 'chat', text: 'Mia 喜歡打羽毛球' }, { id: 'c', kind: 'insight', text: 'x' },
      { id: 'd', kind: 'entity', type: 'person', name: '嫲嫲', fields: { relation: '嫲嫲' }, notes: [{ text: '上次說膝頭痛', at: 1 }] }],
    profile: { privateMem: { p1: { type: 'doctor', name: '陳醫生' } }, chatMem: { c1: { text: '明天重要會議', exp: '2099-10-19', at: 2 }, c2: { text: '舊事', exp: '2020-01-01', at: 1 } } },
  };
  assert.deepEqual(plainMemories(s, true).map((m) => m.id), ['a', 'b']);
  assert.deepEqual(plainMemories(s, false).map((m) => m.id), ['a']);
  assert.deepEqual(entitiesOf(s).map((e) => e.vis), ['family', 'private']);
  assert.deepEqual(personContext(s, '打電話給嫲嫲'), { name: '嫲嫲', note: '上次說膝頭痛' });
  assert.equal(personContext(s, '交功課'), null);
  assert.deepEqual(chatMemList(s.profile).map((m) => m.id), ['c1']); // expired one dropped
  assert.ok(Array.isArray(upcomingNotes(s.profile)));
});

// ---------- subscriptions ----------
test('subs: renewal stepping, pending window, fire time', () => {
  const sub = cleanSub({ service: 'Netflix', amount: '93', cycle: 'monthly', renewDate: '2026-07-20' });
  assert.equal(currentRenewal(sub, NOW), '2026-10-20');
  assert.deepEqual(decisionPending(sub, NOW), { renewal: '2026-10-20', days: 2 });
  assert.equal(decisionPending({ ...sub, decision: { renewal: '2026-10-20', choice: 'keep' } }, NOW), null);
  assert.equal(decisionPending({ ...sub, renewDate: '2026-10-25' }, NOW), null); // 7 days away
  // Fire: 3 days before at 09:00 HKT, or now if that passed and still undecided.
  assert.equal(nextDecisionFire(sub, NOW), NOW);
  assert.equal(hm(nextDecisionFire({ ...sub, renewDate: '2026-10-30' }, NOW)), '2026-10-27 09:00');
  // Already notified for this renewal → next month's.
  assert.equal(hm(nextDecisionFire({ ...sub, notified: '2026-10-20' }, NOW)), '2026-11-17 09:00');
  assert.equal(currentRenewal({ renewDate: '2026-01-31', cycle: 'monthly' }, NOW), '2026-10-31');
  assert.equal(currentRenewal({ renewDate: '2025-11-02', cycle: 'yearly' }, NOW), '2026-11-02');
  assert.equal(currentRenewal({ renewDate: '2026-10-11', cycle: 'weekly' }, NOW), '2026-10-18');
  assert.throws(() => cleanSub({ service: '' }), /bad_sub/);
  assert.equal(cleanSub({ service: 'x', cancelUrl: 'javascript:alert(1)' }).cancelUrl, '');
});
test('subs: totals, grouping, decider default, reminders', () => {
  const subs = [{ service: 'A', amount: 100, cycle: 'monthly', member: '' }, { service: 'B', amount: 1200, cycle: 'yearly', member: 'k' }, { service: 'C', amount: 10, cycle: 'weekly', member: 'k' }];
  assert.equal(Math.round(monthlyTotal(subs)), Math.round(100 + 100 + 10 * 30.44 / 7));
  const g = groupByMember(subs, [{ uid: 'p', role: 'parent' }, { uid: 'k', role: 'student' }]);
  assert.deepEqual(g.map((x) => [x.uid, x.subs.length]), [['', 1], ['k', 2]]);
  const members = [{ uid: 'k', role: 'student' }, { uid: 'p', role: 'parent' }];
  assert.equal(deciderOf({}, { ownerId: 'k' }, members), 'p'); // student owner → first parent
  assert.equal(deciderOf({}, { ownerId: 'p' }, members), 'p');
  assert.equal(deciderOf({ decider: 'k' }, { ownerId: 'p' }, members), 'k');
  assert.equal(deciderOf({ decider: 'gone' }, { ownerId: 'p' }, members), 'p');
  assert.equal(hm(cancelReminderAt('2026-10-20', NOW)), '2026-10-19 09:00');
  assert.equal(hm(discussReminderAt(NOW)), '2026-10-18 20:00');
  assert.equal(hm(discussReminderAt(HK('2026-10-18T19:45:00'))), '2026-10-19 20:00');
  assert.deepEqual(usageHint({ lastUsed: '2026-09-01' }, NOW), { days: 47, stale: true });
  assert.equal(daysUntil('2026-10-21', NOW), 3);
});
test('subs: email receipt detection', () => {
  const m = { from: 'Netflix <info@account.netflix.com>', subject: 'Your Netflix membership will renew', snippet: 'Your monthly plan HK$93 renews on 20/10/2026.', source: 'gmail', date: '2026-10-15T10:00:00+08:00' };
  assert.ok(detectSub(m));
  const it = subItem(m, NOW, 'zh-Hant');
  assert.equal(it.kind, 'sub'); assert.equal(it.service, 'Netflix'); assert.equal(it.cycle, 'monthly'); assert.equal(it.amount, 93);
  assert.match(it.cancelUrl, /^https:\/\/www\.netflix\.com/);
  assert.equal(detectSub({ from: 'Shop', subject: '50% off', snippet: 'sale' }), null);
});

// ---------- chat date labels (the 「16 Oct is due today」 bug) ----------
test('chat: date status labels are pre-computed on the HK clock', () => {
  assert.match(dueStatus('2026-10-16', NOW).label, /OVERDUE by 2 days/);
  assert.equal(dueStatus('2026-10-16', NOW).status, 'overdue');
  assert.match(dueStatus('2026-10-20T23:59', NOW).label, /^Tue 20 Oct 23:59 — due in 2 days$/);
  assert.equal(dueStatus('2026-10-18T23:59', NOW).status, 'today');
  assert.equal(dueStatus('2026-10-18T09:00', NOW).status, 'overdue');
  assert.equal(dueStatus('2026-10-19', NOW).status, 'tomorrow');
  assert.equal(dueStatus('2026-10-18T10:00', NOW, 'when').status, 'past');
  const txt = annotateDates(`物理 — due ${dueTag(new Date('2026-10-20T15:59:00Z'))}; 生物 — due ${dueTag('2026-10-16T15:59:00Z')}`, NOW);
  assert.match(txt, /物理 — due Tue 20 Oct 23:59 — due in 2 days/);
  assert.match(txt, /生物 — due Fri 16 Oct 23:59 — OVERDUE by 2 days/);
  assert.equal(hkNow(NOW).weekday, 'Sunday');
  assert.equal(ageOf('2012-10-19', NOW), 13); assert.equal(ageOf('2012-10-18', NOW), 14); assert.equal(ageOf('bad', NOW), null);
});
test('chat: greeting detection', () => {
  for (const g of ['Hi lol', 'hello!', '早晨', 'hey nest', 'lol', '你好']) assert.ok(isGreeting(g), g);
  for (const g of ['Hi, what homework is due?', 'Guess how old am I', '明天要交午餐費']) assert.ok(!isGreeting(g), g);
});

// ---------- transit ----------
test('transit: stations, routes, direction-aware trains, chat queries', () => {
  assert.deepEqual(findStations('next train from tai wai to sha tin').map((x) => x.code), ['TAW', 'SHT']);
  assert.deepEqual(findStations('沙田圍去沙田').map((x) => x.code), ['STW', 'SHT']); // longest match first
  const p = planMtr('TAW', 'SHT');
  assert.equal(p.legs.length, 1); assert.equal(p.legs[0].line, 'EAL');
  const leg = p.legs[0];
  assert.ok(trainServes(leg, 'LOW')); assert.ok(trainServes(leg, 'LMC')); assert.ok(!trainServes(leg, 'ADM'));
  const rows = trainsForLeg({ UP: [{ t: NOW + 60e3, dest: 'LOW' }], DOWN: [{ t: NOW + 30e3, dest: 'ADM' }] }, leg, NOW);
  assert.deepEqual(rows.map((x) => x.dest), ['LOW']);
  assert.deepEqual(planMtr('ADM', 'AIR').legs.map((l) => l.line), ['ISL', 'WALK', 'AEL']);
  assert.deepEqual(transportQuery('What is the next train from tai wai to sha tin'), { kind: 'mtr', from: 'TAW', to: 'SHT' });
  assert.deepEqual(transportQuery('How do I get to Central from Sha Tin'), { kind: 'mtr', from: 'SHT', to: 'CEN' });
  assert.equal(transportQuery('Hi lol'), null);
  assert.equal(transportQuery('next 81 bus at tai wai').kind, 'bus');
});
test('chat: simplified → traditional safety net', async () => {
  const { toTraditional } = await import('../src/lib/chatctx.js');
  assert.equal(toTraditional('有什么我可以帮你？'), '有什麼我可以幫你？');
  assert.equal(toTraditional('北斗 范先生 皇后'), '北斗 范先生 皇后'); // ambiguous characters untouched
});

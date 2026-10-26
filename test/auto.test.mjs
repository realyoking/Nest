import './_env.mjs';
// Detection / digest / nudge tests with fixture Gmail + Classroom data (the test accounts have no Google).
// node --test test/auto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectKind, heuristicItem, parseDates, pickDate, parseAmount, autoId, mergeLlm, parseLlm, pickSigner, billReminderTimes, nudgeItems, nudgeKey } from '../src/lib/detect.js';
import { buildDigest, demoInputs, inboxCat } from '../src/lib/digest.js';
import { messageText, inboxDoc } from '../api/_auto.js';

const NOW = Date.parse('2026-10-18T05:00:00Z'); // Sun 18 Oct 2026 13:00 HKT

const FIX = {
  notice: { id: 'g1', from: '聖保羅小學 <office@spps.edu.hk>', subject: '通告第12號：秋季旅行（請交回回條）', snippet: '秋季旅行將於10月28日舉行，請家長於10月23日(星期五)前簽署回條交回班主任。', source: 'gmail', account: 'mum@gmail.com' },
  noticeEn: { id: 'g2', from: 'Kowloon Junior School <info@kjs.edu.hk>', subject: 'Letter to parents: Sports Day', snippet: 'Sports Day is on 6 Nov 2026. Please return the consent form by 30 Oct.', source: 'gmail' },
  bill: { id: 'g3', from: 'CLP <ebill@clp.com.hk>', subject: 'Your CLP e-Bill is ready', snippet: 'Amount due HK$532.10. Payment due date 05/11/2026.', source: 'gmail' },
  lunch: { id: 'g4', from: 'School Office <office@abc.edu.hk>', subject: '十一月份午膳費繳費通知', snippet: '十一月份午膳費為港幣 $420，請於 2026年10月30日 或之前繳交。', source: 'gmail' },
  test: { id: 'c1', from: '4A 中文', subject: '中文默書（第三課）', snippet: '下星期二 21/10 默書，請溫習第三課。', source: 'classroom' },
  promo: { id: 'g5', from: 'Shop <deals@shop.com>', subject: '50% off this weekend only', snippet: 'Big sale on everything', source: 'gmail' },
  code: { id: 'g6', from: 'Google <no-reply@accounts.google.com>', subject: 'Security alert', snippet: 'New sign-in on Mac', source: 'gmail' },
  receipt: { id: 'g7', from: 'Apple <no_reply@email.apple.com>', subject: 'Your receipt from Apple', snippet: 'Thank you', source: 'gmail' },
};

test('classifies fixture emails', () => {
  assert.equal(detectKind(FIX.notice).kind, 'notice');
  assert.equal(detectKind(FIX.noticeEn).kind, 'notice');
  assert.equal(detectKind(FIX.bill).kind, 'bill');
  assert.equal(detectKind(FIX.lunch).kind, 'bill');
  assert.equal(detectKind(FIX.test).kind, 'test');
  assert.equal(detectKind(FIX.promo).kind, null);
  assert.equal(detectKind(FIX.code).kind, null);
  assert.equal(detectKind(FIX.receipt).kind, null);
});

test('dates: HK day-first, Chinese, English, deadline markers', () => {
  const d = parseDates(FIX.notice.snippet, NOW);
  assert.deepEqual(d.map((x) => x.date), ['2026-10-28', '2026-10-23']);
  assert.equal(pickDate(d, NOW).date, '2026-10-23'); // the reply deadline, not the trip
  assert.equal(pickDate(parseDates(FIX.noticeEn.snippet, NOW), NOW).date, '2026-10-30');
  assert.equal(pickDate(parseDates(FIX.bill.snippet, NOW), NOW).date, '2026-11-05');
  assert.equal(pickDate(parseDates('考試 3/1', NOW), NOW).date, '2027-01-03'); // past this year → next year
  assert.equal(parseDates('集合時間 10月28日 上午8時30分', NOW)[0].time, '08:30');
  assert.equal(parseDates('Meet on Oct 28 at 2:15 pm', NOW)[0].time, '14:15');
});

test('amounts', () => {
  assert.equal(parseAmount(FIX.bill.snippet).amount, 532.1);
  assert.equal(parseAmount(FIX.lunch.snippet).amount, 420);
  assert.equal(parseAmount('應繳金額 HK$1,234.50，上期 HK$99').amount, 1234.5);
  assert.equal(parseAmount('no money here'), null);
});

test('heuristic items + model merge', () => {
  const n = heuristicItem(FIX.notice, NOW);
  assert.equal(n.kind, 'notice'); assert.equal(n.date, '2026-10-23'); assert.equal(n.needsReply, true);
  const b = heuristicItem(FIX.bill, NOW);
  assert.equal(b.kind, 'bill'); assert.equal(b.amount, 532.1); assert.equal(b.payee, 'CLP 中電'); assert.equal(b.date, '2026-11-05');
  const t = heuristicItem(FIX.test, NOW);
  assert.equal(t.kind, 'test'); assert.equal(t.date, '2026-10-21');
  const llm = parseLlm('```json\n[{"i":0,"kind":"notice","title":"秋季旅行回條","date":"2026-10-23","time":"","action":"簽署回條並於星期五前交回","needsReply":true,"amount":null,"payee":""},{"i":1,"kind":"none"}]\n```');
  assert.equal(llm.length, 2);
  const m = mergeLlm(n, llm[0]);
  assert.equal(m.title, '秋季旅行回條'); assert.equal(m.action, '簽署回條並於星期五前交回');
  assert.equal(mergeLlm(n, llm[1]), null); // model veto
  assert.equal(mergeLlm(n, { i: 0, kind: 'notice', date: 'next friday' }).date, '2026-10-23'); // bad date ignored
});

test('dedupe ids are stable and distinct', () => {
  const a = autoId({ type: 'gmail', account: 'Mum@Gmail.com', id: '18f' });
  assert.equal(a, autoId({ type: 'gmail', account: 'mum@gmail.com', id: '18f' }));
  assert.notEqual(a, autoId({ type: 'gmail', account: 'mum@gmail.com', id: '190' }));
  assert.match(a, /^a[0-9a-f]{16}$/);
});

test('signer + bill reminder times', () => {
  const members = [{ uid: 'k', role: 'student' }, { uid: 'd', role: 'parent' }, { uid: 'm', role: 'parent' }];
  assert.equal(pickSigner(members, 'k', 'm'), 'm');
  assert.equal(pickSigner(members, 'd', 'm'), 'd');
  const times = billReminderTimes('2026-10-25', 3, NOW).map((d) => d.toISOString());
  assert.deepEqual(times, ['2026-10-22T01:00:00.000Z', '2026-10-24T01:00:00.000Z']); // 09:00 HKT, 3 days + 1 day before
  assert.deepEqual(billReminderTimes('2026-10-19', 3, NOW).map((d) => d.toISOString()), ['2026-10-18T01:00:00.000Z'].filter((x) => Date.parse(x) > NOW).concat([]));
});

test('gmail full payload → text + attachments; inbox doc shape', () => {
  const b64 = (s) => Buffer.from(s).toString('base64url');
  const payload = { mimeType: 'multipart/mixed', parts: [{ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/html', body: { data: b64('<p>請於<b>10月23日</b>前交回回條</p>') } }] }, { mimeType: 'application/pdf', filename: '通告12.pdf', body: {} }] };
  const { text, attachments } = messageText(payload);
  assert.match(text, /10月23日/); assert.deepEqual(attachments, ['通告12.pdf']);
  const doc = inboxDoc('u1', { ...FIX.notice, link: 'https://mail.google.com/x' }, heuristicItem(FIX.notice, NOW), { members: [{ uid: 'u1', role: 'parent' }], ownerId: 'u1' });
  assert.equal(doc.uid, 'u1'); assert.equal(doc.status, 'new'); assert.equal(doc.kind, 'notice'); assert.equal(doc.signer, 'u1');
  assert.equal(doc.reminder.dueAt, '2026-10-23T08:00'); assert.equal(doc.src.id, 'g1');
});

test('nudges: due tomorrow from every source, one key per item', () => {
  const tomorrow = '2026-10-19';
  const list = nudgeItems({
    work: [{ title: 'Maths worksheet', course: '4A', due: '2026-10-19T15:59:00Z' }],
    deadlines: [{ title: 'Maths worksheet', course: '4A', dueAt: '2026-10-19T15:59:00Z', kind: 'homework' }],
    inbox: [{ uid: 'u1', kind: 'test', status: 'new', title: '中文默書（第三課）', date: tomorrow }, { uid: 'u2', kind: 'test', status: 'new', title: 'other kid', date: tomorrow }],
    reminders: [{ title: 'English spelling test', dueAt: new Date('2026-10-19T00:30:00Z'), memberId: '', done: false }, { title: 'Buy milk', dueAt: new Date('2026-10-19T02:00:00Z') }],
  }, tomorrow, 'u1');
  assert.deepEqual(list.map((x) => [x.title, x.kind]), [['Maths worksheet', 'homework'], ['中文默書（第三課）', 'test'], ['English spelling test', 'test']]);
  assert.equal(list[1].key, nudgeKey('中文默書（第三課）', tomorrow));
});

test('digest: categories, caps, pinned urgent, dedupe of scanned mail', () => {
  const demo = demoInputs('zh-Hant', NOW);
  const inbox = [
    { id: 'i1', kind: 'notice', status: 'new', title: '秋季旅行回條', date: '2026-10-23', src: { id: 'm2' } },
    { id: 'i2', kind: 'bill', status: 'accepted', title: '午膳費', payee: '學校', amount: 420, date: '2026-10-19' },
    { id: 'i3', kind: 'bill', status: 'paid', title: 'old', date: '2026-10-10' },
    { id: 'i4', status: 'new', title: 'AI: 繳交午膳費', body: '' },
  ];
  const warn = { warnings: [{ code: 'WRAINA', name: '黃色暴雨警告信號', type: '', sev: 2, issued: NOW }], school: null, suspension: [] };
  const many = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, from: 'a@b.c', subject: `Hello ${i}`, snippet: '', date: new Date(NOW - i * 6e4), unread: i < 5 }));
  const d = buildDigest({ brief: { ...demo.brief, gmail: [{ account: 'a', items: [...demo.brief.gmail[0].items, ...many] }] }, inbox, warn, weather: demo.weather, reminders: [{ id: 'r', title: 'x', dueAt: new Date(NOW - 3600e3) }], uid: 'u', now: NOW });
  const cat = Object.fromEntries(d.cats.map((c) => [c.id, c]));
  assert.equal(cat.gmail.count, 43); // HKBN statement (m2) is in the notice card's src → skipped from Gmail
  assert.equal(cat.notices.items[0].inboxId, 'i1');
  assert.equal(cat.bills.items.find((x) => x.inboxId === 'i2').urgent, true); // due tomorrow
  assert.ok(!cat.bills.items.some((x) => x.inboxId === 'i3')); // paid → hidden
  assert.equal(inboxCat(inbox[3]), 'bills'); // AI item classified by text
  assert.equal(d.pinned[0].id, 'w|WRAINA'); // warnings pinned first
  assert.ok(d.pinned.length <= 4);
});

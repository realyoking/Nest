import './_env.mjs';
// Run 23b: family-wide memory per member (+ edit permissions), restrained suggestions, Home panels, Files tab.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { memoryByMember, canEditItem, assertCanEdit, familyItem, canAddMemory, inferCat, aboutOf, MEM_CATS } from '../src/lib/family-memory.js';
import { candidates, pick, weight, learn, answer, markShown, stateFor, CAP, hkDay } from '../src/lib/suggest.js';
import { cleanPanels, addPanel, removePanel, movePanel, daysUntil, shoppingItems, shopName, homeworkProgress, MAX_PANELS } from '../src/lib/panels.js';
import { collectFiles, filterFiles } from '../src/lib/files.js';
import { systemPrompt } from '../api/chat.js';
import { R23, R23_NAV } from '../src/lib/strings-run23.js';
import { STRINGS } from '../src/lib/strings.js';
import TH from '../src/locales/th.js';
import { CHANGELOG, APP_VERSION } from '../src/data/changelog.js';

const NOW = Date.parse('2026-10-22T12:00:00+08:00'); // Thursday
const members = [
  { uid: 'mum', displayName: '媽媽', role: 'parent', birthday: '1980-10-23' },
  { uid: 'bro', displayName: '哥哥', role: 'kid' },
  { uid: 'gran', displayName: '婆婆', role: 'grandparent' },
  { uid: 'g', displayName: 'Guest', role: 'guest' },
];
const fam = (memoryEdit, ownerId = 'mum') => ({ id: 'f1', ownerId, settings: { memoryEdit } });
const sess = (uid, memoryEdit = 'adults', extra = {}) => ({ user: { uid }, members, me: members.find((m) => m.uid === uid), family: fam(memoryEdit), isOwner: uid === 'mum', memories: [], profile: {}, ...extra });

// ---------- family memory ----------
test('memory: categories are inferred in all three languages', () => {
  assert.equal(inferCat('哥哥對花生過敏'), 'allergy');
  assert.equal(inferCat('Mum loves salmon'), 'preference');
  assert.equal(inferCat('婆婆每晚九時睡覺'), 'habit');
  assert.equal(inferCat('น้องแพ้กุ้ง'), 'allergy');
  assert.equal(inferCat('哥哥讀中三'), 'fact');
  assert.deepEqual(MEM_CATS, ['preference', 'allergy', 'habit', 'fact']);
});

test('memory: items are grouped per member (explicit about, else a name in the text), private only for the owner', () => {
  const s = sess('bro', 'adults', {
    memories: [
      { id: 'a', text: '喜歡吃三文魚', about: 'mum', createdBy: 'mum' },
      { id: 'b', text: '哥哥明天有補習', createdBy: 'mum' },
      { id: 'c', text: '全家星期日飲茶', createdBy: 'gran' },
      { id: 'd', kind: 'insight', text: 'x', memberId: 'bro' },
      { id: 'e', text: 'old', exp: '2026-10-01', createdBy: 'mum' },
    ],
    profile: { chatMem: { p1: { text: 'I like chess', at: 1 } } },
  });
  const g = Object.fromEntries(memoryByMember(s, NOW).map((x) => [x.uid, x.items]));
  assert.deepEqual(g.mum.map((x) => x.id), ['a']);
  assert.deepEqual(g.bro.map((x) => x.id).sort(), ['b', 'p1']);
  assert.equal(g.bro.find((x) => x.id === 'p1').src, 'private');
  assert.deepEqual(g[''].map((x) => x.id), ['c']); // insight excluded, expired excluded
  assert.equal(aboutOf({ text: '婆婆每晚九時睡覺' }, members), 'gran');
});

test('memory permissions: 「誰可以修改家庭記憶」 adults / owner / everyone, own items, guests, private', () => {
  const byMum = familyItem({ id: '1', createdBy: 'mum' });
  const byBro = familyItem({ id: '2', createdBy: 'bro' });
  // adults (default): parent + grandparent edit anything, kid only their own
  assert.equal(canEditItem(sess('gran'), byMum), true);
  assert.equal(canEditItem(sess('bro'), byMum), false);
  assert.equal(canEditItem(sess('bro'), byBro), true);
  // owner only: grandparent can't edit others' items, owner can
  assert.equal(canEditItem(sess('gran', 'owner'), byMum), false);
  assert.equal(canEditItem(sess('mum', 'owner'), byBro), true);
  // everyone: kid can edit anyone's
  assert.equal(canEditItem(sess('bro', 'everyone'), byMum), true);
  // guests never, even with everyone / own items
  assert.equal(canEditItem(sess('g', 'everyone'), byMum), false);
  assert.equal(canEditItem(sess('g', 'everyone'), familyItem({ id: '3', createdBy: 'g' })), false);
  assert.equal(canAddMemory(sess('g')), false);
  assert.equal(canAddMemory(sess('bro')), true);
  // private: only the owner
  assert.equal(canEditItem(sess('bro'), { id: 'p', src: 'private', createdBy: 'bro' }), true);
  assert.equal(canEditItem(sess('mum'), { id: 'p', src: 'private', createdBy: 'bro' }), false);
  assert.throws(() => assertCanEdit(sess('bro'), byMum), (e) => e.code === 'forbidden');
  assert.equal(canEditItem(sess('bro'), null), false);
});

test('agent: memory.update / delete check permission before writing; create checks guests and stores about + cat', () => {
  // agent.js pulls in Firebase (browser only), so this checks the source order: the permission check sits before the write.
  const src = fs.readFileSync(new URL('../src/lib/agent.js', import.meta.url), 'utf8');
  const block = (name) => { const i = src.indexOf(`case '${name}': {`); return src.slice(i, src.indexOf('case ', i + 10)); };
  for (const [n, w] of [['memory.update', 'be.updateMemory'], ['memory.delete', 'be.deleteMemory']]) {
    const b = block(n); assert.ok(b.indexOf('assertCanEdit(s, familyItem(cur))') > 0 && b.indexOf('assertCanEdit') < b.indexOf(w), n);
  }
  const c = block('memory.create');
  assert.ok(c.indexOf('canAddMemory(s)') > 0 && c.indexOf('canAddMemory') < c.indexOf('be.addMemory'));
  assert.match(c, /about, cat/);
});

test('chat prompt: family-wide memory rule (about member + reminder for that member)', () => {
  const p = systemPrompt('chat', 'zh-Hant', {});
  assert.match(p, /"about":"member name/);
  assert.match(p, /Family-wide memory/);
  assert.match(p, /reminder\.create with "member" = that member/);
});

// ---------- suggestions ----------
test('suggest: candidates from birthdays, rain, holiday, overdue and tests (no AI)', () => {
  const c = candidates({
    members, meUid: 'bro', lang: 'zh-Hant', now: NOW,
    weather: { tomorrow: { psr: '高', desc: '有驟雨' } },
    holidays: [{ date: '2026-10-23', name: '重陽節' }],
    reminders: [{ id: 'r1', title: '交午膳費', done: false, dueAt: Date.parse('2026-10-19T09:00:00+08:00') }],
    inbox: [{ id: 'i1', kind: 'test', date: '2026-10-23', title: '數學測驗' }],
  });
  const k = Object.fromEntries(c.map((x) => [x.kind, x]));
  assert.equal(k.birthday.text, '明天是媽媽的生日，要設定提醒嗎？');
  assert.equal(k.birthday.reminder.due, '2026-10-23T08:00');
  assert.ok(k.rain && k.holiday && k.overdue && k.test);
  assert.equal(k.overdue.reminder.reschedule, 'r1');
  const en = candidates({ members, meUid: 'bro', lang: 'en', now: NOW });
  assert.match(en[0].text, /Tomorrow is 媽媽’s birthday/);
  const th = candidates({ members, meUid: 'bro', lang: 'th', now: NOW });
  assert.match(th[0].text, /พรุ่งนี้/);
  // own birthday is never suggested to yourself
  assert.equal(candidates({ members, meUid: 'mum', now: NOW }).filter((x) => x.kind === 'birthday').length, 0);
});

test('suggest: daily cap 0 / 1 / 2, answered ones still count, quiet hours show nothing', () => {
  const cands = candidates({ members, meUid: 'bro', now: NOW, weather: { tomorrow: { psr: '高' } }, holidays: [{ date: '2026-10-23', name: '重陽節' }] });
  assert.equal(cands.length, 3);
  assert.equal(pick({ cands, settings: { suggestLevel: 'off' }, now: NOW }).show.length, 0);
  const low = pick({ cands, settings: { suggestLevel: 'low' }, now: NOW });
  assert.equal(low.show.length, 1); assert.equal(low.show[0].kind, 'birthday'); assert.equal(CAP.low, 1);
  assert.equal(pick({ cands, settings: { suggestLevel: 'normal' }, now: NOW }).show.length, 2);
  // after answering the one of the day, nothing new today (low)
  const st = answer(markShown(low.state, [low.show[0].id]), low.show[0], false);
  assert.equal(pick({ cands, saved: st, settings: { suggestLevel: 'low' }, now: NOW }).show.length, 0);
  // next day resets the log but keeps the learned stats
  const next = stateFor(st, NOW + 864e5);
  assert.deepEqual(next.log, {}); assert.deepEqual(next.stats.birthday, { a: 0, i: 1 });
  // quiet hours (family) and user quiet
  assert.equal(pick({ cands, settings: { suggestLevel: 'normal', quietStart: '11:00', quietEnd: '13:00' }, now: NOW }).show.length, 0);
  assert.equal(pick({ cands, settings: { suggestLevel: 'normal' }, now: NOW, userQuiet: true }).show.length, 0);
  // a shown-but-unanswered suggestion stays (no extra one)
  const shown = markShown(low.state, [low.show[0].id]);
  assert.deepEqual(pick({ cands, saved: shown, settings: { suggestLevel: 'low' }, now: NOW }).show.map((x) => x.id), [low.show[0].id]);
});

test('suggest: learning — ignored kinds sink and stop after 3 ignores; accepted kinds rise', () => {
  assert.equal(weight({}, 'rain'), 1);
  let st = {}; for (let i = 0; i < 3; i++) st = learn(st, 'birthday', false);
  assert.equal(weight(st, 'birthday'), 0);
  assert.ok(weight(learn({}, 'rain', true), 'rain') > 1);
  const cands = candidates({ members, meUid: 'bro', now: NOW, weather: { tomorrow: { psr: '高' } } });
  const r = pick({ cands, saved: { day: hkDay(NOW), log: {}, stats: st }, settings: { suggestLevel: 'low' }, now: NOW });
  assert.equal(r.show[0].kind, 'rain');
});

// ---------- Home panels ----------
test('panels: clean, add, remove, reorder, max 6', () => {
  assert.deepEqual(cleanPanels([{ type: 'bad' }, { type: 'countdown', title: '', date: '2026-12-24' }, { id: 'h', type: 'homework' }, { id: 'h', type: 'shopping' }]), [{ id: 'h', type: 'homework' }]);
  let l = addPanel([], { id: 'c1', type: 'countdown', title: '聖誕假期<script>', date: '2026-12-24' });
  assert.equal(l[0].title, '聖誕假期script');
  l = addPanel(l, { id: 's1', type: 'shopping' }); l = addPanel(l, { id: 'h1', type: 'homework' });
  assert.deepEqual(movePanel(l, 'h1', -1).map((p) => p.id), ['c1', 'h1', 's1']);
  assert.deepEqual(movePanel(l, 'c1', -1).map((p) => p.id), ['c1', 's1', 'h1']);
  assert.deepEqual(removePanel(l, 's1').map((p) => p.id), ['c1', 'h1']);
  let many = []; for (let i = 0; i < 9; i++) many = addPanel(many, { id: `x${i}`, type: 'shopping' });
  assert.equal(many.length, MAX_PANELS);
  assert.equal(daysUntil('2026-10-25', NOW), 3); assert.equal(daysUntil('2026-10-22', NOW), 0); assert.equal(daysUntil('2026-10-20', NOW), -2);
});

test('panels: shopping list and homework progress come from reminders', () => {
  const at = (d) => Date.parse(`${d}T18:00:00+08:00`);
  const rems = [
    { id: '1', title: '購物：牛奶', done: false }, { id: '2', title: 'Buy: eggs', done: false }, { id: '3', title: '購物：米', done: true },
    { id: '4', title: '中文功課', done: true, dueAt: at('2026-10-20') }, { id: '5', title: '數學工作紙', done: false, dueAt: at('2026-10-23') },
    { id: '6', title: 'English dictation', done: false, dueAt: at('2026-10-27') }, { id: '7', title: '交午膳費', done: false, dueAt: at('2026-10-23') },
    { id: '8', title: '測驗溫習', done: false, dueAt: at('2026-10-24'), memberId: 'other' },
  ];
  assert.deepEqual(shoppingItems(rems).map(shopName), ['牛奶', 'eggs']);
  const hw = homeworkProgress(rems, NOW, 'bro');
  assert.equal(hw.total, 2); assert.equal(hw.done, 1); assert.equal(hw.next[0].id, '5');
});

// ---------- Files ----------
test('files: attachments + checklist cards from chats, newest first, filter + search', () => {
  const convs = [{ id: 'c1', title: '功課' }, { id: 'c2', title: '旅行' }];
  const byConv = {
    c1: [
      { id: 'm1', role: 'user', createdAt: 100, atts: [{ id: 'a1', kind: 'image', name: 'math.jpg', thumb: 'data:image/jpeg;base64,xx', size: 2048 }, { id: 'a2', kind: 'pdf', name: 'notice.pdf', text: '家長日通告', pages: 2 }] },
      { id: 'm2', role: 'assistant', createdAt: 200, content: 'ok' },
    ],
    c2: [{ id: 'm3', role: 'assistant', createdAt: 300, content: '清單：\n```nest-cards\n{"cards":[{"type":"checklist","title":"秋季旅行","items":["水壺","帽子"]},{"type":"reminder","title":"x","due":"2026-10-23T08:00"}]}\n```', cardState: { 0: { done: { 0: true } } } }],
  };
  const all = collectFiles(convs, byConv);
  assert.deepEqual(all.map((x) => x.kind), ['list', 'image', 'file']);
  assert.equal(all[0].name, '秋季旅行'); assert.deepEqual(all[0].items, ['水壺', '帽子']); assert.equal(all[0].done, 1);
  assert.equal(filterFiles(all, 'image').length, 1);
  assert.equal(filterFiles(all, 'all', '通告').length, 1);
  assert.equal(filterFiles(all, 'all', '帽子').length, 1);
});

// ---------- strings, routes, changelog, constraints ----------
test('strings: Run 23b copy in zh-Hant / en / th, nav label, HK written Chinese', () => {
  for (const [l, src] of [['zh-Hant', STRINGS['zh-Hant']], ['en', STRINGS.en], ['th', TH]]) {
    for (const k of ['mem', 'sug', 'panels', 'files']) assert.ok(src.r23[k], `${l} r23.${k}`);
    assert.ok(src.r23.mem.control && src.r23.mem.locked && src.r23.panels.types.homework && src.r23.files.empty, l);
    assert.equal(src.app.nav.files, R23_NAV[l].files);
  }
  const zh = JSON.stringify(R23['zh-Hant'].r23);
  assert.doesNotMatch(zh, /[嘅咗佢哋冇喺嚟啲咁唔]/);
});

test('routes + nav + changelog 1.19.0 + no new function + model', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /path="settings\/memory"/); assert.match(app, /path="files"/);
  assert.match(fs.readFileSync(new URL('../src/components/AppShell.jsx', import.meta.url), 'utf8'), /\['files', 'folder', 'files'\]/);
  const e119 = CHANGELOG.find((e) => e.version === '1.19.0'); assert.ok(e119 && APP_VERSION >= '1.19.0'); // Run 24 added 1.20.0 on top
  for (const l of ['zh-Hant', 'zh-Hans', 'en']) assert.equal(e119[l].items.length, 5, l);
  const fns = fs.readdirSync(new URL('../api/', import.meta.url), { recursive: true }).filter((f) => /\.js$/.test(f) && !f.split('/').pop().startsWith('_'));
  assert.equal(fns.length, 12, fns.join(','));
  for (const f of ['suggest.js', 'panels.js', 'files.js', 'family-memory.js']) assert.doesNotMatch(fs.readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8'), /fetch\(|streamChat|jsonChat|firebase\/storage/);
});

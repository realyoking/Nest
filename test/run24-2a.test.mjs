import './_env.mjs';
// Run 24 step 2a: suggestion frequency (Settings), Home panel customising (size / settings / drag order / presets), strings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { candidates, pick, suggestCap, freqOf, customN, FREQ, hkDay } from '../src/lib/suggest.js';
import { normPref, PREF_KEYS, PREF_OPTIONS } from '../src/lib/prefs.js';
import { cleanPanels, addPanel, movePanelTo, resizePanel, updatePanel, presetPanels, matchPreset, sizeOf, homeworkProgress, PRESETS, MAX_PANELS } from '../src/lib/panels.js';
import { R24 } from '../src/lib/strings-run24.js';

const NOW = Date.parse('2026-10-22T12:00:00+08:00');
const members = [{ uid: 'me', displayName: '我' }, { uid: 'dad', displayName: '爸爸', birthday: '1980-10-23' }];
const cands = candidates({
  members, meUid: 'me', now: NOW, weather: { tomorrow: { psr: '高' } }, holidays: [{ date: '2026-10-23', name: '重陽節' }],
  reminders: [{ id: 'r1', title: '交功課', dueAt: NOW - 3 * 864e5 }], inbox: [{ id: 'x', kind: 'test', date: '2026-10-23', title: '中文測驗' }],
});

test('suggest freq: cap from personal setting; unset follows the family level; family off wins', () => {
  assert.ok(cands.length >= 4);
  assert.equal(suggestCap({ settings: { suggestLevel: 'normal' } }), 2);
  assert.equal(suggestCap({ settings: {}, prefs: {} }), 1); // family default 'low'
  assert.equal(suggestCap({ settings: { suggestLevel: 'normal' }, prefs: { suggestFreq: 'off' } }), 0);
  assert.equal(suggestCap({ settings: {}, prefs: { suggestFreq: '2' } }), 2);
  assert.equal(suggestCap({ settings: {}, prefs: { suggestFreq: 'custom', suggestN: 3 } }), 3);
  assert.equal(suggestCap({ settings: {}, prefs: { suggestFreq: 'custom', suggestN: 99 } }), 20);
  assert.equal(suggestCap({ settings: {}, prefs: { suggestFreq: 'custom' } }), 3);
  assert.equal(suggestCap({ settings: {}, prefs: { suggestFreq: 'unlimited' } }), Infinity);
  assert.equal(suggestCap({ settings: { suggestLevel: 'off' }, prefs: { suggestFreq: 'unlimited' } }), 0);
  assert.equal(customN('0'), 1); assert.equal(customN('abc'), 3);
  assert.equal(freqOf({}, { suggestLevel: 'normal' }), '2'); assert.equal(freqOf({}, { suggestLevel: 'off' }), 'off'); assert.equal(freqOf({ suggestFreq: 'custom' }, {}), 'custom');
  assert.deepEqual(FREQ, ['off', '1', '2', 'custom', 'unlimited']);
});

test('suggest freq: pick shows up to the cap, unlimited shows all, quiet hours (family + personal) show none', () => {
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: '1' }, now: NOW }).show.length, 1);
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: '2' }, now: NOW }).show.length, 2);
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: 'custom', suggestN: 3 }, now: NOW }).show.length, 3);
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: 'unlimited' }, now: NOW }).show.length, cands.length);
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: 'off' }, now: NOW }).show.length, 0);
  assert.equal(pick({ cands, settings: { quietStart: '11:00', quietEnd: '13:00' }, prefs: { suggestFreq: 'unlimited' }, now: NOW }).show.length, 0);
  assert.equal(pick({ cands, settings: {}, prefs: { suggestFreq: 'unlimited' }, now: NOW, userQuiet: true }).show.length, 0);
  // answered ones still use the day's allowance
  const log = Object.fromEntries(cands.slice(0, 2).map((c) => [c.id, 'ignored']));
  assert.equal(pick({ cands, saved: { day: hkDay(NOW), log, stats: {} }, settings: {}, prefs: { suggestFreq: 'custom', suggestN: 3 }, now: NOW }).show.length, 1);
});

test('suggest freq: prefs validation', () => {
  assert.ok(PREF_KEYS.includes('suggestFreq') && PREF_KEYS.includes('suggestN'));
  assert.equal(normPref('suggestFreq', 'unlimited'), 'unlimited'); assert.equal(normPref('suggestFreq', '9'), undefined);
  assert.equal(normPref('suggestN', '5'), 5); assert.equal(normPref('suggestN', 0), undefined); assert.equal(normPref('suggestN', 21), undefined);
  assert.deepEqual(PREF_OPTIONS.suggestFreq, FREQ);
});

test('panels: size, per-panel settings, drag order', () => {
  let l = cleanPanels([{ id: 'a', type: 'shopping', size: 'l', listName: '超級市場<b>' }, { id: 'b', type: 'homework', scope: 'family', size: 'x' }, { id: 'c', type: 'countdown', title: '考試', date: '2026-11-05', size: 's' }]);
  assert.deepEqual(l, [{ id: 'a', type: 'shopping', listName: '超級市場b', size: 'l' }, { id: 'b', type: 'homework', scope: 'family' }, { id: 'c', type: 'countdown', title: '考試', date: '2026-11-05', size: 's' }]);
  assert.equal(sizeOf(l[1]), 'm');
  assert.equal(sizeOf(resizePanel(l, 'b', 'l')[1]), 'l');
  assert.equal(resizePanel(l, 'a', 'm')[0].size, undefined);
  assert.deepEqual(movePanelTo(l, 'c', 0).map((p) => p.id), ['c', 'a', 'b']);
  assert.deepEqual(movePanelTo(l, 'a', 9).map((p) => p.id), ['b', 'c', 'a']);
  assert.deepEqual(movePanelTo(l, 'zz', 0).map((p) => p.id), ['a', 'b', 'c']);
  l = updatePanel(l, 'c', { title: '中文考試', date: '2026-11-06' });
  assert.equal(l[2].title, '中文考試'); assert.equal(l[2].date, '2026-11-06');
  assert.equal(updatePanel(l, 'c', { title: '' })[2].title, '中文考試'); // invalid patch keeps the panel
  assert.equal(updatePanel(l, 'b', { scope: 'mine' })[1].scope, 'mine');
  assert.equal(updatePanel(l, 'b', { scope: undefined })[1].scope, undefined);
  assert.equal(updatePanel(l, 'a', { type: 'homework', id: 'q' })[0].type, 'shopping');
  assert.equal(updatePanel(l, 'a', { listName: '' })[0].listName, undefined);
});

test('panels: presets, reset and matching; never-saved Home has no panels', () => {
  assert.deepEqual(cleanPanels(undefined), []);
  for (const n of PRESETS) { const p = presetPanels(n, { now: NOW, examTitle: '考試' }); assert.ok(p.length >= 1 && p.length <= 3 && p.length <= MAX_PANELS, n); assert.equal(matchPreset(p), n); }
  const st = presetPanels('student', { now: NOW, examTitle: '考試' });
  assert.equal(st.find((p) => p.type === 'countdown').date, '2026-11-05');
  assert.equal(st.find((p) => p.type === 'homework').scope, 'mine');
  assert.equal(presetPanels('parent').find((p) => p.type === 'homework').scope, 'family');
  assert.equal(matchPreset(resizePanel(st, 'student-hw', 's')), '');
  assert.equal(matchPreset(updatePanel(st, 'student-cd', { title: '數學考試' })), 'student');
  assert.deepEqual(presetPanels('nope'), []);
  assert.equal(matchPreset([]), '');
  assert.equal(addPanel(presetPanels('simple'), { id: 'h', type: 'homework', size: 's' }).length, 2);
});

test('panels: homework scope — mine vs family', () => {
  const at = Date.parse('2026-10-23T18:00:00+08:00');
  const r = [{ id: 1, title: '中文功課', dueAt: at, memberId: 'me' }, { id: 2, title: '英文默書', dueAt: at, memberId: 'bro', done: true }, { id: 3, title: '數學工作紙', dueAt: at, memberId: '' }];
  assert.equal(homeworkProgress(r, NOW, 'me').total, 2);
  assert.equal(homeworkProgress(r, NOW, '').total, 3);
});

test('run24 2a strings: zh-Hant / en / th have every key', () => {
  const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
  const base = keys({ sf: R24.en.sf, hp: R24.en.hp, famq: R24.en.famq }).sort();
  for (const l of ['zh-Hant', 'th']) assert.deepEqual(keys({ sf: R24[l].sf, hp: R24[l].hp, famq: R24[l].famq }).sort(), base, l);
  assert.doesNotMatch(JSON.stringify([R24['zh-Hant'].sf, R24['zh-Hant'].hp, R24['zh-Hant'].famq]), /[们这个设计时间关闭]/); // Traditional only
  for (const f of ['suggest.js', 'panels.js']) assert.doesNotMatch(fs.readFileSync(new URL(`../src/lib/${f}`, import.meta.url), 'utf8'), /fetch\(|streamChat|jsonChat/);
});

// Run 23b: restrained proactive suggestions — rule-based (no AI call at all), at most 0 / 1 / 2 a day per member
// (family setting 主動建議: off / low / normal), one-tap accept (adds a reminder) or ignore, and learned per kind:
// kinds the member keeps ignoring sink and eventually stop; kinds they accept rise. Nothing shows in quiet hours.
// State (owner-only profile doc): users/{uid}.suggest = { day, log: { [id]: 'shown' | 'accepted' | 'ignored' }, stats: { [kind]: { a, i } } }
import { familySettings, inFamilyQuiet } from './nestie.js';

export const KINDS = ['birthday', 'rain', 'holiday', 'overdue', 'test'];
export const CAP = { off: 0, low: 1, normal: 2 };
// Run 24 step 2a: personal frequency (Settings › 主動建議): off / 1 / 2 / custom (suggestN a day, 1–20) / unlimited.
// Unset = follow the family level. The family's "off" still wins (adults can switch suggestions off for everyone).
export const FREQ = ['off', '1', '2', 'custom', 'unlimited'];
export const MAX_CUSTOM = 20;
export const customN = (n) => { const v = Math.round(Number(n)); return Number.isFinite(v) ? Math.max(1, Math.min(MAX_CUSTOM, v)) : 3; };
export function suggestCap({ settings, prefs } = {}) {
  const fam = CAP[familySettings({ settings }).suggestLevel] ?? 1;
  if (!fam) return 0;
  const f = prefs?.suggestFreq;
  if (f === 'off') return 0;
  if (f === '1') return 1;
  if (f === '2') return 2;
  if (f === 'custom') return customN(prefs?.suggestN);
  if (f === 'unlimited') return Infinity;
  return fam;
}
// The option the Settings control shows (unset → the family level's equivalent).
export const freqOf = (prefs, settings) => (FREQ.includes(prefs?.suggestFreq) ? prefs.suggestFreq : ({ off: 'off', low: '1', normal: '2' })[familySettings({ settings }).suggestLevel] || '1');
const BASE = { birthday: 1, test: 0.9, rain: 0.8, overdue: 0.7, holiday: 0.5 };
const HK = 8 * 3600e3;
export const hkDay = (ms = Date.now()) => new Date(ms + HK).toISOString().slice(0, 10);
const toMs = (d) => (d == null ? NaN : typeof d === 'number' ? d : d instanceof Date ? d.getTime() : d?.toDate ? d.toDate().getTime() : Date.parse(d));

const TXT = {
  'zh-Hant': {
    birthday: (n, w) => `${w === 0 ? '今天' : w === 1 ? '明天' : '後天'}是${n}的生日，要設定提醒嗎？`, birthdayR: (n) => `${n}的生日`,
    rain: '明天有機會下雨，要提醒全家帶傘嗎？', rainR: '記得帶傘',
    holiday: (n) => `明天是${n}（公眾假期），要提早安排活動嗎？`, holidayR: (n) => `${n}：安排家庭活動`,
    overdue: (t) => `「${t}」已過期，要改在明天下午六時提醒嗎？`, overdueR: (t) => t,
    test: (t) => `明天有「${t}」，要今晚八時提醒溫習嗎？`, testR: (t) => `溫習：${t}`,
  },
  en: {
    birthday: (n, w) => `${w === 0 ? 'Today' : w === 1 ? 'Tomorrow' : 'The day after tomorrow'} is ${n}’s birthday — set a reminder?`, birthdayR: (n) => `${n}’s birthday`,
    rain: 'Rain is likely tomorrow — remind the family to take umbrellas?', rainR: 'Take an umbrella',
    holiday: (n) => `Tomorrow is ${n} (public holiday) — plan something early?`, holidayR: (n) => `${n}: plan a family activity`,
    overdue: (t) => `“${t}” is overdue — remind you again tomorrow at 6pm?`, overdueR: (t) => t,
    test: (t) => `“${t}” is tomorrow — remind you to revise at 8pm tonight?`, testR: (t) => `Revise: ${t}`,
  },
  th: {
    birthday: (n, w) => `${w === 0 ? 'วันนี้' : w === 1 ? 'พรุ่งนี้' : 'มะรืนนี้'}เป็นวันเกิดของ${n} ตั้งการแจ้งเตือนไหม`, birthdayR: (n) => `วันเกิดของ${n}`,
    rain: 'พรุ่งนี้มีโอกาสฝนตก แจ้งเตือนให้ทุกคนพกร่มไหม', rainR: 'อย่าลืมพกร่ม',
    holiday: (n) => `พรุ่งนี้เป็น${n} (วันหยุด) วางแผนกิจกรรมล่วงหน้าไหม`, holidayR: (n) => `${n}: วางแผนกิจกรรมครอบครัว`,
    overdue: (t) => `“${t}” เลยกำหนดแล้ว แจ้งเตือนอีกครั้งพรุ่งนี้ 18:00 ไหม`, overdueR: (t) => t,
    test: (t) => `พรุ่งนี้มี “${t}” แจ้งเตือนให้ทบทวนคืนนี้ 20:00 ไหม`, testR: (t) => `ทบทวน: ${t}`,
  },
};
const L = (lang) => TXT[lang === 'zh-Hans' ? 'zh-Hant' : TXT[lang] ? lang : 'en'];
const at = (day, hm) => `${day}T${hm}`;

// Candidates from what the app already knows (all local data).
export function candidates({ members = [], reminders = [], weather = null, holidays = [], inbox = [], meUid = '', lang = 'zh-Hant', now = Date.now() } = {}) {
  const T = L(lang); const d0 = hkDay(now); const d1 = hkDay(now + 864e5); const out = [];
  for (const m of members) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(m.birthday || '') || m.uid === meUid) continue;
    for (const w of [0, 1, 2]) {
      const day = hkDay(now + w * 864e5);
      if (m.birthday.slice(5) === day.slice(5)) { out.push({ id: `birthday:${m.uid}:${day}`, kind: 'birthday', text: T.birthday(m.displayName, w), reminder: { title: T.birthdayR(m.displayName), due: w === 0 ? at(d0, '18:00') : at(day, '08:00'), member: '' }, prio: w === 1 ? 0 : w === 0 ? 0.1 : 0.2 }); break; }
    }
  }
  const tm = weather?.tomorrow;
  if (tm && (/高|中|high|medium/i.test(tm.psr || '') || /雨|rain|shower/i.test(tm.desc || ''))) out.push({ id: `rain:${d1}`, kind: 'rain', text: T.rain, reminder: { title: T.rainR, due: at(d1, '07:30'), member: 'everyone' }, prio: 0.3 });
  const hol = (holidays || []).find((h) => h.date === d1);
  if (hol?.name) out.push({ id: `holiday:${d1}`, kind: 'holiday', text: T.holiday(hol.name), reminder: { title: T.holidayR(hol.name), due: at(d0, '20:00'), member: 'everyone' }, prio: 0.6 });
  const od = reminders.filter((r) => !r.done && toMs(r.dueAt) < now - 864e5 && (!r.memberId || r.memberId === meUid)).sort((a, b) => toMs(b.dueAt) - toMs(a.dueAt))[0];
  if (od) out.push({ id: `overdue:${od.id}`, kind: 'overdue', text: T.overdue(od.title), reminder: { title: T.overdueR(od.title), due: at(d1, '18:00'), member: '', reschedule: od.id }, prio: 0.5 });
  const test = (inbox || []).find((x) => x.kind === 'test' && x.date === d1 && x.status !== 'dismissed');
  if (test) out.push({ id: `test:${test.id}:${d1}`, kind: 'test', text: T.test(test.title), reminder: { title: T.testR(test.title), due: at(d0, '20:00'), member: '' }, prio: 0.2 });
  return out;
}

// Learned weight per kind: Laplace-smoothed accept rate; a kind ignored 3+ times and never accepted is switched off.
export function weight(stats = {}, kind) {
  const s = stats[kind] || { a: 0, i: 0 };
  if ((s.i || 0) >= 3 && !(s.a || 0)) return 0;
  return ((s.a || 0) + 1) / ((s.a || 0) + (s.i || 0) + 2) * 2; // 1 when no history
}
export function learn(stats = {}, kind, accepted) {
  const s = { a: 0, i: 0, ...(stats[kind] || {}) };
  if (accepted) s.a += 1; else s.i += 1;
  return { ...stats, [kind]: s };
}
// Today's state (resets each HK day; stats carry over).
export function stateFor(saved, now = Date.now()) {
  const day = hkDay(now);
  return saved && saved.day === day ? { day, log: { ...(saved.log || {}) }, stats: { ...(saved.stats || {}) } } : { day, log: {}, stats: { ...(saved?.stats || {}) } };
}
// What to show now: suggestions already shown today and not yet answered come first; new ones only while the day's cap
// (shown + answered) has room. Returns at most `cap` items.
export function pick({ cands = [], saved, settings, prefs, now = Date.now(), userQuiet = false } = {}) {
  const cap = suggestCap({ settings, prefs });
  const st = stateFor(saved, now);
  if (!cap || userQuiet || inFamilyQuiet(settings, now)) return { show: [], state: st, cap };
  const used = Object.keys(st.log).length;
  const pending = cands.filter((c) => st.log[c.id] === 'shown');
  const fresh = cands.filter((c) => !st.log[c.id] && weight(st.stats, c.kind) > 0)
    .map((c) => ({ c, score: (BASE[c.kind] || 0.5) * weight(st.stats, c.kind) - c.prio * 0.1 }))
    .sort((a, b) => b.score - a.score).map((x) => x.c)
    .slice(0, Math.max(0, cap - used));
  return { show: [...pending, ...fresh].slice(0, cap), state: st, cap };
}
export const markShown = (st, ids) => ({ ...st, log: { ...st.log, ...Object.fromEntries(ids.filter((id) => !st.log[id]).map((id) => [id, 'shown'])) } });
export const answer = (st, c, accepted) => ({ ...st, log: { ...st.log, [c.id]: accepted ? 'accepted' : 'ignored' }, stats: learn(st.stats, c.kind, accepted) });

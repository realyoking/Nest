// Behavioural insights (structured memory) per member, computed on-device from the member's own usage and saved to
// families/{fid}/memories/ins_<uid>_<key> = { kind:'insight', key, memberId, text, data, confidence (0–1), evidence (n),
// lastSeen (ms), edited?, createdBy }. Shown (editable / deletable) in Family Memory → Insights. A deleted insight is
// remembered in users/{uid}.insightOff.<key> and never recreated. Used for reminder-time defaults, the brief and AI context.
import { detectKind, softKind } from './detect.js';

const HK = 8 * 3600e3;
const ms = (v) => (v instanceof Date ? v.getTime() : v ? Date.parse(v) || Number(v) || 0 : 0);
const hm = (t) => new Date(t + HK).toISOString().slice(11, 16);
const WD_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const top = (arr) => { const c = new Map(); arr.forEach((x) => c.set(x, (c.get(x) || 0) + 1)); return [...c.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0]; };
// Confidence grows with evidence and with how dominant the top value is.
const conf = (n, share) => Math.round(Math.min(0.95, (1 - Math.exp(-n / 4)) * share) * 100) / 100;
const norm = (s) => String(s || '').toLowerCase().replace(/[\s\d:：（）()［］\[\]・·,，。.!！?？-]+/g, '').slice(0, 24);

export function computeInsights({ uid, reminders = [], quizResults = [], chats = [], lang = 'zh-Hant', now = Date.now() }) {
  const zh = lang !== 'en';
  const out = [];
  const mine = reminders.filter((r) => r.createdBy === uid && r.dueAt);
  // 1. Preferred reminder time (HH:MM of reminders this member sets).
  if (mine.length >= 3) {
    const [v, n] = top(mine.map((r) => hm(ms(r.dueAt))));
    const share = n / mine.length;
    if (n >= 3 && share >= 0.35) out.push({ key: 'reminderTime', data: { time: v }, evidence: n, confidence: conf(n, share), text: zh ? `通常把提醒設在 ${v}` : `Usually sets reminders for ${v}` });
  }
  // 2. Which weekday they handle payments (done payment-like reminders, by doneAt or dueAt).
  const pays = reminders.filter((r) => r.done && (r.doneBy ? r.doneBy === uid : r.memberId === uid || (!r.memberId && r.createdBy === uid)) && (softKind(r.title) === 'bill' || /繳|付款|交費|pay|fee|bill/i.test(r.title)));
  if (pays.length >= 2) {
    const days = pays.map((r) => new Date(ms(r.doneAt || r.dueAt) + HK).getUTCDay());
    const [d, n] = top(days); const share = n / pays.length;
    if (n >= 2 && share >= 0.5) out.push({ key: 'payDay', data: { weekday: d }, evidence: n, confidence: conf(n, share), text: zh ? `通常在${WD_ZH[d]}處理繳費` : `Usually handles payments on ${WD_EN[d]}` });
  }
  // 3. Tutor / quiz topics most often stuck on (weak areas across quiz results).
  const weak = quizResults.filter((q) => q.uid === uid || !q.uid).flatMap((q) => (q.weakAreas || []).map(String)).filter(Boolean);
  if (weak.length >= 2) {
    const [w, n] = top(weak.map((x) => x.trim()));
    if (n >= 2) out.push({ key: 'stuckOn', data: { topic: w }, evidence: n, confidence: conf(n, n / weak.length), text: zh ? `溫習時最常卡在「${w}」` : `Most often stuck on “${w}”` });
  }
  const lowQuiz = quizResults.filter((q) => (q.uid === uid || !q.uid) && q.total && q.score / q.total < 0.6).map((q) => q.topic).filter(Boolean);
  if (lowQuiz.length >= 2) {
    const [tp, n] = top(lowQuiz);
    if (n >= 2) out.push({ key: 'weakTopic', data: { topic: tp }, evidence: n, confidence: conf(n, n / lowQuiz.length), text: zh ? `「${tp}」測驗成績偏低，可多溫習` : `Scores low on “${tp}” quizzes — worth revising` });
  }
  // 4. Recurring pattern: the same reminder title on the same weekday ≥ 3 times → suggest a repeating event.
  const byKey = new Map();
  mine.forEach((r) => { const k = `${norm(r.title)}|${new Date(ms(r.dueAt) + HK).getUTCDay()}`; if (norm(r.title).length >= 2) byKey.set(k, [...(byKey.get(k) || []), r]); });
  const rec = [...byKey.values()].filter((l) => l.length >= 3).sort((a, b) => b.length - a.length)[0];
  if (rec) {
    const d = new Date(ms(rec[0].dueAt) + HK).getUTCDay();
    out.push({ key: 'recurring', data: { title: rec[0].title, weekday: d, time: hm(ms(rec[0].dueAt)) }, evidence: rec.length, confidence: conf(rec.length, 1), text: zh ? `每逢${WD_ZH[d]}都會加「${rec[0].title}」提醒 — 可設為重複活動` : `Adds “${rec[0].title}” every ${WD_EN[d]} — could be a repeating event` });
  }
  // 5. When they usually chat with Nest (morning / afternoon / evening).
  const hours = chats.filter((c) => c.ownerId === uid || !c.ownerId).map((c) => new Date(ms(c.updatedAt || c.createdAt) + HK).getUTCHours()).filter((h) => Number.isFinite(h));
  if (hours.length >= 5) {
    const slot = (h) => (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening');
    const [sl, n] = top(hours.map(slot)); const share = n / hours.length;
    if (share >= 0.5) out.push({ key: 'chatTime', data: { slot: sl }, evidence: n, confidence: conf(n, share), text: zh ? `通常在${{ morning: '早上', afternoon: '下午', evening: '晚上' }[sl]}使用 Nest` : `Usually uses Nest in the ${sl}` });
  }
  return out.map((x) => ({ ...x, lastSeen: now }));
}

export const insightsOf = (s, uid) => (s.memories || []).filter((m) => m.kind === 'insight' && (!uid || m.memberId === uid));
// Preferred reminder time for the current member ('' when not confident).
export function preferredReminderTime(s) {
  const i = insightsOf(s, s.user?.uid).find((m) => m.key === 'reminderTime');
  return i && (i.confidence >= 0.45 || i.edited) && /^\d{2}:\d{2}$/.test(i.data?.time || '') ? i.data.time : '';
}
// Lines for the AI system context.
export const insightLines = (s) => (s.memories || []).filter((m) => m.kind === 'insight').slice(0, 30)
  .map((m) => `${s.memberName(m.memberId) || 'member'}: ${m.text} (confidence ${Math.round((m.confidence || 0) * 100)}%, seen ${m.evidence || 1}×)`);

// Sync on-device (≤ once a day per member). Returns the number of insights written.
export async function syncInsights(be, s, { quizResults = [], chats = [], lang }) {
  const uid = s.user.uid; const fid = s.family?.id;
  if (!fid || !be.setMemory) return 0;
  const key = `nest.ins.${uid}.${new Date(Date.now() + HK).toISOString().slice(0, 10)}`;
  try { if (localStorage.getItem(key)) return 0; localStorage.setItem(key, '1'); } catch {}
  const off = s.profile?.insightOff || {};
  const have = Object.fromEntries(insightsOf(s, uid).map((m) => [m.key, m]));
  const list = computeInsights({ uid, reminders: s.reminders, quizResults, chats, lang });
  let n = 0;
  for (const x of list) {
    if (off[x.key]) continue;
    const cur = have[x.key];
    const doc = { kind: 'insight', key: x.key, memberId: uid, data: x.data, confidence: x.confidence, evidence: x.evidence, lastSeen: x.lastSeen, createdBy: uid, text: cur?.edited ? cur.text : x.text };
    if (cur && cur.evidence === x.evidence && cur.text === doc.text && JSON.stringify(cur.data) === JSON.stringify(x.data)) continue;
    await be.setMemory(fid, `ins_${uid}_${x.key}`, doc).catch(() => {}); n++;
  }
  return n;
}
export { detectKind };

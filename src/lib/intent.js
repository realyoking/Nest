// Instant on-device parser for chat action cards (「明天要交午餐費」 → reminder 10/19 18:00 「交午餐費」).
// Types: reminder | event | task | memory | shopping. Read-only questions return null (no card).
// Dates and times are Hong Kong wall time. The chat model may later refine a card with a ```nest-card``` block.
import { parseDates, hkDayKey } from './detect.js';

const HK = 8 * 3600e3;
const pad = (n) => String(n).padStart(2, '0');
const dayMs = (k) => Date.parse(`${k}T00:00:00Z`) - HK;
const addDays = (k, n) => hkDayKey(dayMs(k) + n * 864e5 + 12 * 3600e3);
const wdOf = (k) => new Date(`${k}T00:00:00Z`).getUTCDay();

const QUESTION = /[？?]\s*$|^(甚麼|什麼|咩|幾時|何時|點樣|怎樣|如何|邊個|哪|有冇|有沒有|是否|可唔可以|可否|請問|告訴我|顯示|列出|查|搵|找)|^(what|when|where|who|which|how|why|is|are|do|does|did|can|could|should|show|list|tell me|find)\b/i;
const IMPERATIVE = /提醒我|記得|記住|記低|幫我|加入|新增|安排|預約|remind me|add |set (a|up)|schedule|remember/i;
const MEMORY = /^(請)?(記住|記低|記下|remember( that)?|note that)[:：,，\s]*/i;
const SHOP = /^(要|幫我|記得)?\s*(買|購買|入貨|補貨)\s*|(?:^|\s)(buy|pick up|get some)\s+/i;
const EVENT = /約|會議|開會|聚會|聚餐|食飯|晚飯|午飯|飲茶|生日會|派對|課|堂|班|活動|比賽|旅行|睇醫生|覆診|看醫生|面試|演出|音樂會|appointment|meeting|party|dinner|lunch|lesson|class|practice|match|trip|interview|concert|doctor|dentist/i;
const REMIND = /默書|測驗|考試|小測|dictation|test|exam|quiz|提醒|記得|要交|要繳|要帶|要付|要還|要簽|交|繳|付款|還書|簽|帶|due|pay|bring|return|submit|hand in|sign|remind|don'?t forget|need to|have to|must/i;
const TASK = /要做|待辦|做埋|完成|整理|執拾|清潔|打掃|收拾|to ?do|finish|clean|tidy|fix/i;
const REPEAT = [[/每天|每日|天天|every ?day|daily/i, 'daily'], [/每(個)?(星期|週|周|禮拜)|逢(星期|週|周|禮拜)[一二三四五六日天]|every (week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|weekly/i, 'weekly'], [/每(個)?月|每月|every month|monthly/i, 'monthly'], [/每年|every year|yearly|annually/i, 'yearly']];
const WD_ZH = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
const WD_EN = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6 };

// → { date?, time?, cleaned } — removes the matched date / time words from the text.
export function parseWhen(text, now = Date.now()) {
  let s = ` ${text} `;
  const today = hkDayKey(now);
  let date = ''; let time = '';
  const cut = (re) => { s = s.replace(re, ' '); };
  // weekday words: (下)(個)星期X / 週X / 禮拜X / next Monday / Monday
  let m = /(下(?:個)?|今|呢個|這個?)?(?:星期|週|周|禮拜)([一二三四五六日天])/.exec(s);
  if (m) {
    const want = WD_ZH[m[2]]; let diff = (want - wdOf(today) + 7) % 7;
    // 下星期三 = Wednesday of next week (Monday-based weeks), not just "the next Wednesday".
    if (m[1] && /下/.test(m[1])) diff = (7 - ((wdOf(today) + 6) % 7)) + ((want + 6) % 7);
    date = addDays(today, diff); cut(m[0]);
  } else if ((m = /\b(next|this)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thur?s?|fri|sat)\b/i.exec(s))) {
    const want = WD_EN[m[2].toLowerCase()]; let diff = (want - wdOf(today) + 7) % 7;
    if (m[1] && /next/i.test(m[1])) diff = (7 - ((wdOf(today) + 6) % 7)) + ((want + 6) % 7);
    date = addDays(today, diff); cut(m[0]);
  }
  // relative words
  const rel = [[/今晚|tonight|this evening/i, 0, '20:00'], [/今朝|今早|this morning/i, 0, '08:00'], [/明朝|明早|tomorrow morning/i, 1, '08:00'], [/明晚|tomorrow (night|evening)/i, 1, '20:00'],
    [/大後日|大後天/, 3], [/後日|後天|day after tomorrow/i, 2], [/聽日|明天|明日|tomorrow/i, 1], [/今天|今日|today/i, 0]];
  let evening = false;
  for (const [re, n, tm] of rel) { const x = re.exec(s); if (x) { if (!date) date = addDays(today, n); if (tm && !time) time = tm; evening = tm === '20:00'; cut(x[0]); break; } }
  // explicit dates (HK formats)
  if (!date) { const d = parseDates(s, now).filter((x) => !x.rel)[0]; if (d) { date = d.date; if (d.time) time = d.time; cut(/(20\d{2}[-/.年])?\d{1,2}[-/.月]\d{1,2}[日號号]?|\d{1,2}\/\d{1,2}(\/\d{2,4})?|\b\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}\b/i); } }
  // times: 下午三點半 / 晚上8點 / 7:30 / 7pm / 19:00
  if ((m = /(早上|上午|朝早|中午|下午|下晝|下昼|晏晝|晏昼|傍晚|黃昏|黄昏|晚上|夜晚|夜)?\s*(\d{1,2}|[一二三四五六七八九十]{1,3})\s*(?:點|時|点)\s*(半|(\d{1,2})\s*分?)?/.exec(s))) {
    let h = /\d/.test(m[2]) ? +m[2] : zhNum(m[2]); const mi = m[3] === '半' ? 30 : +(m[4] || 0);
    if ((/下午|下晝|下昼|晏晝|晏昼|傍晚|黃昏|黄昏|晚上|夜/.test(m[1] || '') || (evening && !m[1])) && h < 12) h += 12; if (/中午/.test(m[1] || '') && h < 6) h += 12;
    if (h < 24 && mi < 60) { time = `${pad(h)}:${pad(mi)}`; cut(m[0]); }
  } else if ((m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i.exec(s))) {
    let h; let mi;
    if (m[3]) { h = +m[1]; mi = +(m[2] || 0); evening = false; if (/pm/i.test(m[3]) && h < 12) h += 12; if (/am/i.test(m[3]) && h === 12) h = 0; } else { h = +m[4]; mi = +m[5]; }
    if (evening && h < 12) h += 12;
    if (h < 24 && mi < 60) { time = `${pad(h)}:${pad(mi)}`; cut(m[0]); }
  }
  if (time && !date) { date = today; if (dayMs(today) + (+time.slice(0, 2)) * 3600e3 + (+time.slice(3)) * 60e3 < now) date = addDays(today, 1); }
  return { date, time, cleaned: s.replace(/\s+/g, ' ').trim() };
}
function zhNum(s) { const d = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }; if (s.length === 1) return d[s] || 0; if (s[0] === '十') return 10 + (d[s[1]] || 0); return (d[s[0]] || 0) * 10 + (d[s[2]] || 0); }

const FILLER = /^(請|麻煩|幫我|提醒我|提下我|提我|记得|記得|我|我哋|我們|要|需要|得|仲要|會|在|喺|於|on|at|by|to|please|remind me( to)?|i need to|we need to|i have to|need to|have to|don'?t forget( to)?)\s*/i;
function cleanTitle(s) {
  // Leftovers after the time was cut out: 「下晝四點前」 → 「 前」, 「之前」, 「或之前」 at the end.
  let x = String(s).replace(/[，,。.!！\s]*(或|or)?\s*(之前|以前|前|before|by)\s*[，,。.!！]*$/i, '').replace(/[，,。.!！]+$/g, '').trim();
  for (let i = 0; i < 4; i++) x = x.replace(FILLER, '').replace(/^(或|or)?\s*(之前|以前|前)\s*/i, '').trim(); // 「四點前交功課」 → 「交功課」
  return x.replace(/^(要|去)\s*/, '').replace(/\s+(on|at|by)$/i, '').trim().slice(0, 120);
}

// opts: { defaultTime: 'HH:MM', members: [{uid, displayName}], meUid }
export function parseIntent(text, lang = 'zh-Hant', now = Date.now(), opts = {}) {
  const raw = String(text || '').trim();
  if (raw.length < 3 || raw.length > 240) return null;
  if (QUESTION.test(raw) && !IMPERATIVE.test(raw)) return null;
  const members = opts.members || [];
  const who = members.find((m) => m.displayName && raw.includes(m.displayName));
  const base = { member: who ? who.uid : (opts.meUid || ''), confidence: 0.6 };
  if (MEMORY.test(raw)) {
    const body = raw.replace(MEMORY, '').trim();
    return body.length >= 2 ? { ...base, type: 'memory', title: body.slice(0, 300), confidence: 0.9 } : null;
  }
  const rep = REPEAT.find(([re]) => re.test(raw));
  // Keep the weekday of "逢星期六 / every Monday" for the first date; drop only the repeat word itself.
  const repM = rep ? rep[0].exec(raw)[0] : '';
  const w = parseWhen(rep ? raw.replace(repM, ` ${repM.replace(/^(逢|每個?|every)\s*/i, '').replace(/^(天|日|day|week|month|year|月|年)$/i, '')} `) : raw, now);
  const title = cleanTitle(w.cleaned);
  const shop = SHOP.exec(raw);
  if (shop && !w.date && !EVENT.test(raw)) {
    const item = cleanTitle(raw.replace(SHOP, ' ').replace(/^(啲|些|一些|some)\s*/i, ''));
    return item ? { ...base, type: 'shopping', title: item, confidence: 0.8 } : null;
  }
  if (!title || title.length < 2) return null;
  // 「提我／提醒我／remind me」 is always a reminder (「中文功課」 contains 課 but is not an event).
  const askReminder = /^(請|麻煩)?\s*(提我|提下我|提醒我|提醒|記得|remind me)/i.test(String(raw).trim());
  if (rep || (!askReminder && EVENT.test(raw) && w.date && w.time)) {
    return { ...base, type: 'event', title, date: w.date || hkDayKey(now), time: w.time, allDay: !w.time, repeat: rep ? rep[1] : 'none', complex: !!rep, confidence: w.date || rep ? 0.8 : 0.5, member: who ? who.uid : '' };
  }
  if (w.date && (REMIND.test(raw) || EVENT.test(raw) || IMPERATIVE.test(raw) || w.time)) {
    return { ...base, type: 'reminder', title, date: w.date, time: w.time || opts.defaultTime || '09:00', timeGuessed: !w.time, confidence: 0.85 };
  }
  if (TASK.test(raw) || IMPERATIVE.test(raw)) return { ...base, type: 'task', title, confidence: 0.6 };
  return null;
}
// One-line summary for the card: "10/19 18:00 交午餐費"
export const cardWhen = (c) => (c.date ? `${+c.date.slice(5, 7)}/${+c.date.slice(8, 10)}${c.time && !c.allDay ? ` ${c.time}` : ''}` : '');
// Parse the model's optional refinement block: ```nest-card {json}```
export function parseCardBlock(text = '') {
  const m = /```nest-card(?!s)\s*([\s\S]*?)```/.exec(text);
  if (!m) return null;
  try { const j = JSON.parse(m[1]); return j && typeof j === 'object' ? j : null; } catch { return null; }
}
export const stripCardBlock = (text = '') => String(text).replace(/```nest-card(?!s)[\s\S]*?```/g, '').replace(/```nest-card(?!s)[\s\S]*$/, '').trim();

// Attachment card (```nest-card``` from a photo / file reply) → card object, or null when it is not usable:
// wrong type, no title / date, or a date-time already in the past (Hong Kong time). Pure; `now` for tests.
export function attachmentCard(found, { now = new Date(), fixText = (t) => t } = {}) {
  if (!found || !['reminder', 'event'].includes(found.type) || typeof found.title !== 'string' || !found.title.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(found.date || '')) return null;
  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(found.time || '') ? found.time : '';
  const hk = new Date(now.getTime() + 8 * 3600e3).toISOString();
  const today = hk.slice(0, 10); const nowHm = hk.slice(11, 16);
  if (found.date < today) return null;
  const t = time || (found.type === 'reminder' ? '09:00' : '');
  if (found.date === today && t && t <= nowHm && (time || found.type === 'reminder')) return null;
  return { type: found.type, title: fixText(found.title.trim()).slice(0, 200), date: found.date, time: t, allDay: found.type === 'event' && !time, timeGuessed: !time, repeat: 'none', confidence: 0.7, fromAttachment: true, status: 'pending' };
}

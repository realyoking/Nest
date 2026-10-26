// 今日摘要 / notifications grouping. Pure: turns the brief data (src/lib/brief.js collectBrief shape), family reminders,
// inbox suggestion cards, HKO warnings / weather, go-out ETAs and holidays into categories with priorities.
// Rendering (labels, times, icons) lives in src/components/Digest.jsx.
import { detectKind, softKind, hkDayKey, daysUntil } from './detect.js';

// Display order. Icons come from src/components/Icon.jsx.
export const CATS = [
  { id: 'weather', icon: 'cloud' }, { id: 'notices', icon: 'inbox' }, { id: 'bills', icon: 'receipt' }, { id: 'school', icon: 'book' },
  { id: 'calendar', icon: 'calendar' }, { id: 'family', icon: 'users' }, { id: 'transport', icon: 'bus' }, { id: 'gmail', icon: 'mail' }, { id: 'drive', icon: 'folder' },
];
export const CAT_ICON = Object.fromEntries(CATS.map((c) => [c.id, c.icon]));
const ms = (v) => (v == null || v === '' ? null : v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v));
const dayStart = (key) => Date.parse(`${key}T00:00:00Z`) - 8 * 3600e3;

// Category of one inbox card (suggestions from the scanner, or the older AI inbox scan items).
export function inboxCat(it) {
  if (it.kind === 'notice') return 'notices';
  if (it.kind === 'bill') return 'bills';
  if (it.kind === 'test' || it.kind === 'homework') return 'school';
  const k = softKind(`${it.title || ''} ${it.body || ''}`);
  return k === 'notice' ? 'notices' : k === 'bill' ? 'bills' : k ? 'school' : 'family';
}
// Priority: smaller = more important. Urgent: warnings, overdue, due today, bills due ≤ 1 day.
function dueTag(key, now) {
  if (!key) return { tag: '', urgent: false, prio: 50 };
  const n = daysUntil(key, now);
  return { tag: n < 0 ? 'overdue' : n === 0 ? 'today' : n === 1 ? 'tomorrow' : n <= 6 ? `in${n}` : 'later', urgent: n <= 0, prio: n < 0 ? 1 : n === 0 ? 2 : n === 1 ? 5 : 10 + n, n };
}

export function buildDigest({ brief = {}, reminders = [], uid = '', inbox = [], warn = null, weather = null, goOut = [], holidays = [], notes = [], now = Date.now() } = {}) {
  const items = [];
  const add = (cat, x) => items.push({ cat, prio: 50, urgent: false, ...x });
  const today = hkDayKey(now);

  // Weather & alerts.
  (warn?.warnings || []).forEach((w) => add('weather', { id: `w|${w.code}`, kind: 'warning', title: w.name, type: w.type, sub: w.detail || '', at: w.issued, sev: w.sev, urgent: w.sev >= 2, prio: w.sev >= 3 ? 0 : w.sev >= 2 ? 1 : 30 }));
  if (warn?.school) add('weather', { id: 'w|school', kind: 'school', title: warn.school.text, urgent: warn.school.level >= 2, prio: 0.5 });
  (warn?.suspension || []).forEach((x, i) => add('weather', { id: `w|susp|${i}`, kind: 'press', title: x.title, at: x.at, href: x.link, urgent: true, prio: 0.4 }));
  if (weather && (weather.temp != null || weather.today || weather.tomorrow)) add('weather', { id: 'wx', kind: 'weather', weather, prio: 40 });

  // Inbox suggestion cards (open ones). Accepted bills stay visible until paid.
  const srcIds = new Set();
  inbox.forEach((it) => {
    if (it.src?.id) srcIds.add(it.src.id);
    const open = it.status === 'new' || (it.kind === 'bill' && it.status === 'accepted');
    if (!open) return;
    const cat = inboxCat(it);
    const d = dueTag(it.date || (it.reminder?.dueAt ? String(it.reminder.dueAt).slice(0, 10) : ''), now);
    if (cat === 'school' && d.n != null && d.n < -1) return;
    add(cat, { id: `i|${it.id}`, kind: 'inbox', inboxId: it.id, title: it.kind === 'bill' ? it.payee || it.title : it.title, amount: it.amount, sub: it.kind === 'bill' ? it.title : it.body, due: it.date || '', tag: d.tag, urgent: d.urgent || (cat === 'bills' && d.n === 1), prio: d.prio - (it.status === 'new' ? 0.5 : 0), status: it.status, itemKind: it.kind || 'ai', needsReply: !!it.needsReply });
  });

  // Gmail: school notices / bills by heuristic (until the scanner turns them into cards), the rest by unread/important.
  (brief.gmail || []).forEach((a) => (a.items || []).forEach((m) => {
    if (m.id && srcIds.has(m.id)) return;
    const k = detectKind(m).kind;
    const base = { id: `g|${a.account}|${m.id || m.subject}`, title: m.subject, sub: m.from, snippet: m.snippet, mid: m.id, at: ms(m.date), account: a.account, unread: m.unread, important: m.important, href: m.id ? `https://mail.google.com/mail/?authuser=${encodeURIComponent(a.account)}#all/${m.id}` : '' };
    if (k === 'notice') add('notices', { ...base, kind: 'mail', detected: true, prio: 20 });
    else if (k === 'bill') add('bills', { ...base, kind: 'mail', detected: true, prio: 20 });
    else add('gmail', { ...base, kind: 'mail', prio: (m.unread ? 20 : 40) - (m.important ? 5 : 0) - Math.min(4, (ms(m.date) || 0) / 1e13) });
  }));

  // School work (Classroom).
  const seenWork = new Set();
  (brief.googleclassroom || []).forEach((a) => {
    (a.items?.work || []).forEach((w) => {
      const due = ms(w.due); const key = due ? hkDayKey(due) : '';
      const sig = `${w.title}|${key}`; if (seenWork.has(sig)) return; seenWork.add(sig);
      const d = dueTag(key, now);
      add('school', { id: `c|${a.account}|${sig}`, kind: 'work', title: w.title, sub: w.course, at: due, due: key, tag: d.tag, urgent: d.urgent, prio: d.prio, href: 'https://classroom.google.com/a/not-turned-in/all' });
    });
    (a.items?.news || []).forEach((n, i) => add('school', { id: `cn|${a.account}|${i}|${ms(n.date)}`, kind: 'news', title: n.text, sub: n.course, at: ms(n.date), prio: 30, href: 'https://classroom.google.com/' }));
  });

  // Calendar (today + tomorrow) and public holidays (next 7 days).
  (brief.googlecalendar || []).forEach((a) => (a.items || []).forEach((e, i) => add('calendar', { id: `e|${a.account}|${i}|${ms(e.date)}`, kind: 'event', title: e.title, sub: e.location, at: ms(e.date), allDay: /all day/.test(e.when || ''), day: e.day, prio: e.day === 'today' ? 8 : 15 })));
  holidays.forEach((h) => add('calendar', { id: `h|${h.date}`, kind: 'holiday', title: h.name, due: h.date, tag: dueTag(h.date, now).tag, prio: 12 + (h.inDays || 0) }));

  // Family tasks: open reminders due within 7 days or overdue (mine and everyone's first).
  reminders.filter((r) => !r.done && r.dueAt && ms(r.dueAt) < now + 7 * 864e5).forEach((r) => {
    const key = hkDayKey(ms(r.dueAt)); const d = dueTag(key, now);
    add('family', { id: `r|${r.id}`, kind: 'reminder', reminderId: r.id, title: r.title, at: ms(r.dueAt), due: key, tag: d.tag, memberId: r.memberId || '', urgent: d.urgent && (!r.memberId || r.memberId === uid), prio: d.prio + (r.memberId && r.memberId !== uid ? 3 : 0) });
  });

  // Time-bound things the user mentioned in chats (e.g. "important meeting tomorrow — early night").
  notes.forEach((n) => { const d = dueTag(n.exp, now); add('family', { id: `n|${n.id}`, kind: 'note', title: n.text, due: n.exp, tag: d.tag, prio: 3 + (d.n || 0), noteId: n.id }); });

  // Transport.
  goOut.forEach((g, i) => add('transport', { id: `t|${g.key}`, kind: 'transit', title: g.label, sub: g.sub, etas: g.etas || [], plan: g.plan || null, status: g.status || '', prio: 20 + i, urgent: !!g.disrupted }));

  // Drive.
  (brief.googledrive || []).forEach((a) => (a.items || []).forEach((f, i) => add('drive', { id: `d|${a.account}|${i}`, kind: 'file', title: f.name, sub: f.by, at: ms(f.date), prio: 40 })));

  const byCat = Object.fromEntries(CATS.map((c) => [c.id, []]));
  items.forEach((x) => byCat[x.cat]?.push(x));
  Object.values(byCat).forEach((l) => l.sort((a, b) => a.prio - b.prio || (b.at || 0) - (a.at || 0)));
  const cats = CATS.map((c) => ({ ...c, items: byCat[c.id], count: byCat[c.id].filter((x) => x.kind !== 'weather').length, urgent: byCat[c.id].filter((x) => x.urgent).length }));
  const pinned = items.filter((x) => x.urgent).sort((a, b) => a.prio - b.prio).slice(0, 4);
  return { cats, pinned, total: items.length, today };
}
// The pinned items are shown once on top of "All"; the sections below skip them.
export const withoutPinned = (cat, pinned) => cat.items.filter((x) => !pinned.some((p) => p.id === x.id));

// ---------- demo data (landing demo + mock builds; no network) ----------
export function demoInputs(lang = 'zh-Hant', now = Date.now()) {
  const zh = lang !== 'en';
  const at = (d, h, m = 0) => { const k = hkDayKey(now + d * 864e5); return new Date(dayStart(k) + h * 3600e3 + m * 60e3); };
  return {
    brief: {
      gmail: [{ account: 'chan.family@gmail.com', items: [
        { id: 'm1', from: zh ? '陳太太' : 'Mrs Chan', subject: zh ? '星期六生日會時間' : 'Saturday party time', snippet: '', date: at(0, 8, 12), unread: true, important: true },
        { id: 'm2', from: 'HKBN', subject: zh ? '十月份月結單' : 'October statement', snippet: zh ? '應繳金額 HK$198，到期日 30/10' : 'Amount due HK$198, due 30/10', date: at(-1, 20), unread: true },
        { id: 'm3', from: zh ? '游泳會' : 'Swim club', subject: zh ? '下月課堂時間表' : 'Next month’s timetable', snippet: '', date: at(-1, 18), unread: false },
        { id: 'm4', from: 'Apple', subject: zh ? '你的收據' : 'Your receipt', snippet: '', date: at(-1, 9), unread: false },
      ] }],
      googlecalendar: [{ account: 'chan.family@gmail.com', items: [
        { title: zh ? '游泳課' : 'Swimming', when: '', day: 'today', location: zh ? '沙田游泳池' : 'Sha Tin pool', date: at(0, 17) },
        { title: zh ? '鋼琴課' : 'Piano lesson', when: '', day: 'tomorrow', location: '', date: at(1, 10) },
      ] }],
      googleclassroom: [{ account: 'ethan.chan@school.edu.hk', items: { work: [
        { title: zh ? '數學工作紙 P.12' : 'Maths worksheet p.12', course: zh ? '4A 數學' : '4A Maths', due: at(0, 23, 59) },
        { title: zh ? '英文閱讀報告' : 'English book report', course: zh ? '4A 英文' : '4A English', due: at(3, 23, 59) },
      ], news: [{ course: zh ? '4A 常識' : '4A GS', text: zh ? '下星期帶廢紙做手工。' : 'Bring scrap paper next week for crafts.', date: at(-1, 15) }] } }],
      googledrive: [{ account: 'chan.family@gmail.com', items: [{ name: zh ? '秋季旅行相片' : 'Autumn trip photos', by: zh ? '班主任' : 'Class teacher', date: at(-1, 21) }] }],
    },
    weather: { temp: 27, humidity: 68, today: { min: 24, max: 29, psr: zh ? '低' : 'Low', desc: zh ? '大致天晴，下午乾燥。' : 'Mainly fine. Dry in the afternoon.' }, forecast: zh ? '大致天晴，下午乾燥。' : 'Mainly fine. Dry in the afternoon.' },
    warn: { warnings: [], school: null, suspension: [] },
  };
}

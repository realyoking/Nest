// Daily brief data (今日摘要) — shared by the Home card (browser) and the morning push cron (Node, api/push/cron.js).
// No browser-only imports: give it { email: accessToken } per service and it reads Google directly.
//
// Per selected account:
//   Gmail      — everything in the inbox from the last 48 h (minus Promotions/Social/Spam), up to 30, PLUS unread or
//                important mail from the last 7 days (up to 20); sender, subject, snippet, unread/important flags.
//   Calendar   — events today and tomorrow (Hong Kong time), all-day included.
//   Classroom  — coursework due in the next 7 days (or overdue ≤2 days) + announcements from the last 3 days.
//   Drive      — files shared with the account in the last 3 days.
// formatBrief() turns it into a text block grouped by source with [account] labels and an explicit "(none)" line per
// source, so the model can mention every item and say plainly when a source has nothing.

export const BRIEF_SOURCES = ['gmail', 'googlecalendar', 'googleclassroom', 'googledrive'];
const HK = 'Asia/Hong_Kong';

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
export function clean(s = '') {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    const v = NAMED[e.toLowerCase()]; return v === undefined ? m : v;
  }).replace(/[\u200b-\u200d\u034f\u00ad\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}
async function g(url, token) {
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) throw Object.assign(new Error(`google_${r.status}`), { status: r.status });
  return r.json();
}
const hkParts = (d) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: HK, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map((p) => [p.type, p.value]));
// Midnight Hong Kong time (UTC+8, no DST) of the day containing d, plus n days.
const hkMidnight = (d, n = 0) => { const p = hkParts(d); return new Date(Date.UTC(+p.year, +p.month - 1, +p.day + n) - 8 * 3600e3); };
const fmt = (d, time = true) => new Intl.DateTimeFormat('en-CA', { timeZone: HK, month: 'short', day: 'numeric', weekday: 'short', ...(time ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}) }).format(d);

async function gmail(token) {
  const base = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
  const [recent, flagged] = await Promise.all([
    g(`${base}?maxResults=30&q=${encodeURIComponent('newer_than:2d -category:promotions -category:social -in:spam -in:trash -in:sent')}`, token),
    g(`${base}?maxResults=20&q=${encodeURIComponent('newer_than:7d (is:unread OR is:important) -category:promotions -category:social -in:spam -in:trash -in:sent')}`, token).catch(() => ({})),
  ]);
  const ids = [...new Set([...(recent.messages || []), ...(flagged.messages || [])].map((m) => m.id))].slice(0, 45);
  const msgs = await Promise.all(ids.map((id) => g(`${base}/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, token).catch(() => null)));
  return msgs.filter(Boolean).map((m) => {
    const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]));
    const labels = m.labelIds || [];
    return {
      id: m.id, from: clean(String(h.from || '').replace(/"/g, '')).slice(0, 90), subject: clean(h.subject) || '(no subject)', snippet: clean(m.snippet).slice(0, 220),
      date: new Date(Number(m.internalDate)), unread: labels.includes('UNREAD'), important: labels.includes('IMPORTANT'),
    };
  }).sort((a, b) => (b.unread - a.unread) || (b.important - a.important) || (b.date - a.date));
}
async function calendar(token, now) {
  const q = new URLSearchParams({ timeMin: hkMidnight(now).toISOString(), timeMax: hkMidnight(now, 2).toISOString(), maxResults: '40', singleEvents: 'true', orderBy: 'startTime' });
  const l = await g(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`, token);
  const tomorrow = hkMidnight(now, 1);
  return (l.items || []).filter((e) => e.status !== 'cancelled').map((e) => {
    const start = new Date(e.start?.dateTime || `${e.start?.date}T00:00:00+08:00`);
    return { title: clean(e.summary) || '(untitled)', when: e.start?.dateTime ? fmt(start) : `${fmt(start, false)} (all day)`, day: start < tomorrow ? 'today' : 'tomorrow', location: clean(e.location || '').slice(0, 80), date: start };
  });
}
async function classroom(token, now) {
  const c = await g('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20', token);
  const work = []; const news = [];
  const horizon = now.getTime() + 7 * 864e5; const since = now.getTime() - 3 * 864e5;
  await Promise.all((c.courses || []).slice(0, 15).map(async (course) => {
    const [w, a] = await Promise.all([
      g(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=20&orderBy=dueDate%20desc`, token).catch(() => ({})),
      g(`https://classroom.googleapis.com/v1/courses/${course.id}/announcements?pageSize=5&orderBy=updateTime%20desc`, token).catch(() => ({})),
    ]);
    (w.courseWork || []).forEach((cw) => {
      if (!cw.dueDate) return;
      const due = new Date(Date.UTC(cw.dueDate.year, cw.dueDate.month - 1, cw.dueDate.day, cw.dueTime?.hours ?? 15, cw.dueTime?.minutes ?? 59));
      if (due.getTime() <= horizon && due.getTime() > now.getTime() - 2 * 864e5) work.push({ title: clean(cw.title), course: clean(course.name), due, overdue: due < now });
    });
    (a.announcements || []).forEach((x) => {
      const t = new Date(x.updateTime || x.creationTime);
      if (t.getTime() >= since) news.push({ course: clean(course.name), text: clean(x.text).slice(0, 240), date: t });
    });
  }));
  return { work: work.sort((x, y) => x.due - y.due).slice(0, 25), news: news.sort((x, y) => y.date - x.date).slice(0, 12) };
}
async function drive(token, now) {
  const since = new Date(now.getTime() - 3 * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');
  const q = encodeURIComponent(`sharedWithMe and modifiedTime > '${since}' and trashed = false`);
  const l = await g(`https://www.googleapis.com/drive/v3/files?pageSize=15&q=${q}&orderBy=modifiedTime%20desc&fields=files(name,modifiedTime,sharingUser(displayName,emailAddress),owners(displayName))`, token);
  return (l.files || []).map((f) => ({ name: clean(f.name), by: clean(f.sharingUser?.displayName || f.owners?.[0]?.displayName || ''), date: new Date(f.modifiedTime) }));
}

// selection: { gmail: [email…], … }; tokens: { email: accessToken }. Returns { gmail: [{ account, items | error }], … }.
export async function collectBrief(selection, tokens, now = new Date()) {
  const out = {};
  await Promise.all(BRIEF_SOURCES.map(async (id) => {
    const emails = selection?.[id] || [];
    out[id] = await Promise.all(emails.map(async (account) => {
      const token = tokens[account];
      if (!token) return { account, error: 'not_authorised' };
      try {
        const items = id === 'gmail' ? await gmail(token) : id === 'googlecalendar' ? await calendar(token, now) : id === 'googleclassroom' ? await classroom(token, now) : await drive(token, now);
        return { account, items };
      } catch (e) { return { account, error: e.status === 401 ? 'not_authorised' : e.status === 403 ? 'no_permission' : 'fetch_failed' }; }
    }));
  }));
  return out;
}

const NONE = '(none)';
export function formatBrief(data, now = new Date()) {
  const lines = [`Brief data collected ${fmt(now)} Hong Kong time. Every item below is real; mention every actionable or important one.`];
  const sec = (title, id, render) => {
    lines.push('', `## ${title}`);
    const accts = data[id] || [];
    if (!accts.length) { lines.push('(not connected / no account selected)'); return; }
    accts.forEach((a) => {
      if (a.error) { lines.push(`[${a.account}] could not read (${a.error})`); return; }
      const rows = render(a.items);
      if (!rows.length) lines.push(`[${a.account}] ${NONE}`);
      else rows.forEach((r) => lines.push(`- [${a.account}] ${r}`));
    });
  };
  sec('Gmail (last 48 h + unread/important from 7 days; promotions/social excluded)', 'gmail', (items) => items.map((m) =>
    `${m.unread ? 'UNREAD ' : ''}${m.important ? 'IMPORTANT ' : ''}${fmt(m.date)} · From: ${m.from} · Subject: ${m.subject} · ${m.snippet}`));
  sec('Calendar (today and tomorrow)', 'googlecalendar', (items) => items.map((e) => `${e.day.toUpperCase()} ${e.when} · ${e.title}${e.location ? ` · ${e.location}` : ''}`));
  sec('Classroom (due within 7 days, new announcements from 3 days)', 'googleclassroom', (x) => [
    ...x.work.map((w) => `${w.overdue ? 'OVERDUE ' : ''}DUE ${fmt(w.due)} · ${w.course} · ${w.title}`),
    ...x.news.map((n) => `ANNOUNCEMENT ${fmt(n.date)} · ${n.course} · ${n.text}`),
  ]);
  sec('Drive (shared with me in the last 3 days)', 'googledrive', (items) => items.map((f) => `${fmt(f.date)} · ${f.name}${f.by ? ` · shared by ${f.by}` : ''}`));
  return lines.join('\n');
}
// Counts for a deterministic fallback (push body when the model is unavailable).
export function briefCounts(data) {
  const n = (id, f) => (data[id] || []).reduce((s, a) => s + (a.items ? f(a.items) : 0), 0);
  return {
    unread: n('gmail', (i) => i.filter((m) => m.unread).length),
    important: n('gmail', (i) => i.filter((m) => m.important).length),
    events: n('googlecalendar', (i) => i.filter((e) => e.day === 'today').length),
    due: n('googleclassroom', (x) => x.work.length),
    news: n('googleclassroom', (x) => x.news.length),
    shared: n('googledrive', (i) => i.length),
  };
}

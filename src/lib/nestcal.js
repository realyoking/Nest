// Native Nest calendar events (families/{fid}/nestEvents/{id}, read/written by /api/nest/* → api/calendar.js with the
// service account after a family-membership check). Shared by the browser and the server dispatcher.
// Event: { id, title, allDay, start, end, repeat: none|daily|weekly|monthly|yearly, until: 'YYYY-MM-DD'|'' ,
//          members: [uid] ([] = whole family), location, notes, reminders: [minutes before: 0|10|60|1440…], createdBy, updatedAt }
// Times: timed events use ISO instants; all-day events use 'YYYY-MM-DD' (end exclusive). All recurrence runs on Hong Kong wall time.
const HK = 8 * 3600e3;
const DAY = 864e5;
export const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
export const REMINDER_OPTIONS = [0, 10, 60, 1440];
const dayStart = (key) => Date.parse(`${key}T00:00:00Z`) - HK;
const key = (ms) => new Date(ms + HK).toISOString().slice(0, 10);

export function cleanNestEvent(e = {}) {
  const allDay = !!e.allDay;
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const title = String(e.title || '').trim().slice(0, 200);
  if (!title) throw Object.assign(new Error('bad_event'), { status: 400 });
  let start; let end;
  if (allDay) {
    if (!okDate(e.start)) throw Object.assign(new Error('bad_event'), { status: 400 });
    start = e.start; end = okDate(e.end) && e.end > e.start ? e.end : key(dayStart(e.start) + DAY + 12 * 3600e3);
  } else {
    const s = Date.parse(e.start); const en = Date.parse(e.end || e.start);
    if (!Number.isFinite(s) || !Number.isFinite(en) || en < s || en - s > 31 * DAY) throw Object.assign(new Error('bad_event'), { status: 400 });
    start = new Date(s).toISOString(); end = new Date(en).toISOString();
  }
  return {
    title, allDay, start, end, repeat: REPEATS.includes(e.repeat) ? e.repeat : 'none', until: okDate(e.until) ? e.until : '',
    members: (Array.isArray(e.members) ? e.members : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,128}$/.test(x)).slice(0, 12),
    location: String(e.location || '').slice(0, 300), notes: String(e.notes || '').slice(0, 2000),
    reminders: [...new Set((Array.isArray(e.reminders) ? e.reminders : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 7 * 1440))].sort((a, b) => a - b).slice(0, 5),
  };
}

// Base [startMs, endMs) of the first occurrence.
function base(e) {
  if (e.allDay) { const s = dayStart(e.start); return [s, Math.max(dayStart(e.end || e.start), s + DAY)]; }
  return [Date.parse(e.start), Math.max(Date.parse(e.end || e.start), Date.parse(e.start))];
}
// n-th occurrence start (n ≥ 0) or null when that occurrence does not exist (e.g. 31st in a short month).
function nth(e, s0, n) {
  if (!n || e.repeat === 'none') return n ? null : s0;
  if (e.repeat === 'daily') return s0 + n * DAY;
  if (e.repeat === 'weekly') return s0 + n * 7 * DAY;
  const d = new Date(s0 + HK);
  const y = d.getUTCFullYear(); const m = d.getUTCMonth(); const day = d.getUTCDate();
  const t = new Date(d); t.setUTCDate(1);
  if (e.repeat === 'monthly') t.setUTCMonth(m + n); else t.setUTCFullYear(y + n);
  t.setUTCDate(day);
  if (t.getUTCDate() !== day) return null;
  return t.getTime() - HK;
}
const stepOf = (e) => (e.repeat === 'daily' ? DAY : e.repeat === 'weekly' ? 7 * DAY : e.repeat === 'monthly' ? 31 * DAY : 366 * DAY); // never overestimates n
const untilMs = (e) => (e.until ? dayStart(e.until) + DAY : Infinity);

// Occurrences overlapping [from, to): [{ startMs, endMs, occ }] (occ = occurrence index, for ids / dispatch keys).
export function occurrences(e, from, to, max = 500) {
  const [s0, e0] = base(e); const dur = e0 - s0; const out = [];
  if (e.repeat === 'none') return s0 < to && e0 > from ? [{ startMs: s0, endMs: e0, occ: 0 }] : [];
  const lim = Math.min(to, untilMs(e));
  let n = Math.max(0, Math.floor((from - dur - s0) / stepOf(e)) - 2);
  for (let i = 0; i < max * 3 && out.length < max; i++, n++) {
    const s = nth(e, s0, n);
    if (s == null) continue;
    if (s >= lim) break;
    if (s + dur > from) out.push({ startMs: s, endMs: s + dur, occ: n });
  }
  return out;
}
// When reminders fire: all-day events count from 09:00 HKT on the day.
const anchor = (e, occStart) => (e.allDay ? occStart + 9 * 3600e3 : occStart);
// Reminder fire times in (a, b]: [{ at, occ, occStart, minutes }]
export function firesBetween(e, a, b) {
  const rem = e.reminders || [];
  if (!rem.length) return [];
  const maxLead = Math.max(...rem) * 60e3;
  const out = [];
  occurrences(e, a - DAY, b + maxLead + DAY, 400).forEach((o) => rem.forEach((m) => {
    const at = anchor(e, o.startMs) - m * 60e3;
    if (at > a && at <= b) out.push({ at, occ: o.occ, occStart: o.startMs, minutes: m });
  }));
  return out.sort((x, y) => x.at - y.at);
}
// Next reminder time after `after` (ms) or null (searches up to ~400 days ahead).
export function nextFire(e, after = Date.now()) {
  if (!(e.reminders || []).length) return null;
  for (let w = 0; w < 14; w++) {
    const a = after + w * 30 * DAY; const f = firesBetween(e, a, a + 30 * DAY);
    if (f.length) return f[0].at;
    if (e.repeat === 'none' && w > 1) return null;
  }
  return null;
}
// Calendar-tab events for [from, to).
export function nestCalendarEvents(events = [], from, to) {
  return events.flatMap((e) => occurrences(e, from, to).map((o) => ({
    id: `nest|${e.id}|${o.occ}`, source: 'nest', account: 'nest', calKey: 'nest|events', eventId: e.id, occ: o.occ, title: e.title, allDay: !!e.allDay,
    start: e.allDay ? key(o.startMs) : new Date(o.startMs).toISOString(), end: e.allDay ? key(o.endMs) : new Date(o.endMs).toISOString(),
    startMs: o.startMs, endMs: o.endMs, location: e.location || '', description: e.notes || '', recurring: e.repeat !== 'none', editable: true,
    repeat: e.repeat, until: e.until || '', members: e.members || [], reminders: e.reminders || [], nest: e,
  })));
}
export const reminderLabel = (m, t) => (m === 0 ? t('ncal.rem.0') : m < 60 ? t('ncal.rem.min', { n: m }) : m < 1440 ? t('ncal.rem.hour', { n: m / 60 }) : t('ncal.rem.day', { n: m / 1440 }));

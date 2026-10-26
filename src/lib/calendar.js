import { normRegion, regionName, staticHolidays } from './regions/index.js';
// Calendar tab data layer: one list of calendars + events from every connected source, all shown in Hong Kong time.
// - Google: /api/google/calendar/events|write (server refreshes the stored tokens; every account selected for Google Calendar).
// - Apple / iCloud: /api/apple/connect|events|write|disconnect (CalDAV; Apple ID + app-specific password stored encrypted
//   server-side in users/{uid}.appleVault — the browser never sees the password again).
// - Family: members who opted in publish a compact snapshot to families/{fid}/calendarShare/{uid} (read-only for others).
import { currentUser } from './backend.js';
import { reportGate } from './gate-errors.js';
import { hkGet, holidayEvents, EDB_SCHOOL_HOLIDAYS } from './hk.js';
import { nestCalendarEvents } from './nestcal.js';
import { MOCK } from './backend.js';

export const TZ = 'Asia/Hong_Kong';
const HK = 8 * 3600e3; // Hong Kong has no DST
const DAY = 864e5;

// ---------- dates (Hong Kong wall clock) ----------
// A "day key" is YYYY-MM-DD in Hong Kong. Day starts are UTC instants of 00:00 HKT.
export const dayKey = (ms) => new Date(ms + HK).toISOString().slice(0, 10);
export const dayStart = (key) => Date.parse(`${key}T00:00:00Z`) - HK;
export const addDays = (key, n) => dayKey(dayStart(key) + n * DAY + 12 * 3600e3);
export const weekday = (key) => new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
export const weekStart = (key) => addDays(key, -((weekday(key) + 6) % 7)); // Monday
export const monthStart = (key) => `${key.slice(0, 7)}-01`;
export const addMonths = (key, n) => { const y = +key.slice(0, 4); const m = +key.slice(5, 7) - 1 + n; const d = new Date(Date.UTC(y, m, 1)); return d.toISOString().slice(0, 10); };
export const hkTime = (ms) => new Date(ms + HK).toISOString().slice(11, 16);
export const todayKey = () => dayKey(Date.now());
// <input type=datetime-local> value ↔ ISO, in Hong Kong time.
export const toLocalInput = (ms) => new Date(ms + HK).toISOString().slice(0, 16);
export const fromLocalInput = (v) => new Date(Date.parse(`${v}:00Z`) - HK).toISOString();

// Visible range for a view: { from, to } UTC ms, plus the day keys shown.
export function viewRange(view, key) {
  if (view === 'day') return { from: dayStart(key), to: dayStart(addDays(key, 1)), days: [key] };
  if (view === 'week') { const s = weekStart(key); const days = Array.from({ length: 7 }, (_, i) => addDays(s, i)); return { from: dayStart(s), to: dayStart(addDays(s, 7)), days }; }
  const s = weekStart(monthStart(key)); const days = Array.from({ length: 42 }, (_, i) => addDays(s, i));
  return { from: dayStart(s), to: dayStart(addDays(s, 42)), days };
}

// Normalised event times: startMs/endMs (UTC); all-day events cover whole HK days [start, end).
export function timesOf(e) {
  if (e.allDay) {
    const s = dayStart(String(e.start).slice(0, 10));
    const en = e.end ? dayStart(String(e.end).slice(0, 10)) : s + DAY;
    return { startMs: s, endMs: Math.max(en, s + DAY) };
  }
  const s = Date.parse(e.start); const en = Date.parse(e.end || e.start);
  return { startMs: s, endMs: Math.max(en, s) };
}
export const onDay = (e, key) => { const a = dayStart(key); const b = a + DAY; return e.startMs < b && (e.endMs > a || (e.endMs === e.startMs && e.startMs >= a)); };

// ---------- colours (muted, readable on white and black) ----------
export const PALETTE = ['#2f6fdf', '#d9480f', '#2b8a3e', '#ae3ec9', '#c2255c', '#0c8599', '#e67700', '#5f3dc4', '#5c940d', '#495057', '#1864ab', '#a61e4d'];

// ---------- API ----------
export async function call(path, body) {
  const u = currentUser();
  if (!u) throw Object.assign(new Error('signed_out'), { code: 'signed_out' });
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 28000);
  try {
    const r = await fetch(path, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = Object.assign(new Error(j.error || `http_${r.status}`), { code: j.error || `http_${r.status}`, status: r.status, detail: j.detail || '', ...(j.message ? { gateMessage: j.message } : {}) }); reportGate(err); throw err; }
    return j;
  } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { code: 'timeout' }); throw e; }
  finally { clearTimeout(timer); }
}
export const appleAccounts = (profile) => Object.values(profile?.appleVault || {}).filter((v) => v?.appleId && v?.enc)
  .map((v) => ({ appleId: v.appleId, calendars: (v.calendars || []).map((c) => ({ name: c.name, color: c.color, readOnly: c.readOnly })), at: v.at }));
export const connectApple = (appleId, password) => call('/api/apple/connect', { appleId, password });
export const disconnectApple = (appleId) => call('/api/apple/disconnect', { appleId });

// Load every source for [from, to). Never throws: per-source problems come back in `accounts` / `errors`.
export async function loadEvents(profile, from, to) {
  const body = { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
  const wantGoogle = !!profile?.connections?.googlecalendar;
  const wantApple = appleAccounts(profile).length > 0;
  const errors = [];
  const [g, a] = await Promise.all([
    wantGoogle ? call('/api/google/calendar/events', body).catch((e) => { errors.push({ source: 'google', code: e.code, detail: e.detail }); return null; }) : null,
    wantApple ? call('/api/apple/events', body).catch((e) => { errors.push({ source: 'apple', code: e.code, detail: e.detail }); return null; }) : null,
  ]);
  const accounts = [...(g?.accounts || []), ...(a?.accounts || [])];
  const nest = await loadNest(from, to).catch((e) => { errors.push({ source: 'nest', code: e.code, detail: e.detail }); return null; });
  const calendars = [...(g?.calendars || []), ...(a?.calendars || []), NEST_CAL()];
  const events = [...(g?.events || []), ...(a?.events || [])].map((e) => ({ ...e, ...timesOf(e) })).concat(nest || []);
  return { accounts, calendars, events, errors };
}

// action: create | update | delete. `cal` is the target calendar (create) — `ev` the existing event (update / delete).
export async function writeEvent(action, { cal, ev, fields }) {
  const src = ev?.source || cal?.source;
  if (src === 'google') {
    return call('/api/google/calendar/write', { action, account: ev?.account || cal.account, calendarId: ev?.calendarId || cal.calendarId, eventId: ev?.eventId, event: fields });
  }
  if (src === 'nest') {
    if (MOCK || mockNest.on) return mockNestWrite(action, ev?.eventId, fields);
    const r = await call('/api/nest/write', { action, id: ev?.eventId, event: fields });
    nestCache = { at: 0, events: null };
    return r;
  }
  if (src === 'apple') {
    return call('/api/apple/write', { action, appleId: ev?.account || cal.account, calendarUrl: ev?.calendarUrl || cal.calendarUrl, href: ev?.href, etag: ev?.etag, event: fields });
  }
  throw Object.assign(new Error('read_only'), { code: 'read_only' });
}

// ---------- visibility (per device) ----------
const visKey = (uid) => `nest.cal.vis.${uid || 'x'}`;
export const readVis = (uid) => { try { return JSON.parse(localStorage.getItem(visKey(uid)) || '{}') || {}; } catch { return {}; } };
export const writeVis = (uid, m) => { try { localStorage.setItem(visKey(uid), JSON.stringify(m)); } catch {} };
const VIEW = 'nest.cal.view';
export const readView = () => { try { const v = localStorage.getItem(VIEW); if (['day', 'week', 'month'].includes(v)) return v; } catch {} return typeof window !== 'undefined' && window.innerWidth < 640 ? 'day' : 'week'; };
export const writeView = (v) => { try { localStorage.setItem(VIEW, v); } catch {} };

// ---------- family sharing ----------
// Compact snapshot of the user's own events (-7 … +60 days), at most 400, titles + times + calendar name only.
export function shareSnapshot(events, calendars, name) {
  const byKey = Object.fromEntries(calendars.map((c) => [c.key, c.name]));
  const list = events.slice().sort((a, b) => a.startMs - b.startMs).slice(0, 400).map((e) => ({
    t: String(e.title || '').slice(0, 140), s: e.start, e: e.end || '', a: !!e.allDay, c: String(byKey[e.calKey] || '').slice(0, 60), ...(e.location ? { l: String(e.location).slice(0, 120) } : {}),
  }));
  return { name: String(name || '').slice(0, 60), events: list };
}
export function sharedEvents(share) {
  return (share.events || []).map((x, i) => {
    const e = { id: `f|${share.uid}|${i}`, source: 'family', account: share.uid, calKey: `f|${share.uid}`, title: x.t, start: x.s, end: x.e, allDay: !!x.a, location: x.l || '', calendarName: x.c || '', editable: false };
    return { ...e, ...timesOf(e) };
  });
}

// ---------- demo data (landing page + mock builds) ----------
export function demoData(lang, from, to) {
  const zh = lang !== 'en';
  const at = (d, h, m = 0) => { const k = addDays(todayKey(), d); return new Date(dayStart(k) + h * 3600e3 + m * 60e3).toISOString(); };
  const calendars = [
    { key: 'g|chan.family@gmail.com|primary', source: 'google', account: 'chan.family@gmail.com', calendarId: 'primary', name: 'chan.family@gmail.com', primary: true, defaultOn: true, writable: true },
    { key: 'g|chan.family@gmail.com|school', source: 'google', account: 'chan.family@gmail.com', calendarId: 'school', name: zh ? '學校活動' : 'School events', defaultOn: true, writable: false },
    { key: 'a|mum@icloud.com|home', source: 'apple', account: 'mum@icloud.com', calendarUrl: 'https://caldav.icloud.com/x/home/', name: zh ? '家庭' : 'Home', defaultOn: true, writable: true },
  ];
  const ev = (calKey, title, start, end, extra = {}) => ({ id: `${calKey}|${title}|${start}`, calKey, source: calKey[0] === 'g' ? 'google' : 'apple', account: calKey.split('|')[1], title, start, end, editable: false, ...extra });
  const k0 = todayKey();
  const events = [
    ev(calendars[0].key, zh ? '鋼琴課' : 'Piano lesson', at(1, 10), at(1, 11), { recurring: true }),
    ev(calendars[1].key, zh ? '家長日' : 'Parents’ day', at(2, 14), at(2, 16), { location: zh ? '學校禮堂' : 'School hall' }),
    ev(calendars[1].key, zh ? '中文默書' : 'Chinese dictation', addDays(k0, 3), addDays(k0, 4), { allDay: true }),
    ev(calendars[2].key, zh ? '嫲嫲生日飯' : 'Grandma’s birthday dinner', at(4, 19), at(4, 21)),
    ev(calendars[0].key, zh ? '游泳課' : 'Swimming', at(0, 17), at(0, 18)),
    ev(calendars[2].key, zh ? '買餸' : 'Grocery run', at(0, 11), at(0, 11, 45)),
    ev(calendars[0].key, zh ? '補習' : 'Tutoring', at(-2, 16, 30), at(-2, 18)),
    ev(calendars[1].key, zh ? '秋季旅行' : 'Autumn trip', addDays(k0, 9), addDays(k0, 10), { allDay: true }),
  ].map((e) => ({ ...e, ...timesOf(e) })).filter((e) => e.startMs < to && e.endMs > from);
  useMockNest([{ id: 'e00000000000000000001', title: zh ? '家庭晚飯' : 'Family dinner', allDay: false, start: at(2, 19), end: at(2, 21), repeat: 'weekly', members: [], reminders: [60], location: zh ? '外婆家' : 'Grandma’s', notes: '' }]);
  const nestEv = nestCalendarEvents(mockNest.events, from, to);
  return { accounts: [{ source: 'google', account: 'chan.family@gmail.com', ok: true, canWrite: true }, { source: 'apple', account: 'mum@icloud.com', ok: true, canWrite: true }], calendars: [...calendars, NEST_CAL()], events: [...events, ...nestEv], errors: [] };
}

// ---------- Hong Kong holidays (1823 public holidays + EDB example school holidays) and Nest reminders ----------
// Read-only calendars. If a Google "Holidays in Hong Kong" calendar is already connected, ours starts hidden.
export async function hkHolidaySource(lang, ownCalendars = [], { demo = false } = {}) {
  let pub = [];
  if (!demo) { try { pub = (await hkGet('holidays', { lang }, { maxAge: 6 * 3600e3 })).publicHolidays || []; } catch { pub = []; } }
  const hasGoogleHol = ownCalendars.some((c) => /holiday@group\.v\.calendar\.google\.com/.test(String(c.calendarId || '')) && /hong_kong|hk/i.test(String(c.calendarId || '')));
  const zh = lang !== 'en';
  const calendars = [
    { key: 'hk|public', source: 'hk', account: 'hk', name: zh ? '香港公眾假期' : 'HK public holidays', defaultOn: !hasGoogleHol, writable: false },
    { key: 'hk|school', source: 'hk', account: 'hk', name: zh ? '學校假期（教育局參考）' : 'School holidays (EDB guide)', defaultOn: true, writable: false },
  ];
  const events = holidayEvents({ publicHolidays: pub, school: EDB_SCHOOL_HOLIDAYS }, lang).map((e) => ({ ...e, ...timesOf(e) }));
  return { calendars, events };
}
// Run 11: public holidays for the user's region. HK (or no region yet) → the live 1823 feed + EDB school holidays as before;
// other regions with a static pack table → nationwide holidays from src/lib/regions/holidays.js; others → none.
export async function regionHolidaySource(region, lang, ownCalendars = [], opts = {}) {
  const c = normRegion(region);
  if (!c || c === 'HK') return hkHolidaySource(lang, ownCalendars, opts);
  const rows = staticHolidays(c, Date.now() - 400 * 864e5, 800);
  if (!rows.length) return { calendars: [], events: [] };
  const zh = lang !== 'en';
  const nm = regionName(c, zh ? 'zh-Hant' : 'en');
  const calendars = [{ key: 'region|public', source: 'region', account: 'region', name: zh ? `${nm}公眾假期` : `${nm} public holidays`, defaultOn: true, writable: false }];
  const events = rows.map((h) => { const e = { id: `region|${c}|${h.date}|${h.name}`, source: 'region', account: 'region', calKey: 'region|public', title: zh && c === 'CN' ? h.localName : h.name, allDay: true, start: h.date, end: '', editable: false }; return { ...e, ...timesOf(e) }; });
  return { calendars, events };
}
export function reminderSource(reminders = [], lang, memberName = () => '') {
  const zh = lang !== 'en';
  const calendars = [{ key: 'nest|reminders', source: 'nest', account: 'nest', name: zh ? 'Nest 提醒' : 'Nest reminders', defaultOn: true, writable: false }];
  const events = reminders.filter((r) => r.dueAt && !r.done).map((r) => {
    const s = (r.dueAt instanceof Date ? r.dueAt : new Date(r.dueAt)).toISOString();
    const e = { id: `nest|r|${r.id}`, source: 'nest', account: 'nest', calKey: 'nest|reminders', title: r.title, allDay: false, start: s, end: s, editable: false, location: '', description: r.memberId ? memberName(r.memberId) : '' };
    return { ...e, ...timesOf(e) };
  });
  return { calendars, events };
}

// ---------- native Nest events (family-wide, stored server-side) ----------
const NEST_NAME = () => (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'Nest family calendar' : 'Nest 家庭日曆');
export const NEST_CAL = () => ({ key: 'nest|events', source: 'nest', account: 'nest', calendarId: 'nest', name: NEST_NAME(), defaultOn: true, writable: true, primary: true });
let nestCache = { at: 0, events: null };
const mockNest = { on: false, events: [] };
export async function nestEventsRaw({ maxAge = 60e3 } = {}) {
  if (MOCK || mockNest.on) return mockNest.events;
  if (nestCache.events && Date.now() - nestCache.at < maxAge) return nestCache.events;
  const r = await call('/api/nest/list', {});
  nestCache = { at: Date.now(), events: r.events || [] };
  return nestCache.events;
}
export async function loadNest(from, to) { return nestCalendarEvents(await nestEventsRaw(), from, to); }
export const useMockNest = (events = []) => { mockNest.on = true; if (!mockNest.events.length) mockNest.events = events; };
function mockNestWrite(action, id, fields) {
  if (action === 'delete') { mockNest.events = mockNest.events.filter((e) => e.id !== id); return { ok: true }; }
  if (action === 'update') { mockNest.events = mockNest.events.map((e) => (e.id === id ? { ...e, ...fields } : e)); return { ok: true }; }
  const e = { reminders: [], members: [], repeat: 'none', ...fields, id: 'e' + Math.random().toString(16).slice(2, 12).padEnd(20, '0') };
  mockNest.events.push(e); return { ok: true, event: e };
}

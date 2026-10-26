// /api/calendar — the Calendar tab's server routes in ONE function (the Vercel Hobby plan caps a deployment at 12).
// vercel.json rewrites /api/apple/:op and /api/google/calendar/:op here as ?op=…  All need a Firebase ID token.
//
// Google (reuses the encrypted refresh tokens in users/{uid}.googleVault, see api/_google-lib.js):
//   POST op=google-events {from,to}      → calendars + events of every account selected for Google Calendar
//   POST op=google-write  {action:create|update|delete, account, calendarId, eventId?, event?}  (needs calendar.events)
// Apple / iCloud CalDAV (credentials AES-256-GCM encrypted with TOKEN_ENC_KEY in users/{uid}.appleVault.<key>):
//   POST op=apple-connect {appleId, password} → PROPFIND discovery; saves the encrypted credentials; never returns the password
//   POST op=apple-events  {from,to}          → calendars + events of every connected Apple ID
//   POST op=apple-write   {action, appleId, calendarUrl, href?, etag?, event?}
//   POST op=apple-disconnect {appleId}
// Native Nest events (api/_nest.js, service account after a membership check; rewrite /api/nest/:op):
//   POST op=nest-list {} → { events }   POST op=nest-write {action:create|update|delete, id?, event}
//   POST op=nest-subs {} → { subs }     POST op=nest-subwrite {action:create|update|delete|decide|used, id?, sub?, choice?}
// Plugin data served by Nest (rewrite /api/pdata → op=pdata; the sandboxed plugin never sees a token — the Nest app calls
// this with the user's ID token after its own gate + confirmation sheet, and the server re-checks the grant itself):
//   POST op=pdata {pid, method: gmail.summary|classroom.list|calendar.create|calendar.update|calendar.delete, params}
import crypto from 'node:crypto';
import { accessGate } from './_gate.js';
import { send, verifyCaller, readBody, fsGet, fsPatch } from './_push-lib.js';
import { accessFor, encrypt, decrypt, configured } from './_google-lib.js';
import { discover, listCalendars, calendarEvents, getObject, putObject, deleteObject, isIcloudUrl } from './_caldav.js';
import { buildICS, patchICS } from './_ical.js';
import { nestList, nestWrite, subsList, subsWrite, saToken } from './_nest.js';
import { serverGate, budgetOk, SERVER_BUDGET, shapeGmail, shapeClassroom, classroomDue, logKey, logEntry } from '../src/lib/plugins/data.js';
import { VERIFIED_ONLY } from '../src/lib/plugins/permissions.js';

export const config = { maxDuration: 30 };

const A = 'https://www.googleapis.com/auth/';
export const canWriteGoogle = (scopes) => (scopes || []).some((s) => s === `${A}calendar.events` || s === `${A}calendar`);
const DAY = 864e5;
const lc = (s) => String(s || '').trim().toLowerCase();
export const appleKey = (id) => 'a' + crypto.createHash('sha256').update(lc(id)).digest('hex').slice(0, 24);
const appleAad = (id) => `apple:${lc(id)}`;

function range(body) {
  const from = Date.parse(body.from); const to = Date.parse(body.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 100 * DAY) throw Object.assign(new Error('bad_range'), { status: 400 });
  return { from, to };
}
function cleanEvent(e = {}) {
  const allDay = !!e.allDay;
  const title = String(e.title || '').slice(0, 300).trim();
  const okDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const okIso = (s) => Number.isFinite(Date.parse(s));
  if (allDay ? !okDate(e.start) || (e.end && !okDate(e.end)) : !okIso(e.start) || !okIso(e.end)) throw Object.assign(new Error('bad_event'), { status: 400 });
  if (!allDay && Date.parse(e.end) < Date.parse(e.start)) throw Object.assign(new Error('bad_event'), { status: 400 });
  return { title, allDay, start: String(e.start), end: String(e.end || ''), location: String(e.location || '').slice(0, 500), description: String(e.description || '').slice(0, 4000) };
}

// ---------------- Google ----------------
async function gapi(url, token, init = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) } });
    if (r.status === 204) return {};
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error?.message || `google_${r.status}`), { status: r.status, google: String(j.error?.message || '').slice(0, 200) });
    return j;
  } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('timeout'), { status: 504 }); throw e; }
  finally { clearTimeout(t); }
}
const selectedCalendarAccounts = (profile) => {
  if (!profile?.connections?.googlecalendar) return [];
  const all = (profile.googleAccounts || []).map((a) => lc(a.email)).filter(Boolean);
  const sel = profile.serviceAccounts?.googlecalendar;
  return Array.isArray(sel) ? sel.map(lc).filter((e) => all.includes(e)) : all;
};
const vaultFor = (profile, email) => Object.values(profile?.googleVault || {}).filter((v) => v && lc(v.email) === email && v.enc)
  .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))[0];

function gEvent(e, cal, account) {
  const allDay = !!e.start?.date;
  return {
    id: `g|${account}|${cal.id}|${e.id}`, source: 'google', account, calendarId: cal.id, calKey: `g|${account}|${cal.id}`, eventId: e.id,
    title: e.summary || '', location: e.location || '', description: String(e.description || '').slice(0, 2000), allDay,
    start: allDay ? e.start.date : e.start?.dateTime, end: allDay ? e.end?.date : e.end?.dateTime,
    recurring: !!e.recurringEventId, htmlLink: e.htmlLink || '', editable: cal.writable && !e.locked && e.eventType !== 'birthday' && e.eventType !== 'fromGmail',
  };
}

async function googleEvents(me, profile, body) {
  const { from, to } = range(body);
  const emails = selectedCalendarAccounts(profile);
  const accounts = []; const calendars = []; const events = [];
  await Promise.all(emails.slice(0, 8).map(async (email) => {
    const v = vaultFor(profile, email);
    if (!v) { accounts.push({ source: 'google', account: email, ok: false, error: 'reauth' }); return; }
    const a = await accessFor(me.uid, v);
    if (!a.token) { accounts.push({ source: 'google', account: email, ok: false, error: a.error, detail: a.detail }); return; }
    const canWrite = canWriteGoogle(a.scopes);
    let list;
    try { list = await gapi('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50&fields=items(id,summary,summaryOverride,backgroundColor,accessRole,primary,selected,hidden)', a.token); }
    catch (e) { accounts.push({ source: 'google', account: email, ok: false, canWrite, error: e.status === 403 ? 'scope' : 'google', detail: e.google || e.message }); return; }
    const cals = (list.items || []).filter((c) => !c.hidden).slice(0, 25);
    const failedCals = [];
    await Promise.all(cals.map(async (c) => {
      const writable = canWrite && ['owner', 'writer'].includes(c.accessRole);
      const cal = { id: c.id, writable };
      calendars.push({ key: `g|${email}|${c.id}`, source: 'google', account: email, calendarId: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || '', primary: !!c.primary, defaultOn: c.selected !== false || !!c.primary, writable, accessRole: c.accessRole });
      const q = new URLSearchParams({ timeMin: new Date(from).toISOString(), timeMax: new Date(to).toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', fields: 'items(id,summary,location,description,start,end,recurringEventId,htmlLink,status,locked,eventType)' });
      try {
        const r = await gapi(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${q}`, a.token);
        (r.items || []).filter((e) => e.status !== 'cancelled').forEach((e) => events.push(gEvent(e, cal, email)));
      } catch (e) { failedCals.push({ calendarId: c.id, detail: e.google || e.message }); }
    }));
    accounts.push({ source: 'google', account: email, ok: true, canWrite, failedCalendars: failedCals });
  }));
  return { accounts, calendars, events };
}

async function googleWrite(me, profile, body) {
  const email = lc(body.account);
  if (!selectedCalendarAccounts(profile).includes(email)) return [400, { error: 'unknown_account' }];
  const v = vaultFor(profile, email);
  if (!v) return [409, { error: 'reauth' }];
  const a = await accessFor(me.uid, v);
  if (!a.token) return [409, { error: a.error || 'reauth', detail: a.detail }];
  if (!canWriteGoogle(a.scopes)) return [403, { error: 'write_scope_missing' }];
  const calId = String(body.calendarId || '');
  if (!calId) return [400, { error: 'bad_calendar' }];
  const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
  const toG = (e, patch) => strip({
    summary: e.title, location: e.location || (patchMode ? '' : undefined), description: e.description || (patchMode ? '' : undefined),
    start: e.allDay ? { date: e.start, dateTime: null } : { dateTime: new Date(e.start).toISOString(), timeZone: 'Asia/Hong_Kong', date: null },
    end: e.allDay ? { date: e.end && e.end > e.start ? e.end : new Date(Date.parse(e.start + 'T00:00:00Z') + DAY).toISOString().slice(0, 10), dateTime: null } : { dateTime: new Date(e.end).toISOString(), timeZone: 'Asia/Hong_Kong', date: null },
  });
  // On PATCH the other time field is sent as null so switching timed ↔ all-day clears it; on create nulls are dropped.
  const strip = (o) => { if (patchMode) return o; for (const k of ['start', 'end']) for (const f of Object.keys(o[k])) if (o[k][f] == null) delete o[k][f]; return o; };
  const patchMode = body.action === 'update';
  try {
    if (body.action === 'create') {
      const r = await gapi(base, a.token, { method: 'POST', body: JSON.stringify(toG(cleanEvent(body.event))) });
      return [200, { ok: true, event: gEvent(r, { id: calId, writable: true }, email) }];
    }
    const eid = String(body.eventId || '');
    if (!/^[A-Za-z0-9_@.-]{1,1024}$/.test(eid)) return [400, { error: 'bad_event_id' }];
    if (body.action === 'update') {
      const r = await gapi(`${base}/${encodeURIComponent(eid)}`, a.token, { method: 'PATCH', body: JSON.stringify(toG(cleanEvent(body.event))) });
      return [200, { ok: true, event: gEvent(r, { id: calId, writable: true }, email) }];
    }
    if (body.action === 'delete') { await gapi(`${base}/${encodeURIComponent(eid)}`, a.token, { method: 'DELETE' }); return [200, { ok: true }]; }
    return [400, { error: 'bad_action' }];
  } catch (e) {
    if (e.status === 400 && e.message === 'bad_event') return [400, { error: 'bad_event' }];
    return [e.status === 403 ? 403 : e.status === 404 || e.status === 410 ? 404 : 502, { error: e.status === 403 ? 'google_forbidden' : e.status === 404 || e.status === 410 ? 'not_found' : 'google_error', detail: e.google || e.message }];
  }
}

// ---------------- Apple ----------------
const appleEntries = (profile) => Object.entries(profile?.appleVault || {}).filter(([, v]) => v && v.appleId && v.enc);
function appleCreds(uid, v) {
  const o = JSON.parse(decrypt(v.enc, uid, appleAad(v.appleId)));
  return { user: o.u, pass: o.p, home: o.h || v.home };
}
const appleErr = (e) => {
  const code = e.code || e.message || 'apple_error';
  const status = code === 'apple_auth' ? 401 : code === 'apple_conflict' ? 409 : code === 'bad_event' ? 400 : e.status && e.status < 500 ? e.status : 502;
  return [status, { error: code, detail: e.detail || '' }];
};

async function appleConnect(me, profile, body) {
  const appleId = lc(body.appleId);
  const password = String(body.password || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appleId) || appleId.length > 254) return [400, { error: 'apple_bad_id' }];
  // App-specific passwords look like abcd-efgh-ijkl-mnop; accept them with or without dashes / spaces.
  const pass = password.replace(/\s+/g, '');
  if (pass.length < 8 || pass.length > 64) return [400, { error: 'apple_bad_password' }];
  let d;
  try { d = await discover(appleId, pass); } catch (e) { return appleErr(e); }
  const key = appleKey(appleId);
  const at = new Date().toISOString();
  const calendars = d.calendars.slice(0, 40).map((c) => ({ url: c.url, name: c.name.slice(0, 120), color: c.color, readOnly: !!c.readOnly }));
  const entry = { appleId, enc: encrypt(JSON.stringify({ u: appleId, p: pass, h: d.home }), me.uid, appleAad(appleId)), home: d.home, calendars, at };
  try { await fsPatch(`users/${me.uid}`, { appleVault: { [key]: entry }, updatedAt: new Date() }, me.token, [`appleVault.${key}`, 'updatedAt']); }
  catch (e) { return [502, { error: 'store_failed', status: e.status || 0 }]; }
  return [200, { ok: true, appleId, calendars: calendars.map(({ name, color, readOnly }) => ({ name, color, readOnly })), at }];
}

async function appleEvents(me, profile, body) {
  const { from, to } = range(body);
  const accounts = []; const calendars = []; const events = [];
  await Promise.all(appleEntries(profile).slice(0, 5).map(async ([key, v]) => {
    let c;
    try { c = appleCreds(me.uid, v); } catch { accounts.push({ source: 'apple', account: v.appleId, ok: false, error: 'apple_reconnect' }); return; }
    let cals = v.calendars || [];
    try { if (c.home) cals = await listCalendars(c.user, c.pass, c.home); } catch (e) { if (e.code === 'apple_auth') { accounts.push({ source: 'apple', account: v.appleId, ok: false, error: 'apple_auth' }); return; } }
    const failedCals = [];
    await Promise.all(cals.filter((x) => isIcloudUrl(x.url)).slice(0, 40).map(async (cal) => {
      const ck = `a|${v.appleId}|${cal.url}`;
      calendars.push({ key: ck, source: 'apple', account: v.appleId, calendarUrl: cal.url, name: cal.name, color: cal.color || '', defaultOn: true, writable: !cal.readOnly });
      try {
        (await calendarEvents(c.user, c.pass, cal.url, from, to)).forEach((o) => events.push({
          id: `a|${o.href}|${o.startMs}`, source: 'apple', account: v.appleId, calendarUrl: cal.url, calKey: ck, href: o.href, etag: o.etag, uid: o.uid,
          title: o.title, location: o.location, description: o.description.slice(0, 2000), allDay: o.allDay, start: o.start, end: o.end,
          recurring: o.recurring, editable: !cal.readOnly && !o.recurring,
        }));
      } catch (e) { if (e.code === 'apple_auth') throw e; failedCals.push({ name: cal.name, detail: e.detail || e.code }); }
    })).then(() => accounts.push({ source: 'apple', account: v.appleId, ok: true, canWrite: true, failedCalendars: failedCals }))
      .catch((e) => accounts.push({ source: 'apple', account: v.appleId, ok: false, error: e.code || 'apple_error', detail: e.detail || '' }));
  }));
  return { accounts, calendars, events };
}

async function appleWrite(me, profile, body) {
  const appleId = lc(body.appleId);
  const hit = appleEntries(profile).find(([, v]) => lc(v.appleId) === appleId);
  if (!hit) return [400, { error: 'unknown_account' }];
  let c;
  try { c = appleCreds(me.uid, hit[1]); } catch { return [409, { error: 'apple_reconnect' }]; }
  const calUrl = String(body.calendarUrl || '');
  const known = (hit[1].calendars || []).map((x) => x.url);
  // Calendars can be added on the Apple side after connecting: accept any URL under this account's calendar home.
  if (!isIcloudUrl(calUrl) || !(known.includes(calUrl) || (c.home && calUrl.startsWith(c.home)))) return [400, { error: 'bad_calendar' }];
  try {
    if (body.action === 'create') {
      const ev = cleanEvent(body.event);
      const uid = `${crypto.randomUUID()}@heynest`;
      const href = new URL(`${uid.replace(/[^A-Za-z0-9-]/g, '-')}.ics`, calUrl.endsWith('/') ? calUrl : calUrl + '/').toString();
      const r = await putObject(c.user, c.pass, href, buildICS({ ...ev, uid }), { create: true });
      return [200, { ok: true, href, etag: r.etag }];
    }
    const href = String(body.href || '');
    if (!isIcloudUrl(href) || !href.startsWith(calUrl.endsWith('/') ? calUrl : calUrl + '/')) return [400, { error: 'bad_href' }];
    if (body.action === 'update') {
      const ev = cleanEvent(body.event);
      const cur = await getObject(c.user, c.pass, href);
      if (/^RRULE:/m.test(cur.text) || /RECURRENCE-ID/.test(cur.text)) return [409, { error: 'apple_recurring' }];
      const r = await putObject(c.user, c.pass, href, patchICS(cur.text, ev), { etag: cur.etag || body.etag });
      return [200, { ok: true, href, etag: r.etag }];
    }
    if (body.action === 'delete') {
      await deleteObject(c.user, c.pass, href, String(body.etag || '') || undefined);
      return [200, { ok: true }];
    }
    return [400, { error: 'bad_action' }];
  } catch (e) { return appleErr(e); }
}

async function appleDisconnect(me, profile, body) {
  const appleId = lc(body.appleId);
  const keys = [...new Set([appleKey(appleId), ...appleEntries(profile).filter(([, v]) => lc(v.appleId) === appleId).map(([k]) => k)])];
  try { await fsPatch(`users/${me.uid}`, {}, me.token, keys.map((k) => `appleVault.${k}`)); }
  catch (e) { return [502, { error: 'store_failed' }]; }
  return [200, { ok: true }];
}

// ---------------- plugin data (op=pdata) ----------------
const PDATA_PERM = { 'gmail.summary': 'gmail.read', 'classroom.list': 'classroom.read', 'calendar.create': 'calendar.write', 'calendar.update': 'calendar.write', 'calendar.delete': 'calendar.write' };
const selectedFor = (profile, id) => {
  if (!profile?.connections?.[id]) return [];
  const all = (profile.googleAccounts || []).map((a) => lc(a?.email)).filter(Boolean);
  const sel = profile.serviceAccounts?.[id];
  return (Array.isArray(sel) ? sel.map(lc) : all).filter((e) => all.includes(e));
};
async function tokensFor(me, profile, service) {
  const emails = selectedFor(profile, service).slice(0, 3);
  if (!emails.length) return { error: 'not_connected' };
  const out = [];
  for (const email of emails) {
    const v = vaultFor(profile, email);
    if (!v) continue;
    const a = await accessFor(me.uid, v);
    if (a.token) out.push(a.token);
  }
  return out.length ? { tokens: out } : { error: 'reauth_needed' };
}
async function pdGmail(me, profile, p) {
  const limit = Math.max(1, Math.min(10, Number(p.limit) || 5));
  const t = await tokensFor(me, profile, 'gmail');
  if (t.error) return [409, { error: t.error }];
  const msgs = [];
  for (const token of t.tokens) {
    const l = await gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${limit}&q=${encodeURIComponent('newer_than:7d -category:promotions -category:social -in:spam')}`, token).catch(() => ({}));
    const got = await Promise.all((l.messages || []).slice(0, limit).map((m) => gapi(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&fields=snippet,internalDate,labelIds,payload/headers`, token).catch(() => null)));
    for (const m of got.filter(Boolean)) {
      const h = Object.fromEntries((m.payload?.headers || []).map((x) => [String(x.name).toLowerCase(), x.value]));
      msgs.push({ from: h.from, subject: h.subject, snippet: m.snippet, date: Number(m.internalDate) || null, unread: (m.labelIds || []).includes('UNREAD') });
    }
  }
  msgs.sort((a, b) => (b.date || 0) - (a.date || 0));
  return [200, { items: shapeGmail(msgs, limit) }];
}
async function pdClassroom(me, profile, p) {
  const limit = Math.max(1, Math.min(15, Number(p.limit) || 10));
  const days = Math.max(1, Math.min(30, Number(p.days) || 14));
  const t = await tokensFor(me, profile, 'googleclassroom');
  if (t.error) return [409, { error: t.error }];
  const now = Date.now(); const items = [];
  for (const token of t.tokens) {
    const c = await gapi('https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=15&fields=courses(id,name)', token).catch(() => ({}));
    await Promise.all((c.courses || []).slice(0, 15).map(async (course) => {
      const w = await gapi(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=20&orderBy=dueDate%20desc&fields=courseWork(title,dueDate,dueTime,state)`, token).catch(() => ({}));
      for (const cw of w.courseWork || []) {
        const due = classroomDue(cw);
        if (due && due >= now - 864e5 && due <= now + days * 864e5) items.push({ course: course.name, title: cw.title, due, late: due < now });
      }
    }));
  }
  return [200, { items: shapeClassroom(items, limit) }];
}
async function pdLog(me, pid, method, summary) {
  const k = logKey();
  await fsPatch(`users/${me.uid}`, { pluginLog: { [k]: logEntry(pid, method, summary) } }, me.token, [`pluginLog.${k}`]).catch(() => {});
}
async function pdCalendar(me, pid, method, p, sa) {
  const msOf = (v) => (typeof v === 'number' ? v : Date.parse(v));
  const hkKey = (ms) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
  const toEvent = (x) => {
    const st = msOf(x.start); const en = x.end != null && x.end !== '' ? msOf(x.end) : null;
    if (!Number.isFinite(st)) throw Object.assign(new Error('bad_event'), { status: 400 });
    if (x.allDay) return { ...x, start: hkKey(st), end: Number.isFinite(en) ? hkKey(en) : '' };
    return { ...x, start: new Date(st).toISOString(), end: new Date(Number.isFinite(en) ? en : st + 3600e3).toISOString() };
  };
  const ev = { title: p.title, allDay: !!p.allDay, start: p.start, end: p.end, location: p.location || '' };
  if (method === 'calendar.create') {
    const r = await nestWrite(me, { action: 'create', event: { ...toEvent(ev), reminders: [] } }, { byPlugin: pid });
    await pdLog(me, pid, method, r.event.title);
    return [200, { id: r.event.id }];
  }
  const id = String(p.id || '');
  if (!/^e[0-9a-f]{20}$/.test(id)) return [400, { error: 'bad_id' }];
  const prof = await fsGet(`users/${me.uid}`, sa);
  const cur = prof?.familyId ? await fsGet(`families/${prof.familyId}/nestEvents/${id}`, sa) : null;
  if (!cur) return [404, { error: 'not_found' }];
  if (cur.byPlugin !== pid || cur.createdBy !== me.uid) return [403, { error: 'not_own_event' }];
  if (method === 'calendar.delete') {
    await nestWrite(me, { action: 'delete', id });
    await pdLog(me, pid, method, cur.title);
    return [200, { ok: true }];
  }
  const f = p.fields || {};
  const base = { title: cur.title, allDay: !!cur.allDay, start: cur.start, end: cur.end, location: cur.location || '', repeat: cur.repeat, until: cur.until, members: cur.members || [], notes: cur.notes || '', reminders: cur.reminders || [] };
  const patch = Object.fromEntries(Object.entries({ title: f.title, start: f.start, end: f.end, allDay: f.allDay, location: f.location }).filter(([, v]) => v !== undefined));
  if (patch.start !== undefined && patch.end === undefined) delete base.end;
  const next = toEvent({ ...base, ...patch });
  await nestWrite(me, { action: 'update', id, event: next, createdBy: cur.createdBy }, { byPlugin: pid });
  await pdLog(me, pid, method, next.title);
  return [200, { ok: true }];
}
export async function pdata(me, profile, body) {
  const pid = String(body.pid || '');
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(pid)) return [400, { error: 'bad_id' }];
  const method = String(body.method || '');
  const perm = PDATA_PERM[method];
  if (!perm) return [404, { error: 'unknown_method' }];
  const sa = await saToken();
  const [plugin, install] = await Promise.all([fsGet(`nestPlugins/${pid}`, sa), fsGet(`nestPlugins/${pid}/installs/${me.uid}`, sa)]);
  const g = serverGate({ perm, uid: me.uid, plugin, install, state: profile.plugins?.[pid], verifiedOnly: VERIFIED_ONLY });
  if (g) return [403, { error: g }];
  const [mx, ms] = SERVER_BUDGET[method] || [10, 60e3];
  if (!budgetOk(`${me.uid}|${pid}|${method}`, mx, ms)) return [429, { error: 'rate_limited' }];
  const p = body.params && typeof body.params === 'object' ? body.params : {};
  if (method === 'gmail.summary') { if (!configured()) return [503, { error: 'not_configured' }]; return pdGmail(me, profile, p); }
  if (method === 'classroom.list') { if (!configured()) return [503, { error: 'not_configured' }]; return pdClassroom(me, profile, p); }
  return pdCalendar(me, pid, method, p, sa);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  const me = await verifyCaller(req);
  if (!me) return send(res, 401, { error: 'unauthorized' });
  if (!process.env.TOKEN_ENC_KEY) return send(res, 503, { error: 'not_configured' });
  const op = String(new URL(req.url, 'http://x').searchParams.get('op') || '');
  const gateP = accessGate(me); // shared access check (maintenance / suspended / revoked / signup closed), parallel with the profile read
  const body = await readBody(req);
  let profile;
  try { profile = (await fsGet(`users/${me.uid}`, me.token)) || {}; } catch (e) { return send(res, 502, { error: 'profile_read', status: e.status || 0 }); }
  { const g = await gateP; if (g) return send(res, g[0], g[1]); }
  try {
    switch (op) {
      case 'google-events': if (!configured()) return send(res, 503, { error: 'not_configured' }); return send(res, 200, await googleEvents(me, profile, body));
      case 'google-write': { const [s, j] = await googleWrite(me, profile, body); return send(res, s, j); }
      case 'apple-connect': { const [s, j] = await appleConnect(me, profile, body); return send(res, s, j); }
      case 'apple-events': return send(res, 200, await appleEvents(me, profile, body));
      case 'apple-write': { const [s, j] = await appleWrite(me, profile, body); return send(res, s, j); }
      case 'apple-disconnect': { const [s, j] = await appleDisconnect(me, profile, body); return send(res, s, j); }
      case 'nest-list': return send(res, 200, await nestList(me));
      case 'nest-write': return send(res, 200, await nestWrite(me, body));
      case 'nest-subs': return send(res, 200, await subsList(me));
      case 'nest-subwrite': return send(res, 200, await subsWrite(me, body));
      case 'pdata': { const [s, j] = await pdata(me, profile, body); return send(res, s, j); }
      default: return send(res, 404, { error: 'unknown_op' });
    }
  } catch (e) {
    if ([403, 404, 503].includes(e.status)) return send(res, e.status, { error: e.message });
    return send(res, e.status === 400 ? 400 : 500, { error: ['bad_range', 'bad_event', 'bad_id', 'bad_action', 'bad_sub'].includes(e.message) ? e.message : 'server_error' });
  }
}

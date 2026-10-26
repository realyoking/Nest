// Minimal iCalendar (RFC 5545) helpers for the Apple / iCloud CalDAV connector. No dependencies.
// - parseICS(text) → VEVENT objects (unfolded, unescaped, with TZID / VALUE=DATE / UTC handling)
// - expandEvents(events, from, to) → concrete occurrences in [from, to) with basic RRULE expansion
//   (DAILY / WEEKLY / MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL, BYDAY incl. ordinals like 2MO / -1FR, BYMONTHDAY,
//   BYMONTH), EXDATE and RECURRENCE-ID overrides. BYSETPOS / BYWEEKNO / BYYEARDAY / hourly rules are not supported
//   (such a series shows its first occurrence only).
// - buildICS(fields) / patchICS(text, fields) → .ics text for PUT (timed events in UTC, all-day as VALUE=DATE).
const DEFAULT_TZ = 'Asia/Hong_Kong';
const DAY = 864e5;

export function unfold(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}
export const unescapeText = (v) => String(v || '').replace(/\\([\\;,nN])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
export const escapeText = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// "DTSTART;TZID=Asia/Hong_Kong:20261018T090000" → { name, params, value }
export function parseLine(line) {
  let i = 0; let inQ = false;
  for (; i < line.length; i++) { const c = line[i]; if (c === '"') inQ = !inQ; else if (c === ':' && !inQ) break; }
  const head = line.slice(0, i); const value = line.slice(i + 1);
  const parts = head.split(';');
  const params = {};
  for (const p of parts.slice(1)) { const k = p.indexOf('='); if (k > 0) params[p.slice(0, k).toUpperCase()] = p.slice(k + 1).replace(/^"|"$/g, ''); }
  return { name: parts[0].toUpperCase(), params, value };
}

const validTz = (tz) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } };
// Offset (ms) of `tz` at UTC instant `ms`.
function tzOffset(ms, tz) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}
// Wall-clock time in `tz` → UTC ms (DST-correct).
export function zonedToUtc(c, tz) {
  const wall = Date.UTC(c.y, c.m - 1, c.d, c.h || 0, c.mi || 0, c.s || 0);
  let utc = wall - tzOffset(wall, tz);
  const o2 = tzOffset(utc, tz);
  utc = wall - o2;
  return utc;
}
// UTC ms → wall-clock components in `tz`.
function utcToWall(ms, tz) {
  const w = new Date(ms + tzOffset(ms, tz));
  return { y: w.getUTCFullYear(), m: w.getUTCMonth() + 1, d: w.getUTCDate(), h: w.getUTCHours(), mi: w.getUTCMinutes(), s: w.getUTCSeconds() };
}

// Parse a DATE or DATE-TIME property value. Returns { allDay, ms, wall, tz, date? }.
export function parseDate(value, params = {}, tzAliases = {}) {
  const v = String(value || '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(v);
  if (!m) return null;
  const c = { y: +m[1], m: +m[2], d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  if (!m[4] || params.VALUE === 'DATE') return { allDay: true, wall: { ...c, h: 0, mi: 0, s: 0 }, ms: Date.UTC(c.y, c.m - 1, c.d), tz: 'UTC', date: `${m[1]}-${m[2]}-${m[3]}` };
  if (m[7]) return { allDay: false, wall: c, ms: Date.UTC(c.y, c.m - 1, c.d, c.h, c.mi, c.s), tz: 'UTC' };
  let tz = params.TZID ? String(params.TZID).replace(/^\//, '') : DEFAULT_TZ; // floating time → Hong Kong
  if (!validTz(tz)) tz = tzAliases[params.TZID] && validTz(tzAliases[params.TZID]) ? tzAliases[params.TZID] : DEFAULT_TZ;
  return { allDay: false, wall: c, ms: zonedToUtc(c, tz), tz };
}

// ISO 8601 duration ("PT1H30M", "P1D", "-PT15M") → ms
export function parseDuration(v) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(v || '').trim());
  if (!m) return 0;
  const ms = ((+m[2] || 0) * 7 * DAY) + ((+m[3] || 0) * DAY) + ((+m[4] || 0) * 3600e3) + ((+m[5] || 0) * 60e3) + ((+m[6] || 0) * 1e3);
  return m[1] === '-' ? -ms : ms;
}

export function parseRRule(v) {
  const o = {};
  for (const part of String(v || '').split(';')) { const [k, x] = part.split('='); if (k && x != null) o[k.toUpperCase()] = x; }
  return {
    freq: o.FREQ, interval: Math.max(1, +o.INTERVAL || 1), count: o.COUNT ? +o.COUNT : null, until: o.UNTIL || null,
    byday: o.BYDAY ? o.BYDAY.split(',').map((d) => { const m = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(d.trim().toUpperCase()); return m ? { n: m[1] ? +m[1] : 0, wd: WD.indexOf(m[2]) } : null; }).filter(Boolean) : null,
    bymonthday: o.BYMONTHDAY ? o.BYMONTHDAY.split(',').map(Number).filter(Boolean) : null,
    bymonth: o.BYMONTH ? o.BYMONTH.split(',').map(Number).filter(Boolean) : null,
    unsupported: !!(o.BYSETPOS || o.BYWEEKNO || o.BYYEARDAY || ['HOURLY', 'MINUTELY', 'SECONDLY'].includes(o.FREQ)),
  };
}
const WD = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// All VEVENTs in a calendar object (plus the VTIMEZONE X-LIC-LOCATION aliases).
export function parseICS(text) {
  const lines = unfold(text);
  const aliases = {};
  let tzid = null;
  for (const l of lines) {
    const p = parseLine(l);
    if (p.name === 'BEGIN' && p.value.toUpperCase() === 'VTIMEZONE') tzid = '';
    else if (tzid !== null && p.name === 'TZID') tzid = p.value;
    else if (tzid && (p.name === 'X-LIC-LOCATION')) aliases[tzid] = p.value;
    else if (p.name === 'END' && p.value.toUpperCase() === 'VTIMEZONE') tzid = null;
  }
  const out = [];
  let cur = null; let depth = 0;
  for (const l of lines) {
    if (!l) continue;
    const p = parseLine(l);
    if (p.name === 'BEGIN') {
      if (p.value.toUpperCase() === 'VEVENT' && !cur) { cur = { exdates: [], raw: {} }; depth = 0; continue; }
      if (cur) depth++;
      continue;
    }
    if (p.name === 'END') {
      if (cur && p.value.toUpperCase() === 'VEVENT' && depth === 0) { out.push(finish(cur)); cur = null; }
      else if (cur) depth--;
      continue;
    }
    if (!cur || depth > 0) continue; // skip VALARM etc.
    switch (p.name) {
      case 'UID': cur.uid = p.value; break;
      case 'SUMMARY': cur.summary = unescapeText(p.value); break;
      case 'LOCATION': cur.location = unescapeText(p.value); break;
      case 'DESCRIPTION': cur.description = unescapeText(p.value); break;
      case 'STATUS': cur.status = p.value.toUpperCase(); break;
      case 'DTSTART': cur.start = parseDate(p.value, p.params, aliases); break;
      case 'DTEND': cur.end = parseDate(p.value, p.params, aliases); break;
      case 'DURATION': cur.duration = parseDuration(p.value); break;
      case 'RRULE': cur.rrule = parseRRule(p.value); break;
      case 'RECURRENCE-ID': cur.recurrenceId = parseDate(p.value, p.params, aliases); break;
      case 'EXDATE': for (const v of p.value.split(',')) { const d = parseDate(v, p.params, aliases); if (d) cur.exdates.push(d); } break;
      default: break;
    }
  }
  return out;
}
function finish(e) {
  if (!e.start) return e;
  if (!e.end) {
    if (e.duration) e.end = { ...e.start, ms: e.start.ms + e.duration };
    else e.end = { ...e.start, ms: e.start.ms + (e.start.allDay ? DAY : 0) };
  }
  e.length = Math.max(0, e.end.ms - e.start.ms);
  return e;
}

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const civil = (c) => Date.UTC(c.y, c.m - 1, c.d, c.h || 0, c.mi || 0, c.s || 0); // wall components as a UTC-ms "civil" clock
const fromCivil = (ms) => { const d = new Date(ms); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() }; };
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
// Occurrence instant for a civil (wall) start of the series.
const instant = (e, civ) => (e.start.allDay ? civ : e.start.tz === 'UTC' ? civ : zonedToUtc(fromCivil(civ), e.start.tz));

// Civil starts generated by the rule (sorted, starting at DTSTART), bounded by `toCivil` and 2,000 candidates.
function candidates(e, toCivil) {
  const r = e.rrule; const s = e.start.wall; const base = civil(s);
  const tod = (s.h || 0) * 3600e3 + (s.mi || 0) * 60e3 + (s.s || 0) * 1e3;
  const out = []; const MAX = 2000;
  const push = (c) => { if (c >= base) out.push(c); };
  if (r.freq === 'DAILY') {
    for (let c = base, i = 0; c <= toCivil && i < MAX; c += r.interval * DAY, i++) {
      const d = fromCivil(c);
      if (r.bymonth && !r.bymonth.includes(d.m)) continue;
      if (r.byday && !r.byday.some((b) => b.wd === new Date(c).getUTCDay())) continue;
      push(c);
    }
  } else if (r.freq === 'WEEKLY') {
    const days = r.byday?.length ? r.byday.map((b) => b.wd) : [new Date(base).getUTCDay()];
    const dow = (new Date(base).getUTCDay() + 6) % 7; // Monday = 0 (WKST=MO)
    let week = base - tod - dow * DAY;
    for (let i = 0; week <= toCivil && i < MAX; week += r.interval * 7 * DAY, i++) {
      for (const wd of [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))) push(week + ((wd + 6) % 7) * DAY + tod);
    }
  } else if (r.freq === 'MONTHLY' || r.freq === 'YEARLY') {
    const step = r.freq === 'MONTHLY' ? r.interval : 12 * r.interval;
    for (let k = 0, i = 0; i < MAX; k += step, i++) {
      const y = s.y + Math.floor((s.m - 1 + k) / 12); const m = ((s.m - 1 + k) % 12) + 1;
      if (Date.UTC(y, m - 1, 1) > toCivil) break;
      const months = r.freq === 'YEARLY' && r.bymonth ? r.bymonth : [m];
      for (const mm of months) {
        if (r.freq === 'MONTHLY' && r.bymonth && !r.bymonth.includes(mm)) continue;
        const dim = daysIn(y, mm); const days = [];
        if (r.bymonthday) r.bymonthday.forEach((d) => { const x = d > 0 ? d : dim + d + 1; if (x >= 1 && x <= dim) days.push(x); });
        else if (r.byday) {
          for (const b of r.byday) {
            const all = []; for (let d = 1; d <= dim; d++) if (new Date(Date.UTC(y, mm - 1, d)).getUTCDay() === b.wd) all.push(d);
            if (!b.n) days.push(...all); else { const x = b.n > 0 ? all[b.n - 1] : all[all.length + b.n]; if (x) days.push(x); }
          }
        } else if (s.d <= dim) days.push(s.d);
        [...new Set(days)].sort((a, b) => a - b).forEach((d) => push(Date.UTC(y, mm - 1, d) + tod));
      }
    }
  }
  return out.sort((a, b) => a - b);
}

// Concrete occurrences overlapping [fromMs, toMs).
export function expandEvents(events, fromMs, toMs) {
  const masters = events.filter((e) => e.start && !e.recurrenceId);
  const overrides = events.filter((e) => e.start && e.recurrenceId);
  const out = [];
  const overlaps = (s, len) => s < toMs && s + Math.max(len, 1) > fromMs;
  for (const e of masters) {
    if (e.status === 'CANCELLED') continue;
    if (!e.rrule || !e.rrule.freq) { if (overlaps(e.start.ms, e.length)) out.push(occ(e, e.start.ms, false)); continue; }
    const r = e.rrule;
    const ex = new Set(e.exdates.map((d) => (e.start.allDay || d.allDay ? ymd(d.ms) : d.ms)));
    const ov = new Set(overrides.filter((o) => o.uid === e.uid).map((o) => (e.start.allDay ? ymd(o.recurrenceId.ms) : o.recurrenceId.ms)));
    let until = Infinity;
    if (r.until) { const u = parseDate(r.until, e.start.allDay ? { VALUE: 'DATE' } : {}); if (u) until = u.allDay && !e.start.allDay ? u.ms + DAY - 1 : u.ms; }
    if (r.unsupported) { if (overlaps(e.start.ms, e.length)) out.push(occ(e, e.start.ms, true)); continue; }
    // Civil end of the window (+2 days slack for time zones); with COUNT the series is walked from its start.
    const toCivil = civil(fromCivil(toMs + 2 * DAY));
    const list = candidates(e, toCivil);
    let n = 0;
    for (const c of list) {
      const at = instant(e, c);
      if (at > until) break;
      n++;
      if (r.count && n > r.count) break;
      if (at >= toMs) break;
      const key = e.start.allDay ? ymd(at) : at;
      if (ex.has(key) || ov.has(key)) continue;
      if (overlaps(at, e.length)) out.push(occ(e, at, true));
    }
  }
  for (const o of overrides) if (o.status !== 'CANCELLED' && overlaps(o.start.ms, o.length)) out.push(occ(o, o.start.ms, true));
  return out.sort((a, b) => a.startMs - b.startMs);
}
function occ(e, startMs, recurring) {
  const endMs = startMs + e.length;
  const base = { uid: e.uid || '', title: e.summary || '', location: e.location || '', description: e.description || '', allDay: !!e.start.allDay, recurring: recurring || !!e.recurrenceId, startMs, endMs };
  if (base.allDay) return { ...base, start: ymd(startMs), end: ymd(Math.max(endMs, startMs + DAY)) };
  return { ...base, start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() };
}

// ---------- writing ----------
const pad = (n) => String(n).padStart(2, '0');
const utcStamp = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`; };
const dateVal = (s) => String(s).slice(0, 10).replace(/-/g, '');
export function fold(line) {
  const out = []; let cur = ''; let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
// fields: { uid, title, location, description, allDay, start, end } — timed start/end as ISO, all-day as YYYY-MM-DD (end exclusive).
function eventLines(f, now = Date.now()) {
  const l = [];
  if (f.allDay) {
    const end = f.end && f.end > f.start ? f.end : ymd(Date.parse(f.start + 'T00:00:00Z') + DAY);
    l.push(`DTSTART;VALUE=DATE:${dateVal(f.start)}`, `DTEND;VALUE=DATE:${dateVal(end)}`);
  } else {
    const s = Date.parse(f.start); const e = Date.parse(f.end || f.start);
    l.push(`DTSTART:${utcStamp(s)}`, `DTEND:${utcStamp(Math.max(e, s))}`);
  }
  l.push(`SUMMARY:${escapeText(f.title || '')}`);
  if (f.location) l.push(`LOCATION:${escapeText(f.location)}`);
  if (f.description) l.push(`DESCRIPTION:${escapeText(f.description)}`);
  l.push(`DTSTAMP:${utcStamp(now)}`, `LAST-MODIFIED:${utcStamp(now)}`);
  return l;
}
export function buildICS(f, now = Date.now()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nest//Nest Calendar//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${f.uid}`, `CREATED:${utcStamp(now)}`, ...eventLines(f, now), 'END:VEVENT', 'END:VCALENDAR'];
  return lines.map(fold).join('\r\n') + '\r\n';
}
// Replace the editable properties of the master VEVENT in an existing object, keeping everything else (alarms, attendees…).
const EDITABLE = new Set(['DTSTART', 'DTEND', 'DURATION', 'SUMMARY', 'LOCATION', 'DESCRIPTION', 'DTSTAMP', 'LAST-MODIFIED', 'SEQUENCE']);
export function patchICS(text, f, now = Date.now()) {
  const lines = unfold(text).filter((x) => x !== '');
  const out = []; let done = false; let block = null; let depth = 0; let seq = 0;
  for (const l of lines) {
    const p = parseLine(l);
    if (!block) {
      if (!done && p.name === 'BEGIN' && p.value.toUpperCase() === 'VEVENT') { block = []; depth = 0; seq = 0; continue; }
      out.push(l); continue;
    }
    if (p.name === 'BEGIN') { depth++; block.push({ l, nested: true }); continue; }
    if (p.name === 'END' && depth > 0) { depth--; block.push({ l, nested: true }); continue; }
    if (p.name === 'END' && p.value.toUpperCase() === 'VEVENT') {
      const isOverride = block.some((x) => !x.nested && parseLine(x.l).name === 'RECURRENCE-ID');
      if (isOverride) out.push('BEGIN:VEVENT', ...block.map((x) => x.l), l);
      else {
        const kept = block.filter((x) => x.nested || !EDITABLE.has(parseLine(x.l).name)).map((x) => x.l);
        out.push('BEGIN:VEVENT', ...eventLines(f, now), `SEQUENCE:${seq + 1}`, ...kept, l);
        done = true;
      }
      block = null; continue;
    }
    if (depth === 0 && p.name === 'SEQUENCE') seq = +p.value || 0;
    block.push({ l, nested: depth > 0 });
  }
  return out.map(fold).join('\r\n') + '\r\n';
}

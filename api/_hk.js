// Hong Kong public data for Nest (Node runtime, used by api/push/cron.js — no new function file; Hobby cap is 12/12).
// Public GET routes (no auth, no user data), rewritten in vercel.json: /api/hk/:op → /api/push/cron?op=hk-:op
//   warn      HKO warnings (warnsum + warningInfo) + EDB standing arrangement + class-suspension press releases.
//             Every call also runs the server-side "new warning" check (dedupe in Firestore system/hkWarn, compare-and-set)
//             and pushes NEW warnings to every subscribed user. The daily crons call it too.
//   weather   HKO rhrread + fnd + flw
//   holidays  1823 public holidays + EDB example school holidays
//   eta       ?items=kmb:1A:O:1:<stop>,ctb:1:O:<stop>,mtr:TWL:TST (≤ 6) + MTR line status
//   plan      ?from=TAW&to=SHT (MTR station codes) or ?q=<free text> → MTR route + live trains going your way + KMB routes
//             between the two places + bus ETAs (Transport tab, Home go-out card, /api/chat transport answers)
//   routes    ?co=kmb|ctb&route=1A → directions;  stops ?co=…&route=…&dir=O|I&svc=1 → stops;  mtr → lines + stations
// Responses carry s-maxage so Vercel's CDN absorbs repeat calls.
import { serviceAccount, serviceToken, fsGetRaw, fsSetIf, allSubscribers, pushTo, removeSub, vapidConfigured, langOf } from './_push-lib.js';
import { prefsOf, inQuietHours } from '../src/lib/prefs.js';
import { dispatchNest, dispatchSubs } from './_nest.js';
import { planMtr, trainsForLeg, transportQuery, linesAt, stationName, ST_CODES, SEQ_OF } from '../src/lib/transit.js';
import { normWarnsum, warnSig, newWarnings, schoolArrangement, suspensionItems, normWeather, parse1823, EDB_SCHOOL_HOLIDAYS, normBusEta, normMtr, parseMtrCsv, MTR_LINES } from '../src/lib/hk.js';

const HKO = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
const KMB = 'https://data.etabus.gov.hk/v1/transport/kmb';
const CTB = 'https://rt.data.gov.hk/v2/transport/citybus';
const MEM = new Map();

async function getJson(url, ms = 10000, text = false) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'user-agent': 'Nest-HK/1.0 (+https://nesty.cyou)' } });
    if (!r.ok) throw Object.assign(new Error(`upstream_${r.status}`), { status: 502 });
    const s = (await r.text()).replace(/^\ufeff/, '');
    return text ? s : JSON.parse(s);
  } finally { clearTimeout(t); }
}
// In-memory cache per isolate (+ in-flight dedupe).
async function cached(key, ttl, f) {
  const hit = MEM.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.p;
  const p = f().catch((e) => { if (MEM.get(key)?.p === p) MEM.delete(key); throw e; });
  MEM.set(key, { at: Date.now(), p });
  return p;
}
const L = (lang) => (lang === 'en' ? 'en' : 'tc');

// ---------------- warnings ----------------
const fetchWarn = (lang) => cached(`warn:${L(lang)}`, 45e3, async () => {
  const [sum, info] = await Promise.all([getJson(`${HKO}?dataType=warnsum&lang=${L(lang)}`), getJson(`${HKO}?dataType=warningInfo&lang=${L(lang)}`).catch(() => ({}))]);
  const det = Object.fromEntries((info.details || []).map((d) => [d.subtype || d.warningStatementCode, (d.contents || []).join(' ')]));
  const byGroup = Object.fromEntries((info.details || []).map((d) => [d.warningStatementCode, (d.contents || []).join(' ')]));
  return normWarnsum(sum).map((w) => ({ ...w, detail: String(det[w.code] || byGroup[w.group] || '').slice(0, 600) }));
});
const fetchSuspensions = (lang) => cached(`susp:${L(lang)}`, 5 * 60e3, async () => suspensionItems(await getJson(`https://www.info.gov.hk/gia/rss/general_${lang === 'en' ? 'en' : 'zh'}.xml`, 10000, true)));

export const warnTitle = (w, lang) => (lang === 'en' ? `${w.type ? `${w.type} ` : ''}${w.name}`.replace(/\s+/g, ' ') : `${w.name}${w.type && !w.name.includes(w.type) ? `（${w.type}）` : ''}`);

export async function warnPayload(lang = 'zh-Hant') {
  const warnings = await fetchWarn(lang);
  const serious = warnings.some((w) => w.sev >= 2);
  const suspension = serious ? await fetchSuspensions(lang).catch(() => []) : [];
  return { warnings, school: schoolArrangement(warnings, lang), suspension, at: Date.now() };
}

// Server-side "new warning" detection + family push. Safe to call from every client load: in-memory short-circuit when
// nothing changed in this isolate, Firestore compare-and-set so concurrent callers never push twice.
let lastSigs = null; let lastCheck = 0;
export async function checkWarnings({ force = false } = {}) {
  const sa = serviceAccount();
  if (!sa) return { checked: false, reason: 'no_service_account' };
  if (!force && Date.now() - lastCheck < 20e3) return { checked: false, reason: 'recent' };
  lastCheck = Date.now();
  const [tc, en] = await Promise.all([fetchWarn('zh-Hant'), fetchWarn('en')]);
  const sigs = tc.map(warnSig).sort();
  if (!force && lastSigs && lastSigs.join() === sigs.join()) return { checked: true, changed: false };
  const token = await serviceToken(sa);
  let fresh = [];
  for (let i = 0; i < 3; i++) {
    const doc = await fsGetRaw('system/hkWarn', token);
    const prev = Array.isArray(doc.data.sigs) ? doc.data.sigs : [];
    fresh = doc.exists ? newWarnings(tc, prev) : []; // first run ever: remember, don't push stale warnings
    if (prev.slice().sort().join() === sigs.join()) { lastSigs = sigs; return { checked: true, changed: false }; }
    const ok = await fsSetIf('system/hkWarn', { sigs, at: new Date(), codes: tc.map((w) => w.code) }, token, doc.updateTime);
    if (ok) break;
    if (i === 2) return { checked: true, changed: false, reason: 'contended' };
  }
  lastSigs = sigs;
  const push = fresh.filter((w) => w.sev >= 2);
  if (!push.length || !vapidConfigured()) return { checked: true, changed: true, new: fresh.map((w) => w.code), pushed: 0 };
  const enBy = Object.fromEntries(en.map((w) => [w.code, w]));
  const { profiles, subsByUid } = await allSubscribers(token);
  let pushed = 0;
  const severe = push.some((w) => w.sev >= 3);
  for (const [uid, subs] of subsByUid) {
    const p = prefsOf(profiles.get(uid));
    if (!p.pushEnabled || p.notifyWarnings === false) continue;
    if (inQuietHours(p) && !severe) continue;
    const lang = langOf(p.lang); const hans = p.lang === 'zh-Hans';
    const list = lang === 'en' ? push.map((w) => enBy[w.code] || w) : push;
    const school = schoolArrangement(lang === 'en' ? en : tc, lang);
    const w0 = list[0];
    const title = (lang === 'en' ? 'Weather warning: ' : '天氣警告：') + list.map((w) => warnTitle(w, lang)).join(lang === 'en' ? ' · ' : '、');
    const body = [school?.text, String(w0.detail || '').slice(0, 140)].filter(Boolean).join(' ').slice(0, 220);
    for (const s of subs) {
      const r = await pushTo(s, { title, body, url: '/app?warn=1', tag: `warn-${w0.code}`, lang, hans }, { urgency: severe ? 'high' : 'normal', TTL: 3 * 3600 });
      if (r === 'ok') pushed++;
      if (r === 'gone') { await removeSub(uid, s, token); break; }
    }
  }
  return { checked: true, changed: true, new: fresh.map((w) => w.code), pushed };
}

// ---------------- weather / holidays ----------------
const fetchWeather = (lang) => cached(`wx:${L(lang)}`, 5 * 60e3, async () => {
  const [rh, fnd, flw] = await Promise.all(['rhrread', 'fnd', 'flw'].map((t) => getJson(`${HKO}?dataType=${t}&lang=${L(lang)}`).catch(() => ({}))));
  return normWeather(rh, fnd, flw);
});
export const fetchHolidays = (lang) => cached(`hol:${L(lang)}`, 12 * 3600e3, async () => parse1823(await getJson(`https://www.1823.gov.hk/common/ical/${L(lang)}.json`, 12000)));

// ---------------- transport ----------------
const kmbRoutes = () => cached('kmb:routes', 12 * 3600e3, async () => (await getJson(`${KMB}/route/`, 15000)).data || []);
const kmbStops = () => cached('kmb:stops', 12 * 3600e3, async () => Object.fromEntries(((await getJson(`${KMB}/stop`, 20000)).data || []).map((s) => [s.stop, s])));
const ctbRoutes = () => cached('ctb:routes', 12 * 3600e3, async () => (await getJson(`${CTB}/route/ctb`, 15000)).data || []);
const ctbStop = (id) => cached(`ctb:stop:${id}`, 24 * 3600e3, async () => (await getJson(`${CTB}/stop/${id}`)).data || {});
const mtrLines = () => cached('mtr:lines', 24 * 3600e3, async () => parseMtrCsv(await getJson('https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv', 12000, true)));
const mtrStatus = () => cached('mtr:status', 60e3, async () => {
  const j = await getJson('https://tnews.mtr.com.hk/alert/ryg_line_status.json', 8000);
  return Object.fromEntries((j?.ryg_status?.line || []).map((l) => [l.line_code, { status: l.status, msg: String(l.messages || '').slice(0, 300) }]));
});
const R = (s) => String(s || '').toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
const ID = (s) => String(s || '').replace(/[^0-9A-Za-z]/g, '').slice(0, 24);

async function routes(co, route) {
  route = R(route);
  if (!route) return [];
  if (co === 'kmb') {
    return (await kmbRoutes()).filter((r) => r.route === route).map((r) => ({ dir: r.bound, svc: String(r.service_type), orig_tc: r.orig_tc, orig_en: r.orig_en, dest_tc: r.dest_tc, dest_en: r.dest_en }));
  }
  const r = (await ctbRoutes()).find((x) => x.route === route);
  if (!r) return [];
  const inbound = await getJson(`${CTB}/route-stop/ctb/${route}/inbound`).then((j) => (j.data || []).length > 0).catch(() => false);
  return [{ dir: 'O', svc: '1', orig_tc: r.orig_tc, orig_en: r.orig_en, dest_tc: r.dest_tc, dest_en: r.dest_en },
    ...(inbound ? [{ dir: 'I', svc: '1', orig_tc: r.dest_tc, orig_en: r.dest_en, dest_tc: r.orig_tc, dest_en: r.orig_en }] : [])];
}
async function stops(co, route, dir, svc) {
  route = R(route); const d = dir === 'I' ? 'inbound' : 'outbound';
  if (co === 'kmb') {
    const [rs, all] = await Promise.all([getJson(`${KMB}/route-stop/${route}/${d}/${Number(svc) || 1}`), kmbStops()]);
    return (rs.data || []).map((x) => ({ id: x.stop, seq: +x.seq, tc: all[x.stop]?.name_tc || x.stop, en: all[x.stop]?.name_en || x.stop }));
  }
  const rs = await getJson(`${CTB}/route-stop/ctb/${route}/${d}`);
  return Promise.all((rs.data || []).map(async (x) => { const s = await ctbStop(x.stop).catch(() => ({})); return { id: x.stop, seq: +x.seq, tc: s.name_tc || x.stop, en: s.name_en || x.stop }; }));
}
async function eta(itemsParam) {
  const items = String(itemsParam || '').split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6);
  const out = await Promise.all(items.map(async (key) => {
    const p = key.split(':');
    try {
      if (p[0] === 'kmb') {
        const [, route, dir, svc, stop] = p;
        const j = await cached(`eta:${key}`, 15e3, () => getJson(`${KMB}/eta/${ID(stop)}/${R(route)}/${Number(svc) || 1}`, 8000));
        return { key, etas: normBusEta(j, { route: R(route), dir: dir === 'I' ? 'I' : 'O' }) };
      }
      if (p[0] === 'ctb') {
        const [, route, dir, stop] = p;
        const j = await cached(`eta:${key}`, 15e3, () => getJson(`${CTB}/eta/ctb/${ID(stop)}/${R(route)}`, 8000));
        return { key, etas: normBusEta(j, { route: R(route), dir: dir === 'I' ? 'I' : 'O' }) };
      }
      if (p[0] === 'mtr') {
        const line = R(p[1]); const sta = R(p[2]);
        if (!MTR_LINES[line]) return { key, error: 'bad_line' };
        const j = await cached(`eta:${key}`, 15e3, () => getJson(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${sta}`, 8000));
        return { key, mtr: normMtr(j, line, sta) };
      }
      return { key, error: 'bad_item' };
    } catch (e) { return { key, error: 'upstream' }; }
  }));
  const needStatus = items.some((k) => k.startsWith('mtr:'));
  const status = needStatus ? await mtrStatus().catch(() => null) : null;
  return { items: out, mtrStatus: status, at: Date.now() };
}

// ---------------- trip planner (MTR route + KMB buses between two places) ----------------
const kmbRouteStops = () => cached('kmb:routestops', 12 * 3600e3, async () => {
  const j = await getJson(`${KMB}/route-stop`, 20000);
  const g = new Map();
  (j.data || []).forEach((x) => { const k = `${x.route}|${x.bound}|${x.service_type}`; if (!g.has(k)) g.set(k, []); g.get(k).push([+x.seq, x.stop]); });
  g.forEach((l) => l.sort((a, b) => a[0] - b[0]));
  return g;
});
const placeMatch = (code) => { const tc = stationName(code); const en = stationName(code, 'en').toUpperCase(); return (s) => !!s && (String(s.name_tc || '').includes(tc) || String(s.name_en || '').toUpperCase().includes(en)); };
async function mtrSchedule(line, sta) {
  const j = await cached(`eta:mtr:${line}:${sta}`, 15e3, () => getJson(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${line}&sta=${sta}`, 6000));
  return normMtr(j, line, sta);
}
async function kmbEta(route, svc, stop, dir) {
  const j = await cached(`eta:kmb:${route}:${svc}:${stop}`, 15e3, () => getJson(`${KMB}/eta/${ID(stop)}/${R(route)}/${Number(svc) || 1}`, 6000));
  return normBusEta(j, { route: R(route), dir }).map((x) => x.t);
}
async function busesBetween(from, to, lang, max = 6) {
  const [g, all, rts] = await Promise.all([kmbRouteStops(), kmbStops(), kmbRoutes()]);
  const mf = placeMatch(from); const mt = to ? placeMatch(to) : null;
  const found = [];
  for (const [k, list] of g) {
    const [route, bound, svc] = k.split('|');
    const i = list.findIndex(([, st]) => mf(all[st]));
    if (i < 0) continue;
    if (mt && !list.slice(i + 1).some(([, st]) => mt(all[st]))) continue;
    found.push({ route, bound, svc, stop: list[i][1], n: mt ? list.slice(i + 1).findIndex(([, st]) => mt(all[st])) + 1 : 0 });
  }
  // One row per route+direction (main service first), fewest stops first.
  const uniq = new Map();
  found.sort((a, b) => (a.svc === '1' ? 0 : 1) - (b.svc === '1' ? 0 : 1) || a.n - b.n).forEach((x) => { const k = `${x.route}|${x.bound}`; if (!uniq.has(k)) uniq.set(k, x); });
  const rows = [...uniq.values()].sort((a, b) => a.n - b.n || a.route.localeCompare(b.route, 'en', { numeric: true })).slice(0, max);
  return Promise.all(rows.map(async (x) => {
    const r = rts.find((y) => y.route === x.route && y.bound === x.bound && String(y.service_type) === x.svc) || {};
    const etas = await kmbEta(x.route, x.svc, x.stop, x.bound).catch(() => []);
    const st = all[x.stop] || {};
    return { co: 'kmb', route: x.route, dir: x.bound, svc: x.svc, stopId: x.stop, stop: lang === 'en' ? st.name_en : st.name_tc, dest: lang === 'en' ? r.dest_en : r.dest_tc, stops: x.n, minutes: x.n ? Math.round(x.n * 1.8 + 1) : 0, etas: etas.slice(0, 3) };
  }));
}
export async function planTrip({ from, to, q, lang = 'zh-Hant', buses = true }) {
  const now = Date.now();
  let query = null;
  if (q) { query = transportQuery(q); if (query?.kind === 'mtr') { from = query.from; to = query.to; } }
  const out = { at: now, from: from || '', to: to || '', query };
  const valid = (c) => ST_CODES.includes(c);
  if (from && to && valid(from) && valid(to) && from !== to) {
    const plan = planMtr(from, to);
    if (plan) {
      const legs = plan.legs.map((l) => ({ ...l, towards: l.line === 'WALK' ? '' : (() => { const v = Object.values(SEQ_OF(l.line)).find((s) => s.includes(l.from) && s.includes(l.to)) || []; return l.dir === 'fwd' ? v[v.length - 1] : v[0]; })() }));
      out.plan = { ...plan, legs };
      const first = legs.find((l) => l.line !== 'WALK');
      const [sched, status] = await Promise.all([mtrSchedule(first.line, first.from).catch(() => null), mtrStatus().catch(() => null)]);
      out.trains = sched ? trainsForLeg(sched, first, now).slice(0, 4) : [];
      const st = status?.[first.line];
      if (st) { out.status = st.status; out.statusMsg = st.msg; }
    }
    // Cold instance: the KMB route-stop list (~3 MB) may take longer than we want to wait. Then buses = null
    // ("still loading", short CDN cache) and the client asks again a few seconds later; the download keeps going.
    if (buses) { out.buses = await Promise.race([busesBetween(from, to, lang).catch(() => []), new Promise((r) => setTimeout(() => r(null), 6000))]); if (out.buses === null) out.busesPending = true; }
  } else if (query?.kind === 'station' || (from && valid(from) && !to)) {
    const code = query?.at || from;
    const rows = (await Promise.all(linesAt(code).map(async (line) => { const m = await mtrSchedule(line, code).catch(() => null); return [...(m?.UP || []), ...(m?.DOWN || [])].map((x) => ({ ...x, line })); }))).flat().filter((x) => x.t >= now - 30e3).sort((a, b) => a.t - b.t);
    out.station = { code, rows: rows.slice(0, 10) };
  }
  if (query?.kind === 'bus' && query.route) {
    const route = R(query.route);
    const [g, all, rts] = await Promise.all([kmbRouteStops(), kmbStops(), kmbRoutes()]);
    const mf = query.near ? placeMatch(query.near) : null;
    const rows = [];
    for (const bound of ['O', 'I']) {
      const list = g.get(`${route}|${bound}|1`); if (!list) continue;
      const hit = mf ? list.find(([, st]) => mf(all[st])) : list[0];
      if (!hit) continue;
      const r = rts.find((y) => y.route === route && y.bound === bound && String(y.service_type) === '1') || {};
      rows.push({ co: 'kmb', route, dir: bound, svc: '1', stopId: hit[1], stop: lang === 'en' ? all[hit[1]]?.name_en : all[hit[1]]?.name_tc, dest: lang === 'en' ? r.dest_en : r.dest_tc, etas: (await kmbEta(route, '1', hit[1], bound).catch(() => [])).slice(0, 3) });
    }
    out.buses = rows;
    if (!rows.length) out.note = `KMB route ${route} was not found${query.near ? ` near ${stationName(query.near, 'en')}` : ''} (Citybus routes are not searched by name yet).`;
  }
  return out;
}

// ---------------- router ----------------
function sendCached(res, status, body, sMaxAge) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', status === 200 && sMaxAge ? `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge}` : 'no-store');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(body));
}
export async function hkRoute(op, q, res) {
  const lang = q.get('lang') === 'en' ? 'en' : 'zh-Hant';
  try {
    if (op === 'hk-warn') {
      // Any client hit also dispatches due Nest event reminders (Hobby crons are daily only).
      const [payload, check] = await Promise.all([warnPayload(lang), checkWarnings().catch((e) => ({ checked: false, reason: String(e.message || 'error').slice(0, 60) })), dispatchNest().catch(() => null), dispatchSubs().catch(() => null)]);
      return sendCached(res, 200, { ...payload, check: { checked: !!check.checked, pushed: check.pushed || 0 } }, 30);
    }
    // Public, idempotent trigger for an external pinger: warnings check + due event reminders. Returns counts only.
    if (op === 'hk-tick') {
      const [w, n, sd] = await Promise.all([checkWarnings().catch(() => ({})), dispatchNest().catch(() => ({})), dispatchSubs().catch(() => ({}))]);
      return sendCached(res, 200, { ok: true, warnPushed: w.pushed || 0, reminders: n.sent || 0, subDecisions: { notified: sd.notified || 0, sent: sd.sent || 0 } }, 0);
    }
    if (op === 'hk-weather') return sendCached(res, 200, await fetchWeather(lang), 300);
    if (op === 'hk-holidays') {
      const pub = await fetchHolidays(lang).catch(() => []);
      return sendCached(res, 200, { publicHolidays: pub, school: EDB_SCHOOL_HOLIDAYS, source: 'https://www.1823.gov.hk/common/ical/' }, 6 * 3600);
    }
    if (op === 'hk-eta') return sendCached(res, 200, await eta(q.get('items')), 10);
    if (op === 'hk-plan') { const pl = await planTrip({ from: R(q.get('from')), to: R(q.get('to')), q: String(q.get('q') || '').slice(0, 300), lang, buses: q.get('buses') !== '0' }); return sendCached(res, 200, pl, pl.busesPending ? 2 : 15); }
    if (op === 'hk-routes') return sendCached(res, 200, { routes: await routes(q.get('co') === 'ctb' ? 'ctb' : 'kmb', q.get('route')) }, 6 * 3600);
    if (op === 'hk-stops') return sendCached(res, 200, { stops: await stops(q.get('co') === 'ctb' ? 'ctb' : 'kmb', q.get('route'), q.get('dir'), q.get('svc')) }, 6 * 3600);
    if (op === 'hk-mtr') {
      const [lines, status] = await Promise.all([mtrLines(), mtrStatus().catch(() => null)]);
      return sendCached(res, 200, { lines: lines.filter((l) => MTR_LINES[l.line]).map((l) => ({ ...l, tc: MTR_LINES[l.line][0], en: MTR_LINES[l.line][1] })), status }, 600);
    }
    return sendCached(res, 404, { error: 'not_found' });
  } catch (e) {
    return sendCached(res, e.status && e.status < 600 ? e.status : 502, { error: String(e.message || 'error').split(' ')[0] });
  }
}

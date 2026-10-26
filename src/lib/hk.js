// Hong Kong public data — shared by the server (api/_hk.js) and the app. Pure helpers + thin client calls to /api/hk/*.
// Sources (all live public data, no keys):
//   HKO open data  https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum|warningInfo|rhrread|fnd|flw&lang=en|tc
//   KMB            https://data.etabus.gov.hk/v1/transport/kmb/…
//   Citybus        https://rt.data.gov.hk/v2/transport/citybus/…
//   MTR            https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php · https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv
//                  line status https://tnews.mtr.com.hk/alert/ryg_line_status.json (no CORS → via server)
//   1823 holidays  https://www.1823.gov.hk/common/ical/en.json | tc.json (no CORS → via server)
//   EDB            example school calendar 2026/27 (PDF, hard-coded below) · class-suspension press releases from
//                  https://www.info.gov.hk/gia/rss/general_en.xml | general_zh.xml

const HK = 8 * 3600e3;
export const hkKey = (ms = Date.now()) => new Date(ms + HK).toISOString().slice(0, 10);
export const hkHM = (ms) => new Date(ms + HK).toISOString().slice(11, 16);
const dayMs = (key) => Date.parse(`${key}T00:00:00Z`) - HK;

// "Sun 2026-10-18 8:15 AM HKT (UTC+08:00)" → ms
export function hkoTime(s) {
  const m = /(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(s || ''));
  if (!m) { const t = Date.parse(s); return Number.isFinite(t) ? t : 0; }
  let h = +m[4]; const ap = (m[6] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], h, +m[5]) - HK;
}

// ---------- warnings ----------
// Severity: 3 = severe (always push, even in quiet hours), 2 = push, 1 = banner only.
const SEV = {
  TC1: 1, TC3: 2, TC8NE: 3, TC8SE: 3, TC8NW: 3, TC8SW: 3, TC9: 3, TC10: 3, PRE8: 3,
  WRAINA: 2, WRAINR: 3, WRAINB: 3, WTMW: 3, WL: 2, WFNTSA: 2, WHOT: 2, WCOLD: 2, WMSGNL: 1, WTS: 1, WFIREY: 1, WFIRER: 1, WFROST: 1,
};
export const sevOf = (code) => SEV[code] ?? 1;
// warnsum JSON → [{ group, code, name, type, action, issued, updated, sev }] (cancelled ones dropped).
export function normWarnsum(j = {}) {
  return Object.entries(j || {}).map(([group, w]) => ({
    group, code: w.code || group, name: w.name || group, type: w.type || '', action: w.actionCode || '',
    issued: hkoTime(w.issueTime), updated: hkoTime(w.updateTime), sev: sevOf(w.code || group),
  })).filter((w) => w.action !== 'CANCEL').sort((a, b) => b.sev - a.sev || b.issued - a.issued);
}
// Signature of a warning instance: a new code (upgrade amber→red, T3→T8) or a fresh issue time is a NEW warning.
export const warnSig = (w) => `${w.code}|${w.issued}`;
export function newWarnings(current, previousSigs = []) {
  const prev = new Set(previousSigs);
  const prevCodes = new Set(previousSigs.map((x) => String(x).split('|')[0]));
  return current.filter((w) => !prev.has(warnSig(w)) && !(prevCodes.has(w.code) && ['EXTEND', 'UPDATE'].includes(w.action)));
}
// EDB standing arrangements (EDB Circulars 5/2022 + 6/2022). Not a substitute for the EDB announcement.
export function schoolArrangement(warnings = [], lang = 'zh-Hant') {
  const zh = lang !== 'en';
  const codes = new Set(warnings.map((w) => w.code));
  const tc8 = [...codes].some((c) => /^TC(8|9|10)|PRE8/.test(c));
  if (tc8) return { level: 3, text: zh ? '八號或以上信號：全港學校停課（教育局安排）。' : 'Signal No. 8 or above: classes of all schools are suspended (EDB).' };
  if (codes.has('WRAINB')) return { level: 3, text: zh ? '黑色暴雨警告：未出門的學生留在家中；在校學生留校至安全才離開。請留意教育局宣布。' : 'Black Rainstorm: students not yet out stay home; those at school stay until it is safe. Watch for EDB announcements.' };
  if (codes.has('WRAINR')) return { level: 2, text: zh ? '紅色暴雨警告：或會停課，請留意教育局及學校宣布。' : 'Red Rainstorm: classes may be suspended — watch for EDB and school announcements.' };
  if (codes.has('TC3')) return { level: 2, text: zh ? '三號強風信號：幼稚園及特殊學校停課，其他學校照常上課。' : 'Strong Wind Signal No. 3: kindergartens and special schools suspended; other schools as usual.' };
  return null;
}
export const EDB_WEATHER_URL = (lang) => `https://www.edb.gov.hk/${lang === 'en' ? 'en' : 'tc'}/sch-admin/admin/about-sch/sch-safety/weather/index.html`;
export const HKO_WARN_URL = (lang) => (lang === 'en' ? 'https://www.hko.gov.hk/en/wxinfo/warn/warn.htm' : 'https://www.hko.gov.hk/tc/wxinfo/warn/warn.htm');
// Government press-release RSS → class-suspension items from the last 18 h.
const SUSPEND_RE = /停課|暫停上課|上課安排|classes?\b[^<]{0,60}\bsuspend|suspension of classes|school(ing)? arrangements?/i;
export function suspensionItems(rss = '', now = Date.now()) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(rss))) {
    const title = (/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/.exec(m[1]) || /<title>([\s\S]*?)<\/title>/.exec(m[1]) || [])[1] || '';
    const link = (/<link>([\s\S]*?)<\/link>/.exec(m[1]) || [])[1] || '';
    const at = Date.parse((/<pubDate>([\s\S]*?)<\/pubDate>/.exec(m[1]) || [])[1] || '');
    if (SUSPEND_RE.test(title) && Number.isFinite(at) && now - at < 18 * 3600e3) out.push({ title: title.trim().slice(0, 200), link: link.trim(), at });
  }
  return out.slice(0, 3);
}

// ---------- weather ----------
export function normWeather(rh = {}, fnd = {}, flw = {}, now = Date.now()) {
  const temps = rh.temperature?.data || [];
  const hko = temps.find((x) => /Observatory|天文台/.test(x.place)) || temps[0];
  const hum = rh.humidity?.data?.[0]?.value;
  // fnd (9-day forecast) starts TOMORROW; today's outlook is the local forecast text (flw).
  const days = (fnd.weatherForecast || []).map((d) => ({ date: `${d.forecastDate.slice(0, 4)}-${d.forecastDate.slice(4, 6)}-${d.forecastDate.slice(6, 8)}`, min: d.forecastMintemp?.value, max: d.forecastMaxtemp?.value, psr: d.PSR || '', desc: d.forecastWeather || '', icon: d.ForecastIcon }));
  const tk = hkKey(now); const tm = hkKey(now + 864e5);
  return {
    temp: hko?.value ?? null, humidity: hum ?? null, icon: (rh.icon || [])[0] ?? null, updated: hkoTime(rh.updateTime),
    uv: rh.uvindex?.data?.[0]?.desc || '', forecast: flw.forecastDesc || '', outlook: flw.outlook || '',
    today: days.find((d) => d.date === tk) || null, tomorrow: days.find((d) => d.date === tm) || null, days: days.slice(0, 3),
  };
}
// One short line: "31° · 明天 26–32° · 降雨概率 低"
export function weatherLine(w, t) {
  if (!w) return '';
  const d = w.today || w.tomorrow;
  return [w.temp != null ? `${w.temp}°` : '', d ? `${w.today ? '' : `${t('common.tomorrow')} `}${d.min}–${d.max}°` : '', d?.psr ? `${t('today.rain')} ${d.psr}` : ''].filter(Boolean).join(' · ');
}

// ---------- holidays ----------
// 1823 iCal-as-JSON → [{ date, end, name }] (end exclusive).
export function parse1823(j) {
  const ev = j?.vcalendar?.[0]?.vevent || [];
  const k = (v) => { const s = Array.isArray(v) ? v[0] : v; return /^\d{8}$/.test(String(s)) ? `${String(s).slice(0, 4)}-${String(s).slice(4, 6)}-${String(s).slice(6, 8)}` : ''; };
  return ev.map((e) => ({ date: k(e.dtstart), end: k(e.dtend) || '', name: String(e.summary || '').trim() })).filter((x) => x.date);
}
// EDB "Example of a Whole-day School Calendar (2026/27)" long breaks. Schools set their own dates — shown as a guide.
export const EDB_SCHOOL_HOLIDAYS = [
  { date: '2026-12-24', end: '2027-01-03', en: 'Christmas & New Year holidays (EDB example)', tc: '聖誕及新年假期（教育局參考）' },
  { date: '2027-02-04', end: '2027-02-14', en: 'Lunar New Year holidays (EDB example)', tc: '農曆新年假期（教育局參考）' },
  { date: '2027-03-24', end: '2027-04-01', en: 'Easter holidays (EDB example)', tc: '復活節假期（教育局參考）' },
  { date: '2027-07-09', end: '2027-09-01', en: 'Summer vacation (EDB example)', tc: '暑假（教育局參考）' },
];
export const EDB_CAL_URL = 'https://www.edb.gov.hk/en/curriculum-development/resource-support/guidelines-sch-calendar/index.html';
// Calendar events for the Calendar tab.
export function holidayEvents({ publicHolidays = [], school = EDB_SCHOOL_HOLIDAYS }, lang = 'zh-Hant') {
  const pub = publicHolidays.map((h) => ({ id: `hk|public|${h.date}`, source: 'hk', account: 'hk', calKey: 'hk|public', title: h.name, allDay: true, start: h.date, end: h.end || '', editable: false }));
  const sch = school.map((h) => ({ id: `hk|school|${h.date}`, source: 'hk', account: 'hk', calKey: 'hk|school', title: lang === 'en' ? h.en : h.tc, allDay: true, start: h.date, end: h.end, editable: false }));
  return [...pub, ...sch];
}
export function upcomingHolidays(publicHolidays = [], now = Date.now(), days = 7) {
  const lo = dayMs(hkKey(now)); const hi = lo + days * 864e5;
  return publicHolidays.filter((h) => { const t = dayMs(h.date); return t >= lo && t < hi; }).map((h) => ({ ...h, inDays: Math.round((dayMs(h.date) - lo) / 864e5) }));
}

// ---------- transport ----------
// Normalised ETA rows: { t (ms), dest, rmk } sorted by time.
export function normBusEta(j, { route, dir } = {}) {
  return (j?.data || []).filter((x) => x.eta && (!route || x.route === route) && (!dir || x.dir === dir))
    .map((x) => ({ t: Date.parse(x.eta) || hkoTime(x.eta), dest_tc: x.dest_tc, dest_en: x.dest_en, rmk_tc: x.rmk_tc || '', rmk_en: x.rmk_en || '' }))
    .filter((x) => x.t).sort((a, b) => a.t - b.t);
}
// getSchedule.php → { UP: [...], DOWN: [...] } with t (ms) and destination station code.
export function normMtr(j, line, sta) {
  const d = j?.data?.[`${line}-${sta}`] || {};
  const map = (arr) => (arr || []).filter((x) => x.valid !== 'N').map((x) => ({ t: Date.parse(`${String(x.time).replace(' ', 'T')}+08:00`), dest: x.dest, plat: x.plat })).filter((x) => x.t);
  return { UP: map(d.UP), DOWN: map(d.DOWN), delay: j?.isdelay === 'Y', ok: j?.status === 1 || j?.status === '1' };
}
export function parseMtrCsv(csv = '') {
  const rows = String(csv).replace(/^\ufeff/, '').trim().split(/\r?\n/).slice(1).map((l) => l.match(/("([^"]*)"|[^,]+)/g)?.map((x) => x.replace(/^"|"$/g, '')) || []);
  const lines = {};
  rows.forEach(([line, dir, code, , tc, en, seq]) => {
    if (!line || !code) return;
    const L = (lines[line] ||= { line, stations: [], seen: new Set() });
    if (!L.seen.has(code)) { L.seen.add(code); L.stations.push({ code, tc, en, seq: +seq }); }
  });
  return Object.values(lines).map(({ line, stations }) => ({ line, stations }));
}
export const MTR_LINES = {
  AEL: ['機場快綫', 'Airport Express'], TCL: ['東涌綫', 'Tung Chung Line'], TML: ['屯馬綫', 'Tuen Ma Line'], TKL: ['將軍澳綫', 'Tseung Kwan O Line'],
  EAL: ['東鐵綫', 'East Rail Line'], SIL: ['南港島綫', 'South Island Line'], TWL: ['荃灣綫', 'Tsuen Wan Line'], ISL: ['港島綫', 'Island Line'],
  KTL: ['觀塘綫', 'Kwun Tong Line'], DRL: ['迪士尼綫', 'Disneyland Resort Line'],
};

// Suggested leave time. etas: sorted ms. walk: minutes to the stop. arriveBy 'HH:MM' + journey minutes (optional).
// Returns { leaveAt, catchAt, late } or null.
export function leavePlan(etas = [], { walk = 5, arriveBy = '', journey = 0 } = {}, now = Date.now()) {
  const w = Math.max(0, Number(walk) || 0) * 60e3;
  const reach = etas.filter((t) => t >= now + w);
  if (!reach.length) return null;
  if (/^\d{2}:\d{2}$/.test(arriveBy) && Number(journey) > 0) {
    const today = hkKey(now);
    let target = dayMs(today) + (+arriveBy.slice(0, 2)) * 3600e3 + (+arriveBy.slice(3)) * 60e3;
    if (target < now) target += 864e5;
    // "Arrive by" only steers the next ~3 hours (a school-run time shouldn't decide an afternoon trip).
    if (target - now > 3 * 3600e3) return { catchAt: reach[0], leaveAt: reach[0] - w, late: false };
    const latest = target - Number(journey) * 60e3;
    const ok = reach.filter((t) => t <= latest);
    if (ok.length) { const c = ok[ok.length - 1]; return { catchAt: c, leaveAt: c - w, late: false }; }
    return { catchAt: reach[0], leaveAt: reach[0] - w, late: reach[0] > latest };
  }
  return { catchAt: reach[0], leaveAt: reach[0] - w, late: false };
}

// ---------- client calls ----------
const cache = new Map();
export async function hkGet(op, params = {}, { maxAge = 0 } = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `/api/hk/${op}${qs ? `?${qs}` : ''}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < maxAge) return hit.data;
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || `http_${r.status}`), { code: j.error || `http_${r.status}` });
    cache.set(url, { at: Date.now(), data: j });
    return j;
  } finally { clearTimeout(timer); }
}
// Go-out item ids: "kmb:<route>:<O|I>:<svc>:<stop>", "ctb:<route>:<O|I>:<stop>", "mtr:<LINE>:<STA>"
export const goItemKey = (x) => (x.co === 'mtr' ? `mtr:${x.line}:${x.sta}` : x.co === 'kmb' ? `kmb:${x.route}:${x.dir}:${x.svc || 1}:${x.stop}` : `ctb:${x.route}:${x.dir}:${x.stop}`);

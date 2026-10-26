// Region helpers (Run 11). Pure functions shared by the app, the onboarding / Settings picker and api/chat.js.
import { COUNTRIES } from './countries.js';
import { PACKS, GLOBAL, EU_BASE, EU, EURO } from './packs.js';
import { HOLIDAYS } from './holidays.js';

export { COUNTRIES, PACKS };
const BY = new Map(COUNTRIES.map((r) => [r[0], r]));
export const isRegion = (c) => typeof c === 'string' && BY.has(c.toUpperCase());
export const normRegion = (c) => { const x = String(c || '').trim().toUpperCase(); return BY.has(x) ? x : ''; };
export const regionRow = (c) => BY.get(normRegion(c)) || null;

// Display name in the UI language ('en' | 'zh-Hant' | 'zh-Hans').
export function regionName(code, lang = 'en') {
  const r = regionRow(code); if (!r) return '';
  return lang === 'zh-Hans' ? r[5] : lang === 'zh-Hant' || lang === 'zh' ? r[4] : r[3];
}
// Flag emoji from regional-indicator symbols (every ISO alpha-2 code has one).
export const flagOf = (code) => { const c = normRegion(code); return c ? String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '🌐'; };

// Search aliases besides the code and the three names.
const ALIAS = {
  GB: 'uk britain england scotland wales great britain 英國 英国', US: 'usa america united states 美國 美国', HK: 'hongkong hksar 香港特別行政區 中國香港',
  MO: 'macau 澳門特別行政區 澳门', TW: 'taiwan 臺灣 台灣 台湾', KR: 'korea south korea 韓國 韩国 南韓', KP: 'korea north korea 朝鮮 北韓',
  AE: 'uae emirates 阿聯酋', NL: 'holland', CZ: 'czech republic', CN: 'prc mainland china 中國內地 中国大陆', RU: 'russia', VN: 'vietnam 越南',
  MY: 'malaysia 大馬', SG: 'singapore 星加坡', AU: 'australia 澳大利亞 澳大利亚 澳洲', NZ: 'new zealand 新西蘭 紐西蘭',
};
export function regionSearch(q, lang = 'en') {
  const k = String(q || '').trim().toLowerCase();
  const list = COUNTRIES.map((r) => ({ code: r[0], name: regionName(r[0], lang), hay: `${r[0]} ${r[3]} ${r[4]} ${r[5]} ${ALIAS[r[0]] || ''}`.toLowerCase() }));
  const sorted = list.sort((a, b) => a.name.localeCompare(b.name, lang === 'en' ? 'en' : lang === 'zh-Hans' ? 'zh-Hans-u-co-pinyin' : 'zh-Hant-u-co-stroke'));
  if (!k) return sorted;
  const exact = []; const starts = []; const has = [];
  for (const x of sorted) {
    if (x.code.toLowerCase() === k || (ALIAS[x.code] || '').toLowerCase().split(' ').includes(k) || x.name.toLowerCase() === k) exact.push(x);
    else if (x.name.toLowerCase().startsWith(k)) starts.push(x); else if (x.hay.includes(k)) has.push(x);
  }
  return [...exact, ...starts, ...has];
}

// The pack for a region: its own pack, else the EU base for EU members, else GLOBAL. Always returns an object with id.
export function packFor(code) {
  const c = normRegion(code);
  if (c && PACKS[c]) return { ...GLOBAL, ...PACKS[c], id: c, hasPack: true, live: { ...(PACKS[c].live || {}) } };
  if (c && EU.includes(c)) return { ...EU_BASE, id: c, hasPack: false, eu: true, currency: EURO.includes(c) ? 'EUR' : '' };
  return { ...GLOBAL, id: c || 'GLOBAL', hasPack: false };
}
// Hong Kong-only live features (MTR/KMB transport, HKO warnings + weather, 1823 holidays, go-out card, EDB school notices).
export const hkFeatures = (code) => normRegion(code) === 'HK';

// Static nationwide holidays for packs with source 'static' (upcoming first). HK is never served from here.
export function staticHolidays(code, from = Date.now(), days = 400) {
  const c = normRegion(code); const rows = HOLIDAYS[c] || [];
  const a = new Date(from - 864e5).toISOString().slice(0, 10); const b = new Date(from + days * 864e5).toISOString().slice(0, 10);
  return rows.filter(([d]) => d >= a && d <= b).map(([date, name, localName]) => ({ date, name, localName }));
}

// Suggest a region from the browser (time zone first, then the language tag's region). Never saved without the user's tap.
const TZ = {
  'Asia/Hong_Kong': 'HK', 'Asia/Macau': 'MO', 'Asia/Shanghai': 'CN', 'Asia/Chongqing': 'CN', 'Asia/Urumqi': 'CN', 'Asia/Taipei': 'TW', 'Asia/Singapore': 'SG',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Kuching': 'MY',
  'Europe/London': 'GB', 'Europe/Berlin': 'DE', 'Europe/Paris': 'FR', 'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Dublin': 'IE',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Hobart': 'AU', 'Australia/Darwin': 'AU',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA', 'America/St_Johns': 'CA', 'America/Regina': 'CA',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US', 'America/Detroit': 'US',
  'Asia/Bangkok': 'TH', 'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Dubai': 'AE', 'Pacific/Auckland': 'NZ',
};
export function suggestRegion({ tz, languages } = {}) {
  try { tz = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone; } catch {}
  if (tz && TZ[tz]) return TZ[tz];
  const langs = languages ?? (typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []);
  for (const l of langs || []) { const m = String(l || '').match(/[-_]([A-Za-z]{2})\b/); if (m && isRegion(m[1])) return m[1].toUpperCase(); }
  return '';
}

// The active region of this device's signed-in user (set by the session; read by lib/ai.js for every AI call).
let active = '';
export const setActiveRegion = (c) => { active = normRegion(c); };
export const getActiveRegion = () => active;

const DAY = { 1: 'Monday', 7: 'Sunday', 6: 'Saturday' };
const UNITS = { metric: 'metric units (km, kg)', imperial: 'US customary units (miles, pounds, inches)', uk: 'metric units, but miles / mph for road distances and speeds' };
// One compact English block for the AI system prompt (~400–700 chars). Never assumes Hong Kong for other regions.
export function regionContext(code, { tz } = {}) {
  const c = normRegion(code);
  if (!c) return 'User\'s country/region: not set. Do not assume a country; ask if location matters (holidays, transport, exams, emergency numbers).';
  const p = packFor(c);
  const name = regionName(c, 'en');
  const fmt = (() => { try { return new Intl.DateTimeFormat(p.locale || 'en', { dateStyle: 'short' }).format(new Date(Date.UTC(2026, 9, 19, 12))); } catch { return ''; } })();
  const em = p.emergency?.note || '';
  const parts = [
    `User's country/region: ${name} (${c}).`,
    `Conventions: ${UNITS[p.units] || UNITS.metric}, temperatures in °${p.temp}; date style like ${fmt || 'the local format'}${p.clock === '12h' ? ', 12-hour clock' : ', 24-hour clock'}; week starts ${DAY[p.firstDay] || 'Monday'}${p.currency ? `; currency ${p.currency}` : ''}.`,
    em ? `Emergency: ${em}` : '',
    p.exams?.length ? `School exams: ${p.exams.join('; ')}${p.grades ? ` (${p.grades})` : ''}.` : '',
    p.school?.hint ? `School year: ${p.school.hint}` : '',
    p.transport?.length ? `Local transport links: ${p.transport.map((x) => x.label).join(', ')}.` : '',
    p.weather && !p.live?.weather ? `Weather: no live weather data in Nest for this region — suggest ${p.weather.label} (${p.weather.url}).` : '',
    p.noGoogle ? 'In mainland China suggest Amap / Baidu Maps and other local services, not Google services.' : '',
    c === 'HK' ? 'Hong Kong live data (HKO weather and warnings, MTR / bus arrivals, 1823 holidays) is available in Nest.' : 'Hong Kong-only features (MTR / KMB arrivals, Hong Kong Observatory, Hong Kong holidays, EDB notices) do NOT apply to this user; never assume they live in Hong Kong.',
    tz && c !== 'HK' ? `Device time zone: ${tz}.` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

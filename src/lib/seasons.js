// Run 22: date-based seasonal themes (landing hero + subtle in-app accents). Pure logic only — no DOM imports at module
// level, so node tests can import it. Dates are Hong Kong calendar days.
//   Lunar New Year day 1 and Mid-Autumn (15th of the 8th lunar month) come from a static table. 2026–2030 checked
//   against the HK Government gazette / 1823 (2027-02-06 and 2030-02-03 differ from ICU's chinese calendar, which puts
//   them a day later — new moon close to midnight); later years from the standard tables.
export const LNY = { 2026: '02-17', 2027: '02-06', 2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08', 2036: '01-28' };
export const MID_AUTUMN = { 2026: '09-25', 2027: '09-15', 2028: '10-03', 2029: '09-22', 2030: '09-12', 2031: '10-01', 2032: '09-19', 2033: '09-08', 2034: '09-27', 2035: '09-16', 2036: '10-04' };
export const SEASONS = ['halloween', 'christmas', 'lunarNewYear', 'midAutumn'];
export const SEASON_KEY = 'nest.seasonal'; // 'off' = the user turned seasonal themes off (Settings), per device
export const OVERRIDE_KEY = 'nest.seasonOverride'; // dev / screenshot override from ?theme=… (session only)

const DAY = 864e5;
// 'YYYY-MM-DD' of `now` on the Hong Kong calendar (UTC+8, no DST).
export const hkDay = (now = Date.now()) => new Date(+now + 8 * 3600e3).toISOString().slice(0, 10);
const ord = (ymd) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / DAY;
const inRange = (d, start, end) => { const x = ord(d); return x >= ord(start) && x <= ord(end); };
const shift = (ymd, n) => new Date((ord(ymd) + n) * DAY).toISOString().slice(0, 10);

// Windows (inclusive, HK days):
//   halloween    Oct 17 – Nov 1 (two weeks of build-up, like the shops)
//   christmas    Dec 1 – Dec 26
//   lunarNewYear 7 days before day 1 → day 15 (Lantern Festival)
//   midAutumn    5 days before → 1 day after
export function seasonWindows(year) {
  const w = [
    { id: 'halloween', start: `${year}-10-17`, end: `${year}-11-01` },
    { id: 'christmas', start: `${year}-12-01`, end: `${year}-12-26` },
  ];
  if (LNY[year]) { const d1 = `${year}-${LNY[year]}`; w.push({ id: 'lunarNewYear', start: shift(d1, -7), end: shift(d1, 14), day: d1 }); }
  if (MID_AUTUMN[year]) { const d = `${year}-${MID_AUTUMN[year]}`; w.push({ id: 'midAutumn', start: shift(d, -5), end: shift(d, 1), day: d }); }
  return w;
}
// The season active on `now` (HK calendar), or null.
export function seasonFor(now = Date.now()) {
  const d = hkDay(now);
  const y = +d.slice(0, 4);
  const hit = seasonWindows(y).find((w) => inRange(d, w.start, w.end));
  return hit ? hit.id : null;
}
// ?theme=halloween | christmas | lunar-new-year | lny | mid-autumn | none → season id, '' (= force none) or undefined (no override).
export function parseOverride(search = '') {
  const m = String(search || '').match(/[?&]theme=([^&#]*)/);
  if (!m) return undefined;
  const v = decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z]/g, '');
  if (!v) return undefined;
  const alias = { halloween: 'halloween', christmas: 'christmas', xmas: 'christmas', lunarnewyear: 'lunarNewYear', lny: 'lunarNewYear', cny: 'lunarNewYear', midautumn: 'midAutumn', none: '', off: '' };
  return v in alias ? alias[v] : undefined;
}
// Decide what to show: override > user off-switch > date. `enabled` false never shows a season, except an explicit override.
export function resolveSeason({ now = Date.now(), enabled = true, override } = {}) {
  if (override !== undefined) return override || null;
  if (!enabled) return null;
  return seasonFor(now);
}

// ---- browser helpers (guarded, safe to import anywhere) ----
// Run 23: the family can set the default (Family → 節日主題); a member's own choice on this device ('on' / 'off') wins.
let familyDefault = true;
export const setFamilySeasonDefault = (v) => { familyDefault = v !== false; };
export function seasonalEnabled() { try { const v = localStorage.getItem(SEASON_KEY); return v === 'off' ? false : v === 'on' ? true : familyDefault; } catch { return familyDefault; } }
export function readOverride() {
  if (typeof location === 'undefined') return undefined;
  const fromUrl = parseOverride(location.search);
  try {
    if (fromUrl !== undefined) { sessionStorage.setItem(OVERRIDE_KEY, fromUrl || 'none'); return fromUrl; }
    const s = sessionStorage.getItem(OVERRIDE_KEY);
    if (s) return s === 'none' ? '' : SEASONS.includes(s) ? s : undefined;
  } catch {}
  return fromUrl;
}
export function currentSeason(now = Date.now()) {
  return resolveSeason({ now, enabled: seasonalEnabled(), override: readOverride() });
}

// Short greeting per season (zh-Hant = HK 書面語; zh-Hans is converted by the app's generator / DOM pass).
export const SEASON_TEXT = {
  halloween: { 'zh-Hant': '萬聖節快樂', en: 'Happy Halloween', 'zh-Hans': '万圣节快乐' },
  christmas: { 'zh-Hant': '聖誕快樂', en: 'Merry Christmas', 'zh-Hans': '圣诞快乐' },
  lunarNewYear: { 'zh-Hant': '新年快樂', en: 'Happy Lunar New Year', 'zh-Hans': '新年快乐' },
  midAutumn: { 'zh-Hant': '中秋節快樂', en: 'Happy Mid-Autumn Festival', 'zh-Hans': '中秋节快乐' },
};
export const seasonText = (id, uiLang) => (SEASON_TEXT[id] ? SEASON_TEXT[id][uiLang] || SEASON_TEXT[id].en : '');

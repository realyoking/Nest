// Run 23 「今日」 card: weather + unfinished reminders + family schedule (all live, no AI) and ONE AI suggestion sentence
// that is generated at most once per Hong Kong day per family and cached in Firestore (families/{fid}/daily/{day},
// server-only, written by /api/app/today with the service account). Pure helpers, shared with api/_run23.js.

export const TODAY_LANGS = ['zh-Hant', 'en', 'th'];
export const hkDayOf = (ms = Date.now()) => new Date(ms + 8 * 3600e3).toISOString().slice(0, 10);
const toMs = (d) => (d == null ? NaN : typeof d === 'number' ? d : d instanceof Date ? d.getTime() : d?.toDate ? d.toDate().getTime() : Date.parse(d));

// Unfinished reminders for the card: overdue + today first, then the next 2 days. At most `max`.
export function openReminders(reminders = [], now = Date.now(), max = 4) {
  const end = Date.parse(`${hkDayOf(now + 2 * 864e5)}T23:59:59+08:00`);
  return reminders.filter((r) => !r.done).map((r) => ({ ...r, ms: toMs(r.dueAt) }))
    .filter((r) => !isNaN(r.ms) && r.ms <= end)
    .sort((a, b) => a.ms - b.ms).slice(0, max)
    .map((r) => ({ id: r.id, title: r.title, ms: r.ms, memberId: r.memberId || '', overdue: r.ms < now, today: hkDayOf(r.ms) === hkDayOf(now) }));
}

// Today's schedule from shared family calendars + the user's connected Google Calendar brief.
export function todaySchedule({ shares = [], brief = {}, now = Date.now(), max = 4 } = {}) {
  const day = hkDayOf(now);
  const out = [];
  for (const sh of shares || []) for (const e of sh.events || []) {
    const ms = toMs(e.s); if (isNaN(ms) || hkDayOf(ms) !== day) continue;
    out.push({ title: String(e.t || ''), ms, who: sh.name || '' });
  }
  for (const acc of brief.googlecalendar || []) for (const e of acc.items || []) {
    const ms = toMs(e.date); if (isNaN(ms) || hkDayOf(ms) !== day) continue;
    out.push({ title: String(e.title || ''), ms, who: '' , where: e.location || '' });
  }
  const seen = new Set();
  return out.filter((e) => e.title && !seen.has(`${e.title}|${e.ms}`) && seen.add(`${e.title}|${e.ms}`)).sort((a, b) => a.ms - b.ms).slice(0, max);
}

// Facts sent to the server for the one AI sentence (no ids, short strings only).
export function factsFor({ weather, reminders = [], schedule = [], warn = null, members = [], family = '' } = {}) {
  const w = weather || {};
  const d = w.today || w.tomorrow || null;
  return {
    family: String(family || '').slice(0, 40),
    weather: [w.temp != null ? `now ${w.temp}°C` : '', w.humidity != null ? `humidity ${w.humidity}%` : '', d ? `${w.today ? 'today' : 'tomorrow'} ${d.min}–${d.max}°C, rain chance ${d.psr || '?'}${d.desc ? `, ${d.desc}` : ''}` : '', w.forecast ? String(w.forecast).slice(0, 220) : ''].filter(Boolean).join('; ').slice(0, 400),
    warnings: (warn?.warnings || []).map((x) => String(x.name || '')).filter(Boolean).slice(0, 4),
    reminders: reminders.slice(0, 5).map((r) => `${String(r.title).slice(0, 60)}${r.overdue ? ' (overdue)' : r.today ? ' (today)' : ''}`),
    schedule: schedule.slice(0, 5).map((e) => `${new Date(e.ms + 8 * 3600e3).toISOString().slice(11, 16)} ${String(e.title).slice(0, 60)}${e.who ? ` (${String(e.who).slice(0, 20)})` : ''}`),
    members: members.slice(0, 10).map((m) => String(m).slice(0, 20)),
  };
}

// Server-side validation of the facts (never trust the client's shape).
export function cleanFacts(f = {}) {
  const arr = (v, n, each) => (Array.isArray(v) ? v.slice(0, n).map((x) => String(x ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, each)) : []);
  return { family: String(f.family || '').slice(0, 40), weather: String(f.weather || '').slice(0, 400), warnings: arr(f.warnings, 4, 60), reminders: arr(f.reminders, 5, 80), schedule: arr(f.schedule, 5, 90), members: arr(f.members, 10, 20) };
}

// One Agnes call → all three languages at once (so one family = one call per day, whatever language each member uses).
export function todayPrompt(facts, { name = 'Nestie', personality = 'gentle', day } = {}) {
  const tone = personality === 'lively' ? 'upbeat and encouraging' : personality === 'concise' ? 'very short and plain' : 'warm and gentle';
  return [
    `You write the ONE-sentence daily tip on a family app's "Today" card. The helper is called ${name}; tone: ${tone}. Date: ${day} (Hong Kong).`,
    'Pick the single most useful practical thing for today from the facts (rain → umbrella / bring in the laundry; hot → water; an overdue or today item; a schedule clash). Max ~22 words in English. No emoji, no greeting, no names of the helper, no invented facts or numbers.',
    'Reply with ONLY JSON: {"zh-Hant":"…","en":"…","th":"…"}. zh-Hant must be Hong Kong standard written Chinese (書面語, e.g. 「今晚有機會下雨，記得收衣服。」) — never Cantonese colloquial words (唔、嘅、咗、係、啲、喺) and never Taiwan-only words. th is natural Thai.',
    `Facts:\n${JSON.stringify(facts)}`,
  ].join('\n');
}
export function parseToday(text) {
  const t = String(text || '');
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try {
    const j = JSON.parse(t.slice(a, b + 1));
    const out = {};
    for (const l of TODAY_LANGS) { const v = String(j?.[l] || '').replace(/\s+/g, ' ').trim(); if (v) out[l] = v.slice(0, l === 'en' ? 200 : 120); }
    return out.en || out['zh-Hant'] ? out : null;
  } catch { return null; }
}
// Cantonese colloquial characters are not allowed in zh-Hant UI copy (香港書面語).
export const CANTONESE_RE = /[唔嘅咗啲喺嚟冇睇諗揾]|係咪|乜嘢/;
export function fixZh(s) {
  if (!s || !CANTONESE_RE.test(s)) return s;
  return s.replace(/唔/g, '不').replace(/嘅/g, '的').replace(/咗/g, '了').replace(/啲/g, '些').replace(/喺/g, '在').replace(/嚟/g, '來').replace(/冇/g, '沒有').replace(/睇/g, '看').replace(/諗/g, '想').replace(/揾/g, '找').replace(/係咪/g, '是否').replace(/乜嘢/g, '甚麼');
}

// Local fallback (no AI): used when the AI line is missing (offline, quota, mock) — always something sensible.
export function fallbackLine(lang, { weather, reminders = [], schedule = [] } = {}) {
  const L = lang === 'zh-Hant' || lang === 'zh-Hans' ? 'zh-Hant' : lang === 'th' ? 'th' : 'en';
  const d = weather?.today || weather?.tomorrow;
  const rain = /高|中|high|medium/i.test(d?.psr || '') || /雨|rain|shower/i.test(`${d?.desc || ''} ${weather?.forecast || ''}`.slice(0, 120));
  const hot = (d?.max ?? weather?.temp ?? 0) >= 32;
  const od = reminders.find((r) => r.overdue);
  const first = schedule[0];
  const T = {
    'zh-Hant': { rain: '今天有機會下雨，出門記得帶傘，晾在外面的衣服也要留意。', hot: '今天天氣炎熱，記得多喝水，外出做好防曬。', od: (x) => `「${x}」已過期，今天抽空處理吧。`, ev: (x) => `今天有「${x}」，記得預留時間。`, ok: '今天沒有急事，可以輕鬆一點。' },
    en: { rain: 'Rain is likely today — take an umbrella and keep an eye on the laundry.', hot: 'It’s a hot one today — drink plenty of water and use sun protection.', od: (x) => `“${x}” is overdue — try to fit it in today.`, ev: (x) => `“${x}” is on today — leave yourself time for it.`, ok: 'Nothing urgent today — enjoy a lighter day.' },
    th: { rain: 'วันนี้มีโอกาสฝนตก อย่าลืมพกร่มและเก็บผ้าที่ตากไว้', hot: 'วันนี้อากาศร้อน ดื่มน้ำให้มากและป้องกันแดดด้วย', od: (x) => `“${x}” เลยกำหนดแล้ว ลองจัดการให้เสร็จวันนี้`, ev: (x) => `วันนี้มี “${x}” อย่าลืมเผื่อเวลาไว้`, ok: 'วันนี้ไม่มีเรื่องเร่งด่วน พักผ่อนสบาย ๆ ได้' },
  }[L];
  if (rain) return T.rain;
  if (od) return T.od(od.title);
  if (hot) return T.hot;
  if (first) return T.ev(first.title);
  return T.ok;
}
// Which cached line to show for a UI language (zh-Hans converts on the DOM; other added languages use English).
export const lineFor = (lines, uiLang) => (lines ? lines[uiLang === 'zh-Hans' ? 'zh-Hant' : TODAY_LANGS.includes(uiLang) ? uiLang : 'en'] || lines.en || '' : '');

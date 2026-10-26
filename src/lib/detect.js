// School notices / tests & homework / fees & bills — detection shared by the server scanner (api/_auto.js, cron +
// on-demand) and the Home digest (browser). Pure functions only: no fetch, no browser APIs.
//
// detectKind(msg)      → { kind: 'notice'|'test'|'homework'|'bill'|null, score, why }
// parseDates(text,now) → [{ date:'YYYY-MM-DD', time?:'HH:MM', deadline:bool, idx }] (HK formats, day-first)
// parseAmount(text)    → { amount, currency:'HKD', raw } | null
// heuristicItem(msg,now) → suggestion fields without the model
// llmPrompt(lang, msgs) / parseLlm(text) → model refinement (one batched call)
// autoId(src)          → stable doc id for dedupe (by message id)

const HK = 8 * 3600e3;
export const hkDayKey = (ms = Date.now()) => new Date(ms + HK).toISOString().slice(0, 10);
const dayMs = (key) => Date.parse(`${key}T00:00:00Z`) - HK;

const SCHOOL_FROM = /\.edu\.hk\b|\.edu\b|school|college|academy|kindergarten|eclass|學校|書院|中學|小學|幼稚園|學園/i;
const NOTICE_RE = /通告|回條|家長信|致家長|通知書|同意書|家長會|家長日|家長晚會|旅行|陸運會|水運會|開放日|畢業禮|頒獎禮|校服|circular|reply slip|notice to parents|letter to parents|parents?['’]? (letter|notice|meeting|day)|consent form|permission slip|school (trip|picnic|notice|letter)|sports day|speech day|open day/i;
const TEST_RE = /默書|測驗|考試|小測|測考|段考|期考|口試|聆聽|dictation|\bspelling\b|\btests?\b|\bexams?\b|examination|\bquiz(zes)?\b|assessment/i;
const HW_RE = /功課|作業|家課|習作|專題|homework|assignment|project due|worksheet/i;
const BILL_RE = /繳費|費用|收費|午膳費|飯費|學費|堂費|雜費|書簿費|帳單|賬單|月結單|電費|水費|煤氣費|寬頻|繳款|付款|到期|\bbills?\b|invoice|statement|payment (due|reminder|request)|amount due|due date|tuition fee|lunch fee|school fee|e-?bill|autopay/i;
const PAYEES = [
  [/中華電力|\bclp\b/i, 'CLP 中電'], [/港燈|hk ?electric/i, 'HK Electric 港燈'], [/煤氣|towngas/i, 'Towngas 煤氣'],
  [/水務署|water supplies/i, 'Water Supplies 水務署'], [/hkbn|香港寬頻/i, 'HKBN'], [/pccw|netvigator|網上行/i, 'PCCW'],
  [/csl|1o1o/i, 'csl'], [/smartone|數碼通/i, 'SmarTone'], [/china mobile|中國移動/i, 'China Mobile HK'], [/3hk|和記/i, '3HK'],
];
const NOISE_RE = /unsubscribe|newsletter|promotion|優惠|推廣|sale|% off|verify your|verification code|驗證碼|password|密碼|security alert|安全性警示|sign-in|login/i;
const DEADLINE_RE = /截止|之前|前交|前繳|前回覆|前遞交|或之前|限期|到期日|due( date)?|deadline|\bby\b|before|no later than|on or before|pay by|reply by|return by/i;
// A date is a deadline when a marker sits right before it ("due 25 Oct", "截止日期：") or right after it ("23/10（五）前").
const DL_BEFORE = /(截止(日期)?|限期|到期日?|due( date)?|deadline|\bby|before|no later than|on or before)[\s:：]*$/i;
const DL_AFTER = /^[^。.\n,，;；]{0,8}?(前|之前|或之前|截止)/;

// ---------- dates ----------
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, '0');
const valid = (y, m, d) => m >= 1 && m <= 12 && d >= 1 && d <= 31 && new Date(Date.UTC(y, m - 1, d)).getUTCDate() === d;

export function parseDates(text = '', now = Date.now()) {
  const s = String(text);
  const today = hkDayKey(now);
  const ty = +today.slice(0, 4);
  const out = [];
  const push = (y, m, d, idx, len) => {
    if (!valid(y, m, d)) return;
    let key = `${y}-${pad(m)}-${pad(d)}`;
    // Year missing: the next occurrence (a date up to 30 days ago still counts as this year — e.g. an overdue fee).
    if (y === 0) { key = `${ty}-${pad(m)}-${pad(d)}`; if (dayMs(key) < dayMs(today) - 30 * 864e5) key = `${ty + 1}-${pad(m)}-${pad(d)}`; if (!valid(+key.slice(0, 4), m, d)) return; }
    const tm = /(\d{1,2})[:：.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?|(上午|下午|晚上|早上)\s*(\d{1,2})\s*[時时點点](\d{1,2})?/i.exec(s.slice(idx + len, idx + len + 24));
    let time;
    if (tm) {
      let h; let mi;
      if (tm[1]) { h = +tm[1]; mi = +tm[2]; const ap = (tm[3] || '').toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; }
      else { h = +tm[5]; mi = +(tm[6] || 0); if (/下午|晚上/.test(tm[4]) && h < 12) h += 12; }
      if (h < 24 && mi < 60) time = `${pad(h)}:${pad(mi)}`;
    }
    out.push({ date: key, ...(time ? { time } : {}), deadline: DL_BEFORE.test(s.slice(Math.max(0, idx - 18), idx)) || DL_AFTER.test(s.slice(idx + len, idx + len + 14)), idx });
  };
  let m;
  // No lookbehind (older iOS Safari can't parse it): a leading group `p` holds the boundary character instead.
  const R = [
    [/(^|\D)(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/g, (x) => [+x[2], +x[3], +x[4]]],
    [/(^|[^\d/])(\d{1,2})[/.-](\d{1,2})[/.-](20\d{2}|\d{2})(?![\d/])/g, (x) => [x[4].length === 2 ? 2000 + +x[4] : +x[4], +x[3], +x[2]]],
    [/(^|[^\d年/])(\d{1,2})月(\d{1,2})[日號号]/g, (x) => [0, +x[2], +x[3]]],
    [/(^|[^\d/:.$])(\d{1,2})\/(\d{1,2})(?![\d/])/g, (x) => [0, +x[3], +x[2]]],
    [/(^|\W)(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?,?\s*(20\d{2})?\b/gi, (x) => [x[4] ? +x[4] : 0, MONTHS[x[3].toLowerCase()], +x[2]]],
    [/(^|\W)(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})?\b/gi, (x) => [x[4] ? +x[4] : 0, MONTHS[x[2].toLowerCase()], +x[3]]],
  ];
  const taken = [];
  for (const [re, f] of R) {
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      const start = m.index + m[1].length; const end = m.index + m[0].length;
      if (m[0].length === m[1].length) { re.lastIndex++; continue; }
      if (taken.some(([a, b]) => start < b && end > a)) { re.lastIndex = Math.max(re.lastIndex, start + 1); continue; }
      taken.push([start, end]);
      const [y, mo, d] = f(m);
      push(y, mo, d, start, end - start);
      re.lastIndex = end;
    }
  }
  // Relative words.
  const rel = [[/今天|今日|\btoday\b/i, 0], [/明天|明日|\btomorrow\b/i, 1], [/後天/, 2]];
  for (const [re, n] of rel) { const x = re.exec(s); if (x) out.push({ date: hkDayKey(now + n * 864e5), deadline: DEADLINE_RE.test(s.slice(Math.max(0, x.index - 20), x.index + 20)), idx: x.index, rel: true }); }
  return out.sort((a, b) => a.idx - b.idx);
}
// The date that matters: a marked deadline first, else the earliest date from yesterday on (within ~8 months).
export function pickDate(dates, now = Date.now()) {
  const lo = dayMs(hkDayKey(now)) - 864e5; const hi = lo + 240 * 864e5;
  const ok = dates.filter((d) => { const t = dayMs(d.date); return t >= lo && t <= hi; });
  const dl = ok.filter((d) => d.deadline && !d.rel);
  if (dl.length) return dl.sort((a, b) => a.date.localeCompare(b.date))[0];
  const abs = ok.filter((d) => !d.rel);
  if (abs.length) return abs.sort((a, b) => a.date.localeCompare(b.date))[0];
  return ok[0] || null;
}

// ---------- amounts ----------
export function parseAmount(text = '') {
  const s = String(text);
  const res = [/(?:HK\$|HKD|港幣|港元)\s*([\d,]+(?:\.\d{1,2})?)/gi, /\$\s*([\d,]+(?:\.\d{1,2})?)/g, /([\d,]+(?:\.\d{1,2})?)\s*(?:港元|元|HKD)/g];
  const found = [];
  for (const re of res) { let m; re.lastIndex = 0; while ((m = re.exec(s))) { const v = Number(m[1].replace(/,/g, '')); if (v > 0 && v < 1e6) found.push({ v, idx: m.index, raw: m[0] }); } }
  if (!found.length) return null;
  const KEY = /amount due|total|應繳|總額|金額|合共|共|費用|fee|須繳|需繳|繳付/i;
  found.sort((a, b) => (KEY.test(s.slice(Math.max(0, b.idx - 24), b.idx)) - KEY.test(s.slice(Math.max(0, a.idx - 24), a.idx))) || a.idx - b.idx);
  return { amount: found[0].v, currency: 'HKD', raw: found[0].raw.trim() };
}

// ---------- classification ----------
const count = (re, s) => (String(s).match(new RegExp(re.source, 'gi')) || []).length;
// msg: { from, subject, snippet, text?, attachments?: [names], source?: 'gmail'|'classroom' }
export function detectKind(msg = {}) {
  const head = `${msg.subject || ''} ${(msg.attachments || []).join(' ')}`;
  const body = `${msg.snippet || ''} ${msg.text || ''}`;
  const all = `${head} ${body}`;
  const school = msg.source === 'classroom' || SCHOOL_FROM.test(msg.from || '');
  if (NOISE_RE.test(head) && !school) return { kind: null, score: 0, why: 'noise' };
  const sc = {
    notice: count(NOTICE_RE, head) * 3 + count(NOTICE_RE, body) + (school ? 2 : 0),
    test: count(TEST_RE, head) * 3 + Math.min(3, count(TEST_RE, body)) + (school ? 1 : 0),
    homework: count(HW_RE, head) * 2 + Math.min(2, count(HW_RE, body)) + (school ? 1 : 0),
    bill: count(BILL_RE, head) * 3 + Math.min(3, count(BILL_RE, body)) + (parseAmount(all) ? 2 : 0) + (PAYEES.some(([re]) => re.test(`${msg.from} ${head}`)) ? 2 : 0),
  };
  // A school letter about a fee is a bill; a notice about a test is a test.
  let kind = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  const min = { notice: 4, test: 4, homework: 4, bill: 5 };
  if (kind[1] < min[kind[0]]) return { kind: null, score: kind[1], why: 'below threshold' };
  if (kind[0] === 'notice' && sc.bill >= 5 && /費|fee|\$/i.test(head)) kind = ['bill', sc.bill];
  return { kind: kind[0], score: kind[1], why: school ? 'school sender' : 'keywords' };
}
export const payeeOf = (msg) => {
  const hit = PAYEES.find(([re]) => re.test(`${msg.from || ''} ${msg.subject || ''}`));
  if (hit) return hit[1];
  return String(msg.from || '').replace(/<[^>]*>/g, '').replace(/"/g, '').trim().slice(0, 60);
};

// Suggestion without the model (also the fallback when the model is down).
export function heuristicItem(msg, now = Date.now()) {
  const d = detectKind(msg);
  if (!d.kind) return null;
  const text = `${msg.subject || ''}\n${msg.snippet || ''}\n${msg.text || ''}`;
  const date = pickDate(parseDates(text, now), now);
  const amt = d.kind === 'bill' ? parseAmount(text) : null;
  const subject = String(msg.subject || '').replace(/^(re|fw|fwd)\s*:\s*/i, '').trim() || '(no subject)';
  return {
    kind: d.kind, title: subject.slice(0, 120), body: String(msg.snippet || '').slice(0, 300),
    date: date?.date || '', time: date?.time || '', needsReply: d.kind === 'notice' && /回條|回覆|簽|reply|sign|consent|return/i.test(text),
    ...(amt ? { amount: amt.amount, currency: amt.currency } : {}), ...(d.kind === 'bill' ? { payee: payeeOf(msg) } : {}),
  };
}

// ---------- model refinement (one batched call) ----------
export function llmPrompt(lang, msgs, today) {
  const zh = lang !== 'en';
  const sys = [
    'You classify emails / class announcements for a family app (families may be in any country or region). Output ONLY a JSON array, no prose.',
    'For each input item output {"i": <index>, "kind": "notice"|"test"|"homework"|"bill"|"none", "title": string, "date": "YYYY-MM-DD"|"", "time": "HH:MM"|"", "action": string, "needsReply": boolean, "amount": number|null, "payee": string}.',
    'notice = school circular / letter to parents / reply slip / consent form / school event. test = dictation, quiz, test or exam. homework = homework or assignment deadline. bill = a fee or bill to pay (lunch fee, class fee, tuition, utility, phone, broadband). none = anything else (newsletters, promotions, receipts already paid, security codes).',
    'date = the date the family must act by (reply / pay / test day). Dates are day-first in Hong Kong (12/10 = 12 October). Today is ' + today + ' (Hong Kong). Use "" if unknown. Never invent amounts or dates.',
    zh ? 'title and action MUST be in Traditional Chinese 繁體中文書面語, short (title ≤ 24 字; action ≤ 30 字, e.g. 「簽署回條並於星期五前交回」).' : 'title and action in English, short (title ≤ 60 chars; action ≤ 80 chars, e.g. "Sign the reply slip and return it by Friday").',
  ].join('\n');
  const user = msgs.map((m, i) => `#${i}\nFrom: ${m.from || ''}\nSubject: ${m.subject || ''}\nAttachments: ${(m.attachments || []).join(', ')}\n${String(m.text || m.snippet || '').slice(0, 1800)}`).join('\n\n---\n\n');
  return { sys, user };
}
export function parseLlm(text) {
  const s = String(text || '');
  const a = s.indexOf('['); const b = s.lastIndexOf(']');
  if (a < 0 || b < a) return [];
  try {
    const arr = JSON.parse(s.slice(a, b + 1));
    return Array.isArray(arr) ? arr.filter((x) => x && Number.isInteger(x.i)) : [];
  } catch { return []; }
}
// Merge the model's answer over the heuristic one. The model may veto ("none"), never invent a kind from nothing
// unless the heuristic already flagged the message as a candidate.
export function mergeLlm(h, m) {
  if (!m) return h;
  if (m.kind === 'none') return null;
  const kind = ['notice', 'test', 'homework', 'bill'].includes(m.kind) ? m.kind : h?.kind;
  if (!kind) return null;
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(m.date || '') ? m.date : h?.date || '';
  const okTime = /^\d{2}:\d{2}$/.test(m.time || '') ? m.time : h?.time || '';
  const amount = Number.isFinite(Number(m.amount)) && Number(m.amount) > 0 ? Number(m.amount) : h?.amount;
  return {
    ...(h || {}), kind, title: String(m.title || h?.title || '').slice(0, 120), date: okDate, time: okTime,
    action: String(m.action || '').slice(0, 160), needsReply: typeof m.needsReply === 'boolean' ? m.needsReply : !!h?.needsReply,
    ...(amount ? { amount, currency: 'HKD' } : {}), ...(kind === 'bill' ? { payee: String(m.payee || h?.payee || '').slice(0, 60) } : {}),
  };
}

// ---------- ids ----------
// Stable, URL-safe doc id per source message (FNV-1a 64-bit as two 32-bit halves; no crypto needed, both runtimes).
export function autoId(src) {
  const s = `${src.type}|${String(src.account || '').toLowerCase()}|${src.id}`;
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x01000197) >>> 0; }
  return `a${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

// Which family member signs / replies: the user if a parent, else the owner if a parent, else the first parent.
export function pickSigner(members = [], uid, ownerId) {
  const parents = members.filter((m) => m.role === 'parent');
  return (parents.find((m) => m.uid === uid) || parents.find((m) => m.uid === ownerId) || parents[0] || {}).uid || '';
}

// Bill reminder times: N days before due (default 3) and the day before, 09:00 HKT. Only future times.
export function billReminderTimes(dueKey, lead = 3, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueKey || '')) return [];
  const due = dayMs(dueKey);
  return [...new Set([Number(lead) || 3, 1])].sort((a, b) => b - a).map((n) => new Date(due - n * 864e5 + 9 * 3600e3)).filter((d) => d.getTime() > now);
}
export const daysUntil = (key, now = Date.now()) => Math.round((dayMs(key) - dayMs(hkDayKey(now))) / 864e5);

// Stable key for a "revised yet?" nudge (same item + due day → same key on server and client).
export const nudgeKey = (title, dueKey) => 'n' + autoId({ type: 'nudge', account: '', id: `${String(title || '').trim().toLowerCase()}|${dueKey}` }).slice(1);
// Items due on `dayKey` that deserve a "revised yet?" nudge: tests / dictations / homework from every source.
// sources: { work: [{title, course, due(Date|ms|iso)}], deadlines: [{title, course, dueAt, kind}], inbox: [...], reminders: [...] }
const TEST_WORD = /默書|測驗|考試|小測|測考|段考|期考|口試|聆聽|dictation|spelling|\btests?\b|\bexams?\b|\bquiz/i;
export function nudgeItems({ work = [], deadlines = [], inbox = [], reminders = [] }, dayKey, uid) {
  const out = new Map();
  const add = (title, sub, kind, src) => { const k = nudgeKey(title, dayKey); if (!out.has(k)) out.set(k, { key: k, title: String(title).slice(0, 120), sub: String(sub || '').slice(0, 80), kind, due: dayKey, src }); };
  const day = (v) => (v ? hkDayKey(new Date(v).getTime()) : '');
  work.forEach((w) => day(w.due) === dayKey && add(w.title, w.course, TEST_WORD.test(w.title) ? 'test' : 'homework', 'classroom'));
  deadlines.forEach((d) => day(d.dueAt) === dayKey && add(d.title, d.course, d.kind === 'test' || TEST_WORD.test(d.title) ? 'test' : 'homework', 'classroom'));
  inbox.filter((i) => (!uid || i.uid === uid) && ['test', 'homework'].includes(i.kind) && !['dismissed'].includes(i.status) && i.date === dayKey).forEach((i) => add(i.title, i.src?.from || '', i.kind, 'gmail'));
  reminders.filter((r) => !r.done && r.dueAt && (!uid || !r.memberId || r.memberId === uid) && TEST_WORD.test(r.title || '') && day(r.dueAt) === dayKey).forEach((r) => add(r.title, '', 'test', 'reminder'));
  return [...out.values()];
}
// Light keyword check for short texts (e.g. older AI inbox items): which category does it belong to?
export const softKind = (s = '') => (TEST_RE.test(s) ? 'test' : BILL_RE.test(s) ? 'bill' : NOTICE_RE.test(s) ? 'notice' : HW_RE.test(s) ? 'homework' : null);

// ---------- subscriptions / recurring charges (from email receipts; no bank access) ----------
const SUB_RE = /subscription|subscribed|auto-?renew|\brenew(s|al|ed|ing)?\b|membership|monthly plan|annual plan|yearly plan|billing period|next (billing|payment|charge)|recurring|trial (ends|will end)|續訂|訂閱|訂購計劃|續期|會籍|會員費|月費|年費|自動續|下次扣款|下期收費|每月收費|學費.*每月/i;
// [regex, service name, purpose (zh, en), cancel page]
export const SERVICES = [
  [/netflix/i, 'Netflix', ['影片串流', 'Streaming'], 'https://www.netflix.com/cancelplan'],
  [/spotify/i, 'Spotify', ['音樂', 'Music'], 'https://www.spotify.com/account/subscription/'],
  [/disney\s*\+|disney plus/i, 'Disney+', ['影片串流', 'Streaming'], 'https://www.disneyplus.com/account/subscription'],
  [/youtube (premium|music)|youtube.*membership/i, 'YouTube Premium', ['影片串流', 'Streaming'], 'https://www.youtube.com/paid_memberships'],
  [/icloud\+?|apple music|apple tv\+?|apple arcade|apple one|app store.*subscription|apple\.com\/bill|email\.apple\.com/i, 'Apple', ['Apple 訂閱', 'Apple subscription'], 'https://apps.apple.com/account/subscriptions'],
  [/google one|google play.*subscription|payments\.google\.com/i, 'Google', ['Google 訂閱', 'Google subscription'], 'https://play.google.com/store/account/subscriptions'],
  [/chatgpt|openai/i, 'ChatGPT', ['AI 工具', 'AI tool'], 'https://chatgpt.com/#settings/Subscription'],
  [/microsoft 365|office 365|xbox game pass/i, 'Microsoft', ['軟件／遊戲', 'Software / games'], 'https://account.microsoft.com/services'],
  [/duolingo/i, 'Duolingo', ['學習', 'Learning'], 'https://www.duolingo.com/settings/subscription'],
  [/roblox premium|roblox.*membership/i, 'Roblox Premium', ['遊戲', 'Games'], 'https://www.roblox.com/my/account#!/billing'],
  [/nintendo switch online/i, 'Nintendo Switch Online', ['遊戲', 'Games'], 'https://accounts.nintendo.com/shop/subscriptions'],
  [/playstation plus|ps plus/i, 'PlayStation Plus', ['遊戲', 'Games'], 'https://www.playstation.com/acct/management'],
  [/adobe/i, 'Adobe', ['軟件', 'Software'], 'https://account.adobe.com/plans'],
  [/canva/i, 'Canva', ['設計工具', 'Design'], 'https://www.canva.com/settings/billing-and-teams'],
  [/notion/i, 'Notion', ['工具', 'Tools'], 'https://www.notion.so/my-account'],
  [/dropbox/i, 'Dropbox', ['雲端儲存', 'Cloud storage'], 'https://www.dropbox.com/account/plan'],
  [/mytv super/i, 'myTV SUPER', ['電視', 'TV'], 'https://www.mytvsuper.com/tc/account/'],
  [/now tv|nowtv/i, 'Now TV', ['電視', 'TV'], 'https://www.nowtv.now.com/'],
  [/viu/i, 'Viu', ['影片串流', 'Streaming'], 'https://www.viu.com/'],
  [/coding|編程|程式|robotics|機械人|stem/i, '', ['編程／STEM 課程', 'Coding / STEM class'], ''],
  [/tutor|補習|教育中心|learning centre|academy|music school|音樂中心|swim|游泳/i, '', ['課程', 'Class'], ''],
];
export function detectSub(msg = {}) {
  const head = `${msg.from || ''} ${msg.subject || ''}`;
  const text = `${head} ${msg.snippet || ''} ${msg.text || ''}`;
  const svc = SERVICES.find(([re]) => re.test(head)) || SERVICES.find(([re]) => re.test(text));
  if (!SUB_RE.test(text)) return null;
  const amt = parseAmount(text);
  if (!amt && !(svc && svc[1])) return null;
  const cycle = /year|annual|yearly|每年|年費|\/yr|per year/i.test(text) ? 'yearly' : /week|每週|每星期|weekly/i.test(text) ? 'weekly' : 'monthly';
  return { svc, amt, cycle };
}
const CYCLE_DAYS = { weekly: 7, monthly: 30.44, yearly: 365.25 };
export const monthlyOf = (amount, cycle) => (Number(amount) || 0) * (30.44 / (CYCLE_DAYS[cycle] || 30.44));
// Next renewal on/after `now` from a known date, stepping by cycle (HK wall dates).
export function nextRenewal(date, cycle = 'monthly', now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return '';
  const today = hkDayKey(now);
  let [y, m, d] = date.split('-').map(Number);
  for (let i = 0; i < 400 && `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` < today; i++) {
    if (cycle === 'yearly') y++;
    else if (cycle === 'weekly') { const t = new Date(Date.UTC(y, m - 1, d + 7)); y = t.getUTCFullYear(); m = t.getUTCMonth() + 1; d = t.getUTCDate(); }
    else { m++; if (m > 12) { m = 1; y++; } }
  }
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}
export function subItem(msg, now = Date.now(), lang = 'zh-Hant') {
  const s = detectSub(msg);
  if (!s) return null;
  const text = `${msg.subject || ''}\n${msg.snippet || ''}\n${msg.text || ''}`;
  const dates = parseDates(text, now);
  const renewal = (dates.find((x) => /renew|續|next|下次|下期|billing|扣款|charge/i.test(text.slice(Math.max(0, (x.idx ?? 0) - 40), (x.idx ?? 0) + 10))) || dates.find((x) => x.date >= hkDayKey(now)) || null)?.date || '';
  const received = msg.date ? hkDayKey(Date.parse(msg.date) || now) : hkDayKey(now);
  const svcName = s.svc?.[1] || payeeOf(msg);
  return {
    kind: 'sub', title: svcName.slice(0, 80), body: String(msg.snippet || '').slice(0, 300), service: svcName.slice(0, 80),
    purpose: s.svc ? s.svc[2][lang === 'en' ? 1 : 0] : '', cycle: s.cycle,
    ...(s.amt ? { amount: s.amt.amount, currency: s.amt.currency } : {}),
    renewDate: renewal || nextRenewal(received, s.cycle, now), cancelUrl: s.svc?.[3] || '', date: renewal || '',
  };
}

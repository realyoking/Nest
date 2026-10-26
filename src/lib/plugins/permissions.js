// Plugin permissions: one registry with a human label, short description and risk level (EN / 繁中) for every
// permission. Shared by the creator Studio, the install prompt, Settings, /admin, the bridge gate and the server.
// Private chats, chat memory, secrets and tokens have NO permission and NO API: they can never be granted.
//
// implied: true → comes with a capability or with having code at all (look, tab, widget, background, storage). Such
// permissions are listed in every prompt, need no separate approval and are never "new" in an update, but the user can
// still revoke them per plugin in Settings.
export const PERM_CATS = ['appearance', 'surfaces', 'notify', 'reminders', 'calendar', 'family', 'study', 'info', 'accounts', 'ai', 'device', 'web', 'background'];
export const CAT_LABEL = {
  appearance: ['Appearance', '外觀'], surfaces: ['Tabs & widgets', '分頁及小工具'], notify: ['Notifications', '通知'],
  reminders: ['Reminders', '提醒'], calendar: ['Calendar', '日曆'], family: ['Family', '家庭'], study: ['Study', '學習'],
  info: ['Hong Kong info', '香港資訊'], accounts: ['Connected accounts', '已連接帳戶'], ai: ['Nest AI', 'Nest AI'],
  device: ['Device', '裝置'], web: ['Internet', '互聯網'], background: ['Background', '背景'],
};
// [en label, zh label, en description, zh description]
const P = (cat, risk, en, zh, enD, zhD, extra = {}) => ({ cat, risk, en, zh, enD, zhD, ...extra });
export const PERMS = {
  'appearance.theme': P('appearance', 'low', 'Change colours & background', '更改顏色及背景', 'Recolours Nest and can set a background picture or gradient.', '為 Nest 換顏色，並可設定背景圖片或漸變。', { implied: true, caps: ['theme', 'background'] }),
  'appearance.font': P('appearance', 'low', 'Change fonts', '更改字款', 'Switches Nest to another font from Nest’s safe font list.', '把 Nest 的字款換成 Nest 安全字款清單內的字款。', { implied: true, caps: ['font'] }),
  'ui.tab': P('surfaces', 'low', 'Add a tab', '新增分頁', 'Adds its own page to the menu.', '在選單加入自己的頁面。', { implied: true, caps: ['tab'] }),
  'ui.widget': P('surfaces', 'low', 'Add a Today widget', '在主頁加入小工具', 'Shows a card on the Today page.', '在「今天」頁顯示一張卡。', { implied: true, caps: ['widget'] }),
  'background.schedule': P('background', 'medium', 'Run in the background', '在背景定時執行', 'Runs when Nest opens and then every so often while Nest is open (at most every 15 minutes).', '開啟 Nest 時執行，之後在 Nest 開啟期間定時執行（最密每 15 分鐘）。', { implied: true, caps: ['automation'] }),
  storage: P('device', 'low', 'Save its own data', '儲存自己的資料', 'Keeps up to 64 KB of its own data on this device. It cannot read other plugins’ or Nest’s data.', '在這部裝置儲存最多 64 KB 自己的資料，不能讀取其他插件或 Nest 的資料。', { implied: true, code: true }),
  notify: P('notify', 'medium', 'Send notifications', '發送通知', 'Shows a notice in Nest, or a phone notification if you allowed Nest notifications.', '在 Nest 內顯示通知；如你已允許 Nest 通知，亦可在手機彈出通知。'),
  'reminders.read': P('reminders', 'medium', 'See reminders', '查看提醒', 'Reads the family’s reminders (title, time, who it is for).', '讀取家庭提醒（標題、時間、提醒對象）。'),
  'reminders.write': P('reminders', 'medium', 'Create, edit and delete reminders', '新增、修改及刪除提醒', 'Adds reminders for you, and can change or delete reminders it created.', '為你新增提醒，並可修改或刪除它自己新增的提醒。'),
  'calendar.read': P('calendar', 'medium', 'See calendar events', '查看日曆活動', 'Reads events in the next two weeks from the Nest family calendar.', '讀取 Nest 家庭日曆未來兩星期的活動。'),
  'calendar.write': P('calendar', 'high', 'Create, edit and delete calendar events', '新增、修改及刪除日曆活動', 'Adds events to the Nest family calendar after you confirm each one, and can change or delete only events it created. Every change is logged.', '每次新增前都會先問你，加入 Nest 家庭日曆；只可修改或刪除它自己新增的活動。每項改動都有記錄。'),
  'members.read': P('family', 'medium', 'See family members', '查看家庭成員', 'Sees each member’s initial and role (parent / student). Never names, emails or schools.', '只看到每位成員的首字及角色（家長／學生），不會看到名稱、電郵或學校。'),
  'memory.read': P('family', 'high', 'Read family memory', '讀取家庭記憶', 'Reads the family-visible notes in 家庭記憶 (up to 50). Never private chats, private notes or the people list.', '讀取「家庭記憶」內全家可見的記錄（最多 50 項），不包括私人對話、私人記錄或人物資料。'),
  'memory.write': P('family', 'high', 'Add to family memory', '寫入家庭記憶', 'Saves a new note to 家庭記憶 after you confirm it. The note is marked as added by the plugin and logged.', '經你確認後在「家庭記憶」加入新記錄；記錄會標明由插件加入並留有記錄。'),
  'study.read': P('study', 'medium', 'See homework & quiz history', '查看功課及測驗記錄', 'Reads your quiz results (topic, score, date) from 功課導師 and 溫習測驗.', '讀取「功課導師」及「溫習測驗」的測驗結果（題目、分數、日期）。'),
  'notices.read': P('study', 'medium', 'See school notices', '查看學校通告', 'Reads school notices, tests and homework Nest found for you (title, date, needs reply). Never the email itself.', '讀取 Nest 為你整理的學校通告、測驗及功課（標題、日期、需否回條），不會讀到電郵本身。'),
  'bills.read': P('family', 'medium', 'See bills & subscriptions', '查看帳單及訂閱', 'Reads the family’s subscriptions (service, price, renewal date) and the bills Nest found (payee, amount, due date).', '讀取家庭訂閱（服務、價錢、續訂日期）及 Nest 找到的帳單（收款人、金額、到期日）。'),
  'weather.read': P('info', 'low', 'See the weather', '查看天氣', 'Reads the Hong Kong Observatory weather Nest already shows.', '讀取 Nest 已顯示的天文台天氣。'),
  'transport.read': P('info', 'low', 'See transport times', '查看交通班次', 'Reads next bus / MTR times for your saved stops.', '讀取你已儲存車站的下一班巴士／港鐵時間。'),
  'gmail.read': P('accounts', 'high', 'Read Gmail summaries', '讀取 Gmail 摘要', 'Reads sender name, subject and a short preview of up to 10 recent emails, through Nest’s server. Never your password, sign-in token or full mailbox. Only plugins checked by Nest (Safe or verified) can use it.', '經 Nest 伺服器讀取最多 10 封近期電郵的寄件人名稱、主旨及簡短預覽；永遠不會取得你的密碼、登入憑證或整個郵箱。只限經 Nest 審查（安全或已認證）的插件使用。'),
  'classroom.read': P('accounts', 'high', 'Read Google Classroom', '讀取 Google Classroom', 'Reads class names, assignment titles and due dates (up to 15) from your connected Google Classroom, through Nest’s server. Read-only.', '經 Nest 伺服器讀取已連接 Google Classroom 的班別名稱、功課標題及到期日（最多 15 項），只讀。'),
  'ai.use': P('ai', 'medium', 'Use Nest AI', '使用 Nest AI', 'Asks Nest AI questions. Each answer counts against your family’s AI usage.', '向 Nest AI 提問。每次回答都會計入你家庭的 AI 用量。'),
  network: P('web', 'high', 'Connect to websites', '連接外部網站', 'Loads data and images from the websites listed below, and only those.', '只可從下面列出的網站載入資料及圖片。'),
  'media.photo': P('device', 'medium', 'Take or choose photos', '拍照或選擇相片', 'Asks you to take a photo or pick one in Nest; it only gets a resized copy of the photo you choose.', '在 Nest 內請你拍照或選擇相片；它只會收到你所選相片的縮小版本。'),
  location: P('device', 'high', 'Use your location', '使用你的位置', 'Gets your approximate location (about 1 km) after you allow it.', '在你允許後取得你的大概位置（約 1 公里）。'),
  clipboard: P('device', 'medium', 'Copy to the clipboard', '複製到剪貼簿', 'Copies text it made to your clipboard. It cannot read your clipboard.', '把它產生的文字複製到剪貼簿，不能讀取你的剪貼簿。'),
  'links.open': P('web', 'medium', 'Open links', '開啟連結', 'Opens a web page in a new tab after you confirm.', '在你確認後於新分頁開啟網頁。'),
};
// Every permission is wired to a host API (2026-10-18). Kept for older imports; nothing is "coming soon" any more.
export const SOON = [];
// Permissions touching connected accounts / family records: a plugin that is not labelled Safe needs an extra explicit
// acknowledgement at install (server-enforced: acceptHighRisk), on top of the "not verified by Nest" one.
export const HIGH_DATA = ['gmail.read', 'classroom.read', 'calendar.write', 'memory.read', 'memory.write'];
// Only plugins an admin labelled Safe or Verified may read these (server-enforced on every call). The creator's own
// test install is allowed (it is the creator's own data).
export const VERIFIED_ONLY = ['gmail.read'];
// Served by Nest's server (api/calendar.js op=pdata) — the browser never hands account data to the plugin directly.
export const SERVER_PERMS = ['gmail.read', 'classroom.read', 'calendar.write'];
export const PERM_IDS = Object.keys(PERMS);
export const RISK_LABEL = { high: ['High risk', '高風險'], medium: ['Medium', '中風險'], low: ['Low', '低風險'] };
export const riskLabel = (r, lang) => (RISK_LABEL[r] ? RISK_LABEL[r][lang === 'en' ? 0 : 1] : '');
export const permRisk = (id) => PERMS[id]?.risk || 'medium';
// Highest risk among a list of permissions ('high' | 'medium' | 'low' | null).
export const maxRisk = (ids = []) => (ids.map(permRisk).sort((a, b) => RISK_ORDER[a] - RISK_ORDER[b])[0] || null);
// Permissions that need explicit approval at install (everything not implied).
export const DATA_PERMS = PERM_IDS.filter((p) => !PERMS[p].implied);
// Never grantable — rejected by validation with a clear error. There is no API behind any of these.
export const NEVER = ['chats.read', 'chats.write', 'chats', 'chatmemory.read', 'secrets', 'secrets.read', 'tokens', 'tokens.read', 'auth', 'password', 'cookies'];
export const RISK_ORDER = { high: 0, medium: 1, low: 2 };
// Old ids (≤ 2026-10-18 first release) → current ids.
export const ALIASES = {};

export const permLabel = (id, lang) => { const p = PERMS[id]; return p ? (lang === 'en' ? p.en : p.zh) : id; };
export const permDesc = (id, lang) => { const p = PERMS[id]; return p ? (lang === 'en' ? p.enD : p.zhD) : ''; };
export const catLabel = (c, lang) => (CAT_LABEL[c] ? CAT_LABEL[c][lang === 'en' ? 0 : 1] : c);
export const sortByRisk = (ids) => [...ids].sort((a, b) => (RISK_ORDER[PERMS[a]?.risk] ?? 3) - (RISK_ORDER[PERMS[b]?.risk] ?? 3) || PERM_IDS.indexOf(a) - PERM_IDS.indexOf(b));
// Implied permissions for a manifest's capabilities (+ storage for any plugin with code).
export function impliedFor(capabilities = []) {
  const out = [];
  for (const [id, p] of Object.entries(PERMS)) {
    if (!p.implied) continue;
    if (p.caps?.some((c) => capabilities.includes(c))) out.push(id);
    if (p.code && capabilities.some((c) => ['tab', 'widget', 'automation'].includes(c))) out.push(id);
  }
  return [...new Set(out)];
}
// Network domains: plain https hostnames (optionally a leading "*."), max 10. No IPs, no localhost, no Nest/Google auth hosts.
const HOST = /^(\*\.)?([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const BLOCKED_HOSTS = /(^|\.)(nesty\.cyou|heynest\.vercel\.app|kabo-family\.(vercel\.app|firebaseapp\.com)|googleapis\.com|google\.com|firebaseio\.com|firebaseapp\.com|vercel\.app)$/;
export function cleanDomains(list, errors = []) {
  const out = [];
  for (const raw of (Array.isArray(list) ? list : []).slice(0, 20)) {
    let d = String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!d) continue;
    if (!HOST.test(d) || /^\d+\.\d+\.\d+\.\d+$/.test(d) || d === 'localhost') { errors.push(`network: bad domain ${String(raw).slice(0, 40)}`); continue; }
    if (BLOCKED_HOSTS.test(d.replace(/^\*\./, ''))) { errors.push(`network: ${d} is not allowed`); continue; }
    if (!out.includes(d)) out.push(d);
  }
  if (out.length > 10) { errors.push('network: at most 10 domains'); out.length = 10; }
  return out;
}

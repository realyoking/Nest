// Per-request app environment for the AI (no extra round trips): the client sends a tiny `env` object with each /api/chat
// call; the server validates it and adds what only it knows (Hong Kong time, sign-in, effective plan) as ONE short line.
// Answers "我而家喺邊頁？" / "我用緊咩裝置？" and makes how-to answers point at the right place (sidebar vs tab bar).
import { APP_VERSION } from '../data/changelog.js';

// route → page name the user sees (zh-Hant / en). Unknown /app/... routes fall back to the path.
export const PAGES = [
  [/^\/app\/?$/, '今天', 'Today'], [/^\/app\/agent/, 'AI 助理', 'AI Assistant'], [/^\/app\/tutor/, '功課導師', 'Homework Tutor'],
  [/^\/app\/quiz/, '溫習測驗', 'Study quiz'], [/^\/app\/memory/, '家庭記憶', 'Family memory'], [/^\/app\/reminders/, '提醒', 'Reminders'],
  [/^\/app\/family/, '家庭', 'Family'], [/^\/app\/connections/, '連接', 'Connections'], [/^\/app\/usage/, '用量', 'Usage'],
  [/^\/app\/settings/, '設定', 'Settings'], [/^\/app\/calendar/, '日曆', 'Calendar'], [/^\/app\/more/, '更多', 'More'],
  [/^\/app\/subscriptions/, '訂閱', 'Subscriptions'], [/^\/app\/transport/, '交通', 'Transport'], [/^\/app\/store/, '插件商店', 'Plugin Store'],
  [/^\/app\/studio/, '插件工作室', 'Plugin Studio'], [/^\/app\/profile/, '編輯公開個人頁', 'Edit public profile'], [/^\/app\/u\//, '公開個人頁', 'Public profile'],
  [/^\/app\/changelog/, '最新動態', "What's new"], [/^\/app\/p\//, '插件分頁', 'Plugin tab'],
];
export const pageName = (route, lang = 'zh-Hant') => { const p = PAGES.find(([re]) => re.test(route || '')); return p ? (lang === 'en' ? p[2] : p[1]) : ''; };

export function detectOs(ua = '', platform = '', touch = 0) {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'iPadOS';
  if (/iPhone|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua || platform)) return 'Linux';
  return 'unknown';
}
// Same breakpoints as the layout: ≤860 px → tab bar (phone/tablet portrait), wider → sidebar.
export const sizeClass = (w) => (w <= 600 ? 'phone' : w <= 860 ? 'tablet-narrow' : w <= 1200 ? 'tablet-wide' : 'desktop');

export function detectEnv() {
  if (typeof window === 'undefined') return null;
  try {
    const nav = window.navigator || {};
    const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
    const w = Math.round(window.innerWidth), h = Math.round(window.innerHeight);
    const root = document.documentElement;
    return {
      v: APP_VERSION,
      route: String(location.pathname || '').slice(0, 80),
      tab: (location.hash || '').slice(1, 30),
      display: standalone ? 'pwa' : 'web',
      os: detectOs(nav.userAgent || '', nav.platform || '', nav.maxTouchPoints || 0),
      size: sizeClass(w), w, h,
      nav: w <= 860 ? 'tabbar' : 'sidebar',
      theme: root.dataset.theme === 'dark' ? 'dark' : 'light',
      lang: root.lang || '',
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
      demo: false,
    };
  } catch { return null; }
}

// Server side: validate the client's env and render the one line the model sees.
const pick = (v, list, d) => (list.includes(v) ? v : d);
export function cleanEnv(e) {
  if (!e || typeof e !== 'object') return null;
  const s = (x, n) => String(x ?? '').replace(/[^\w\-/.: ]/g, '').slice(0, n);
  return {
    v: s(e.v, 12), route: s(e.route, 80), tab: s(e.tab, 30),
    display: pick(e.display, ['pwa', 'web'], 'web'),
    os: pick(e.os, ['iOS', 'iPadOS', 'Android', 'Windows', 'macOS', 'ChromeOS', 'Linux', 'unknown'], 'unknown'),
    size: pick(e.size, ['phone', 'tablet-narrow', 'tablet-wide', 'desktop'], 'desktop'),
    w: Math.max(0, Math.min(10000, +e.w || 0)), h: Math.max(0, Math.min(10000, +e.h || 0)),
    nav: pick(e.nav, ['tabbar', 'sidebar'], 'sidebar'), theme: pick(e.theme, ['dark', 'light'], 'light'),
    tz: s(e.tz, 40), demo: !!e.demo,
  };
}
const OSN = { iOS: 'iPhone (iOS)', iPadOS: 'iPad (iPadOS)', Android: 'Android', Windows: 'Windows computer', macOS: 'Mac', ChromeOS: 'Chromebook', Linux: 'Linux computer', unknown: 'unknown device' };
const OSS = { iOS: 'iPhone', iPadOS: 'iPad', Android: 'Android', Windows: 'Windows', macOS: 'Mac', ChromeOS: 'Chromebook', Linux: 'Linux', unknown: 'device' };
// Questions where the environment matters: where am I / which device / how do I find or change something in the app.
// Matched on the last user message only (zh-Hant, zh-Hans, Cantonese, English). Everything else gets the 1-line minimum.
export const ENV_RE = /(邊頁|哪一?頁|哪个页|这页|這頁|呢頁|頁面|页面|分頁|分页|畫面|画面|螢幕|屏幕|裝置|装置|設備|设备|手機|手机|電話|平板|iPad|iPhone|Android|安卓|電腦|电脑|瀏覽器|浏览器|主畫面|主屏幕|安裝|安装|下載|下载|App|應用程式|应用|側欄|侧栏|側邊|侧边|選單|菜单|目錄|按鈕|按钮|頭像|头像|設定|设置|设定|深色|淺色|浅色|主題|主题|時區|时区|版本|點樣搵|點搵|喺邊|在哪|哪裡|哪里|邊度|找不到|搵唔到|怎樣找|怎么找|點樣開|點樣改|怎樣開|怎么开|怎樣改|怎么改|\b(?:page|screen|device|phone|tablet|laptop|computer|browser|install(?:ed)?|app|pwa|sidebar|tab ?bar|menu|button|settings?|dark mode|light mode|theme|time ?zone|version|where (?:is|are|can|do)|how do i (?:find|open|get to|change|turn))\b)/i;
export const wantsEnv = (q) => ENV_RE.test(String(q || '').slice(-400));
// extra (server): { plan: 'pro (beta until 2026-11-18)' }. HK time, language and sign-in are already in the system prompt.
// full=false → one short line (~90 chars): version, page, device + how it is installed, navigation style.
// full=true  → + route/hash, screen size, theme, device time zone (only when not Hong Kong), plan.
export function envLine(env, extra = {}, { full = true } = {}) {
  if (!env) return '';
  const page = pageName(env.route, 'zh-Hant'); const pageEn = pageName(env.route, 'en');
  if (!full) {
    return `App: Nest ${env.v || '?'} · page ${page || env.route || '?'} · ${OSS[env.os] || env.os} ${env.display === 'pwa' ? 'home-screen app' : 'browser'} · ${env.nav === 'tabbar' ? 'bottom tab bar' : 'left sidebar'} (mention only if asked about the app/device).`;
  }
  const parts = [
    `Nest ${env.v || '?'}`,
    `page: ${page ? `${page} (${pageEn}, ${env.route})` : env.route || 'unknown'}${env.tab ? ` #${env.tab}` : ''}`,
    `${env.display === 'pwa' ? 'installed app (home-screen PWA)' : 'in the browser'} on ${OSN[env.os] || env.os}`,
    `screen ${env.size} ${env.w}×${env.h} → navigation: ${env.nav === 'tabbar' ? 'bottom tab bar (今天 / AI 助理 / 功課導師 / 提醒 / 更多) + avatar menu top-right' : 'left sidebar + avatar menu at the sidebar bottom'}`,
    `${env.theme} theme`,
    env.tz && env.tz !== 'Asia/Hong_Kong' ? `device time zone ${env.tz} (not Hong Kong)` : '',
    extra.plan ? `plan ${extra.plan}` : '',
  ].filter(Boolean);
  return `App environment (use ONLY for this question about the app, device or where to find something; never mention it otherwise): ${parts.join(' · ')}.`;
}
